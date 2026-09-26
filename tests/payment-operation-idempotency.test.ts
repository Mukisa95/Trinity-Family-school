import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

type StoredDocument = Record<string, unknown>;

function loadPaymentsService() {
  const documents = new Map<string, StoredDocument>();
  const writes: string[] = [];
  let generatedId = 0;
  let termReadCount = 0;
  const db = { name: 'db' };
  const firestore = {
    Timestamp: { now: () => ({ kind: 'timestamp' }) },
    collection: (_db: unknown, collectionName: string) => ({ collectionName }),
    doc: (...args: [{ collectionName?: string } | typeof db, string?, string?]) => {
      const [parent, collectionName, documentId] = args;
      if ('collectionName' in parent) {
        generatedId += 1;
        return { path: `${parent.collectionName}/generated-${generatedId}`, id: `generated-${generatedId}` };
      }
      return { path: `${collectionName}/${documentId}`, id: documentId };
    },
    runTransaction: async (_db: unknown, callback: (transaction: {
      get: (ref: { path: string }) => Promise<{ exists: () => boolean; data: () => StoredDocument; ref: { path: string } }>;
      set: (ref: { path: string }, value: StoredDocument) => void;
      update: (ref: { path: string }, value: StoredDocument) => void;
    }) => Promise<unknown>) => {
      const staged = new Map<string, StoredDocument>();
      const result = await callback({
        get: async ref => ({
          exists: () => documents.has(ref.path),
          data: () => documents.get(ref.path) || {},
          ref,
        }),
        set: (ref, value) => {
          staged.set(ref.path, value);
          writes.push(ref.path);
        },
        update: (ref, value) => {
          staged.set(ref.path, { ...(documents.get(ref.path) || {}), ...value });
          writes.push(ref.path);
        },
      });
      staged.forEach((value, key) => documents.set(key, value));
      return result;
    },
    writeBatch: () => ({ set() {}, update() {}, commit: async () => {} }),
    getDocs: async () => {
      termReadCount += 1;
      return { docs: [] };
    },
    getDoc: async () => ({ exists: () => false }),
    query: () => ({}),
    orderBy: () => ({}),
    where: () => ({}),
  };

  const source = fs.readFileSync(
    path.join(process.cwd(), 'src/lib/services/payments.service.ts'),
    'utf8',
  );
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} as Record<string, unknown> };
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    require(name: string) {
      if (name === 'firebase/firestore') return firestore;
      if (name === '../firebase') return { db };
      if (name === './history-log.service') {
        return { HistoryLogService: { addToTransaction(transaction: { set: Function }, input: { recordId: string }) {
          transaction.set({ path: `historyLogs/${input.recordId}` }, { recordId: input.recordId });
        } } };
      }
      throw new Error(`Unexpected import: ${name}`);
    },
    console: { log() {}, error() {} },
    performance: { now: () => 0 },
  }, { filename: 'payments.service.ts' });

  return {
    PaymentsService: module.exports.PaymentsService as {
      createPaymentOperation: (operationId: string, allocations: Array<{
        paymentData: Record<string, unknown>;
        historyContext?: Record<string, unknown>;
        uniformTracking?: { trackingId: string; paymentAmount: number; paymentDate: string };
      }>, options?: { enqueueNotifications?: boolean }) => Promise<{ paymentIds: string[]; wasReplay: boolean }>;
      getAllPaymentsByTerm: (academicYearId: string, termId: string) => Promise<unknown[]>;
    },
    writes,
    documents,
    getTermReadCount: () => termReadCount,
  };
}

const allocation = (amount = 400) => ({
  paymentData: {
    pupilId: 'pupil-1',
    feeStructureId: 'fee-1',
    academicYearId: 'year-1',
    termId: 'term-1',
    amount,
    paymentDate: '2026-09-11T10:00:00.000Z',
    paidBy: { id: 'cashier-1', name: 'Cashier', role: 'Staff' },
  },
  historyContext: { feeName: 'Tuition', source: 'test' },
});

