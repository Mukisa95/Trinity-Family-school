import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as model from '../src/lib/fees/fee-reminders';
import { feeReminderFixture } from './helpers/fee-reminders-fixture';
import type { SystemUser } from '../src/types';

const actor = { id: 'cashier', username: 'cashier', firstName: 'Fee', lastName: 'Collector', role: 'Staff', isActive: true,
  modulePermissions: [{ module: 'fees', permission: 'edit' }], createdAt: '' } as SystemUser;

function setup() {
  const f = feeReminderFixture();
  f.seed('pupils/joan', { firstName: 'Joan', lastName: 'Kagwa', classId: 'p5', section: 'Day', assignedFees: [] });
  f.seed('academicYears/year', { name: '2026', startDate: '2026-01-01', endDate: '2026-12-31', terms: [
    { id: 'term2', name: 'Term 2', startDate: '2026-05-01', endDate: '2026-08-01' },
    { id: 'term3', name: 'Term 3', startDate: '2026-09-01', endDate: '2026-12-01' },
  ] });
  f.seed('feeStructures/tuition', { name: 'Tuition', amount: 40_000, category: 'Tuition Fee', status: 'active', isRequired: true });
  const future = new Date(Date.now() + 2 * 86_400_000);
  const input = { requestId: 'test-request', pupilId: 'joan', feeId: 'tuition', academicYearId: 'year', termId: 'term3',
    promisedAmount: 20_000, promisedBy: 'Rose Kagwa', phone: '+256700123456', additionalNote: '',
    scheduleDate: model.reminderLocalDate(future), scheduleTime: '09:00' };
  return { ...f, input };
}

test('a promise and its scheduled job are saved atomically without changing payments', async () => {
  const f = setup();
  const note = await f.server.createFeeReminder(f.input, actor);
  assert.equal(note.balanceAtCreation, 40_000); assert.equal(note.pupilName, 'Joan Kagwa');
  assert.equal(f.documents.get('scheduledDispatchQueue/fee-reminder-test-request').channel, 'fee_reminder');
  assert.equal(f.documents.get('feeReminders/test-request').reminderStatus, 'scheduled');
  assert.equal([...f.documents.keys()].some(path => path.startsWith('payments/')), false);
});

test('a replay or simultaneous double-click creates one note and one job', async () => {
  const f = setup();
  const notes = await Promise.all([f.server.createFeeReminder(f.input, actor), f.server.createFeeReminder(f.input, actor)]);
  assert.equal(notes[0].id, notes[1].id);
  assert.equal([...f.documents.keys()].filter(path => path.startsWith('feeReminders/')).length, 1);
  assert.equal([...f.documents.keys()].filter(path => path.startsWith('scheduledDispatchQueue/')).length, 1);
  await assert.rejects(() => f.server.createFeeReminder({ ...f.input, promisedAmount: 15_000 }, actor), /different reminder/);
});

test('server balance validation rejects cleared or oversized promises and honours fee holidays', async () => {
  const f = setup();
  await assert.rejects(() => f.server.createFeeReminder({ ...f.input, promisedAmount: 41_000 }, actor), /exceeds.*balance/);
  f.seed('feesHolidays/full', { pupilId: 'joan', isActive: true, categories: ['required'], discountType: 'full' });
  await assert.rejects(() => f.server.createFeeReminder(f.input, actor), /balance has changed/);
  assert.equal(f.documents.has('feeReminders/test-request'), false);
});

test('creation snapshots existing matching payments so they cannot satisfy the new promise', async () => {
  const f = setup();
  f.seed('payments/old', { pupilId: 'joan', feeStructureId: 'tuition', academicYearId: 'year', termId: 'term3', amount: 10_000,
    paymentDate: new Date().toISOString(), createdAt: new Date().toISOString() });
  const note = await f.server.createFeeReminder(f.input, actor);
  assert.equal(note.balanceAtCreation, 30_000); assert.deepEqual(Array.from(note.baselinePaymentIds), ['old']);
});

