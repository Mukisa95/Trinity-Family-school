import type { AndroidOfflineDataset, AndroidOfflineSession, AndroidOfflineSnapshot, AndroidOfflineTimetable } from './android-contracts';
import { projectOfflinePupil } from './android-contracts';
import { readParentOfflineBundle } from '@/lib/parent-offline/repository';
import type { Pupil } from '@/types';
import { persistentCollectionCacheKey, readPersistentCollectionWithMetadata } from '@/lib/cache/persistent-collection-cache';
import { getClassCacheScope, readClassCache } from '@/lib/cache/class-cache';
import { getAcademicYearCacheScope, readAcademicYearCache } from '@/lib/cache/academic-year-cache';
import { getStaffCacheScope, readStaffCache } from '@/lib/cache/staff-cache';
import { getSubjectCacheScope, readSubjectCache } from '@/lib/cache/subject-cache';
import { liteRead, liteReadMetadata } from '@/lib/cache/lite-cache';
import { yieldToInterface } from '@/lib/performance/background-task';
import { projectOfflinePhotos } from './android-photo-projection';

type Cache<T> = { schema: number; revision: number; data: T };
const fields = (value: object, names: string[]) => Object.fromEntries(names.filter(name => name in value).map(name => [name, (value as Record<string, unknown>)[name]]));

/** No network reads: reuse the same authorized caches that feed the PWA. */
export async function exportAndroidCachedSnapshot(session: AndroidOfflineSession, reuse?: { previous: AndroidOfflineSnapshot; pupilsUnchanged: boolean }): Promise<AndroidOfflineSnapshot | null> {
  const capturedAt = new Date().toISOString();
  const result: AndroidOfflineSnapshot = { schema: 1, accountId: session.accountId, role: session.role, capturedAt, datasets: {} };
  if (session.role === 'Parent') {
    const bundle = await readParentOfflineBundle(session.accountId);
    if (!bundle) return null;
    bundle.family.pupils = bundle.family.pupils.filter(pupil => session.pupilIds.includes(pupil.id));
    await projectOfflinePhotos(session.accountId, bundle.family.pupils as unknown as Record<string, unknown>[]);
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
  const previous = reuse?.pupilsUnchanged && reuse.previous.accountId === session.accountId && reuse.previous.role === session.role ? reuse.previous : undefined;
  const pupils = previous ? null : await readPersistentCollectionWithMetadata<Pupil[]>(persistentCollectionCacheKey(projectId, 'pupils', `user:${session.accountId}`));
  const classes = readClassCache(scope);
  const years = readAcademicYearCache(getAcademicYearCacheScope(session.accountId, session.role));
  const staff = readStaffCache(getStaffCacheScope(session.accountId, session.role));
  const subjects = readSubjectCache(getSubjectCacheScope(session.accountId, session.role));
  function saved<T>(data: T, revision?: number, key?: string): AndroidOfflineDataset<T> {
    return { data, revision, preparedAt: key ? new Date(liteReadMetadata(key)?.writtenAt || 0).toISOString() : capturedAt };
  }
  if (session.grants.pupils && previous?.datasets.pupils) result.datasets.pupils = previous.datasets.pupils;
  if (session.grants.pupils && pupils && Array.isArray(pupils.data)) result.datasets.pupils = {
    data: await projectOfflinePhotos(session.accountId, pupils.data.map(pupil => projectOfflinePupil(pupil as unknown as Record<string, unknown>, session))),
    preparedAt: new Date(pupils.writtenAt).toISOString(),
  };
  if (session.grants.pupils || session.grants.timetable || session.grants.dashboard) {
    if (classes) result.datasets.classes = saved(classes.data.map(item => fields(item, ['id', 'name', 'code', 'level', 'order', 'streams'])), classes.revision, `classes:${scope}`);
    if (years) result.datasets.academicYears = saved(years.data.map(item => fields(item, ['id', 'name', 'startDate', 'endDate', 'terms', 'isActive'])), years.revision, `academic-years:${scope}`);
  }
  if (session.grants.dashboard) {
    const counts: Record<string, number> = {};
    if (session.grants.dashboardCounts.includes('pupils') && pupils && Array.isArray(pupils.data)) counts.pupils = pupils.data.filter(item => item.status === 'Active').length;
    if (session.grants.dashboardCounts.includes('pupils') && typeof previous?.datasets.dashboard?.data.pupils === 'number') counts.pupils = previous.datasets.dashboard.data.pupils;
    if (session.grants.dashboardCounts.includes('staff') && staff) counts.staff = staff.data.length;
    if (Object.keys(counts).length) result.datasets.dashboard = saved(counts);
  }
  if (session.grants.timetable) {
    if (subjects) result.datasets.subjects = saved(subjects.data.map(item => fields(item, ['id', 'name', 'code'])), subjects.revision, `subjects:${scope}`);
    if (staff) result.datasets.teachers = saved(staff.data.map(item => fields(item, ['id', 'firstName', 'lastName', 'otherNames'])), staff.revision, `staff:${scope}`);
    // This matches the identity/role/family scope used by the timetable hooks.
    const timetableScope = [projectId, session.accountId, session.role, 'school'].map(encodeURIComponent).join(':');
    const prefix = `timetable:${encodeURIComponent(timetableScope)}:`;
    const tables: AndroidOfflineTimetable[] = [];
    let preparedAt = 0;
    let hasProfiles = false;
    for (let index = 0; index < localStorage.length; index++) {
      const storageKey = localStorage.key(index);
      if (!storageKey?.startsWith(`trinity_lite_${prefix}`)) continue;
      const key = storageKey.slice('trinity_lite_'.length);
      const segments = key.slice(prefix.length).split(':');
      if (segments[2] !== 'profiles') continue;
      const profiles = liteRead<Cache<AndroidOfflineTimetable['profile'][]>>(key);
      if (profiles?.schema !== 2 || !Array.isArray(profiles.data)) continue;
      hasProfiles = true;
      await yieldToInterface();
      for (const profile of profiles.data) {
        const base = `${prefix}${segments[0]}:${segments[1]}:`;
        const periods = liteRead<Cache<AndroidOfflineTimetable['periods']>>(`${base}periods:${encodeURIComponent(profile.id)}`);
        const entries = liteRead<Cache<AndroidOfflineTimetable['entries']>>(`${base}entries:${encodeURIComponent(profile.id)}`);
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
