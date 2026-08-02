import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { requireAppUser } from '@/lib/server/app-auth';
import { ensureServerFirestoreAuth } from '@/lib/server/ensure-server-firestore-auth';
import { getServerVapidDetails } from '@/lib/server/vapid-config';
import {
  getNotificationDestination,
  normalizeInternalNotificationUrl,
  resolveNotificationDestination,
  type ResolvedNotificationDestination,
  type NotificationDestinationSelection,
} from '@/lib/notifications/notification-destinations';
import { resolveNotificationParticipant } from '@/lib/server/notification-participants';

export const dynamic = 'force-dynamic';
export const revalidate = false;

let webpush: any = null;

async function getWebPush() {
  if (!webpush) {
    webpush = (await import('web-push')).default;
    const { subject, publicKey, privateKey } = getServerVapidDetails();
    if (!privateKey) throw new Error('VAPID_PRIVATE_KEY is not set');
    webpush.setVapidDetails(subject, publicKey, privateKey);
  }
  return webpush;
}

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

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    const canSend = GranularPermissionService.canPerformAction(
      actor.user,
      'notifications',
      'list',
      'send_notification'
    );
    if (!canSend) {
      return NextResponse.json(
        { error: 'You do not have permission to send notifications' },
        { status: 403 }
      );
    }

    await ensureServerFirestoreAuth();
    const body = await request.json();
    const { target, userIds: explicitUserIds, payload, destination, urgency = 'normal' } = body;

    if (!payload?.title || !payload?.body) {
      return NextResponse.json(
        { error: 'payload.title and payload.body are required' },
        { status: 400 }
      );
    }

    // Resolve users before subscriptions so people whose browser has denied
    // Web Push can still receive the notification in their private app inbox.
    const {
      resolveTargetToUserIds,
      getSubscriptionsForUsers,
    } = await import('@/lib/services/push-notifications.service');

    let targetUserIds: string[];
    if (Array.isArray(explicitUserIds) && explicitUserIds.length > 0) {
      targetUserIds = explicitUserIds;
    } else if (target) {
      targetUserIds = await resolveTargetToUserIds(target);
    } else {
      return NextResponse.json({ error: 'Provide target or userIds' }, { status: 400 });
    }

    targetUserIds = Array.from(new Set(
      targetUserIds.filter(
        (userId) => typeof userId === 'string' && userId.trim().length > 0
      )
    ));

    if (targetUserIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active users found for this target',
        sent: 0,
        failed: 0,
        total: 0,
        totalRecipients: 0,
        inAppSent: 0,
      });
    }

    const subscriptions = await getSubscriptionsForUsers(targetUserIds);
    const adminDb = getFirestore(getFirebaseAdminApp());
    let selectedDestination: ResolvedNotificationDestination | null = null;
    if (destination) {
      try {
        selectedDestination = resolveNotificationDestination(destination as NotificationDestinationSelection);
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Choose a valid application destination.' },
          { status: 400 },
        );
      }
    }
    const destinationDefinition = selectedDestination
      ? getNotificationDestination(selectedDestination.id)
      : null;

    // Dynamic destinations must still point at a real application record when
    // they are sent. The destination picker supplies stable IDs; names are only
    // a friendly display value and never used to build the link.
    if (selectedDestination?.entityId && destinationDefinition?.entity) {
      const collectionName = destinationDefinition.entity === 'pupil' ? 'pupils' : 'classes';
      const entity = await adminDb.collection(collectionName).doc(selectedDestination.entityId).get();
      if (!entity.exists) {
        return NextResponse.json({ error: 'The selected record no longer exists. Please choose it again.' }, { status: 400 });
      }
    }

    const notificationUrl = selectedDestination?.url
      ?? normalizeInternalNotificationUrl(payload.url || '/');
    const notificationRef = adminDb.collection('notifications').doc();
    const senderSnapshot = await resolveNotificationParticipant(adminDb, actor.decoded.uid, actor.user);
    const targetName = target === 'all'
      ? 'All Users'
      : target === 'admins'
        ? 'Administrators'
        : target === 'fees_staff'
          ? 'Fees / Accounts Staff'
          : 'Selected Users';
    const recipientType = target === 'all'
      ? 'all_users'
      : target === 'admins'
        ? 'all_admins'
        : 'group';

    // A notification record plus user-scoped delivery records form the automatic
    // fallback for browsers where Web Push is denied or unsupported.
    await notificationRef.set({
      title: payload.title,
      description: payload.body,
      type: 'announcement',
      priority: urgency === 'high' ? 'urgent' : urgency === 'low' ? 'low' : 'medium',
      status: 'pending',
      recipients: [{ id: target || 'explicit-users', type: recipientType, name: targetName }],
      recipientIds: targetUserIds,
      targetGroups: [],
      createdBy: actor.decoded.uid,
      senderSnapshot,
      threadId: notificationRef.id,
      rootNotificationId: notificationRef.id,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      enablePush: true,
      pushTitle: payload.title,
      pushBody: payload.body,
      pushIcon: payload.icon || '/icon-192.png',
      pushUrl: notificationUrl,
      deliveryStats: {
        total: targetUserIds.length,
        sent: 0,
        delivered: 0,
        failed: 0,
        read: 0,
      },
      actions: [],
      readBy: [],
      metadata: {
        source: 'push-notifications',
        target: target || 'explicit',
        automaticInAppFallback: true,
        ...(selectedDestination ? { destination: selectedDestination } : {}),
      },
    });

    let inAppSent = 0;
    const DELIVERY_BATCH_SIZE = 450;
    for (let i = 0; i < targetUserIds.length; i += DELIVERY_BATCH_SIZE) {
      const userIdBatch = targetUserIds.slice(i, i + DELIVERY_BATCH_SIZE);
      const deliveryBatch = adminDb.batch();
      userIdBatch.forEach((userId) => {
        const deliveryRef = adminDb.collection('notificationDeliveries').doc();
        deliveryBatch.set(deliveryRef, {
          id: deliveryRef.id,
          notificationId: notificationRef.id,
          userId,
          method: 'in_app',
          status: 'sent',
          sentAt: FieldValue.serverTimestamp(),
          retryCount: 0,
        });
      });
      await deliveryBatch.commit();
      inAppSent += userIdBatch.length;
    }

    console.log(
      `Push blast: ${subscriptions.length} subscription(s), ${inAppSent} inbox delivery/deliveries, target="${target || 'explicit'}"`
    );

    const payloadStr = JSON.stringify({
      title: `${senderSnapshot.displayName}: ${payload.title}`,
      body: payload.body,
      icon: payload.icon || '/icon-192.png',
      badge: '/icons/badge-72x72.png',
      url: notificationUrl,
      tag: payload.tag || 'trinity-push',
      requireInteraction: payload.requireInteraction ?? false,
      timestamp: Date.now(),
    });

    let sent = 0;
    let failed = 0;
    const expiredIds: string[] = [];
    const CONCURRENCY = 20;

    if (subscriptions.length > 0) {
      try {
        const wp = await getWebPush();
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
      } catch (pushError) {
        failed = subscriptions.length;
        console.warn('Web Push unavailable; in-app fallback was still delivered:', pushError);
      }
    }

    if (expiredIds.length > 0) {
      await Promise.allSettled(expiredIds.map((id) =>
        adminDb.collection('pushSubscriptions').doc(id).update({ isActive: false })
      ));
    }

    await Promise.all([
      notificationRef.update({
        status: 'completed',
        sentAt: FieldValue.serverTimestamp(),
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        deliveryStats: {
          total: targetUserIds.length,
          sent: inAppSent,
          delivered: inAppSent,
          failed: 0,
          read: 0,
        },
        'metadata.pushSent': sent,
        'metadata.pushFailed': failed,
        'metadata.expiredCleaned': expiredIds.length,
      }),
      adminDb.collection('pushNotificationLog').add({
        title: payload.title,
        body: payload.body,
        url: notificationUrl,
        target: target || 'explicit',
        sentBy: actor.decoded.uid,
        sentAt: FieldValue.serverTimestamp(),
        totalRecipients: targetUserIds.length,
        inAppSent,
        totalSubscriptions: subscriptions.length,
        sent,
        failed,
        expiredCleaned: expiredIds.length,
        ...(selectedDestination ? { destination: selectedDestination } : {}),
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: subscriptions.length > 0
        ? `In-app delivered to ${inAppSent} user${inAppSent === 1 ? '' : 's'}. Push reached ${sent} device${sent === 1 ? '' : 's'}; ${failed} failed.`
        : `In-app delivered to ${inAppSent} user${inAppSent === 1 ? '' : 's'}. No active Web Push subscription was available.`,
      sent,
      failed,
      total: subscriptions.length,
      totalRecipients: targetUserIds.length,
      inAppSent,
    });
  } catch (err) {
    console.error('send-push error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message)
      ? 401
      : message === 'ACCOUNT_INACTIVE'
        ? 403
        : 500;
    return NextResponse.json(
      {
        error: status === 401
          ? 'Sign in is required'
          : status === 403
            ? 'This account cannot send notifications'
            : 'Failed to send notifications',
        details: message,
      },
      { status }
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'Push Notification Sender' });
}
