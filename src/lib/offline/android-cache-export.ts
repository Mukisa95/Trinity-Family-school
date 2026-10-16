import { filterActiveStaff } from '@/lib/utils/staff-status';
import { circumferenceCacheSuffix } from '@/lib/access/circumference-session';
import type { AndroidOfflineDataset, AndroidOfflineSession, AndroidOfflineSnapshot, AndroidOfflineTimetable } from './android-contracts';
import { projectOfflinePupil } from './android-contracts';
import { readEventCache, readLegacyExamEventCache, getEventCacheKey, getLegacyExamEventCacheKey, getEventCacheScope } from '@/lib/cache/event-cache';
import { readParentOfflineBundle } from '@/lib/parent-offline/repository';
import type { Pupil } from '@/types';
import { persistentCollectionCacheKey, readPersistentCollectionWithMetadata } from '@/lib/cache/persistent-collection-cache';
import { getClassCacheScope, readClassCache } from '@/lib/cache/class-cache';
import { getAcademicYearCacheScope, readAcademicYearCache } from '@/lib/cache/academic-year-cache';
import { getStaffCacheScope, readStaffCache } from '@/lib/cache/staff-cache';
import { getSubjectCacheScope, readSubjectCache } from '@/lib/cache/subject-cache';
import { liteRead, liteReadMetadata } from '@/lib/cache/lite-cache';
import { projectOfflinePhotos } from './android-photo-projection';
import { measureWorkspaceOperation } from '@/lib/startup/workspace-timing';
import { projectAndroidRecords, yieldAndroidPreparation } from './android-preparation-work';

type Cache<T> = { schema: number; revision: number; data: T };
type SnapshotReuse = { previous: AndroidOfflineSnapshot; pupilsUnchanged: boolean };
const fields = (value: object, names: string[]) => Object.fromEntries(names.filter(name => name in value).map(name => [name, (value as Record<string, unknown>)[name]]));

