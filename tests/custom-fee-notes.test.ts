import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {feeReminderFixture} from './helpers/fee-reminders-fixture';
import {customFeeRows, renderCustomNote, customConditionMet, customNotePushBody, validateCustomNoteInput, type CustomFeeContext, type CreateCustomFeeNoteInput} from '../src/lib/fees/custom-fee-notes';
import {reminderLocalDate, type FeeReminder} from '../src/lib/fees/fee-reminders';
import type {SystemUser} from '../src/types';
const require = createRequire(import.meta.url), bundled = require('../functions/fee-custom-engine');
const actor = {id: 'cashier', username: 'cashier', firstName: 'Fee', lastName: 'Collector', role: 'Staff', isActive: true,
  modulePermissions: [{module: 'fees', permission: 'edit'}], createdAt: ''} as SystemUser;
const scope = {feeStructureId: 'tuition', academicYearId: 'year', termId: 'term', feeName: 'Tuition', academicYearName: '2026', termName: 'Term 3'};
function context(): CustomFeeContext {
  return {pupil: {id: 'joan', firstName: 'Joan', lastName: 'Kagwa', classId: 'p5', section: 'Day', assignedFees: []} as any,
    years: [{id: 'year', name: '2026', startDate: '2026-01-01', endDate: '2026-12-31', terms: [{id: 'term', name: 'Term 3', startDate: '2026-09-01', endDate: '2026-12-01'}]}] as any,
    fees: [{id: 'tuition', name: 'Tuition', amount: 40000, category: 'Tuition Fee', isRequired: true, status: 'active'}] as any,
    adjustments: [], holidays: [], payments: [], tracking: [], uniforms: [], className: 'Primary Five'};
}
function modelNote(): FeeReminder {
  return {id: 'custom', kind: 'custom', pupilId: 'joan', pupilName: 'Joan Kagwa', scopes: [scope], baselinePaymentIds: ['old'],
    createdAt: '2026-09-26T06:00:00Z', dueAt: '2026-10-03T06:00:00Z',
    custom: {message: '[Pupil name] in [Class] owes [Balance] on [Date]. [Fees with balances]. Calculation: [Difference].',
      fields: [{label: 'Pupil name', metric: 'pupil_name'}, {label: 'Class', metric: 'class'}, {label: 'Balance', metric: 'balance'},
        {label: 'Date', metric: 'date'}, {label: 'Fees with balances', metric: 'fees_with_balances'},
        {label: 'Difference', calculation: [{operator: '+', metric: 'fees'}, {operator: '-', metric: 'paid'}]}], condition: {type: 'scheduled'}}} as FeeReminder;
}
function setup(condition: CreateCustomFeeNoteInput['custom']['condition'] = {type: 'scheduled'}) {
  const f = feeReminderFixture(), c = context();
  f.seed('pupils/joan', c.pupil); f.seed('classes/p5', {name: c.className});
  f.seed('academicYears/year', c.years[0]); f.seed('feeStructures/tuition', c.fees[0]);
  f.seed('system_users/cashier', actor); f.seed('subscriptions/cashier', {});
  const input: CreateCustomFeeNoteInput = {kind: 'custom', requestId: 'custom', pupilId: 'joan', academicYearId: 'year', termId: 'term', scopes: [scope],
    custom: {...modelNote().custom!, condition}, scheduleDate: reminderLocalDate(new Date(Date.now() + 2 * 86400000)), scheduleTime: '09:00'};
  return {...f, input};
}
function payment(f: ReturnType<typeof setup>, note: FeeReminder, id: string, amount: number, date: Date, extra = {}) {
  f.seed(`payments/${id}`, {pupilId: note.pupilId, feeStructureId: 'tuition', academicYearId: 'year', termId: 'term', amount, paymentDate: date.toISOString(), ...extra});
}

