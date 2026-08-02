import { createHash } from 'crypto';
import { FieldValue, Firestore, getFirestore } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';

import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { getServerVapidDetails } from '@/lib/server/vapid-config';
import {
  getActiveNotificationRecipientIds,
  hasNotificationAccess,
  resolveNotificationParticipant,
} from '@/lib/server/notification-participants';
import { requireAppUser } from '@/lib/server/app-auth';
import { ensureServerFirestoreAuth } from '@/lib/server/ensure-server-firestore-auth';

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

async function sendReplyPushes(
  db: Firestore,
  userIds: string[],
  payload: Record<string, unknown>,
) {
  const { getSubscriptionsForUsers } = await import('@/lib/services/push-notifications.service');
  const subscriptions = await getSubscriptionsForUsers(userIds, getServerVapidDetails().publicKey);
  if (!subscriptions.length) return { sent: 0, failed: 0, total: 0 };

  let sent = 0;
  let failed = 0;
  const expiredIds: string[] = [];
  try {
    const sender = await getWebPush();
    const payloadText = JSON.stringify(payload);
    for (let index = 0; index < subscriptions.length; index += 20) {
      const batch = subscriptions.slice(index, index + 20);
      const results = await Promise.allSettled(batch.map(async subscription => {
        await sender.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          payloadText,
          { urgency: 'normal', TTL: 24 * 60 * 60 },
        );
      }));
      results.forEach((result, itemIndex) => {
        if (result.status === 'fulfilled') sent += 1;
        else {
          failed += 1;
          const statusCode = (result.reason as any)?.statusCode;
          if ((statusCode === 403 || statusCode === 404 || statusCode === 410) && batch[itemIndex]?.id) {
            expiredIds.push(batch[itemIndex].id);
          }
        }
      });
    }
  } catch {
    failed = subscriptions.length;
  }

  if (expiredIds.length) {
    await Promise.allSettled(expiredIds.map(subscriptionId =>
      db.collection('pushSubscriptions').doc(subscriptionId).update({ isActive: false }),
    ));
  }
  return { sent, failed, total: subscriptions.length };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAppUser(request);
    const { id } = await params;
    const body = await request.json();
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const mode = body.mode === 'all' ? 'all' : body.mode === 'sender' ? 'sender' : null;
    const requestId = typeof body.requestId === 'string' ? body.requestId.slice(0, 120) : '';
    if (!message || message.length > 12000 || !mode) {
      return NextResponse.json({ error: 'Provide a reply of up to 12,000 characters.' }, { status: 400 });
    }

    await ensureServerFirestoreAuth();
    const db = getFirestore(getFirebaseAdminApp());
    const original = await db.collection('notifications').doc(id).get();
    if (!original.exists) return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
    const originalData = original.data() as Record<string, any>;
    if (!hasNotificationAccess(originalData, actor.decoded.uid)) {
      return NextResponse.json({ error: 'You do not have access to reply to this notification.' }, { status: 403 });
    }
    if (mode === 'all' && actor.user.role === 'Parent') {
      return NextResponse.json({ error: 'Reply all is unavailable for parent accounts to protect family privacy.' }, { status: 403 });
    }

    const originalRecipients = Array.isArray(originalData.recipientIds)
      ? originalData.recipientIds.filter((value: unknown): value is string => typeof value === 'string' && value.length > 0)
      : [];
    const requestedIds = mode === 'sender'
      ? [String(originalData.createdBy || '')]
      : [String(originalData.createdBy || ''), ...originalRecipients];
    const activeRecipientIds = await getActiveNotificationRecipientIds(
      db,
      [...new Set(requestedIds)].filter(userId => userId && userId !== actor.decoded.uid),
    );
    if (!activeRecipientIds.length) {
      return NextResponse.json({ error: 'There is nobody available to receive this reply.' }, { status: 400 });
    }

    const claimKey = createHash('sha256')
      .update(`${id}:${actor.decoded.uid}:${requestId || message}:${mode}`)
      .digest('hex');
    const claimRef = db.collection('notificationReplyRequests').doc(claimKey);
    const requestClaim = await db.runTransaction(async transaction => {
      const claim = await transaction.get(claimRef);
      if (claim.exists) {
        return {
          alreadyClaimed: true,
          notificationId: String(claim.data()?.notificationId || ''),
        };
      }
      transaction.create(claimRef, {
        notificationId: null,
        originalNotificationId: id,
        requestedBy: actor.decoded.uid,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { alreadyClaimed: false, notificationId: '' };
    });
    if (requestClaim.notificationId) {
      return NextResponse.json({ success: true, notificationId: requestClaim.notificationId, duplicate: true });
    }
    if (requestClaim.alreadyClaimed) {
      return NextResponse.json({ error: 'This reply is already being sent. Please wait a moment.' }, { status: 409 });
    }

    const senderSnapshot = await resolveNotificationParticipant(db, actor.decoded.uid, actor.user);
    const notificationRef = db.collection('notifications').doc();
    const rootNotificationId = String(originalData.rootNotificationId || originalData.threadId || id);
    const threadId = String(originalData.threadId || rootNotificationId);
    const recipientName = mode === 'sender'
      ? (originalData.senderSnapshot?.displayName || 'Original sender')
      : `All original recipients (${activeRecipientIds.length})`;
    const recipients = mode === 'sender'
      ? [{ id: activeRecipientIds[0], type: 'user', name: recipientName }]
      : [{ id: original.id, type: 'group', name: recipientName }];

    await notificationRef.set({
      title: `Re: ${String(originalData.title || 'Notification')}`,
      description: message,
      type: 'announcement',
      priority: originalData.priority || 'medium',
      status: 'pending',
      recipients,
      recipientIds: activeRecipientIds,
      targetGroups: [],
      createdBy: actor.decoded.uid,
      senderSnapshot,
      threadId,
      rootNotificationId,
      replyToNotificationId: id,
      replyMode: mode,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      enablePush: true,
      pushTitle: `Re: ${String(originalData.title || 'Notification')}`,
      pushBody: message,
      pushIcon: '/trinity-logo-192.png',
      pushUrl: typeof originalData.pushUrl === 'string' && originalData.pushUrl.startsWith('/') ? originalData.pushUrl : '/push-notifications',
      deliveryStats: { total: activeRecipientIds.length, sent: 0, delivered: 0, failed: 0, read: 0 },
      actions: [],
      readBy: [],
      metadata: { source: 'notification-reply', originalNotificationId: id, replyMode: mode },
    });

    for (let index = 0; index < activeRecipientIds.length; index += 450) {
      const deliveryBatch = db.batch();
      activeRecipientIds.slice(index, index + 450).forEach(userId => {
        const deliveryRef = db.collection('notificationDeliveries').doc();
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
    }

    const push = await sendReplyPushes(db, activeRecipientIds, {
      title: `${senderSnapshot.displayName}: Re: ${String(originalData.title || 'Notification')}`,
      body: message,
      icon: '/trinity-logo-192.png',
      badge: '/icons/trinity-badge-72.png',
      url: typeof originalData.pushUrl === 'string' && originalData.pushUrl.startsWith('/') ? originalData.pushUrl : '/push-notifications',
      tag: `notification-reply-${rootNotificationId}`,
      timestamp: Date.now(),
    });
    await notificationRef.update({
      status: 'completed',
      sentAt: FieldValue.serverTimestamp(),
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      deliveryStats: { total: activeRecipientIds.length, sent: activeRecipientIds.length, delivered: activeRecipientIds.length, failed: 0, read: 0 },
      'metadata.pushSent': push.sent,
      'metadata.pushFailed': push.failed,
    });
    await claimRef.update({ notificationId: notificationRef.id, completedAt: FieldValue.serverTimestamp() });

    return NextResponse.json({ success: true, notificationId: notificationRef.id, recipientCount: activeRecipientIds.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to send reply.';
    const status = message === 'AUTH_REQUIRED' || message === 'APP_AUTH_REQUIRED' ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? 'Sign in again to send a reply.' : message }, { status });
  }
}
