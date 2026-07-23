import { NextRequest, NextResponse } from 'next/server';
import { ensureServerFirestoreAuth } from '@/lib/server/ensure-server-firestore-auth';

export const dynamic = 'force-dynamic';
export const revalidate = false;

let webpush: any = null;

function getVapidDetails() {
  return {
    subject: `mailto:${process.env.VAPID_EMAIL || 'admin@trinity-family-schools.com'}`,
    publicKey:
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
      'BKdPGmGr1PGvX5FgBPph5yywU7ilPtSFxSYzpNdf751UHl7dFn-Qgt_qVQWeZ4-KSCkXC1F0VrbnfJ6m7Ozc2W4',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
  };
}

async function getWebPush() {
  if (!webpush) {
    webpush = (await import('web-push')).default;
    const { subject, publicKey, privateKey } = getVapidDetails();
    if (!privateKey) throw new Error('VAPID_PRIVATE_KEY is not set');
    webpush.setVapidDetails(subject, publicKey, privateKey);
  }
  return webpush;
}

/**
 * Send a push notification to a single subscription.
 * Returns true on success, false if expired (subscription will be cleaned up by caller).
 */
async function sendToOne(
  wp: any,
  sub: { endpoint: string; p256dh: string; auth: string },
  payloadStr: string,
  urgency: string
): Promise<{ ok: boolean; expired: boolean }> {
  try {
    await wp.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payloadStr,
      { urgency, TTL: 24 * 60 * 60 }
    );
    return { ok: true, expired: false };
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      return { ok: false, expired: true };
    }
    console.warn(`Push send failed (${err.statusCode}):`, err.body || err.message);
    return { ok: false, expired: false };
  }
}

// ─── POST /api/notifications/send-push ───────────────────────────────────────
//
// Body:
//   {
//     target: 'all' | 'admins' | 'fees_staff' | '<custom ids>',
//     userIds?: string[],          // explicit user IDs (overrides target if provided)
//     payload: {
//       title: string,
//       body: string,
//       url?: string,
//       icon?: string,
//       tag?: string,
//       requireInteraction?: boolean
//     },
//     urgency?: 'high' | 'normal' | 'low'   (default: 'normal')
//     logSentBy?: string                      (userId of sender for history log)
//   }

export async function POST(request: NextRequest) {
  try {
    await ensureServerFirestoreAuth();
    const body = await request.json();
    const { target, userIds: explicitUserIds, payload, urgency = 'normal', logSentBy } = body;

    if (!payload?.title || !payload?.body) {
      return NextResponse.json({ error: 'payload.title and payload.body are required' }, { status: 400 });
    }

    const wp = await getWebPush();

    // ── 1. Resolve target to subscriptions ─────────────────────────────────
    const {
      resolveTargetToUserIds,
      getSubscriptionsForUsers,
      getAllActiveSubscriptions,
    } = await import('@/lib/services/push-notifications.service');

    let subscriptions: any[];

    if (Array.isArray(explicitUserIds) && explicitUserIds.length > 0) {
      subscriptions = await getSubscriptionsForUsers(explicitUserIds);
    } else if (target === 'all') {
      subscriptions = await getAllActiveSubscriptions();
    } else if (target) {
      const userIds = await resolveTargetToUserIds(target);
      subscriptions = await getSubscriptionsForUsers(userIds);
    } else {
      return NextResponse.json({ error: 'Provide target or userIds' }, { status: 400 });
    }

    console.log(`📤 Push blast: ${subscriptions.length} subscription(s), target="${target || 'explicit'}"`);

    if (subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active subscriptions found for target',
        sent: 0,
        failed: 0,
        total: 0,
      });
    }

    // ── 2. Build payload string ──────────────────────────────────────────────
    const payloadStr = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icon-192.png',
      badge: '/icons/badge-72x72.png',
      url: payload.url || '/',
      tag: payload.tag || 'trinity-push',
      requireInteraction: payload.requireInteraction ?? false,
      timestamp: Date.now(),
    });

    // ── 3. Send concurrently (max 20 at a time) ──────────────────────────────
    const { db } = await import('@/lib/firebase');
    const { updateDoc, doc } = await import('firebase/firestore');

    let sent = 0;
    let failed = 0;
    const expiredIds: string[] = [];

    const CONCURRENCY = 20;
    for (let i = 0; i < subscriptions.length; i += CONCURRENCY) {
      const batch = subscriptions.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map((sub) => sendToOne(wp, sub, payloadStr, urgency))
      );

      results.forEach((result, idx) => {
        const sub = batch[idx];
        if (result.status === 'fulfilled') {
          if (result.value.ok) {
            sent++;
          } else {
            failed++;
            if (result.value.expired && sub.id) expiredIds.push(sub.id);
          }
        } else {
          failed++;
        }
      });
    }

    // ── 4. Clean up expired subscriptions ───────────────────────────────────
    if (expiredIds.length > 0) {
      console.log(`🗑️ Removing ${expiredIds.length} expired subscription(s)`);
      await Promise.allSettled(
        expiredIds.map((id) =>
          updateDoc(doc(db, 'pushSubscriptions', id), { isActive: false })
        )
      );
    }

    // ── 5. Log the notification blast ────────────────────────────────────────
    try {
      const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
      await addDoc(collection(db, 'pushNotificationLog'), {
        title: payload.title,
        body: payload.body,
        url: payload.url || '/',
        target: target || 'explicit',
        sentBy: logSentBy || 'system',
        sentAt: serverTimestamp(),
        totalSubscriptions: subscriptions.length,
        sent,
        failed,
        expiredCleaned: expiredIds.length,
      });
    } catch (logErr) {
      console.warn('Could not write notification log:', logErr);
    }

    console.log(`✅ Push blast complete: ${sent} sent, ${failed} failed`);
    return NextResponse.json({
      success: true,
      message: `Push sent: ${sent} delivered, ${failed} failed`,
      sent,
      failed,
      total: subscriptions.length,
    });
  } catch (err) {
    console.error('❌ send-push error:', err);
    return NextResponse.json(
      { error: 'Failed to send push notifications', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET — health check
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'Push Notification Sender' });
}
