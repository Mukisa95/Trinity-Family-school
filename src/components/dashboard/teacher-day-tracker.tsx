'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import type { Class, GeneratedPeriod, TimetableEntry, TimetableProfile } from '@/types';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { useSubjects } from '@/lib/hooks/use-subjects';
import { useExams } from '@/lib/hooks/use-exams';
import { useEvents } from '@/lib/hooks/use-events-fixed';
import { useExcludedDays } from '@/lib/hooks/use-excluded-days';
import { useTimetableProfiles, useTimetablePeriods, useTimetableEntries } from '@/lib/hooks/use-timetable';
import { getDashboardTimetableTerm } from '@/lib/offline/timetable-feed';
import { isSchoolDay } from '@/lib/utils/attendance-academic-utils';
import { buildTeacherLessons, getSchoolClock, getTeacherActivities, getTeacherDay, timeMinutes, type TeacherTimetable } from '@/lib/dashboard/teacher-day';

const EMPTY_PERIODS: GeneratedPeriod[] = [];
const EMPTY_ENTRIES: TimetableEntry[] = [];
type LoadedTable = TeacherTimetable & { loading: boolean; failed: boolean };

function ProfileData({ profile, onData }: { profile: TimetableProfile; onData: (table: LoadedTable) => void }) {
  const periods = useTimetablePeriods(profile.academicYearId, profile.termId, profile.id);
  const entries = useTimetableEntries(profile.academicYearId, profile.termId, profile.id);
  useEffect(() => {
    onData({ profile, periods: periods.data || EMPTY_PERIODS, entries: entries.data || EMPTY_ENTRIES,
      loading: periods.isLoading || entries.isLoading, failed: periods.isError || entries.isError });
  }, [profile, periods.data, entries.data, periods.isLoading, entries.isLoading, periods.isError, entries.isError, onData]);
  return null;
}

