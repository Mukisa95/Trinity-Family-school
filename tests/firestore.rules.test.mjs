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
    await setDoc(doc(db, 'settings', 'school-settings'), {
      generalInfo: { name: 'Trinity' },
    });
    await setDoc(doc(db, 'settings', 'school-settings-meta'), {
      revision: 1,
    });
    await setDoc(doc(db, 'settings', 'data-revisions-operational'), {
      pupils: 1,
    });
    await setDoc(doc(db, 'pushSubscriptions', 'parent-device'), {
      userId: 'active-parent',
      endpoint: 'https://push.example/parent-device',
      isActive: true,
    });
    await setDoc(doc(db, 'bankAccounts', 'bank-account-1'), {
      pupilId: 'pupil-1',
      balance: 20,
    });
    await setDoc(doc(db, 'attendanceRecords', 'attendance-1'), {
      pupilId: 'pupil-1',
      date: '2026-09-20',
      status: 'Present',
    });
    await setDoc(doc(db, 'examResults', 'exam-result-1'), {
      examId: 'exam-1',
      results: { 'pupil-1': { mathematics: { marks: 90 } } },
    });
    await setDoc(doc(db, 'resultReleases', 'exam-1_class-1'), {
      examId: 'exam-1',
      releasedPupils: ['pupil-1'],
    });
    await setDoc(doc(db, 'parentDashboardRevisions', 'family-1'), {
      banking: 3,
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

test('Dev Contral seed records are administrator-only', async () => {
  const adminDb = testEnv.authenticatedContext('active-admin', {
    appUser: true, isActive: true, role: 'Admin',
  }).firestore();
  const staffDb = testEnv.authenticatedContext('active-staff', {
    appUser: true, isActive: true, role: 'Staff',
  }).firestore();

  await assertSucceeds(setDoc(doc(adminDb, 'historicalPupilSeeds', 'seed-1'), { pupilId: 'pupil-1' }));
  await assertSucceeds(getDoc(doc(adminDb, 'historicalPupilSeeds', 'seed-1')));
  await assertFails(getDoc(doc(staffDb, 'historicalPupilSeeds', 'seed-1')));
  await assertFails(setDoc(doc(staffDb, 'historicalPupilSeeds', 'seed-2'), { pupilId: 'pupil-1' }));
});

test('operational audit reads are admin-only while active users can create telemetry', async () => {
  const adminDb = testEnv.authenticatedContext('active-admin', {
    appUser: true, isActive: true, role: 'Admin',
  }).firestore();
  const staffDb = testEnv.authenticatedContext('active-staff', {
    appUser: true, isActive: true, role: 'Staff',
  }).firestore();

  await assertSucceeds(setDoc(doc(staffDb, 'operationalAuditLogs', 'audit-1'), { av: '6' }));
  await assertSucceeds(getDoc(doc(adminDb, 'operationalAuditLogs', 'audit-1')));
  await assertFails(getDoc(doc(staffDb, 'operationalAuditLogs', 'audit-1')));
  await assertFails(setDoc(doc(staffDb, 'operationalAuditLogs', 'audit-1'), { av: 'changed' }));
});

test('only the small public school-profile token is anonymously readable', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(db, 'settings', 'school-settings')));
  await assertSucceeds(getDoc(doc(db, 'settings', 'school-settings-meta')));
  await assertFails(getDoc(doc(db, 'settings', 'data-revisions-operational')));
  await assertFails(setDoc(doc(db, 'settings', 'school-settings-meta'), { revision: 2 }));
});

test('the trusted Vercel server identity can read pupils for server-side notifications', async () => {
  const trustedServerDb = testEnv.authenticatedContext('trinity-vercel-server', {
    appUser: true,
    isActive: true,
    role: 'Server',
    serverApp: true,
  }).firestore();
  const untrustedServerDb = testEnv.authenticatedContext('untrusted-server', {
    appUser: true,
    isActive: true,
    role: 'Server',
  }).firestore();

  await assertSucceeds(getDoc(doc(trustedServerDb, 'pupils', 'pupil-1')));
  await assertFails(getDoc(doc(untrustedServerDb, 'pupils', 'pupil-1')));
});

test('parents cannot query raw banking collections', async () => {
  const parentDb = testEnv.authenticatedContext('active-parent', {
    appUser: true,
    isActive: true,
    role: 'Parent',
    familyId: 'family-1',
  }).firestore();
  const staffDb = testEnv.authenticatedContext('active-staff', {
    appUser: true,
    isActive: true,
    role: 'Staff',
  }).firestore();

  await assertFails(getDoc(doc(parentDb, 'bankAccounts', 'bank-account-1')));
  await assertSucceeds(getDoc(doc(staffDb, 'bankAccounts', 'bank-account-1')));
});

test('parents cannot read or change raw attendance records', async () => {
  const parentDb = testEnv.authenticatedContext('active-parent', {
    appUser: true,
    isActive: true,
    role: 'Parent',
    familyId: 'family-1',
  }).firestore();
  const staffDb = testEnv.authenticatedContext('active-staff', {
    appUser: true,
    isActive: true,
    role: 'Staff',
  }).firestore();

  await assertFails(getDoc(doc(parentDb, 'attendanceRecords', 'attendance-1')));
  await assertFails(setDoc(doc(parentDb, 'attendanceRecords', 'attendance-1'), { remarks: 'Forged' }, { merge: true }));
  await assertSucceeds(getDoc(doc(staffDb, 'attendanceRecords', 'attendance-1')));
});