test('uniform notes verify that the tracking record belongs to this pupil and period', async () => {
  const f = setup();
  f.seed('uniformTracking/uniform1', { pupilId: 'joan', academicYearId: 'year', termId: 'term3', finalAmount: 30_000, selectionMode: 'full' });
  const note = await f.server.createFeeReminder({ ...f.input, feeId: 'uniform-uniform1' }, actor);
  assert.equal(note.feeName, 'Full Uniform Set');
  await assert.rejects(() => f.server.createFeeReminder({ ...f.input, requestId: 'other', feeId: 'uniform-missing' }, actor), /does not belong/);
});

test('previous balances retain their original item scopes and reject nonhistorical or duplicate scopes', async () => {
  const f = setup();
  const input = { ...f.input, feeId: 'previous-balance', scopes: [{ feeStructureId: 'tuition', academicYearId: 'year', termId: 'term2' }] };
  const note = await f.server.createFeeReminder(input, actor);
  assert.equal(note.feeName, 'Previous Term Balances'); assert.equal(note.scopes[0].termId, 'term2');
  await assert.rejects(() => f.server.createFeeReminder({ ...input, requestId: 'bad-period', scopes: [{ ...input.scopes[0], termId: 'term3' }] }, actor), /earlier terms/);
  assert.throws(() => f.server.validateFeeReminderInput({ ...input, scopes: [input.scopes[0], input.scopes[0]] }), /duplicate/);
});

test('invalid dates, phone numbers, amounts and identifiers fail before creating jobs', () => {
  const f = setup();
  for (const patch of [{ phone: 'abc' }, { promisedAmount: 0 }, { promisedAmount: 2.5 }, { pupilId: '../other' },
    { scheduleDate: '2026-02-30' }, { scheduleTime: '24:00' }]) {
    assert.throws(() => f.server.validateFeeReminderInput({ ...f.input, ...patch }));
  }
  assert.equal(f.server.validateFeeReminderInput({ ...f.input, phone: '+256 700 123 456' }).phone, '+256700123456');
});

test('cancelling a note also cancels its queue job and a worker sends nothing', async () => {
  const f = setup();
  await f.server.createFeeReminder(f.input, actor);
  await f.server.cancelFeeReminder(f.input.requestId, actor);
  assert.equal(f.documents.get('feeReminders/test-request').reminderStatus, 'cancelled');
  assert.equal(f.documents.get('scheduledDispatchQueue/fee-reminder-test-request').status, 'cancelled');
  const result = await f.server.dispatchFeeReminder(f.input.requestId);
  assert.equal(result.skipped, true); assert.equal(f.pushes.length, 0);
});

test('another collector cannot cancel someone else’s note or interrupt a leased dispatch', async () => {
  const f = setup();
  await f.server.createFeeReminder(f.input, actor);
  await assert.rejects(() => f.server.cancelFeeReminder(f.input.requestId, { ...actor, id: 'other' }), /creator or an administrator/);
  f.documents.get('scheduledDispatchQueue/fee-reminder-test-request').leaseUntil = f.stamp(new Date(Date.now() + 60_000));
  await assert.rejects(() => f.server.cancelFeeReminder(f.input.requestId, actor), /being sent now/);
});

test('manual cancellation immediately notifies the selected people with the pupil, fee, promise, actor and reason', async () => {
  const f = setup();
  f.seed('system_users/cashier', actor); f.seed('system_users/other', {...actor, id: 'other', firstName: 'Other'});
  f.seed('subscriptions/cashier', {}); f.seed('subscriptions/other', {});
  const note = await f.server.createFeeReminder({...f.input, recipientIds: ['other']}, actor);
  const result = await f.server.cancelFeeReminder(note.id, actor, 'The promise was recorded twice');
  assert.equal(result.updateStatus, 'sent'); assert.deepEqual(f.pushes.map(push => push.userId), ['other']);
  const push = f.pushes[0].payload;
  assert.equal(push.data.type, 'FEE_REMINDER_RESOLVED'); assert.match(push.title, /Joan Kagwa.*cancelled/);
  assert.match(push.body, /20,000 shillings.*Tuition/); assert.match(push.body, /cancelled by Fee Collector/);
  assert.match(push.body, /promise was recorded twice/); assert.match(push.body, /Do not contact the parent based on this cancelled reminder/);
  assert.match(push.body, /Cancellation does not confirm payment/);
  const update = f.documents.get('notifications/fee-reminder-update-test-request-v2');
  assert.deepEqual(Array.from(update.readBy), []); assert.equal(update.metadata.reason, 'manual');
  assert.equal(f.documents.get('notificationDeliveries/fee-reminder-update-test-request-v2-other').status, 'sent');
  assert.equal(f.documents.get('scheduledDispatchQueue/fee-reminder-test-request').status, 'cancelled');
  await f.server.cancelFeeReminder(note.id, actor, 'A different reason in a retry');
  assert.equal(f.pushes.length, 1); assert.equal(f.documents.get('feeReminders/test-request').cancelReason, 'The promise was recorded twice');
});

