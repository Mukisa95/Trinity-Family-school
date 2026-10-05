import assert from 'node:assert/strict';
import test from 'node:test';
import {Timestamp} from 'firebase-admin/firestore';
import {isoValues} from '../src/lib/fees/reminder-engine/firestore-values';
import {feeReminderFixture} from './helpers/fee-reminders-fixture';
import {reminderLocalDate, type CreateFeeReminderInput} from '../src/lib/fees/fee-reminders';
import type {CreateCustomFeeNoteInput} from '../src/lib/fees/custom-fee-notes';
import type {SystemUser} from '../src/types';

const actor = {id: 'cashier', username: 'cashier', role: 'Admin', isActive: true} as SystemUser;
const formats = {
  strings: (value: string) => value,
  legacy: (value: string) => ({seconds: Date.parse(value) / 1000, nanoseconds: 0}),
  serialized: (value: string) => ({_seconds: Date.parse(value) / 1000, _nanoseconds: 0}),
  sdk: (value: string) => Timestamp.fromDate(new Date(value)),
};

function setup(format: (value: string) => unknown) {
  const f = feeReminderFixture();
  for (const pupilId of ['first-pupil', 'second-pupil']) {
    f.seed(`pupils/${pupilId}`, {firstName: pupilId, lastName: 'Test', classId: 'p6', section: 'Day', assignedFees: []});
  }
  f.seed('classes/p6', {name: 'Primary Six'});
  f.seed('system_users/cashier', actor);
  for (const [id, year] of [['base', 2025], ['current', 2026]] as const) {
    f.seed(`academicYears/${id}`, {name: String(year), startDate: format(`${year}-01-01`), endDate: format(`${year}-12-31`),
      terms: [{id: `term2-${year}`, name: 'Term 2', startDate: format(`${year}-05-01`), endDate: format(`${year}-08-01`)},
        {id: `term3-${year}`, name: 'Term 3', startDate: format(`${year}-09-01`), endDate: format(`${year}-12-01`)}]});
  }
  f.seed('feeStructures/tuition', {name: 'Tuition', academicYearId: 'base', amount: 300000,
    category: 'Tuition Fee', isRequired: true, status: 'active'});
  const input: CreateFeeReminderInput = {requestId: 'request', pupilId: 'first-pupil', feeId: 'tuition',
    academicYearId: 'current', termId: 'term3-2026', promisedAmount: 20000, promisedBy: 'Guardian', phone: '+256700123456',
    scheduleDate: reminderLocalDate(new Date(Date.now() + 2 * 86400000)), scheduleTime: '09:00'};
  return {...f, input};
}

test('timestamp maps normalize recursively without converting unrelated objects or mutating input', () => {
  const source = {epoch: {seconds: 0, nanoseconds: 123000000}, beforeEpoch: {_seconds: -1, _nanoseconds: 0},
    nested: [{date: Timestamp.fromDate(new Date('2026-10-05T00:00:00Z'))}, new Date('2026-10-05T00:00:00Z')],
    duration: {seconds: 30, name: 'Duration'}, invalid: {seconds: 1, nanoseconds: 1e9}, absent: null};
  const result = isoValues(source);
  assert.equal(result.epoch, '1970-01-01T00:00:00.123Z');
  assert.equal(result.beforeEpoch, '1969-12-31T23:59:59.000Z');
  assert.deepEqual(result.nested, [{date: '2026-10-05T00:00:00.000Z'}, '2026-10-05T00:00:00.000Z']);
  assert.deepEqual(result.duration, source.duration);
  assert.deepEqual(result.invalid, source.invalid);
  assert.equal(result.absent, null);
  assert.deepEqual(source.epoch, {seconds: 0, nanoseconds: 123000000});
});

for (const [name, format] of Object.entries(formats)) {
  test(`promises accept applicable legacy fees for multiple pupils with ${name} dates`, async () => {
    const f = setup(format);
    for (const pupilId of ['first-pupil', 'second-pupil']) {
      const note = await f.server.createFeeReminder({...f.input, pupilId, requestId: pupilId}, actor);
      assert.equal(note.pupilId, pupilId);
      assert.equal(note.balanceAtCreation, 300000);
      assert.equal(note.scopes[0].academicYearId, 'current');
      assert.equal(note.scopes[0].termId, 'term3-2026');
    }
    assert.equal([...f.documents.keys()].filter(path => path.startsWith('feeReminders/')).length, 2);
    assert.equal([...f.documents.keys()].some(path => path.startsWith('payments/')), false);
  });

  test(`custom notes create and evaluate applicable fees for multiple pupils with ${name} dates`, async () => {
    const f = setup(format);
    for (const pupilId of ['first-pupil', 'second-pupil']) {
      const input: CreateCustomFeeNoteInput = {kind: 'custom', requestId: pupilId, pupilId,
        academicYearId: 'current', termId: 'term3-2026',
        scopes: [{feeStructureId: 'tuition', academicYearId: 'current', termId: 'term3-2026'}],
        custom: {message: 'Balance: [Balance]', fields: [{label: 'Balance', metric: 'balance'}], condition: {type: 'scheduled'}},
        scheduleDate: f.input.scheduleDate, scheduleTime: f.input.scheduleTime};
      const note = await f.server.createFeeReminder(input, actor);
      assert.equal(note.balanceAtCreation, 300000);
      await f.server.dispatchFeeReminder(note.id, new Date(note.dueAt));
      assert.equal(f.documents.get(`feeReminders/${pupilId}`).reminderStatus, 'sent');
      assert.match(f.documents.get(`feeReminders/${pupilId}`).renderedMessage, /300,000/);
    }
  });
}

test('legacy dates retain historical-period and year-disable restrictions', async () => {
  const f = setup(formats.legacy);
  const input = {...f.input, feeId: 'previous-balance', scopes: [
    {feeStructureId: 'tuition', academicYearId: 'current', termId: 'term2-2026'},
  ]};
  const note = await f.server.createFeeReminder(input, actor);
  assert.equal(note.balanceAtCreation, 300000);
  await assert.rejects(() => f.server.createFeeReminder({...input, requestId: 'same-period', scopes: [
    {...input.scopes[0], termId: 'term3-2026'},
  ]}, actor), /earlier terms/);
  f.seed('feeStructures/tuition', {...f.documents.get('feeStructures/tuition'), disableHistory: [
    {disableType: 'from_year_onwards', startYearId: 'current'},
  ]});
  await assert.rejects(() => f.server.createFeeReminder({...f.input, requestId: 'disabled'}, actor), /not available/);
});
