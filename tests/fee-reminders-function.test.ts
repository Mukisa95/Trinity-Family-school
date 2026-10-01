import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import * as crypto from 'node:crypto';
import * as lifecycle from '../functions/fee-reminder-lifecycle';
import * as customLifecycle from '../functions/custom-fee-notes';
import { feeReminderFixture } from './helpers/fee-reminders-fixture';

function functionFixture() {
  const f = feeReminderFixture();
  const sends: any[] = [];
  const failures = new Map<string, number>();
  const privateKey = Buffer.alloc(32, 1).toString('base64url');
  const ecdh = crypto.createECDH('prime256v1'); ecdh.setPrivateKey(Buffer.from(privateKey, 'base64url'));
  const publicKey = ecdh.getPublicKey().toString('base64url');
  const firestore = Object.assign(() => f.db, {FieldValue: {serverTimestamp: () => f.stamp(new Date())}});
  const factory = (options: any, handler: any) => Object.assign(handler, {options});
  const module = {exports: {} as any};
  vm.runInNewContext(fs.readFileSync('functions/index.js', 'utf8'), {
    module, exports: module.exports, Date, Buffer, __dirname: 'functions', process: {env: {}},
    console: {log() {}, warn() {}, error() {}},
    require: (name: string) => {
      if (name === 'firebase-functions/v2/https') return {onCall: factory, onRequest: factory, HttpsError: Error};
      if (name === 'firebase-functions/v2/firestore') return {onDocumentWritten: factory};
      if (name === 'firebase-functions/v2/scheduler') return {onSchedule: factory};
      if (name === 'firebase-functions/tasks') return {onTaskDispatched: factory};
      if (name === 'firebase-functions/params') return {defineSecret: () => ({value: () => privateKey})};
      if (name === 'firebase-functions/logger') return {warn() {}, info() {}, error() {}};
      if (name === 'firebase-admin') return {apps: [{}], firestore, app: () => ({options: {projectId: 'trinity-family-schools'}})};
      if (name === 'firebase-admin/functions') return {getFunctions: () => ({})};
      if (name === 'crypto') return crypto;
      if (name === './fee-reminder-lifecycle') return lifecycle;
      if (name === './custom-fee-notes') return customLifecycle;
      if (name === './fee-custom-engine') return require('../functions/fee-custom-engine');
      if (name === './fee-reminder-web-push') return {sendFeeReminderWebsitePush: async (_project: string, delivery: any) => {
        for (const [id, subscription] of f.documents) {
          if (!id.startsWith('pushSubscriptions/') || !subscription.isActive || subscription.vapidPublicKey !== publicKey || !delivery.recipientIds.includes(subscription.userId)) continue;
          sends.push({subscription, payload: {...delivery, data: {type: delivery.type},
            url: delivery.collectRecipientIds.includes(subscription.userId) ? `/fees/collect/${delivery.pupilId}?notes=open` : '/notifications'}, options: {topic: `fee-reminder-${delivery.id}`}});
          if ([404, 410].includes(failures.get(subscription.endpoint)!)) {f.seed(id, {...subscription, isActive: false}); continue;}
          if (failures.has(subscription.endpoint)) throw new Error('Fee reminder dismissal delivery failed; it will retry.');
        }
      }};
      if (name === 'next') return () => ({getRequestHandler: () => () => {}});
      if (name === './next.config.js') return {};
      if (name === 'cors') return () => () => {};
      if (name === 'web-push') return {setVapidDetails() {}, sendNotification: async (subscription: any, data: string, options: any) => {
        sends.push({subscription, payload: JSON.parse(data), options});
        if (failures.has(subscription.endpoint)) throw {statusCode: failures.get(subscription.endpoint)};
      }};
      throw new Error(`Unexpected function import: ${name}`);
    },
  });
  const note = {id: 'promise', pupilId: 'joan', pupilName: 'Joan Kagwa', scopes: [
    {feeStructureId: 'tuition', academicYearId: 'year', termId: 'term', feeName: 'Tuition', academicYearName: '2026', termName: 'Term 3'},
  ], promisedAmount: 20000, baselinePaymentIds: [], createdAt: '2026-09-26T06:00:00Z',
    dueAt: '2026-10-03T06:00:00Z', reminderStatus: 'scheduled', notificationVersion: 1};
  f.seed('feeReminders/promise', note);
  f.seed('scheduledDispatchQueue/fee-reminder-promise', {status: 'scheduled', dueAt: f.stamp(new Date(note.dueAt))});
  const payment = {pupilId: 'joan', feeStructureId: 'tuition', academicYearId: 'year', termId: 'term', amount: 20000,
    paymentDate: '2026-09-30T06:00:00Z'};
  f.seed('payments/full', payment);
  f.seed('system_users/cashier', {id: 'cashier', firstName: 'Fee', lastName: 'Collector', role: 'Staff', isActive: true,
    modulePermissions: [{module: 'fees', permission: 'edit'}]});
  const change = {data: {before: {data: () => undefined}, after: {data: () => payment}}};
  return {...f, payment, publicKey, sends, failures, change, trigger: module.exports.feeReminderPaymentChanged,
    statusTrigger: module.exports.feeReminderStatusChanged, holidayTrigger: module.exports.feeReminderHolidayChanged};
}

