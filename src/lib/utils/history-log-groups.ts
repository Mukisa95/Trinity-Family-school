import type { HistoryLogRecord } from '../services/history-log.service';
import { getHistoryPupilId } from './history-log-navigation';

export const HISTORY_TIME_ZONE = 'Africa/Nairobi';
export type HistoryLogGroup = { key: string; pupilId?: string; day?: string; logs: HistoryLogRecord[] };

export function historyDate(value: HistoryLogRecord['ts']): Date | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: HISTORY_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});

export function historyDay(value: HistoryLogRecord['ts']): string | undefined {
  const date = historyDate(value);
  if (!date) return undefined;
  const parts = Object.fromEntries(dayFormatter.formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Preserve the newest-first input order and every individual action. */
export function groupHistoryLogs(logs: HistoryLogRecord[], names?: Map<string, string | null>): HistoryLogGroup[] {
  const groups = new Map<string, HistoryLogGroup>();
  logs.forEach(log => {
    const pupilId = getHistoryPupilId(log, names);
    const day = historyDay(log.ts);
    // Unknown dates/identities stay separate rather than merging unrelated work.
    const key = pupilId && day ? JSON.stringify([pupilId, day]) : `entry:${log.id}`;
    const group = groups.get(key);
    if (group) group.logs.push(log);
    else groups.set(key, { key, pupilId, day, logs: [log] });
  });
  return [...groups.values()];
}
