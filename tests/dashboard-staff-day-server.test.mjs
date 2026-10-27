import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';

// Exercise the actual server projection against a read-only Firestore adapter.
// No credentials, live project, network access, or write API is available here.
const now = new Date('2026-10-27T07:26:00Z');
const date = '2026-10-27';
const actor = { user: { id: 'user', username: 'teacher', role: 'Staff', isActive: true, staffId: 'sarah' } };
let engine;
before(async () => {
  const bundle = await build({ entryPoints: ['src/lib/server/staff-clocking/index.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
    plugins: [{ name: 'server-marker', setup(builder) {
      builder.onResolve({ filter: /^server-only$/ }, () => ({ path: 'marker', namespace: 'marker' }));
      builder.onLoad({ filter: /.*/, namespace: 'marker' }, () => ({ contents: '' }));
    } }],
  });
  const target = path.resolve('output/dashboard-role-validation/server-bundle.cjs');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bundle.outputFiles[0].contents);
  engine = createRequire(import.meta.url)(target);
});

function fixture(change = {}) {
  const data = {
    staff: { sarah: { firstName: 'Sarah', lastName: 'Namuli', department: ['Teaching'], role: ['TEACHER'], status: 'active' },
      peter: { firstName: 'Peter', lastName: 'Kato', department: ['Teaching'], role: ['TEACHER'], status: 'active' },
      secretary: { firstName: 'Other', lastName: 'Staff', department: ['Administration'], role: ['SECRETARY'], status: 'active' },
      inactive: { firstName: 'Inactive', role: ['TEACHER'], status: 'inactive' } },
    staffClockingSettings: { default: { enabled: true, accessMode: 'all_active_linked_staff', revision: 1, enrolledStaffIds: [] } },
    staffClockingSchedules: { school: { scope: 'school', kind: 'recurring', weekdays: [2], clockInBy: '07:30', graceMinutes: 5, isActive: true } },
    staffClockingDailyRecords: {}, events: {},
    dutyRotas: { rota: { dutyName: 'Supervision', isActive: true, startDate: '2026-10-26', endDate: '2026-10-30' } },
    dutyAssignments: { one: { rotaId: 'rota', memberId: 'sarah', memberType: 'staff', startDate: '2026-10-26', endDate: '2026-10-30', isActive: true, service: 'Morning', isSupervisor: false },
      two: { rotaId: 'rota', memberId: 'peter', memberType: 'staff', startDate: '2026-10-26', endDate: '2026-10-30', isActive: true, service: 'Compound', isSupervisor: true } },
    ...change,
  };
  const reads = [];
  const document = (id, value) => ({ id, exists: value !== undefined, data: () => value });
  const db = { collection(name) {
    const query = filters => ({
      where(field, operator, value) { assert.equal(operator, '=='); return query([...filters, [field, value]]); },
      doc(id) { return { async get() { reads.push({ name, id }); return document(id, data[name]?.[id]); } }; },
      async get() { reads.push({ name, filters }); const docs = Object.entries(data[name] || {}).filter(([, value]) => filters.every(([field, expected]) => value[field] === expected)).map(([id, value]) => document(id, value)); return { docs, empty: !docs.length, size: docs.length }; },
    });
    return query([]);
  } };
  return { db, reads, data };
}

test('a teacher receives only their own clocking, due time and current duties', async () => {
  const { db, reads } = fixture();
  const result = await engine.getDashboardStaffDay(db, actor, now);
  assert.equal(result.schoolWide, false);
  assert.deepEqual(result.arrivals.map(item => item.staffId), ['sarah']);
  assert.equal(result.arrivals[0].schedule.clockInBy, '07:30');
  assert.deepEqual(result.duties.map(item => item.staffId), ['sarah']);
  assert.equal(reads.filter(item => item.name === 'staff' && item.filters).length, 0);
  assert.deepEqual(reads.find(item => item.name === 'dutyAssignments').filters, [['memberId', 'sarah']]);
});

