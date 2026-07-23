import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import fs from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';

const projectId = 'demo-trinity-firestore-rules';
let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'system_users', 'active-admin'), {
      username: 'ADMIN',
      role: 'Admin',
      isActive: true,
    });
    await setDoc(doc(db, 'system_users', 'inactive-staff'), {
      username: 'INACTIVE',
      role: 'Staff',
      isActive: false,
    });
    await setDoc(doc(db, 'pupils', 'pupil-1'), {
      firstName: 'Test',
      status: 'Active',
    });
    await setDoc(doc(db, 'authCredentials', 'active-admin'), {
      passwordHash: 'server-only',
    });
  });
});

after(async () => {
  await testEnv?.cleanup();
});

test('unauthenticated clients cannot read or write application data', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'pupils', 'pupil-1')));
  await assertFails(setDoc(doc(db, 'pupils', 'pupil-2'), { firstName: 'Blocked' }));
});

test('Firebase anonymous identities cannot access application data', async () => {
  const db = testEnv.authenticatedContext('anonymous-user', {
    firebase: { sign_in_provider: 'anonymous' },
  }).firestore();
  await assertFails(getDoc(doc(db, 'pupils', 'pupil-1')));
});

test('a Firebase identity without application claims is denied', async () => {
  const db = testEnv.authenticatedContext('arbitrary-firebase-user').firestore();
  await assertFails(getDoc(doc(db, 'pupils', 'pupil-1')));
});

test('an inactive application claim is denied', async () => {
  const db = testEnv.authenticatedContext('inactive-staff', {
    appUser: true,
    isActive: false,
    role: 'Staff',
  }).firestore();
  await assertFails(getDoc(doc(db, 'pupils', 'pupil-1')));
});

test('an active application identity keeps normal read and write behavior', async () => {
  const db = testEnv.authenticatedContext('active-admin', {
    appUser: true,
    isActive: true,
    role: 'Admin',
  }).firestore();
  await assertSucceeds(getDoc(doc(db, 'pupils', 'pupil-1')));
  await assertSucceeds(setDoc(doc(db, 'pupils', 'pupil-2'), { firstName: 'Allowed' }));
  await assertSucceeds(deleteDoc(doc(db, 'pupils', 'pupil-2')));
});

test('active users can read profiles but cannot mutate them directly', async () => {
  const db = testEnv.authenticatedContext('active-admin', {
    appUser: true,
    isActive: true,
    role: 'Admin',
  }).firestore();
  const profile = await assertSucceeds(getDoc(doc(db, 'system_users', 'active-admin')));
  assert.equal(profile.data()?.username, 'ADMIN');
  await assertFails(setDoc(doc(db, 'system_users', 'active-admin'), { role: 'Staff' }, { merge: true }));
});

test('the credential vault is inaccessible even to active administrators', async () => {
  const db = testEnv.authenticatedContext('active-admin', {
    appUser: true,
    isActive: true,
    role: 'Admin',
  }).firestore();
  await assertFails(getDoc(doc(db, 'authCredentials', 'active-admin')));
  await assertFails(setDoc(doc(db, 'authCredentials', 'active-admin'), { passwordHash: 'tampered' }));
});
