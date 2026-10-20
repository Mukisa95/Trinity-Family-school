import assert from 'node:assert/strict';
import test from 'node:test';
import type { AcademicYear, Class, Event } from '../src/types';
import { calendarYearSections, isPublicHolidayDate, activeCalendarFilterCount, calendarMovePatch, eventOccursOn, filterCalendarEvents, findCalendarConflicts, fullCalendarDates, isGeneratedCalendarEvent, isPersonalCalendarEvent, mergeCalendarEvents } from '../src/lib/utils/calendar-planning';

const base: Event = {
  id: 'meeting', title: 'School planning', description: 'Assessment preparation', type: 'Administrative', priority: 'Medium', status: 'Scheduled',
  startDate: '2026-10-14', endDate: '2026-10-14', startTime: '09:00', endTime: '10:00', isAllDay: false,
  location: 'Main Hall', targetAudience: ['Staff'], academicYearId: '2026', termId: 'term-3', classIds: ['p5'], classNames: ['Primary Five'], createdByName: 'Grace Organiser',
  recurrence: { frequency: 'None' }, isRecurringInstance: false, isExamEvent: false, reminders: [], notificationsSent: [], sendReminders: false,
  colorCode: '#123456', requiresApproval: false, requiresAttendance: false, isPublic: true, createdBy: 'admin', createdAt: '2026-10-01',
};
const year = { id: '2026', name: '2026', startDate: '2026-01-01', endDate: '2026-12-31', terms: [{ id: 'term-3', name: 'Term 3', startDate: '2026-09-01', endDate: '2026-12-01' }] } as AcademicYear;

test('search, type, class, term and dates all apply together rather than returning early', () => {
  const other = { ...base, id: 'other', classIds: ['p4'] };
  const filters = { searchTerm: 'planning', types: ['Administrative'] as Event['type'][], classIds: ['p5'], termIds: ['term-3'], dateRange: { startDate: '2026-10-10', endDate: '2026-10-20' } };
  assert.deepEqual(filterCalendarEvents([base, other], filters).map(event => event.id), ['meeting']);
  assert.deepEqual(filterCalendarEvents([base], { ...filters, termIds: ['term-2'] }), []);
  assert.deepEqual(filterCalendarEvents([base], { ...filters, types: ['Academic'] }), []);
});

test('search includes class labels and organisers without clearing other filters', () => {
  assert.equal(filterCalendarEvents([base], { searchTerm: 'primary five', classIds: ['p5'] }).length, 1);
  assert.equal(filterCalendarEvents([base], { searchTerm: 'grace organiser', classIds: ['p4'] }).length, 0);
  assert.equal(filterCalendarEvents([base], { searchTerm: 'grace organiser' }).length, 1);
});

test('national holidays respect selected type, class, year, term and search', () => {
  const holiday = { ...base, id: 'holiday', type: 'Holiday' as const, academicYearId: '', termId: '', classIds: [], customFields: { isUgandaPublicHoliday: true } };
  assert.equal(filterCalendarEvents([holiday], { academicYearIds: ['2026'], termIds: ['term-3'] }, [year]).length, 1);
  assert.equal(filterCalendarEvents([holiday], { types: ['Academic'] }, [year]).length, 0);
  assert.equal(filterCalendarEvents([holiday], { classIds: ['p5'] }, [year]).length, 0);
  assert.equal(filterCalendarEvents([holiday], { academicYearIds: ['2025'] }, [year]).length, 0);
  assert.equal(filterCalendarEvents([holiday], { termIds: ['term-1'] }, [year]).length, 0);
});

test('date filters include events spanning the selected period', () => {
  const event = { ...base, startDate: '2026-10-01', endDate: '2026-10-30' };
  assert.equal(filterCalendarEvents([event], { dateRange: { startDate: '2026-10-10', endDate: '2026-10-11' } }).length, 1);
  assert.equal(eventOccursOn(event, '2026-10-30'), true);
  assert.equal(eventOccursOn(event, '2026-10-31'), false);
});

test('multi-day events convert inclusive school dates to FullCalendar exclusive ends', () => {
  assert.deepEqual(fullCalendarDates({ ...base, isAllDay: true, startDate: '2026-10-12', endDate: '2026-10-14' }), { start: '2026-10-12', end: '2026-10-15', allDay: true });
  assert.equal(fullCalendarDates({ ...base, isAllDay: true, startDate: '2026-12-31', endDate: '2026-12-31' }).end, '2027-01-01');
});

test('drag and resize patches restore inclusive dates and retain timed selections', () => {
  assert.deepEqual(calendarMovePatch(new Date(2026, 9, 15), new Date(2026, 9, 18), true), { startDate: '2026-10-15', endDate: '2026-10-17', isAllDay: true });
  assert.deepEqual(calendarMovePatch(new Date(2026, 9, 15, 9), new Date(2026, 9, 15, 10), false), { startDate: '2026-10-15', endDate: '2026-10-15', startTime: '09:00', endTime: '10:00', isAllDay: false });
});

test('canonical events supersede their legacy exam projection', () => {
  const canonical = { ...base, id: 'canonical', isExamEvent: true, examIntegration: { examIds: ['exam1'] } } as Event;
  const projection = { ...base, id: 'exam-exam1', isExamEvent: true };
  assert.deepEqual(mergeCalendarEvents([canonical], [projection], [base, base]).map(event => event.id), ['canonical', 'meeting']);
  assert.equal(isGeneratedCalendarEvent(projection), true);
  assert.equal(isGeneratedCalendarEvent(canonical), false);
});

