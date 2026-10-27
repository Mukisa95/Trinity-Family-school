import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyStaffClockIn,
  resolveStaffClockingSchedule,
} from '../src/lib/staff-clocking/schedule-resolver';
import type { StaffClockingSchedule } from '../src/lib/staff-clocking/contracts';
import { dutyClockingTimeError, dutyLocalDate } from '../src/lib/staff-clocking/duty-schedule';
import type { StaffClockingDutyAssignment } from '../src/lib/staff-clocking/contracts';

const duty: StaffClockingDutyAssignment = { id: 'week-duty', rotaId: 'weekly', dutyName: 'Gate duty', staffId: 'staff-ada', startsOn: '2026-10-26', endsOn: '2026-11-01', clockInBy: '06:30', clockOutBy: '18:00', availableFrom: '2026-10-01' };
const dutyDay = (duties: StaffClockingDutyAssignment[], date = '2026-10-26') => resolveStaffClockingSchedule({ staffId: 'staff-ada', groupIds: [], localDate: date, schedules: [{ ...schoolSchedule, clockOutBy: '17:00' }], duties });

test('duty timing adjusts only assigned dates and keeps the normal grace rule', () => {
  const onDuty = dutyDay([duty]);
  assert.equal(onDuty.clockInBy, '06:30'); assert.equal(onDuty.clockOutBy, '18:00'); assert.equal(onDuty.graceMinutes, 10);
  assert.equal(onDuty.duty?.normalClockInBy, '08:00:00'); assert.equal(onDuty.duty?.normalClockOutBy, '17:00');
  assert.equal(onDuty.duty?.assignments[0].dutyName, 'Gate duty');
  assert.equal(classifyStaffClockIn('06:40:01', onDuty).status, 'late');
  for (const date of ['2026-10-23', '2026-11-02']) { const normal = dutyDay([duty], date); assert.equal(normal.clockInBy, '08:00:00'); assert.equal(normal.duty, undefined); }
  assert.equal(dutyDay([{ ...duty, staffId: 'another-staff' }]).duty, undefined);
});

test('arrival-only and departure-only duties inherit the other staff-specific time', () => {
  assert.equal(dutyDay([{ ...duty, clockOutBy: undefined }]).clockOutBy, '17:00');
  assert.equal(dutyDay([{ ...duty, clockInBy: undefined }]).clockInBy, '08:00:00');
  const result = resolveStaffClockingSchedule({ staffId: 'staff-ada', groupIds: [], localDate: '2026-10-26', schedules: [{ ...schoolSchedule, scope: 'staff', subjectId: 'staff-ada', graceMinutes: 3 }], duties: [duty] });
  assert.equal(result.graceMinutes, 3);
});

test('overlapping duties combine earliest arrival and latest departure deterministically', () => {
  const other = { ...duty, id: 'another-duty', clockInBy: '07:00', clockOutBy: '19:00' };
  const resolved = dutyDay([duty, other]);
  assert.equal(resolved.clockInBy, '06:30'); assert.equal(resolved.clockOutBy, '19:00');
  assert.deepEqual(resolved, dutyDay([other, duty])); assert.equal(resolved.duty?.assignments.length, 2);
});

test('a duty rota does not create a holiday or weekend attendance obligation', () => {
  assert.equal(dutyDay([duty], '2026-10-31').kind, 'non_working_day');
  assert.equal(resolveStaffClockingSchedule({ staffId: 'staff-ada', groupIds: [], localDate: '2026-10-26', schedules: [schoolSchedule], duties: [duty], calendarDay: { localDate: '2026-10-26', isClosed: true } }).kind, 'non_working_day');
});

test('duty forms and resolver reject invalid or inverted combined working times', () => {
  assert.equal(dutyClockingTimeError('', ''), undefined);
  for (const [arrival, departure] of [['25:00',''], ['07:00','06:00'], ['07:00','07:00']]) assert.ok(dutyClockingTimeError(arrival, departure));
  assert.equal(dutyDay([{ ...duty, clockInBy: undefined, clockOutBy: '07:00' }]).kind, 'conflict');
  assert.equal(dutyDay([{ ...duty, clockInBy: 'invalid' }]).kind, 'conflict');
});

test('duty periods normalize both local dates and UTC instants in Kampala time', () => {
  assert.equal(dutyLocalDate('2026-10-26'), '2026-10-26');
  assert.equal(dutyLocalDate('2026-10-25T21:00:00.000Z'), '2026-10-26');
  assert.equal(dutyLocalDate({ toDate: () => new Date('2026-10-25T21:00:00Z') }), '2026-10-26');
  assert.equal(dutyLocalDate('invalid'), undefined);
});

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
