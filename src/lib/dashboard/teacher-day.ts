import type { Class, Event, Exam, GeneratedPeriod, Pupil, Subject, TimetableEntry, TimetableProfile } from '@/types';
import type { AttendanceSummaryEntry } from '@/lib/cache/attendance-summary-cache';
import { STAFF_CLOCKING_TIME_ZONE } from '@/lib/staff-clocking/contracts';
import { getSubjectTeacherIds } from '@/lib/utils/teaching-assignments';
import { entryCoversTimetablePeriod, getTimetableStreamMode } from '@/lib/utils/timetable-streams';
import { getActiveClassStreams } from '@/lib/utils/class-streams';

export function getSchoolClock(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: STAFF_CLOCKING_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday) + 1,
    minutes: Number(parts.hour) * 60 + Number(parts.minute) + Number(parts.second) / 60 };
}

export function timeMinutes(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

export function getClassAttendance(classId: string, pupils: Pick<Pupil, 'id' | 'classId' | 'status'>[], records: AttendanceSummaryEntry[]) {
  const members = new Set(pupils.filter(pupil => pupil.classId === classId && pupil.status === 'Active').map(pupil => pupil.id));
  const latest = new Map<string, AttendanceSummaryEntry>();
  for (const record of records) {
    if (record.classId !== classId || !members.has(record.pupilId) || !record.status) continue;
    const previous = latest.get(record.pupilId);
    if (!previous || (Date.parse(record.recordedAt || '') || 0) >= (Date.parse(previous.recordedAt || '') || 0)) latest.set(record.pupilId, record);
  }
  const statuses = ['Present', 'Late', 'Absent', 'Excused', 'Delayed'] as const;
  const segments = statuses.map(label => ({ label, value: [...latest.values()].filter(record => record.status === label).length }));
  const recorded = segments.reduce((sum, segment) => sum + segment.value, 0);
  return { total: members.size, recorded, present: segments[0].value + segments[1].value,
    segments: [...segments, { label: 'Not recorded' as const, value: Math.max(0, members.size - recorded) }] };
}

export interface TeacherLesson {
  id: string;
  classId: string;
  streamId?: string;
  className: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  startTime: string;
  endTime: string;
}

export interface TeacherTimetable {
  profile: TimetableProfile;
  periods: GeneratedPeriod[];
  entries: TimetableEntry[];
}

export function buildTeacherLessons(tables: TeacherTimetable[], staffId: string, classes: Class[], subjects: Subject[], day: number): TeacherLesson[] {
  const result: TeacherLesson[] = [];
  for (const { profile, periods, entries } of tables) {
    if (!profile.activeDays.includes(day)) continue;
    const dayPeriods = periods.filter(period => period.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (const entry of entries) {
      const schoolClass = classes.find(item => item.id === entry.classId);
      if (!schoolClass || (profile.classIds.length && !profile.classIds.includes(entry.classId))) continue;
      for (const optional of [false, true]) {
        const subjectId = optional ? entry.optionalSubjectId : entry.subjectId;
        if (optional && !subjectId) continue;
        const explicitIds = (optional ? [entry.optionalTeacherId, entry.coOptionalTeacherId] : [entry.teacherId, entry.coTeacherId]).filter(Boolean);
        const assignment = schoolClass.subjectAssignments?.find(item => item.subjectId === subjectId);
        // A timetable teacher override wins. Only unassigned cells fall back to class subject assignments.
        if (!(explicitIds.length ? explicitIds.includes(staffId) : getSubjectTeacherIds(assignment).includes(staffId))) continue;
        let previous: TeacherLesson | undefined;
        for (const period of dayPeriods) {
          if (period.type !== 'lesson' || !entryCoversTimetablePeriod(entry, period.id, dayPeriods)) { previous = undefined; continue; }
          const separate = getTimetableStreamMode(profile, entry.classId, day, period.id) === 'separate';
          if (separate !== !!entry.streamId) { previous = undefined; continue; }
          if (entry.streamId && !getActiveClassStreams(schoolClass, profile.academicYearId).some(stream => stream.id === entry.streamId)) continue;
          const streamName = schoolClass.streams?.find(stream => stream.id === entry.streamId)?.name || entry.streamName;
          if (previous && previous.endTime === period.startTime) { previous.endTime = period.endTime; continue; }
          previous = { id: `${profile.id}:${entry.id}:${optional}:${period.id}`, classId: entry.classId, streamId: entry.streamId,
            className: `${schoolClass.code || schoolClass.name}${streamName ? ` · ${streamName}` : ''}`, subjectId: subjectId || '',
            subjectName: subjects.find(subject => subject.id === subjectId)?.name || entry.activityName || 'Subject unavailable',
            subjectCode: subjects.find(subject => subject.id === subjectId)?.code?.trim() || entry.activityName || '—', startTime: period.startTime, endTime: period.endTime };
          result.push(previous);
        }
      }
    }
  }
  return result.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.className.localeCompare(b.className));
}

export interface TeacherActivity {
  id: string;
  title: string;
  classIds: string[];
  streamIds?: string[];
  streamScopes?: Record<string, string[] | null>;
  startTime: string;
  endTime: string;
  allDay: boolean;
  isExam: boolean;
}

function eventDateRange(event: Event, date: string): [string, string] {
  const start = event.startDate?.slice(0, 10);
  const end = (event.endDate || event.startDate)?.slice(0, 10);
  const rule = event.recurrence;
  if (!start || event.isRecurringInstance || !rule || rule.frequency === 'None' || rule.frequency === 'Custom') return [start, end];
  const base = new Date(`${start}T00:00:00Z`);
  const today = new Date(`${date}T00:00:00Z`);
  const interval = Math.max(1, rule.interval || 1);
  const duration = Math.max(0, (Date.parse(`${end}T00:00:00Z`) - base.getTime()) / 86_400_000);
  const baseDay = (base.getUTCDay() + 6) % 7;
  let occurrence = 0;
  let matched: [string, string] = [start, end];
  for (let day = 0; day <= (today.getTime() - base.getTime()) / 86_400_000; day++) {
    const current = new Date(base.getTime() + day * 86_400_000);
    const localDate = current.toISOString().slice(0, 10);
    if (rule.endDate && localDate > rule.endDate.slice(0, 10)) break;
    const months = (current.getUTCFullYear() - base.getUTCFullYear()) * 12 + current.getUTCMonth() - base.getUTCMonth();
    const matches = rule.frequency === 'Daily' ? day % interval === 0
      : rule.frequency === 'Weekly' ? Math.floor((day + baseDay) / 7) % interval === 0 && (rule.daysOfWeek?.length ? rule.daysOfWeek : [base.getUTCDay()]).includes(current.getUTCDay())
        : months % interval === 0 && current.getUTCDate() === base.getUTCDate();
    if (!matches) continue;
    occurrence++;
    if (rule.occurrences && occurrence > rule.occurrences) break;
    const lastDate = new Date(current.getTime() + duration * 86_400_000).toISOString().slice(0, 10);
    if (localDate <= date && date <= lastDate) matched = [localDate, lastDate];
  }
  return matched;
}

// Canonical event documents and cached exam definitions share one deterministic projection.
// Exams are class-wide disruptions even when their papers concern a different subject.
export function getTeacherActivities(events: Event[], exams: Exam[], classIds: string[], date: string): TeacherActivity[] {
  const represented = new Set(events.filter(event => event.status !== 'Draft')
    .flatMap(event => [event.linkedExamId, ...(event.examIntegration?.examIds || [])]).filter(Boolean));
  const candidates = [
    ...events.map(event => {
      const [startDate, endDate] = eventDateRange(event, date);
      const linkedIds = new Set([event.linkedExamId, ...(event.examIntegration?.examIds || [])]);
      const streamScopes: Record<string, string[] | null> = {};
      for (const exam of exams.filter(item => linkedIds.has(item.id))) {
        if (exam.streamScope?.mode !== 'selected') streamScopes[exam.classId] = null;
        else if (streamScopes[exam.classId] !== null) streamScopes[exam.classId] = [...new Set([...(streamScopes[exam.classId] || []), ...exam.streamScope.streamIds])];
      }
      return { id: event.id, title: event.title, classIds: event.classIds?.length ? event.classIds : event.examIntegration?.classIds || [],
      startDate, endDate, startTime: event.startTime, endTime: event.endTime, allDay: event.isAllDay,
      isExam: event.isExamEvent, status: event.status, approved: !event.requiresApproval || event.approvalStatus === 'Approved',
      replacesLessons: event.isExamEvent || event.customFields?.replacesLessons === true || (['Academic', 'Co-curricular'].includes(event.type) && !!event.classIds?.length),
      streamScopes, streamIds: undefined as string[] | undefined };
    }),
    ...exams.filter(exam => !represented.has(exam.id)).map(exam => ({ id: `exam:${exam.id}`, title: exam.name, classIds: [exam.classId],
      startDate: exam.startDate, endDate: exam.endDate, startTime: exam.startTime, endTime: exam.endTime, allDay: !exam.startTime,
      isExam: true, status: exam.status, approved: true, replacesLessons: true, streamScopes: undefined,
      streamIds: exam.streamScope?.mode === 'selected' ? exam.streamScope.streamIds : undefined })),
  ];
  return candidates.filter(item => {
    if (!item.approved || !item.replacesLessons || ['Draft', 'Cancelled', 'Completed', 'Graded'].includes(item.status)) return false;
    if (!item.classIds.some(id => classIds.includes(id))) return false;
    return item.startDate?.slice(0, 10) <= date && date <= (item.endDate || item.startDate).slice(0, 10);
  }).map(item => ({ id: item.id, title: item.title, classIds: item.classIds, streamIds: item.streamIds, streamScopes: item.streamScopes,
    startTime: item.allDay || date > item.startDate.slice(0, 10) ? '00:00' : item.startTime || '00:00',
    endTime: item.allDay || date < (item.endDate || item.startDate).slice(0, 10) ? '24:00' : item.endTime || '24:00',
    allDay: item.allDay, isExam: item.isExam }));
}

export function getTeacherDay(lessons: TeacherLesson[], activities: TeacherActivity[], minutes: number) {
  const activeEvents = activities.filter(item => timeMinutes(item.startTime) <= minutes && minutes < timeMinutes(item.endTime));
  const eventAffects = (event: TeacherActivity, lesson: TeacherLesson) => {
    const streams = event.streamScopes?.[lesson.classId] ?? event.streamIds;
    return event.classIds.includes(lesson.classId) && (!streams || streams.length > 0 && (!lesson.streamId || streams.includes(lesson.streamId)));
  };
  const currentLessons = lessons.filter(lesson => timeMinutes(lesson.startTime) <= minutes && minutes < timeMinutes(lesson.endTime));
  const current = currentLessons.filter(lesson => !activeEvents.some(event => eventAffects(event, lesson)));
  const overriding = activeEvents.filter(event => !currentLessons.length || currentLessons.some(lesson => eventAffects(event, lesson)));
  const upcoming = lessons.filter(lesson => timeMinutes(lesson.startTime) > minutes && !activities.some(event => eventAffects(event, lesson)
    && timeMinutes(event.startTime) < timeMinutes(lesson.endTime) && timeMinutes(event.endTime) > timeMinutes(lesson.startTime)));
  return { current, overriding: current.length ? [] : overriding, upcoming, conflicts: current.length > 1 };
}