test('inline names, class, balances, fee lists and subtraction use deadline-dated receipts', () => {
  const c = context(), note = modelNote(), due = new Date(note.dueAt);
  c.payments = [
    {id: 'old', pupilId: 'joan', ...scope, amount: 5000, paymentDate: '2026-09-25T06:00:00Z'},
    {id: 'new', pupilId: 'joan', ...scope, amount: 15000, paymentDate: '2026-10-01T06:00:00Z'},
    {id: 'late', pupilId: 'joan', ...scope, amount: 20000, paymentDate: '2026-10-04T06:00:00Z'},
    {id: 'reversed', pupilId: 'joan', ...scope, amount: 99999, paymentDate: '2026-10-01T06:00:00Z', reverted: true},
  ] as any;
  const rows = customFeeRows(note, c, due), body = renderCustomNote(note, rows, c.className, due);
  assert.equal(rows[0].balance, 20000); assert.equal(rows[0].paid_since_note, 15000);
  assert.match(body, /Joan Kagwa in Primary Five owes 20,000 shillings on 3 October 2026/);
  assert.match(body, /Tuition: 20,000 shillings balance/); assert.match(body, /Calculation: 20,000 shillings/);
  assert.deepEqual(bundled.customFeeRows(note, c, due), rows, 'Firebase and the application share canonical calculations');
  assert.equal(bundled.renderCustomNote(note, rows, c.className, due), body);
});

test('selected fee totals do not net an overpayment against another fee; carry-forward receipts retain their original scope', () => {
  const c = context(), note = modelNote();
  c.fees.push({...c.fees[0], id: 'meals', name: 'Meals', amount: 10000}); note.scopes.push({...scope, feeStructureId: 'meals', feeName: 'Meals'});
  c.payments = [{id: 'carry', pupilId: 'joan', feeStructureId: 'previous-balance', academicYearId: 'later', termId: 'later',
    isCarryForwardPayment: true, originalFeeStructureId: 'tuition', originalAcademicYearId: 'year', originalTermId: 'term', amount: 50000, paymentDate: '2026-10-01T06:00:00Z'}] as any;
  const rows = customFeeRows(note, c, new Date(note.dueAt));
  assert.equal(rows[0].balance, 0); assert.equal(rows[1].balance, 10000);
  assert.equal(customConditionMet({...note.custom!, condition: {type: 'cleared'}}, rows), false);
  assert.match(renderCustomNote(note, rows, c.className, new Date(note.dueAt)), /owes 10,000 shillings/);
});

test('live totals honour adjusted charges, valid discounts, fee holidays and historical class scopes', () => {
  const c = context(), note = modelNote();
  c.adjustments = [{feeStructureId: 'tuition', startYearId: 'year', effectivePeriodType: 'specific_year', adjustmentType: 'increase', amount: 10000, createdAt: '2026-01-01'}] as any;
  // Use a full waiver so no out-of-date gross fee can produce a false debt.
  c.holidays = [{pupilId: 'joan', isActive: true, categories: ['required'], discountType: 'full'}] as any;
  assert.equal(customFeeRows(note, c, new Date(note.dueAt))[0].balance, 0);
  c.holidays = []; c.fees[0].classFeeType = 'specific'; c.fees[0].classIds = ['p4'];
  assert.throws(() => customFeeRows(note, c, new Date(note.dueAt), true), /does not apply/);
  c.snapshots = [{academicYearId: 'year', termId: 'term', classId: 'p4', section: 'Day'}] as any;
  assert.ok(customFeeRows(note, c, new Date(note.dueAt), true)[0].fees > 0);
});

