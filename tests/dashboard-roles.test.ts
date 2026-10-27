import assert from 'node:assert/strict';
import test from 'node:test';
import { getStaffDashboardContext, isDirectorOfStudies, isEventRelevantToClasses } from '../src/lib/dashboard/staff-context';
import { buildTeacherLessons, getClassAttendance, getSchoolClock, getTeacherActivities, getTeacherDay, type TeacherLesson, type TeacherTimetable } from '../src/lib/dashboard/teacher-day';
import type { Class, Event, Exam, Staff, Subject, SystemUser } from '../src/types';

const teacher = { id: 'teacher', firstName: 'Sarah', lastName: 'Namuli', role: ['TEACHER'], department: ['Teaching'], status: 'active' } as Staff;
const user = { id: 'user', username: 'sarah', role: 'Staff', staffId: teacher.id, isActive: true } as SystemUser;
const classes = [
  { id: 'p4', code: 'P.4', name: 'Primary Four', classTeacherId: teacher.id, subjectAssignments: [{ subjectId: 'math', teacherIds: [teacher.id, 'assistant'] }] },
  { id: 'p5', code: 'P.5', name: 'Primary Five', classTeacherId: 'other', subjectAssignments: [{ subjectId: 'math', teacherId: teacher.id }] },
  { id: 'p6', code: 'P.6', name: 'Primary Six', classTeacherId: 'other', subjectAssignments: [] },
] as Class[];
const subjects = [{ id: 'math', name: 'Mathematics', code: 'MATH' }, { id: 'science', name: 'Science', code: 'SCI' }] as Subject[];
const lesson = { id: 'l4', classId: 'p4', className: 'P.4', subjectId: 'math', subjectName: 'Mathematics', subjectCode: 'MATH', startTime: '10:00', endTime: '10:40' } as TeacherLesson;
const event = { id: 'event', title: 'P.4 exam', classIds: ['p4'], subjectIds: ['science'], startDate: '2026-10-27', endDate: '2026-10-27', startTime: '10:00', endTime: '11:00', isAllDay: false, isExamEvent: true, type: 'Academic', status: 'Scheduled', requiresApproval: false } as Event;
const exam = { id: 'exam', name: 'Maths examination', classId: 'p4', subjectIds: ['math'], startDate: '2026-10-27', endDate: '2026-10-27', startTime: '10:00', endTime: '11:00', status: 'Scheduled' } as Exam;
const table = { profile: { id: 'table', classIds: ['p4'], academicYearId: 'year', termId: 'term', activeDays: [2] },
  periods: [{ id: 'a', dayOfWeek: 2, type: 'lesson', startTime: '10:00', endTime: '10:40' }, { id: 'break', dayOfWeek: 2, type: 'break', startTime: '10:40', endTime: '11:00' }, { id: 'b', dayOfWeek: 2, type: 'lesson', startTime: '11:00', endTime: '11:40' }],
  entries: [{ id: 'cell', classId: 'p4', periodId: 'a', subjectId: 'math', teacherId: teacher.id }] } as TeacherTimetable;

