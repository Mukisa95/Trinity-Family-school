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
    stdin: { contents: "export * from './src/lib/server/staff-clocking/index'; export * from './src/lib/staff-clocking/export';", resolveDir: process.cwd(), loader: 'ts' },
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
  for (const collection of ['system_users', 'staff', 'events', 'historyLogs', ...Object.values(engine.STAFF_CLOCKING_COLLECTIONS)]) {
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

test('accepted scan writes one event and an authoritative daily record', async () => {
  const result = await engine.recordStaffClockingScan(db, staff, await scanInput());
  assert.equal(result.event.type, 'clock_in');
  assert.equal(result.record.staffId, 'staff-one');
  assert.equal((await db.collection('staffClockingEvents').get()).size, 1);
});
test('concurrent retries commit one event and return the same result', async () => {
  const input = await scanInput();
  const results = await Promise.all([engine.recordStaffClockingScan(db, staff, input), engine.recordStaffClockingScan(db, staff, input)]);
  assert.equal(results.filter(result => result.duplicate).length, 1);
  assert.equal((await db.collection('staffClockingEvents').get()).size, 1);
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
  assert.equal((await engine.finalizeOpenStaffClockingDate(db, date)).finalized, 0);
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
