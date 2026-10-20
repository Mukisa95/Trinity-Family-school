import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesAttendanceClass, mergePupilAttendance } from '@/lib/events/attendance-roster';
import type { PupilAttendanceEntry } from '@/types/attendance';

const entry = (pupilId: string, className: string, classId?: string): PupilAttendanceEntry => ({
  pupilId, pupilName: pupilId, className, classId, status: 'present', recordedAt: new Date(), recordedBy: 'admin',
});

test('attendance recognises class codes and old names while explicit class IDs take precedence', () => {
  for (const label of ['c4', 'P.4', 'PRIMARY FOUR']) assert.ok(matchesAttendanceClass(entry('p1', label), 'c4', 'P.4', 'PRIMARY FOUR'));
  assert.ok(!matchesAttendanceClass(entry('p1', 'P.4', 'other'), 'c4', 'P.4', 'PRIMARY FOUR'));
  assert.ok(!matchesAttendanceClass(entry('p1', 'P.1'), 'c4', 'P.4', 'PRIMARY FOUR'));
});

test('saving more pupils preserves attendance already recorded for the same and other classes', () => {
  const first = entry('p1', 'P.4', 'c4'), other = entry('p2', 'P.1', 'c1');
  const added = entry('p3', 'P.4', 'c4');
  assert.deepEqual(mergePupilAttendance([first, other], [added]), [first, other, added]);
  const corrected = {...first, status: 'late' as const};
  assert.deepEqual(mergePupilAttendance([first, other, added], [corrected]), [other, added, corrected]);
});
