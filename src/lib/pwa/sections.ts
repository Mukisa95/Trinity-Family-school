import type { AndroidOfflineSession, AndroidOfflineSnapshot } from '@/lib/offline/android-contracts';

export type OfflineSection = { label: string; path: string; saved: boolean; preparedAt?: string };
export function offlineSections(session: AndroidOfflineSession, snapshot?: AndroidOfflineSnapshot): OfflineSection[] {
  const datasets = snapshot?.datasets;
  if (session.role === 'Parent') return [{ label: 'Parent workspace', path: '/parent', saved: !!datasets?.parent, preparedAt: datasets?.parent?.preparedAt }];
  return [
    ...(session.grants.dashboard ? [{ label: 'Dashboard', path: '/', saved: !!datasets?.dashboard, preparedAt: datasets?.dashboard?.preparedAt }] : []),
    ...(session.grants.pupils ? [{ label: 'Pupils', path: '/pupils', saved: !!datasets?.pupils, preparedAt: datasets?.pupils?.preparedAt }] : []),
    ...(session.grants.timetable ? [{ label: 'Timetable', path: '/timetable', saved: !!datasets?.timetables && datasets.timetables.data.every(table => table.complete), preparedAt: datasets?.timetables?.preparedAt }] : []),
    ...(session.grants.dutyService ? [{ label: 'Duty & Service', path: '/duty-service', saved: !!datasets?.dutyService, preparedAt: datasets?.dutyService?.preparedAt }] : []),
    ...(session.grants.events ? [{ label: 'Calendar and events', path: '/events', saved: !!datasets?.events, preparedAt: datasets?.events?.preparedAt }] : []),
  ];
}
