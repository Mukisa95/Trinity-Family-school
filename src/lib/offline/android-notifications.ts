import { androidOfflineRequest } from './android-bridge';

export interface AndroidNotificationState {
  appName: string;
  permission: 'granted' | 'denied' | 'unknown';
  remotePush: boolean;
  pushEnabled: boolean;
  pushAccountId: string;
  notificationCard?: boolean;
  liveEvents?: boolean;
  eventReminders?: boolean;
  appVersion?: string;
  appBuild?: number;
}

/** Local Android permission is separate from a server push subscription. */
export async function readAndroidNotificationState(): Promise<AndroidNotificationState> {
  const reply = await androidOfflineRequest('notificationStatus') as Awaited<ReturnType<typeof androidOfflineRequest>> & {
    appName?: string; notificationPermission?: string; remotePush?: boolean; pushEnabled?: boolean; pushAccountId?: string;
    notificationCard?: boolean; liveEvents?: boolean; eventReminders?: boolean;
    appVersion?: string; appBuild?: number;
  };
  return {
    appName: typeof reply.appName === 'string' ? reply.appName : 'School app',
    permission: reply.notificationPermission === 'granted' ? 'granted' : reply.notificationPermission === 'denied' ? 'denied' : 'unknown',
    remotePush: reply.remotePush === true,
    pushEnabled: reply.pushEnabled !== false,
    pushAccountId: typeof reply.pushAccountId === 'string' ? reply.pushAccountId : '',
    ...(typeof reply.notificationCard === 'boolean' ? { notificationCard: reply.notificationCard } : {}),
    ...(typeof reply.liveEvents === 'boolean' ? { liveEvents: reply.liveEvents } : {}),
    ...(typeof reply.eventReminders === 'boolean' ? { eventReminders: reply.eventReminders } : {}),
    ...(typeof reply.appVersion === 'string' && reply.appVersion ? { appVersion: reply.appVersion } : {}),
    ...(typeof reply.appBuild === 'number' && Number.isInteger(reply.appBuild) && reply.appBuild > 0 ? { appBuild: reply.appBuild } : {}),
  };
}

export function openAndroidNotificationSettings() { return androidOfflineRequest('openNotificationSettings'); }
export function openAndroidLessonReminders() { return androidOfflineRequest('openLessonReminderSettings'); }
export function checkAndroidAppUpdates() { return androidOfflineRequest('checkAppUpdate'); }
export function openAndroidTimetableSettings() { return androidOfflineRequest('openTimetableSettings'); }
export function openAndroidWidgetSettings() { return androidOfflineRequest('openWidgetSettings'); }
export async function setAndroidEventPreference(setting: 'events' | 'eventReminders', enabled: boolean) {
  await androidOfflineRequest('selectTimetable', { [setting]: enabled });
  window.dispatchEvent(new Event('trinity-android-notifications-change'));
}
export async function setAndroidTimetableNotification(enabled: boolean): Promise<'updated' | 'settings'> {
  try {
    await androidOfflineRequest('selectTimetable', { notificationCard: enabled });
    window.dispatchEvent(new Event('trinity-android-notifications-change'));
    return 'updated';
  } catch (error) {
    if (!(error instanceof Error) || !/Unsupported (?:preparation )?action/i.test(error.message)) throw error;
    await openAndroidTimetableSettings();
    return 'settings';
  }
}
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
