import { addDays, format, isValid, parseISO } from 'date-fns';
import type { AcademicYear, Class, Event, EventFilters, SystemUser, UpdateEventData } from '@/types';
import { getComputedEventStatus } from './event-status-utils';
import { getSubjectTeacherIds } from './teaching-assignments';

export function calendarTone(event: Pick<Event, 'type' | 'isExamEvent'>): string {
  return event.isExamEvent ? 'exam' : ({ Academic: 'academic', 'Co-curricular': 'activity', Administrative: 'meeting', Holiday: 'holiday' }[event.type] || 'academic');
}

/** Keep deliberate custom colours, softened against the active theme. */
export function calendarCustomColours(event: Pick<Event, 'colorCode'>) {
  const colour = event.colorCode?.toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(colour || '') || ['#3b82f6', '#10b981', '#f59e0b', '#dc2626', '#ef4444'].includes(colour)) return {};
  return {
    backgroundColor: `color-mix(in srgb, ${colour} 12%, hsl(var(--card)))`,
    borderColor: `color-mix(in srgb, ${colour} 35%, hsl(var(--card)))`,
    textColor: `color-mix(in srgb, ${colour} 35%, hsl(var(--foreground)))`,
  };
}

export function calendarDateLabel(value: string, pattern = 'EEE, d MMM yyyy'): string {
  const date = parseISO(value);
  return isValid(date) ? format(date, pattern) : 'Date not set';
}

export function eventTimeLabel(event: Partial<Event>): string {
  if (event.isAllDay) return 'All day';
  const time = (value?: string) => {
    const date = parseISO(`2000-01-01T${value || ''}`);
    return isValid(date) ? format(date, 'h:mm a') : '';
  };
  return [time(event.startTime), time(event.endTime)].filter(Boolean).join(' – ') || 'Time not set';
}

export function eventOccursOn(event: Partial<Event>, date: string): boolean {
  return !!event.startDate && event.startDate <= date && (event.endDate || event.startDate) >= date;
}

export function isGeneratedCalendarEvent(event: Event): boolean {
  return !!event.customFields?.isUgandaPublicHoliday || (event.isExamEvent && event.id.startsWith('exam-'));
}

export function examSourceIds(event: Event): string[] {
  return [...new Set([
    ...(event.examIntegration?.examIds || []),
    event.linkedExamId,
    event.customFields?.originalExamId,
    ...(event.isExamEvent && event.id.startsWith('exam-') ? [event.id.slice(5)] : []),
  ].filter((id): id is string => typeof id === 'string' && id.length > 0))];
}

export function mergeCalendarEvents(...sources: Event[][]): Event[] {
  const events = new Map<string, Event>();
  const representedExams = new Set(sources[0]?.flatMap(examSourceIds));
  sources.forEach((source, index) => source.forEach(event => {
    if (index > 0 && event.id.startsWith('exam-') && examSourceIds(event).some(id => representedExams.has(id))) return;
    if (!events.has(event.id)) events.set(event.id, event);
  }));
  return [...events.values()];
}