export function TeacherDayTracker({ staffId, classes, assignedClassIds }: { staffId: string; classes: Class[]; assignedClassIds: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const lessonListId = useId();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setInterval(update, 15_000);
    window.addEventListener('focus', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); };
  }, []);
  const clock = getSchoolClock(now);
  const years = useAcademicYears();
  const { year, term } = getDashboardTimetableTerm(years.data || [], new Date(`${clock.date}T12:00:00`));
  const profiles = useTimetableProfiles(year?.id || '', term?.id || '');
  const subjects = useSubjects();
  const exams = useExams();
  const events = useEvents();
  const excluded = useExcludedDays();
  const [tables, setTables] = useState<Record<string, LoadedTable>>({});
  const receive = useCallback((table: LoadedTable) => setTables(previous => ({ ...previous, [`${table.profile.academicYearId}:${table.profile.termId}:${table.profile.id}`]: table })), []);
  const currentTables = (profiles.data || []).map(profile => tables[`${profile.academicYearId}:${profile.termId}:${profile.id}`]).filter((table): table is LoadedTable => !!table);
  const inTerm = !!term && clock.date >= term.startDate.slice(0, 10) && clock.date <= term.endDate.slice(0, 10)
    && isSchoolDay(new Date(`${clock.date}T12:00:00`), year || null, excluded.data || []);
  const lessons = buildTeacherLessons(inTerm ? currentTables : [], staffId, classes, subjects.data || [], clock.day);
  const relevantClassIds = [...new Set([...assignedClassIds, ...lessons.map(lesson => lesson.classId)])];
  const activities = getTeacherActivities(events.data || [], exams.data || [], relevantClassIds, clock.date);
  const day = getTeacherDay(lessons, activities, clock.minutes);
  const activity = day.overriding[0];
  const lesson = day.current[0] || day.upcoming[0];
  const start = activity?.startTime || lesson?.startTime;
  const end = activity?.endTime || lesson?.endTime;
  const upcoming = !activity && !day.current.length && !!lesson;
  const progress = start && end ? Math.max(0, Math.min(100, (clock.minutes - timeMinutes(start)) * 100 / Math.max(1, timeMinutes(end) - timeMinutes(start)))) : 0;
  const minutesLeft = end ? Math.max(0, Math.ceil(timeMinutes(upcoming ? start! : end) - clock.minutes)) : 0;
  const loading = years.isLoading || profiles.isLoading || subjects.isLoading || excluded.isLoading || events.isLoading || exams.isLoading || currentTables.length < (profiles.data?.length || 0) || currentTables.some(table => table.loading);
  const failed = years.isError || profiles.isError || subjects.isError || currentTables.some(table => table.failed);
  const remaining = day.upcoming.filter(item => activity || item.id !== lesson?.id);
  const next = remaining[0];
  const title = activity?.title || (lesson ? `${lesson.subjectCode} · ${lesson.className}` : '');
  const timeLabel = activity?.allDay ? 'All day' : `${start}–${end === '24:00' ? 'End of day' : end}`;

  return <section aria-label="My teaching today" data-dashboard-personal-tracker className="relative min-w-0 rounded-xl bg-white px-3 py-2.5 text-gray-800 dark:bg-slate-900 dark:text-slate-100" style={{ border: '2px solid #c7d2fe', boxShadow: '0 0 0 4px rgba(99,102,241,0.08), 0 2px 8px rgba(99,102,241,0.10)' }}>
    {(profiles.data || []).map(profile => <ProfileData key={`${profile.academicYearId}:${profile.termId}:${profile.id}`} profile={profile} onData={receive} />)}
    <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
      <h2 className="flex items-center gap-1.5 text-xs font-bold"><BookOpen className="h-3.5 w-3.5 text-indigo-500" />My teaching today</h2>
      {title && <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${activity ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>{activity ? activity.isExam ? 'Exam' : 'Event' : upcoming ? 'Upcoming' : 'Now'}</span>}
    </div>
    {failed ? <p role="alert" className="text-xs text-destructive">Some timetable information could not load. Try refreshing.</p>
      : loading ? <p role="status" className="py-2 text-xs text-muted-foreground">Loading your teaching day…</p>
        : title ? <>
          <div data-personal-lesson-row className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1.5 text-xs">
            <span data-lesson-label className="min-w-0 truncate font-bold" title={activity?.title || `${lesson?.subjectName} · ${lesson?.className}`}>{title}</span>
            <span data-lesson-time className="whitespace-nowrap tabular-nums text-gray-500 dark:text-slate-400">{timeLabel}</span>
            <span data-lesson-countdown className="whitespace-nowrap tabular-nums text-gray-500 dark:text-slate-400">{activity?.allDay ? '' : upcoming ? `In ${minutesLeft} min` : `${minutesLeft} min left`}</span>
          </div>
          {!activity?.allDay && <div role="progressbar" aria-label="Current activity progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} className="my-1.5 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800"><div className={`h-full rounded-full ${activity ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${progress}%` }} /></div>}
          {activity && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Affected class lessons are paused{activity.allDay ? ' today' : ` until ${end === '24:00' ? 'the end of today' : end}`}.</p>}
          {day.overriding.slice(1).map(item => <p key={item.id} className="mt-1 text-xs text-muted-foreground">Also: {item.title}</p>)}
          {day.conflicts && <p role="alert" className="mt-1 text-xs text-amber-700 dark:text-amber-300">Overlapping lessons: {day.current.slice(1).map(item => `${item.className} ${item.subjectCode}`).join(', ')}. Check your timetable.</p>}
        </> : <p className="py-1 text-xs text-muted-foreground">{!relevantClassIds.length ? 'No class or subject assignments yet.' : !inTerm ? 'No regular lessons scheduled today.' : lessons.length ? 'No more lessons assigned today.' : 'No lessons assigned today.'}</p>}
    {!!remaining.length && !loading && !failed && <>
      <div className="mt-1 flex min-w-0 items-center justify-between gap-1 border-t border-indigo-50 dark:border-indigo-800/60">
        <p className="min-w-0 truncate text-xs">{expanded ? `Remaining today (${remaining.length})` : <><span className="text-muted-foreground">Next </span><strong>{next.startTime}</strong> · {next.subjectCode} · {next.className}</>}</p>
        <button type="button" aria-expanded={expanded} aria-controls={lessonListId} onClick={() => setExpanded(value => !value)} className="inline-flex min-h-11 shrink-0 items-center gap-0.5 px-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300">{expanded ? 'Show less' : 'Show all'}{expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</button>
      </div>
      {expanded && <ul id={lessonListId} className="divide-y divide-indigo-50 text-xs dark:divide-indigo-800/60">{remaining.map(item => <li key={item.id} className="flex min-w-0 items-center justify-between gap-2 py-2"><span className="min-w-0 truncate font-medium" title={`${item.subjectName} · ${item.className}`}>{item.subjectCode} · {item.className}</span><span className="shrink-0 tabular-nums text-muted-foreground">{item.startTime}–{item.endTime}</span></li>)}</ul>}
    </>}
    {(events.isError || exams.isError) && <p role="alert" className="mt-1 text-xs text-destructive">Event updates unavailable. Normal lessons may be affected.</p>}
  </section>;
}
