import { NextRequest, NextResponse } from 'next/server';
import { requireAppUser } from '@/lib/server/app-auth';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
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

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    if (!canManageSettings(actor.user)) {
      return NextResponse.json({ error: 'You do not have permission to manage notification settings.' }, { status: 403 });
    }
    return NextResponse.json({ settings: await getNotificationAutomationSettings() });
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
