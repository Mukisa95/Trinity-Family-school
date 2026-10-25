/**
 * Shared, framework-free contracts for the Staff Clocking feature.
 *
 * Server route handlers own authoritative data and permission decisions. These
 * types deliberately contain only the data needed by deterministic schedule
 * resolution so that the same rules can be tested without Firebase or React.
 */

export const STAFF_CLOCKING_TIME_ZONE = 'Africa/Kampala' as const;

export const STAFF_CLOCKING_REVISION_KEYS = [
  'staffClockingConfig', 'staffClockingRecords', 'staffClockingRequests', 'staffClockingNotifications',
] as const;
export type StaffClockingRevisionKey = typeof STAFF_CLOCKING_REVISION_KEYS[number];

export type StaffClockingScope = 'school' | 'group' | 'staff';
export type StaffClockingScheduleKind = 'recurring' | 'date_override';
export type StaffClockingResolutionKind = 'scheduled' | 'non_working_day' | 'conflict';
export type StaffClockingArrivalStatus = 'on_time' | 'grace' | 'late';
export type StaffClockingAccessMode = 'all_active_linked_staff' | 'selected_staff';

export interface StaffClockingFeatureSettings {
  enabled: boolean;
  accessMode: StaffClockingAccessMode;
  enrolledStaffIds: string[];
  revision: number;
  timeZone: typeof STAFF_CLOCKING_TIME_ZONE;
  updatedAt?: string;
}

export interface StaffClockingAccessSummary {
  canClock: boolean;
  canManage: boolean;
  isEnrolled: boolean;
}

export interface StaffClockingBootstrap {
  feature: StaffClockingFeatureSettings;
  access: StaffClockingAccessSummary;
  hasActiveSchedule: boolean;
}

export interface StaffClockingDailyRecord {
  id: string;
  staffId: string;
  staffName?: string;
  localDate: string;
  clockInTime?: string;
  clockOutTime?: string;
  effectiveClockInTime?: string;
  effectiveClockOutTime?: string;
  arrivalStatus?: StaffClockingArrivalStatus;
  secondsLate?: number;
  status: 'open' | 'complete' | 'missing_clock_out';
  clockInBy?: string;
  graceMinutes?: number;
  updatedAt?: string;
  reviewStatus?: 'corrected' | 'exempted';
}

export interface StaffClockingReviewRequest {
  id: string;
  kind: 'exemption' | 'correction';
  status: 'pending' | 'approved' | 'rejected';
  staffId: string;
  localDate: string;
  reason: string;
  proposedClockInTime?: string;
  proposedClockOutTime?: string;
  createdAt?: string;
  createdBy?: { id: string; name: string };
}

export interface StaffClockingStaffCandidate {
  id: string;
  name: string;
  employeeId?: string;
  department: string[];
  role: string[];
}

export interface StaffClockingReportSummary {
  total: number;
  complete: number;
  open: number;
  late: number;
  exempted: number;
  corrected: number;
}

export interface StaffClockingSchedule {
  id: string;
  scope: StaffClockingScope;
  /** Required for group and staff schedules. */
  subjectId?: string;
  kind: StaffClockingScheduleKind;
  /** ISO local date for a one-day approved override. */
  workDate?: string;
  /** Sunday = 0 through Saturday = 6. Required for recurring schedules. */
  weekdays?: number[];
  startsOn?: string;
  endsOn?: string;
  clockInBy: string;
  /** Optional expected departure shown to managers; it does not close an open shift automatically. */
  clockOutBy?: string;
  graceMinutes: number;
  /** Resolves deliberately ordered group policies before their schedule IDs. */
  priority?: number;
  isActive: boolean;
}

export interface StaffClockingCalendarDay {
  localDate: string;
  isClosed: boolean;
  label?: string;
}

export interface StaffClockingScheduleRequest {
  staffId: string;
  groupIds: string[];
  localDate: string;
  schedules: StaffClockingSchedule[];
  calendarDay?: StaffClockingCalendarDay;
}

export interface ResolvedStaffClockingSchedule {
  kind: StaffClockingResolutionKind;
  localDate: string;
  sourceScheduleId?: string;
  sourceScope?: StaffClockingScope;
  clockInBy?: string;
  graceMinutes?: number;
  reason?: string;
}

export interface StaffClockingArrival {
  status: StaffClockingArrivalStatus;
  secondsLate: number;
}