/** All predicates are cumulative, including holidays and exam projections. */
export function filterCalendarEvents(events: Event[], filters: EventFilters, years: AcademicYear[] = []): Event[] {
  return events.filter(event => {
    if (filters.types?.length && !filters.types.includes(event.type)) return false;
    if (filters.statuses?.length && !filters.statuses.includes(getComputedEventStatus(event))) return false;
    if (filters.priorities?.length && !filters.priorities.includes(event.priority)) return false;
    if (filters.classIds?.length && !event.classIds?.some(id => filters.classIds!.includes(id))) return false;
    if (filters.subjectIds?.length && !event.subjectIds?.some(id => filters.subjectIds!.includes(id))) return false;
    if (filters.createdBy?.length && !filters.createdBy.includes(event.createdBy)) return false;
    if (filters.targetAudience?.length && !event.targetAudience?.some(value => filters.targetAudience!.includes(value))) return false;
    if (filters.isExamEvent !== undefined && event.isExamEvent !== filters.isExamEvent) return false;
    if (filters.requiresApproval !== undefined && event.requiresApproval !== filters.requiresApproval) return false;
    if (filters.approvalStatus?.length && !filters.approvalStatus.includes(event.approvalStatus || 'Pending')) return false;
    if (filters.tags?.length && !event.tags?.some(value => filters.tags!.includes(value))) return false;
    const overlaps = (start: string, end: string) => event.startDate <= end && (event.endDate || event.startDate) >= start;
    const globalHoliday = !!event.customFields?.isUgandaPublicHoliday;
    if (filters.academicYearIds?.length) {
      const inYear = globalHoliday
        ? years.some(year => filters.academicYearIds!.includes(year.id) && overlaps(String(year.startDate).slice(0, 10), String(year.endDate).slice(0, 10)))
        : !!event.academicYearId && filters.academicYearIds.includes(event.academicYearId);
      if (!inYear) return false;
    }
    if (filters.termIds?.length) {
      const inTerm = globalHoliday
        ? years.some(year => (!filters.academicYearIds?.length || filters.academicYearIds.includes(year.id)) && year.terms.some(term => filters.termIds!.includes(term.id) && overlaps(term.startDate.slice(0, 10), term.endDate.slice(0, 10))))
        : !!event.termId && filters.termIds.includes(event.termId);
      if (!inTerm) return false;
    }
    if (filters.dateRange && !overlaps(filters.dateRange.startDate || '0000-01-01', filters.dateRange.endDate || '9999-12-31')) return false;
    if (filters.searchTerm?.trim()) {
      const haystack = [event.title, event.description, event.location, event.createdByName, event.customFields?.organiserName,
        ...(event.classNames || []), ...(event.subjectNames || []), ...(event.targetAudience || []), ...(event.tags || [])].join(' ').toLowerCase();
      if (!haystack.includes(filters.searchTerm.trim().toLowerCase())) return false;
    }
    return true;
  });
}

export function activeCalendarFilterCount(filters: EventFilters): number {
  return Object.values(filters).filter(value => Array.isArray(value) ? value.length > 0 : typeof value === 'object' ? !!value && Object.values(value).some(Boolean) : value !== undefined && (typeof value !== 'string' || value.trim() !== '')).length;
}

export function isPersonalCalendarEvent(event: Event, user: Pick<SystemUser, 'id' | 'staffId'>, classes: Class[]): boolean {
  const identities = [user.id, user.staffId].filter((id): id is string => !!id);
  if (event.customFields?.isUgandaPublicHoliday || identities.includes(event.createdBy)) return true;
  if (event.expectedAttendees?.some(id => identities.includes(id))) return true;
  const assignedStaff = [event.customFields?.organiserId, ...(event.customFields?.staffIds || [])];
  if (assignedStaff.some(id => identities.includes(id))) return true;
  if (event.targetAudience?.some(value => ['staff', 'teachers', 'all staff', 'all teachers', 'whole school', 'everyone'].includes(value.toLowerCase()))) return true;
  return classes.some(item => event.classIds?.includes(item.id) && (
    identities.includes(item.classTeacherId || '') || identities.includes(item.coClassTeacherId || '') ||
    item.subjectAssignments?.some(assignment => getSubjectTeacherIds(assignment).some(id => identities.includes(id)))
  ));
}

export function fullCalendarDates(event: Event) {
  const parsedEnd = parseISO(event.endDate || event.startDate);
  const endDate = isValid(parsedEnd) && event.endDate >= event.startDate ? event.endDate : event.startDate;
  return {
    start: event.isAllDay ? event.startDate : `${event.startDate}T${event.startTime || '00:00'}`,
    // School records store inclusive end dates; FullCalendar uses an exclusive end.
    end: event.isAllDay ? format(addDays(parseISO(endDate), 1), 'yyyy-MM-dd') : `${endDate}T${event.endTime || '23:59'}`,
    allDay: event.isAllDay,
  };
}

