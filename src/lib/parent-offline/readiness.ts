import type { AcademicYear } from '@/types';
import { getParentAppShellPreparedAt, isParentAppShellReady } from './app-shell';
import {
  readParentOfflineAttendance,
  readParentOfflineBanking,
  readParentOfflineFamily,
  readParentOfflineFees,
  readParentOfflineResults,
} from './repository';

export type ParentOfflineDatasetStatus = {
  id: string;
  label: string;
  childName?: string;
  state: 'saved' | 'pending';
  preparedAt: string | null;
  detail?: string;
};

export type ParentOfflineReadiness = {
  ready: boolean;
  completed: number;
  expected: number;
  percentage: number;
  missing: string[];
  preparedAt: string | null;
  datasets: ParentOfflineDatasetStatus[];
};

function newestTimestamp(items: ParentOfflineDatasetStatus[]) {
  const timestamps = items
    .map(item => item.preparedAt ? new Date(item.preparedAt).getTime() : NaN)
    .filter(Number.isFinite);
  return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
}

/** A local-only check. Empty, complete snapshots are valid data, not download failures. */
export async function getParentOfflineReadiness(
  accountId: string,
  academicYear: AcademicYear | null,
): Promise<ParentOfflineReadiness> {
  const family = await readParentOfflineFamily(accountId);
  const pupils = family?.pupils || [];
  const shellReady = await isParentAppShellReady();
  const datasets: ParentOfflineDatasetStatus[] = [
    {
      id: 'interface',
      label: 'Application interface',
      state: shellReady ? 'saved' : 'pending',
      preparedAt: shellReady ? getParentAppShellPreparedAt() : null,
      detail: shellReady ? 'Parent pages and interface files are on this device' : 'Saving pages and interface files',
    },
    {
      id: 'family',
      label: 'Family profiles',
      state: family ? 'saved' : 'pending',
      preparedAt: family?.preparedAt || null,
      detail: family ? `${pupils.length} linked ${pupils.length === 1 ? 'child' : 'children'}` : 'Waiting for linked child profiles',
    },
  ];

  if (!pupils.length) {
    datasets.push({
      id: 'children',
      label: 'Linked child information',
      state: 'pending',
      preparedAt: null,
      detail: 'Waiting for at least one linked child',
    });
  }

  if (!academicYear?.terms?.length) {
    datasets.push({
      id: 'academic-year',
      label: 'Academic year and terms',
      state: 'pending',
      preparedAt: null,
      detail: 'Waiting for the current academic calendar',
    });
  }

  for (const pupil of pupils) {
    const childName = `${pupil.firstName || 'Child'} ${pupil.lastName || ''}`.trim();
    const [banking, attendance, results] = await Promise.all([
      readParentOfflineBanking(accountId, pupil.id),
      readParentOfflineAttendance(accountId, pupil.id),
      readParentOfflineResults(accountId, pupil.id),
    ]);

    // A complete banking response with account:null means banking does not
    // apply to this child. It is intentionally omitted from progress and UI.
    if (!banking || banking.account) {
      datasets.push({
        id: `${pupil.id}:banking`,
        childName,
        label: 'Banking',
        state: banking ? 'saved' : 'pending',
        preparedAt: banking?.preparedAt || null,
        detail: banking
          ? `${banking.transactions.length} ${banking.transactions.length === 1 ? 'transaction' : 'transactions'} saved`
          : 'Waiting for banking information',
      });
    }

    datasets.push(
      {
        id: `${pupil.id}:attendance`,
        childName,
        label: 'Attendance',
        state: attendance ? 'saved' : 'pending',
        preparedAt: attendance?.preparedAt || null,
        detail: attendance
          ? attendance.records.length
            ? `${attendance.records.length} ${attendance.records.length === 1 ? 'record' : 'records'} saved`
            : 'No attendance records yet'
          : 'Waiting for attendance information',
      },
      {
        id: `${pupil.id}:results`,
        childName,
        label: 'Released results',
        state: results ? 'saved' : 'pending',
        preparedAt: results?.preparedAt || null,
        detail: results
          ? results.results.length
            ? `${results.results.length} released ${results.results.length === 1 ? 'result' : 'results'} saved`
            : 'No released results yet'
          : 'Waiting for released results',
      },
    );

    for (const term of academicYear?.terms || []) {
      const fees = await readParentOfflineFees(accountId, pupil.id, academicYear!.id, term.id);
      datasets.push({
        id: `${pupil.id}:fees:${term.id}`,
        childName,
        label: `${term.name} fees`,
        state: fees ? 'saved' : 'pending',
        preparedAt: fees?.preparedAt || null,
        detail: fees
          ? fees.fees.length
            ? `${fees.fees.length} ${fees.fees.length === 1 ? 'fee item' : 'fee items'} saved for ${academicYear!.name}`
            : `No fees recorded for ${academicYear!.name} ${term.name}`
          : `Waiting for ${academicYear!.name} ${term.name} fees`,
      });
    }
  }

  const completed = datasets.filter(item => item.state === 'saved').length;
  const expected = datasets.length;
  const missing = datasets.filter(item => item.state === 'pending').map(item => (
    item.childName ? `${item.childName}: ${item.label}` : item.label
  ));
  return {
    ready: expected > 0 && completed === expected,
    completed,
    expected,
    percentage: expected ? Math.round((completed / expected) * 100) : 0,
    missing,
    preparedAt: newestTimestamp(datasets),
    datasets,
  };
}
