import type { AcademicYear } from '@/types';
import type { AndroidOfflineSnapshot } from './android-contracts';
import { getTimetableStreamMode, findTimetableEntryForRow, getTimetableRenderedPeriodSpan } from '@/lib/utils/timetable-streams';

/** Same year/term selection as the dashboard, including its explicit fallbacks. */
export function getDashboardTimetableTerm(years: AcademicYear[], now = new Date()) {
  const within = (value: { startDate?: string; endDate?: string }) => Boolean(value.startDate && value.endDate && now >= new Date(value.startDate) && now <= new Date(value.endDate));
  const year = years.find(within) || years.find(value => value.isActive) || years[0];
  const term = year?.terms?.find(within) || year?.terms?.find(value => value.isCurrent) || year?.terms?.[0];
  return { year, term };
}

export function activeTimetableFeed(snapshot: AndroidOfflineSnapshot, timeZone: string, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(value => [value.type, value.value]));
  const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday) + 1;
  const time = `${parts.hour}:${parts.minute}`;
  const seconds = Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second);
  const mins = (value: string) => value.split(':').reduce((sum, part) => sum * 60 + Number(part), 0);
  const { year, term } = getDashboardTimetableTerm((snapshot.datasets.academicYears?.data || []) as unknown as AcademicYear[], new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00`));
  const classes = snapshot.datasets.classes?.data || [];
  const subject = (id: string) => String(snapshot.datasets.subjects?.data.find(value => value.id === id)?.name || 'Information unavailable');
  return (snapshot.datasets.timetables?.data || []).filter(table => table.profile.academicYearId === year?.id && table.profile.termId === term?.id).map(table => {
    const periods = table.periods.filter(period => period.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
    const active = periods.find(period => time >= period.startTime && time < period.endTime);
    const shown = active || periods.find(period => period.startTime > time) || periods.at(-1);
    const ended = Boolean(shown && time >= shown.endTime);
    const inTerm = Boolean(term?.startDate && term?.endDate && `${parts.year}-${parts.month}-${parts.day}` >= term.startDate.slice(0, 10) && `${parts.year}-${parts.month}-${parts.day}` <= term.endDate.slice(0, 10));
    const title = !table.complete ? 'Timetable loading' : !inTerm ? 'Outside this school term' : !shown ? 'No more periods today' : shown.type === 'lesson' ? `Lesson ${shown.periodNumber}${active ? '' : ended ? ' · ended' : ' · upcoming'}` : shown.customLabel || shown.type;
    const rows: { className: string; subject: string }[] = [];
    if (table.complete && inTerm && shown?.type === 'lesson') for (const classId of table.profile.classIds) {
      const schoolClass = classes.find(value => value.id === classId);
      const mode = getTimetableStreamMode(table.profile, classId, day, shown.id);
      const streams = mode === 'separate' ? Array.from(new Set([...(Array.isArray(schoolClass?.streams) ? schoolClass.streams.map(stream => stream.id as string) : []), ...table.entries.filter(entry => entry.classId === classId && entry.streamId).map(entry => entry.streamId!)])) : [''];
      for (const streamId of streams.length ? streams : ['']) {
        let entry = findTimetableEntryForRow(table.entries, classId, shown.id, mode, streamId || undefined);
        if (!entry) for (let i = 0; i < periods.indexOf(shown); i++) {
          const previous = periods[i];
          const anchor = findTimetableEntryForRow(table.entries, classId, previous.id, getTimetableStreamMode(table.profile, classId, day, previous.id), streamId || undefined);
          if (anchor && i + getTimetableRenderedPeriodSpan(periods, i, anchor.periodSpan) > periods.indexOf(shown)) { entry = anchor; break; }
        }
        const configured = Array.isArray(schoolClass?.streams) ? schoolClass.streams.find(stream => stream.id === streamId) : undefined;
        rows.push({ className: `${schoolClass?.code || schoolClass?.name || classId}${streamId ? ` · ${configured?.name || entry?.streamName || streamId}` : ''}`, subject: entry ? `${entry.activityName || subject(entry.subjectId)}${entry.optionalSubjectId ? ` / ${subject(entry.optionalSubjectId)}` : ''}` : 'Unassigned lesson' });
      }
    }
    const end = shown ? mins(shown.endTime) * 60 : 0, start = shown ? mins(shown.startTime) * 60 : 0;
    return { id: table.profile.id, name: table.profile.name, title, rows, active: Boolean(active && inTerm), time: shown && inTerm ? `${shown.startTime} – ${shown.endTime}` : '', remaining: Math.max(0, Math.ceil((end - seconds) / 60)), progress: inTerm && shown ? Math.max(0, Math.min(100, (seconds - start) * 100 / Math.max(1, end - start))) : 0 };
  });
}
