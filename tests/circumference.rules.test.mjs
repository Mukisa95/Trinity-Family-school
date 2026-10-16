import vm from 'node:vm';
import ts from 'typescript';
import * as sdk from 'firebase/firestore';
import assert from 'node:assert/strict';
import {before, after, beforeEach, test} from 'node:test';
import fs from 'node:fs';
import {initializeTestEnvironment, assertFails, assertSucceeds} from '@firebase/rules-unit-testing';
import {collection, doc, getDocs, getDoc, setDoc, updateDoc, query, where, writeBatch} from 'firebase/firestore';

let env;
const claims = {appUser: true, isActive: true, role: 'Staff'};
before(async () => {env = await initializeTestEnvironment({projectId: 'demo-trinity-firestore-rules', firestore: {rules: fs.readFileSync('firestore.rules', 'utf8')}});});
after(async () => {await env?.cleanup();});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const users = {
      teacher: {classIds: ['p4'], sections: null, genders: null},
      bursar: {classIds: ['p4', 'p5'], sections: null, genders: null},
      matron: {classIds: null, sections: ['Boarding'], genders: ['Female']},
      empty: {classIds: [], sections: null, genders: null},
    };
    await Promise.all(Object.entries(users).map(([id, circumference]) => setDoc(doc(db, 'system_users', id), {role: 'Staff', isActive: true, circumference})));
    await Promise.all(Object.entries({
      girl: {classId: 'p4', section: 'Boarding', gender: 'Female'},
      boy: {classId: 'p4', section: 'Boarding', gender: 'Male'},
      day: {classId: 'p4', section: 'Day', gender: 'Female'},
      other: {classId: 'nursery', section: 'Boarding', gender: 'Female'},
    }).map(([id, pupil]) => setDoc(doc(db, 'pupils', id), pupil)));
    await Promise.all(['p4', 'p5', 'nursery'].map(id => setDoc(doc(db, 'classes', id), {name: id})));
    await Promise.all(['girl', 'boy', 'day', 'other'].map(pupilId => setDoc(doc(db, 'payments', pupilId), {pupilId, amount: 100})));
    await setDoc(doc(db, 'examResults', 'mixed'), {classId: 'p4', pupilSnapshots: [{pupilId: 'girl'}, {pupilId: 'boy'}]});
  });
});
const dbFor = id => env.authenticatedContext(id, claims).firestore();

