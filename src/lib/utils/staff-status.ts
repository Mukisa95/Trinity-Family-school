import type { Staff } from '@/types';

export type StaffStatus = NonNullable<Staff['status']>;

export const STAFF_STATUS_LABELS: Record<StaffStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  onLeave: 'On leave',
  suspended: 'Suspended',
};

// Older staff profiles predate the status field and are treated as active.
export function getStaffStatus(staff: Pick<Staff, 'status'>): StaffStatus {
  return staff.status || 'active';
}
