import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { requireAppUser, sanitizeSystemUser } from '@/lib/server/app-auth';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import {
  attendanceSummaryBody,
  attendanceSummaryFingerprint,
  summariseAttendanceClass,
  type AttendanceNotificationRecord,
} from '@/lib/attendance-notification';
import { getServerVapidDetails } from '@/lib/server/vapid-config';
import { getNotificationAutomationSettings } from '@/lib/server/notification-automation';
import { isNotificationAutomationEnabled } from '@/lib/notifications/automation-settings';

export const dynamic = 'force-dynamic';
export const revalidate = false;

async function sendWebPush(
  subscriptions: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>,
  payload: string,
) {
  if (!subscriptions.length) return { sent: 0, failed: 0 };
  try {
    const webpush = (await import('web-push')).default;
    const { subject, publicKey, privateKey } = getServerVapidDetails();
    if (!privateKey) throw new Error('VAPID_PRIVATE_KEY is not set');
    webpush.setVapidDetails(subject, publicKey, privateKey);
    let sent = 0;
    let failed = 0;
    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          payload,
          { urgency: 'normal', TTL: 24 * 60 * 60 },
        );
        sent += 1;
      } catch {
        failed += 1;
      }
    }
    return { sent, failed };
  } catch (error) {
    console.warn('Attendance Web Push unavailable; inbox delivery remains active:', error);
    return { sent: 0, failed: subscriptions.length };
  }
}

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

    const allUsers = await adminDb.collection('system_users').get();
    const recipientIds = allUsers.docs
      .filter(userDoc => userDoc.data()?.isActive !== false)
      .map(userDoc => sanitizeSystemUser(userDoc.id, userDoc.data()))
      .filter(user => (user.role === 'Admin' || user.role === 'Staff') &&
        GranularPermissionService.canPerformAction(user, 'reports', 'dashboard', 'view_stat_attendance_today'))
      .map(user => user.id);

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

    const subscriptions: Array<{ id: string; endpoint: string; p256dh: string; auth: string }> = [];
    for (let index = 0; index < recipientIds.length; index += 10) {
      const subscriptionDocs = await adminDb.collection('pushSubscriptions')
        .where('userId', 'in', recipientIds.slice(index, index + 10))
        .where('isActive', '==', true)
        .get();
      const currentPublicKey = getServerVapidDetails().publicKey;
      subscriptionDocs.docs.forEach(doc => {
        const subscription = { id: doc.id, ...doc.data() } as any;
        if (subscription.vapidPublicKey === currentPublicKey) subscriptions.push(subscription);
      });
    }
    const push = await sendWebPush(subscriptions, JSON.stringify({
      title,
      body: message,
      icon: '/trinity-logo-192.png',
      badge: '/icons/trinity-badge-72.png',
      tag: `attendance-${date}-${classId}`,
      url: clickUrl,
      requireInteraction: false,
    }));

    await eventRef.update({
        status: 'completed',
        recipientCount: recipientIds.length,
        pushSent: push.sent,
        pushFailed: push.failed,
        completedAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json({
      success: true,
      recipients: recipientIds.length,
      pushSent: push.sent,
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
