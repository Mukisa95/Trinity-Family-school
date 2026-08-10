export type SmsScheduleType = 'once' | 'weekly' | 'dates';

export type SmsSchedule = Record<string, unknown>;

const KAMPALA_OFFSET_MINUTES = 3 * 60;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function parseKampalaDateTime(value: string): Date {
  if (!value) return new Date(Number.NaN);
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) return new Date(value);

  const [datePart, timePart = '00:00'] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour = 0, minute = 0] = timePart.split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - KAMPALA_OFFSET_MINUTES * 60_000);
}

export function formatKampalaDate(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kampala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function addCalendarDays(date: string, days: number): string {
  const value = parseKampalaDateTime(`${date}T12:00`);
  value.setUTCDate(value.getUTCDate() + days);
  return formatKampalaDate(value);
}

function validDate(value: Date) {
  return Number.isFinite(value.getTime());
}

export function nextSmsRunAt(
  type: SmsScheduleType,
  schedule: SmsSchedule,
  after: Date,
): Date | null {
  if (type === 'once') {
    const candidate = parseKampalaDateTime(String(schedule.dateTime || ''));
    return validDate(candidate) && candidate.getTime() > after.getTime() ? candidate : null;
  }

  if (type === 'dates') {
    const entries = Array.isArray(schedule.entries)
      ? schedule.entries as Array<{ date?: unknown; time?: unknown }>
      : [];
    const candidates = entries
      .map(entry => parseKampalaDateTime(`${String(entry.date || '')}T${String(entry.time || '08:00')}`))
      .filter(candidate => validDate(candidate) && candidate.getTime() > after.getTime())
      .sort((left, right) => left.getTime() - right.getTime());
    return candidates[0] || null;
  }

  if (type === 'weekly') {
    const days = new Set(Array.isArray(schedule.days) ? schedule.days.map(String) : []);
    const times = schedule.times && typeof schedule.times === 'object' && !Array.isArray(schedule.times)
      ? schedule.times as Record<string, unknown>
      : {};
    const startDate = String(schedule.startDate || formatKampalaDate(after));
    const endDate = String(schedule.endDate || '');
    if (!days.size || !endDate || startDate > endDate) return null;

    let cursor = formatKampalaDate(after);
    if (cursor < startDate) cursor = startDate;
    for (let dayOffset = 0; dayOffset <= 370 && cursor <= endDate; dayOffset += 1) {
      const dayValue = parseKampalaDateTime(`${cursor}T12:00`);
      const dayName = DAY_NAMES[dayValue.getUTCDay()];
      if (days.has(dayName)) {
        const candidate = parseKampalaDateTime(`${cursor}T${String(times[dayName] || '08:00')}`);
        if (validDate(candidate) && candidate.getTime() > after.getTime()) return candidate;
      }
      cursor = addCalendarDays(cursor, 1);
    }
  }

  return null;
}

export function nextAttendanceRunAt(
  time: string,
  after: Date,
  schoolDaysOnly: boolean,
): Date {
  let date = formatKampalaDate(after);
  for (let dayOffset = 0; dayOffset <= 14; dayOffset += 1) {
    const candidate = parseKampalaDateTime(`${date}T${time}`);
    const weekDay = parseKampalaDateTime(`${date}T12:00`).getUTCDay();
    const allowedDay = !schoolDaysOnly || (weekDay !== 0 && weekDay !== 6);
    if (allowedDay && candidate.getTime() > after.getTime()) return candidate;
    date = addCalendarDays(date, 1);
  }
  throw new Error('Unable to calculate the next attendance reminder time.');
}

export function smsQueueId(jobId: string) {
  return `sms-${jobId}`;
}

export function pushQueueId(jobId: string) {
  return `push-${jobId}`;
}

export function attendanceQueueId(time: string) {
  return `attendance-${time.replace(':', '')}`;
}
