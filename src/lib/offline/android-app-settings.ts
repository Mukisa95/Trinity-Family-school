import { androidOfflineRequest } from './android-bridge';

export type SettingsChoice = { id: string; label: string; classId?: string; classLabel?: string; spotlight?: number };
export type ReminderFilter = 'timetables' | 'classes' | 'subjects' | 'teachers' | 'periods';
export type LessonReminderSettings = {
  enabled: boolean; starts: boolean; ends: boolean; activities: boolean; breaks: boolean;
  beforeStart: number; beforeEnd: number; days: number; snooze: number; quiet: boolean;
  quietStart: string; quietEnd: string; alert: 'sound' | 'vibrate' | 'silent';
  tables: string[] | null; classes: string[] | null; subjects: string[] | null; teachers: string[] | null; periods: string[] | null;
};
export type SurfaceSettings = {
  id: number; label: string; progress: boolean; hiddenTables: string[]; events: boolean;
  tracking: boolean; trackingWithTables: boolean; trackedSubjects: string[]; rowOrder: string[];
};
export type AndroidAppSettings = {
  schema: 1; accountId: string; timeZone: string; expiresAt: string; timetableAllowed: boolean; eventsAllowed: boolean;
  timetables: SettingsChoice[]; subjects: SettingsChoice[]; eventCards: SettingsChoice[];
  card: SurfaceSettings & { notificationCard: boolean; eventReminders: boolean };
  widgets: SurfaceSettings[]; reminders: LessonReminderSettings;
  reminderChoices: Record<ReminderFilter, SettingsChoice[]>; upcoming: { at: number; label: string }[];
  notificationsAllowed: boolean; exactAllowed: boolean;
};
export type AppSettingsAction = 'readAppSettings' | 'previewLessonReminders' | 'saveLessonReminders' | 'saveCardSettings' | 'saveWidgetSettings' | 'testLessonReminders';

/** Match the native ordering policy: hidden cards retain their places. */
export function rememberWidgetOrder(previous: readonly string[], visible: readonly string[]) {
  const result: string[] = []; let index = 0;
  for (const old of previous) {
    const key = visible.includes(old) ? visible[index++] : old;
    if (!result.includes(key)) result.push(key);
  }
  while (index < visible.length) { const key = visible[index++]; if (!result.includes(key)) result.push(key); }
  return result;
}

export async function requestAndroidAppSettings(action: AppSettingsAction, accountId: string, input: Record<string, unknown> = {}): Promise<AndroidAppSettings> {
  try {
    const reply = await androidOfflineRequest(action, { ...input, accountId }) as Awaited<ReturnType<typeof androidOfflineRequest>> & { settings?: AndroidAppSettings };
    const value = reply.settings;
    if (value && value.accountId !== accountId) throw new Error('Your account changed. Reopen App Settings.');
    if (!value || value.schema !== 1 || !Array.isArray(value.widgets) || !Array.isArray(value.timetables) || !value.reminders || !value.card)
      throw new Error('Update the Android app to use inline settings.');
    return value;
  } catch (error) {
    if (error instanceof Error && /Unsupported (?:preparation )?action/i.test(error.message)) throw new Error('Update the Android app to use inline settings.');
    throw error;
  }
}