function seedCustom(f: ReturnType<typeof functionFixture>, condition = {type: 'paid_at_least', amount: 20000} as any) {
  const created = new Date(Date.now() - 120000), due = new Date(Date.now() + 86400000);
  const note = {...f.documents.get('feeReminders/promise'), kind: 'custom', createdAt: created.toISOString(), dueAt: due.toISOString(),
    createdBy: 'cashier', createdByName: 'Fee Collector', pupilName: 'Joan Kagwa', recipientIds: ['cashier'],
    custom: {message: '[Pupil] has paid [Paid]. Balance [Balance].', condition,
      fields: [{label: 'Pupil', metric: 'pupil_name'}, {label: 'Paid', metric: 'paid_since_note'}, {label: 'Balance', metric: 'balance'}]}};
  f.seed('feeReminders/promise', note);
  f.seed('pupils/joan', {firstName: 'Joan', lastName: 'Kagwa', classId: 'p5', assignedFees: []});
  f.seed('academicYears/year', {name: '2026', startDate: '2026-01-01', endDate: '2026-12-31', terms: [{id: 'term', name: 'Term 3', startDate: '2026-09-01', endDate: '2026-12-01'}]});
  f.seed('feeStructures/tuition', {name: 'Tuition', amount: 40000, category: 'Tuition Fee', isRequired: true, status: 'active'});
  f.seed('payments/full', {...f.payment, paymentDate: new Date(Date.now() - 60000).toISOString()});
  f.seed('pushSubscriptions/device', {userId: 'cashier', isActive: true, vapidPublicKey: f.publicKey, endpoint: 'device', p256dh: 'public', auth: 'auth'});
  return note;
}

test('the real payment trigger immediately sends a custom target notice and does not auto-cancel it as a promise', async () => {
  const f = functionFixture(); seedCustom(f);
  await f.trigger(f.change); await f.trigger(f.change);
  assert.equal(f.sends.length, 1); assert.equal(f.sends[0].payload.data.type, 'FEE_REMINDER_ALERT');
  assert.match(f.sends[0].payload.body, /Joan Kagwa has paid 20,000 shillings. Balance 20,000 shillings/);
  assert.equal(f.documents.get('feeReminders/promise').reminderStatus, 'sent');
  assert.equal(f.documents.get('notificationDeliveries/fee-reminder-promise-cashier').status, 'sent');
});

test('a fee waiver can fulfil a custom cleared-fees condition immediately without a payment write', async () => {
  const f = functionFixture(); seedCustom(f, {type: 'cleared'});
  await f.trigger(f.change); assert.equal(f.sends.length, 0);
  const holiday = {pupilId: 'joan', isActive: true, categories: ['required'], discountType: 'full'};
  f.seed('feesHolidays/full', holiday);
  await f.holidayTrigger({params: {id: 'full'}, data: {before: {data: () => undefined}, after: {data: () => holiday}}});
  assert.equal(f.sends.length, 1); assert.match(f.sends[0].payload.body, /Balance 0 shillings/);
  assert.equal(f.holidayTrigger.options.retry, true);
});

test('the creation/status trigger evaluates an already-cleared condition and retries a pending custom delivery', async () => {
  const f = functionFixture(); const note = seedCustom(f, {type: 'cleared'});
  f.seed('payments/full', {...f.documents.get('payments/full'), amount: 40000});
  f.failures.set('device', 503);
  const event = {params: {reminderId: 'promise'}, data: {before: {data: () => undefined}, after: {data: () => note}}};
  await assert.rejects(() => f.statusTrigger(event), /delivery failed/);
  assert.equal(f.documents.get('feeReminders/promise').customDeliveryPending, true);
  f.failures.clear(); await f.statusTrigger(event);
  assert.equal(f.documents.get('feeReminders/promise').reminderStatus, 'sent');
});

test('the payment trigger is independent, retries failures, and cancels a paid note before its deadline', async () => {
  const f = functionFixture();
  assert.equal(f.trigger.options.document, 'payments/{paymentId}'); assert.equal(f.trigger.options.retry, true);
  await f.trigger(f.change);
  assert.equal(f.documents.get('feeReminders/promise').reminderStatus, 'fulfilled');
  assert.equal(f.documents.get('scheduledDispatchQueue/fee-reminder-promise').status, 'cancelled');
  assert.deepEqual(f.documents.get('payments/full'), f.payment); assert.equal(f.sends.length, 0);
});