test('a cancellation update follows original recipients as well as the current selection, while excluding revoked access', async () => {
  const f = setup();
  f.seed('system_users/cashier', actor); f.seed('system_users/other', {...actor, id: 'other'});
  f.seed('system_users/revoked', {...actor, id: 'revoked', modulePermissions: []});
  for (const user of ['cashier', 'other', 'revoked']) f.seed(`subscriptions/${user}`, {});
  const note = await f.server.createFeeReminder({...f.input, recipientIds: ['other']}, actor);
  f.seed('notifications/fee-reminder-test-request', {recipientIds: ['cashier', 'revoked'], readBy: [], metadata: {}});
  await f.server.cancelFeeReminder(note.id, actor, 'New payment arrangement');
  assert.deepEqual(f.pushes.map(push => push.userId).sort(), ['cashier', 'other']);
  assert.equal(f.documents.get('notifications/fee-reminder-test-request').metadata.resolved, true);
});

test('the inbox receives the explanation, resolves old unread follow-ups, and preserves reads on retry', async () => {
  const f = setup(); f.seed('system_users/cashier', actor); f.seed('subscriptions/cashier', {});
  const note = await f.server.createFeeReminder(f.input, actor);
  await f.server.dispatchFeeReminder(note.id, new Date(note.dueAt));
  const oldDelivery = 'notificationDeliveries/fee-reminder-test-request-cashier';
  assert.equal(f.documents.get(oldDelivery).status, 'sent');
  f.failPushUsers.add('cashier');
  await f.server.cancelFeeReminder(note.id, actor, 'Replaced by another arrangement');
  const updateDelivery = 'notificationDeliveries/fee-reminder-update-test-request-v2-cashier';
  assert.equal(f.documents.get(updateDelivery).notificationId, 'fee-reminder-update-test-request-v2');
  assert.equal(f.documents.get(oldDelivery).status, 'read');
  f.seed(updateDelivery, {...f.documents.get(updateDelivery), status: 'read'});
  f.failPushUsers.clear(); await f.server.cancelFeeReminder(note.id, actor);
  assert.equal(f.documents.get(updateDelivery).status, 'read');
});

test('failed immediate delivery keeps the manual cancellation and readable explanation, then retries once', async () => {
  const f = setup(); f.seed('system_users/cashier', actor); f.seed('subscriptions/cashier', {});
  const note = await f.server.createFeeReminder(f.input, actor);
  f.failPushUsers.add('cashier');
  assert.equal((await f.server.cancelFeeReminder(note.id, actor, 'Wrong reminder date')).updateStatus, 'pending');
  assert.equal(f.documents.get('feeReminders/test-request').reminderStatus, 'cancelled');
  assert.equal(f.documents.get('feeReminders/test-request').dismissalPending, true);
  assert.match(f.documents.get('notifications/fee-reminder-update-test-request-v2').description, /Wrong reminder date/);
  f.failPushUsers.clear();
  assert.equal((await f.server.cancelFeeReminder(note.id, actor)).updateStatus, 'sent');
  assert.equal(f.documents.get('feeReminders/test-request').dismissalPending, false);
  assert.equal([...f.documents.keys()].filter(path => path.startsWith('notifications/fee-reminder-update-')).length, 1);
});

