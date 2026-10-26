import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { createHash, createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Never permit these fixtures to reach a live project.
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run this suite under the Firestore emulator.');
const app = initializeApp({ projectId: 'demo-staff-clocking-engine' }, 'staff-clocking-validation');
const db = getFirestore(app);
const staff = { user: { id: 'clock-user', username: 'clock', role: 'Staff', isActive: true, staffId: 'staff-one' } };
const manager = { user: { id: 'clock-manager', username: 'manager', role: 'Admin', isActive: true } };
const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const recordId = createHash('sha256').update(`staff-one:${day}`).digest('base64url');
const daily = () => db.collection('staffClockingDailyRecords').doc(recordId);
let engine;

before(async () => {
  process.env.STAFF_CLOCKING_QR_SECRET = 'local-test-signing-secret-with-at-least-32-characters';
  const result = await build({
    stdin: { contents: "export * from './src/lib/server/staff-clocking/index'; export * from './src/lib/staff-clocking/export'; export * from './src/lib/server/staff-clocking/staff-details';", resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
    plugins: [{ name: 'server-marker-for-node-tests', setup(builder) {
      builder.onResolve({ filter: /^server-only$/ }, () => ({ path: 'server-only', namespace: 'test-marker' }));
      builder.onLoad({ filter: /.*/, namespace: 'test-marker' }, () => ({ contents: '' }));
    } }],
  });
  const target = path.resolve('output/staff-clocking-validation/server-test-bundle.cjs');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, result.outputFiles[0].contents);
  engine = createRequire(import.meta.url)(target);
});

beforeEach(async () => {
  for (const collection of ['system_users', 'staff', 'events', 'settings', 'historyLogs', ...Object.values(engine.STAFF_CLOCKING_COLLECTIONS)]) {
    const snapshot = await db.collection(collection).get();
    for (let offset = 0; offset < snapshot.size; offset += 400) {
      const batch = db.batch(); snapshot.docs.slice(offset, offset + 400).forEach(document => batch.delete(document.ref)); await batch.commit();
    }
  }
  await db.collection('system_users').doc(staff.user.id).set(staff.user);
  await db.collection('staff').doc('staff-one').set({ firstName: 'Ada', lastName: 'Staff', status: 'active' });
  await db.collection('staffClockingSettings').doc('default').set({ enabled: true, revision: 1, accessMode: 'all_active_linked_staff', enrolledStaffIds: [] });
  await db.collection('staffClockingSchedules').doc('school-default').set({ scope: 'school', kind: 'recurring', weekdays: [0, 1, 2, 3, 4, 5, 6], clockInBy: '08:00', graceMinutes: 10, isActive: true });
});
after(async () => { await db.terminate(); await deleteApp(app); });

async function scanInput(operationId = 'test_operation_001') {
  const session = await engine.issueStaffClockingQrSession(db, manager);
  return { token: session.token, operationId };
}
async function seedDay(extra = {}) {
  await daily().set({ staffId: 'staff-one', accountId: staff.user.id, localDate: day, clockInAt: Timestamp.fromMillis(Date.now() - 120_000), clockInTime: '09:00:00', clockInBy: '08:00', graceMinutes: 10, arrivalStatus: 'late', secondsLate: 3600, status: 'open', ...extra });
}
async function seedRequest(kind, extra = {}) {
  const ref = db.collection(kind === 'correction' ? 'staffClockingCorrections' : 'staffClockingExemptions').doc('request-one');
  await ref.set({ kind, status: 'pending', accountId: staff.user.id, staffId: 'staff-one', localDate: day, proposedClockInTime: '08:00', ...extra });
  return ref;
}

test('individual details enforce target ownership and redact private staff and review information', async () => {
  await seedDay();
  await db.collection('staff').doc('staff-one').update({ email: 'ada@example.test', contactNumber: '0700000000', medicalHistory: 'private medical information' });
  await seedRequest('exemption', { reason: 'Private leave reason', createdBy: { id: 'other', name: 'Other' } });
  const own = await engine.getIndividualClockingProfile(db, staff, 'staff-one');
  assert.equal(own.staff.email, 'ada@example.test');
  assert.ok(!JSON.stringify(own).includes('medical'));
  await assert.rejects(engine.getIndividualClockingProfile(db, staff, 'staff-two'), /PERMISSION_DENIED/);
  await assert.rejects(engine.getIndividualClockingRecords(db, staff, 'staff-two', {from: day, to: day}), /PERMISSION_DENIED/);
  await assert.rejects(engine.getIndividualClockingRevisions(db, staff, 'staff-two'), /PERMISSION_DENIED/);
  const revisions = await engine.getIndividualClockingRevisions(db, staff, 'staff-one');
  assert.deepEqual(Object.keys(revisions).sort(), ['personal','shared']);
  assert.ok(!JSON.stringify(revisions).includes('ada@example.test'));
  const viewer = { user: { ...staff.user, id: 'records-viewer', staffId: 'staff-two', granularPermissions: [{moduleId: 'staff_clocking', pages: [{pageId: 'records', canAccess: true, actions: [{actionId: 'view_records', allowed: true}]}]}] } };
  const profile = await engine.getIndividualClockingProfile(db, viewer, 'staff-one');
  assert.equal(profile.staff.email, undefined);
  const requests = await engine.getIndividualClockingRequests(db, viewer, 'staff-one', {from: day, to: day});
  assert.equal(requests.length, 1); assert.equal(requests[0].reason, undefined); assert.equal(requests[0].createdBy, undefined);
  assert.equal((await engine.getIndividualClockingRequests(db, staff, 'staff-one', {from: day, to: day}))[0].reason, 'Private leave reason');
  await assert.rejects(engine.getIndividualClockingAudit(db, viewer, 'staff-one', {from: day, to: day}), /PERMISSION_DENIED/);
  await assert.rejects(engine.getIndividualClockingRecords(db, manager, 'staff-one', {from: '2025-01-01', to: '2026-12-31'}));
});

test('new scans preserve departure and group snapshots when schedules later change', async () => {
  await db.collection('staff').doc('staff-one').update({ department: ['Teaching'], role: ['Teacher'] });
  await db.collection('staffClockingSchedules').doc('school-default').update({ clockOutBy: '17:00' });
  const result = await engine.recordStaffClockingScan(db, staff, await scanInput());
  assert.equal(result.record.scheduleSnapshot.clockOutBy, '17:00');
  assert.deepEqual(result.record.scheduleSnapshot.groups, ['Teaching', 'Teacher']);
  await db.collection('staffClockingSchedules').doc('school-default').update({clockInBy: '09:00', clockOutBy: '18:00'});
  const history = await engine.getIndividualClockingRecords(db, staff, 'staff-one', {from: day, to: day});
  assert.equal(history[0].scheduleSnapshot.clockInBy, '08:00'); assert.equal(history[0].scheduleSnapshot.clockOutBy, '17:00');
});

test('approved missing-arrival corrections preserve missing original scans and permit a later real departure', async () => {
  const ref = await seedRequest('correction', { proposedClockInTime: '00:01' });
  await engine.reviewStaffClockingSelfServiceRequest(db, manager, 'correction', ref.id, true);
  const corrected = (await daily().get()).data();
  assert.equal(corrected.clockInAt, undefined); assert.equal(corrected.clockInTime, undefined);
  assert.equal(corrected.effectiveClockInTime, '00:01'); assert.equal(corrected.arrivalStatus, undefined);
  const result = await engine.recordStaffClockingScan(db, staff, await scanInput('after_correction_departure'));
  assert.equal(result.event.type, 'clock_out'); assert.equal(result.record.status, 'complete');
  assert.equal(result.record.clockInAt, undefined); assert.equal(result.record.effectiveClockInTime, '00:01');
  const tomorrow = new Date(`${day}T12:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  await assert.rejects(engine.createStaffClockingSelfServiceRequest(db, staff, 'correction', {localDate: tomorrow.toISOString().slice(0, 10), proposedClockInTime: '08:00', reason: 'Missing arrival correction'}), /CLOCKING_FUTURE_CORRECTION_NOT_ALLOWED/);
});

test('lateness explanations require review and never rewrite scan times or classification', async () => {
  await seedDay();
  const created = await engine.mutateIndividualClocking(db, staff, 'staff-one', { action: 'explain', localDate: day, reason: 'Transport disruption on route' });
  await assert.rejects(engine.mutateIndividualClocking(db, staff, 'staff-one', { action: 'explain', localDate: day, reason: 'Same reason submitted twice' }), /CLOCKING_EXPLANATION_ALREADY_SUBMITTED/);
  await engine.mutateIndividualClocking(db, manager, 'staff-one', { action: 'review_explanation', requestId: created.id, approved: true });
  const record = (await daily().get()).data();
  assert.equal(record.clockInTime, '09:00:00'); assert.equal(record.arrivalStatus, 'late'); assert.equal(record.latenessExcused, true);
  assert.ok((await db.collection('staffClockingPersonalRevisions').doc('staff-one').get()).data().requests >= 2);
  const selfReviewer = { user: {...staff.user, role: 'Admin'} };
  await db.collection('staffClockingExplanations').doc('self-review').set({staffId: 'staff-one', accountId: staff.user.id, localDate: day, status: 'pending'});
  await assert.rejects(engine.mutateIndividualClocking(db, selfReviewer, 'staff-one', {action: 'review_explanation', requestId: 'self-review', approved: true}), /CLOCKING_SELF_REVIEW_NOT_ALLOWED/);
});

test('on-behalf correction requests are atomically attributed and cannot be approved by their creator', async () => {
  await seedDay();
  const created = await engine.mutateIndividualClocking(db, manager, 'staff-one', {action: 'request', kind: 'correction', localDate: day, proposedClockInTime: '08:10', reason: 'Teacher forgot to scan arrival'});
  const request = (await db.collection('staffClockingCorrections').doc(created.id).get()).data();
  assert.equal(request.createdBy.id, manager.user.id); assert.equal(request.accountId, staff.user.id);
  await assert.rejects(engine.mutateIndividualClocking(db, manager, 'staff-one', {action: 'review', kind: 'correction', requestId: created.id, approved: true}), /CLOCKING_SELF_REVIEW_NOT_ALLOWED/);
  await engine.mutateIndividualClocking(db, {user: {...manager.user, id: 'second-manager'}}, 'staff-one', {action: 'review', kind: 'correction', requestId: created.id, approved: true});
  assert.equal((await daily().get()).data().clockInTime, '09:00:00');
  assert.equal((await daily().get()).data().effectiveClockInTime, '08:10');
});

test('ending an approved exemption leaves original clocking events intact', async () => {
  await seedDay();
  const exemption = await engine.createManagedStaffClockingExemption(db, manager, {staffId: 'staff-one', localDate: day, reason: 'Approved external school assignment'});
  await engine.mutateIndividualClocking(db, manager, 'staff-one', {action: 'cancel_exemption', requestId: exemption.id, reason: 'External assignment was cancelled'});
  const record = (await daily().get()).data();
  assert.equal(record.clockInTime, '09:00:00'); assert.equal(record.arrivalStatus, 'late'); assert.equal(record.exemptionId, undefined);
  assert.equal((await db.collection('staffClockingExemptions').doc(exemption.id).get()).data().status, 'cancelled');
});

test('individual audit merges stable pages without exposing QR secrets', async () => {
  const batch = db.batch(), base = new Date(`${day}T12:00:00+03:00`).getTime();
  for (let index = 0; index < 62; index++) {
    batch.set(db.collection('staffClockingEvents').doc(`audit-${String(index).padStart(3, '0')}`), {staffId: 'staff-one', localDate: day, type: 'clock_in', occurredAt: Timestamp.fromMillis(base + index * 1000), requestDigest: 'secret-digest', sessionId: 'secret-session'});
    if (index < 12) batch.set(db.collection('historyLogs').doc(`log-${index}`), {m: {staffId: 'staff-one', localDate: day}, ts: Timestamp.fromMillis(base + index * 1000 + 500), rl: 'Approved change', un: 'Manager'});
  }
  await batch.commit();
  await db.collection('staffClockingEvents').doc('later-adjustment').set({staffId: 'staff-one', localDate: day, type: 'correction_approved', occurredAt: Timestamp.fromMillis(base + 86400_000)});
  const first = await engine.getIndividualClockingAudit(db, manager, 'staff-one', {from: day, to: day});
  assert.equal(first.events.length, 50); assert.ok(first.nextCursor);
  assert.equal(first.events[0].id, 'events:later-adjustment', 'A later correction must remain attached to its original attendance date');
  const next = await engine.getIndividualClockingAudit(db, manager, 'staff-one', {from: day, to: day}, first.nextCursor);
  assert.equal(next.events.length, 25); assert.equal(next.nextCursor, undefined);
  assert.equal(new Set([...first.events, ...next.events].map(event => event.id)).size, 75);
  assert.ok(!JSON.stringify(first).includes('secret-'));
  const own = await engine.getIndividualClockingAudit(db, staff, 'staff-one', {from: day, to: day});
  assert.ok(own.events.every(event => event.id.startsWith('events:')));
});

test('accepted scan writes one event and an authoritative daily record', async () => {
  const result = await engine.recordStaffClockingScan(db, staff, await scanInput());
  assert.equal(result.event.type, 'clock_in');
  assert.equal(result.record.staffId, 'staff-one');
  assert.equal((await db.collection('staffClockingEvents').get()).size, 1);
  assert.equal((await db.collection('settings').doc('data-revisions-operational').get()).data().staffClockingRecords, 1);
  assert.equal((await db.collection('staffClockingPersonalRevisions').doc('staff-one').get()).data().dates[day], 1);
});
test('concurrent retries commit one event and return the same result', async () => {
  const input = await scanInput();
  const results = await Promise.all([engine.recordStaffClockingScan(db, staff, input), engine.recordStaffClockingScan(db, staff, input)]);
  assert.equal(results.filter(result => result.duplicate).length, 1);
  assert.equal((await db.collection('staffClockingEvents').get()).size, 1);
  assert.equal((await db.collection('settings').doc('data-revisions-operational').get()).data().staffClockingRecords, 1, 'Duplicate scans must not publish a false change');
  assert.equal((await db.collection('staffClockingPersonalRevisions').doc('staff-one').get()).data().dates[day], 1);
});

test('configuration changes atomically publish revisions without invalidating attendance', async () => {
  const payload = { scope: 'school', kind: 'recurring', weekdays: [1, 2, 3, 4, 5], clockInBy: '08:00', graceMinutes: 10, isActive: true };
  const revision = async () => (await db.collection('settings').doc('data-revisions-operational').get()).data();
  const schedule = await engine.createStaffClockingSchedule(db, manager, payload);
  assert.deepEqual(await revision(), { staffClockingConfig: 1 });
  await engine.updateStaffClockingSchedule(db, manager, schedule.id, { ...payload, graceMinutes: 15 });
  assert.deepEqual(await revision(), { staffClockingConfig: 2 });
  await engine.deleteStaffClockingSchedule(db, manager, schedule.id);
  assert.deepEqual(await revision(), { staffClockingConfig: 3 });
  await assert.rejects(engine.deleteStaffClockingSchedule(db, manager, schedule.id), /CLOCKING_SCHEDULE_NOT_FOUND/);
  assert.deepEqual(await revision(), { staffClockingConfig: 3 });
});

test('manager exemptions publish attendance and request changes together', async () => {
  await engine.createManagedStaffClockingExemption(db, manager, { staffId: 'staff-one', localDate: day, reason: 'Approved medical leave' });
  assert.deepEqual((await db.collection('settings').doc('data-revisions-operational').get()).data(), { staffClockingRecords: 1, staffClockingRequests: 1 });
});

test('personal status and bounded history expose only the linked employee and never future dates', async () => {
  await seedDay();
  for (let index = 1; index <= 20; index++) {
    const date = new Date(`${day}T00:00:00Z`); date.setUTCDate(date.getUTCDate() - index);
    await db.collection('staffClockingDailyRecords').doc(`history-${index}`).set({ staffId: 'staff-one', localDate: date.toISOString().slice(0, 10), status: 'complete' });
  }
  await db.collection('staffClockingDailyRecords').doc('other-staff').set({ staffId: 'staff-two', localDate: day, status: 'open', clockInTime: '07:00' });
  const status = await engine.getOwnStaffClockingDashboard(db, staff, 'status');
  assert.equal(status.record.staffId, 'staff-one');
  assert.equal(status.history, undefined);
  const history = await engine.getOwnStaffClockingDashboard(db, staff, 'history');
  assert.equal(history.history.length, 5);
  assert.ok(history.history.every(item => item.staffId === 'staff-one' && item.localDate < day));
  assert.equal(history.history[0].id, 'history-1');
  const schedule = await engine.getOwnStaffClockingDashboard(db, staff, 'schedule');
  assert.equal(schedule.history, undefined);
  assert.equal(schedule.record, undefined);
  assert.equal(schedule.staff.id, 'staff-one');
});

test('a scan updates only that employee change counters; personal bootstrap hides enrollment lists', async () => {
  await db.collection('staffClockingSettings').doc('default').update({ accessMode: 'selected_staff', enrolledStaffIds: ['staff-one', 'staff-two'] });
  const bootstrap = await engine.getStaffClockingBootstrap(db, staff);
  assert.equal(bootstrap.access.isEnrolled, true);
  assert.deepEqual(bootstrap.feature.enrolledStaffIds, []);
  await engine.recordStaffClockingScan(db, staff, await scanInput());
  assert.equal((await db.collection('staffClockingPersonalRevisions').get()).size, 1);
});

test('timekeeper grants are narrow, audited, revocable and conflict checked', async () => {
  await db.collection('system_users').doc(staff.user.id).update({ granularPermissions: [{ moduleId: 'staff', pages: [{ pageId: 'list', canAccess: true, actions: [{ actionId: 'view_list', allowed: true }] }] }] });
  const candidates = await engine.listStaffClockingTimekeepers(db, manager);
  assert.deepEqual(candidates.map(item => item.accountId), [staff.user.id]);
  await engine.updateStaffClockingTimekeeper(db, manager, { accountId: staff.user.id, allowed: true, revision: 0 });
  const granted = (await db.collection('system_users').doc(staff.user.id).get()).data();
  const station = granted.granularPermissions.find(item => item.moduleId === 'staff_clocking').pages.find(item => item.pageId === 'record');
  assert.deepEqual(station.actions, [{ actionId: 'view_record', allowed: true }, { actionId: 'display_qr', allowed: true }]);
  assert.equal(granted.granularPermissions.find(item => item.moduleId === 'staff').pages[0].canAccess, true);
  await engine.issueStaffClockingQrSession(db, { user: { ...granted, id: staff.user.id } });
  await assert.rejects(engine.createStaffClockingSchedule(db, { user: { ...granted, id: staff.user.id } }, {}), /PERMISSION_DENIED/);
  await assert.rejects(engine.updateStaffClockingTimekeeper(db, staff, { accountId: staff.user.id, allowed: true, revision: 1 }), /PERMISSION_DENIED/);
  await assert.rejects(engine.updateStaffClockingTimekeeper(db, manager, { accountId: staff.user.id, allowed: false, revision: 0 }), /CLOCKING_ACCESS_CHANGED/);
  await assert.rejects(engine.updateStaffClockingTimekeeper(db, manager, { accountId: staff.user.id, allowed: false, revision: 1, role: 'Admin' }));
  await engine.updateStaffClockingTimekeeper(db, manager, { accountId: staff.user.id, allowed: false, revision: 1 });
  const revoked = (await db.collection('system_users').doc(staff.user.id).get()).data();
  await assert.rejects(engine.issueStaffClockingQrSession(db, { user: { ...revoked, id: staff.user.id } }), /PERMISSION_DENIED/);
  assert.equal((await db.collection('historyLogs').where('e', '==', 'staff_clocking_timekeeper').get()).size, 2);
});

test('an explicit Manage denial prevents schedule and timekeeper administration server-side', async () => {
  const actor = { user: { ...staff.user, granularPermissions: [{ moduleId: 'staff_clocking', pages: [{ pageId: 'record', canAccess: true, actions: [{ actionId: 'manage_schedules', allowed: true }, { actionId: 'manage_timekeepers', allowed: true }, { actionId: 'access_manage', allowed: false }] }] }] } };
  await assert.rejects(engine.listStaffClockingSchedules(db, actor), /PERMISSION_DENIED/);
  await assert.rejects(engine.listStaffClockingTimekeepers(db, actor), /PERMISSION_DENIED/);
});

test('delegated timekeeper managers need no User Management or schedule-editing permission', async () => {
  const actor = { user: { ...staff.user, id: 'delegated-timekeeper-manager', granularPermissions: [{ moduleId: 'staff_clocking', pages: [{ pageId: 'record', canAccess: true, actions: [{ actionId: 'access_manage', allowed: true }, { actionId: 'manage_timekeepers', allowed: true }] }] }] } };
  assert.equal((await engine.listStaffClockingTimekeepers(db, actor)).length, 1);
  await engine.updateStaffClockingTimekeeper(db, actor, { accountId: staff.user.id, allowed: true, revision: 0 });
  await assert.rejects(engine.listStaffClockingSchedules(db, actor), /PERMISSION_DENIED/);
  const grantee = (await db.collection('system_users').doc(staff.user.id).get()).data();
  assert.deepEqual(grantee.granularPermissions[0].pages[0].actions.map(item => item.actionId), ['view_record', 'display_qr']);
});

test('station grants and removals cannot resurrect dormant management permissions', async () => {
  await db.collection('system_users').doc(staff.user.id).update({ granularPermissions: [{ moduleId: 'staff_clocking', pages: [{ pageId: 'record', canAccess: false, actions: [{ actionId: 'manage_schedules', allowed: true }, { actionId: 'manage_timekeepers', allowed: true }, { actionId: 'access_manage', allowed: true }] }] }] });
  await engine.updateStaffClockingTimekeeper(db, manager, { accountId: staff.user.id, allowed: false, revision: 0 });
  let account = (await db.collection('system_users').doc(staff.user.id).get()).data();
  await assert.rejects(engine.listStaffClockingSchedules(db, { user: { ...account, id: staff.user.id } }), /PERMISSION_DENIED/);
  await engine.updateStaffClockingTimekeeper(db, manager, { accountId: staff.user.id, allowed: true, revision: 1 });
  account = (await db.collection('system_users').doc(staff.user.id).get()).data();
  const actor = { user: { ...account, id: staff.user.id } };
  await engine.issueStaffClockingQrSession(db, actor);
  await assert.rejects(engine.listStaffClockingSchedules(db, actor), /PERMISSION_DENIED/);
  await assert.rejects(engine.listStaffClockingTimekeepers(db, actor), /PERMISSION_DENIED/);
});
test('missing QR secret cannot leave an unusable display-session document', async () => {
  const secret = process.env.STAFF_CLOCKING_QR_SECRET;
  delete process.env.STAFF_CLOCKING_QR_SECRET;
  try {
    await assert.rejects(engine.issueStaffClockingQrSession(db, manager), /CLOCKING_QR_SECRET_NOT_CONFIGURED/);
    assert.equal((await db.collection('staffClockingQrSessions').get()).size, 0);
  } finally { process.env.STAFF_CLOCKING_QR_SECRET = secret; }
});
test('retry recovers an expired QR operation without creating another event', async (context) => {
  const input = await scanInput(); await engine.recordStaffClockingScan(db, staff, input);
  await db.collection('staffClockingSettings').doc('default').update({ enabled: false });
  context.mock.timers.enable({ apis: ['Date'], now: Date.now() + 120_000 });
  const result = await engine.recordStaffClockingScan(db, staff, input);
  assert.equal(result.duplicate, true); assert.equal(result.event.type, 'clock_in');
  assert.equal((await db.collection('staffClockingEvents').get()).size, 1);
});
test('ending a display revokes its QR and a display-only operator needs no schedule-management grant', async () => {
  const displayOperator = { user: { id: 'timekeeper', role: 'Staff', isActive: true, granularPermissions: [{ moduleId: 'staff_clocking', pages: [{ pageId: 'record', canAccess: true, actions: [{ actionId: 'display_qr', allowed: true }] }] }] } };
  const bootstrap = await engine.getStaffClockingBootstrap(db, displayOperator);
  assert.equal(bootstrap.hasActiveSchedule, true);
  const session = await engine.issueStaffClockingQrSession(db, displayOperator);
  await assert.rejects(engine.revokeStaffClockingQrSession(db, manager, { sessionId: session.sessionId }), /PERMISSION_DENIED/);
  await engine.revokeStaffClockingQrSession(db, displayOperator, { sessionId: session.sessionId });
  await assert.rejects(engine.recordStaffClockingScan(db, staff, { token: session.token, operationId: 'revoked_session_001' }), /CLOCKING_QR_SESSION_EXPIRED/);
});
test('new operations reject expired signatures, changed operation payloads, and revoked accounts', async () => {
  const input = await scanInput(); await engine.recordStaffClockingScan(db, staff, input);
  const [encoded] = input.token.split('.'); const payload = JSON.parse(Buffer.from(encoded, 'base64url'));
  payload.expiresAtMs = Date.now() - 1;
  const expired = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const token = `${expired}.${createHmac('sha256', process.env.STAFF_CLOCKING_QR_SECRET).update(expired).digest('base64url')}`;
  await assert.rejects(engine.recordStaffClockingScan(db, staff, { token, operationId: 'expired_operation_001' }), /CLOCKING_QR_TOKEN_INVALID/);
  await assert.rejects(engine.recordStaffClockingScan(db, staff, { token, operationId: input.operationId }), /CLOCKING_OPERATION_CONFLICT/);
  await db.collection('system_users').doc(staff.user.id).update({ isActive: false });
  await assert.rejects(engine.recordStaffClockingScan(db, staff, input), /ACCOUNT_INACTIVE/);
});
test('accidental immediate second scan cannot clock the employee out', async () => {
  const input = await scanInput(); await engine.recordStaffClockingScan(db, staff, input);
  await assert.rejects(engine.recordStaffClockingScan(db, staff, { ...input, operationId: 'second_operation_001' }), /CLOCKING_DUPLICATE_SCAN_WAIT/);
  assert.equal((await daily().get()).data().status, 'open');
});
test('later clock-out completes the existing day', async () => {
  await seedDay(); const result = await engine.recordStaffClockingScan(db, staff, await scanInput());
  assert.equal(result.event.type, 'clock_out'); assert.equal(result.record.status, 'complete');
});
test('clock-out uses the saved day schedule after a manager removes recurring rules', async () => {
  await seedDay(); const input = await scanInput();
  await db.collection('staffClockingSchedules').doc('school-default').delete();
  const result = await engine.recordStaffClockingScan(db, staff, input);
  assert.equal(result.event.type, 'clock_out'); assert.equal(result.record.clockInBy, '08:00');
});
test('enrolment and session revision are enforced before a new scan', async () => {
  const input = await scanInput();
  await db.collection('staffClockingSettings').doc('default').update({ accessMode: 'selected_staff', enrolledStaffIds: ['another-staff'] });
  await assert.rejects(engine.recordStaffClockingScan(db, staff, input), /CLOCKING_STAFF_NOT_ENROLLED/);
  await db.collection('staffClockingSettings').doc('default').update({ accessMode: 'all_active_linked_staff', revision: 2 });
  await assert.rejects(engine.recordStaffClockingScan(db, staff, input), /CLOCKING_QR_SESSION_STALE/);
});
test('approved exemption preserves completion and raw clock history', async () => {
  await seedDay({ status: 'complete', clockOutTime: '17:00' }); await seedRequest('exemption');
  await engine.reviewStaffClockingSelfServiceRequest(db, manager, 'exemption', 'request-one', true);
  const record = (await daily().get()).data();
  assert.equal(record.status, 'complete'); assert.equal(record.exemptionStatus, 'approved'); assert.equal(record.clockInTime, '09:00:00');
  assert.equal((await db.collection('staffClockingNotifications').get()).size, 1);
});
test('approved correction recalculates effective arrival while retaining raw facts', async () => {
  await seedDay({ status: 'missing_clock_out' }); await seedRequest('correction', { proposedClockOutTime: '17:00' });
  await engine.reviewStaffClockingSelfServiceRequest(db, manager, 'correction', 'request-one', true);
  const record = (await daily().get()).data();
  assert.equal(record.effectiveClockInTime, '08:00'); assert.equal(record.clockInTime, '09:00:00');
  assert.equal(record.arrivalStatus, 'on_time'); assert.equal(record.rawArrivalStatus, 'late'); assert.equal(record.status, 'complete');
});
test('self-review, repeated review and invalid time order cannot mutate records', async () => {
  await seedDay(); await seedRequest('correction', { proposedClockOutTime: '07:00' });
  await assert.rejects(engine.reviewStaffClockingSelfServiceRequest(db, { user: { ...manager.user, staffId: 'staff-one' } }, 'correction', 'request-one', true), /CLOCKING_SELF_REVIEW_NOT_ALLOWED/);
  await assert.rejects(engine.reviewStaffClockingSelfServiceRequest(db, manager, 'correction', 'request-one', true), /CLOCKING_CORRECTION_INVALID_TIME_ORDER/);
  await engine.reviewStaffClockingSelfServiceRequest(db, manager, 'correction', 'request-one', false);
  await assert.rejects(engine.reviewStaffClockingSelfServiceRequest(db, manager, 'correction', 'request-one', true), /CLOCKING_REQUEST_ALREADY_REVIEWED/);
  assert.equal((await daily().get()).data().clockInTime, '09:00:00');
});
test('report ranges reach older records and keep every matching row', async () => {
  const batch = db.batch();
  for (let i = 0; i < 180; i++) batch.set(db.collection('staffClockingDailyRecords').doc(`row-${i}`), { staffId: 'staff-one', localDate: '2025-01-01', status: 'complete' });
  await batch.commit();
  for (let offset = 0; offset < 520; offset += 260) {
    const newer = db.batch();
    for (let i = offset; i < offset + 260; i++) newer.set(db.collection('staffClockingDailyRecords').doc(`newer-${i}`), { staffId: 'staff-one', localDate: day, status: 'open' });
    await newer.commit();
  }
  const records = await engine.listStaffClockingDailyRecords(db, manager, { from: '2025-01-01', to: '2025-01-01' });
  assert.equal(records.length, 180); assert.equal(engine.summarizeStaffClockingRecords(records).total, 180);
});
test('finalization is idempotent, skips completed/exempt days and rejects unfinished dates', async () => {
  const date = '2025-02-10';
  for (const [id, extra] of [['open', {}], ['complete', { status: 'complete', clockOutTime: '17:00' }], ['exempt', { exemptionStatus: 'approved' }]]) {
    await db.collection('staffClockingDailyRecords').doc(id).set({ localDate: date, status: 'open', clockInAt: Timestamp.now(), ...extra });
  }
  assert.equal((await engine.finalizeOpenStaffClockingDate(db, date)).finalized, 1);
  assert.equal((await db.collection('settings').doc('data-revisions-operational').get()).data().staffClockingRecords, 1);
  assert.equal((await engine.finalizeOpenStaffClockingDate(db, date)).finalized, 0);
  assert.equal((await db.collection('settings').doc('data-revisions-operational').get()).data().staffClockingRecords, 1, 'An unchanged date must not invalidate caches');
  await assert.rejects(engine.finalizeOpenStaffClockingDate(db, day), /CLOCKING_FINALIZATION_DATE_NOT_FINISHED/);
});
test('disabled feature pauses finalization without changing recorded history', async () => {
  const date = '2025-02-10';
  await db.collection('staffClockingDailyRecords').doc('open').set({ localDate: date, status: 'open', clockInAt: Timestamp.now() });
  await db.collection('staffClockingSettings').doc('default').update({ enabled: false });
  assert.equal((await engine.finalizeOpenStaffClockingDate(db, date)).finalized, 0);
  assert.equal((await db.collection('staffClockingDailyRecords').doc('open').get()).data().status, 'open');
});
test('CSV export escapes quotes, preserves effective times and neutralizes formulas', () => {
  const csv = engine.exportStaffClockingCsv([{ id: 'r', staffId: 's', staffName: '=HYPERLINK("evil")', localDate: day, clockInTime: '09:00', effectiveClockInTime: '08:00', status: 'complete' }]);
  assert.ok(csv.includes('"\'=HYPERLINK(""evil"")"')); assert.ok(csv.includes('"08:00"')); assert.ok(!csv.includes('"09:00"'));
});
test('staff cannot read management reports or create a display session', async () => {
  await assert.rejects(engine.listStaffClockingDailyRecords(db, staff), /PERMISSION_DENIED/);
  await assert.rejects(engine.issueStaffClockingQrSession(db, staff), /PERMISSION_DENIED/);
});
test('validation rejects nonexistent dates and malformed review decisions', () => {
  assert.equal(engine.staffClockingReviewSchema.safeParse({ approved: 'yes' }).success, false);
  assert.equal(engine.staffClockingScheduleSchema.safeParse({ scope: 'school', kind: 'date_override', workDate: '2026-02-30', clockInBy: '08:00', graceMinutes: 10, isActive: true }).success, false);
});
