import { mergeScopedAttendance } from '../src/lib/access/attendance-projection';
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as circumference from '../src/lib/access/circumference';
import * as registry from '../src/lib/access/scoped-collections';
import * as session from '../src/lib/access/circumference-session';

const equal = (value: unknown, expected: unknown) => assert.deepEqual(JSON.parse(JSON.stringify(value)), expected);
function load(file: string, dependencies: Record<string, unknown>, globals = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText;
  const module = {exports: {} as any};
  vm.runInNewContext(compiled, {module, exports: module.exports, console, Date, Set, Map, WeakMap, JSON, queueMicrotask, setTimeout, clearTimeout,
    require(name: string) {if (name in dependencies) return dependencies[name]; throw new Error(`Unexpected dependency: ${name}`);}, ...globals}, {filename: file});
  return module.exports;
}
const pupilData = {
  girl: {classId: 'p4', section: 'Boarding', gender: 'Female'},
  boy: {classId: 'p4', section: 'Boarding', gender: 'Male'},
  day: {classId: 'p4', section: 'Day', gender: 'Female'},
  nursery: {classId: 'n1', section: 'Boarding', gender: 'Female'},
};
const actor = (scope: Partial<circumference.Circumference> = {}) => ({user: {id: 'staff', role: 'Staff', isActive: true,
  circumference: {...circumference.ALL_CIRCUMFERENCE, ...scope}, modulePermissions: [{module: 'fees', permission: 'full_access'}, {module: 'classes', permission: 'full_access'}, {module: 'exams', permission: 'full_access'}, {module: 'boarding', permission: 'full_access'}, {module: 'timetable', permission: 'full_access'}]}} as any);