test('teachers get class-teacher classes first and assigned subjects across other classes', () => {
  const result = getStaffDashboardContext(user, [teacher], classes);
  assert.equal(result.schoolWide, false);
  assert.equal(result.isTeacher, true);
  assert.deepEqual(result.assignedClassIds, ['p4', 'p5']);
});
test('administrator precedence preserves the school view even for a linked teacher', () => {
  const result = getStaffDashboardContext({ ...user, role: 'Admin' }, [teacher], classes);
  assert.equal(result.isAdmin, true); assert.equal(result.schoolWide, true);
  assert.deepEqual(result.assignedClassIds, ['p4', 'p5']);
});
test('DOS uses the school view without becoming an administrator', () => {
  const result = getStaffDashboardContext(user, [{ ...teacher, role: ['TEACHER', 'DIRECTOR OF STUDIES'] }], classes);
  assert.equal(result.schoolWide, true); assert.equal(result.isDOS, true); assert.equal(result.isAdmin, false);
  assert.equal(isDirectorOfStudies({ role: ['d.o.s.'], status: 'active' }), true);
});
test('unlinked, inactive DOS and non-teaching staff never default to whole-school access', () => {
  assert.equal(getStaffDashboardContext({ ...user, staffId: undefined }, [teacher], classes).schoolWide, false);
  assert.equal(isDirectorOfStudies({ role: ['DIRECTOR OF STUDIES'], status: 'suspended' }), false);
  assert.equal(getStaffDashboardContext(user, [{ ...teacher, department: ['Administration'], role: ['SECRETARY'] }], []).isTeacher, false);
});
test('co-class teachers and assistant subject teachers are included without duplicate classes', () => {
  const coClasses = [{ ...classes[0], classTeacherId: 'other', coClassTeacherId: 'assistant' }];
  assert.deepEqual(getStaffDashboardContext({ ...user, staffId: 'assistant' }, [{ ...teacher, id: 'assistant' }], coClasses).assignedClassIds, ['p4']);
});
test('personal calendars retain school-wide notices and hide other classes; school calendars remain complete', () => {
  assert.equal(isEventRelevantToClasses({ classIds: ['p4'] }, ['p4']), true);
  assert.equal(isEventRelevantToClasses({ classIds: ['p6'] }, ['p4']), false);
  assert.equal(isEventRelevantToClasses({ classIds: [] }, ['p4']), true);
  assert.equal(isEventRelevantToClasses({ classIds: ['p6'] }), true);
  assert.equal(isEventRelevantToClasses({ classIds: ['p4'] }, []), false);
});
test('attendance uses the latest active pupil record and keeps unrecorded separate', () => {
  const pupils = ['one', 'two', 'three', 'four'].map(id => ({ id, classId: 'p4', status: 'Active' as const }));
  const data = getClassAttendance('p4', [...pupils, { id: 'inactive', classId: 'p4', status: 'Inactive' }], [
    { pupilId: 'one', classId: 'p4', status: 'Absent', recordedAt: '2026-10-27T07:00:00Z' },
    { pupilId: 'one', classId: 'p4', status: 'Present', recordedAt: '2026-10-27T08:00:00Z' },
    { pupilId: 'two', classId: 'p4', status: 'Late' },
    { pupilId: 'three', classId: 'p4', status: 'Absent' },
    { pupilId: 'inactive', classId: 'p4', status: 'Present' },
    { pupilId: 'unknown', classId: 'p4', status: 'Present' },
    { pupilId: 'four', classId: 'p5', status: 'Present' },
  ]);
  assert.equal(data.total, 4); assert.equal(data.recorded, 3); assert.equal(data.present, 2);
  assert.equal(data.segments.find(item => item.label === 'Not recorded')!.value, 1);
  assert.equal(data.segments.find(item => item.label === 'Absent')!.value, 1);
});
test('an entirely unrecorded class has no invented absences', () => {
  const result = getClassAttendance('p4', [{ id: 'one', classId: 'p4', status: 'Active' }], []);
  assert.equal(result.segments.find(item => item.label === 'Not recorded')!.value, 1);
  assert.equal(result.segments.find(item => item.label === 'Absent')!.value, 0);
});
test('school clock uses Kampala rather than the device timezone and rolls over at midnight', () => {
  assert.equal(getSchoolClock(new Date('2026-10-26T21:05:00Z')).date, '2026-10-27');
  assert.equal(getSchoolClock(new Date('2026-10-26T21:05:00Z')).day, 2);
  assert.equal(getSchoolClock(new Date('2026-10-26T21:05:00Z')).minutes, 5);
});
test('personal timetable includes direct and co-teachers, but never every class teacher lesson', () => {
  assert.equal(buildTeacherLessons([table], teacher.id, classes, subjects, 2).length, 1);
  assert.equal(buildTeacherLessons([table], teacher.id, classes, subjects, 2)[0].subjectCode, 'MATH');
  assert.equal(buildTeacherLessons([{ ...table, entries: [{ ...table.entries[0], teacherId: 'other' }] }], teacher.id, classes, subjects, 2).length, 0);
  assert.equal(buildTeacherLessons([{ ...table, entries: [{ ...table.entries[0], teacherId: 'other', coTeacherId: teacher.id }] }], teacher.id, classes, subjects, 2).length, 1);
});
test('empty timetable teacher IDs fall back to canonical and legacy subject assignments', () => {
  const blank = { ...table, entries: [{ ...table.entries[0], teacherId: '' }] };
  assert.equal(buildTeacherLessons([blank], teacher.id, classes, subjects, 2).length, 1);
  assert.equal(buildTeacherLessons([blank], 'assistant', classes, subjects, 2).length, 1);
});
test('optional subjects belong only to their assigned teacher and use their own subject label', () => {
  const split = { ...table, entries: [{ ...table.entries[0], optionalSubjectId: 'science', optionalTeacherId: 'science-teacher' }] };
  const lessons = buildTeacherLessons([split], 'science-teacher', classes, subjects, 2);
  assert.equal(lessons.length, 1); assert.equal(lessons[0].subjectName, 'Science');
});
test('marked periods stop at breaks and inactive weekdays have no lessons', () => {
  const marked = { ...table, entries: [{ ...table.entries[0], periodIds: ['a', 'b'], mergePeriods: true }] };
  const result = buildTeacherLessons([marked], teacher.id, classes, subjects, 2);
  assert.deepEqual(result.map(item => [item.startTime, item.endTime]), [['10:00', '10:40'], ['11:00', '11:40']]);
  assert.equal(buildTeacherLessons([marked], teacher.id, classes, subjects, 3).length, 0);
});
test('consolidated and streamed timetable cells are not mixed', () => {
  const streamClass = { ...classes[0], streams: [{ id: 'east', name: 'East', code: 'E', createdAt: '' }], streamConfigurations: [{ academicYearId: 'year', enabled: true, activeStreamIds: ['east'], version: 1, configuredAt: '' }] } as Class;
  const streamed = { ...table, profile: { ...table.profile, streamLayouts: { p4: { defaultMode: 'separate' as const } } }, entries: [table.entries[0], { ...table.entries[0], id: 'east-cell', streamId: 'east' }] };
  const result = buildTeacherLessons([streamed], teacher.id, [streamClass], subjects, 2);
  assert.equal(result.length, 1); assert.match(result[0].className, /East/);
});
test('an exam for the class overrides a different subject during the actual overlap', () => {
  const activities = getTeacherActivities([event], [], ['p4', 'p5'], '2026-10-27');
  assert.equal(getTeacherDay([lesson], activities, 626).overriding[0].title, 'P.4 exam');
  assert.equal(getTeacherDay([lesson], activities, 599).overriding.length, 0);
  assert.equal(getTeacherDay([lesson], activities, 660).overriding.length, 0);
});
test('a P.4 exam does not replace a simultaneous P.5 teaching responsibility', () => {
  const activities = getTeacherActivities([event], [], ['p4', 'p5'], '2026-10-27');
  const result = getTeacherDay([{ ...lesson, classId: 'p5', className: 'P.5' }], activities, 626);
  assert.equal(result.current.length, 1); assert.equal(result.overriding.length, 0);
});
test('linked exam events retain per-class stream scope instead of suspending other streams', () => {
  const scopedExam = { ...exam, streamScope: { mode: 'selected' as const, streamIds: ['east'], streams: [] } };
  const activities = getTeacherActivities([{ ...event, linkedExamId: exam.id }], [scopedExam], ['p4'], '2026-10-27');
  assert.equal(getTeacherDay([{ ...lesson, streamId: 'west' }], activities, 626).current.length, 1);
  assert.equal(getTeacherDay([{ ...lesson, streamId: 'east' }], activities, 626).overriding.length, 1);
});
test('draft, cancelled, completed and unapproved events do not interrupt teaching', () => {
  for (const status of ['Draft', 'Cancelled', 'Completed'] as const) assert.equal(getTeacherActivities([{ ...event, status }], [], ['p4'], '2026-10-27').length, 0);
  assert.equal(getTeacherActivities([{ ...event, requiresApproval: true, approvalStatus: 'Pending' }], [], ['p4'], '2026-10-27').length, 0);
  assert.equal(getTeacherActivities([event], [], ['p5'], '2026-10-27').length, 0);
});
test('school announcements do not suspend lessons; class activities do', () => {
  assert.equal(getTeacherActivities([{ ...event, isExamEvent: false, type: 'Administrative' }], [], ['p4'], '2026-10-27').length, 0);
  assert.equal(getTeacherActivities([{ ...event, isExamEvent: false, type: 'Co-curricular' }], [], ['p4'], '2026-10-27').length, 1);
});
test('linked events and cached exams are not displayed twice', () => {
  const result = getTeacherActivities([{ ...event, linkedExamId: exam.id }], [exam], ['p4'], '2026-10-27');
  assert.equal(result.length, 1);
});
test('cancelling the canonical exam event does not resurrect its cached exam definition', () => {
  assert.equal(getTeacherActivities([{ ...event, status: 'Cancelled', linkedExamId: exam.id }], [exam], ['p4'], '2026-10-27').length, 0);
});
test('recurring weekly activities honour days, intervals and the end of recurrence', () => {
  const recurring = { ...event, isExamEvent: false, startDate: '2026-10-20', endDate: '2026-10-20', recurrence: { frequency: 'Weekly' as const, daysOfWeek: [2], interval: 1, endDate: '2026-11-01' } };
  assert.equal(getTeacherActivities([recurring], [], ['p4'], '2026-10-27').length, 1);
  assert.equal(getTeacherActivities([recurring], [], ['p4'], '2026-10-28').length, 0);
  assert.equal(getTeacherActivities([recurring], [], ['p4'], '2026-11-03').length, 0);
  assert.equal(getTeacherActivities([{ ...recurring, recurrence: { ...recurring.recurrence, occurrences: 1 } }], [], ['p4'], '2026-10-27').length, 0);
});
test('multi-day exams honour time boundaries on first and last days and all-day dates', () => {
  const multi = { ...exam, startDate: '2026-10-26', endDate: '2026-10-28' };
  assert.equal(getTeacherActivities([], [multi], ['p4'], '2026-10-27')[0].startTime, '00:00');
  assert.equal(getTeacherActivities([], [multi], ['p4'], '2026-10-27')[0].endTime, '24:00');
  assert.equal(getTeacherActivities([], [multi], ['p4'], '2026-10-28')[0].endTime, '11:00');
});
test('lessons resume after an event ends, and overlapping teacher lessons are surfaced', () => {
  const activities = getTeacherActivities([{ ...event, endTime: '10:20' }], [], ['p4'], '2026-10-27');
  const result = getTeacherDay([lesson], activities, 626);
  assert.equal(result.current.length, 1); assert.equal(result.overriding.length, 0);
  assert.equal(getTeacherDay([lesson, { ...lesson, id: 'other', classId: 'p5' }], [], 626).conflicts, true);
});
