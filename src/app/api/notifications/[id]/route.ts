import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';

import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { ensureServerFirestoreAuth } from '@/lib/server/ensure-server-firestore-auth';

export const dynamic = 'force-dynamic';
export const revalidate = false;

const DELETE_BATCH_SIZE = 400;

function errorStatus(message: string) {
  if (message === 'AUTH_REQUIRED' || message === 'APP_AUTH_REQUIRED') return 401;
  if (message === 'ACCOUNT_INACTIVE') return 403;
  return 500;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAppUser(request);
    const { id } = await params;
    const scope = request.nextUrl.searchParams.get('scope') === 'everyone' ? 'everyone' : 'me';

    await ensureServerFirestoreAuth();
    const db = getFirestore(getFirebaseAdminApp());
    const notificationRef = db.collection('notifications').doc(id);
    const notificationSnapshot = await notificationRef.get();

    if (!notificationSnapshot.exists) {
      return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
    }

    const notification = notificationSnapshot.data() as Record<string, unknown>;
    const isSender = notification.createdBy === actor.decoded.uid;
    if (scope === 'me') {
      const deliveries = await db.collection('notificationDeliveries')
        .where('notificationId', '==', id)
        .where('userId', '==', actor.decoded.uid)
        .get();
      // The delivery document is the authoritative inbox-access record. This
      // also keeps removal working for older notifications created before the
      // recipientIds backfill.
      if (!isSender && deliveries.empty && actor.user.role !== 'Admin') {
        return NextResponse.json({ error: 'You do not have access to this notification.' }, { status: 403 });
      }

      if (!deliveries.empty) {
        const batch = db.batch();
        deliveries.docs.forEach(delivery => batch.delete(delivery.ref));
        await batch.commit();
      }

      return NextResponse.json({
        success: true,
        scope,
        deletedDeliveries: deliveries.size,
      });
    }

    if (!isSender && actor.user.role !== 'Admin') {
      return NextResponse.json(
        { error: 'Only the sender or an administrator can delete this notification from the database.' },
        { status: 403 },
      );
    }

    let deletedDeliveries = 0;
    while (true) {
      const deliveries = await db.collection('notificationDeliveries')
        .where('notificationId', '==', id)
        .limit(DELETE_BATCH_SIZE)
        .get();
      if (deliveries.empty) break;

      const batch = db.batch();
      deliveries.docs.forEach(delivery => batch.delete(delivery.ref));
      await batch.commit();
      deletedDeliveries += deliveries.size;
      if (deliveries.size < DELETE_BATCH_SIZE) break;
    }

    const actorName = [actor.user.firstName, actor.user.lastName].filter(Boolean).join(' ')
      || actor.user.username
      || actor.user.id;
    const finalBatch = db.batch();
    finalBatch.delete(notificationRef);
    finalBatch.set(db.collection('historyLogs').doc(), {
      a: 'delete',
      e: 'notification',
      rid: id,
      rl: `Permanently deleted notification: ${String(notification.title || 'Untitled notification')}`,
      m: {
        notificationId: id,
        notificationTitle: String(notification.title || ''),
        originalSenderId: String(notification.createdBy || ''),
        deletedDeliveries,
      },
      uid: actor.user.id,
      un: actorName,
      ur: actor.user.role,
      ts: Timestamp.now(),
    });
    await finalBatch.commit();

    return NextResponse.json({ success: true, scope, deletedDeliveries });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete notification.';
    return NextResponse.json(
      { error: errorStatus(message) === 401 ? 'Sign in again to delete this notification.' : message },
      { status: errorStatus(message) },
    );
  }
}
