import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypto from 'node:crypto';
import { notificationFixture } from './helpers/payment-notifications-fixture';

test('grouped preparation shares reads and preserves the non-reverted ledger balance', async () => {
  const f = notificationFixture();
  await f.enqueue([f.seed('one'), f.seed('two')]);
  f.documents.set('payments/reverted', { ...f.documents.get('payments/one'), amount: 50, reverted: true });
  await f.process();
  assert.equal(f.counts['pupils/pupil-1'], 1);
  assert.equal(f.counts['feeStructures/fee-1'], 1);
  assert.equal(f.counts.payments, 1);
  assert.equal(f.counts.system_users, 1);
  assert.equal(f.counts['notificationAutomationSettings/current'], 1);
  assert.equal(f.sent.length, 2);
  assert.ok(f.sent.every(s => s.payload.richContent.rawAmounts.balance === 300));
});

test('concurrent workers and repeated enqueue do not send completed jobs again', async () => {
  const f = notificationFixture();
  const target = f.seed();
  await Promise.all([f.enqueue([target]), f.enqueue([target])]);
  await Promise.all([f.process(), f.process()]);
  await f.enqueue([target]);
  await f.process();
  assert.equal(f.sent.length, 1);
  const event = f.documents.get('scheduledNotifications/fee-payment-events/outbox/payment-payment-1');
  assert.equal(event.status, 'completed');
  assert.equal(event.attempts, 1);
  assert.equal(f.counts['scheduledNotifications/fee-payment-events/outbox/payment-payment-1'], undefined,
    'create-only retries must not read the outbox document');
});

test('a prepared job cannot notify anyone when its payment never commits', async () => {
  const f = notificationFixture();
  await f.enqueue([{ paymentId: 'uncommitted' }]);
  await f.process();
  assert.equal(f.sent.length, 0);
});

test('recipient failure retries only unconfirmed recipients with the same payload and ID', async () => {
  const f = notificationFixture();
  await f.enqueue([f.seed()]);
  f.documents.set('system_users/second', { role: 'Admin', isActive: true });
  f.failedUsers.add('second');
  await f.process();
  assert.equal(f.documents.get('scheduledNotifications/fee-payment-events/outbox/payment-payment-1').status, 'pending');
  const before = f.sent.length;
  await f.process();
  assert.equal(f.sent.length, before, 'backoff must be respected');
  f.documents.set('payments/later', { ...f.documents.get('payments/payment-1'), amount: 200 });
  f.failedUsers.clear();
  f.due('payment-1');
  await f.process();
  assert.equal(f.sent.filter(s => s.userId === 'staff').length, 1);
  assert.equal(f.sent.filter(s => s.userId === 'second').length, 2);
  assert.ok(f.sent.every(s => s.payload.richContent.rawAmounts.balance === 400));
  assert.ok(f.sent.every(s => s.id === 'fee-payment-1'));
});

test('lookup errors are retryable and do not suppress unrelated receipts', async () => {
  const f = notificationFixture();
  await f.enqueue([f.seed('bad', 'bad-pupil'), f.seed('good')]);
  f.failedReads.add('pupils/bad-pupil');
  await f.process();
  assert.equal(f.sent.length, 1);
  assert.equal(f.documents.get('scheduledNotifications/fee-payment-events/outbox/payment-bad').status, 'pending');
  assert.equal(f.documents.get('scheduledNotifications/fee-payment-events/outbox/payment-good').status, 'completed');
});

test('failed recipient lookup is not treated as no eligible recipients', async () => {
  const f = notificationFixture();
  await f.enqueue([f.seed()]);
  f.failedReads.add('system_users');
  await f.process();
  assert.equal(f.sent.length, 0);
  assert.equal(f.documents.get('scheduledNotifications/fee-payment-events/outbox/payment-payment-1').status, 'pending');
});

test('future retry jobs cannot starve due jobs behind a query limit', async () => {
  const f = notificationFixture();
  await f.enqueue([f.seed('later'), f.seed('ready')]);
  f.documents.get('scheduledNotifications/fee-payment-events/outbox/payment-later').nextAttemptAt = f.stamp(Date.now() + 999999);
  await f.process(1);
  assert.equal(f.documents.get('scheduledNotifications/fee-payment-events/outbox/payment-ready').status, 'completed');
});

test('crashed or malformed jobs exhaust their attempt limit instead of looping forever', async () => {
  const f = notificationFixture();
  await f.enqueue([f.seed()]);
  const event = f.documents.get('scheduledNotifications/fee-payment-events/outbox/payment-payment-1');
  event.status = 'processing';
  event.attempts = 5;
  f.due('payment-1');
  await f.process();
  assert.equal(f.documents.get('scheduledNotifications/fee-payment-events/outbox/payment-payment-1').status, 'failed');
  assert.equal(f.sent.length, 0);
});

test('a replaced lease cannot be overwritten by the old worker', async () => {
  const f = notificationFixture();
  await f.enqueue([f.seed()]);
  f.setAfterSend(() => { f.documents.get('scheduledNotifications/fee-payment-events/outbox/payment-payment-1').leaseToken = 'new-owner'; });
  await f.process();
  assert.equal(f.documents.get('scheduledNotifications/fee-payment-events/outbox/payment-payment-1').leaseToken, 'new-owner');
  assert.equal(f.documents.get('scheduledNotifications/fee-payment-events/outbox/payment-payment-1').status, 'processing');
});

