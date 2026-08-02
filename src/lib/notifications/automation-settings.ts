export const NOTIFICATION_AUTOMATION_SETTINGS_COLLECTION = 'notificationAutomationSettings';
export const NOTIFICATION_AUTOMATION_SETTINGS_DOCUMENT = 'current';
export const SCHOOL_TIME_ZONE = 'Africa/Kampala';

export type NotificationAutomationSettings = {
  schema: 1;
  categories: {
    schoolPay: boolean;
    attendance: {
      enabled: boolean;
      recorded: boolean;
      missingReminders: boolean;
    };
  };
  attendanceReminders: {
    timezone: string;
    times: string[];
    schoolDaysOnly: boolean;
  };
  updatedAt?: string;
  updatedBy?: string;
};

export const DEFAULT_NOTIFICATION_AUTOMATION_SETTINGS: NotificationAutomationSettings = {
  schema: 1,
  categories: {
    schoolPay: true,
    attendance: {
      enabled: true,
      recorded: true,
      missingReminders: true,
    },
  },
  attendanceReminders: {
    timezone: SCHOOL_TIME_ZONE,
    times: ['08:30', '11:30', '14:00'],
    schoolDaysOnly: true,
  },
};

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Keeps settings safe to use even when older or partially written documents exist. */
export function normalizeReminderTimes(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_NOTIFICATION_AUTOMATION_SETTINGS.attendanceReminders.times];
  const times = Array.from(new Set(
    value.filter((time): time is string => typeof time === 'string' && TIME_PATTERN.test(time)),
  )).sort();
  return times.length ? times.slice(0, 8) : [...DEFAULT_NOTIFICATION_AUTOMATION_SETTINGS.attendanceReminders.times];
}

export function hasValidReminderTimes(value: unknown): boolean {
  return Array.isArray(value)
    && value.length > 0
    && value.length <= 8
    && value.every(time => typeof time === 'string' && TIME_PATTERN.test(time));
}

export function normalizeNotificationAutomationSettings(value: unknown): NotificationAutomationSettings {
  const root = asRecord(value);
  const categories = asRecord(root.categories);
  const attendance = asRecord(categories.attendance);
  const reminders = asRecord(root.attendanceReminders);
  const defaults = DEFAULT_NOTIFICATION_AUTOMATION_SETTINGS;

  return {
    schema: 1,
    categories: {
      schoolPay: asBoolean(categories.schoolPay, defaults.categories.schoolPay),
      attendance: {
        enabled: asBoolean(attendance.enabled, defaults.categories.attendance.enabled),
        recorded: asBoolean(attendance.recorded, defaults.categories.attendance.recorded),
        missingReminders: asBoolean(attendance.missingReminders, defaults.categories.attendance.missingReminders),
      },
    },
    attendanceReminders: {
      // Keep scheduling in the school's fixed operational timezone. This avoids
      // a device's locale silently moving the school's reminder schedule.
      timezone: SCHOOL_TIME_ZONE,
      times: normalizeReminderTimes(reminders.times),
      schoolDaysOnly: asBoolean(reminders.schoolDaysOnly, defaults.attendanceReminders.schoolDaysOnly),
    },
    ...(typeof root.updatedAt === 'string' ? { updatedAt: root.updatedAt } : {}),
    ...(typeof root.updatedBy === 'string' ? { updatedBy: root.updatedBy } : {}),
  };
}

export function mergeNotificationAutomationSettings(
  current: NotificationAutomationSettings,
  patch: unknown,
): NotificationAutomationSettings {
  const next = asRecord(patch);
  const categories = asRecord(next.categories);
  const attendance = asRecord(categories.attendance);
  const reminders = asRecord(next.attendanceReminders);

  return normalizeNotificationAutomationSettings({
    ...current,
    categories: {
      ...current.categories,
      ...categories,
      attendance: {
        ...current.categories.attendance,
        ...attendance,
      },
    },
    attendanceReminders: {
      ...current.attendanceReminders,
      ...reminders,
    },
  });
}

export function isNotificationAutomationEnabled(
  settings: NotificationAutomationSettings,
  category: 'schoolPay' | 'attendance.recorded' | 'attendance.missing',
): boolean {
  if (category === 'schoolPay') return settings.categories.schoolPay;
  if (!settings.categories.attendance.enabled) return false;
  return category === 'attendance.recorded'
    ? settings.categories.attendance.recorded
    : settings.categories.attendance.missingReminders;
}
