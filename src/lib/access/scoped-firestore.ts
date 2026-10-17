/**
 * Browser read boundary. Existing unrestricted/parent flows retain the SDK.
 * Scoped pupils use constrained live queries; records needing pupil joins or
 * projections use the authenticated server boundary. Never retry unscoped.
 */
import * as sdk from 'firebase/firestore';
import { circumferenceOf, hasCircumference, permitsClass, permitsPupil, projectExamResult, scopeFilters } from './circumference';
import { circumferencePupil, getCircumferenceUser } from './circumference-session';
import { sessionAccessKey } from './session-profile';
import { isCircumferenceCollection, circumferenceCollectionKind } from './scoped-collections';
export * from 'firebase/firestore';

type Metadata = { base: sdk.Query; collection: string; constraints: sdk.QueryConstraint[] };
const queries = new WeakMap<object, Metadata>();
const filters = new WeakMap<object, { field: string; op: string; value: any }>();
const orders = new WeakMap<object, { field: string; direction: 'asc' | 'desc' }>();
const limits = new WeakMap<object, number>();
const fieldName = (field: string | sdk.FieldPath) => typeof field === 'string' ? field : field.isEqual(sdk.documentId()) ? '__name__' : undefined;
export const collection: typeof sdk.collection = ((...args: any[]) => {
  const ref = (sdk.collection as any)(...args);
  queries.set(ref, { base: ref, collection: ref.path, constraints: [] });
  return ref;
}) as typeof sdk.collection;
export const query: typeof sdk.query = ((base: sdk.Query, ...constraints: sdk.QueryConstraint[]) => {
  const result = (sdk.query as any)(base, ...constraints);
  const previous = queries.get(base);
  if (previous) queries.set(result, { ...previous, constraints: [...previous.constraints, ...constraints] });
  return result;
}) as typeof sdk.query;
export const where: typeof sdk.where = ((field: string | sdk.FieldPath, op: sdk.WhereFilterOp, value: any) => {
  const result = sdk.where(field, op, value);
  const name = fieldName(field);
  if (name) filters.set(result, { field: name, op, value });
  return result;
}) as typeof sdk.where;
export const orderBy: typeof sdk.orderBy = ((field: string | sdk.FieldPath, direction: 'asc' | 'desc' = 'asc') => {
  const result = sdk.orderBy(field, direction), name = fieldName(field);
  if (name) orders.set(result, { field: name, direction }); return result;
}) as typeof sdk.orderBy;
export const limit: typeof sdk.limit = ((count: number) => { const result = sdk.limit(count); limits.set(result, count); return result; }) as typeof sdk.limit;
function metadata(ref: any): Metadata | null {
  return queries.get(ref) || (ref.type === 'collection' ? { base: ref, collection: ref.path, constraints: [] } : null);
}
function needsScope(name?: string) { return !!name && hasCircumference(getCircumferenceUser()) && isCircumferenceCollection(name); }
function identity() { return sessionAccessKey(getCircumferenceUser()); }
function wireValue(value: any): any {
  if (value instanceof Date) return {timestampMillis: value.getTime()};
  if (value?.toMillis instanceof Function) return {timestampMillis: value.toMillis()};
  if (Array.isArray(value)) return value.map(wireValue);
  return value;
}
async function requestRecords(input: any): Promise<any[]> {
  const actor = getCircumferenceUser(), currentIdentity = identity();
  const { auth } = await import('@/lib/firebase');
  if (!actor || auth.currentUser?.uid !== actor.id) throw new Error('Please sign in again.');
  const token = await auth.currentUser.getIdToken();
  const response = await fetch('/api/access/circumference', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({...input, filters: input.filters?.map((filter: any) => ({...filter, value: wireValue(filter.value)}))}), cache: 'no-store' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not load your scoped data.');
  if (identity() !== currentIdentity) throw new Error('Your access scope changed while data was loading.');
  return result.records.map(restoreFirestoreValues);
}
function inputFor(meta: Metadata) {
  const known = meta.constraints.every(item => filters.has(item) || orders.has(item) || limits.has(item));
  if (!known) throw new Error('This scoped query requires supported filters and ordering.');
  return { collection: meta.collection, filters: meta.constraints.flatMap(item => filters.has(item) ? [filters.get(item)!] : []),
    order: meta.constraints.flatMap(item => orders.has(item) ? [orders.get(item)!] : []),
    limit: meta.constraints.map(item => limits.get(item)).find(value => value !== undefined) };
}
function restoreFirestoreValues(value: any): any {
  if (value && typeof value === 'object' && Object.keys(value).length === 1 && typeof value.__firestoreTimestampMillis === 'number') return sdk.Timestamp.fromMillis(value.__firestoreTimestampMillis);
  if (Array.isArray(value)) return value.map(restoreFirestoreValues);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, restoreFirestoreValues(item)]));
  return value;
}
function snapshotDoc(base: sdk.Query | sdk.DocumentReference, value?: any, id?: string): any {
  const ref = base.type === 'document' ? base : sdk.doc(sdk.collection(base.firestore, (metadata(base)?.collection || 'pupils')), value?.id || id!);
  return { id: ref.id, ref, metadata: { fromCache: false, hasPendingWrites: false }, exists: () => value !== undefined,
    data: () => value === undefined ? undefined : { ...value }, get: (field: string) => field.split('.').reduce((item, key) => item?.[key], value) };
}
function snapshotQuery(ref: sdk.Query, docs: any[], previous: any[] = [], fromCache = false): any {
  const before = new Map(previous.map(document => [document.id, document]));
  const after = new Map(docs.map(document => [document.id, document]));
  const changes = [...previous.filter(document => !after.has(document.id)).map(document => ({ type: 'removed', doc: document, oldIndex: previous.indexOf(document), newIndex: -1 })),
    ...docs.flatMap((document, index) => !before.has(document.id) ? [{ type: 'added', doc: document, oldIndex: -1, newIndex: index }] : JSON.stringify(before.get(document.id).data()) !== JSON.stringify(document.data()) ? [{ type: 'modified', doc: document, oldIndex: previous.findIndex(item => item.id === document.id), newIndex: index }] : [])];
  return { docs, size: docs.length, empty: docs.length === 0, query: ref, metadata: { fromCache, hasPendingWrites: false },
    docChanges: () => changes, forEach: (callback: any) => docs.forEach(callback) };
}
async function scopedDocs(ref: sdk.Query) {
  const meta = metadata(ref);
  if (!meta || !needsScope(meta.collection)) return null;
  return (await requestRecords(inputFor(meta))).map(value => snapshotDoc(ref, value));
}
export const getDocs: typeof sdk.getDocs = (async (ref: sdk.Query) => {
  const docs = await scopedDocs(ref); return docs ? snapshotQuery(ref, docs) : sdk.getDocs(ref);
}) as typeof sdk.getDocs;
export const getDocsFromServer: typeof sdk.getDocsFromServer = (async (ref: sdk.Query) => {
  const docs = await scopedDocs(ref); return docs ? snapshotQuery(ref, docs) : sdk.getDocsFromServer(ref);
}) as typeof sdk.getDocsFromServer;
export const getDoc: typeof sdk.getDoc = (async (ref: sdk.DocumentReference) => {
  const name = ref.type === 'document' ? ref.parent.path : ref.path;
  if (!needsScope(name)) return sdk.getDoc(ref);
  const [value] = await requestRecords({ collection: name, id: ref.id }); return snapshotDoc(ref, value);
}) as typeof sdk.getDoc;
export const getDocFromServer: typeof sdk.getDocFromServer = (async (ref: sdk.DocumentReference) => {
  return needsScope(ref.parent.path) ? getDoc(ref) : sdk.getDocFromServer(ref);
}) as typeof sdk.getDocFromServer;
function allowedCache(path: string, id: string, data: any): any {
  const name = circumferenceCollectionKind(path);
  const scope = circumferenceOf(getCircumferenceUser());
  if (name === 'pupils') return permitsPupil(scope, data) ? data : undefined;
  if (name === 'timetableProfiles') {
    const classIds = (data.classIds || []).filter((classId: string) => permitsClass(scope, classId));
    return scope.classIds !== null && !classIds.length ? undefined : {...data, classIds, streamLayouts: Object.fromEntries(Object.entries(data.streamLayouts || {}).filter(([classId]) => permitsClass(scope, classId)))};
  }
  if (name === 'classes') return permitsClass(scope, id) ? data : undefined;
  if (name === 'exams' || name === 'timetableEntries') return permitsClass(scope, data.classId) ? data : undefined;
  if (name === 'examResults') {
    if (!permitsClass(scope, data.classId)) return undefined;
    const ids = new Set<string>((data.pupilSnapshots || []).map((pupil: any) => pupil.pupilId || pupil.id).filter((pupilId: string) => !!circumferencePupil(pupilId)));
    return projectExamResult(data, ids);
  }
  return data.pupilId && circumferencePupil(data.pupilId) ? data : undefined;
}
export const getDocFromCache: typeof sdk.getDocFromCache = (async (ref: sdk.DocumentReference) => {
  const snapshot = await sdk.getDocFromCache(ref), name = ref.type === 'document' ? ref.parent.path : ref.path;
  if (!needsScope(name) || !snapshot.exists()) return snapshot;
  return snapshotDoc(ref, allowedCache(name, ref.id, snapshot.data()));
}) as typeof sdk.getDocFromCache;
export const getDocsFromCache: typeof sdk.getDocsFromCache = (async (ref: sdk.Query) => {
  const snapshot = await sdk.getDocsFromCache(ref), meta = metadata(ref);
  if (!meta || !needsScope(meta.collection)) return snapshot;
  return snapshotQuery(ref, snapshot.docs.flatMap(document => { const value = allowedCache(meta.collection, document.id, document.data()); return value ? [snapshotDoc(ref, { ...value, id: document.id })] : []; }), [], true);
}) as typeof sdk.getDocsFromCache;