test('worker uses canonical ledger values and skips reversed payments', async () => {
  const f = notificationFixture();
  const target = f.seed();
  await f.enqueue([{ ...target, paymentData: { ...target.paymentData, amount: 999 } }]);
  await f.process();
  assert.equal(f.sent[0].payload.richContent.rawAmounts.amountPaid, 100);
  await f.enqueue([f.seed('reversed')]);
  f.documents.get('payments/reversed').reverted = true;
  await f.process();
  assert.equal(f.sent.length, 1);
});

test('active pupil parent marker adds the family account without another user lookup', async () => {
  const f = notificationFixture();
  await f.enqueue([f.seed()]);
  Object.assign(f.documents.get('pupils/pupil-1'), {
    familyId: 'family-1',
    parentAccountId: 'parent-1',
    parentAccountActive: true,
  });

  await f.process();

  assert.deepEqual(f.sent.map(item => item.userId).sort(), ['parent-1', 'staff']);
  assert.equal(f.sent.find(item => item.userId === 'parent-1')?.payload.pushUrl, '/parent?pupilId=pupil-1');
  assert.equal(f.sent.find(item => item.userId === 'staff')?.payload.pushUrl, '/fees/collect/pupil-1');
  assert.equal(f.counts.system_users, 1, 'parent routing must use the pupil marker, not query system_users again');
});

test('standalone pupil parent marker receives the same fee-payment push', async () => {
  const f = notificationFixture();
  await f.enqueue([f.seed()]);
  Object.assign(f.documents.get('pupils/pupil-1'), {
    parentAccountId: 'standalone-parent', parentAccountActive: true,
  });

  await f.process();

  assert.deepEqual(f.sent.map(item => item.userId).sort(), ['staff', 'standalone-parent']);
  assert.equal(f.sent.find(item => item.userId === 'standalone-parent')?.payload.pushUrl,
    '/parent?pupilId=pupil-1');
});

test('missing or inactive parent marker does not attempt parent delivery', async () => {
  const f = notificationFixture();
  await f.enqueue([f.seed()]);
  Object.assign(f.documents.get('pupils/pupil-1'), {
    parentAccountId: 'parent-1',
    parentAccountActive: false,
  });

  await f.process();

  assert.deepEqual(f.sent.map(item => item.userId), ['staff']);
  assert.equal(f.counts.system_users, 1);
});

test('payment route hands initial delivery and replay to the same worker after response', () => {
  const source = fs.readFileSync('src/app/api/payments/create/route.ts', 'utf8');
  assert.match(source, /enqueuePaymentNotificationEvents/);
  assert.match(source, /processPendingPaymentNotificationEvents/);
  assert.doesNotMatch(source, /sendPaymentNotifications\(|!operation(?:\?)?\.wasReplay/);
  assert.match(source, /after\(\(\) => notifyPaymentsCreatedAfterResponse/);
});

test('payment route prepares an Admin-only job before the financial write and stops if preparation fails', async () => {
  const calls: string[] = [];
  const afterTasks: Array<() => Promise<void>> = [];
  let failPreparation = false;
  const service = {
    createPaymentOperation: async (_operationId: string, allocations: unknown[], options: { paymentIds: string[] }) => {
      calls.push('payment-operation');
      assert.equal(options.paymentIds.length, allocations.length);
      return { paymentIds: options.paymentIds, wasReplay: false };
    },
    createPayment: async (_payment: unknown, options: { paymentId: string }) => {
      calls.push('single-payment');
      return options.paymentId;
    },
  };
  const source = ts.transpileModule(fs.readFileSync('src/app/api/payments/create/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} as { POST: (request: unknown) => Promise<{ body: any; status: number }> } };
  vm.runInNewContext(source, {
    module, exports: module.exports, performance: { now: () => 0 }, setTimeout, clearTimeout,
    console: { log() {}, warn() {}, error() {} },
    require(name: string) {
      if (name === 'next/server') return {
        after: (callback: () => Promise<void>) => afterTasks.push(callback),
        NextResponse: { json: (body: any, options?: { status?: number }) => ({ body, status: options?.status || 200 }) },
      };
      if (name === 'node:crypto') return crypto;
      if (name === '@/lib/services/payments.service') return {
        PaymentsService: service,
        validatePaymentOperationInput: (id: string, allocations: unknown[]) => {
          assert.ok(id);
          assert.ok(allocations.length > 0);
        },
      };
      if (name === '@/lib/server/ensure-server-firestore-auth') return {
        ensureServerFirestoreAuth: async () => { calls.push('auth'); },
      };
      if (name === '@/lib/server/payment-notification-outbox') return {
        enqueuePaymentNotificationEvents: async () => {
          calls.push('admin-job');
          if (failPreparation) throw new Error('Admin unavailable');
        },
      };
      if (name === '@/lib/server/payment-notification-worker') return {
        processPendingPaymentNotificationEvents: async () => {},
      };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  const paymentData = { pupilId: 'pupil-1', amount: 100 };
  const request = (body: unknown) => ({ json: async () => body });

  const grouped = await module.exports.POST(request({
    operationId: 'payment-op-123', allocations: [{ paymentData }],
  }));
  assert.equal(grouped.status, 200);
  assert.deepEqual(calls, ['auth', 'admin-job', 'payment-operation']);
  assert.equal(afterTasks.length, 1);

  calls.length = 0;
  failPreparation = true;
  const failed = await module.exports.POST(request(paymentData));
  assert.equal(failed.status, 500);
  assert.deepEqual(calls, ['auth', 'admin-job']);
  assert.equal(afterTasks.length, 1);

  calls.length = 0;
  failPreparation = false;
  const single = await module.exports.POST(request(paymentData));
  assert.equal(single.status, 200);
  assert.deepEqual(calls, ['auth', 'admin-job', 'single-payment']);
});
