import type { DashboardArrival } from './staff-day-contracts';

/** Daily attendance counts an arrival even after that employee has departed. */
export function getStaffAttendanceSummary(arrivals: DashboardArrival[]) {
  return {
    present: arrivals.filter(item => item.record?.effectiveClockInTime || item.record?.clockInTime).length,
    total: arrivals.length,
  };
}