test('the cancellation lease prevents the API and payment trigger from double sending', async () => {
  const f = setup(); f.seed('system_users/cashier', actor); f.seed('subscriptions/cashier', {});
  const note = await f.server.createFeeReminder(f.input, actor);
  f.failPushUsers.add('cashier'); await f.server.cancelFeeReminder(note.id, actor);
  f.failPushUsers.clear(); f.pushes.length = 0;
  const attempts = await Promise.all([f.server.cancelFeeReminder(note.id, actor), f.server.cancelFeeReminder(note.id, actor)]);
  assert.ok(attempts.some(result => result.updateStatus === 'sent'));
  assert.equal(f.pushes.length, 1);
});

test('early fulfillment tells all current Fees recipients without requiring a prior alert, with safe links', async () => {
  const f = setup(); f.seed('system_users/cashier', actor);
  f.seed('system_users/structures', {...actor, id: 'structures', modulePermissions: [],
    granularPermissions: [{moduleId: 'fees', pages: [{pageId: 'list', canAccess: true, actions: []}]}]});
  f.seed('system_users/parent', {...actor, id: 'parent', role: 'Parent'});
  f.seed('system_users/disabled', {...actor, id: 'disabled', isActive: false});
  for (const user of ['cashier', 'structures', 'parent', 'disabled']) f.seed(`subscriptions/${user}`, {});
  const note = await f.server.createFeeReminder(f.input, actor);
  const at = new Date(Date.parse(note.createdAt) + 60_000);
  f.seed('payments/full', {pupilId: 'joan', feeStructureId: 'tuition', academicYearId: 'year', termId: 'term3', amount: 20000, paymentDate: at.toISOString()});
  await f.server.reconcileFeeReminders('joan', at);
  assert.deepEqual(f.pushes.map(push => push.userId).sort(), ['cashier', 'structures']);
  assert.equal(f.pushes.find(push => push.userId === 'structures').payload.url, '/notifications');
  assert.match(f.pushes[0].payload.body, /Full payment was recorded on/);
  assert.match(f.pushes[0].payload.body, /No follow-up call is needed for this promise/);
  assert.equal(f.documents.has('notifications/fee-reminder-test-request'), false);
});

test('dispatch recalculates live payments and current Fees recipients, with an inbox fallback', async () => {
  const f = setup();
  const note = await f.server.createFeeReminder(f.input, actor);
  const paymentAt = new Date(Date.parse(note.createdAt) + 60_000).toISOString();
  f.seed('payments/partial', { pupilId: 'joan', feeStructureId: 'tuition', academicYearId: 'year', termId: 'term3', amount: 15_000, paymentDate: paymentAt });
  f.seed('system_users/cashier', actor);
  const { modulePermissions: _permissions, ...staffIdentity } = actor;
  f.seed('system_users/structures', { ...staffIdentity, id: 'structures',
    granularPermissions: [{ moduleId: 'fees', pages: [{ pageId: 'list', canAccess: true, actions: [] }] }] });
  f.seed('system_users/parent', { ...actor, id: 'parent', role: 'Parent' });
  f.seed('system_users/disabled', { ...actor, id: 'disabled', isActive: false });
  f.seed('system_users/unrelated', { ...actor, id: 'unrelated', modulePermissions: [] });
  f.seed('system_users/no-device', { ...actor, id: 'no-device' });
  f.seed('subscriptions/cashier', {}); f.seed('subscriptions/structures', {});
  const result = await f.server.dispatchFeeReminder(note.id, new Date(note.dueAt));
  assert.equal(result.result.inAppSent, 3); assert.equal(f.pushes.length, 2);
  assert.equal(f.pushes.find(push => push.userId === 'cashier').payload.url, '/fees/collect/joan?notes=open');
  assert.equal(f.pushes.find(push => push.userId === 'structures').payload.url, '/notifications');
  assert.match(f.pushes[0].payload.body, /5,000 shillings less/);
  assert.equal(f.documents.get('feeReminders/test-request').reminderStatus, 'sent');
  assert.equal(f.documents.has('notificationDeliveries/fee-reminder-test-request-no-device'), true);
  await f.server.dispatchFeeReminder(note.id, new Date(note.dueAt));
  assert.equal(f.pushes.length, 2, 'Completed reminders are not resent');
});