test('personal calendar includes teaching assignments and direct invitations but not unrelated class events', () => {
  const schoolClass = { id: 'p5', classTeacherId: 'teacher-staff', subjectAssignments: [] } as unknown as Class;
  const scoped = { ...base, createdBy: 'someone-else', targetAudience: ['P5'] };
  assert.equal(isPersonalCalendarEvent(scoped, { id: 'teacher-user', staffId: 'teacher-staff' }, [schoolClass]), true);
  assert.equal(isPersonalCalendarEvent({ ...scoped, classIds: ['p4'] }, { id: 'teacher-user', staffId: 'teacher-staff' }, [schoolClass]), false);
  assert.equal(isPersonalCalendarEvent({ ...scoped, classIds: [], expectedAttendees: ['teacher-user'] }, { id: 'teacher-user' }, []), true);
  assert.equal(isPersonalCalendarEvent(base, { id: 'teacher-user' }, []), true);
});

test('conflicts require an overlapping time and a shared school resource', () => {
  const candidate = { ...base, id: 'new', startTime: '09:30', endTime: '10:30' };
  assert.deepEqual(findCalendarConflicts(candidate, [base])[0]?.reasons, ['Same venue: Main Hall']);
  assert.equal(findCalendarConflicts({ ...candidate, startTime: '10:00' }, [base]).length, 0);
  assert.equal(findCalendarConflicts({ ...candidate, location: 'Library' }, [base]).length, 0);
  assert.equal(findCalendarConflicts(candidate, [{ ...base, status: 'Cancelled' }]).length, 0);
  assert.equal(findCalendarConflicts(base, [base]).length, 0);
});

test('class exam and participant conflicts are detected even in different rooms', () => {
  const exam = { ...base, isExamEvent: true, expectedAttendees: ['teacher-1'] };
  const conflicts = findCalendarConflicts({ ...exam, id: 'new-exam', location: 'Library' }, [exam]);
  assert.deepEqual(conflicts[0].reasons, ['Overlapping examinations for the same class', 'Shared organiser or participants']);
});

test('empty selections do not inflate the active filter count', () => {
  assert.equal(activeCalendarFilterCount({ types: [], searchTerm: '', isExamEvent: undefined }), 0);
  assert.equal(activeCalendarFilterCount({ classIds: ['p5'], types: ['Academic'], isExamEvent: false, dateRange: { startDate: '', endDate: '' } }), 3);
});


test('a malformed or reversed end date cannot break the whole month grid', () => {
  assert.equal(fullCalendarDates({ ...base, isAllDay: true, endDate: 'invalid' }).end, '2026-10-15');
  assert.equal(fullCalendarDates({ ...base, isAllDay: true, endDate: '2026-10-01' }).end, '2026-10-15');
});


test('year planning groups all dates by term and retains school-break activities', () => {
  const academicYear = { ...year, terms: [
    { id: 't2', name: 'Term 2', startDate: '2026-05-01', endDate: '2026-08-01' },
    { id: 't1', name: 'Term 1', startDate: '2026-01-15', endDate: '2026-04-01' },
    ...year.terms,
  ] };
  const events = [
    { ...base, id: 't1-event', startDate: '2026-02-10', endDate: '2026-02-10', academicYearId: '', termId: '' },
    { ...base, id: 't2-event', startDate: '2026-06-10', endDate: '2026-06-10' },
    { ...base, id: 'break', startDate: '2026-12-25', endDate: '2026-12-25', type: 'Holiday' as const },
    { ...base, id: 'old', startDate: '2025-02-01', endDate: '2025-02-01' },
    base,
  ];
  const sections = calendarYearSections(academicYear, events);
  assert.deepEqual(sections.map(section => [section.id, section.events.map(event => event.id)]), [
    ['t1', ['t1-event']], ['t2', ['t2-event']], ['term-3', ['meeting']], ['__outside-terms', ['break']],
  ]);
  assert.equal(academicYear.terms[0].id, 't2', 'Grouping never reorders saved configuration');
});

test('year planning retains multi-day activities crossing a term boundary', () => {
  const academicYear = { ...year, terms: [
    { id: 'a', name: 'A', startDate: '2026-01-01', endDate: '2026-06-30' },
    { id: 'b', name: 'B', startDate: '2026-07-01', endDate: '2026-12-31' },
  ] };
  const crossing = { ...base, startDate: '2026-06-30', endDate: '2026-07-02' };
  assert.deepEqual(calendarYearSections(academicYear, [crossing]).map(section => section.events.length), [1, 1]);
  const reversed = { ...base, startDate: '2026-07-02', endDate: '2026-01-01' };
  assert.deepEqual(calendarYearSections(academicYear, [reversed]).map(section => section.events.length), [0, 1]);
});

test('public holiday date highlighting uses the original holiday source', () => {
  const holiday = { ...base, type: 'Holiday' as const, startDate: '2026-10-09', endDate: '2026-10-10', customFields: { isUgandaPublicHoliday: true } };
  assert.equal(isPublicHolidayDate('2026-10-09', [holiday]), true);
  assert.equal(isPublicHolidayDate('2026-10-10', [holiday]), true);
  assert.equal(isPublicHolidayDate('2026-10-11', [holiday]), false);
  assert.equal(isPublicHolidayDate('2026-10-09', [{ ...holiday, customFields: {} }]), false);
});
