import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const routePath = 'src/app/api/payments/create/route.ts';

test('fee payment route has no notification preparation or delivery dependency', () => {
  const route = fs.readFileSync(routePath, 'utf8');
  const scheduler = fs.readFileSync('.github/workflows/scheduled-sms.yml', 'utf8');
  assert.doesNotMatch(route, /payment-notification|enqueuePaymentNotificationEvents|processPendingPaymentNotificationEvents|\bafter\(/i);
  assert.doesNotMatch(scheduler, /process-payment-notifications/);
  assert.equal(fs.existsSync('src/app/api/cron/process-payment-notifications/route.ts'), false);
});

test('single and family-style grouped payments commit without a notification check', async () => {
  const calls: string[] = [];
  const service = {
    createPaymentOperation: async (id: string, allocations: unknown[]) => {
      calls.push(`operation:${id}:${allocations.length}`);
      return { operationId: id, paymentIds: allocations.map((_, index) => `payment-${index + 1}`), wasReplay: false };
    },
    createPayment: async () => {
      calls.push('single-payment');
      return 'single-payment-id';
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
  assert.equal(single.body.paymentId, 'single-payment-id');
  assert.deepEqual(calls, ['auth', 'single-payment']);

  calls.length = 0;
  const grouped = await module.exports.POST(request({
    operationId: 'family-payment-1',
    allocations: [{ paymentData }, { paymentData: { ...paymentData, pupilId: 'pupil-2' } }],
  }));
  assert.equal(grouped.status, 200);
  assert.deepEqual(Array.from(grouped.body.paymentIds), ['payment-1', 'payment-2']);
  assert.deepEqual(calls, ['auth', 'operation:family-payment-1:2']);
});
