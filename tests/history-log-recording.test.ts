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
  const reads: unknown[][] = [];
  let documents: Array<{ id: string; data: () => Record<string, unknown> }> = [];
  const sdk = {
    Timestamp: { now: () => timestamp, fromDate: (date: Date) => date.toISOString() }, collection: () => 'historyLogs', doc: () => 'history-document',
    where: (...args: unknown[]) => ['where', ...args], orderBy: (...args: unknown[]) => ['orderBy', ...args],
    limit: (value: number) => ['limit', value], startAfter: (value: unknown) => ['startAfter', value],
    query: (...args: unknown[]) => { reads.push(args); return args; },
    getDocs: async () => ({ docs: documents, metadata: { fromCache: true } }),
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
  return { service, written, atomicWriter, timestamp, reads, setDocuments: (rows: typeof documents) => { documents = rows; } };
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


test('historical reads use a bounded date query and the last visible record as the next cursor', async () => {
  const { service, reads, setDocuments } = fixture(false);
  assert.equal(reads.length, 0, 'Creating the service performs no historical read');
  const rows = Array.from({ length: 201 }, (_, index) => ({ id: String(index), data: () => ({ a: 'update', e: 'pupil', rid: 'a', ts: '2026-10-01T12:00:00Z' }) }));
  setDocuments(rows);
  const page = await service.getRangePage('2026-10-01', '2026-10-01');
  assert.equal(page.logs.length, 200);
  assert.equal(page.hasMore, true);
  assert.equal(page.cursor, rows[199]);
  assert.equal(page.fromCache, true);
  const constraints = JSON.stringify(reads[0]);
  assert.match(constraints, /2026-09-30T21:00:00.000Z/);
  assert.match(constraints, /2026-10-01T21:00:00.000Z/);
  assert.match(constraints, /\["limit",201\]/);
  setDocuments(rows.slice(200));
  const next = await service.getRangePage('2026-10-01', '2026-10-01', page.cursor);
  assert.equal(next.logs[0].id, '200');
  assert.equal(next.hasMore, false);
  assert.match(JSON.stringify(reads[1]), /startAfter/);
  await assert.rejects(service.getRangePage('2026-02-30', '2026-03-01'));
  assert.equal(reads.length, 2, 'Invalid ranges do not query Firestore');
});
