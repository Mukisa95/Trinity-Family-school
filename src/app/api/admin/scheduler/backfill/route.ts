import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { nextSmsRunAt, pushQueueId, smsQueueId, type SmsScheduleType } from '@/lib/scheduler/schedule-times';
import { SCHEDULED_DISPATCH_QUEUE } from '@/lib/server/scheduled-dispatch-queue';
import { updateNotificationAutomationSettings } from '@/lib/server/notification-automation';

export const dynamic = 'force-dynamic';

function asDate(value: unknown): Date | null {
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    if (actor.user.role !== 'Admin') {
      return NextResponse.json({ error: 'Only an administrator can migrate scheduler jobs.' }, { status: 403 });
    }

    const db = getFirestore(getFirebaseAdminApp());
    const [smsSnapshot, pushSnapshot] = await Promise.all([
      db.collection('scheduledSMS').where('status', '==', 'scheduled').limit(500).get(),
      db.collection('scheduledNotifications').where('status', '==', 'scheduled').limit(500).get(),
    ]);
    const writer = db.bulkWriter();
    const now = new Date();
    let smsQueued = 0;
    let pushQueued = 0;

    smsSnapshot.docs.forEach(document => {
      const data = document.data();
      const lastSentAt = asDate(data.lastSentAt);
      const searchAfter = lastSentAt || new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
      const nextRunAt = nextSmsRunAt(
        data.type as SmsScheduleType,
        data.schedule || {},
        searchAfter,
      );
      if (!nextRunAt) return;
      writer.set(db.collection(SCHEDULED_DISPATCH_QUEUE).doc(smsQueueId(document.id)), {
        channel: 'sms',
        sourceId: document.id,
        status: 'scheduled',
        dueAt: Timestamp.fromDate(nextRunAt),
        leaseUntil: null,
        attempts: 0,
        migratedBy: actor.decoded.uid,
        migratedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      writer.update(document.ref, {
        nextRunAt: Timestamp.fromDate(nextRunAt),
        updatedAt: FieldValue.serverTimestamp(),
      });
      smsQueued += 1;
    });

    pushSnapshot.docs.forEach(document => {
      const runAt = asDate(document.data().runAt);
      if (!runAt) return;
      writer.set(db.collection(SCHEDULED_DISPATCH_QUEUE).doc(pushQueueId(document.id)), {
        channel: 'push',
        sourceId: document.id,
        status: 'scheduled',
        dueAt: Timestamp.fromDate(runAt),
        leaseUntil: null,
        attempts: 0,
        migratedBy: actor.decoded.uid,
        migratedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      pushQueued += 1;
    });

    await writer.close();
    await updateNotificationAutomationSettings({}, actor.decoded.uid);
    return NextResponse.json({
      success: true,
      smsQueued,
      pushQueued,
      attendanceQueueSeeded: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? 'Sign in is required.' : 'Unable to migrate scheduler jobs.' }, { status });
  }
}
