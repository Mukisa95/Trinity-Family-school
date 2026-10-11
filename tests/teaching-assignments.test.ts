import assert from 'node:assert/strict';
import test from 'node:test';
import type { Class } from '../src/types';
import { applyStaffClassAssignmentChanges, getExamTeacherIds, getSubjectTeacherId, getSubjectTeacherIds, getSubjectTeachingRole } from '../src/lib/utils/teaching-assignments';

const staff = { id: 'new', firstName: 'Grace', lastName: 'Teacher' };
const classItem: Class = {
  id: 'p4', name: 'Primary 4', code: 'P4', level: 'Upper Primary', order: 4,
  classTeacherId: 'old', classTeacherName: 'Original Teacher', createdAt: '2026-01-01',
  streams: [{ id: 'a', name: 'A', code: 'A', createdAt: '2026-01-01' }],
  subjectAssignments: [{ subjectId: 'english', teacherIds: ['lead', 'assistant', 'second'] }, { subjectId: 'math', teacherIds: ['math-lead'] }],
};

test('exams select the primary teacher while timetable gets every teacher in order', () => {
  const assignment = { teacherIds: ['lead', 'assistant', 'lead', 'second'] };
  assert.equal(getSubjectTeacherId(assignment), 'lead');
  assert.deepEqual(getSubjectTeacherIds(assignment), ['lead', 'assistant', 'second']);
  assert.equal(getSubjectTeachingRole(assignment, 'lead'), 'subjectTeacher');
  assert.equal(getSubjectTeachingRole(assignment, 'assistant'), 'assistant');
  assert.equal(getSubjectTeachingRole(assignment, 'unrelated'), 'none');
});

test('legacy subject teachers remain available without a migration', () => {
  assert.deepEqual(getSubjectTeacherIds({ teacherId: 'legacy' }), ['legacy']);
  assert.deepEqual(getSubjectTeacherIds({ teacherIds: [], teacherId: 'legacy' }), ['legacy']);
  assert.equal(getSubjectTeacherId({ teacherIds: [] }), null);
});

test('exam teacher choices exclude assistants and retain a historical snapshot teacher', () => {
  assert.deepEqual(getExamTeacherIds(classItem.subjectAssignments), ['lead', 'math-lead']);
  assert.deepEqual(getExamTeacherIds(classItem.subjectAssignments, 'previous-teacher'), ['lead', 'math-lead', 'previous-teacher']);
  assert.deepEqual(getExamTeacherIds([{ teacherId: 'legacy' }], 'legacy'), ['legacy']);
});

test('staff assignment replaces the class teacher and retains subjects, other teachers and streams', () => {
  const patch = applyStaffClassAssignmentChanges(classItem, staff, {
    classTeacher: { assigned: true, expectedTeacherId: 'old' },
    subjects: [{ subjectId: 'english', role: 'subjectTeacher', expectedTeacherIds: ['lead', 'assistant', 'second'] }],
  });
  const next = { ...classItem, ...patch };
  assert.equal(next.classTeacherId, 'new');
  assert.equal(next.classTeacherName, 'Grace Teacher');
  assert.deepEqual(next.subjectAssignments[0].teacherIds, ['new', 'lead', 'assistant', 'second']);
  assert.deepEqual(next.subjectAssignments[1], classItem.subjectAssignments[1]);
  assert.deepEqual(next.streams, classItem.streams);
  assert.deepEqual(classItem.subjectAssignments[0].teacherIds, ['lead', 'assistant', 'second']);
});

test('adding an assistant preserves the lead and existing assistant order', () => {
  const patch = applyStaffClassAssignmentChanges(classItem, staff, { subjects: [{ subjectId: 'english', role: 'assistant', expectedTeacherIds: ['lead', 'assistant', 'second'] }] });
  assert.deepEqual(patch.subjectAssignments?.[0].teacherIds, ['lead', 'assistant', 'second', 'new']);
});

test('removing a primary teacher promotes the next assistant and clears legacy IDs', () => {
  const original = { ...classItem, subjectAssignments: [{ subjectId: 'english', teacherIds: ['new', 'assistant'], teacherId: 'new' }] };
  const patch = applyStaffClassAssignmentChanges(original, staff, { subjects: [{ subjectId: 'english', role: 'none', expectedTeacherIds: ['new', 'assistant'] }] });
  assert.equal(getSubjectTeacherId(patch.subjectAssignments?.[0]), 'assistant');
  assert.equal(patch.subjectAssignments?.[0].teacherId, undefined);
  const final = applyStaffClassAssignmentChanges({ ...original, subjectAssignments: [{ subjectId: 'english', teacherIds: [], teacherId: 'new' }] }, staff, { subjects: [{ subjectId: 'english', role: 'none', expectedTeacherIds: ['new'] }] });
  assert.equal(getSubjectTeacherId(final.subjectAssignments?.[0]), null);
});

test('new subjects can be assigned but assistants require a primary teacher', () => {
  const patch = applyStaffClassAssignmentChanges(classItem, staff, { subjects: [{ subjectId: 'science', role: 'subjectTeacher', expectedTeacherIds: [] }] });
  assert.deepEqual(patch.subjectAssignments?.at(-1), { subjectId: 'science', teacherIds: ['new'] });
  assert.throws(() => applyStaffClassAssignmentChanges(classItem, staff, { subjects: [{ subjectId: 'science', role: 'assistant', expectedTeacherIds: [] }] }), /subject teacher before/);
});

test('concurrent class and subject edits are rejected rather than overwritten', () => {
  assert.throws(() => applyStaffClassAssignmentChanges(classItem, staff, { classTeacher: { assigned: true, expectedTeacherId: 'different' }, subjects: [] }), /class teacher changed/);
  assert.throws(() => applyStaffClassAssignmentChanges(classItem, staff, { subjects: [{ subjectId: 'english', role: 'subjectTeacher', expectedTeacherIds: ['old-order'] }] }), /Subject teachers changed/);
});

test('unassigning the class teacher does not remove another staff member', () => {
  const patch = applyStaffClassAssignmentChanges(classItem, staff, { classTeacher: { assigned: false, expectedTeacherId: 'old' }, subjects: [] });
  assert.deepEqual(patch, {});
  const remove = applyStaffClassAssignmentChanges({ ...classItem, classTeacherId: 'new' }, staff, { classTeacher: { assigned: false, expectedTeacherId: 'new' }, subjects: [] });
  assert.equal(remove.classTeacherId, '');
  assert.equal(remove.classTeacherName, '');
});

test('promoting the co-class teacher avoids assigning the same staff member twice', () => {
  const patch = applyStaffClassAssignmentChanges({ ...classItem, coClassTeacherId: 'new' }, staff, { classTeacher: { assigned: true, expectedTeacherId: 'old' }, subjects: [] });
  assert.equal(patch.classTeacherId, 'new');
  assert.equal(patch.coClassTeacherId, '');
});
