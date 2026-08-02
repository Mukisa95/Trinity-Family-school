import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { sanitizeSystemUser } from '@/lib/server/app-auth';
import { ensureServerFirestoreAuth } from '@/lib/server/ensure-server-firestore-auth';
import { getServerVapidDetails } from '@/lib/server/vapid-config';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { wasPupilActiveOnDate } from '@/lib/utils/pupil-status-utils';
import { isSchoolDay } from '@/lib/utils/attendance-academic-utils';
import { isNotificationAutomationEnabled, SCHOOL_TIME_ZONE } from '@/lib/notifications/automation-settings';
import { getNotificationAutomationSettings } from '@/lib/server/notification-automation';
import type { AcademicYear, Class, ExcludedDay, Pupil } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = false;

// The cron ticks every five minutes. A ten-minute window gives one safe retry
// after a transient send failure; the per-slot claim prevents duplicates.
const REMINDER_WINDOW_MINUTES = 10;
const PROCESSING_LEASE_MS = 15 * 60 * 1000;

type LocalClock = { date: string; time: string; minutes: number };
type Subscription = { id: string; endpoint: string; p256dh: string; auth: string };

function getLocalClock(now = new Date()): LocalClock {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SCHOOL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || '';
  const hour = Number(value('hour'));
  const minute = Number(value('minute'));
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    time: `${value('hour')}:${value('minute')}`,
    minutes: hour * 60 + minute,
  };
}

function isDueSlot(time: string, localMinutes: number): boolean {
  const [hour, minute] = time.split(':').map(Number);
  const scheduled = hour * 60 + minute;
  return localMinutes >= scheduled && localMinutes < scheduled + REMINDER_WINDOW_MINUTES;
}

function activeAcademicYear(years: AcademicYear[], date: string): AcademicYear | null {
  return years.find(year => year.isActive)
    || years.find(year => date >= year.startDate.slice(0, 10) && date <= year.endDate.slice(0, 10))
    || null;
}

function reminderBody(classNames: string[]): string {
  if (classNames.length <= 4) return `${classNames.join(', ')} have not recorded attendance today.`;
  return `${classNames.slice(0, 4).join(', ')}, and ${classNames.length - 4} more have not recorded attendance today.`;
}

async function sendWebPush(subscriptions: Subscription[], payload: string) {
  if (!subscriptions.length) return { sent: 0, failed: 0, expiredIds: [] as string[] };
  const webpushModule = await import('web-push');
  const webpush = webpushModule.default || webpushModule;
  const { subject, publicKey, privateKey } = getServerVapidDetails();
  if (!privateKey) throw new Error('VAPID_PRIVATE_KEY is not set');
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const results = await Promise.allSettled(subscriptions.map(async subscription => {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        payload,
        { urgency: 'high', TTL: 6 * 60 * 60 },
      );
      return { sent: true, expired: false, id: subscription.id };
    } catch (error: any) {
      const status = error?.statusCode;
      return { sent: false, expired: status === 403 || status === 404 || status === 410, id: subscription.id };
    }
  }));

  const settled = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
  return {
    sent: settled.filter(result => result.sent).length,
    failed: subscriptions.length - settled.filter(result => result.sent).length,
    expiredIds: settled.filter(result => result.expired).map(result => result.id),
  };
}