test('payment operation retries return the original records and never write duplicates', async () => {
  const subject = loadPaymentsService();
  const first = await subject.PaymentsService.createPaymentOperation('fee-operation-001', [allocation()]);
  const firstWriteCount = subject.writes.length;

  const replay = await subject.PaymentsService.createPaymentOperation('fee-operation-001', [allocation()]);

  assert.equal(first.wasReplay, false);
  assert.equal(replay.wasReplay, true);
  assert.deepEqual(replay.paymentIds, first.paymentIds);
  assert.equal(subject.writes.length, firstWriteCount);
  assert.equal([...subject.documents.keys()].filter(key => key.startsWith('payments/')).length, 1);
});

test('one grouped payment command commits every allocation and its history together', async () => {
  const subject = loadPaymentsService();
  const result = await subject.PaymentsService.createPaymentOperation('fee-operation-003', [
    allocation(250),
    {
      ...allocation(150),
      paymentData: { ...allocation(150).paymentData, feeStructureId: 'fee-2' },
    },
  ]);

  assert.equal(result.paymentIds.length, 2);
  assert.equal([...subject.documents.keys()].filter(key => key.startsWith('payments/')).length, 2);
  assert.equal([...subject.documents.keys()].filter(key => key.startsWith('historyLogs/')).length, 2);
  assert.ok(subject.documents.has('paymentOperations/fee-operation-003'));
});

test('concurrent term reads share a request and subsequent refresh reads again', async () => {
  const subject = loadPaymentsService();
  await Promise.all([
    subject.PaymentsService.getAllPaymentsByTerm('year-1', 'term-1'),
    subject.PaymentsService.getAllPaymentsByTerm('year-1', 'term-1'),
  ]);
  assert.equal(subject.getTermReadCount(), 1);

  await subject.PaymentsService.getAllPaymentsByTerm('year-1', 'term-1');
  assert.equal(subject.getTermReadCount(), 2, 'refresh must read remote changes even without a local write');

  await subject.PaymentsService.createPaymentOperation('fee-operation-004', [allocation()]);
  await subject.PaymentsService.getAllPaymentsByTerm('year-1', 'term-1');
  assert.equal(subject.getTermReadCount(), 3);
});

test('payment operation rejects a reused ID whose financial payload changed', async () => {
  const subject = loadPaymentsService();
  await subject.PaymentsService.createPaymentOperation('fee-operation-002', [allocation(400)]);

  await assert.rejects(
    subject.PaymentsService.createPaymentOperation('fee-operation-002', [allocation(401)]),
    /different payment details/,
  );
});

test('uniform payment updates its tracking balance in the same operation', async () => {
  const subject = loadPaymentsService();
  subject.documents.set('uniformTracking/tracking-1', {
    pupilId: 'pupil-1',
    paidAmount: 100,
    finalAmount: 500,
    paymentStatus: 'partial',
    collectionStatus: 'pending',
    history: [],
  });

  await subject.PaymentsService.createPaymentOperation('uniform-operation-001', [{
    ...allocation(200),
    paymentData: { ...allocation(200).paymentData, isUniformPayment: true, uniformTrackingId: 'tracking-1' },
    uniformTracking: {
      trackingId: 'tracking-1',
      paymentAmount: 200,
      paymentDate: '2026-09-11T10:00:00.000Z',
    },
  }]);

  const tracking = subject.documents.get('uniformTracking/tracking-1')!;
  assert.equal(tracking.paidAmount, 300);
  assert.equal(tracking.paymentStatus, 'partial');
  assert.equal([...subject.documents.keys()].filter(key => key.startsWith('payments/')).length, 1);
});

test('the server payment command atomically creates one durable notification event per payment', async () => {
  const subject = loadPaymentsService();
  const result = await subject.PaymentsService.createPaymentOperation(
    'fee-notification-operation-001',
    [allocation(250), {
      ...allocation(150),
      paymentData: { ...allocation(150).paymentData, feeStructureId: 'fee-2' },
    }],
    { enqueueNotifications: true },
  );

  for (const paymentId of result.paymentIds) {
    assert.ok(subject.documents.has(`payments/${paymentId}`));
    assert.equal(
      subject.documents.get(`scheduledNotifications/fee-payment-events/outbox/payment-${paymentId}`)?.paymentId,
      paymentId,
    );
  }
});

