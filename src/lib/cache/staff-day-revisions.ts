import type { SchoolSettings } from '@/types';

export function staffDayRevisionToken(revisions: SchoolSettings['dataRevisions'], date: string, staffId: string | undefined, schoolWide: boolean): string {
  return JSON.stringify({ date, duty: revisions?.dutyService || 0, policy: revisions?.staffClockingPolicy || 0,
    records: revisions?.staffClockingEnabled === false ? 0 : schoolWide ? revisions?.dashboardStaffClockingRecords || 0 : revisions?.staffClockingStaff?.[staffId || ''] || 0,
    staff: revisions?.staff || 0, events: revisions?.events || 0 });
}