test('dashboard due times use the current duty rota without rereading it per teacher', async () => {
  const { db, reads } = fixture({ dutyRotas: { rota: { dutyName: 'Gate duty', teamsInvolved: ['staff'], isActive: true,
    startDate: '2026-10-26', endDate: '2026-10-30', staffArrivalTime: '06:30', staffDepartureTime: '18:00' } } });
  const result = await engine.getDashboardStaffDay(db, actor, now);
  assert.equal(result.arrivals[0].schedule.clockInBy, '06:30');
  assert.equal(result.arrivals[0].schedule.clockOutBy, '18:00');
  assert.equal(reads.filter(item => item.name === 'dutyRotas').length, 1);
  assert.equal(reads.filter(item => item.name === 'dutyAssignments').length, 1);
});
test('admin with a teaching identity retains a complete active teaching roster, including missing clocks', async () => {
  const { db } = fixture();
  const result = await engine.getDashboardStaffDay(db, { user: { ...actor.user, role: 'Admin' } }, now);
  assert.equal(result.schoolWide, true);
  assert.deepEqual(result.arrivals.map(item => item.staffId).sort(), ['peter', 'sarah']);
  assert.ok(result.arrivals.every(item => item.record === undefined));
  assert.equal(result.duties.length, 2);
});
test('DOS authority is read from the linked staff document, not the submitted user shape', async () => {
  const source = fixture(); source.data.staff.sarah.role = ['DIRECTOR OF STUDIES'];
  assert.equal((await engine.getDashboardStaffDay(source.db, actor, now)).schoolWide, true);
  assert.equal((await engine.getDashboardStaffDay(fixture().db, { user: { ...actor.user, staffRole: 'DIRECTOR OF STUDIES', schoolWide: true } }, now)).schoolWide, false);
});
test('a parent, inactive account and unlinked staff cannot acquire a school roster', async () => {
  await assert.rejects(engine.getDashboardStaffDay(fixture().db, { user: { ...actor.user, role: 'Parent' } }, now), /PERMISSION_DENIED/);
  await assert.rejects(engine.getDashboardStaffDay(fixture().db, { user: { ...actor.user, isActive: false } }, now), /PERMISSION_DENIED/);
  const result = await engine.getDashboardStaffDay(fixture().db, { user: { ...actor.user, staffId: undefined } }, now);
  assert.deepEqual(result.arrivals, []); assert.deepEqual(result.duties, []);
});
test('saved due time and approved corrected clock times survive later schedule edits', async () => {
  const id = createHash('sha256').update(`sarah:${date}`).digest('base64url');
  const source = fixture({ staffClockingDailyRecords: { [id]: { staffId: 'sarah', localDate: date, clockInBy: '07:00', clockInTime: '07:20', effectiveClockInTime: '06:58', effectiveClockOutTime: '16:00', reviewStatus: 'corrected', arrivalStatus: 'on_time', status: 'complete' } } });
  const result = await engine.getDashboardStaffDay(source.db, actor, now);
  assert.equal(result.arrivals[0].schedule.clockInBy, '07:00');
  assert.equal(result.arrivals[0].record.effectiveClockInTime, '06:58');
  assert.equal(result.arrivals[0].record.effectiveClockOutTime, '16:00');
});
test('individual overrides and approved closures use the same resolver as actual clocking', async () => {
  const source = fixture();
  source.data.events.closed = { type: 'Holiday', title: 'School closure', startDate: date, endDate: date, status: 'Scheduled', customFields: { staffClockingEffect: 'school_closure' } };
  assert.equal((await engine.getDashboardStaffDay(source.db, actor, now)).arrivals[0].schedule.kind, 'non_working_day');
  source.data.staffClockingSchedules.override = { scope: 'staff', subjectId: 'sarah', kind: 'date_override', workDate: date, clockInBy: '09:00', graceMinutes: 0, isActive: true };
  assert.equal((await engine.getDashboardStaffDay(source.db, actor, now)).arrivals[0].schedule.clockInBy, '09:00');
});
test('expired, inactive and pupil duties are excluded; disabled clocking never enables itself', async () => {
  const source = fixture();
  source.data.staffClockingSettings.default.enabled = false;
  source.data.dutyAssignments.one.endDate = '2026-10-26';
  source.data.dutyAssignments.pupil = { ...source.data.dutyAssignments.two, memberId: 'sarah', memberType: 'pupils' };
  const result = await engine.getDashboardStaffDay(source.db, actor, now);
  assert.equal(result.clockingEnabled, false); assert.deepEqual(result.arrivals, []); assert.deepEqual(result.duties, []);
  assert.equal(source.data.staffClockingSettings.default.enabled, false);
});
test('pilot enrollment is distinguished from missing attendance', async () => {
  const source = fixture();
  source.data.staffClockingSettings.default.accessMode = 'selected_staff';
  source.data.staffClockingSettings.default.enrolledStaffIds = ['peter'];
  const result = await engine.getDashboardStaffDay(source.db, actor, now);
  assert.equal(result.arrivals[0].enrolled, false);
});
test('ISO timestamp duty periods are interpreted on the school calendar', async () => {
  const source = fixture();
  source.data.dutyRotas.rota.startDate = '2026-10-25T21:00:00.000Z';
  source.data.dutyRotas.rota.endDate = '2026-10-30T20:59:59.000Z';
  source.data.dutyAssignments.one.startDate = '2026-10-25T21:00:00.000Z';
  source.data.dutyAssignments.one.endDate = '2026-10-30T20:59:59.000Z';
  const result = await engine.getDashboardStaffDay(source.db, actor, now);
  assert.equal(result.duties.length, 1); assert.equal(result.duties[0].startDate, '2026-10-26');
});
