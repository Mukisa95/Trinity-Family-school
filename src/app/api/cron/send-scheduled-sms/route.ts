import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { sanitizeSystemUser } from '@/lib/server/app-auth';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { getNotificationAutomationSettings } from '@/lib/server/notification-automation';
import {
  isNotificationAutomationEnabled,
  resolveAutomatedNotificationRecipientIds,
} from '@/lib/notifications/automation-settings';
import {
  formatKampalaDate,
  nextAttendanceRunAt,
  nextSmsRunAt,
  type SmsScheduleType,
} from '@/lib/scheduler/schedule-times';
import { SCHEDULED_DISPATCH_QUEUE } from '@/lib/server/scheduled-dispatch-queue';

export const dynamic = 'force-dynamic';
export const revalidate = false;
// Due notifications perform their own delivery work (recipient resolution,
// inbox fallback, and Web Push). Vercel's default 10-second limit was cutting
// those runs off mid-delivery and leaving the queue lease behind.
export const maxDuration = 60;

const LEASE_MS = 10 * 60 * 1000;
const RETRY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;

type QueueChannel = 'sms' | 'push' | 'attendance';
type DispatchOutcome = {
  terminal: boolean;
  nextRunAt?: Date | null;
  skipped?: boolean;
  reason?: string;
  result?: unknown;
  provider?: Record<string, unknown>;
};

function dateValue(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, 10);
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  }
  return '';
}

function activeAcademicYear(years: Array<Record<string, unknown>>, date: string) {
  return years.find(year => year.isActive === true)
    || years.find(year => date >= dateValue(year.startDate) && date <= dateValue(year.endDate))
    || null;
}

function isExcludedDate(
  date: string,
  academicYear: Record<string, unknown> | null,
  rules: Array<Record<string, any>>,
) {
  const day = new Date(`${date}T12:00:00+03:00`);
  return rules.some(rule => {
    const yearId = String(academicYear?.id || '');
    if (yearId && Array.isArray(rule.skippedYearIds) && rule.skippedYearIds.includes(yearId)) return false;
    if (yearId && rule.applicableYearId && rule.applicableYearId !== 'all' && rule.applicableYearId !== yearId) return false;
    if (rule.type === 'specific_date') return dateValue(rule.date) === date;
    if (rule.type === 'recurring_day_of_week') return day.getDay() === Number(rule.dayOfWeek);
    if (rule.type === 'recurring_monthly') return day.getDate() === Number(rule.dayOfMonth);
    if (rule.type === 'recurring_annual') {
      return day.getDate() === Number(rule.dayOfMonth)
        && day.getMonth() + 1 === Number(rule.monthOfYear);
    }
    return false;
  });
}

function completedClassIds(summary: Record<string, any>) {
  if (summary.completedClasses && typeof summary.completedClasses === 'object' && !Array.isArray(summary.completedClasses)) {
    return new Set(Object.keys(summary.completedClasses));
  }
  return new Set(
    (Array.isArray(summary.records) ? summary.records : [])
      .map((record: { classId?: string }) => record.classId)
      .filter(Boolean),
  );
}

function attendanceTotals(summary: Record<string, any>) {
  const records = Array.isArray(summary.records) ? summary.records : [];
  return records.reduce((totals, record) => {
    totals.total += 1;
    if (record.status === 'Present') totals.present += 1;
    if (record.status === 'Absent') totals.absent += 1;
    if (record.status === 'Late') totals.late += 1;
    if (record.status === 'Delayed') totals.delayed += 1;
    if (record.status === 'Excused') totals.excused += 1;
    return totals;
  }, { total: 0, present: 0, absent: 0, late: 0, delayed: 0, excused: 0 });
}

function attendanceBody(
  completedCount: number,
  expectedCount: number,
  missingNames: string[],
  totals: ReturnType<typeof attendanceTotals>,
) {
  const missing = missingNames.length <= 5
    ? missingNames.join(', ')
    : `${missingNames.slice(0, 5).join(', ')}, and ${missingNames.length - 5} more`;
  const recorded = totals.total
    ? ` ${totals.total} pupils recorded: ${totals.present} present, ${totals.absent} absent, ${totals.late} late${totals.delayed ? `, ${totals.delayed} delayed` : ''}${totals.excused ? `, ${totals.excused} excused` : ''}.`
    : ' No pupil attendance has been recorded yet.';
  return `${completedCount} of ${expectedCount} classes have completed attendance. Missing: ${missing || 'none'}.${recorded}`;
}

