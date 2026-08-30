import assert from 'node:assert/strict';
import test from 'node:test';
import {
  selectSubjectById,
  selectSubjectsByAssignments,
} from '../src/lib/selectors/subject-selectors';
import type { Subject } from '../src/types';

const subjects: Subject[] = [
  { id: 'math', name: 'Mathematics', code: 'MATH', type: 'Core', createdAt: '2026-01-01' },
  { id: 'eng', name: 'English', code: 'ENG', type: 'Core', createdAt: '2026-01-01' },
];

test('subject details are selected from the shared collection without another read', () => {
  assert.equal(selectSubjectById(subjects, 'eng')?.name, 'English');
  assert.equal(selectSubjectById(subjects, 'missing'), undefined);
  assert.equal(selectSubjectById(subjects, ''), undefined);
});

test('class subject selection preserves assignment order and removes missing subjects', () => {
  const selected = selectSubjectsByAssignments(subjects, [
    { subjectId: 'eng', teacherIds: ['teacher-2', 'teacher-3'] },
    { subjectId: 'missing', teacherIds: ['teacher-4'] },
    { subjectId: 'math', teacherIds: [], teacherId: 'legacy-teacher' },
  ]);

  assert.deepEqual(selected.map(subject => subject.id), ['eng', 'math']);
  assert.deepEqual(selected[0].teacherIds, ['teacher-2', 'teacher-3']);
  assert.equal(selected[0].teacherId, 'teacher-2');
  assert.deepEqual(selected[1].teacherIds, ['legacy-teacher']);
  assert.equal(selected[1].teacherName, null);
});
