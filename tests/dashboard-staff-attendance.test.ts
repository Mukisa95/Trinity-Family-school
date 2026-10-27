import assert from 'node:assert/strict';
import test from 'node:test';
import { getStaffAttendanceSummary } from '../src/lib/dashboard/staff-attendance';
import type { DashboardArrival } from '../src/lib/dashboard/staff-day-contracts';
import type { StaffClockingDailyRecord } from '../src/lib/staff-clocking/contracts';

const arrival = (staffId: string, record?: Partial<StaffClockingDailyRecord>): DashboardArrival => ({
  staffId, staffName: staffId, enrolled: true, schedule: { kind: 'scheduled', localDate: '2026-10-27', clockInBy: '07:30', graceMinutes: 5 },
  record: record ? { id: staffId, staffId, localDate: '2026-10-27', status: 'open', ...record } : undefined,
});

test('the daily fraction counts arrivals including staff who later departed', () => {
  assert.deepEqual(getStaffAttendanceSummary([
    arrival('on-time', { clockInTime: '07:00' }),
    arrival('late', { clockInTime: '08:00', arrivalStatus: 'late' }),
    arrival('departed', { clockInTime: '07:30', clockOutTime: '17:00', status: 'complete' }),
    arrival('not-arrived'),
  ]), { present: 3, total: 4 });
});

test('approved effective arrivals count without inventing attendance for exemptions or empty records', () => {
  assert.deepEqual(getStaffAttendanceSummary([
    arrival('corrected', { effectiveClockInTime: '07:00', reviewStatus: 'corrected' }),
    arrival('exempted', { reviewStatus: 'exempted' }),
    arrival('pending', {}),
  ]), { present: 1, total: 3 });
});

test('the denominator matches the displayed roster including not-enrolled staff', () => {
  assert.deepEqual(getStaffAttendanceSummary([arrival('teacher'), { ...arrival('not-enrolled'), enrolled: false }]), { present: 0, total: 2 });
  assert.deepEqual(getStaffAttendanceSummary([]), { present: 0, total: 0 });
});