test('custom inputs reject unknown tokens, duplicate scopes, unavailable inline scope indices and executable expressions', () => {
  const f = setup(); assert.equal(validateCustomNoteInput(f.input).kind, 'custom');
  for (const custom of [
    {...f.input.custom, message: '[Unknown]'},
    {...f.input.custom, fields: [{label: 'Bad', metric: 'eval'}]},
    {...f.input.custom, fields: [{label: 'Bad', metric: 'balance', scopeIndexes: [99]}]},
    {...f.input.custom, fields: [{label: 'Bad', calculation: [{operator: '+', amount: NaN}]}]},
    {...f.input.custom, fields: [{label: 'Bad', calculation: [{operator: '*', amount: 5}]}]},
    {...f.input.custom, condition: {type: 'paid_below', amount: -1}},
  ]) assert.throws(() => validateCustomNoteInput({...f.input, custom}));
  assert.throws(() => validateCustomNoteInput({...f.input, scopes: [scope, scope]}), /unique/);
});

test('custom creation is atomic, replays once, retains recipients and never writes payments', async () => {
  const f = setup(), input = f.server.validateFeeReminderInput({...f.input, recipientIds: ['cashier']});
  const [first, second] = await Promise.all([f.server.createFeeReminder(input, actor), f.server.createFeeReminder(input, actor)]);
  assert.equal(first.id, second.id); assert.equal(first.kind, 'custom'); assert.equal(first.className, 'Primary Five');
  assert.equal(f.documents.get('scheduledDispatchQueue/fee-reminder-custom').status, 'scheduled');
  assert.deepEqual(Array.from(first.recipientIds), ['cashier']);
  assert.equal([...f.documents.keys()].filter(path => path.startsWith('payments/')).length, 0);
  await assert.rejects(() => f.server.createFeeReminder({...input, custom: {...input.custom, message: 'Different'}}, actor), /different reminder/);
});

test('a fully custom balance notice remains scheduled even when all fees are paid early', async () => {
  const f = setup(), note = await f.server.createFeeReminder(f.input, actor), at = new Date(Date.parse(note.createdAt) + 60000);
  payment(f, note, 'full', 40000, at); await f.server.reconcileFeeReminders('joan', at);
  assert.equal(f.documents.get('feeReminders/custom').reminderStatus, 'scheduled'); assert.equal(f.pushes.length, 0);
  await f.server.dispatchFeeReminder(note.id, new Date(note.dueAt));
  assert.match(f.pushes[0].payload.body, /owes 0 shillings/); assert.equal(f.pushes[0].payload.data.type, 'FEE_REMINDER_ALERT');
});

test('a cleared-fees condition sends immediately once, with a current class, and retires the deadline job', async () => {
  const f = setup({type: 'cleared'}), note = await f.server.createFeeReminder(f.input, actor), at = new Date(Date.parse(note.createdAt) + 60000);
  payment(f, note, 'partial', 15000, at); await f.server.reconcileFeeReminders('joan', at); assert.equal(f.pushes.length, 0);
  payment(f, note, 'rest', 25000, at); f.seed('classes/p5', {name: 'P5 North'});
  await f.server.reconcileFeeReminders('joan', at); await f.server.reconcileFeeReminders('joan', at);
  assert.equal(f.pushes.length, 1); assert.match(f.pushes[0].payload.body, /P5 North owes 0 shillings/);
  assert.equal(f.documents.get('feeReminders/custom').reminderStatus, 'sent');
  assert.equal(f.documents.get('scheduledDispatchQueue/fee-reminder-custom').status, 'completed');
  assert.equal((await f.server.dispatchFeeReminder(note.id, new Date(note.dueAt))).skipped, true);
});

test('a payment target excludes old, backdated, reverted and wrong-period receipts and includes multiple new instalments', async () => {
  const f = setup({type: 'paid_at_least', amount: 20000});
  f.seed('payments/old', {pupilId: 'joan', ...scope, amount: 20000, paymentDate: new Date().toISOString()});
  const note = await f.server.createFeeReminder(f.input, actor), at = new Date(Date.parse(note.createdAt) + 60000);
  payment(f, note, 'backdated', 20000, new Date(Date.parse(note.createdAt) - 60000));
  payment(f, note, 'reverted', 20000, at, {reverted: true}); payment(f, note, 'wrong-period', 20000, at, {termId: 'other'});
  await f.server.reconcileFeeReminders('joan', at); assert.equal(f.pushes.length, 0);
  payment(f, note, 'part1', 15000, at); await f.server.reconcileFeeReminders('joan', at); assert.equal(f.pushes.length, 0);
  payment(f, note, 'part2', 5000, at); await f.server.reconcileFeeReminders('joan', at); assert.equal(f.pushes.length, 1);
});