export function calendarMovePatch(start: Date, end: Date | null, allDay: boolean): UpdateEventData {
  return {
    startDate: format(start, 'yyyy-MM-dd'),
    endDate: format(allDay && end ? addDays(end, -1) : end || start, 'yyyy-MM-dd'),
    isAllDay: allDay,
    ...(!allDay ? { startTime: format(start, 'HH:mm'), endTime: end ? format(end, 'HH:mm') : '' } : {}),
  };
}

export type CalendarConflict = { eventId: string; title: string; reasons: string[] };
export function findCalendarConflicts(candidate: Partial<Event>, events: Event[]): CalendarConflict[] {
  if (!candidate.startDate || ['Cancelled', 'Draft'].includes(candidate.status || '') || candidate.type === 'Holiday') return [];
  const interval = (event: Partial<Event>) => {
    const start = parseISO(`${event.startDate}T${event.isAllDay ? '00:00' : event.startTime || '00:00'}`).getTime();
    const end = event.isAllDay ? addDays(parseISO(event.endDate || event.startDate || ''), 1).getTime()
      : parseISO(`${event.endDate || event.startDate}T${event.endTime || '23:59'}`).getTime();
    return [start, end];
  };
  const [start, end] = interval(candidate);
  const attendees = [...(candidate.expectedAttendees || []), ...(candidate.customFields?.staffIds || []), candidate.customFields?.organiserId].filter(Boolean);
  return events.flatMap(event => {
    if (event.id === candidate.id || ['Cancelled', 'Draft'].includes(event.status) || event.type === 'Holiday') return [];
    const [otherStart, otherEnd] = interval(event);
    if (!(start < otherEnd && otherStart < end)) return [];
    const reasons: string[] = [];
    if (candidate.location?.trim() && candidate.location.trim().toLowerCase() === event.location?.trim().toLowerCase()) reasons.push(`Same venue: ${candidate.location}`);
    if (candidate.isExamEvent && event.isExamEvent && candidate.classIds?.some(id => event.classIds?.includes(id))) reasons.push('Overlapping examinations for the same class');
    const otherAttendees = [...(event.expectedAttendees || []), ...(event.customFields?.staffIds || []), event.customFields?.organiserId];
    if (attendees.some(id => otherAttendees.includes(id))) reasons.push('Shared organiser or participants');
    return reasons.length ? [{ eventId: event.id, title: event.title, reasons }] : [];
  });
}

export function isPublicHolidayDate(date: string, events: Event[]): boolean {
  return events.some(event => event.customFields?.isUgandaPublicHoliday && eventOccursOn(event, date));
}

/** Date overlaps include untagged activities and holidays between school terms. */
export function calendarYearSections(year: AcademicYear, events: Event[]) {
  const overlaps = (event: Event, start: string, end: string) => {
    const eventEnd = event.endDate && event.endDate >= event.startDate ? event.endDate : event.startDate;
    return event.startDate <= end.slice(0, 10) && eventEnd >= start.slice(0, 10);
  };
  const inYear = events.filter(event => overlaps(event, year.startDate, year.endDate))
    .sort((a, b) => `${a.startDate}${a.startTime || ''}`.localeCompare(`${b.startDate}${b.startTime || ''}`));
  const terms = [...year.terms].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const sections = terms.map(term => ({ id: term.id, name: term.name, startDate: term.startDate, endDate: term.endDate,
    events: inYear.filter(event => overlaps(event, term.startDate, term.endDate)) }));
  const outside = inYear.filter(event => !terms.some(term => overlaps(event, term.startDate, term.endDate)));
  if (outside.length) sections.push({ id: '__outside-terms', name: 'Outside term dates', startDate: year.startDate, endDate: year.endDate, events: outside });
  return sections;
}
