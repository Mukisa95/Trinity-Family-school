import type { AndroidOfflineSession } from './android-contracts';

/** Only caches consumed by the native projection can dirty its saved copy. */
export function affectsAndroidSnapshot(session: AndroidOfflineSession, key: unknown, projectId: string): boolean {
  if (typeof key !== 'string' || session.role === 'Parent') return false;
  const scope = [projectId, session.accountId, session.role].map(encodeURIComponent).join(':');
  if (key === `${projectId}::pupils::user:${session.accountId}`) return session.grants.pupils || (session.grants.dashboard && session.grants.dashboardCounts.includes('pupils'));
  if (key === `classes:${scope}` || key === `academic-years:${scope}`) return session.grants.pupils || session.grants.dashboard || session.grants.timetable;
  if (key === `subjects:${scope}`) return session.grants.timetable;
  if (key === `staff:${scope}`) return session.grants.timetable || (session.grants.dashboard && session.grants.dashboardCounts.includes('staff'));
  const timetableScope = [projectId, session.accountId, session.role, 'school'].map(encodeURIComponent).join(':');
  return session.grants.timetable && key.startsWith(`timetable:${encodeURIComponent(timetableScope)}:`);
}
