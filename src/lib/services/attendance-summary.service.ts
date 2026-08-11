import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import type { AttendanceRecord, AttendanceStatus } from '@/types';
import { db } from '@/lib/firebase';
import {
  getDashboardRevisionDocumentRef,
  setAttendanceRevisionInTransaction,
} from './dashboard-cache-revisions.service';
import {
  ATTENDANCE_SUMMARY_SCHEMA,
  type AttendanceDailySummary,
  type AttendanceSummaryEntry,
  writeAttendanceSummaryCache,
} from '@/lib/cache/attendance-summary-cache';

const COLLECTION_NAME = 'attendanceDailySummaries';

function summaryRef(date: string) {
  return doc(db, COLLECTION_NAME, date);
}

function normaliseStatus(value: unknown): AttendanceStatus | null {
  return value === 'Present' || value === 'Absent' || value === 'Late' ||
    value === 'Excused' || value === 'Delayed'
    ? value
    : null;
}

function normaliseEntry(value: any): AttendanceSummaryEntry | null {
  const status = normaliseStatus(value?.status);
  if (!status || !value?.pupilId || !value?.classId) return null;
  return {
    pupilId: String(value.pupilId),
    classId: String(value.classId),
    status,
    remarks: value.remarks || '',
    recordId: value.recordId || value.id,
    className: value.className,
    classCode: value.classCode,
    recordedAt: typeof value.recordedAt === 'string'
      ? value.recordedAt
      : value.recordedAt?.toDate?.()?.toISOString?.(),
  };
}

export function toAttendanceSummaryEntry(record: AttendanceRecord): AttendanceSummaryEntry | null {
  return normaliseEntry(record);
}

export async function getDailyAttendanceSummary(
  date: string,
): Promise<AttendanceDailySummary | null> {
  const snapshot = await getDoc(summaryRef(date));
  if (!snapshot.exists()) return null;

  const data = snapshot.data() as any;
  const records = Array.isArray(data.records)
    ? data.records.map(normaliseEntry).filter(Boolean) as AttendanceSummaryEntry[]
    : [];

  return {
    schema: data.schema || ATTENDANCE_SUMMARY_SCHEMA,
    date: data.date || date,
    revision: typeof data.revision === 'number' ? data.revision : 0,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt,
    records,
  };
}

/**
 * Publish one class session into the school-wide daily projection. The source
 * attendanceRecords remain authoritative; this document is only a read model
 * for dashboard/today views. A class replaces its previous entries in one
 * batch, so dozens of auto-saves produce one summary read and one summary
 * write when the session is flushed.
 */
export async function publishDailyAttendanceSummary(
  scope: string,
  date: string,
  classId: string,
  classRecords: AttendanceRecord[],
  replaceClass = true,
): Promise<AttendanceDailySummary> {
  if (!scope || !date || !classId) {
    throw new Error('Attendance summary requires an authorised scope, date and class');
  }

  const replacement = classRecords
    .map(toAttendanceSummaryEntry)
    .filter((record): record is AttendanceSummaryEntry =>
      !!record && record.classId === classId && !!record.recordId
    );

  const committed = await runTransaction(db, async transaction => {
    const ref = summaryRef(date);
    const [snapshot, settingsSnapshot] = await Promise.all([
      transaction.get(ref),
      transaction.get(getDashboardRevisionDocumentRef()),
    ]);
    const data = snapshot.exists() ? snapshot.data() as any : null;
    const currentSchoolRevision = settingsSnapshot.exists()
      ? Number(settingsSnapshot.data()?.attendance || 0)
      : 0;
    const existingRecords = Array.isArray(data?.records)
      ? data.records.map(normaliseEntry).filter(Boolean) as AttendanceSummaryEntry[]
      : [];
    const otherClasses = existingRecords.filter(record => record.classId !== classId);
    const previousClass = existingRecords.filter(record => record.classId === classId);
    const nextClass = replaceClass
      ? replacement
      : Array.from(new Map(
        [...previousClass, ...replacement].map(record => [record.pupilId, record]),
      ).values());
    const records = [...otherClasses, ...nextClass];

    // Keep enough headroom below Firestore's 1 MiB document limit.
    if (JSON.stringify(records).length * 2 > 700 * 1024) {
      throw new Error('Daily attendance summary is too large; use partitioned summaries');
    }

    const revision = currentSchoolRevision + 1;
    transaction.set(ref, {
      schema: ATTENDANCE_SUMMARY_SCHEMA,
      date,
      records,
      revision,
      updatedAt: serverTimestamp(),
    });
    setAttendanceRevisionInTransaction(transaction, revision);
    return { records, revision };
  });

  const summary: AttendanceDailySummary = {
    schema: ATTENDANCE_SUMMARY_SCHEMA,
    date,
    revision: committed.revision,
    updatedAt: new Date().toISOString(),
    records: committed.records,
  };
  writeAttendanceSummaryCache(scope, date, summary);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('trinity:attendance-summary-updated', {
      detail: { scope, summary },
    }));
  }
  return summary;
}

export function buildDashboardAttendanceData(summary: AttendanceDailySummary | null) {
  const records = summary?.records || [];
  const counts = records.reduce((acc, record) => {
    if (record.status === 'Present') acc.present += 1;
    if (record.status === 'Absent') acc.absent += 1;
    if (record.status === 'Late') acc.late += 1;
    if (record.status === 'Delayed') acc.delayed += 1;
    acc.total += 1;
    return acc;
  }, { present: 0, absent: 0, late: 0, delayed: 0, total: 0 });

  const byClass = Array.from(records.reduce((map, record) => {
    const current = map.get(record.classId) || {
      classId: record.classId,
      className: record.className || record.classCode || record.classId,
      present: 0,
      absent: 0,
      late: 0,
      delayed: 0,
      total: 0,
    };
    current.total += 1;
    if (record.status === 'Present') current.present += 1;
    if (record.status === 'Absent') current.absent += 1;
    if (record.status === 'Late') current.late += 1;
    if (record.status === 'Delayed') current.delayed += 1;
    map.set(record.classId, current);
    return map;
  }, new Map<string, any>()).values());

  return { ...counts, records, byClass, revision: summary?.revision || 0 };
}
