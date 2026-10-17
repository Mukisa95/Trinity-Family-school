import type { AndroidOfflineSession, AndroidOfflineSnapshot } from '@/lib/offline/android-contracts';
import { getDashboardTimetableTerm } from '@/lib/offline/timetable-feed';
import { getTimetableRenderedPeriodSpan } from '@/lib/utils/timetable-streams';
import type { AcademicYear } from '@/types';

export type TrackedSubject = { key: string; classId: string; subjectId: string; streamId: string; classCode: string; subjectCode: string };
export type AgendaPreferences = { tracked: string[]; periods: boolean; events: boolean; order: ('periods' | 'tracked' | 'events')[] };
export const DEFAULT_AGENDA: AgendaPreferences = { tracked: [], periods: true, events: true, order: ['periods', 'tracked', 'events'] };

export function readAgendaPreferences(value: unknown): AgendaPreferences {
  const input = value as Partial<AgendaPreferences> | null;
  const order = Array.isArray(input?.order) ? input.order.filter((item, index, all) => DEFAULT_AGENDA.order.includes(item) && all.indexOf(item) === index) : [];
  return { tracked: Array.isArray(input?.tracked) ? [...new Set(input.tracked.filter(item => typeof item === 'string'))] : [],
    periods: input?.periods !== false, events: input?.events !== false,
    order: [...order, ...DEFAULT_AGENDA.order.filter(item => !order.includes(item))] };
}

export function schoolClock(timeZone: string, now: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(value => [value.type, value.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday) + 1 };
}

function activeTables(snapshot: AndroidOfflineSnapshot, now: Date) {
  const { year, term } = getDashboardTimetableTerm((snapshot.datasets.academicYears?.data || []) as unknown as AcademicYear[], now);
  return { term, tables: (snapshot.datasets.timetables?.data || []).filter(table => table.profile.academicYearId === year?.id && table.profile.termId === term?.id) };
}

export function trackingOptions(snapshot: AndroidOfflineSnapshot, now: Date): TrackedSubject[] {
  const result = new Map<string, TrackedSubject>();
  for (const table of activeTables(snapshot, now).tables) for (const entry of table.entries) {
    if (entry.entryType === 'activity') continue;
    const schoolClass = snapshot.datasets.classes?.data.find(item => item.id === entry.classId);
    const configured = Array.isArray(schoolClass?.streams) ? schoolClass.streams.find(item => item.id === entry.streamId) : undefined;
    const classCode = `${schoolClass?.code || schoolClass?.name || entry.classId}${entry.streamId ? ` ${configured?.code || entry.streamCode || configured?.name || entry.streamName || entry.streamId}` : ''}`;
    for (const subjectId of [entry.subjectId, entry.optionalSubjectId].filter((id): id is string => !!id)) {
      const subject = snapshot.datasets.subjects?.data.find(item => item.id === subjectId);
      const key = JSON.stringify([entry.classId, entry.streamId || '', subjectId]);
      result.set(key, { key, classId: entry.classId, streamId: entry.streamId || '', subjectId, classCode, subjectCode: String(subject?.code || subject?.name || subjectId) });
    }
  }
  return [...result.values()].sort((a, b) => a.classCode.localeCompare(b.classCode, undefined, { numeric: true }) || a.subjectCode.localeCompare(b.subjectCode));
}

export function trackedLesson(snapshot: AndroidOfflineSnapshot, selection: TrackedSubject, session: AndroidOfflineSession, now: Date): { status: string; start?: string; end?: string } {
  const clock = schoolClock(session.timeZone, now);
  const { tables, term } = activeTables(snapshot, now);
  if (!term?.startDate || !term.endDate || clock.date < term.startDate.slice(0, 10) || clock.date > term.endDate.slice(0, 10)) return { status: 'Outside this school term' };
  if (!tables.length || tables.some(table => !table.complete)) return { status: 'Timetable not fully saved' };
  const lessons = tables.flatMap(table => {
    const periods = table.periods.filter(period => period.dayOfWeek === clock.day).sort((a, b) => a.startTime.localeCompare(b.startTime));
    return table.entries.flatMap(entry => {
      if (entry.entryType === 'activity' || entry.classId !== selection.classId || (entry.streamId || '') !== selection.streamId
        || entry.subjectId !== selection.subjectId && entry.optionalSubjectId !== selection.subjectId) return [];
      const index = periods.findIndex(period => period.id === entry.periodId && period.type === 'lesson');
      if (index < 0) return [];
      const period = periods[index], span = getTimetableRenderedPeriodSpan(periods, index, entry.periodSpan);
      return [{ start: period.startTime, end: periods[Math.min(periods.length - 1, index + span - 1)].endTime }];
    });
  }).sort((a, b) => a.start.localeCompare(b.start));
  const next = lessons.find(lesson => lesson.end > clock.time);
  return next ? { status: next.start <= clock.time ? 'Now' : 'Next', ...next } : { status: lessons.length ? 'Done today' : 'No lesson today' };
}

/** Only authorized, approved calendar entries; use the school's day, not the phone's zone. */
export function agendaEvents(snapshot: AndroidOfflineSnapshot, session: AndroidOfflineSession, showAll: boolean, now: Date) {
  const clock = schoolClock(session.timeZone, now);
  const tomorrow = new Date(`${clock.date}T12:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowDate = tomorrow.toISOString().slice(0, 10);
  const current = `${clock.date}T${clock.time}`;
  const seen = new Set<string>();
  return (snapshot.datasets.events?.data || []).filter(event => {
    if (seen.has(event.id) || !event.title || ['Draft', 'Cancelled', 'Completed'].includes(event.status)
      || event.approvalStatus === 'Rejected' || event.requiresApproval && event.approvalStatus !== 'Approved' && !event.approvedBy) return false;
    seen.add(event.id);
    const startDate = event.startDate?.slice(0, 10), endDate = (event.endDate || event.startDate)?.slice(0, 10);
    const start = `${startDate}T${event.isAllDay ? '00:00' : event.startTime || '00:00'}`;
    const end = `${endDate}T${event.isAllDay ? '23:59' : event.endTime || '23:59'}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate)
      && end >= current && end >= start && (showAll || startDate <= tomorrowDate);
  }).sort((a, b) => a.startDate.localeCompare(b.startDate) || (a.startTime || '').localeCompare(b.startTime || '') || a.title.localeCompare(b.title));
}