test('retrying failed push delivery reuses inbox records and recalculates a fulfilled promise', async () => {
  const f = setup();
  const note = await f.server.createFeeReminder(f.input, actor);
  f.seed('system_users/cashier', actor); f.seed('subscriptions/cashier', {}); f.failPushUsers.add('cashier');
  await assert.rejects(() => f.server.dispatchFeeReminder(note.id, new Date(note.dueAt)), /Push delivery failed/);
  const notification = f.documents.get('notifications/fee-reminder-test-request'); notification.readBy = ['cashier'];
  f.failPushUsers.clear();
  f.seed('payments/full', { pupilId: 'joan', feeStructureId: 'tuition', academicYearId: 'year', termId: 'term3', amount: 20_000,
    paymentDate: new Date(Date.parse(note.createdAt) + 60_000).toISOString() });
  await f.server.dispatchFeeReminder(note.id, new Date(note.dueAt));
  assert.equal(f.pushes.at(-1).payload.data.type, 'FEE_REMINDER_RESOLVED');
  assert.equal(f.documents.get('feeReminders/test-request').reminderStatus, 'fulfilled');
  assert.deepEqual(f.documents.get('notifications/fee-reminder-test-request').readBy, ['cashier']);
  assert.equal([...f.documents.keys()].filter(path => path.startsWith('notificationDeliveries/')).length, 2,
    'The original reminder and its cancellation explanation each retain one inbox delivery');
});

test('a full early payment cancels the queue immediately and sends no due-date alert', async () => {
  const f = setup(); const note = await f.server.createFeeReminder(f.input, actor);
  const at = new Date(Date.parse(note.createdAt) + 60_000);
  f.seed('payments/full', { pupilId: 'joan', feeStructureId: 'tuition', academicYearId: 'year', termId: 'term3', amount: 20000, paymentDate: at.toISOString() });
  await f.server.reconcileFeeReminders('joan', at);
  assert.equal(f.documents.get('feeReminders/test-request').reminderStatus, 'fulfilled');
  assert.equal(f.documents.get('scheduledDispatchQueue/fee-reminder-test-request').status, 'cancelled');
  assert.equal((await f.server.dispatchFeeReminder(note.id, new Date(note.dueAt))).skipped, true);
  assert.equal(f.pushes.length, 0);
});

test('partial and unrelated payments leave notes active; the final instalment fulfils them', async () => {
  const f = setup(); const note = await f.server.createFeeReminder(f.input, actor);
  const at = new Date(Date.parse(note.createdAt) + 60_000);
  f.seed('payments/other', { pupilId: 'joan', feeStructureId: 'meals', academicYearId: 'year', termId: 'term3', amount: 20000, paymentDate: at.toISOString() });
  f.seed('payments/partial', { pupilId: 'joan', feeStructureId: 'tuition', academicYearId: 'year', termId: 'term3', amount: 15000, paymentDate: at.toISOString() });
  await f.server.reconcileFeeReminders('joan', at);
  assert.equal(f.documents.get('feeReminders/test-request').reminderStatus, 'scheduled');
  f.seed('payments/last', { ...f.documents.get('payments/partial'), amount: 5000 });
  await f.server.reconcileFeeReminders('joan', at);
  assert.equal(f.documents.get('feeReminders/test-request').reminderStatus, 'fulfilled');
});

test('a sent reminder is dismissed for its actual recipients after late payment without changing financial records', async () => {
  const f = setup(); const note = await f.server.createFeeReminder(f.input, actor);
  f.seed('system_users/cashier', actor); f.seed('subscriptions/cashier', {});
  await f.server.dispatchFeeReminder(note.id, new Date(note.dueAt));
  const at = new Date(Date.parse(note.dueAt) + 60_000);
  const payment = { pupilId: 'joan', feeStructureId: 'tuition', academicYearId: 'year', termId: 'term3', amount: 20000, paymentDate: at.toISOString() };
  f.seed('payments/full', payment);
  await f.server.reconcileFeeReminders('joan', at);
  const dismissals = f.pushes.filter(push => push.payload.data?.type === 'FEE_REMINDER_RESOLVED');
  assert.equal(dismissals.length, 1); assert.equal(dismissals[0].userId, 'cashier');
  assert.equal(f.documents.get('notifications/fee-reminder-test-request').metadata.resolved, true);
  assert.deepEqual(f.documents.get('payments/full'), payment);
  await f.server.reconcileFeeReminders('joan', at);
  assert.equal(f.pushes.filter(push => push.payload.data?.type === 'FEE_REMINDER_RESOLVED').length, 1, 'event retries do not repeat a successful dismissal');
});

