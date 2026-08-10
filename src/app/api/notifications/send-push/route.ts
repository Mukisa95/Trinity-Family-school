import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { requireAppUser, sanitizeSystemUser } from '@/lib/server/app-auth';
import {
  getServerPushSubscriptionsForUsers,
  resolvePushTargetToUserIdsAdmin,
  sendServerWebPush,
} from '@/lib/server/push-notifications';
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

export async function POST(request: NextRequest) {
  try {
    const requestedBody = await request.json();
    const scheduledJobId = typeof requestedBody?.scheduledJobId === 'string'
      ? requestedBody.scheduledJobId
      : null;
    const adminDb = getFirestore(getFirebaseAdminApp());
    let actor: Awaited<ReturnType<typeof requireAppUser>>;
    let body = requestedBody;
    let scheduledMetadata: { jobId: string; scheduledFor?: string } | null = null;

    if (scheduledJobId) {
      const cronSecret = process.env.CRON_SECRET;
      const suppliedSecret = request.headers.get('x-cron-secret');
      if (!cronSecret || suppliedSecret !== cronSecret) {
        return NextResponse.json({ error: 'Scheduled dispatch is not authorised.' }, { status: 401 });
      }
      const jobSnapshot = await adminDb.collection('scheduledNotifications').doc(scheduledJobId).get();
      const job = jobSnapshot.data();
      if (!jobSnapshot.exists || job?.status !== 'processing') {
        return NextResponse.json({ error: 'The scheduled notification is not ready for dispatch.' }, { status: 409 });
      }
      const senderId = String(job.createdBy || '');
      const senderSnapshot = senderId
        ? await adminDb.collection('system_users').doc(senderId).get()
        : null;
      if (!senderSnapshot?.exists || senderSnapshot.data()?.isActive === false) {
        return NextResponse.json({ error: 'The scheduling user is no longer active.' }, { status: 403 });
      }
      actor = {
        decoded: { uid: senderId },
        user: sanitizeSystemUser(senderSnapshot.id, senderSnapshot.data() || {}),
      } as Awaited<ReturnType<typeof requireAppUser>>;
      body = {
        target: job.target,
        userIds: job.userIds,
        payload: job.payload,
        destination: job.destination,
        urgency: job.urgency,
      };
      scheduledMetadata = {
        jobId: scheduledJobId,
        scheduledFor: job.runAt?.toDate?.().toISOString?.(),
      };
    } else {
      actor = await requireAppUser(request);
    }

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

    const { target, userIds: explicitUserIds, payload, destination, urgency = 'normal' } = body;

    if (!payload?.title || !payload?.body) {
      return NextResponse.json(
        { error: 'payload.title and payload.body are required' },
        { status: 400 }
      );
    }

    // Resolve users before subscriptions so people whose browser has denied
    // Web Push can still receive the notification in their private app inbox.
    let targetUserIds: string[];
    if (Array.isArray(explicitUserIds) && explicitUserIds.length > 0) {
      targetUserIds = explicitUserIds;
    } else if (target) {
      targetUserIds = await resolvePushTargetToUserIdsAdmin(target);
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

    const subscriptions = await getServerPushSubscriptionsForUsers(targetUserIds);
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
      pushIcon: payload.icon || '/trinity-logo-192.png',
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
        source: scheduledMetadata ? 'scheduled-notifications' : 'push-notifications',
        target: target || 'explicit',
        automaticInAppFallback: true,
        ...(scheduledMetadata ? {
          scheduled: true,
          scheduledJobId: scheduledMetadata.jobId,
          scheduledFor: scheduledMetadata.scheduledFor,
        } : {}),
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

    const pushPayload = {
      title: `${senderSnapshot.displayName}: ${payload.title}`,
      body: payload.body,
      icon: payload.icon || '/trinity-logo-192.png',
      badge: '/icons/trinity-badge-72.png',
      url: notificationUrl,
      tag: payload.tag || `notification-${notificationRef.id}`,
      requireInteraction: payload.requireInteraction ?? false,
      timestamp: Date.now(),
    };

    let sent = 0;
    let failed = 0;
    let expired = 0;
    let rejected = 0;

    if (subscriptions.length > 0) {
      try {
        const result = await sendServerWebPush(subscriptions, pushPayload, { urgency });
        sent = result.accepted;
        failed = result.failed;
        expired = result.expired;
        rejected = result.rejected;
      } catch (pushError) {
        failed = subscriptions.length;
        console.warn('Web Push unavailable; in-app fallback was still delivered:', pushError);
      }
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
        'metadata.expiredCleaned': expired,
        'metadata.vapidRejected': rejected,
      }),
      adminDb.collection('pushNotificationLog').add({
        title: payload.title,
        body: payload.body,
        url: notificationUrl,
        target: target || 'explicit',
        sentBy: actor.decoded.uid,
        source: scheduledMetadata ? 'scheduled-notifications' : 'push-notifications',
        ...(scheduledMetadata ? { scheduledJobId: scheduledMetadata.jobId } : {}),
        sentAt: FieldValue.serverTimestamp(),
        totalRecipients: targetUserIds.length,
        inAppSent,
        totalSubscriptions: subscriptions.length,
        sent,
        failed,
        expiredCleaned: expired,
        vapidRejected: rejected,
        ...(selectedDestination ? { destination: selectedDestination } : {}),
      }),
    ]);

    return NextResponse.json({
      success: true,
      notificationId: notificationRef.id,
      message: subscriptions.length > 0
        ? `In-app delivered to ${inAppSent} user${inAppSent === 1 ? '' : 's'}. Push service accepted ${sent} device alert${sent === 1 ? '' : 's'}; ${failed} failed.`
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
