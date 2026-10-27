import { circumferenceCacheSuffix } from '@/lib/access/circumference-session';
import type { AndroidOfflineSession } from './android-contracts';

/** Only caches consumed by the native projection can dirty its saved copy. */
export function affectsAndroidSnapshot(session: AndroidOfflineSession, key: unknown, projectId: string): boolean {
  if (typeof key !== 'string' || session.role === 'Parent') return false;
  const suffix = circumferenceCacheSuffix(session.accountId);
  if (session.grants.dutyService && session.grants.dutyServiceCacheName && key === `${projectId}::${session.grants.dutyServiceCacheName}::${[session.accountId, session.role].map(encodeURIComponent).join(':')}${suffix}`) return true;
  const scope = [projectId, session.accountId, session.role].map(encodeURIComponent).join(':') + suffix;
  if (key === `${projectId}::pupils::user:${session.accountId}${suffix}`) return session.grants.pupils || (session.grants.dashboard && session.grants.dashboardCounts.includes('pupils')) || !!session.grants.dutyService;
  if (key === `classes:${scope}` || key === `academic-years:${scope}`) return session.grants.pupils || session.grants.dashboard || session.grants.timetable || !!session.grants.dutyService;
  if (key === `subjects:${scope}`) return session.grants.timetable;
  if (key === `staff:${scope}`) return session.grants.timetable || (session.grants.dashboard && session.grants.dashboardCounts.includes('staff')) || !!session.grants.dutyService;
  const timetableScope = [projectId, session.accountId, session.role, 'school'].map(encodeURIComponent).join(':') + suffix;
  return session.grants.timetable && key.startsWith(`timetable:${encodeURIComponent(timetableScope)}:`);
}
