import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {feeReminderFixture} from './helpers/fee-reminders-fixture';
import {reminderLocalDate} from '../src/lib/fees/fee-reminders';
import type {SystemUser} from '../src/types';
const actor = {id: 'cashier', username: 'cashier', firstName: 'Fee', lastName: 'Collector', role: 'Staff', isActive: true,
  modulePermissions: [{module: 'fees', permission: 'edit'}], createdAt: ''} as SystemUser;
const scope = {feeStructureId: 'tuition', academicYearId: 'year', termId: 'term'};
function setup() {
  const f = feeReminderFixture();
  f.seed('pupils/joan', {firstName: 'Joan', lastName: 'Kagwa', classId: 'p5', assignedFees: []});
  f.seed('classes/p5', {name: 'Primary Five'});
  f.seed('academicYears/year', {name: '2026', startDate: '2026-01-01', endDate: '2026-12-31', terms: [{id: 'term', name: 'Term 3', startDate: '2026-09-01', endDate: '2026-12-01'}]});
  f.seed('feeStructures/tuition', {name: 'Tuition', amount: 40000, category: 'Tuition Fee', status: 'active', isRequired: true});
  f.seed('system_users/cashier', actor); f.seed('subscriptions/cashier', {});
  const input = {requestId: 'promise', pupilId: 'joan', feeId: 'tuition', academicYearId: 'year', termId: 'term', promisedAmount: 20000,
    promisedBy: 'Rose Kagwa', phone: '+256700123456', additionalNote: '', scheduleDate: reminderLocalDate(new Date(Date.now() + 86400000)), scheduleTime: '09:00'};
  const payment = (id: string, amount: number, extra = {}) => f.seed(`payments/${id}`, {pupilId: 'joan', ...scope, amount,
    paymentDate: new Date().toISOString(), ...extra});
  return {...f, input, payment};
}
const change = {pupilIds: ['joan'], scopes: [scope]};
test('the first missing marker migrates once; later payments without notes perform only one marker read', async () => {
  const f = setup(); await f.server.processFeeReminderChange(change);
  assert.ok(f.documents.has('feeReminderTargets/joan'));
  f.reads.length = 0; f.failReads.add('feeReminders'); f.failReads.add('payments');
  await f.server.processFeeReminderChange(change);
  assert.deepEqual(f.reads, ['feeReminderTargets/joan']);
  assert.equal([...f.documents].some(([, data]) => data.channel === 'fee_reconcile'), false);
});
test('creating a note publishes its marker atomically; an unrelated fee skips ledger reads', async () => {
  const f = setup(); await f.server.createFeeReminder(f.input, actor);
  assert.ok(f.documents.get('feeReminderTargets/joan').entries.promise);
  f.reads.length = 0; f.failReads.add('payments');
  await f.server.processFeeReminderChange({pupilIds: ['joan'], scopes: [{...scope, feeStructureId: 'other'}]});
  assert.deepEqual(f.reads, ['feeReminderTargets/joan']);
});

test('an unavailable initial note lookup preserves pupil recovery for the scheduler', async () => {
  const f = setup(); f.failReads.add('feeReminders');
  await f.server.processFeeReminderChangeSafely(change);
  const job = [...f.documents].find(([, data]) => data.channel === 'fee_reconcile')![1];
  assert.ok(job); assert.equal(job.reminderIds.length, 0);
  f.failReads.clear(); await f.server.dispatchFeeReconciliation(job.sourceId, job.reminderIds);
});
test('post-payment processing cancels a paid promise immediately and repeated callbacks send no duplicate', async () => {
  const f = setup(); await f.server.createFeeReminder(f.input, actor);
  f.payment('part', 15000); await f.server.processFeeReminderChange(change);
  assert.equal(f.documents.get('feeReminders/promise').reminderStatus, 'scheduled'); assert.equal(f.pushes.length, 0);
  f.payment('rest', 5000); await f.server.processFeeReminderChange(change);
  assert.equal(f.documents.get('feeReminders/promise').reminderStatus, 'fulfilled');
  assert.equal(f.documents.get('scheduledDispatchQueue/fee-reminder-promise').status, 'cancelled');
  assert.equal(f.pushes.length, 1); assert.match(f.pushes[0].payload.body, /No follow-up call is needed/);
  await f.server.processFeeReminderChange(change); assert.equal(f.pushes.length, 1);
});
test('a reversal includes fulfilled markers and restores the original deadline without touching payment records', async () => {
  const f = setup(); await f.server.createFeeReminder(f.input, actor); f.payment('full', 20000);
  await f.server.processFeeReminderChange(change);
  const original = f.documents.get('payments/full'); f.seed('payments/full', {...original, reverted: true});
  await f.server.processFeeReminderChange({...change, reversal: true});
  assert.equal(f.documents.get('feeReminders/promise').reminderStatus, 'scheduled');
  assert.equal(f.documents.get('scheduledDispatchQueue/fee-reminder-promise').status, 'scheduled');
  assert.equal(f.documents.get('payments/full').reverted, true);
});