export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret') || request.nextUrl.searchParams.get('secret');
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || (secret !== process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const settings = await getNotificationAutomationSettings();
    const clock = getLocalClock();
    if (!isNotificationAutomationEnabled(settings, 'attendance.missing')) {
      return NextResponse.json({ success: true, skipped: 'Attendance reminders are disabled.', ...clock });
    }

    const dueSlots = settings.attendanceReminders.times.filter(time => isDueSlot(time, clock.minutes));
    if (!dueSlots.length) return NextResponse.json({ success: true, skipped: 'No reminder is due.', ...clock });

    const db = getFirestore(getFirebaseAdminApp());
    const academicSnapshot = await db.collection('academicYears').get();
    const years = academicSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AcademicYear));
    const academicYear = activeAcademicYear(years, clock.date);
    const excludedSnapshot = await db.collection('excludedDays').get();
    const excludedDays = excludedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExcludedDay));
    const schoolDate = new Date(`${clock.date}T12:00:00+03:00`);
    if (settings.attendanceReminders.schoolDaysOnly && !isSchoolDay(schoolDate, academicYear, excludedDays)) {
      return NextResponse.json({ success: true, skipped: 'Today is not a configured school day.', ...clock });
    }

    const [classesSnapshot, pupilsSnapshot, summarySnapshot, usersSnapshot] = await Promise.all([
      db.collection('classes').orderBy('order', 'asc').get(),
      db.collection('pupils').get(),
      db.collection('attendanceDailySummaries').doc(clock.date).get(),
      db.collection('system_users').get(),
    ]);
    const classes = classesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class));
    const classById = new Map(classes.map(classItem => [classItem.id, classItem]));
    const pupils = pupilsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pupil));
    const expectedClassIds = new Set(
      pupils
        .filter(pupil => Boolean(pupil.classId) && wasPupilActiveOnDate(pupil, clock.date))
        .map(pupil => pupil.classId)
        .filter((classId): classId is string => Boolean(classId && classById.has(classId))),
    );

    const summaryData = summarySnapshot.data() || {};
    const completedMap = summaryData.completedClasses;
    const hasCompletionMap = completedMap && typeof completedMap === 'object' && !Array.isArray(completedMap);
    const completedClassIds = new Set<string>(hasCompletionMap
      ? Object.keys(completedMap as Record<string, unknown>)
      // Migration safeguard for a day already recorded before completion
      // markers were introduced. New autosaves preserve completedClasses.
      : Array.from(new Set(
        (Array.isArray(summaryData.records) ? summaryData.records : [])
          .map((record: any) => typeof record?.classId === 'string' ? record.classId : '')
          .filter(Boolean),
      )));
    const missingClassIds = Array.from(expectedClassIds).filter(classId => !completedClassIds.has(classId));
    const missingClassNames = missingClassIds.map(classId => classById.get(classId)?.name || classById.get(classId)?.code || classId);

    const recipientIds = usersSnapshot.docs
      .filter(doc => doc.data()?.isActive !== false)
      .map(doc => sanitizeSystemUser(doc.id, doc.data()))
      .filter(user => (user.role === 'Admin' || user.role === 'Staff') &&
        GranularPermissionService.canPerformAction(user, 'reports', 'dashboard', 'view_stat_attendance_today'))
      .map(user => user.id);

    const results = [];
    for (const slot of dueSlots) {
      const runRef = db.collection('attendanceReminderRuns').doc(`${clock.date}_${slot.replace(':', '')}`);
      const claimed = await db.runTransaction(async transaction => {
        const current = await transaction.get(runRef);
        const data = current.data();
        const startedAt = Number(data?.processingStartedAt || 0);
        if (data?.status === 'completed' || data?.status === 'skipped') return false;
        if (data?.status === 'processing' && startedAt > Date.now() - PROCESSING_LEASE_MS) return false;
        transaction.set(runRef, {
          status: 'processing',
          date: clock.date,
          slot,
          processingStartedAt: Date.now(),
          attempts: Number(data?.attempts || 0) + 1,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return true;
      });

      if (!claimed) {
        results.push({ slot, duplicate: true });
        continue;
      }

      if (!missingClassIds.length || !recipientIds.length) {
        await runRef.set({
          status: 'skipped',
          reason: !missingClassIds.length ? 'All expected classes have recorded attendance.' : 'No eligible recipients.',
          missingClassIds,
          missingClassNames,
          recipientCount: recipientIds.length,
          completedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        results.push({ slot, skipped: true, missingClasses: 0 });
        continue;
      }

      await ensureServerFirestoreAuth();
      const { getSubscriptionsForUsers } = await import('@/lib/services/push-notifications.service');
      const vapid = getServerVapidDetails();
      const subscriptions = await getSubscriptionsForUsers(recipientIds, vapid.publicKey);
      const notificationUrl = `/attendance/view?reportType=school&trendPeriod=daily&date=${encodeURIComponent(clock.date)}`;
      const push = await sendWebPush(subscriptions as Subscription[], JSON.stringify({
        title: `Attendance reminder — ${missingClassIds.length} class${missingClassIds.length === 1 ? '' : 'es'} pending`,
        body: reminderBody(missingClassNames),
        icon: '/trinity-logo-192.png',
        badge: '/icons/trinity-badge-72.png',
        tag: `attendance-reminder-${clock.date}-${slot.replace(':', '')}`,
        url: notificationUrl,
        requireInteraction: true,
      }));
      if (push.expiredIds.length) {
        await Promise.all(push.expiredIds.map(id => db.collection('pushSubscriptions').doc(id).set({
          isActive: false,
          deactivatedAt: FieldValue.serverTimestamp(),
          deactivationReason: 'push-endpoint-expired',
        }, { merge: true })));
      }
      await runRef.set({
        status: 'completed',
        missingClassIds,
        missingClassNames,
        recipientCount: recipientIds.length,
        pushSent: push.sent,
        pushFailed: push.failed,
        completedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      results.push({ slot, missingClasses: missingClassIds.length, pushSent: push.sent, pushFailed: push.failed });
    }

    return NextResponse.json({ success: true, ...clock, results });
  } catch (error) {
    console.error('Attendance reminder job failed:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