/** No network reads: reuse the same authorized caches that feed the PWA. */
export async function exportAndroidCachedSnapshot(session: AndroidOfflineSession, options?: AbortSignal | SnapshotReuse): Promise<AndroidOfflineSnapshot | null> {
  const reuse = options && 'previous' in options ? options : undefined;
  const signal = options && !('previous' in options) ? options : undefined;
  await yieldAndroidPreparation(signal);
  const capturedAt = new Date().toISOString();
  const result: AndroidOfflineSnapshot = { schema: 1, accountId: session.accountId, role: session.role, capturedAt, datasets: {} };
  if (session.role === 'Parent') {
    const bundle = await measureWorkspaceOperation('android:cache-read', () => readParentOfflineBundle(session.accountId));
    if (!bundle) return null;
    bundle.family.pupils = bundle.family.pupils.filter(pupil => session.pupilIds.includes(pupil.id));
    bundle.family.pupils = await projectOfflinePhotos(session.accountId, bundle.family.pupils as unknown as Record<string, unknown>[], signal) as unknown as typeof bundle.family.pupils;
    const ids = new Set(bundle.family.pupils.map(pupil => pupil.id));
    bundle.fees = bundle.fees.filter(record => ids.has(record.pupilId));
    bundle.banking = bundle.banking.filter(record => ids.has(record.pupilId));
    bundle.attendance = bundle.attendance.filter(record => ids.has(record.pupilId));
    bundle.results = bundle.results.filter(record => ids.has(record.pupilId));
    result.datasets.parent = { preparedAt: bundle.family.preparedAt, data: bundle };
    return result;
  }
  const scope = getClassCacheScope(session.accountId, session.role);
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools';
  const previous = reuse?.pupilsUnchanged && !session.circumference && reuse.previous.accountId === session.accountId && reuse.previous.role === session.role ? reuse.previous : undefined;
  const pupils = previous ? null : await measureWorkspaceOperation('android:cache-read', () => readPersistentCollectionWithMetadata<Pupil[]>(persistentCollectionCacheKey(projectId, 'pupils', `user:${session.accountId}${circumferenceCacheSuffix(session.accountId)}`)));
  const classes = readClassCache(scope);
  const years = readAcademicYearCache(getAcademicYearCacheScope(session.accountId, session.role));
  const staff = readStaffCache(getStaffCacheScope(session.accountId, session.role));
  const subjects = readSubjectCache(getSubjectCacheScope(session.accountId, session.role));
  function saved<T>(data: T, revision?: number, key?: string): AndroidOfflineDataset<T> {
    return { data, revision, preparedAt: key ? new Date(liteReadMetadata(key)?.writtenAt || 0).toISOString() : capturedAt };
  }
  if (session.grants.pupils && previous?.datasets.pupils) result.datasets.pupils = previous.datasets.pupils;
  if (session.grants.pupils && pupils && Array.isArray(pupils.data)) result.datasets.pupils = {
    data: await projectOfflinePhotos(session.accountId,
      await measureWorkspaceOperation('android:record-projection', () => projectAndroidRecords(pupils.data.filter(pupil => !session.circumference || session.pupilIds.includes(pupil.id)), pupil => projectOfflinePupil(pupil as unknown as Record<string, unknown>, session), signal)), signal),
    preparedAt: new Date(pupils.writtenAt).toISOString(),
  };
  if (session.grants.pupils || session.grants.timetable || session.grants.dashboard || session.grants.events) {
    if (classes) result.datasets.classes = saved(classes.data.map(item => fields(item, ['id', 'name', 'code', 'level', 'order', 'streams'])), classes.revision, `classes:${scope}`);
    if (years) result.datasets.academicYears = saved(years.data.map(item => fields(item, ['id', 'name', 'startDate', 'endDate', 'terms', 'isActive'])), years.revision, `academic-years:${scope}`);
  }
  if (session.grants.dashboard) {
    const counts: Record<string, number> = {};
    if (session.grants.dashboardCounts.includes('pupils') && pupils && Array.isArray(pupils.data)) counts.pupils = pupils.data.filter(item => item.status === 'Active' && (!session.circumference || session.pupilIds.includes(item.id))).length;
    if (session.grants.dashboardCounts.includes('pupils') && typeof previous?.datasets.dashboard?.data.pupils === 'number') counts.pupils = previous.datasets.dashboard.data.pupils;
    if (session.grants.dashboardCounts.includes('staff') && staff) counts.staff = filterActiveStaff(staff.data).length;
    if (Object.keys(counts).length) result.datasets.dashboard = {
      data: counts, preparedAt: new Date(Math.max(
        pupils?.writtenAt || 0, liteReadMetadata(`staff:${getStaffCacheScope(session.accountId, session.role)}`)?.writtenAt || 0,
      )).toISOString(),
    };
  }
  if (session.grants.events) {
    const eventScope = session.grants.eventCacheScope || getEventCacheScope(session.accountId, session.role as import('@/types').UserRole);
    const events = readEventCache(eventScope);
    const legacy = readLegacyExamEventCache(eventScope);
    if (events) {
      const ids = new Set(events.data.map(event => event.linkedExamId).filter(Boolean));
      const rows = [...events.data, ...(legacy?.data || []).filter(event => !ids.has(event.linkedExamId))];
      const projected = rows.map(event => fields(event, ['id', 'title', 'description', 'type', 'priority', 'status', 'startDate', 'endDate', 'startTime', 'endTime', 'isAllDay', 'location', 'sendReminders', 'requiresApproval', 'approvalStatus', 'approvedBy', 'isExamEvent', 'academicYearId', 'termId', 'classIds', 'subjectIds', 'colorCode'])) as unknown as import('@/types').Event[];
      result.datasets.events = {data: projected, revision: events.revision, preparedAt: new Date(Math.max(liteReadMetadata(getEventCacheKey(eventScope))?.writtenAt || 0, liteReadMetadata(getLegacyExamEventCacheKey(eventScope))?.writtenAt || 0)).toISOString()};
    }
  }
  if (session.grants.timetable) {
    if (subjects) result.datasets.subjects = saved(subjects.data.map(item => fields(item, ['id', 'name', 'code'])), subjects.revision, `subjects:${scope}`);
    if (staff) result.datasets.teachers = saved(staff.data.map(item => fields(item, ['id', 'firstName', 'lastName', 'otherNames'])), staff.revision, `staff:${scope}`);
    // This matches the identity/role/family scope used by the timetable hooks.
    const timetableScope = [projectId, session.accountId, session.role, 'school'].map(encodeURIComponent).join(':') + circumferenceCacheSuffix(session.accountId);
    const prefix = `timetable:${encodeURIComponent(timetableScope)}:`;
    const tables: AndroidOfflineTimetable[] = [];
    let preparedAt = 0;
    let hasProfiles = false;
    for (let index = 0; index < localStorage.length; index++) {
      if (index % 16 === 0) await yieldAndroidPreparation(signal);
      const storageKey = localStorage.key(index);
      if (!storageKey?.startsWith(`trinity_lite_${prefix}`)) continue;
      const key = storageKey.slice('trinity_lite_'.length);
      const segments = key.slice(prefix.length).split(':');
      if (segments[2] !== 'profiles') continue;
      const profiles = liteRead<Cache<AndroidOfflineTimetable['profile'][]>>(key);
      if (profiles?.schema !== 2 || !Array.isArray(profiles.data)) continue;
      hasProfiles = true;
      for (const profile of profiles.data) {
        const base = `${prefix}${segments[0]}:${segments[1]}:`;
        const periods = liteRead<Cache<AndroidOfflineTimetable['periods']>>(`${base}periods:${encodeURIComponent(profile.id)}`);
        const entries = liteRead<Cache<AndroidOfflineTimetable['entries']>>(`${base}entries:${encodeURIComponent(profile.id)}`);
        preparedAt = Math.max(preparedAt,
          liteReadMetadata(`${base}periods:${encodeURIComponent(profile.id)}`)?.writtenAt || 0,
          liteReadMetadata(`${base}entries:${encodeURIComponent(profile.id)}`)?.writtenAt || 0);
        const complete = periods?.schema === 2 && entries?.schema === 2 && Array.isArray(periods.data) && Array.isArray(entries.data)
          && periods.revision === profiles.revision && entries.revision === profiles.revision;
        tables.push({ profile, periods: complete ? periods.data : [], entries: complete ? entries.data : [], complete });
      }
      preparedAt = Math.max(preparedAt, liteReadMetadata(key)?.writtenAt || 0);
    }
    if (hasProfiles) result.datasets.timetables = { data: tables, preparedAt: new Date(preparedAt).toISOString() };
  }
  return Object.keys(result.datasets).length ? result : null;
}
