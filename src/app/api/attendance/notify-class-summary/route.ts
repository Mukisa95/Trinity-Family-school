import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser } from '@/lib/server/app-auth';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import {
  attendanceSummaryBody,
  attendanceSummaryFingerprint,
  summariseAttendanceClass,
  type AttendanceNotificationRecord,
} from '@/lib/attendance-notification';
import {
  getServerPushSubscriptionsForUsers,
  sendServerWebPush,
} from '@/lib/server/push-notifications';
import { getNotificationAutomationSettings } from '@/lib/server/notification-automation';
import {
  isNotificationAutomationEnabled,
  resolveAutomatedNotificationRecipientIds,
} from '@/lib/notifications/automation-settings';

export const dynamic = 'force-dynamic';
export const revalidate = false;

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    if (!GranularPermissionService.canPerformAction(actor.user, 'attendance', 'record', 'record_attendance')) {
      return NextResponse.json({ error: 'You do not have permission to record attendance' }, { status: 403 });
    }

    const body = await request.json();
    const date = typeof body?.date === 'string' ? body.date : '';
    const classId = typeof body?.classId === 'string' ? body.classId : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !classId) {
      return NextResponse.json({ error: 'A valid date and classId are required' }, { status: 400 });
    }

    const adminDb = getFirestore(getFirebaseAdminApp());
    const summaryDoc = await adminDb.collection('attendanceDailySummaries').doc(date).get();
    const summaryRecords = Array.isArray(summaryDoc.data()?.records)
      ? summaryDoc.data()!.records as AttendanceNotificationRecord[]
      : [];
    const summary = summariseAttendanceClass(date, classId, summaryRecords);
    if (!summary.total) {
      return NextResponse.json({ error: 'No published attendance was found for this class' }, { status: 409 });
    }

    // The derived summary can be published by autosave before a class is
    // finished. This route is called only after explicit Save, so it is the
    // authoritative point at which a class stops being "unrecorded".
    await summaryDoc.ref.set({
      completedClasses: {
        [classId]: {
          completedAt: FieldValue.serverTimestamp(),
          completedBy: actor.decoded.uid,
          recordCount: summary.total,
        },
      },
    }, { merge: true });

    const automationSettings = await getNotificationAutomationSettings();
    if (!isNotificationAutomationEnabled(automationSettings, 'attendance.recorded')) {
      return NextResponse.json({ success: true, skipped: true, reason: 'Attendance recorded alerts are disabled.' });
    }

    const activeUsers = await adminDb.collection('system_users')
      .where('isActive', '==', true)
      .get();
    const recipientIds = resolveAutomatedNotificationRecipientIds(
      automationSettings,
      'attendanceRecorded',
      activeUsers.docs.map(userDoc => userDoc.id),
    );

    const fingerprint = attendanceSummaryFingerprint(summary);
    const eventRef = adminDb.collection('attendanceNotificationEvents')
      .doc(Buffer.from(fingerprint).toString('base64url'));
    const began = await adminDb.runTransaction(async transaction => {
      const existing = await transaction.get(eventRef);
      if (existing.exists && existing.data()?.status === 'completed') {
        return { duplicate: true };
      }
      transaction.set(eventRef, {
        status: 'processing',
        fingerprint,
        date,
        classId,
        createdBy: actor.decoded.uid,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return { duplicate: false };
    });

    if (began.duplicate) {
      return NextResponse.json({ success: true, duplicate: true });
    }

    const clickUrl = `/?attendanceDate=${encodeURIComponent(date)}&attendanceClassId=${encodeURIComponent(classId)}&attendanceNotice=${encodeURIComponent(eventRef.id)}`;
    const title = `Attendance recorded — ${summary.className}`;
    const message = attendanceSummaryBody(summary);

    const subscriptions = await getServerPushSubscriptionsForUsers(recipientIds);
    let push = { accepted: 0, failed: subscriptions.length };
    try {
      push = await sendServerWebPush(subscriptions, {
        title,
        body: message,
        icon: '/trinity-logo-192.png',
        badge: '/icons/trinity-badge-72.png',
        tag: `attendance-${date}-${classId}`,
        url: clickUrl,
        requireInteraction: false,
      }, { deactivateExpired: false });
    } catch (error) {
      console.warn('Attendance Web Push unavailable; inbox delivery remains active:', error);
    }

    await eventRef.update({
        status: 'completed',
        recipientCount: recipientIds.length,
        pushSent: push.accepted,
        pushFailed: push.failed,
        completedAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json({
      success: true,
      recipients: recipientIds.length,
      pushSent: push.accepted,
      pushFailed: push.failed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(message) ? 401
      : message === 'ACCOUNT_INACTIVE' ? 403 : 500;
    console.error('Attendance notification failed:', error);
    return NextResponse.json({ error: status === 401 ? 'Sign in is required' : 'Unable to send attendance notification' }, { status });
  }
}
