/** The attendance writers use local midnight for the school's calendar day. */
function localDay(date: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid attendance date: ${date}`);
  }
  const value = new Date(`${date}T00:00:00`);
  if (Number.isNaN(value.getTime()) || formatLocalDay(value) !== date) {
    throw new Error(`Invalid attendance date: ${date}`);
  }
  return value;
}

function formatLocalDay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getAttendanceDateRangeBounds(startDate: string, endDate: string) {
  const start = localDay(startDate);
  const endExclusive = localDay(endDate);
  if (endExclusive < start) throw new Error('Attendance end date precedes start date');
  endExclusive.setDate(endExclusive.getDate() + 1);
  return {
    start,
    endExclusive,
    legacyStart: startDate,
    legacyEndExclusive: formatLocalDay(endExclusive),
  };
}

/** Merge Timestamp and legacy string-date query results without changing record values. */
export function mergeAttendanceDateResults<T extends { id: string; date: string; recordedAt?: string }>(
  timestampRecords: T[],
  legacyRecords: T[],
): T[] {
  const records = new Map<string, T>();
  for (const record of [...timestampRecords, ...legacyRecords]) {
    if (!records.has(record.id)) records.set(record.id, record);
  }
  const time = (value?: string) => {
    if (!value) return 0;
    const parsed = new Date(value.includes('T') ? value : `${value}T00:00:00`).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  return [...records.values()].sort((a, b) =>
    time(b.date) - time(a.date) ||
    time(b.recordedAt) - time(a.recordedAt) ||
    a.id.localeCompare(b.id)
  );
}