function formatPhone(phone: string): string {
  let value = String(phone).replace(/[\s\-()]/g, '');
  if (!value.startsWith('+')) {
    if (value.startsWith('0')) value = `256${value.slice(1)}`;
    else if (!value.startsWith('256')) value = `256${value}`;
    value = `+${value}`;
  }
  return value;
}

async function sendScheduledPush(request: NextRequest, jobId: string) {
  const response = await fetch(`${request.nextUrl.origin}/api/notifications/send-push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cron-secret': process.env.CRON_SECRET || '',
    },
    body: JSON.stringify({ scheduledJobId: jobId }),
    cache: 'no-store',
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Scheduled push delivery failed.');
  return result;
}

async function dispatchSms(sourceId: string, dueAt: Date): Promise<DispatchOutcome> {
  const db = getFirestore(getFirebaseAdminApp());
  const ref = db.collection('scheduledSMS').doc(sourceId);
  const snapshot = await ref.get();
  const job = snapshot.data();
  if (!snapshot.exists || job?.status !== 'scheduled') return { terminal: true, reason: 'SMS schedule is no longer active.' };

  const username = process.env.WIZA_SMS_USERNAME || '';
  const password = process.env.WIZA_SMS_PASSWORD || '';
  if (!username || !password) throw new Error('Wiza credentials are not configured.');
  const phones = Array.isArray(job.recipients?.resolvedPhones)
    ? job.recipients.resolvedPhones.map(formatPhone).filter(Boolean)
    : [];
  if (!phones.length) throw new Error('No phone numbers are available for this SMS.');

  const response = await fetch('https://api.wizasms.ug/v1/sms/send', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contacts: phones,
      message: job.message,
      sender_id: process.env.WIZA_SMS_SENDER_ID || 'TRINITY',
    }),
  });
  const responseText = await response.text();
  let responseData: Record<string, unknown> = {};
  try { responseData = JSON.parse(responseText); } catch { /* provider may return plain text */ }
  if (!response.ok || (responseData.success === false && responseData.status !== 'success')) {
    throw new Error(responseText.slice(0, 300) || 'Wiza rejected this SMS.');
  }

  const nextRunAt = nextSmsRunAt(job.type as SmsScheduleType, job.schedule || {}, dueAt);
  await ref.update({
    status: nextRunAt ? 'scheduled' : job.type === 'once' ? 'sent' : 'completed',
    nextRunAt: nextRunAt ? Timestamp.fromDate(nextRunAt) : null,
    lastSentAt: FieldValue.serverTimestamp(),
    sentAt: job.type === 'once' ? FieldValue.serverTimestamp() : job.sentAt || null,
    lockedAmount: nextRunAt ? Number(job.lockedAmount || 0) : 0,
    lastError: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { terminal: !nextRunAt, nextRunAt, provider: responseData };
}

async function dispatchPush(request: NextRequest, sourceId: string): Promise<DispatchOutcome> {
  const db = getFirestore(getFirebaseAdminApp());
  const ref = db.collection('scheduledNotifications').doc(sourceId);
  const snapshot = await ref.get();
  const job = snapshot.data();
  if (!snapshot.exists || !['scheduled', 'processing'].includes(job?.status)) {
    return { terminal: true, reason: 'Push schedule is no longer active.' };
  }
  await ref.update({
    status: 'processing',
    processingStartedAt: Date.now(),
    attempts: Number(job?.attempts || 0) + 1,
    updatedAt: FieldValue.serverTimestamp(),
  });
  const result = await sendScheduledPush(request, sourceId);
  await ref.update({
    status: 'sent',
    notificationId: result.notificationId || null,
    result,
    sentAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { terminal: true, result };
}

async function dispatchAttendance(
  request: NextRequest,
  slot: string,
  dueAt: Date,
  now: Date,
): Promise<DispatchOutcome> {
  const db = getFirestore(getFirebaseAdminApp());
  const settings = await getNotificationAutomationSettings();
  const enabled = isNotificationAutomationEnabled(settings, 'attendance.missing')
    && settings.attendanceReminders.times.includes(slot);
  if (!enabled) return { terminal: true, reason: 'Attendance reminder is disabled.' };

  const date = formatKampalaDate(dueAt);
  const nextRunAt = nextAttendanceRunAt(
    slot,
    now,
    settings.attendanceReminders.schoolDaysOnly,
  );
  if (settings.attendanceReminders.schoolDaysOnly) {
    const [yearsSnapshot, excludedSnapshot] = await Promise.all([
      db.collection('academicYears').get(),
      db.collection('excludedDays').get(),
    ]);
    const years = yearsSnapshot.docs.map(document => ({ id: document.id, ...document.data() }));
    const excluded = excludedSnapshot.docs.map(document => ({ id: document.id, ...document.data() }));
    const academicYear = activeAcademicYear(years, date);
    if (!academicYear || isExcludedDate(date, academicYear, excluded)) {
      return { terminal: false, nextRunAt, skipped: true, reason: 'Not an active school day.' };
    }
  }

  const [classesSnapshot, summarySnapshot, usersSnapshot] = await Promise.all([
    db.collection('classes').orderBy('order', 'asc').get(),
    db.collection('attendanceDailySummaries').doc(date).get(),
    db.collection('system_users').where('isActive', '==', true).get(),
  ]);
  const classes = classesSnapshot.docs.map(document => ({ id: document.id, ...document.data() }));
  const summary = summarySnapshot.data() || {};
  const completed = completedClassIds(summary);
  const missingClasses = classes.filter(classItem => !completed.has(classItem.id));
  if (!missingClasses.length) {
    return { terminal: false, nextRunAt, skipped: true, reason: 'All classes completed attendance.' };
  }

  const users = usersSnapshot.docs.map(document => sanitizeSystemUser(document.id, document.data()));
  const recipientIds = resolveAutomatedNotificationRecipientIds(
    settings,
    'attendanceMissing',
    users.map(user => user.id),
  );
  const sender = users.find(user => user.id === settings.updatedBy
      && user.role === 'Admin'
      && GranularPermissionService.canPerformAction(user, 'notifications', 'list', 'send_notification'))
    || users.find(user => user.role === 'Admin'
      && GranularPermissionService.canPerformAction(user, 'notifications', 'list', 'send_notification'));
  if (!sender || !recipientIds.length) {
    return { terminal: false, nextRunAt, skipped: true, reason: sender ? 'No eligible recipients.' : 'No eligible admin sender.' };
  }

  const missingNames = missingClasses.map(classItem => String(
    (classItem as Record<string, unknown>).code
      || classItem.id,
  ));
  const totals = attendanceTotals(summary);
  const jobId = `attendance-${date}-${slot.replace(':', '')}`;
  const jobRef = db.collection('scheduledNotifications').doc(jobId);
  const previous = await jobRef.get();
  if (previous.data()?.status === 'sent') {
    return { terminal: false, nextRunAt, skipped: true, reason: 'Reminder was already sent.' };
  }

  await jobRef.set({
    status: 'processing',
    kind: 'attendance-missing',
    payload: {
      title: `Attendance check — ${missingClasses.length} class${missingClasses.length === 1 ? '' : 'es'} pending`,
      body: attendanceBody(classes.length - missingClasses.length, classes.length, missingNames, totals),
      url: `/attendance/view?reportType=school&trendPeriod=daily&date=${encodeURIComponent(date)}`,
      requireInteraction: true,
    },
    userIds: recipientIds,
    urgency: 'high',
    runAt: Timestamp.fromDate(dueAt),
    timezone: settings.attendanceReminders.timezone,
    createdBy: sender.id,
    attempts: Number(previous.data()?.attempts || 0) + 1,
    processingStartedAt: Date.now(),
    createdAt: previous.data()?.createdAt || FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  const result = await sendScheduledPush(request, jobId);
  await jobRef.update({
    status: 'sent',
    notificationId: result.notificationId || null,
    result,
    sentAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { terminal: false, nextRunAt, result };
}

async function claimQueueJob(id: string, now: Date) {
  const db = getFirestore(getFirebaseAdminApp());
  const ref = db.collection(SCHEDULED_DISPATCH_QUEUE).doc(id);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data();
    const dueAt = data?.dueAt?.toDate?.();
    const leaseUntil = data?.leaseUntil?.toDate?.();
    if (!snapshot.exists || data?.status !== 'scheduled' || !(dueAt instanceof Date) || dueAt > now) return null;
    if (leaseUntil instanceof Date && leaseUntil > now) return null;
    const attempts = Number(data.attempts || 0) + 1;
    transaction.update(ref, {
      attempts,
      leaseUntil: Timestamp.fromMillis(now.getTime() + LEASE_MS),
      lastAttemptAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return {
      channel: data.channel as QueueChannel,
      sourceId: String(data.sourceId || ''),
      dueAt,
      attempts,
    };
  });
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const suppliedSecret = request.headers.get('x-cron-secret')
    || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!cronSecret || suppliedSecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getFirestore(getFirebaseAdminApp());
  const now = new Date();
  try {
    // This is the scheduler's only idle Firestore query. It replaces the old
    // scheduled-SMS poll and returns only dispatches whose countdown elapsed.
    const dueSnapshot = await db.collection(SCHEDULED_DISPATCH_QUEUE)
      .where('status', '==', 'scheduled')
      .where('dueAt', '<=', Timestamp.fromDate(now))
      .orderBy('dueAt', 'asc')
      .limit(50)
      .get();
    const results: Array<{ id: string; channel?: QueueChannel; sent: boolean; error?: string; skipped?: boolean }> = [];

    for (const document of dueSnapshot.docs) {
      const claimed = await claimQueueJob(document.id, now);
      if (!claimed || !claimed.sourceId || !['sms', 'push', 'attendance'].includes(claimed.channel)) continue;
      const queueRef = db.collection(SCHEDULED_DISPATCH_QUEUE).doc(document.id);
      try {
        const outcome = claimed.channel === 'sms'
          ? await dispatchSms(claimed.sourceId, claimed.dueAt)
          : claimed.channel === 'push'
            ? await dispatchPush(request, claimed.sourceId)
            : await dispatchAttendance(request, claimed.sourceId, claimed.dueAt, now);
        if (outcome.terminal) {
          await queueRef.set({
            status: 'completed',
            leaseUntil: null,
            completedAt: FieldValue.serverTimestamp(),
            lastOutcome: outcome.reason || 'sent',
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        } else {
          if (!outcome.nextRunAt) throw new Error('Recurring dispatch did not provide its next run time.');
          await queueRef.set({
            status: 'scheduled',
            dueAt: Timestamp.fromDate(outcome.nextRunAt),
            leaseUntil: null,
            attempts: 0,
            lastOutcome: outcome.reason || (outcome.skipped ? 'skipped' : 'sent'),
            lastCompletedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }
        results.push({ id: document.id, channel: claimed.channel, sent: !outcome.skipped, skipped: outcome.skipped });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown dispatch error';
        const exhausted = claimed.attempts >= MAX_ATTEMPTS;
        if (claimed.channel === 'attendance' && exhausted) {
          await queueRef.set({
            status: 'scheduled',
            dueAt: Timestamp.fromDate(nextAttendanceRunAt(claimed.sourceId, now, true)),
            leaseUntil: null,
            attempts: 0,
            lastError: message.slice(0, 500),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          const attendanceJobId = `attendance-${formatKampalaDate(claimed.dueAt)}-${claimed.sourceId.replace(':', '')}`;
          await db.collection('scheduledNotifications').doc(attendanceJobId).set({
            status: 'failed',
            lastError: message.slice(0, 500),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        } else {
          await queueRef.set({
            status: exhausted ? 'failed' : 'scheduled',
            dueAt: exhausted ? claimed.dueAt : Timestamp.fromMillis(now.getTime() + RETRY_MS),
            leaseUntil: null,
            lastError: message.slice(0, 500),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }
        const sourceCollection = claimed.channel === 'sms' ? 'scheduledSMS' : claimed.channel === 'push' ? 'scheduledNotifications' : null;
        if (sourceCollection && exhausted) {
          await db.collection(sourceCollection).doc(claimed.sourceId).set({
            status: claimed.channel === 'push' ? 'failed' : 'error',
            lastError: message.slice(0, 500),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }
        results.push({ id: document.id, channel: claimed.channel, sent: false, error: message });
      }
    }

    return NextResponse.json({ success: true, processed: results.length, results });
  } catch (error) {
    console.error('Unified scheduled dispatch failed:', error);
    return NextResponse.json({ error: 'Unable to process scheduled dispatches.' }, { status: 500 });
  }
}