test('failed dismissal retries preserve fulfillment and do not reschedule the alert', async () => {
  const f = setup(); const note = await f.server.createFeeReminder(f.input, actor);
  f.seed('system_users/cashier', actor); f.seed('subscriptions/cashier', {});
  await f.server.dispatchFeeReminder(note.id, new Date(note.dueAt));
  const at = new Date(Date.parse(note.dueAt) + 60_000);
  f.seed('payments/full', { pupilId: 'joan', feeStructureId: 'tuition', academicYearId: 'year', termId: 'term3', amount: 20000, paymentDate: at.toISOString() });
  f.failPushUsers.add('cashier');
  await assert.rejects(() => f.server.reconcileFeeReminders('joan', at), /dismissal delivery failed/);
  assert.equal(f.documents.get('feeReminders/test-request').reminderStatus, 'fulfilled');
  assert.equal(f.documents.get('feeReminders/test-request').dismissalPending, true);
  f.failPushUsers.clear(); await f.server.reconcileFeeReminders('joan', at);
  assert.equal(f.documents.get('feeReminders/test-request').dismissalPending, false);
});

test('a reversal reopens a fulfilled promise and keeps cancellation history intact', async () => {
  const f = setup(); const note = await f.server.createFeeReminder(f.input, actor);
  const at = new Date(Date.parse(note.createdAt) + 60_000);
  f.seed('payments/full', { pupilId: 'joan', feeStructureId: 'tuition', academicYearId: 'year', termId: 'term3', amount: 20000, paymentDate: at.toISOString() });
  await f.server.reconcileFeeReminders('joan', at);
  const version = f.documents.get('feeReminders/test-request').notificationVersion;
  f.seed('payments/full', { ...f.documents.get('payments/full'), reverted: true });
  await f.server.reconcileFeeReminders('joan', at);
  assert.equal(f.documents.get('feeReminders/test-request').reminderStatus, 'scheduled');
  assert.equal(f.documents.get('scheduledDispatchQueue/fee-reminder-test-request').status, 'scheduled');
  assert.ok(f.documents.get('feeReminders/test-request').notificationVersion > version);
  await f.server.cancelFeeReminder(note.id, actor);
  f.seed('payments/full', { ...f.documents.get('payments/full'), reverted: false });
  await f.server.reconcileFeeReminders('joan', at);
  assert.equal(f.documents.get('feeReminders/test-request').reminderStatus, 'cancelled');
});

test('a stale claimed job cannot send a newer reminder reopened by a payment reversal', async () => {
  const f = setup(); const note = await f.server.createFeeReminder(f.input, actor);
  const at = new Date(Date.parse(note.createdAt) + 60_000);
  f.seed('payments/full', { pupilId: 'joan', feeStructureId: 'tuition', academicYearId: 'year', termId: 'term3', amount: 20000, paymentDate: at.toISOString() });
  await f.server.reconcileFeeReminders('joan', at);
  f.seed('payments/full', { ...f.documents.get('payments/full'), reverted: true });
  await f.server.reconcileFeeReminders('joan', at);
  const outcome = await f.server.dispatchFeeReminder(note.id, new Date(note.dueAt), note.notificationVersion);
  assert.equal(outcome.skipped, true); assert.equal(f.pushes.length, 0);
  assert.equal(f.documents.get('scheduledDispatchQueue/fee-reminder-test-request').status, 'scheduled');
});

