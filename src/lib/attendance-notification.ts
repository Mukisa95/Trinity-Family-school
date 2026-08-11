import type { AttendanceStatus } from '@/types';

export type AttendanceNotificationRecord = {
  pupilId: string;
  status: AttendanceStatus;
  classId: string;
  className?: string;
  classCode?: string;
};

export type AttendanceNotificationSummary = {
  date: string;
  classId: string;
  /** Stable class label used in every notification. Never use the display name. */
  classCode: string;
  present: number;
  absent: number;
  delayed: number;
  late: number;
  excused: number;
  total: number;
  records: AttendanceNotificationRecord[];
};

/**
 * Keep attendance notification counts and dashboard detail views consistent.
 * Late pupils are present for the day; excused pupils remain visibly distinct
 * in the absent column rather than disappearing from the summary.
 */
export function summariseAttendanceClass(
  date: string,
  classId: string,
  records: AttendanceNotificationRecord[],
  fallbackClassCode = classId,
): AttendanceNotificationSummary {
  const classRecords = records.filter(record => record.classId === classId);
  const classCode = classRecords[0]?.classCode?.trim() || fallbackClassCode;
  const counts = classRecords.reduce((summary, record) => {
    if (record.status === 'Present') summary.present += 1;
    if (record.status === 'Late') {
      summary.present += 1;
      summary.late += 1;
    }
    if (record.status === 'Absent') summary.absent += 1;
    if (record.status === 'Excused') {
      summary.absent += 1;
      summary.excused += 1;
    }
    if (record.status === 'Delayed') summary.delayed += 1;
    return summary;
  }, { present: 0, absent: 0, delayed: 0, late: 0, excused: 0 });

  return { date, classId, classCode, total: classRecords.length, records: classRecords, ...counts };
}

export function attendanceSummaryFingerprint(summary: AttendanceNotificationSummary) {
  return [summary.date, summary.classId, summary.present, summary.absent, summary.delayed, summary.late, summary.excused].join(':');
}

export function attendanceSummaryBody(summary: AttendanceNotificationSummary) {
  const parts = [`Present ${summary.present}`, `Absent ${summary.absent}`];
  if (summary.delayed > 0) parts.push(`Delayed ${summary.delayed}`);
  return parts.join(' • ');
}
