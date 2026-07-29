import type { AttendanceStatus } from '@/types';
import { liteRead, liteReadMetadata, liteWrite, LITE_TTL } from './lite-cache';

export const ATTENDANCE_SUMMARY_SCHEMA = 1;

export type AttendanceSummaryEntry = {
  pupilId: string;
  classId: string;
  status: AttendanceStatus;
  remarks?: string;
  recordId?: string;
  className?: string;
  classCode?: string;
  recordedAt?: string;
};

export type AttendanceDailySummary = {
  schema: number;
  date: string;
  revision: number;
  updatedAt?: string;
  records: AttendanceSummaryEntry[];
};

export function getAttendanceCacheScope(userId?: string, role?: string): string {
  if (!userId || (role !== 'Admin' && role !== 'Staff')) return '';
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools';
  return [projectId, userId, role].map(encodeURIComponent).join(':');
}

function key(scope: string, date: string) {
  return `attendance-summary:${scope}:${date}`;
}

export function readAttendanceSummaryCache(scope: string, date: string): AttendanceDailySummary | null {
  if (!scope) return null;
  const value = liteRead<AttendanceDailySummary>(key(scope, date));
  return value?.schema === ATTENDANCE_SUMMARY_SCHEMA ? value : null;
}

export function readAttendanceSummaryCacheMetadata(scope: string, date: string) {
  if (!scope) return null;
  return liteReadMetadata(key(scope, date));
}

export function writeAttendanceSummaryCache(
  scope: string,
  date: string,
  summary: AttendanceDailySummary,
): void {
  if (!scope) return;
  liteWrite(key(scope, date), summary, LITE_TTL.attendance);
}
