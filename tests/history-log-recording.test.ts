import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

function fixture(browser = true) {
  const written: Array<Record<string, unknown>> = [];
  const timestamp = { marker: 'timestamp' };
  const window = browser ? {
    location: { pathname: '/fees/collect/pupil-a', search: '?tab=fees&token=secret' },
    localStorage: { getItem: () => JSON.stringify({ id: 'actor', username: 'Cashier', role: 'Staff' }) },
  } : undefined;
  const sdk = {
    Timestamp: { now: () => timestamp }, collection: () => 'historyLogs', doc: () => 'history-document',
    addDoc: async (_ref: unknown, payload: Record<string, unknown>) => { written.push(payload); },
  };
  const cache = new Map<string, any>();
  const load = (file: string): any => {
    if (cache.has(file)) return cache.get(file);
    const module = { exports: {} };
    cache.set(file, module.exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    vm.runInNewContext(code, { module, exports: module.exports, window, URL, URLSearchParams,
      require: (name: string) => {
        if (name === 'firebase/firestore') return sdk;
        if (name === '@/lib/firebase') return { db: {} };
        if (name === '@/lib/utils/logger') return { logger: { error() {}, warn() {} } };
        return load(path.resolve(path.dirname(file), name + '.ts'));
      },
    });
    cache.set(file, module.exports);
    return module.exports;
  };
  const service = load(path.resolve('src/lib/services/history-log.service.ts')).HistoryLogService;
  const atomicWriter = { set: (_ref: unknown, payload: Record<string, unknown>) => written.push(payload) };
  return { service, written, atomicWriter, timestamp };
}

test('direct, batch and transaction history keep complete input and a safe origin route', async () => {
  const { service, written, atomicWriter, timestamp } = fixture();
  const input = { action: 'create', entity: 'payment', recordId: 'payment-a', label: 'Tuition',
    changedFields: ['amount'], meta: { amount: 5000, pupilId: 'pupil-a', notes: 'Full note' } };
  await service.log(input);
  service.addToBatch(atomicWriter, input);
  service.addToTransaction(atomicWriter, input);
  assert.equal(written.length, 3);
  for (const payload of written) {
    assert.equal(payload.rp, '/fees/collect/pupil-a?tab=fees');
    assert.equal(payload.rid, 'payment-a');
    assert.equal(payload.rl, 'Tuition');
    assert.equal(payload.uid, 'actor');
    assert.equal(payload.un, 'Cashier');
    assert.equal(payload.ur, 'Staff');
    assert.equal(payload.ts, timestamp);
    assert.equal(JSON.stringify(payload.cf), '["amount"]');
    assert.equal(JSON.stringify(payload.m), JSON.stringify(input.meta));
  }
});

test('server audit/export calls retain an explicitly supplied page and work without a browser', async () => {
  const { service, written } = fixture(false);
  await service.audit({ action: 'permission', entity: 'user', recordId: 'user-a', route: '/users?token=secret', meta: { role: 'Staff' } });
  await service.logExport({ dataType: 'pupils', route: '/pupils?classId=c1', recordCount: 7 });
  await service.log({ action: 'update', entity: 'pupil', recordId: 'a' });
  assert.equal(written[0].rp, '/users');
  assert.equal(written[1].rp, '/pupils?classId=c1');
  assert.equal('rp' in written[2], false);
});
