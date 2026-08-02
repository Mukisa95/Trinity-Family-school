export type NotificationDestinationId =
  | 'dashboard'
  | 'pupils'
  | 'pupil-profile'
  | 'pupil-fees'
  | 'classes'
  | 'class-detail'
  | 'attendance'
  | 'attendance-report'
  | 'fees-collection'
  | 'fees-analytics'
  | 'exams'
  | 'staff'
  | 'events'
  | 'timetable';

export type NotificationDestinationEntity = 'pupil' | 'class';

export type NotificationDestinationSelection = {
  id: NotificationDestinationId;
  entityId?: string;
  entityLabel?: string;
  displayLabel?: string;
  filters?: Record<string, string>;
};

export type ResolvedNotificationDestination = NotificationDestinationSelection & {
  label: string;
  url: string;
};

export type NotificationDestinationDefinition = {
  id: NotificationDestinationId;
  label: string;
  description: string;
  category: 'Overview' | 'Pupils' | 'Attendance' | 'Finance' | 'Academics';
  entity?: NotificationDestinationEntity;
  filterKeys?: readonly string[];
  path: string;
};

export const NOTIFICATION_DESTINATIONS: readonly NotificationDestinationDefinition[] = [
  { id: 'dashboard', label: 'Dashboard', description: 'Open the school dashboard', category: 'Overview', path: '/' },
  { id: 'timetable', label: 'Timetable', description: 'Open the school timetable', category: 'Overview', path: '/timetable' },
  { id: 'events', label: 'Events & Calendar', description: 'Open events and calendar', category: 'Overview', path: '/events' },
  { id: 'pupils', label: 'Pupils', description: 'Open a filtered pupil list', category: 'Pupils', filterKeys: ['q', 'classId', 'gender', 'status', 'section'], path: '/pupils' },
  { id: 'pupil-profile', label: 'Pupil Profile', description: 'Open one pupil’s full profile', category: 'Pupils', entity: 'pupil', path: '/pupil-detail' },
  { id: 'pupil-fees', label: 'Pupil Fees Collection', description: 'Open one pupil’s fees account', category: 'Finance', entity: 'pupil', path: '/fees/collect' },
  { id: 'classes', label: 'Classes', description: 'Open classes', category: 'Academics', path: '/classes' },
  { id: 'class-detail', label: 'Class Details', description: 'Open one class', category: 'Academics', entity: 'class', path: '/class-detail' },
  { id: 'attendance', label: 'Attendance', description: 'Open the attendance hub', category: 'Attendance', path: '/attendance' },
  { id: 'attendance-report', label: 'Attendance Report', description: 'Open a filtered attendance report', category: 'Attendance', filterKeys: ['reportType', 'classId', 'pupilId', 'date', 'trendPeriod', 'startDate', 'endDate', 'academicYearId', 'termId'], path: '/attendance/view' },
  { id: 'fees-collection', label: 'Fees Collection', description: 'Open a filtered fee collection list', category: 'Finance', filterKeys: ['q', 'classId', 'section', 'status', 'balanceStatus', 'year', 'term'], path: '/fees/collection' },
  { id: 'fees-analytics', label: 'Fee Collection Analytics', description: 'Open fee collection analytics', category: 'Finance', path: '/fees/analytics' },
  { id: 'exams', label: 'Exams', description: 'Open examinations', category: 'Academics', path: '/exams' },
  { id: 'staff', label: 'Staff', description: 'Open staff', category: 'Academics', path: '/staff' },
] as const;

export function getNotificationDestination(id: string | undefined) {
  return NOTIFICATION_DESTINATIONS.find(destination => destination.id === id);
}

function cleanValue(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, 160);
}

function addAllowedFilters(params: URLSearchParams, destination: NotificationDestinationDefinition, filters?: Record<string, string>) {
  if (!filters || !destination.filterKeys) return;
  destination.filterKeys.forEach(key => {
    const value = cleanValue(filters[key]);
    if (value) params.set(key, value);
  });
}

export function resolveNotificationDestination(selection: NotificationDestinationSelection): ResolvedNotificationDestination {
  const destination = getNotificationDestination(selection.id);
  if (!destination) throw new Error('Choose a valid application destination.');

  const entityId = cleanValue(selection.entityId);
  if (destination.entity && !entityId) {
    throw new Error(`Choose a ${destination.entity} before sending this notification.`);
  }

  const params = new URLSearchParams();
  addAllowedFilters(params, destination, selection.filters);

  if (destination.id === 'pupil-profile') params.set('id', entityId);
  if (destination.id === 'class-detail') params.set('id', entityId);

  const url = destination.id === 'pupil-fees'
    ? `${destination.path}/${encodeURIComponent(entityId)}`
    : `${destination.path}${params.size ? `?${params.toString()}` : ''}`;

  const entityLabel = cleanValue(selection.entityLabel);
  const displayLabel = cleanValue(selection.displayLabel);
  return {
    id: destination.id,
    label: entityLabel
      ? `${destination.label} · ${entityLabel}`
      : displayLabel
        ? `${destination.label} · ${displayLabel}`
        : destination.label,
    entityId: entityId || undefined,
    entityLabel: entityLabel || undefined,
    displayLabel: displayLabel || undefined,
    filters: selection.filters,
    url,
  };
}

/** Backward-compatible guard for older callers that still send a raw internal path. */
export function normalizeInternalNotificationUrl(value: unknown) {
  const raw = cleanValue(value) || '/';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    throw new Error('Notification links must point to a page inside Trinity Family School.');
  }
  const parsed = new URL(raw, 'https://trinity.local');
  if (parsed.origin !== 'https://trinity.local') {
    throw new Error('Notification links must point to a page inside Trinity Family School.');
  }
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
