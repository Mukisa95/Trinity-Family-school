import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as circumference from '../src/lib/access/circumference';

const routePath = 'src/app/api/payments/create/route.ts';

test('fee payment route keeps the old payment-notification outbox removed', () => {
  const route = fs.readFileSync(routePath, 'utf8');
  const scheduler = fs.readFileSync('.github/workflows/scheduled-sms.yml', 'utf8');
  assert.doesNotMatch(route, /payment-notification|enqueuePaymentNotificationEvents|processPendingPaymentNotificationEvents|\bafter\(/i);
  assert.doesNotMatch(scheduler, /process-payment-notifications/);
  assert.equal(fs.existsSync('src/app/api/cron/process-payment-notifications/route.ts'), false);
});

test('single and family payments commit before a non-fatal note update', async () => {
  const calls: string[] = [];
  const service = {
    createPaymentOperation: async (id: string, allocations: unknown[], options: any) => {
      await options.authorize({get: async (ref: any) => ref.path.startsWith('system_users/') ? {exists: () => true, id: 'admin', data: () => ({role: 'Admin', isActive: true})} : {exists: () => true, data: () => ({classId: 'p4', section: 'Boarding', gender: 'Female'})}});
      calls.push(`operation:${id}:${allocations.length}`);
      return { operationId: id, paymentIds: allocations.map((_, index) => `payment-${index + 1}`), wasReplay: false };
    },
    createPayment: async () => {
      calls.push('single-payment');
      return 'payment-1';
    },
  };
  const source = ts.transpileModule(fs.readFileSync(routePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} as { POST: (request: unknown) => Promise<{ body: any; status: number }> } };
  vm.runInNewContext(source, {
    module, exports: module.exports, performance: { now: () => 0 },
    console: { log() {}, error() {} },
    require(name: string) {
      if (name === '@/lib/server/app-auth') return {requireAppUser: async () => ({user: {id: 'admin', role: 'Admin', isActive: true}})};
      if (name === '@/lib/server/circumference') return {CircumferenceError: class extends Error {}, requireScopedPupil: async () => {calls.push('scope');}};
      if (name === '@/lib/fees/fee-reminders') return {canManageFeeReminders: () => true};
      if (name === '@/lib/access/circumference') return circumference;
      if (name === '@/lib/firebase') return {db: {}};
      if (name === 'firebase/firestore') return {doc: (_db: any, collection: string, id: string) => ({path: `${collection}/${id}`})};
      if (name === 'crypto') return {randomUUID: () => 'single-operation'};
      if (name === '@/lib/server/fee-reminders') return {processRecordedFeePayments: async () => {calls.push('reminder-update'); throw new Error('Push temporarily unavailable');}};
      if (name === 'next/server') return {
        NextResponse: { json: (body: any, options?: { status?: number }) => ({ body, status: options?.status || 200 }) },
      };
      if (name === '@/lib/services/payments.service') return {
        PaymentsService: service,
        validatePaymentOperationInput: (_id: string, allocations: unknown[]) => {
          assert.ok(allocations.length > 0);
        },
      };
      if (name === '@/lib/server/ensure-server-firestore-auth') return {
        ensureServerFirestoreAuth: async () => { calls.push('auth'); },
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  const request = (body: unknown) => ({ json: async () => body });
  const paymentData = { pupilId: 'pupil-1', feeStructureId: 'fee-1', amount: 100 };

  const single = await module.exports.POST(request(paymentData));
  assert.equal(single.status, 200);
  assert.equal(single.body.paymentId, 'payment-1');
  assert.deepEqual(calls, ['auth', 'scope', 'operation:single-operation:1', 'reminder-update']);

  calls.length = 0;
  const grouped = await module.exports.POST(request({
    operationId: 'family-payment-1',
    allocations: [{ paymentData }, { paymentData: { ...paymentData, pupilId: 'pupil-2' } }],
  }));
  assert.equal(grouped.status, 200);
  assert.deepEqual(Array.from(grouped.body.paymentIds), ['payment-1', 'payment-2']);
  assert.deepEqual(calls, ['auth', 'scope', 'scope', 'operation:family-payment-1:2', 'reminder-update']);
});
