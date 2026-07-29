import type { AttendanceRecord } from '@/types';
import { publishDailyAttendanceSummary } from './attendance-summary.service';

const STORAGE_KEY = 'trinity_attendance_summary_outbox_v2';
const LEGACY_STORAGE_KEY = 'trinity_attendance_summary_outbox_v1';
const DEBOUNCE_MS = 10 * 60 * 1000;
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const inFlight = new Map<string, Promise<void>>();

type OutboxEntry = {
  scope: string;
  date: string;
  classId: string;
  records: AttendanceRecord[];
  dueAt: number;
  replaceClass: boolean;
  token: string;
};

function available() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function read(): Record<string, OutboxEntry> {
  if (!available()) return {};
  try {
    // v1 entries were not identity-scoped. Source attendance was already
    // saved, so discard only that unsafe derived-data queue during migration.
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function write(entries: Record<string, OutboxEntry>) {
  if (!available()) return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch { /* best effort */ }
}

function key(scope: string, date: string, classId: string) {
  return `${scope}::${date}::${classId}`;
}

async function flushKey(entryKey: string) {
  const active = inFlight.get(entryKey);
  if (active) return active;

  const work = (async () => {
    const entries = read();
    const entry = entries[entryKey];
    if (!entry?.scope) return;
    const timer = timers.get(entryKey);
    if (timer) clearTimeout(timer);
    timers.delete(entryKey);

    try {
      await publishDailyAttendanceSummary(
        entry.scope,
        entry.date,
        entry.classId,
        entry.records,
        entry.replaceClass,
      );
      const latest = read();
      // A newer edit may arrive while this publish is in flight. Only remove
      // the exact version that was successfully committed.
      if (latest[entryKey]?.token === entry.token) {
        delete latest[entryKey];
        write(latest);
      } else if (latest[entryKey]) {
        schedule(entryKey, latest[entryKey].dueAt - Date.now());
      }
    } catch (error) {
      console.error('Attendance summary publish failed; keeping it queued:', error);
      const latest = read();
      if (latest[entryKey]?.token === entry.token) {
        latest[entryKey] = { ...entry, dueAt: Date.now() + 60_000 };
        write(latest);
      }
      if (latest[entryKey]) schedule(entryKey, latest[entryKey].dueAt - Date.now());
    }
  })().finally(() => {
    inFlight.delete(entryKey);
  });
  inFlight.set(entryKey, work);
  return work;
}

function schedule(entryKey: string, delay: number) {
  const existing = timers.get(entryKey);
  if (existing) clearTimeout(existing);
  timers.set(entryKey, setTimeout(() => { void flushKey(entryKey); }, Math.max(0, delay)));
}

/** Queue a class projection; repeated pupil changes coalesce into one publish. */
export function queueAttendanceSummaryPublication(
  scope: string,
  date: string,
  classId: string,
  records: AttendanceRecord[],
  replaceClass = false,
) {
  if (!scope || !date || !classId) return;
  const entryKey = key(scope, date, classId);
  const entries = read();
  const previous = entries[entryKey];
  const nextRecords = replaceClass || !previous
    ? records
    : Array.from(new Map(
      [...previous.records, ...records].map(record => [record.pupilId, record]),
    ).values());
  const entry = {
    scope,
    date,
    classId,
    records: nextRecords,
    dueAt: Date.now() + DEBOUNCE_MS,
    replaceClass: replaceClass || previous?.replaceClass || false,
    token: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };
  entries[entryKey] = entry;
  write(entries);
  schedule(entryKey, DEBOUNCE_MS);
}

/** Flush immediately when the recorder leaves a class/session. */
export async function flushAttendanceSummarySession(scope: string, date: string, classId: string) {
  if (!scope) return;
  await flushKey(key(scope, date, classId));
}

/** Recover a session whose tab was closed before its async flush completed. */
export async function flushDueAttendanceSummaryOutbox(scope: string) {
  if (!scope) return;
  const now = Date.now();
  const entries = read();
  const due: Promise<void>[] = [];
  Object.entries(entries)
    .filter(([, entry]) => entry.scope === scope)
    .forEach(([entryKey, entry]) => {
      if (entry.dueAt <= now) due.push(flushKey(entryKey));
      else schedule(entryKey, entry.dueAt - now);
    });
  await Promise.all(due);
}
