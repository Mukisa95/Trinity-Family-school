import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { pushQueueId } from '@/lib/scheduler/schedule-times';
import { SCHEDULED_DISPATCH_QUEUE } from '@/lib/server/scheduled-dispatch-queue';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireAppUser(request);
    if (!GranularPermissionService.canPerformAction(actor.user, 'notifications', 'list', 'send_notification')) {
      return NextResponse.json({ error: 'You do not have permission to cancel notifications.' }, { status: 403 });
    }
    const { id } = await params;
    if (!id || id.length > 160) return NextResponse.json({ error: 'Invalid notification schedule.' }, { status: 400 });
    const db = getFirestore(getFirebaseAdminApp());
    const ref = db.collection('scheduledNotifications').doc(id);
    const queueRef = db.collection(SCHEDULED_DISPATCH_QUEUE).doc(pushQueueId(id));
    const outcome = await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return 'missing';
      const data = snapshot.data() || {};
      if (actor.user.role !== 'Admin' && data.createdBy !== actor.decoded.uid) return 'forbidden';
      if (data.status !== 'scheduled') return 'finished';
      transaction.update(ref, {
        status: 'cancelled',
        cancelledBy: actor.decoded.uid,
        cancelledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(queueRef, {
        status: 'cancelled',
        leaseUntil: null,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return 'cancelled';
    });
    if (outcome === 'missing') return NextResponse.json({ error: 'Schedule not found.' }, { status: 404 });
    if (outcome === 'forbidden') return NextResponse.json({ error: 'You cannot cancel this schedule.' }, { status: 403 });
    if (outcome === 'finished') return NextResponse.json({ error: 'This schedule has already started or finished.' }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? 'Sign in is required.' : 'Unable to cancel this schedule.' }, { status });
  }
}
