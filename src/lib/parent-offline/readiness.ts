import type { AcademicYear } from '@/types';
import { isParentAppShellReady } from './app-shell';
import {
  readParentOfflineAttendance,
  readParentOfflineBanking,
  readParentOfflineFamily,
  readParentOfflineFees,
  readParentOfflineResults,
} from './repository';

export type ParentOfflineReadiness = {
  ready: boolean;
  completed: number;
  expected: number;
  missing: string[];
  preparedAt: string | null;
};

/** A local-only check. A cached family profile alone never means a complete download. */
export async function getParentOfflineReadiness(
  accountId: string,
  academicYear: AcademicYear | null,
): Promise<ParentOfflineReadiness> {
  const family = await readParentOfflineFamily(accountId);
  const pupils = family?.pupils || [];
  const checks: Array<Promise<boolean>> = [isParentAppShellReady(), Promise.resolve(Boolean(family))];
  const labels = ['Parent pages and interface files', 'Family profiles'];

  for (const pupil of pupils) {
    const label = `${pupil.firstName || 'Child'} ${pupil.lastName || ''}`.trim();
    labels.push(`${label}: banking`, `${label}: attendance`, `${label}: results`);
    checks.push(
      readParentOfflineBanking(accountId, pupil.id).then(Boolean),
      readParentOfflineAttendance(accountId, pupil.id).then(Boolean),
      readParentOfflineResults(accountId, pupil.id).then(Boolean),
    );
    for (const term of academicYear?.terms || []) {
      labels.push(`${label}: ${academicYear?.name} ${term.name} fees`);
      checks.push(readParentOfflineFees(accountId, pupil.id, academicYear!.id, term.id).then(Boolean));
    }
  }

  const present = await Promise.all(checks);
  const missing = labels.filter((_, index) => !present[index]);
  if (!academicYear?.terms?.length) missing.push('Current academic year and terms');
  if (!pupils.length) missing.push('Linked child profiles');
  return {
    ready: missing.length === 0,
    completed: present.filter(Boolean).length,
    expected: checks.length + (!academicYear?.terms?.length ? 1 : 0) + (!pupils.length ? 1 : 0),
    missing,
    preparedAt: family?.preparedAt || null,
  };
}
