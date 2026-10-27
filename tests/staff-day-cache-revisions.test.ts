import test from 'node:test';
import assert from 'node:assert/strict';
import { staffDayRevisionToken } from '../src/lib/cache/staff-day-revisions';
import { FieldValue } from 'firebase-admin/firestore';
import { bumpStaffClockingPolicyRevision, bumpStaffClockingRecordRevision } from '../src/lib/server/staff-day-revisions.admin';

const day = '2026-10-27';
const revisions = { dutyService: 2, staffClockingPolicy: 3, dashboardStaffClockingRecords: 20, staffClockingStaff: { sarah: 4, peter: 6 }, staff: 5, events: 7 };
test('another teacher clocking in does not invalidate a personal dashboard', () => {
  const changed = { ...revisions, dashboardStaffClockingRecords: 21, staffClockingStaff: { ...revisions.staffClockingStaff, peter: 7 } };
  assert.equal(staffDayRevisionToken(revisions, day, 'sarah', false), staffDayRevisionToken(changed, day, 'sarah', false));
  assert.notEqual(staffDayRevisionToken(revisions, day, undefined, true), staffDayRevisionToken(changed, day, undefined, true));
});
test('own arrival, duty, policy and staff changes invalidate the relevant snapshot', () => {
  const original = staffDayRevisionToken(revisions, day, 'sarah', false);
  for (const changed of [
    { ...revisions, staffClockingStaff: { ...revisions.staffClockingStaff, sarah: 5 } },
    { ...revisions, dutyService: 3 }, { ...revisions, staffClockingPolicy: 4 }, { ...revisions, staff: 6 }, { ...revisions, events: 8 },
  ]) assert.notEqual(original, staffDayRevisionToken(changed, day, 'sarah', false));
});
test('new school dates reconcile once without an expiring cache', () => {
  assert.notEqual(staffDayRevisionToken(revisions, day, 'sarah', false), staffDayRevisionToken(revisions, '2026-10-28', 'sarah', false));
  assert.equal(staffDayRevisionToken(undefined, day, 'sarah', false), staffDayRevisionToken({}, day, 'sarah', false));
});
test('unrelated pupil changes do not invalidate a staff dashboard', () => {
  assert.equal(staffDayRevisionToken(revisions, day, 'sarah', false), staffDayRevisionToken({ ...revisions, pupils: 200 }, day, 'sarah', false));
});
test('disabled clocking ignores record-only changes until policy enables it again', () => {
  const disabled = { ...revisions, staffClockingEnabled: false };
  assert.equal(staffDayRevisionToken(disabled, day, 'sarah', false), staffDayRevisionToken({ ...disabled, staffClockingStaff: { sarah: 100 } }, day, 'sarah', false));
  assert.equal(staffDayRevisionToken(disabled, day, undefined, true), staffDayRevisionToken({ ...disabled, dashboardStaffClockingRecords: 100 }, day, undefined, true));
});
function writer() {
  const writes: Array<{ path: string; data: Record<string, any>; options: unknown }> = [];
  return { writes, db: { collection: (name: string) => ({ doc: (id: string) => `${name}/${id}` }) } as any,
    transaction: { set: (path: string, data: Record<string, any>, options: unknown) => { writes.push({ path, data, options }); } } as any };
}
test('record publications update the shared counter and only affected staff, without writing the school profile', () => {
  const value = writer();
  bumpStaffClockingRecordRevision(value.db, value.transaction, ['sarah', 'sarah']);
  assert.equal(value.writes.length, 1);
  assert.equal(value.writes[0].path, 'settings/data-revisions-operational');
  assert.deepEqual(Object.keys(value.writes[0].data.staffClockingStaff), ['sarah']);
  assert.ok(value.writes[0].data.dashboardStaffClockingRecords.isEqual(FieldValue.increment(1)));
  bumpStaffClockingRecordRevision(value.db, value.transaction, []);
  assert.equal(value.writes.length, 1);
});
test('policy publication carries the feature switch so disabled clocks can hide immediately', () => {
  const value = writer();
  bumpStaffClockingPolicyRevision(value.db, value.transaction, { enabled: false, affectsEvents: true });
  assert.equal(value.writes[0].data.staffClockingEnabled, false);
  assert.ok(value.writes[0].data.staffClockingPolicy.isEqual(FieldValue.increment(1)));
  assert.ok(value.writes[0].data.events.isEqual(FieldValue.increment(1)));
  assert.deepEqual(value.writes[0].options, { merge: true });
});