export const onSnapshot: typeof sdk.onSnapshot = ((ref: any, ...args: any[]) => {
  const meta = metadata(ref), name = meta?.collection || ref.parent?.path || ref.path;
  if (!needsScope(name)) return (sdk.onSnapshot as any)(ref, ...args);
  const callback = args.find(item => typeof item === 'function') || args.find(item => item?.next)?.next;
  const failure = args.filter(item => typeof item === 'function')[1] || args.find(item => item?.error)?.error;
  let disposed = false, timer: ReturnType<typeof setTimeout> | undefined, previous: any[] = [];
  const captured = identity();
  const next = (value: any) => { if (!disposed && captured === identity()) callback?.(value); };
  // Retain genuine live pupil updates, with a query for each permitted partition.
  if (meta && name === 'pupils') {
    inputFor(meta); // Reject unsupported predicates instead of losing their semantics.
    const snapshots = new Map<number, any>(), plans = scopeFilters(circumferenceOf(getCircumferenceUser()));
    const unsubscribers: Array<() => void> = [];
    if (!plans.length) queueMicrotask(() => next(snapshotQuery(ref, [])));
    else plans.forEach((plan, index) => {
      const descriptors = [...meta.constraints.flatMap(item => filters.has(item) ? [filters.get(item)!] : []), ...plan];
      const selected = new Map<string, any[]>();
      for (const filter of descriptors.filter(item => item.op === '==' || item.op === 'in')) {
        const values = filter.op === 'in' ? filter.value : [filter.value], before = selected.get(filter.field);
        selected.set(filter.field, before ? before.filter(value => values.includes(value)) : values);
      }
      if ([...selected.values()].some(values => !values.length)) { snapshots.set(index, { docs: [], metadata: { fromCache: false } }); return; }
      const constraints = [...meta.constraints.filter(item => !orders.has(item) && !limits.has(item) && (!filters.has(item) || !['==', 'in'].includes(filters.get(item)!.op))),
        ...[...selected].map(([field, values]) => sdk.where(field === '__name__' ? sdk.documentId() : field, values.length === 1 ? '==' : 'in', values.length === 1 ? values[0] : values))];
      unsubscribers.push(sdk.onSnapshot(sdk.query(meta.base, ...constraints), { includeMetadataChanges: true }, snapshot => {
        snapshots.set(index, snapshot);
        if (snapshots.size !== plans.length) return;
        let docs = [...new Map([...snapshots.values()].flatMap(item => item.docs).map((document: any) => [document.id, document])).values()];
        const sorting = meta.constraints.flatMap(item => orders.has(item) ? [orders.get(item)!] : []);
        if (sorting.length) docs = docs.filter((doc: any) => sorting.every(order => order.field === '__name__' || doc.get(order.field) !== undefined));
        if (sorting.length) docs.sort((a: any, b: any) => {
          for (const order of sorting) {
            const av = order.field === '__name__' ? a.id : a.get(order.field), bv = order.field === '__name__' ? b.id : b.get(order.field);
            if (av !== bv) return (av < bv ? -1 : 1) * (order.direction === 'desc' ? -1 : 1);
          }
          return a.id.localeCompare(b.id);
        });
        const maximum = meta.constraints.map(item => limits.get(item)).find(count => count !== undefined);
        if (maximum !== undefined) docs = docs.slice(0, maximum);
        next(snapshotQuery(ref, docs, previous, [...snapshots.values()].some(item => item.metadata.fromCache)));
        previous = docs;
      }, error => { if (!disposed) failure?.(error); }));
    });
    if (snapshots.size === plans.length && !unsubscribers.length) queueMicrotask(() => next(snapshotQuery(ref, [])));
    return () => { disposed = true; unsubscribers.forEach(stop => stop()); };
  }
  // Joining pupil-owned legacy records and projecting mixed exam documents is
  // server-only; poll only while the existing consumer remains subscribed.
  const load = async () => {
    try {
      const value = meta ? await getDocs(ref) : await getDoc(ref);
      if (meta) { const docs = (value as sdk.QuerySnapshot).docs; next(snapshotQuery(ref, docs, previous)); previous = docs; }
      else next(value);
    } catch (error) { if (!disposed) failure?.(error); }
    if (!disposed && captured === identity()) timer = setTimeout(load, 15000);
  };
  void load();
  return () => { disposed = true; if (timer) clearTimeout(timer); };
}) as typeof sdk.onSnapshot;
