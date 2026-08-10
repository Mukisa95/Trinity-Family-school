import 'server-only';

import {
  FieldValue,
  Timestamp,
  type Firestore,
  type Transaction,
} from 'firebase-admin/firestore';
import type { NotificationAutomationSettings } from '@/lib/notifications/automation-settings';
import {
  attendanceQueueId,
  nextAttendanceRunAt,
} from '@/lib/scheduler/schedule-times';

export const SCHEDULED_DISPATCH_QUEUE = 'scheduledDispatchQueue';

export function syncAttendanceDispatches(
  transaction: Transaction,
  db: Firestore,
  previous: NotificationAutomationSettings,
  next: NotificationAutomationSettings,
  actorId: string,
  now = new Date(),
) {
  const previousTimes = new Set(previous.attendanceReminders.times);
  const nextTimes = new Set(next.attendanceReminders.times);

  previousTimes.forEach(time => {
    if (!nextTimes.has(time)) {
      transaction.delete(db.collection(SCHEDULED_DISPATCH_QUEUE).doc(attendanceQueueId(time)));
    }
  });

  nextTimes.forEach(time => {
    const enabled = next.categories.attendance.enabled
      && next.categories.attendance.missingReminders;
    const ref = db.collection(SCHEDULED_DISPATCH_QUEUE).doc(attendanceQueueId(time));
    transaction.set(ref, {
      channel: 'attendance',
      sourceId: time,
      status: enabled ? 'scheduled' : 'paused',
      dueAt: Timestamp.fromDate(nextAttendanceRunAt(
        time,
        now,
        next.attendanceReminders.schoolDaysOnly,
      )),
      timezone: next.attendanceReminders.timezone,
      leaseUntil: null,
      attempts: 0,
      updatedBy: actorId,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}