test('carry-forward allocations resolve their original fee from committed payment data', async () => {
  const f = setup(); await f.server.createFeeReminder(f.input, actor);
  f.payment('carry', 20000, {feeStructureId: 'previous-balance', isCarryForwardPayment: true,
    originalFeeStructureId: 'tuition', originalAcademicYearId: 'year', originalTermId: 'term'});
  await f.server.processFeeReminderChange({pupilIds: ['joan'], scopes: [{...scope, feeStructureId: 'previous-balance'}]});
  assert.equal(f.documents.get('feeReminders/promise').reminderStatus, 'fulfilled');
  assert.equal(f.pushes.length, 1);
});
test('failed immediate delivery leaves a durable scheduler retry while payment and fulfillment remain committed', async () => {
  const f = setup(); await f.server.createFeeReminder(f.input, actor); f.payment('full', 20000); f.failPushUsers.add('cashier');
  await f.server.processFeeReminderChangeSafely(change);
  assert.equal(f.documents.get('payments/full').amount, 20000);
  assert.equal(f.documents.get('feeReminders/promise').reminderStatus, 'fulfilled');
  const job = [...f.documents].find(([, data]) => data.channel === 'fee_reconcile' && data.status === 'scheduled')![1];
  assert.ok(job); f.failPushUsers.clear(); await f.server.dispatchFeeReconciliation(job.sourceId, job.reminderIds);
  assert.equal(f.documents.get('feeReminders/promise').dismissalPending, false);
  const count = f.pushes.length; await f.server.dispatchFeeReconciliation(job.sourceId, job.reminderIds); assert.equal(f.pushes.length, count);
});
test('manual cancellation stores its retry job in the same commit and retries only the explanatory update', async () => {
  const f = setup(); await f.server.createFeeReminder(f.input, actor); f.failPushUsers.add('cashier');
  await f.server.cancelFeeReminder('promise', actor, 'Recorded twice');
  const job = f.documents.get('scheduledDispatchQueue/fee-reconcile-cancelled-promise-v2'); assert.ok(job);
  assert.equal(f.documents.get('feeReminders/promise').reminderStatus, 'cancelled');
  f.failPushUsers.clear(); await f.server.dispatchFeeReconciliation(job.sourceId, job.reminderIds);
  assert.match(f.pushes.at(-1).payload.body, /Recorded twice/);
  assert.equal(f.documents.get('feeReminderTargets/joan').entries.promise, undefined);
});
function custom(f: ReturnType<typeof setup>, condition: any) {
  return f.server.createFeeReminder({kind: 'custom', requestId: 'custom', pupilId: 'joan', academicYearId: 'year', termId: 'term', scopes: [scope],
    scheduleDate: f.input.scheduleDate, scheduleTime: '09:00', custom: {message: '[Name] owes [Balance].',
      fields: [{label: 'Name', metric: 'pupil_name'}, {label: 'Balance', metric: 'balance'}], condition}}, actor);
}
test('an already-met custom condition is sent on creation without waiting for a Firebase trigger', async () => {
  const f = setup(); f.payment('previous', 40000); await custom(f, {type: 'cleared'});
  assert.equal(f.pushes.length, 1); assert.match(f.pushes[0].payload.body, /Joan Kagwa owes 0 shillings/);
  assert.equal(f.documents.get('feeReminders/custom').reminderStatus, 'sent');
});
test('a waiver or fee catalog adjustment can satisfy a custom condition immediately through the same marker', async () => {
  const f = setup(); await custom(f, {type: 'cleared'}); assert.equal(f.pushes.length, 0);
  f.seed('feesHolidays/full', {pupilId: 'joan', isActive: true, categories: ['required'], discountType: 'full'});
  await f.server.processFeeReminderChange({feeIds: ['tuition']});
  assert.equal(f.pushes.length, 1); assert.match(f.pushes[0].payload.body, /0 shillings/);
});
test('deadline-only custom conditions skip payment-time calculations and still run through the due dispatcher', async () => {
  const f = setup(); const note = await custom(f, {type: 'no_payment'}); f.reads.length = 0; f.failReads.add('payments');
  await f.server.processFeeReminderChange(change); assert.deepEqual(f.reads, ['feeReminderTargets/joan']);
  f.failReads.clear(); await f.server.dispatchFeeReminder(note.id, new Date(note.dueAt)); assert.equal(f.pushes.length, 1);
});
test('reminder callbacks and retry dispatches contain no Firebase function exports or identity bridge', () => {
  assert.doesNotMatch(fs.readFileSync('functions/index.js', 'utf8'), /exports\.feeReminder|fee-reminder-web-push/);
  assert.equal(fs.existsSync('src/app/api/fees/reminders/function-delivery/route.ts'), false);
  const scheduler = fs.readFileSync('src/app/api/cron/send-scheduled-sms/route.ts', 'utf8');
  assert.match(scheduler, /dispatchFeeReconciliation\(claimed.sourceId, claimed.reminderIds\)/);
  const schoolpay = fs.readFileSync('src/lib/services/schoolpay-integration.service.ts', 'utf8');
  assert.match(schoolpay, /await processFeeReminderChangeSafely\(\{pupilIds: \[pupil.id\]\}\)/);
  assert.ok(schoolpay.indexOf('await processFeeReminderChangeSafely') < schoolpay.indexOf('await this.storePaymentMapping', schoolpay.indexOf('await processFeeReminderChangeSafely')));
});