test('P4 teacher cannot query the whole school but can fetch P4 only', async () => {
  const db = dbFor('teacher');
  await assertFails(getDocs(collection(db, 'pupils')));
  const result = await assertSucceeds(getDocs(query(collection(db, 'pupils'), where('classId', '==', 'p4'))));
  assert.deepEqual(result.docs.map(item => item.id).sort(), ['boy', 'day', 'girl']);
  await assertFails(getDoc(doc(db, 'pupils', 'other')));
  await assertFails(getDocs(collection(db, 'classes')));
  await assertSucceeds(getDocs(query(collection(db, 'classes'), where('__name__', '==', 'p4'))));
});
test('Boarding Female requires both constraints; direct boys and day girls are denied', async () => {
  const db = dbFor('matron');
  await assertFails(getDocs(query(collection(db, 'pupils'), where('gender', '==', 'Female'))));
  await assertFails(getDocs(query(collection(db, 'pupils'), where('section', '==', 'Boarding'))));
  const result = await assertSucceeds(getDocs(query(collection(db, 'pupils'), where('gender', '==', 'Female'), where('section', '==', 'Boarding'))));
  assert.deepEqual(result.docs.map(item => item.id).sort(), ['girl', 'other']);
  await assertFails(getDoc(doc(db, 'pupils', 'boy')));
  await assertFails(getDoc(doc(db, 'pupils', 'day')));
  await assertFails(getDoc(doc(db, 'examResults', 'mixed')));
});
test('Primary bursar cannot read Nursery fees or forge Nursery payment writes', async () => {
  const db = dbFor('bursar');
  await assertSucceeds(getDoc(doc(db, 'payments', 'girl')));
  await assertFails(getDoc(doc(db, 'payments', 'other')));
  await assertFails(setDoc(doc(db, 'payments', 'forged'), {pupilId: 'other', amount: 100}));
  await assertFails(updateDoc(doc(db, 'payments', 'girl'), {pupilId: 'other'}));
  await assertFails(getDocs(collection(db, 'payments')));
});
test('Exam creation is checked at the database boundary, including forged class IDs', async () => {
  const db = dbFor('teacher');
  await assertSucceeds(setDoc(doc(db, 'exams', 'p4-exam'), {classId: 'p4', name: 'P4 exam'}));
  await assertFails(setDoc(doc(db, 'exams', 'nursery-exam'), {classId: 'nursery', name: 'Nursery exam'}));
  await assertFails(updateDoc(doc(db, 'exams', 'p4-exam'), {classId: 'nursery'}));
  await assertSucceeds(getDoc(doc(db, 'examResults', 'mixed')));
});
test('Pupil mutations validate the old and new scope and scoped cache deltas are atomic', async () => {
  const db = dbFor('matron');
  await assertFails(updateDoc(doc(db, 'pupils', 'girl'), {section: 'Day'}));
  await assertFails(updateDoc(doc(db, 'pupils', 'boy'), {gender: 'Female'}));
  const batch = writeBatch(db);
  batch.update(doc(db, 'pupils', 'girl'), {firstName: 'Allowed'});
  batch.set(doc(db, 'pupilCacheChanges', 'change-1'), {pupilId: 'girl', operation: 'upsert', revision: 1});
  await assertSucceeds(batch.commit());
  await assertFails(getDocs(collection(db, 'pupilCacheChanges')));
});
test('Scope changes immediately revoke reads and users cannot expand their own scope', async () => {
  const db = dbFor('teacher');
  await assertFails(updateDoc(doc(db, 'system_users', 'teacher'), {circumference: {classIds: null, sections: null, genders: null}}));
  await env.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), 'system_users', 'teacher'), {circumference: {classIds: ['p5'], sections: null, genders: null}}));
  await assertFails(getDoc(doc(db, 'pupils', 'girl')));
  await assertFails(getDocs(query(collection(db, 'pupils'), where('classId', '==', 'p4'))));
  await assertFails(getDoc(doc(dbFor('empty'), 'pupils', 'girl')));
});
test('Nested timetable entries cannot bypass the class boundary through academicYears', async () => {
  const path = 'academicYears/y/terms/t/timetables/table/entries';
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), path, 'p4-entry'), {classId: 'p4'});
    await setDoc(doc(context.firestore(), path, 'nursery-entry'), {classId: 'nursery'});
  });
  const db = dbFor('teacher');
  await assertFails(getDocs(collection(db, path)));
  await assertFails(getDoc(doc(db, path, 'nursery-entry')));
  await assertSucceeds(getDocs(query(collection(db, path), where('classId', '==', 'p4'))));
  await assertFails(setDoc(doc(db, path, 'forged'), {classId: 'nursery'}));
  await assertSucceeds(setDoc(doc(db, path, 'allowed'), {classId: 'p4'}));
});

test('a scoped class teacher can save a full class of attendance without exceeding rule lookup limits', async () => {
  const ids = Array.from({length: 31}, (_, index) => `p4-${index}`);
  await env.withSecurityRulesDisabled(async context => {
    await Promise.all(ids.map(id => setDoc(doc(context.firestore(), 'pupils', id), {classId: 'p4', section: 'Day', gender: 'Male'})));
  });
  const db = env.authenticatedContext('teacher', claims).firestore();
  const source = ts.transpileModule(fs.readFileSync('src/lib/services/attendance.service.ts', 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText;
  const module = {exports: {}};
  vm.runInNewContext(source, {module, exports: module.exports, console, Date, Map, Set,
    require(name) {
      if (name === '@/lib/access/scoped-firestore') return {...sdk, writeBatch: database => {
        const batch = sdk.writeBatch(database);
        // VM object literals have a different prototype; preserve their actual
        // fields and native Timestamp instances when crossing into the SDK.
        return {set: (ref, data, options) => batch.set(ref, {...data}, options), commit: () => batch.commit()};
      }};
      if (name === '@/lib/access/circumference') return {hasCircumference: () => true};
      if (name === '@/lib/access/circumference-session') return {getCircumferenceUser: () => ({id: 'teacher', role: 'Staff', circumference: {classIds: ['p4']}})};
      if (name === '../firebase') return {db};
      if (['./pupil-snapshots.service', '../utils/firestore-helpers', '../utils/attendance-date-range'].includes(name)) return {};
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  const records = ids.map(pupilId => ({pupilId, classId: 'p4', date: '2026-10-11', status: 'Present'}));
  const saved = await assertSucceeds(module.exports.AttendanceService.bulkCreateAttendanceRecords(records));
  assert.equal(saved.length, 31);
  const result = await assertSucceeds(getDocs(query(collection(db, 'attendanceRecords'), where('pupilId', '==', ids[30]))));
  assert.equal(result.docs[0].data().status, 'Present');
});