test('one individual mixed-fee operation commits regular, uniform and carry-forward records together', async () => {
  const subject = loadPaymentsService();
  subject.documents.set('uniformTracking/tracking-1', {
    pupilId: 'pupil-1', paidAmount: 100, finalAmount: 500, history: [],
  });

  const result = await subject.PaymentsService.createPaymentOperation('mixed-operation-001', [
    allocation(300),
    {
      paymentData: {
        ...allocation(200).paymentData,
        feeStructureId: 'uniform-fee-1',
        isUniformPayment: true,
        uniformTrackingId: 'tracking-1',
      },
      uniformTracking: {
        trackingId: 'tracking-1', paymentAmount: 200, paymentDate: allocation().paymentData.paymentDate,
      },
    },
    {
      paymentData: {
        ...allocation(100).paymentData,
        feeStructureId: 'previous-balance',
        isCarryForwardPayment: true,
        originalFeeStructureId: 'fee-old',
        originalTermId: 'term-old',
        originalAcademicYearId: 'year-old',
      },
      historyContext: { feeName: 'Prior tuition', source: 'carry_forward_payment' },
    },
  ]);

  assert.equal(result.paymentIds.length, 3);
  assert.equal([...subject.documents.keys()].filter(key => key.startsWith('payments/')).length, 3);
  assert.equal([...subject.documents.keys()].filter(key => key.startsWith('historyLogs/')).length, 3);
  assert.equal(subject.documents.get('uniformTracking/tracking-1')!.paidAmount, 300);
});


test('failed uniform allocation leaves the whole family receipt uncommitted', async () => {
  const subject = loadPaymentsService();
  await assert.rejects(subject.PaymentsService.createPaymentOperation('family-missing-uniform', [
    allocation(100),
    { paymentData: { ...allocation(200).paymentData, uniformTrackingId: 'missing' },
      uniformTracking: { trackingId: 'missing', paymentAmount: 200, paymentDate: allocation().paymentData.paymentDate } },
  ]), /not found/);
  assert.equal(subject.documents.size, 0);
});

test('uniform tracking cannot be updated for a different pupil or amount', async () => {
  for (const [pupilId, amount] of [['other-pupil', 200], ['pupil-1', 201]] as const) {
    const subject = loadPaymentsService();
    subject.documents.set('uniformTracking/tracking-1', { pupilId, paidAmount: 0, finalAmount: 500 });
    await assert.rejects(subject.PaymentsService.createPaymentOperation('uniform-invalid-details', [{
      paymentData: { ...allocation(200).paymentData, uniformTrackingId: 'tracking-1' },
      uniformTracking: { trackingId: 'tracking-1', paymentAmount: amount, paymentDate: allocation().paymentData.paymentDate },
    }]), /match|belong/);
    assert.equal(subject.documents.get('uniformTracking/tracking-1')!.paidAmount, 0);
    assert.equal([...subject.documents.keys()].filter(key => key.startsWith('payments/')).length, 0);
  }
});

test('a retry does not increment a uniform tracking balance twice', async () => {
  const subject = loadPaymentsService();
  subject.documents.set('uniformTracking/tracking-1', { pupilId: 'pupil-1', paidAmount: 100, finalAmount: 500 });
  const command = [{ paymentData: { ...allocation(200).paymentData, uniformTrackingId: 'tracking-1' },
    uniformTracking: { trackingId: 'tracking-1', paymentAmount: 200, paymentDate: allocation().paymentData.paymentDate } }];
  const first = await subject.PaymentsService.createPaymentOperation('uniform-retry-stable', command);
  const replay = await subject.PaymentsService.createPaymentOperation('uniform-retry-stable', command);
  assert.deepEqual(first.paymentIds, replay.paymentIds);
  assert.equal(subject.documents.get('uniformTracking/tracking-1')!.paidAmount, 300);
});
