import assert from 'node:assert/strict';
import test from 'node:test';
import type { AcademicYear, Class, Event } from '../src/types';
import { activeCalendarFilterCount, calendarMovePatch, eventOccursOn, filterCalendarEvents, findCalendarConflicts, fullCalendarDates, isGeneratedCalendarEvent, isPersonalCalendarEvent, mergeCalendarEvents } from '../src/lib/utils/calendar-planning';

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
