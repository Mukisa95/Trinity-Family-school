import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

// Execute the actual page handlers with controlled I/O. No live Firebase writes.
const pagePath = 'src/app/fees/collect/[id]/PupilFeesCollectionClient.tsx';
function loadHandler(name: string, dependencies: Record<string, unknown>) {
  const source = fs.readFileSync(pagePath, 'utf8');
  const file = ts.createSourceFile(pagePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer = '';
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === name) {
      initializer = node.initializer!.getText(file);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.ok(initializer, `Missing handler ${name}`);
  const compiled = ts.transpileModule(`module.exports = ${initializer};`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: undefined as unknown };
  vm.runInNewContext(compiled, {
    module, Date, Intl, console: { error() {} }, ...dependencies,
  });
  return module.exports as (data?: { amount: number }) => Promise<void>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

function fixture(uniform = false) {
  const commit = deferred<{ ok: boolean; json: () => Promise<Record<string, unknown>> }>();
  const audit = deferred<void>();
  const state = {
    open: true, reversing: false, pending: { id: 'original-dialog' } as unknown,
    payments: [] as Array<Record<string, unknown>>, toasts: [] as Array<Record<string, string>>,
    signatureArgs: [] as unknown[][], cleared: [] as string[], requests: 0, refreshes: 0,
  };
  const fee = { feeId: 'fee-1', id: 'fee-1', name: 'Transport', amount: 1000, balance: 700, amountPaid: 300, uniformTrackingId: 'uniform-1' };
  const user = { id: 'cashier-1', username: 'Cashier', role: 'Staff' };
  const dependencies = {
    selectedFee: fee, pupil: { id: 'test-pupil', firstName: 'Test', lastName: 'Pupil' },
    selectedAcademicYear: { id: 'year-1', name: '2026' }, selectedTermId: 'term-1', user,
    pupilFees: [fee], isRevertingPayment: false,
    pendingPaymentReversal: { payment: { id: 'payment-1', amount: 500, pupilId: 'test-pupil', feeStructureId: 'fee-1' } },
    getPaymentOperation: () => ({ operationId: 'stable-operation', paymentDate: '2026-09-13T12:00:00.000Z' }),
    clearPaymentOperation: (key: string) => state.cleared.push(key),
    fetch: async () => { state.requests++; return commit.promise; },
    PaymentsService: { revertPayment: async () => { state.requests++; await commit.promise; } },
    require: (name: string) => {
      assert.equal(name, '@/lib/services/uniform-fees-integration.service');
      return { UniformFeesIntegrationService: {
        isUniformFee: () => uniform,
        createUniformPaymentRecord: async () => { state.requests++; await commit.promise; return 'payment-1'; },
      } };
    },
    setIsPaymentModalOpen: (open: boolean) => { state.open = open; },
    setSelectedFee: () => {},
    setPendingPaymentReversal: (pending: unknown) => { state.pending = pending; },
    setIsRevertingPayment: (value: boolean) => { state.reversing = value; },
    addPupilPayments: (payments: Array<Record<string, unknown>>) => { state.payments.push(...payments); },
    setLastPaymentTimestamp: () => {},
    queryClient: { invalidateQueries: async () => {} },
    invalidateFinanceSummaryQueries: () => {},
    refetch: async () => { state.refreshes++; },
    toast: (message: Record<string, string>) => { state.toasts.push(message); },
    signAction: (...args: unknown[]) => { state.signatureArgs.push(args); return audit.promise; },
  };
  const confirm = (body = { paymentId: 'payment-1' } as Record<string, unknown>) => commit.resolve({ ok: true, json: async () => body });
  return { state, dependencies, commit, audit, confirm };
}

for (const uniform of [false, true]) {
  test(`${uniform ? 'uniform' : 'regular'} payment releases the dialog and publishes once before a slow signature completes`, async () => {
    const f = fixture(uniform);
    const run = loadHandler('handlePaymentSubmit', f.dependencies)({ amount: 500 });
    await flush();
    assert.equal(f.state.open, true, 'must wait for the financial acknowledgement');
    assert.equal(f.state.payments.length, 0);
    f.confirm();
    await flush();
    assert.equal(f.state.open, false, 'signature must not keep the payment modal open');
    assert.equal(f.state.payments.length, 1);
    assert.equal(f.state.payments[0].amount, 500);
    assert.equal(f.state.payments[0].id, 'payment-1');
    assert.equal(f.state.signatureArgs.length, 1, 'audit still runs');
    assert.equal(f.state.signatureArgs[0][4], 'fee-payment:stable-operation:payment-1');
    assert.ok(f.state.toasts.some(t => t.title === 'Payment Successful'));
    f.state.open = true; // User opens another fee while the first audit is pending.
    f.audit.resolve();
    await run;
    assert.equal(f.state.open, true, 'a late audit must not close the next payment');
    assert.equal(f.state.requests, 1);
  });
}

test('a failed signature cannot reopen or repeat a committed payment', async () => {
  const f = fixture();
  const run = loadHandler('handlePaymentSubmit', f.dependencies)({ amount: 500 });
  f.confirm();
  await flush();
  f.audit.reject(new Error('audit unavailable'));
  await run;
  assert.equal(f.state.open, false);
  assert.equal(f.state.requests, 1);
  assert.equal(f.state.payments.length, 1);
  assert.match(f.state.toasts.at(-1)!.description, /do not record the payment again/);
  assert.ok(!f.state.toasts.some(t => t.title === 'Payment Failed'));
});

for (const outcome of ['rejected', 'missing-id']) {
  test(`payment ${outcome} keeps retry identity and does not announce success`, async () => {
    const f = fixture();
    const run = loadHandler('handlePaymentSubmit', f.dependencies)({ amount: 500 });
    await flush();
    if (outcome === 'rejected') f.commit.reject(new Error('response interrupted'));
    else f.confirm({});
    await run;
    assert.equal(f.state.open, true);
    assert.equal(f.state.cleared.length, 0);
    assert.equal(f.state.payments.length, 0);
    assert.equal(f.state.signatureArgs.length, 0);
    assert.equal(f.state.toasts.at(-1)!.title, 'Payment Failed');
  });
}

test('a post-payment display error cannot skip the audit or suggest resubmission', async () => {
  const f = fixture();
  f.dependencies.invalidateFinanceSummaryQueries = () => { throw new Error('display refresh failed'); };
  const run = loadHandler('handlePaymentSubmit', f.dependencies)({ amount: 500 });
  f.confirm();
  await flush();
  assert.equal(f.state.open, false);
  assert.equal(f.state.signatureArgs.length, 1);
  assert.ok(f.state.toasts.some(t => t.title === 'Payment recorded; display refresh needed'));
  f.audit.resolve();
  await run;
  assert.equal(f.state.requests, 1);
});

test('reversal releases its confirmation and starts refreshing before the signature completes', async () => {
  const f = fixture();
  const run = loadHandler('confirmRevertPayment', f.dependencies)();
  await flush();
  assert.equal(f.state.reversing, true);
  assert.ok(f.state.pending);
  assert.equal(f.state.refreshes, 0);
  f.confirm();
  await flush();
  assert.equal(f.state.pending, null);
  assert.equal(f.state.reversing, false);
  assert.equal(f.state.refreshes, 1);
  assert.equal(f.state.signatureArgs.length, 1);
  assert.ok(f.state.toasts.some(t => t.title === 'Payment Reverted'));
  const nextDialog = { id: 'next-dialog' };
  f.state.pending = nextDialog;
  f.state.reversing = true;
  f.audit.resolve();
  await run;
  assert.equal(f.state.pending, nextDialog);
  assert.equal(f.state.reversing, true, 'old signature completion must not release a new reversal');
  assert.equal(f.state.requests, 1);
});

test('failed reversal remains unconfirmed and never starts a signature', async () => {
  const f = fixture();
  const run = loadHandler('confirmRevertPayment', f.dependencies)();
  f.commit.reject(new Error('commit failed'));
  await run;
  assert.ok(f.state.pending);
  assert.equal(f.state.reversing, false);
  assert.equal(f.state.signatureArgs.length, 0);
  assert.equal(f.state.refreshes, 0);
  assert.equal(f.state.toasts.at(-1)!.title, 'Revert Failed');
});

test('reversal audit failure reports the already committed outcome without retrying', async () => {
  const f = fixture();
  const run = loadHandler('confirmRevertPayment', f.dependencies)();
  f.confirm();
  await flush();
  f.audit.reject(new Error('signature failed'));
  await run;
  assert.equal(f.state.pending, null);
  assert.equal(f.state.requests, 1);
  assert.match(f.state.toasts.at(-1)!.description, /do not reverse it again/);
});

test('reversal display failure still attempts its signature without reopening confirmation', async () => {
  const f = fixture();
  f.dependencies.refetch = () => { throw new Error('refresh failed'); };
  const run = loadHandler('confirmRevertPayment', f.dependencies)();
  f.confirm();
  await flush();
  assert.equal(f.state.pending, null);
  assert.equal(f.state.signatureArgs.length, 1);
  assert.ok(f.state.toasts.some(t => t.title === 'Payment reversed; display refresh needed'));
  f.audit.resolve();
  await run;
});