function serverFixture(extra: Record<string, Record<string, any>> = {}) {
  const documents: Record<string, Record<string, any>> = {
    pupils: pupilData, classes: {p4: {name: 'P4'}, n1: {name: 'Nursery'}},
    payments: Object.fromEntries(Object.keys(pupilData).map(pupilId => [pupilId, {pupilId, amount: 100}])),
    examResults: {mixed: {classId: 'p4', pupilSnapshots: Object.keys(pupilData).map(pupilId => ({pupilId, ...pupilData[pupilId as keyof typeof pupilData]})), results: {girl: {score: 80}, boy: {score: 70}, day: {score: 60}, nursery: {score: 50}}}},
    dormitories: {girls: {gender: 'Female', assignedPupilIds: ['girl', 'day', 'nursery'], inChargePupilIds: ['girl', 'nursery'], classIds: ['p4', 'n1']}, boys: {gender: 'Male', assignedPupilIds: ['boy']}},
    resultReleases: {mixed: {classId: 'p4', releasedPupils: ['girl', 'boy', 'day']}},
    'academicYears/y/terms/t/timetables/t1/entries': {good: {classId: 'p4'}, other: {classId: 'n1'}},
  };
  Object.assign(documents, extra);
  const reads: Array<{collection: string; filters: any[]; ids: string[]}> = [];
  const collection = (name: string, filters: any[] = []): any => ({
    where: (field: any, op: string, value: any) => collection(name, [...filters, {field, op, value}]),
    get: async () => {
      const entries = Object.entries(documents[name] || {}).filter(([id, data]) => filters.every(({field, op, value}) => {
        const found = field === '__name__' ? id : data[field];
        return op === '==' ? found === value : op === 'in' ? value.includes(found) : op === 'array-contains' ? found?.includes(value) : false;
      }));
      reads.push({collection: name, filters, ids: entries.map(([id]) => id)});
      return {docs: entries.map(([id, data]) => ({id, data: () => data}))};
    },
  });
  const server = load('src/lib/server/circumference.ts', {
    'firebase-admin/firestore': {FieldPath: {documentId: () => '__name__'}, getFirestore: () => ({collection})},
    '@/lib/firebase-admin': {getFirebaseAdminApp: () => ({})},
    '@/lib/access/circumference': circumference, '@/lib/access/scoped-collections': registry,
  });
  return {server, reads};
}
test('scope axes intersect, empty axes deny, malformed scope fails closed and admin retains access', () => {
  const scope = circumference.circumferenceOf(actor({classIds: ['p4'], sections: ['Boarding'], genders: ['Female']}).user);
  equal(Object.entries(pupilData).filter(([, pupil]) => circumference.permitsPupil(scope, pupil as any)).map(([id]) => id), ['girl']);
  assert.equal(circumference.scopeFilters({...scope, classIds: []}).length, 0);
  assert.equal(circumference.permitsPupil(circumference.circumferenceOf({role: 'Staff', circumference: {genders: ['invalid']} as any}), pupilData.girl as any), false);
  assert.equal(circumference.permitsPupil(circumference.circumferenceOf({role: 'Admin', circumference: scope}), pupilData.nursery as any), true);
});
test('Primary fee queries fetch only permitted pupil IDs and direct Nursery IDs yield no rows', async () => {
  const {server, reads} = serverFixture();
  const staff = actor({classIds: ['p4']});
  const result = await server.readWithinCircumference(staff, {collection: 'payments'});
  equal(result.map((item: any) => item.pupilId).sort(), ['boy', 'day', 'girl']);
  assert(reads.filter(item => item.collection === 'pupils' || item.collection === 'payments').every(item => !item.ids.includes('nursery')));
  assert.equal((await server.readWithinCircumference(staff, {collection: 'payments', id: 'nursery'})).length, 0);
  await assert.rejects(server.requireScopedPupil(staff, 'nursery'), /outside/);
});
test('Matron results, release lists and dormitories contain only Boarding Female pupils', async () => {
  const {server, reads} = serverFixture();
  const staff = actor({classIds: ['p4'], sections: ['Boarding'], genders: ['Female']});
  const [result] = await server.readWithinCircumference(staff, {collection: 'examResults'});
  equal(result.pupilSnapshots.map((item: any) => item.pupilId), ['girl']);
  equal(Object.keys(result.results), ['girl']);
  const [release] = await server.readWithinCircumference(staff, {collection: 'resultReleases'});
  equal(release.releasedPupils, ['girl']);
  const dorms = await server.readWithinCircumference(staff, {collection: 'dormitories'});
  equal(dorms.map((item: any) => item.id), ['girls']);
  equal(dorms[0].assignedPupilIds, ['girl']);
  assert(reads.filter(item => item.collection === 'pupils').every(item => item.ids.every(id => id === 'girl')));
});
test('Class, timetable and action guards reject out-of-scope targets and permissions still apply', async () => {
  const {server} = serverFixture();
  const staff = actor({classIds: ['p4']});
  equal((await server.readWithinCircumference(staff, {collection: 'classes'})).map((item: any) => item.id), ['p4']);
  equal((await server.readWithinCircumference(staff, {collection: 'academicYears/y/terms/t/timetables/t1/entries'})).map((item: any) => item.id), ['good']);
  assert.throws(() => server.requireScopedClass(staff, 'n1'), /outside/);
  staff.user.modulePermissions = [];
  await assert.rejects(server.readWithinCircumference(staff, {collection: 'payments'}), /permission/);
});
test('Empty class scope issues no pupil or fee database query', async () => {
  const {server, reads} = serverFixture();
  assert.equal((await server.readWithinCircumference(actor({classIds: []}), {collection: 'payments'})).length, 0);
  assert.equal(reads.length, 0);
});
test('Scope delegation cannot expand the creator boundary, including unrestricted and administrator grants', () => {
  const {server} = serverFixture();
  const accounts = load('src/lib/server/circumference-accounts.ts', {
    crypto: {createHash: () => ({update: () => ({digest: () => 'hash'})})},
    './circumference': server, '@/lib/access/circumference': circumference,
  });
  const staff = actor({classIds: ['p4'], genders: ['Female']});
  assert.throws(() => accounts.assignableCircumference(staff, undefined), /own Circumference/);
  assert.throws(() => accounts.assignableCircumference(staff, staff.user.circumference, 'Admin'), /own Circumference/);
  assert.equal(accounts.assignableCircumference(staff, staff.user.circumference).classIds[0], 'p4');
});
test('Account, role, permissions and Circumference changes invalidate shared scope identity', () => {
  session.setCircumferenceUser(actor().user);
  session.registerCircumferencePupils([{id: 'girl'}]);
  assert.equal(session.setCircumferenceUser(actor({classIds: ['p4']}).user), true);
  assert.equal(session.circumferencePupil('girl'), undefined);
  assert.match(session.circumferenceCacheSuffix('staff'), /circumference/);
  assert.equal(session.circumferenceCacheSuffix('another-account'), '');
  assert.equal(session.setCircumferenceUser({...actor({classIds: ['p4']}).user, modulePermissions: []}), true);
  session.setCircumferenceUser(null);
});

