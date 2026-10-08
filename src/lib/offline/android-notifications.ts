import { androidOfflineRequest } from './android-bridge';

export interface AndroidNotificationState {
  appName: string;
  permission: 'granted' | 'denied' | 'unknown';
  remotePush: boolean;
}

/** Local Android permission is separate from a server push subscription. */
export async function readAndroidNotificationState(): Promise<AndroidNotificationState> {
  const reply = await androidOfflineRequest('notificationStatus') as Awaited<ReturnType<typeof androidOfflineRequest>> & {
    appName?: string; notificationPermission?: string; remotePush?: boolean;
  };
  return {
    appName: typeof reply.appName === 'string' ? reply.appName : 'School app',
    permission: reply.notificationPermission === 'granted' ? 'granted' : reply.notificationPermission === 'denied' ? 'denied' : 'unknown',
    remotePush: reply.remotePush === true,
  };
}

export function openAndroidNotificationSettings() { return androidOfflineRequest('openNotificationSettings'); }
export function openAndroidLessonReminders() { return androidOfflineRequest('openLessonReminderSettings'); }