test('payment during push delivery cannot overwrite fulfillment with a sent status', async () => {
  const f = setup(); const note = await f.server.createFeeReminder(f.input, actor);
  f.seed('system_users/cashier', actor); f.seed('subscriptions/cashier', {});
  f.setBeforePush(async () => {
    f.seed('payments/full', { pupilId: 'joan', feeStructureId: 'tuition', academicYearId: 'year', termId: 'term3', amount: 20000,
      paymentDate: new Date(Date.parse(note.createdAt) + 60_000).toISOString() });
    await f.server.reconcileFeeReminders('joan', new Date(note.dueAt));
  });
  await f.server.dispatchFeeReminder(note.id, new Date(note.dueAt));
  assert.equal(f.documents.get('feeReminders/test-request').reminderStatus, 'fulfilled');
  assert.equal(f.documents.get('notifications/fee-reminder-test-request').metadata.resolved, true);
});

test('recipient selection validates Fees access and sends only to the saved people', async () => {
  const f = setup();
  f.seed('system_users/cashier', actor); f.seed('system_users/other', { ...actor, id: 'other', firstName: 'Other' });
  f.seed('system_users/parent', { ...actor, id: 'parent', role: 'Parent' });
  f.seed('system_users/disabled', { ...actor, id: 'disabled', isActive: false });
  for (const recipientIds of [[], ['parent'], ['disabled'], ['missing'], ['cashier', 'cashier']]) {
    await assert.rejects(() => f.server.createFeeReminder({ ...f.input, recipientIds }, actor));
  }
  const note = await f.server.createFeeReminder({ ...f.input, recipientIds: ['cashier'] }, actor);
  f.seed('subscriptions/cashier', {}); f.seed('subscriptions/other', {});
  await assert.rejects(() => f.server.updateFeeReminderRecipients(note.id, ['other'], { ...actor, id: 'other' }), /creator or an administrator/);
  const updated = await f.server.updateFeeReminderRecipients(note.id, ['other'], actor);
  assert.deepEqual(Array.from(updated.recipientIds), ['other']);
  await f.server.dispatchFeeReminder(note.id, new Date(note.dueAt));
  assert.deepEqual(f.pushes.map(push => push.userId), ['other']);
  await assert.rejects(() => f.server.updateFeeReminderRecipients(note.id, null, actor), /active, unsent/);
});

test('the default recipient option can be restored and current permissions are rechecked before delivery', async () => {
  const f = setup(); f.seed('system_users/cashier', actor); f.seed('system_users/other', { ...actor, id: 'other' });
  const note = await f.server.createFeeReminder({ ...f.input, recipientIds: ['cashier'] }, actor);
  const updated = await f.server.updateFeeReminderRecipients(note.id, null, actor);
  assert.equal(updated.recipientIds, null);
  f.seed('system_users/cashier', { ...actor, modulePermissions: [] });
  f.seed('subscriptions/cashier', {}); f.seed('subscriptions/other', {});
  await f.server.dispatchFeeReminder(note.id, new Date(note.dueAt));
  assert.deepEqual(f.pushes.map(push => push.userId), ['other']);
});

test('an unavailable ledger never sends a false no-payment message', async () => {
  const f = setup(); const note = await f.server.createFeeReminder(f.input, actor);
  f.failReads.add('payments');
  await assert.rejects(() => f.server.dispatchFeeReminder(note.id, new Date(note.dueAt)), /query unavailable/);
  assert.equal(f.pushes.length, 0); assert.equal(f.documents.has('notifications/fee-reminder-test-request'), false);
});

