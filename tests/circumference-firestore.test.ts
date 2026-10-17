import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as scopes from '../src/lib/access/circumference';
import * as registry from '../src/lib/access/scoped-collections';
import * as session from '../src/lib/access/circumference-session';
import * as profile from '../src/lib/access/session-profile';

function fixture(scope = scopes.ALL_CIRCUMFERENCE) {
  session.setCircumferenceUser({id: 'staff', role: 'Staff', circumference: scope} as any);
  const requests: any[] = [], subscriptions: any[] = [];
  let nativeReads = 0;
  let records: any[] = [];
  let beforeResponse: (() => void) | undefined;
  const documentId = {isEqual: (other: unknown) => other === documentId};
  const collection = (_db: any, path: string) => ({type: 'collection', path, firestore: {}});
  const doc = (base: any, path: string) => ({type: 'document', id: path, path: `${base.path}/${path}`, parent: base, firestore: {}});
  const snapshot = (rows: any[]) => ({docs: rows.map(value => ({id: value.id, data: () => value})), metadata: {fromCache: true}});
  const sdk = {
    collection, doc, documentId: () => documentId, Timestamp: {fromMillis: (milliseconds: number) => ({toMillis: () => milliseconds, toDate: () => new Date(milliseconds)})},
    query: (base: any, ...constraints: any[]) => ({...base, type: 'query', constraints}),
    where: (field: any, op: string, value: any) => ({field, op, value}),
    orderBy: (field: any, direction: string) => ({field, direction}), limit: (count: number) => ({count}),
    getDocs: async () => {nativeReads++; return snapshot(records);},
    getDocsFromServer: async () => {nativeReads++; return snapshot(records);},
    getDocFromServer: async () => {nativeReads++; return {exists: () => false};},
    getDocsFromCache: async () => snapshot(records),
    onSnapshot: (ref: any, _options: any, next: any) => {
      const subscription = {ref, next, stopped: false}; subscriptions.push(subscription);
      return () => {subscription.stopped = true;};
    },
  };
  const source = ts.transpileModule(fs.readFileSync('src/lib/access/scoped-firestore.ts', 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText;
  const module = {exports: {} as any};
  vm.runInNewContext(source, {module, exports: module.exports, Date, Map, WeakMap, Set, queueMicrotask, setTimeout, clearTimeout,
    fetch: async (_url: string, init: any) => {requests.push(JSON.parse(init.body)); beforeResponse?.(); return {ok: true, json: async () => ({records})};},
    require(name: string) {
      if (name === 'firebase/firestore') return sdk;
      if (name === './circumference') return scopes;
      if (name === './circumference-session') return session;
      if (name === './session-profile') return profile;
      if (name === './scoped-collections') return registry;
      if (name === '@/lib/firebase') return {auth: {currentUser: {uid: 'staff', getIdToken: async () => 'signed-token'}}};
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return {boundary: module.exports, requests, subscriptions, nativeReads: () => nativeReads,
    setRecords: (items: any[]) => {records = items;}, beforeResponse: (callback: () => void) => {beforeResponse = callback;}};
}
test('Scoped list and direct document reads use the authenticated boundary without a native broad read', async () => {
  const f = fixture({...scopes.ALL_CIRCUMFERENCE, classIds: ['p4']});
  f.setRecords([{id: 'girl', pupilId: 'girl', amount: 100}]);
  const b = f.boundary, ref = b.query(b.collection({}, 'payments'), b.where('pupilId', '==', 'girl'), b.orderBy('paymentDate', 'desc'), b.limit(5));
  const result = await b.getDocs(ref);
  assert.equal(result.docs[0].id, 'girl');
  assert.equal(f.nativeReads(), 0);
  assert.equal(f.requests[0].filters[0].field, 'pupilId');
  assert.equal(f.requests[0].limit, 5);
  await b.getDoc(b.doc(b.collection({}, 'pupils'), 'girl'));
  assert.equal(f.requests[1].id, 'girl');
  session.setCircumferenceUser(null);
});
test('Pupil live subscriptions constrain every query by class, section and gender before fetching', () => {
  const f = fixture({classIds: ['p4', 'p5'], sections: ['Boarding'], genders: ['Female']});
  const b = f.boundary;
  const stop = b.onSnapshot(b.query(b.collection({}, 'pupils'), b.where('status', '==', 'Active')), () => {});
  assert.equal(f.subscriptions.length, 2);
  f.subscriptions.forEach(({ref}) => {
    const fields = Object.fromEntries(ref.constraints.map((filter: any) => [filter.field, filter.value]));
    assert.equal(fields.section, 'Boarding'); assert.equal(fields.gender, 'Female'); assert.equal(fields.status, 'Active');
    assert(['p4', 'p5'].includes(fields.classId));
  });
  stop(); assert(f.subscriptions.every(item => item.stopped));
  session.setCircumferenceUser(null);
});
test('Empty scope and conflicting caller filters issue no live database read', async () => {
  const f = fixture({...scopes.ALL_CIRCUMFERENCE, classIds: []});
  const b = f.boundary;
  let count = -1;
  const stop = b.onSnapshot(b.collection({}, 'pupils'), (snapshot: any) => {count = snapshot.size;});
  await new Promise(resolve => queueMicrotask(resolve));
  assert.equal(count, 0); assert.equal(f.subscriptions.length, 0); stop();
  session.setCircumferenceUser({id: 'staff', role: 'Staff', circumference: {...scopes.ALL_CIRCUMFERENCE, classIds: ['p4']}} as any);
  const stopConflict = b.onSnapshot(b.query(b.collection({}, 'pupils'), b.where('classId', '==', 'nursery')), () => {});
  assert.equal(f.subscriptions.length, 0); stopConflict();
  session.setCircumferenceUser(null);
});
test('Cached pupils from a broader previous scope cannot reappear or trigger a network read', async () => {
  const f = fixture({classIds: ['p4'], sections: ['Boarding'], genders: ['Female']});
  f.setRecords([{id: 'girl', classId: 'p4', section: 'Boarding', gender: 'Female'}, {id: 'boy', classId: 'p4', section: 'Boarding', gender: 'Male'}, {id: 'day', classId: 'p4', section: 'Day', gender: 'Female'}]);
  const result = await f.boundary.getDocsFromCache(f.boundary.collection({}, 'pupils'));
  assert.deepEqual(Array.from(result.docs, (doc: any) => doc.id), ['girl']);
  assert.equal(f.requests.length, 0); assert.equal(f.nativeReads(), 0);
  session.setCircumferenceUser(null);
});
test('Late responses after a scope or account change are rejected', async () => {
  const f = fixture({...scopes.ALL_CIRCUMFERENCE, classIds: ['p4']});
  f.beforeResponse(() => session.setCircumferenceUser({id: 'staff', role: 'Staff', circumference: {...scopes.ALL_CIRCUMFERENCE, classIds: ['p5']}} as any));
  await assert.rejects(f.boundary.getDocs(f.boundary.collection({}, 'payments')), /scope changed/);
  session.setCircumferenceUser(null);
});
test('Nested timetable paths and timestamp filters retain their actual collection and field types', async () => {
  const f = fixture({...scopes.ALL_CIRCUMFERENCE, classIds: ['p4']});
  const b = f.boundary, path = 'academicYears/y/terms/t/timetables/table/entries';
  await b.getDocs(b.query(b.collection({}, path), b.where('createdAt', '>=', new Date('2026-01-01'))));
  assert.equal(f.requests[0].collection, path);
  assert.equal(f.requests[0].filters[0].value.timestampMillis, Date.parse('2026-01-01'));
  const stop = b.onSnapshot(b.doc(b.collection({}, path), 'row'), () => {}); stop();
  session.setCircumferenceUser(null);
});
test('Unrestricted reads preserve native SDK behavior including custom FieldPath and server reads', async () => {
  const f = fixture(); const b = f.boundary;
  const custom = {isEqual: () => false};
  assert.doesNotThrow(() => b.where(custom, '==', 'value'));
  await b.getDocs(b.collection({}, 'payments'));
  await b.getDocFromServer(b.doc(b.collection({}, 'pupils'), 'girl'));
  assert.equal(f.nativeReads(), 2); assert.equal(f.requests.length, 0);
  session.setCircumferenceUser(null);
});

test('live partitioned pupil queries apply ordering and limit across the complete allowed set', () => {
  const f = fixture({...scopes.ALL_CIRCUMFERENCE, classIds: ['p4', 'p5']});
  const b = f.boundary, results: any[] = [];
  const stop = b.onSnapshot(b.query(b.collection({}, 'pupils'), b.orderBy('lastName'), b.limit(2)), (snapshot: any) => results.push(snapshot.docs.map((doc: any) => doc.id)));
  const rows = (items: any[]) => ({docs: items.map(data => ({id: data.id, data: () => data, get: (field: string) => data[field]})), metadata: {fromCache: false}});
  f.subscriptions[0].next(rows([{id: 'z', lastName: 'Zed'}, {id: 'b', lastName: 'Bee'}]));
  assert.equal(results.length, 0);
  f.subscriptions[1].next(rows([{id: 'a', lastName: 'Aye'}, {id: 'd', lastName: 'Dee'}]));
  assert.deepEqual(JSON.parse(JSON.stringify(results[0])), ['a', 'b']);
  session.setCircumferenceUser({...session.getCircumferenceUser(), circumference: {...scopes.ALL_CIRCUMFERENCE, classIds: ['p6']}} as any);
  f.subscriptions[1].next(rows([{id: 'hidden', lastName: 'AAA'}]));
  assert.equal(results.length, 1);
  stop(); session.setCircumferenceUser(null);
});

test('scoped snapshots preserve Firestore timestamp methods for existing date consumers', async () => {
  const f = fixture({...scopes.ALL_CIRCUMFERENCE, classIds: ['p4']});
  f.setRecords([{id: 'a', createdAt: {__firestoreTimestampMillis: 123456789}}]);
  const snapshot = await f.boundary.getDocs(f.boundary.collection({}, 'pupils'));
  assert.equal(snapshot.docs[0].data().createdAt.toMillis(), 123456789);
  assert.equal(snapshot.docs[0].data().createdAt.toDate().getTime(), 123456789);
  session.setCircumferenceUser(null);
});
