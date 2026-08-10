import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { requireAppUser, sanitizeSystemUser } from '@/lib/server/app-auth';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { getServerVapidDetails } from '@/lib/server/vapid-config';
import { hasValidReminderTimes } from '@/lib/notifications/automation-settings';
import {
  getNotificationAutomationSettings,
  updateNotificationAutomationSettings,
} from '@/lib/server/notification-automation';

export const dynamic = 'force-dynamic';
export const revalidate = false;

function canManageSettings(user: Parameters<typeof GranularPermissionService.canPerformAction>[0]) {
  return GranularPermissionService.canPerformAction(
    user,
    'notifications',
    'list',
    'manage_notification_settings',
  );
}

function canReceiveFeeAlerts(user: ReturnType<typeof sanitizeSystemUser>) {
  return GranularPermissionService.canAccessPage(user, 'fees', 'collection')
    && GranularPermissionService.canAccessPage(user, 'fees', 'collect');
}

function canReceiveAttendanceAlerts(user: ReturnType<typeof sanitizeSystemUser>) {
  return Boolean(user.id);
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    if (!canManageSettings(actor.user)) {
      return NextResponse.json({ error: 'You do not have permission to manage notification settings.' }, { status: 403 });
    }
    const db = getFirestore(getFirebaseAdminApp());
    const [settings, usersSnapshot, subscriptionsSnapshot] = await Promise.all([
      getNotificationAutomationSettings(),
      db.collection('system_users').where('isActive', '==', true).get(),
      db.collection('pushSubscriptions').where('isActive', '==', true).get(),
    ]);
    const deliveryReadySubscriptionCounts = new Map<string, number>();
    const currentVapidPublicKey = getServerVapidDetails().publicKey;
    subscriptionsSnapshot.docs.forEach(document => {
      const data = document.data();
      // The sender applies the same VAPID-key check. Showing only those
      // subscriptions prevents the settings page from claiming an old device
      // can receive a notification when it cannot.
      if (data.vapidPublicKey !== currentVapidPublicKey) return;
      const userId = String(data.userId || '');
      if (userId) {
        deliveryReadySubscriptionCounts.set(
          userId,
          (deliveryReadySubscriptionCounts.get(userId) || 0) + 1,
        );
      }
    });
    const recipients = usersSnapshot.docs
      .map(document => sanitizeSystemUser(document.id, document.data()))
      .map(user => {
        const attendanceEligible = canReceiveAttendanceAlerts(user);
        return {
          id: user.id,
          username: user.username,
          displayName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username,
          role: user.role,
          subscriptionCount: deliveryReadySubscriptionCounts.get(user.id) || 0,
          eligible: {
            schoolPay: canReceiveFeeAlerts(user),
            attendanceRecorded: attendanceEligible,
            attendanceMissing: attendanceEligible,
          },
        };
      })
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
    return NextResponse.json({ settings, recipients });
  } catch (error) {
    const status = error instanceof Error && ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(error.message) ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? 'Sign in is required.' : 'Unable to load notification settings.' }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    if (!canManageSettings(actor.user)) {
      return NextResponse.json({ error: 'You do not have permission to manage notification settings.' }, { status: 403 });
    }
    const patch = await request.json();
    const suppliedTimes = patch?.attendanceReminders?.times;
    if (suppliedTimes !== undefined && !hasValidReminderTimes(suppliedTimes)) {
      return NextResponse.json({ error: 'Add between one and eight valid reminder times.' }, { status: 400 });
    }
    const settings = await updateNotificationAutomationSettings(patch, actor.decoded.uid);
    return NextResponse.json({ settings });
  } catch (error) {
    const status = error instanceof Error && ['AUTH_REQUIRED', 'APP_AUTH_REQUIRED'].includes(error.message) ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? 'Sign in is required.' : 'Unable to save notification settings.' }, { status });
  }
}