test('the real function dismisses only the actual recipients using their active subscriptions and the matching push topic', async () => {
  const f = functionFixture();
  f.seed('notifications/fee-reminder-promise', {recipientIds: ['cashier'], readBy: [], metadata: {}});
  for (const [id, userId, active, key] of [
    ['device', 'cashier', true, f.publicKey], ['disabled', 'cashier', false, f.publicKey],
    ['other', 'other', true, f.publicKey], ['wrong-key', 'cashier', true, 'wrong'],
  ] as const) f.seed(`pushSubscriptions/${id}`, {userId, isActive: active, vapidPublicKey: key, endpoint: id, keys: {p256dh: 'public', auth: 'auth'}});
  await f.trigger(f.change);
  assert.equal(f.sends.length, 1); assert.equal(f.sends[0].subscription.endpoint, 'device');
  assert.equal(f.sends[0].payload.data.type, 'FEE_REMINDER_RESOLVED');
  assert.match(f.sends[0].payload.title, /Joan Kagwa/); assert.match(f.sends[0].payload.body, /20,000 shillings/);
  assert.match(f.sends[0].payload.body, /No follow-up call is needed for this promise/);
  assert.equal(f.sends[0].options.topic, 'fee-reminder-promise');
  assert.equal(f.documents.get('feeReminders/promise').dismissalPending, false);
});

test('early payment sends a visible update without waiting for the original reminder date', async () => {
  const f = functionFixture();
  f.seed('pushSubscriptions/device', {userId: 'cashier', isActive: true, vapidPublicKey: f.publicKey,
    endpoint: 'device', p256dh: 'public', auth: 'auth'});
  assert.equal(f.documents.has('notifications/fee-reminder-promise'), false);
  await f.trigger(f.change);
  assert.equal(f.sends.length, 1); assert.equal(f.sends[0].payload.data.type, 'FEE_REMINDER_RESOLVED');
  assert.match(f.sends[0].payload.body, /Tuition/); assert.match(f.sends[0].payload.body, /30 September 2026/);
  assert.equal(f.sends[0].payload.url, '/fees/collect/joan?notes=open');
  const update = f.documents.get('notifications/fee-reminder-update-promise-v2');
  assert.deepEqual(update.recipientIds, ['cashier']); assert.equal(update.metadata.reason, 'paid');
});

test('the reminder status trigger retries manual cancellation updates without repeating successful notifications', async () => {
  const f = functionFixture();
  f.seed('feeReminders/promise', {...f.documents.get('feeReminders/promise'), reminderStatus: 'cancelled',
    notificationVersion: 2, resolutionNotificationId: 'fee-reminder-update-promise-v2', dismissalPending: true});
  f.seed('notifications/fee-reminder-update-promise-v2', {title: 'Joan Kagwa: fees reminder cancelled',
    description: 'Cancelled by Fee Collector. Reason: promise recorded twice. Do not contact the parent based on this cancelled reminder.',
    recipientIds: ['cashier'], metadata: {reason: 'manual'}});
  f.seed('pushSubscriptions/device', {userId: 'cashier', isActive: true, vapidPublicKey: f.publicKey, endpoint: 'device', p256dh: 'public', auth: 'auth'});
  const event = {params: {reminderId: 'promise'}, data: {
    before: {data: () => ({reminderStatus: 'scheduled'})}, after: {data: () => ({...f.documents.get('feeReminders/promise')})},
  }};
  assert.equal(f.statusTrigger.options.retry, true);
  f.failures.set('device', 503);
  await assert.rejects(() => f.statusTrigger(event), /dismissal delivery failed/);
  assert.equal(f.documents.get('feeReminders/promise').dismissalPending, true);
  f.failures.clear(); await f.statusTrigger(event);
  assert.match(f.sends.at(-1).payload.body, /Cancelled by Fee Collector.*promise recorded twice/);
  assert.equal(f.documents.get('feeReminders/promise').dismissalPending, false);
  const count = f.sends.length; await f.statusTrigger(event);
  assert.equal(f.sends.length, count);
});

test('an expired endpoint is disabled; a temporary push failure retries without undoing fulfillment', async () => {
  const f = functionFixture();
  f.seed('notifications/fee-reminder-promise', {recipientIds: ['cashier'], readBy: [], metadata: {}});
  for (const id of ['expired', 'temporary']) f.seed(`pushSubscriptions/${id}`, {
    userId: 'cashier', isActive: true, vapidPublicKey: f.publicKey, endpoint: id, p256dh: 'public', auth: 'auth',
  });
  f.failures.set('expired', 410); f.failures.set('temporary', 503);
  await assert.rejects(() => f.trigger(f.change), /dismissal delivery failed/);
  assert.equal(f.documents.get('pushSubscriptions/expired').isActive, false);
  assert.equal(f.documents.get('feeReminders/promise').reminderStatus, 'fulfilled');
  assert.equal(f.documents.get('feeReminders/promise').dismissalPending, true);
  f.failures.clear(); await f.trigger(f.change);
  assert.equal(f.documents.get('feeReminders/promise').dismissalPending, false);
});