test('a scoped attendance save preserves hidden pupils and other classes', () => {
  const existing = [{pupilId: 'girl', classId: 'p4', status: 'Absent'}, {pupilId: 'boy', classId: 'p4', status: 'Present'}, {pupilId: 'other', classId: 'p5', status: 'Late'}];
  const updated = mergeScopedAttendance(existing, [{pupilId: 'girl', classId: 'p4', status: 'Present'}, {pupilId: 'boy', classId: 'p4', status: 'Absent'}], new Set(['girl']), 'p4', true);
  assert.deepEqual(updated, [existing[1], existing[2], {pupilId: 'girl', classId: 'p4', status: 'Present'}]);
  assert.deepEqual(mergeScopedAttendance(existing, [], new Set(['girl']), 'p4', true), [existing[1], existing[2]]);
});

test('attendance projections return only permitted pupils and preserve timestamp values at the SDK boundary', async () => {
  const {server} = serverFixture({attendanceDailySummaries: {'2026-10-11': {records: [{pupilId: 'girl'}, {pupilId: 'boy'}]}},
    pupils: {...pupilData, girl: {...pupilData.girl, createdAt: {toDate: () => new Date(123456789)}}}});
  const staff = actor({sections: ['Boarding'], genders: ['Female']});
  const [summary] = await server.readWithinCircumference(staff, {collection: 'attendanceDailySummaries', id: '2026-10-11'});
  equal(summary.records, [{pupilId: 'girl'}]);
  const [pupil] = await server.readWithinCircumference(staff, {collection: 'pupils', id: 'girl', preserveTimestamps: true});
  equal(pupil.createdAt, {__firestoreTimestampMillis: 123456789});
});
test('joined fee queries partition pupil IDs to respect simultaneous IN selections', async () => {
  const pupils = Object.fromEntries(Array.from({length: 35}, (_, i) => ['p'+i, {...pupilData.girl}]));
  const payments = Object.fromEntries(Object.keys(pupils).map(pupilId => [pupilId, {pupilId, status: 'pending'}]));
  const {server, reads} = serverFixture({pupils, schoolPayInboundTransactions: payments});
  assert.equal((await server.readWithinCircumference(actor({classIds: ['p4']}), {collection: 'schoolPayInboundTransactions', filters: [{field: 'status', op: 'in', value: ['pending','assigned']}]})).length, 35);
  const plans = reads.filter(read => read.collection === 'schoolPayInboundTransactions');
  assert.equal(plans.length, 3);
  assert(plans.every(plan => plan.filters.find(filter => filter.field === 'pupilId').value.length <= 15));
});
test('attendance, reports and event cache identities change when the same account scope changes', () => {
  const dependencies = {'@/lib/access/circumference-session': session, '@/types': {}, './lite-cache': {}, '@/lib/firebase': {firebaseProjectId: 'project'}, '@/lib/cache/persistent-collection-cache': {}};
  const attendance = load('src/lib/cache/attendance-summary-cache.ts', dependencies, {process: {env: {}}});
  const reports = load('src/lib/cache/revisioned-domain-cache.ts', dependencies);
  const events = load('src/lib/cache/event-cache.ts', dependencies, {process: {env: {}}});
  const get = () => [attendance.getAttendanceCacheScope('staff','Staff'), reports.getDomainCacheScope('staff','Staff'), events.getEventCacheScope('staff','Staff')];
  session.setCircumferenceUser(actor().user);
  const broad = get();
  session.setCircumferenceUser(actor({classIds: ['p4']}).user);
  const narrow = get();
  assert(narrow.every((key, i) => key !== broad[i]));
  session.setCircumferenceUser(actor({sections: ['Boarding'], genders: ['Female']}).user);
  assert(get().every((key, i) => key !== narrow[i]));
  session.setCircumferenceUser(null);
});