test('deadline shortfall uses the original cutoff even when the scheduler runs after another payment', async () => {
  const f = setup({type: 'paid_below', amount: 20000}), note = await f.server.createFeeReminder(f.input, actor);
  payment(f, note, 'partial', 15000, new Date(Date.parse(note.createdAt) + 60000));
  payment(f, note, 'late', 25000, new Date(Date.parse(note.dueAt) + 60000));
  await f.server.dispatchFeeReminder(note.id, new Date(Date.parse(note.dueAt) + 120000));
  assert.equal(f.pushes.length, 1); assert.match(f.pushes[0].payload.body, /owes 25,000 shillings/);
  assert.equal(f.documents.get('feeReminders/custom').evaluatedFees[0].paid_since_note, 15000);
  assert.equal(f.documents.get('feeReminders/custom').evaluatedAt, note.dueAt);
});

test('a condition that was not met closes with an explicit outcome and sends no misleading notice', async () => {
  const f = setup({type: 'not_cleared'}), note = await f.server.createFeeReminder(f.input, actor);
  payment(f, note, 'full', 40000, new Date(Date.parse(note.createdAt) + 60000));
  await f.server.dispatchFeeReminder(note.id, new Date(note.dueAt));
  assert.equal(f.pushes.length, 0); assert.equal(f.documents.get('feeReminders/custom').reminderStatus, 'not_triggered');
  assert.match(f.documents.get('feeReminders/custom').lastOutcome, /no notification sent/);
});

test('live conditions stop at their deadline; late receipts cannot satisfy them', async () => {
  const f = setup({type: 'paid_at_least', amount: 20000}), note = await f.server.createFeeReminder(f.input, actor), at = new Date(Date.parse(note.dueAt) + 60000);
  payment(f, note, 'late', 20000, at); await f.server.reconcileFeeReminders('joan', at); assert.equal(f.pushes.length, 0);
  await f.server.dispatchFeeReminder(note.id, at); assert.equal(f.pushes.length, 0);
  assert.equal(f.documents.get('feeReminders/custom').reminderStatus, 'not_triggered');
});

test('failed custom pushes retry the saved dated message, preserving the inbox read state', async () => {
  const f = setup(), note = await f.server.createFeeReminder(f.input, actor); f.failPushUsers.add('cashier');
  await assert.rejects(() => f.server.dispatchFeeReminder(note.id, new Date(note.dueAt)), /delivery failed/);
  const saved = f.documents.get('feeReminders/custom').renderedMessage;
  const delivery = f.documents.get('notificationDeliveries/fee-reminder-custom-cashier'); delivery.status = 'read';
  f.failPushUsers.clear(); payment(f, note, 'late', 40000, new Date(Date.parse(note.dueAt) + 60000));
  await f.server.dispatchFeeReminder(note.id, new Date(Date.parse(note.dueAt) + 120000));
  assert.equal(f.pushes.at(-1).payload.body, saved); assert.equal(delivery.status, 'read');
  assert.equal(f.documents.get('feeReminders/custom').customDeliveryPending, false);
});

test('cancelled custom notes immediately explain cancellation without inventing a payment promise', async () => {
  const f = setup(), note = await f.server.createFeeReminder(f.input, actor);
  await f.server.cancelFeeReminder(note.id, actor, 'Meeting rescheduled');
  assert.equal(f.pushes.length, 1); assert.equal(f.pushes[0].payload.data.type, 'FEE_REMINDER_RESOLVED');
  assert.match(f.pushes[0].payload.body, /custom Fees note.*Joan Kagwa/); assert.match(f.pushes[0].payload.body, /Meeting rescheduled/);
  assert.doesNotMatch(f.pushes[0].payload.body, /0 shillings promise/);
  await f.server.dispatchFeeReminder(note.id, new Date(note.dueAt)); assert.equal(f.pushes.length, 1);
});

