import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyStaffClockIn,
  resolveStaffClockingSchedule,
} from '../src/lib/staff-clocking/schedule-resolver';
import type { StaffClockingSchedule } from '../src/lib/staff-clocking/contracts';

const schoolSchedule: StaffClockingSchedule = {
  id: 'school-weekdays',
  scope: 'school',
  kind: 'recurring',
  weekdays: [1, 2, 3, 4, 5],
  clockInBy: '08:00:00',
  graceMinutes: 10,
  isActive: true,
};

test('staff date overrides outrank a school closure and recurring schedules', () => {
  const resolution = resolveStaffClockingSchedule({
    staffId: 'staff-ada',
    groupIds: ['teaching'],
    localDate: '2026-10-26',
    calendarDay: { localDate: '2026-10-26', isClosed: true, label: 'Public holiday' },
    schedules: [
      schoolSchedule,
      {
        id: 'ada-approved-duty',
        scope: 'staff',
        subjectId: 'staff-ada',
        kind: 'date_override',
        workDate: '2026-10-26',
        clockInBy: '09:00:00',
        graceMinutes: 5,
        isActive: true,
      },
    ],
  });

  assert.deepEqual(resolution, {
    kind: 'scheduled',
    localDate: '2026-10-26',
    sourceScheduleId: 'ada-approved-duty',
    sourceScope: 'staff',
    clockInBy: '09:00:00',
    graceMinutes: 5,
  });
});

test('closures prevent recurring rules from automatically marking a work day', () => {
  const resolution = resolveStaffClockingSchedule({
    staffId: 'staff-ada',
    groupIds: [],
    localDate: '2026-10-26',
    calendarDay: { localDate: '2026-10-26', isClosed: true, label: 'Public holiday' },
    schedules: [schoolSchedule],
  });

  assert.equal(resolution.kind, 'non_working_day');
  assert.equal(resolution.reason, 'Public holiday');
});

test('equal group policies with incompatible shifts surface a conflict', () => {
  const resolution = resolveStaffClockingSchedule({
    staffId: 'staff-ada',
    groupIds: ['teaching', 'sports'],
    localDate: '2026-10-26',
    schedules: [
      { ...schoolSchedule, id: 'teaching', scope: 'group', subjectId: 'teaching', clockInBy: '07:30:00' },
      { ...schoolSchedule, id: 'sports', scope: 'group', subjectId: 'sports', clockInBy: '08:30:00' },
    ],
  });

  assert.equal(resolution.kind, 'conflict');
});

test('arrival classification preserves exact seconds at the grace boundary', () => {
  const schedule = { kind: 'scheduled' as const, clockInBy: '08:00:00', graceMinutes: 10 };
  assert.deepEqual(classifyStaffClockIn('08:00:00', schedule), { status: 'on_time', secondsLate: 0 });
  assert.deepEqual(classifyStaffClockIn('08:10:00', schedule), { status: 'grace', secondsLate: 600 });
  assert.deepEqual(classifyStaffClockIn('08:10:01', schedule), { status: 'late', secondsLate: 601 });
});
