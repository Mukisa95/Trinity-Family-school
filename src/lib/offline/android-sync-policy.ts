import { circumferenceCacheSuffix } from '@/lib/access/circumference-session';
import type { QueryKey } from '@tanstack/react-query';
import type { AndroidOfflineSession, AndroidOfflineSnapshot } from './android-contracts';

/** Parent exports are driven by repository writes, not unrelated query success. */
export function isAndroidSavedDataQuery(key: QueryKey, session: AndroidOfflineSession): boolean {
  if (session.role === 'Parent') return false;
  const root = String(key[0] || '');
  if (root === 'events' || root === 'legacy-exam-events' || root === 'exams-as-events') return !!session.grants.events;
  if (root === 'duty-service-snapshot') return !!session.grants.dutyService;
  if (root === 'pupils') return session.grants.pupils || session.grants.dashboard || !!session.grants.dutyService;
  if (['classes', 'academicYears', 'academic-years'].includes(root)) {
    return session.grants.pupils || session.grants.dashboard || session.grants.timetable || !!session.grants.events || !!session.grants.dutyService;
  }
  if (root === 'staff') return session.grants.dashboard || session.grants.timetable || !!session.grants.dutyService;
  return ['subjects', 'timetable', 'timetables'].includes(root) && session.grants.timetable;
}

/** Ignore writes to unrelated modules/accounts before starting an expensive export. */
export function isAndroidSavedCacheKey(key: unknown, session: AndroidOfflineSession): boolean {
  if (typeof key !== 'string' || session.role === 'Parent') return false;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools';
  const suffix = circumferenceCacheSuffix(session.accountId);
  if (session.grants.dutyService && session.grants.dutyServiceCacheName && key === `${projectId}::${session.grants.dutyServiceCacheName}::${[session.accountId, session.role].map(encodeURIComponent).join(':')}${suffix}`) return true;
  if (key === `${projectId}::pupils::user:${session.accountId}${suffix}`) return isAndroidSavedDataQuery(['pupils'], session);
  const scope = [projectId, session.accountId, session.role].map(encodeURIComponent).join(':') + suffix;
  for (const root of ['classes', 'academic-years', 'staff', 'subjects']) {
    if (key === `${root}:${scope}`) return isAndroidSavedDataQuery([root], session);
  }
  const eventScope = session.grants.eventCacheScope || [projectId, session.accountId, session.role, 'school'].map(encodeURIComponent).join(':') + suffix;
  if (session.grants.events && (key === `events:${eventScope}` || key === `legacy-exam-events:${eventScope}`)) return true;
  const timetableScope = [projectId, session.accountId, session.role, 'school'].map(encodeURIComponent).join(':') + suffix;
  return key.startsWith(`timetable:${encodeURIComponent(timetableScope)}:`) && session.grants.timetable;
}

/** Compare source revisions/timestamps instead of serializing every private record twice. */
export function androidSnapshotRevision(snapshot: AndroidOfflineSnapshot): string {
  return JSON.stringify(Object.entries(snapshot.datasets).map(([name, dataset]) => {
    if (name === 'parent') {
      const parent = snapshot.datasets.parent!.data;
      return [name, dataset.preparedAt, parent.family.preparedAt,
        ...[parent.fees, parent.banking, parent.attendance, parent.results].map(records =>
          records.map(record => [record.pupilId, record.preparedAt]))];
    }
    if (name === 'timetables') {
      return [name, dataset.preparedAt, dataset.revision,
        snapshot.datasets.timetables!.data.map(table => [table.profile.id, table.complete])];
    }
    return [name, dataset.preparedAt, dataset.revision];
  }));
}
