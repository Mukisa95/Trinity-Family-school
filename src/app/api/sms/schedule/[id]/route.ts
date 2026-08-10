import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { nextSmsRunAt, smsQueueId, type SmsScheduleType } from '@/lib/scheduler/schedule-times';
import { SCHEDULED_DISPATCH_QUEUE } from '@/lib/server/scheduled-dispatch-queue';

export const dynamic = 'force-dynamic';

function canSendSms(user: Awaited<ReturnType<typeof requireAppUser>>['user']) {
  return GranularPermissionService.canPerformAction(user, 'bulk_sms', 'send', 'send_sms');
}

async function authorisedJob(
  request: NextRequest,
  id: string,
  mutate: (context: {
    db: FirebaseFirestore.Firestore;
    transaction: FirebaseFirestore.Transaction;
    ref: FirebaseFirestore.DocumentReference;
    queueRef: FirebaseFirestore.DocumentReference;
    data: FirebaseFirestore.DocumentData;
    actor: Awaited<ReturnType<typeof requireAppUser>>;
  }) => void,
) {
  const actor = await requireAppUser(request);
  if (!canSendSms(actor.user)) return { outcome: 'forbidden' as const };
  const db = getFirestore(getFirebaseAdminApp());
  const ref = db.collection('scheduledSMS').doc(id);
  const queueRef = db.collection(SCHEDULED_DISPATCH_QUEUE).doc(smsQueueId(id));
  const outcome = await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return 'missing' as const;
    const data = snapshot.data() || {};
    if (actor.user.role !== 'Admin' && data.createdBy !== actor.decoded.uid) return 'forbidden' as const;
    mutate({ db, transaction, ref, queueRef, data, actor });
    return 'updated' as const;
  });
  return { outcome };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const schedule = body?.schedule && typeof body.schedule === 'object'
      ? body.schedule as Record<string, unknown>
      : null;
    if (!schedule) return NextResponse.json({ error: 'A valid schedule is required.' }, { status: 400 });

    let invalidSchedule = false;
    const result = await authorisedJob(request, id, ({ transaction, ref, queueRef, data }) => {
      const type = data.type as SmsScheduleType;
      const nextRunAt = nextSmsRunAt(type, schedule, new Date(Date.now() - 1000));
      if (!nextRunAt && data.status === 'scheduled') {
        invalidSchedule = true;
        return;
      }
      transaction.update(ref, {
        schedule,
        nextRunAt: nextRunAt ? Timestamp.fromDate(nextRunAt) : null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (data.status === 'scheduled' && nextRunAt) {
        transaction.set(queueRef, {
          channel: 'sms',
          sourceId: ref.id,
          status: 'scheduled',
          dueAt: Timestamp.fromDate(nextRunAt),
          leaseUntil: null,
          attempts: 0,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    });
    if (invalidSchedule) return NextResponse.json({ error: 'Choose at least one future SMS time.' }, { status: 400 });
    if (result.outcome === 'missing') return NextResponse.json({ error: 'Schedule not found.' }, { status: 404 });
    if (result.outcome === 'forbidden') return NextResponse.json({ error: 'You cannot edit this schedule.' }, { status: 403 });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? 'Sign in is required.' : 'Unable to update this schedule.' }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    let lockedAmount = 0;
    const result = await authorisedJob(request, id, ({ transaction, ref, queueRef, data, actor }) => {
      lockedAmount = Number(data.lockedAmount || 0);
      transaction.update(ref, {
        status: 'cancelled',
        lockedAmount: 0,
        cancelledBy: actor.decoded.uid,
        cancelledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(queueRef, {
        status: 'cancelled',
        leaseUntil: null,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });
    if (result.outcome === 'missing') return NextResponse.json({ error: 'Schedule not found.' }, { status: 404 });
    if (result.outcome === 'forbidden') return NextResponse.json({ error: 'You cannot cancel this schedule.' }, { status: 403 });
    return NextResponse.json({ success: true, lockedAmount });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? 'Sign in is required.' : 'Unable to cancel this schedule.' }, { status });
  }
}
