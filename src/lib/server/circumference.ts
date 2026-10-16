import { FieldPath, getFirestore, type Query, type DocumentData } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import type { AuthenticatedAppUser } from './app-auth';
import { circumferenceOf, hasCircumference, permitsClass, permitsPupil, scopeFilters, projectExamResult } from '@/lib/access/circumference';
import { PUPIL_COLLECTION_MODULES, circumferenceCollectionKind } from '@/lib/access/scoped-collections';

export class CircumferenceError extends Error {
  constructor(message = 'This record is outside your Circumference.', public readonly status = 403) { super(message); }
}
export type ReadFilter = { field: string; op: FirebaseFirestore.WhereFilterOp; value: any };
export type ScopedRead = { collection: string; id?: string; preserveTimestamps?: boolean; filters?: ReadFilter[]; order?: Array<{ field: string; direction: 'asc' | 'desc' }>; limit?: number };
export function canReadScopedModule(actor: AuthenticatedAppUser, collection: string): boolean {
  if (actor.user.role === 'Admin') return true;
  const modules = PUPIL_COLLECTION_MODULES[circumferenceCollectionKind(collection)] || [];
  return actor.user.role === 'Staff' && modules.some(module => actor.user.modulePermissions?.some(item => item.module === module)
    || actor.user.granularPermissions?.some(item => item.moduleId === module && item.pages.some(page => page.canAccess)));
}
function constraints(base: Query, filters: ReadFilter[]) {
  let query = base;
  const selected = new Map<string, any[]>();
  for (const filter of filters.filter(item => item.op === '==' || item.op === 'in')) {
    const values = filter.op === 'in' ? filter.value : [filter.value];
    const previous = selected.get(filter.field);
    selected.set(filter.field, previous ? previous.filter(value => values.includes(value)) : values);
  }
  if ([...selected.values()].some(values => !values.length)) return null;
  for (const [field, values] of selected) query = query.where(field === '__name__' ? FieldPath.documentId() : field, values.length === 1 ? '==' : 'in', values.length === 1 ? values[0] : values);
  for (const filter of filters.filter(item => item.op !== '==' && item.op !== 'in')) query = query.where(filter.field === '__name__' ? FieldPath.documentId() : filter.field, filter.op, filter.value);
  return query;
}
function normalize(value: any, preserveTimestamps = false): any {
  if (typeof value?.toDate === 'function') return preserveTimestamps ? {__firestoreTimestampMillis: value.toDate().getTime()} : value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(item => normalize(item, preserveTimestamps));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item, preserveTimestamps)]));
  return value;
}
function joinedChunkSize(filters: ReadFilter[], ownerField: string): number {
  const multipliers = new Map<string, number>();
  for (const filter of filters) if (filter.field !== ownerField && ['in', 'array-contains-any'].includes(filter.op)) {
    if (!Array.isArray(filter.value) || !filter.value.length) throw new CircumferenceError('Invalid query selection.', 400);
    multipliers.set(filter.field, Math.min(multipliers.get(filter.field) || 30, filter.value.length));
  }
  const combinations = [...multipliers.values()].reduce((total, count) => total * count, 1);
  if (combinations > 30) throw new CircumferenceError('Reduce the number of simultaneous query selections.', 400);
  return Math.max(1, Math.floor(30 / combinations));
}
export async function scopedPupils(actor: AuthenticatedAppUser, ids?: string[]) {
  const db = getFirestore(getFirebaseAdminApp()), scope = circumferenceOf(actor.user);
  if (ids?.length === 0) return [];
  const chunks = ids ? Array.from({ length: Math.ceil(ids.length / 30) }, (_, i) => ids.slice(i * 30, i * 30 + 30)) : [null];
  const plans = actor.user.role === 'Parent' ? [[{ field: 'parentAccountId', op: '==' as const, value: actor.user.id }, { field: 'parentAccountActive', op: '==' as const, value: true }]] : scopeFilters(scope);
  const snapshots = await Promise.all(plans.flatMap(plan => chunks.map(chunk => {
    const query = constraints(db.collection('pupils'), [...plan, ...(chunk ? [{ field: '__name__', op: 'in' as const, value: chunk }] : [])]);
    return query ? query.get() : null;
  })));
  return [...new Map(snapshots.flatMap(snapshot => snapshot?.docs || []).map(document => [document.id, { ...normalize(document.data()), id: document.id }])).values()] as any[];
}
export async function requireScopedPupil(actor: AuthenticatedAppUser, pupilId: string, changes?: Record<string, any>) {
  if (typeof pupilId !== 'string' || !pupilId || pupilId.includes('/')) throw new CircumferenceError('Invalid pupil.', 400);
  const [pupil] = await scopedPupils(actor, [pupilId]);
  if (!pupil || changes && !permitsPupil(circumferenceOf(actor.user), { ...pupil, ...changes })) throw new CircumferenceError();
  return pupil;
}
export function requireScopedClass(actor: AuthenticatedAppUser, classId: string) {
  if (actor.user.role === 'Parent' || !permitsClass(circumferenceOf(actor.user), classId)) throw new CircumferenceError('This class is outside your Circumference.');
}