test('parents cannot read class-wide exam source documents or release lists', async () => {
  const parentDb = testEnv.authenticatedContext('active-parent', {
    appUser: true,
    isActive: true,
    role: 'Parent',
    familyId: 'family-1',
  }).firestore();
  const staffDb = testEnv.authenticatedContext('active-staff', {
    appUser: true,
    isActive: true,
    role: 'Staff',
  }).firestore();

  await assertFails(getDoc(doc(parentDb, 'examResults', 'exam-result-1')));
  await assertFails(getDoc(doc(parentDb, 'resultReleases', 'exam-1_class-1')));
  await assertSucceeds(getDoc(doc(staffDb, 'examResults', 'exam-result-1')));
  await assertSucceeds(getDoc(doc(staffDb, 'resultReleases', 'exam-1_class-1')));
});

test('parents can read only their own compact dashboard revision', async () => {
  const parentDb = testEnv.authenticatedContext('active-parent', {
    appUser: true,
    isActive: true,
    role: 'Parent',
    familyId: 'family-1',
  }).firestore();
  const otherParentDb = testEnv.authenticatedContext('other-parent', {
    appUser: true,
    isActive: true,
    role: 'Parent',
    familyId: 'family-2',
  }).firestore();

  await assertSucceeds(getDoc(doc(parentDb, 'parentDashboardRevisions', 'family-1')));
  await assertFails(getDoc(doc(otherParentDb, 'parentDashboardRevisions', 'family-1')));
  await assertFails(setDoc(doc(parentDb, 'parentDashboardRevisions', 'family-1'), { banking: 999 }));
});

test('push endpoints are user-readable but writable only by the trusted server', async () => {
  const parentDb = testEnv.authenticatedContext('active-parent', {
    appUser: true,
    isActive: true,
    role: 'Parent',
  }).firestore();
  const otherParentDb = testEnv.authenticatedContext('other-parent', {
    appUser: true,
    isActive: true,
    role: 'Parent',
  }).firestore();
  const trustedServerDb = testEnv.authenticatedContext('trinity-vercel-server', {
    appUser: true,
    isActive: true,
    role: 'Server',
    serverApp: true,
  }).firestore();

  await assertSucceeds(getDoc(doc(parentDb, 'pushSubscriptions', 'parent-device')));
  await assertFails(getDoc(doc(otherParentDb, 'pushSubscriptions', 'parent-device')));
  await assertFails(setDoc(
    doc(parentDb, 'pushSubscriptions', 'forged-device'),
    { userId: 'active-parent', endpoint: 'forged', isActive: true },
  ));
  await assertSucceeds(setDoc(
    doc(trustedServerDb, 'pushSubscriptions', 'server-device'),
    { userId: 'active-parent', endpoint: 'server-created', isActive: true },
  ));
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

test('payment notification outbox remains server-only under existing scheduling rules', async () => {
  const eventPath = 'scheduledNotifications/fee-payment-events/outbox/payment-test';
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), eventPath), { paymentId: 'test', status: 'pending' });
  });
  for (const db of [
    testEnv.unauthenticatedContext().firestore(),
    testEnv.authenticatedContext('active-admin', { appUser: true, isActive: true, role: 'Admin' }).firestore(),
    testEnv.authenticatedContext('active-parent', { appUser: true, isActive: true, role: 'Parent', familyId: 'family-1' }).firestore(),
  ]) {
    await assertFails(getDoc(doc(db, eventPath)));
    await assertFails(setDoc(doc(db, eventPath), { status: 'completed' }, { merge: true }));
    await assertFails(deleteDoc(doc(db, eventPath)));
  }
});

test('daily attendance summaries are restricted to staff and administrators', async () => {
  const adminDb = testEnv.authenticatedContext('active-admin', {
    appUser: true,
    isActive: true,
    role: 'Admin',
  }).firestore();
  const parentDb = testEnv.authenticatedContext('active-parent', {
    appUser: true,
    isActive: true,
    role: 'Parent',
    familyId: 'family-1',
  }).firestore();
  const summaryRef = doc(adminDb, 'attendanceDailySummaries', '2026-07-29');

  await assertSucceeds(setDoc(summaryRef, { date: '2026-07-29', records: [] }));
  await assertSucceeds(getDoc(summaryRef));
  await assertFails(getDoc(doc(parentDb, 'attendanceDailySummaries', '2026-07-29')));
  await assertFails(setDoc(
    doc(parentDb, 'attendanceDailySummaries', '2026-07-29'),
    { records: [{ pupilId: 'pupil-1' }] },
    { merge: true },
  ));
});

test('pupil cache deltas are restricted to staff and administrators', async () => {
  const adminDb = testEnv.authenticatedContext('active-admin', {
    appUser: true,
    isActive: true,
    role: 'Admin',
  }).firestore();
  const parentDb = testEnv.authenticatedContext('active-parent', {
    appUser: true,
    isActive: true,
    role: 'Parent',
    familyId: 'family-1',
  }).firestore();
  const change = {
    revision: 1,
    pupilId: 'pupil-1',
    operation: 'upsert',
  };

  await assertSucceeds(setDoc(doc(adminDb, 'pupilCacheChanges', '0000000000000001'), change));
  await assertSucceeds(getDoc(doc(adminDb, 'pupilCacheChanges', '0000000000000001')));
  await assertFails(getDoc(doc(parentDb, 'pupilCacheChanges', '0000000000000001')));
  await assertFails(setDoc(doc(parentDb, 'pupilCacheChanges', 'forged'), change));
});