test('opening Notes returns live fee amounts while preserving the sent snapshot', async () => {
  const f = setup(), note = await f.server.createFeeReminder(f.input, actor);
  payment(f, note, 'partial', 15000, new Date(Date.parse(note.createdAt) - 1));
  const live = await f.server.withLiveCustomFeeDetails([note], 'joan');
  assert.match(live[0].liveMessage, /owes 25,000 shillings/); assert.equal(live[0].liveFees[0].balance, 25000);
  assert.equal(f.documents.get('feeReminders/custom').renderedMessage, undefined);
});

test('all supported condition boundaries use actual selected balances and receipts', () => {
  const rows = customFeeRows(modelNote(), context(), new Date(modelNote().dueAt));
  const check = (type: any, amount?: number) => customConditionMet({...modelNote().custom!, condition: {type, ...(amount ? {amount} : {})}}, rows);
  assert.equal(check('scheduled'), true); assert.equal(check('not_cleared'), true); assert.equal(check('cleared'), false);
  assert.equal(check('no_payment'), true); assert.equal(check('paid_below', 20000), true); assert.equal(check('paid_at_least', 20000), false);
  assert.equal(check('balance_above', 40000), false); assert.equal(check('balance_above', 39999), true);
  rows[0].paid_since_note = 20000; assert.equal(check('paid_at_least', 20000), true); assert.equal(check('paid_below', 20000), false); assert.equal(check('no_payment'), false);
});

test('long Unicode messages stay within push limits while the inbox retains their complete text', () => {
  const long = 'A parent’s note 📚 '.repeat(200), shortened = customNotePushBody(long);
  assert.ok(new TextEncoder().encode(shortened).length < 2500); assert.match(shortened, /Open Notes for the full message/);
  assert.equal(customNotePushBody('Joan owes 20,000 shillings.'), 'Joan owes 20,000 shillings.');
});

test('a plain custom note can be scheduled without fee fields, phone numbers or any selected fees', async () => {
  const f = setup(), input = f.server.validateFeeReminderInput({...f.input, scopes: [], custom: {
    message: 'Meet [Name]’s guardian in the office on [Date].', fields: [{label: 'Name', metric: 'pupil_name'}, {label: 'Date', metric: 'date'}], condition: {type: 'scheduled'},
  }});
  const note = await f.server.createFeeReminder(input, actor); await f.server.dispatchFeeReminder(note.id, new Date(note.dueAt));
  assert.equal(f.pushes.length, 1); assert.match(f.pushes[0].payload.body, /Meet Joan Kagwa’s guardian in the office/);
  assert.throws(() => validateCustomNoteInput({...input, custom: {...input.custom, condition: {type: 'cleared'}}}), /Choose fee items/);
});

test('revoked recipients are excluded and a failed custom note can be retargeted and delivered', async () => {
  const f = setup(); f.seed('system_users/other', {...actor, id: 'other', firstName: 'Other'});
  const note = await f.server.createFeeReminder({...f.input, recipientIds: ['other']}, actor);
  f.seed('system_users/other', {...actor, id: 'other', modulePermissions: []});
  await assert.rejects(() => f.server.dispatchFeeReminder(note.id, new Date(note.dueAt)), /Choose new recipients/);
  assert.equal(f.documents.get('feeReminders/custom').reminderStatus, 'failed');
  await f.server.updateFeeReminderRecipients(note.id, ['cashier'], actor);
  await f.server.dispatchFeeReminder(note.id, new Date(note.dueAt));
  assert.deepEqual(f.pushes.map(push => push.userId), ['cashier']);
});