test('the APIs allow collectors without unrelated notification-send permissions and reject viewers', async () => {
  const f = setup();
  const output = ts.transpileModule(fs.readFileSync('src/app/api/fees/reminders/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  let currentActor = actor;
  const module = { exports: {} as any };
  vm.runInNewContext(output, { module, exports: module.exports, console,
    require: (name: string) => {
      if (name === 'next/server') return { NextResponse: { json: (body: any, options?: any) => ({ body, status: options?.status || 200 }) } };
      if (name === 'firebase-admin/firestore') return { getFirestore: () => f.db };
      if (name === '@/lib/firebase-admin') return { getFirebaseAdminApp: () => ({}) };
      if (name === '@/lib/server/app-auth') return { requireAppUser: async () => ({ user: currentActor }) };
      if (name === '@/lib/fees/fee-reminders') return model;
      if (name === '@/lib/server/fee-reminders') return f.server;
      throw new Error(name);
    },
  });
  const request = { json: async () => f.input, nextUrl: { searchParams: new URLSearchParams({ pupilId: 'joan' }) } };
  assert.equal((await module.exports.POST(request)).status, 201);
  const recipientRequest = { ...request, nextUrl: {searchParams: new URLSearchParams({pupilId: 'joan', includeRecipients: 'true'})} };
  assert.equal((await module.exports.GET(recipientRequest)).status, 200);
  currentActor = { ...actor, modulePermissions: [{ module: 'fees', permission: 'view_only' }] } as SystemUser;
  assert.equal((await module.exports.POST(request)).status, 403);
  assert.equal((await module.exports.GET(request)).status, 200);
  assert.equal((await module.exports.GET(recipientRequest)).status, 403);
  currentActor = { ...actor, role: 'Parent' };
  assert.equal((await module.exports.GET(request)).status, 403);
});

test('the recipient update API checks collector authority, ownership, request content, and live dispatch leases', async () => {
  const f = setup(); f.seed('system_users/cashier', actor);
  const note = await f.server.createFeeReminder(f.input, actor);
  const output = ts.transpileModule(fs.readFileSync('src/app/api/fees/reminders/[id]/route.ts', 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
  }).outputText;
  const module = {exports: {} as any}; let currentActor = actor;
  vm.runInNewContext(output, {module, exports: module.exports, console,
    require: (name: string) => {
      if (name === 'next/server') return {NextResponse: {json: (body: any, options?: any) => ({body, status: options?.status || 200})}};
      if (name === '@/lib/server/app-auth') return {requireAppUser: async () => ({user: currentActor})};
      if (name === '@/lib/fees/fee-reminders') return model;
      if (name === '@/lib/server/fee-reminders') return f.server;
      throw new Error(name);
    },
  });
  const context = {params: Promise.resolve({id: note.id})};
  const request = {json: async () => ({action: 'recipients', recipientIds: ['cashier']})};
  assert.equal((await module.exports.PATCH(request, context)).status, 200);
  currentActor = {...actor, id: 'other'};
  assert.equal((await module.exports.PATCH(request, context)).status, 403);
  currentActor = {...actor, modulePermissions: [{module: 'fees', permission: 'view_only'}]} as SystemUser;
  assert.equal((await module.exports.PATCH(request, context)).status, 403);
  currentActor = actor;
  assert.equal((await module.exports.PATCH({json: async () => ({action: 'invalid'})}, context)).status, 400);
  assert.equal((await module.exports.PATCH({json: async () => ({action: 'recipients', recipientIds: []})}, context)).status, 400);
  f.documents.get('scheduledDispatchQueue/fee-reminder-test-request').leaseUntil = f.stamp(new Date(Date.now() + 60_000));
  assert.equal((await module.exports.PATCH(request, context)).status, 409);
});

test('the existing scheduler dispatches due notes, marks exhaustion, and keeps reminder work outside payment creation', () => {
  const cron = fs.readFileSync('src/app/api/cron/send-scheduled-sms/route.ts', 'utf8');
  const rules = fs.readFileSync('firestore.rules', 'utf8');
  assert.match(cron, /suppliedSecret !== cronSecret/); assert.match(cron, /claimed\.channel === 'fee_reminder'/);
  assert.match(cron, /dispatchFeeReminder\(claimed\.sourceId, now, claimed\.notificationVersion\)/); assert.match(cron, /reminderStatus: 'failed'/);
  assert.match(rules, /match \/feeReminders\/\{reminderId\} \{\s*allow read, write: if false/);
  assert.match(rules, /collection != 'feeReminders'/);
  const paymentRoute = fs.readFileSync('src/app/api/payments/create/route.ts', 'utf8');
  assert.doesNotMatch(paymentRoute, /feeReminders|dispatchFeeReminder|createFeeReminder/);
});
