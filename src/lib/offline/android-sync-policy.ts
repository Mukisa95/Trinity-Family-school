import type { QueryKey } from '@tanstack/react-query';
import type { AndroidOfflineSession, AndroidOfflineSnapshot } from './android-contracts';

/** Parent exports are driven by repository writes, not unrelated query success. */
export function isAndroidSavedDataQuery(key: QueryKey, session: AndroidOfflineSession): boolean {
  if (session.role === 'Parent') return false;
  const root = String(key[0] || '');
  if (root === 'pupils') return session.grants.pupils || session.grants.dashboard;
  if (['classes', 'academicYears', 'academic-years'].includes(root)) {
    return session.grants.pupils || session.grants.dashboard || session.grants.timetable;
  }
  if (root === 'staff') return session.grants.dashboard || session.grants.timetable;
  return ['subjects', 'timetable', 'timetables'].includes(root) && session.grants.timetable;
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
