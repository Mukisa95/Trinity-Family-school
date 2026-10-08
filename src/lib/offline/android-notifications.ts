import { androidOfflineRequest } from './android-bridge';

export interface AndroidNotificationState {
  appName: string;
  permission: 'granted' | 'denied' | 'unknown';
  remotePush: boolean;
  pushEnabled: boolean;
  pushAccountId: string;
}

/** Local Android permission is separate from a server push subscription. */
export async function readAndroidNotificationState(): Promise<AndroidNotificationState> {
  const reply = await androidOfflineRequest('notificationStatus') as Awaited<ReturnType<typeof androidOfflineRequest>> & {
    appName?: string; notificationPermission?: string; remotePush?: boolean; pushEnabled?: boolean; pushAccountId?: string;
  };
  return {
    appName: typeof reply.appName === 'string' ? reply.appName : 'School app',
    permission: reply.notificationPermission === 'granted' ? 'granted' : reply.notificationPermission === 'denied' ? 'denied' : 'unknown',
    remotePush: reply.remotePush === true,
    pushEnabled: reply.pushEnabled !== false,
    pushAccountId: typeof reply.pushAccountId === 'string' ? reply.pushAccountId : '',
  };
}

export function openAndroidNotificationSettings() { return androidOfflineRequest('openNotificationSettings'); }
export function openAndroidLessonReminders() { return androidOfflineRequest('openLessonReminderSettings'); }
export function checkAndroidAppUpdates() { return androidOfflineRequest('checkAppUpdate'); }
export function openAndroidTimetableSettings() { return androidOfflineRequest('openTimetableSettings'); }
export async function restoreAndroidTimetableNotification(): Promise<'restored' | 'settings'> {
  try {
    await androidOfflineRequest('selectTimetable', { notificationCard: true });
    return 'restored';
  } catch (error) {
    if (!(error instanceof Error) || !/Unsupported (?:preparation )?action/i.test(error.message)) throw error;
    await openAndroidTimetableSettings();
    return 'settings';
  }
}
