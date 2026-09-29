import assert from 'node:assert/strict';
import test from 'node:test';
import type { Class, GeneratedPeriod, TimetableEntry, TimetableProfile } from '../src/types';
import {
  buildTimetableClassRowsForDay,
  findTimetableEntryForRow,
  getTimetableStreamMode,
} from '../src/lib/utils/timetable-streams';

const schoolClass = {
  id: 'p1', name: 'Primary 1', code: 'P1', level: 'Lower Primary', order: 1,
  classTeacherId: '', subjectAssignments: [], createdAt: '',
  streams: [
    { id: 'east', name: 'East', code: 'E', createdAt: '' },
    { id: 'west', name: 'West', code: 'W', createdAt: '' },
  ],
  streamConfigurations: [{ academicYearId: '2026', activeStreamIds: ['east', 'west'], enabled: true, version: 1, configuredAt: '' }],
} satisfies Class;

const periods = [
  { id: 'mon-1', dayOfWeek: 1, periodNumber: 1, startTime: '08:00', endTime: '09:00', type: 'lesson' },
  { id: 'tue-1', dayOfWeek: 2, periodNumber: 1, startTime: '08:00', endTime: '09:00', type: 'lesson' },
] satisfies GeneratedPeriod[];

const profile = {
  streamLayouts: {
    p1: {
      defaultMode: 'consolidated',
      dayModes: { '1': 'separate' },
      periodModes: { 'tue-1': 'separate' },
    },
  },
} as Pick<TimetableProfile, 'streamLayouts'>;

test('period overrides day and class stream defaults', () => {
  assert.equal(getTimetableStreamMode(profile, 'p1', 1, 'mon-1'), 'separate');
  assert.equal(getTimetableStreamMode(profile, 'p1', 2, 'tue-1'), 'separate');
  assert.equal(getTimetableStreamMode(profile, 'p1', 3, 'missing'), 'consolidated');
  assert.equal(getTimetableStreamMode(undefined, 'p1', 1, 'mon-1'), 'consolidated');
});

test('a separated day expands one class into ordered stream sub-rows', () => {
  const mondayRows = buildTimetableClassRowsForDay([schoolClass], profile, '2026', 1, periods);
  assert.deepEqual(mondayRows.map(row => row.stream?.id), ['east', 'west']);
  assert.equal(mondayRows[0].streamCount, 2);

  const legacyRows = buildTimetableClassRowsForDay([schoolClass], undefined, '2026', 1, periods);
  assert.equal(legacyRows.length, 1);
});

test('entry lookup keeps consolidated and stream lessons distinct', () => {
  const entries = [
    { id: 'all', classId: 'p1', periodId: 'mon-1', subjectId: 'math', teacherId: 't1', createdAt: '' },
    { id: 'east', classId: 'p1', periodId: 'tue-1', streamId: 'east', subjectId: 'eng', teacherId: 't2', createdAt: '' },
  ] satisfies TimetableEntry[];
  assert.equal(findTimetableEntryForRow(entries, 'p1', 'mon-1', 'consolidated')?.id, 'all');
  assert.equal(findTimetableEntryForRow(entries, 'p1', 'tue-1', 'separate', 'east')?.id, 'east');
  assert.equal(findTimetableEntryForRow(entries, 'p1', 'tue-1', 'separate', 'west'), undefined);
});
