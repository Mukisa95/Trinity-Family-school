import type { ResolvedStaffClockingSchedule, StaffClockingDailyRecord } from '@/lib/staff-clocking/contracts';

export interface DashboardDuty {
  id: string;
  staffId: string;
  staffName: string;
  name: string;
  service?: string;
  supervisor: boolean;
  startDate: string;
  endDate: string;
}

export interface DashboardArrival {
  staffId: string;
  staffName: string;
  enrolled: boolean;
  schedule: ResolvedStaffClockingSchedule;
  record?: StaffClockingDailyRecord;
}

export interface DashboardStaffDay {
  date: string;
  schoolWide: boolean;
  clockingEnabled: boolean;
  arrivals: DashboardArrival[];
  duties: DashboardDuty[];
}
