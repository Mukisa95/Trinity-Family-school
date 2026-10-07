import type { GeneratedPeriod, TimetableEntry, TimetableProfile } from '@/types';
import type { ParentOfflineAttendanceSnapshot, ParentOfflineBankingSnapshot, ParentOfflineFamilySnapshot, ParentOfflineFeesSnapshot, ParentOfflineResultsSnapshot } from '@/lib/parent-offline/contracts';
import { isParentOfflineFamilySnapshot, isParentOfflineFeesSnapshot, isParentOfflineAttendanceSnapshot, isParentOfflineBankingSnapshot, isParentOfflineResultsSnapshot } from '@/lib/parent-offline/contracts';

export const ANDROID_OFFLINE_SCHEMA = 1;
export const ANDROID_OFFLINE_SESSION_DAYS = 7;

/** Server-derived capabilities. No password, Firebase token or raw user record is saved. */
export type AndroidOfflineSession = {
  schema: 1;
  accountId: string;
  role: string;
  displayName: string;
  timeZone: string;
  issuedAt: string;
  expiresAt: string;
  pupilIds: string[];
  grants: {
    dashboard: boolean;
    pupils: boolean;
    timetable: boolean;
    pupilFields: string[];
    dashboardCounts: string[];
  };
};

export type AndroidOfflineDataset<T> = {
  preparedAt: string;
  revision?: number;
  data: T;
};

export type AndroidOfflineTimetable = {
  profile: TimetableProfile;
  periods: GeneratedPeriod[];
  entries: TimetableEntry[];
  complete: boolean;
};

export type AndroidParentBundle = {
  family: ParentOfflineFamilySnapshot;
  fees: ParentOfflineFeesSnapshot[];
  banking: ParentOfflineBankingSnapshot[];
  attendance: ParentOfflineAttendanceSnapshot[];
  results: ParentOfflineResultsSnapshot[];
};

export type AndroidOfflineSnapshot = {
  schema: 1;
  accountId: string;
  role: string;
  capturedAt: string;
  datasets: {
    pupils?: AndroidOfflineDataset<Record<string, unknown>[]>;
    classes?: AndroidOfflineDataset<Record<string, unknown>[]>;
    academicYears?: AndroidOfflineDataset<Record<string, unknown>[]>;
    dashboard?: AndroidOfflineDataset<Record<string, number | string>>;
    timetables?: AndroidOfflineDataset<AndroidOfflineTimetable[]>;
    subjects?: AndroidOfflineDataset<Record<string, unknown>[]>;
    teachers?: AndroidOfflineDataset<Record<string, unknown>[]>;
    parent?: AndroidOfflineDataset<AndroidParentBundle>;
  };
};

export function projectOfflinePupil(pupil: Record<string, unknown>, session: AndroidOfflineSession) {
  return Object.fromEntries(session.grants.pupilFields
    .filter(field => field in pupil)
    .map(field => [field, pupil[field]]));
}

export function isAndroidOfflineSnapshot(value: unknown, session: AndroidOfflineSession): value is AndroidOfflineSnapshot {
  if (!value || typeof value !== 'object') return false;
  const item = value as AndroidOfflineSnapshot;
  if (item.schema !== ANDROID_OFFLINE_SCHEMA || item.accountId !== session.accountId || item.role !== session.role
    || !Number.isFinite(Date.parse(item.capturedAt)) || !item.datasets || typeof item.datasets !== 'object') return false;
  if (session.role === 'Parent') {
    if (Object.keys(item.datasets).some(key => key !== 'parent')) return false;
    const family = item.datasets.parent?.data?.family;
    if (!isParentOfflineFamilySnapshot(family, session.accountId)
      || family.pupils.some(pupil => !session.pupilIds.includes(pupil.id))) return false;
    const parent = item.datasets.parent!.data;
    const child = (record: { pupilId: string } | null | undefined) => Boolean(record && family.pupils.some(pupil => pupil.id === record.pupilId));
    return Array.isArray(parent.fees) && parent.fees.every(record => child(record) && isParentOfflineFeesSnapshot(record, session.accountId, record.pupilId, record.academicYearId, record.termId))
      && Array.isArray(parent.attendance) && parent.attendance.every(record => child(record) && isParentOfflineAttendanceSnapshot(record, session.accountId, record.pupilId))
      && Array.isArray(parent.banking) && parent.banking.every(record => child(record) && isParentOfflineBankingSnapshot(record, session.accountId, record.pupilId))
      && Array.isArray(parent.results) && parent.results.every(record => child(record) && isParentOfflineResultsSnapshot(record, session.accountId, record.pupilId));
  }
  if (item.datasets.parent || (item.datasets.pupils && !session.grants.pupils)
    || (item.datasets.dashboard && !session.grants.dashboard)
    || (item.datasets.timetables && !session.grants.timetable)) return false;
  if ((item.datasets.subjects || item.datasets.teachers) && !session.grants.timetable) return false;
  if (item.datasets.dashboard && Object.keys(item.datasets.dashboard.data).some(key => !session.grants.dashboardCounts.includes(key))) return false;
  if (item.datasets.pupils && (!Array.isArray(item.datasets.pupils.data) || item.datasets.pupils.data.some(pupil =>
    typeof pupil.id !== 'string' || Object.keys(pupil).some(field => !session.grants.pupilFields.includes(field))))) return false;
  return true;
}