export async function readWithinCircumference(actor: AuthenticatedAppUser, input: ScopedRead): Promise<any[]> {
  if (!canReadScopedModule(actor, input.collection)) throw new CircumferenceError('You do not have permission to view this module.');
  const db = getFirestore(getFirebaseAdminApp()), scope = circumferenceOf(actor.user);
  const kind = circumferenceCollectionKind(input.collection);
  const caller = [...(input.filters || []), ...(input.id ? [{ field: '__name__', op: '==' as const, value: input.id }] : [])];
  let plans: ReadFilter[][];
  let authorizedIds: Set<string> | undefined;
  if (kind === 'pupils') plans = scopeFilters(scope);
  else if (kind === 'attendanceDailySummaries') {
    authorizedIds = new Set((await scopedPupils(actor)).map(pupil => pupil.id));
    plans = input.id ? [[]] : []; // daily projections require a specific date
  }
  else if (['classes', 'exams', 'examResults', 'resultReleases', 'timetableEntries'].includes(kind)) {
    plans = scope.classIds === null ? [[]] : scope.classIds.map(id => [{ field: kind === 'classes' ? '__name__' : 'classId', op: '==', value: id }]);
    if (kind === 'examResults' || kind === 'resultReleases') authorizedIds = new Set((await scopedPupils(actor)).map(pupil => pupil.id));
  } else if (kind === 'timetableProfiles') {
    plans = scope.classIds === null ? [[]] : scope.classIds.map(id => [{field: 'classIds', op: 'array-contains' as const, value: id}]);
  } else if (kind === 'timetablePeriods') {
    const profile = await db.doc(input.collection.slice(0, -'/periods'.length)).get();
    if (!profile.exists || scope.classIds !== null && !(profile.data()!.classIds || []).some((id: string) => permitsClass(scope, id))) return [];
    plans = [[]];
  } else if (kind === 'dormitories') {
    if (scope.sections !== null && !scope.sections.includes('Boarding')) return [];
    authorizedIds = new Set((await scopedPupils(actor)).filter(pupil => pupil.section === 'Boarding').map(pupil => pupil.id));
    plans = scope.genders === null ? [[]] : scope.genders.map(gender => [{ field: 'gender', op: '==', value: gender }]);
  } else {
    const ownerField = 'pupilId';
    const pupilFilter = caller.find(filter => filter.field === ownerField && ['==', 'in'].includes(filter.op));
    const candidateIds = pupilFilter ? pupilFilter.op === '==' ? [pupilFilter.value] : pupilFilter.value : undefined;
    const pupils = await scopedPupils(actor, candidateIds);
    authorizedIds = new Set(pupils.map(pupil => pupil.id));
    const ids = [...authorizedIds];
    const chunkSize = joinedChunkSize(caller, ownerField);
    plans = Array.from({ length: Math.ceil(ids.length / chunkSize) }, (_, i) => [{ field: ownerField, op: 'in' as const, value: ids.slice(i * chunkSize, i * chunkSize + chunkSize) }]);
  }
  const snapshots = await Promise.all(plans.map(plan => {
    const query = constraints(db.collection(input.collection), [...plan, ...caller]);
    return query ? query.get() : null;
  }));
  let records = [...new Map(snapshots.flatMap(snapshot => snapshot?.docs || []).map(document => [document.id, { ...normalize(document.data(), input.preserveTimestamps), id: document.id }])).values()] as any[];
  if (kind === 'attendanceDailySummaries') records = records.map(record => ({...record, records: (record.records || []).filter((entry: any) => authorizedIds!.has(entry.pupilId))}));
  if (kind === 'examResults') records = records.map(record => projectExamResult(record, authorizedIds!));
  if (kind === 'resultReleases') records = records.map(record => ({ ...record, pupilIds: record.pupilIds?.filter((id: string) => authorizedIds!.has(id)), releasedPupils: record.releasedPupils?.filter((id: string) => authorizedIds!.has(id)) }));
  if (kind === 'timetableProfiles') records = records.map(record => ({...record, classIds: (record.classIds || []).filter((id: string) => permitsClass(scope, id)), streamLayouts: Object.fromEntries(Object.entries(record.streamLayouts || {}).filter(([id]) => permitsClass(scope, id)))}));
  if (kind === 'dormitories') records = records.map(record => ({ ...record, assignedPupilIds: (record.assignedPupilIds || []).filter((id: string) => authorizedIds!.has(id)), inChargePupilIds: (record.inChargePupilIds || []).filter((id: string) => authorizedIds!.has(id)), classIds: (record.classIds || []).filter((id: string) => permitsClass(scope, id)) }));
  const valueAt = (record: DocumentData, field: string) => field === '__name__' ? record.id : field.split('.').reduce((value, part) => value?.[part], record);
  if (input.order?.length) records.sort((a, b) => {
    for (const order of input.order!) {
      const av = valueAt(a, order.field), bv = valueAt(b, order.field);
      const comparison = av === bv ? 0 : av === undefined ? -1 : bv === undefined ? 1 : av < bv ? -1 : 1;
      if (comparison) return order.direction === 'desc' ? -comparison : comparison;
    }
    return a.id.localeCompare(b.id);
  });
  return input.limit ? records.slice(0, input.limit) : records;
}
