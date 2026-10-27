import type { StaffClockingDailyRecord, StaffClockingSchedule, StaffClockingDutyAssignment, StaffClockingDutyAdjustment } from './contracts';

export type DetailPeriod = 'day' | 'week' | 'month' | 'term' | 'custom';
export type DetailRange = { from: string; to: string };
export type DetailTab = 'history' | 'schedule' | 'exemptions' | 'requests' | 'audit';
export interface StaffClockingDetailProfile {
  staff: { id: string; name: string; employeeId: string; groups: string[]; roles: string[]; status: string; photo?: string; email?: string; phone?: string };
  permissions: { own: boolean; export: boolean; profile: boolean; manage: boolean; exempt: boolean; request: boolean; explain: boolean; audit: boolean; reviewExemptions: boolean; reviewCorrections: boolean; reviewExplanations: boolean };
}
export interface StaffClockingDetailPlan {
  staffId: string;
  groups: string[];
  stableSince: string;
  joinedOn?: string;
  duties?: StaffClockingDutyAssignment[];
  schedules: Array<StaffClockingSchedule & { availableFrom: string }>;
  closures: Array<DetailRange & { title: string }>;
}
export type DetailStatus = 'on_time' | 'grace' | 'late' | 'exempt' | 'absent' | 'unresolved' | 'scheduled' | 'off' | 'holiday';
export interface StaffClockingDetailRow {
  date: string;
  dayType: 'normal' | 'special' | 'holiday' | 'off' | 'unknown';
  scheduled: boolean;
  status: DetailStatus;
  expectedIn?: string;
  expectedOut?: string;
  graceMinutes?: number;
  source?: string;
  recordedGroup?: string;
  warning?: string;
  duty?: StaffClockingDutyAdjustment;
  record?: StaffClockingDailyRecord;
}
export interface StaffClockingDetailRequest {
  id: string;
  kind: 'exemption' | 'correction' | 'explanation';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  localDate: string;
  endDate?: string;
  reason?: string;
  createdAt?: string;
  createdBy?: { id: string; name: string };
  reviewedBy?: { id: string; name: string };
  reviewedAt?: string;
  reviewNote?: string;
  proposedClockInTime?: string;
  proposedClockOutTime?: string;
}
export interface StaffClockingDetailEvent {
  id: string;
  type: string;
  localDate?: string;
  occurredAt?: string;
  localTime?: string;
  original?: string;
  effective?: string;
  actor?: string;
  reason?: string;
}
export interface StaffClockingDetailAuditPage { events: StaffClockingDetailEvent[]; nextCursor?: string }

export const detailStatusLabels: Record<DetailStatus, string> = { on_time: 'On time', grace: 'Within grace', late: 'Late', exempt: 'Approved leave', absent: 'Absent', unresolved: 'Unresolved', scheduled: 'Not yet arrived', off: 'Off day', holiday: 'Holiday' };
