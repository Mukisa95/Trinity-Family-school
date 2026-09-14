import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function loadBanking() {
  const documents = new Map<string, any>([['bankAccounts/a', { pupilId: 'p', balance: 100 }]]);
  const versions = new Map<string, number>();
  let nextId = 0;
  const snapshot = (ref: any) => ({ ref, id: ref.id, exists: () => documents.has(ref.path), data: () => ({ ...documents.get(ref.path) }) });
  const firestore = {
    collection: (_db: unknown, name: string) => ({ name }),
    doc: (...args: any[]) => {
      const name = args.length === 1 ? args[0].name : args[1];
      const id = args.length === 1 ? `auto-${++nextId}` : args[2];
      return { path: `${name}/${id}`, id };
    },
    where: (field: string, operator: string, value: unknown) => ({ field, value }),
    query: (collection: any, ...filters: any[]) => ({ collection, filters }),
    getDocs: async (q: any) => {
      const docs = [...documents].filter(([path, data]) => path.startsWith(q.collection.name + '/')
        && q.filters.every((filter: any) => data[filter.field] === filter.value))
        .map(([path]) => snapshot({ path, id: path.split('/')[1] }));
      return { docs, empty: !docs.length };
    },
    Timestamp: { now: () => '2026-09-12T00:00:00Z' },
    runTransaction: async (_db: unknown, callback: Function) => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const reads = new Map<string, number>();
        const writes = new Map<string, any>();
        const result = await callback({
          get: async (ref: any) => {
            // Match the installed Web SDK: get(Query) is invalid.
            assert.equal(typeof ref.path, 'string', 'transaction.get requires a document reference');
            assert.equal(writes.size, 0, 'all reads must precede writes');
            reads.set(ref.path, versions.get(ref.path) || 0);
            return snapshot(ref);
          },
          set: (ref: any, data: any) => writes.set(ref.path, data),
          update: (ref: any, data: any) => writes.set(ref.path, { ...documents.get(ref.path), ...data }),
        });
        if ([...reads].some(([path, version]) => (versions.get(path) || 0) !== version)) continue;
        writes.forEach((data, path) => {
          documents.set(path, data);
          versions.set(path, (versions.get(path) || 0) + 1);
        });
        return result;
      }
      throw new Error('Transaction contention');
    },
  };
  const output = ts.transpileModule(fs.readFileSync('src/lib/services/banking.service.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} as any };
  vm.runInNewContext(output, { module, exports: module.exports, console, require(name: string) {
    if (name === 'firebase/firestore') return firestore;
    if (name === '../firebase') return { db: {} };
    if (name === './history-log.service') return { HistoryLogService: { addToTransaction(tx: any, input: any) {
      tx.set({ path: `history/${input.recordId}` }, input);
    } } };
    if (name === './pupils.service') return {};
    if (name === './pupil-snapshots.service') return { PupilSnapshotsService: { getSnapshot: async () => null } };
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return { service: module.exports.BankingService, documents };
}

const command = (type: string, amount: number) => ({ pupilId: 'p', accountId: 'a', type, amount,
  description: 'Cash transaction', academicYearId: 'y', termId: 't', transactionDate: '2026-09-12' });

test('two concurrent withdrawals cannot spend the same opening balance', async () => {
  const { service, documents } = loadBanking();
  const results = await Promise.allSettled([service.createTransaction(command('WITHDRAWAL', 80)), service.createTransaction(command('WITHDRAWAL', 80))]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(documents.get('bankAccounts/a').balance, 20);
  assert.equal([...documents.keys()].filter(key => key.startsWith('bankTransactions/')).length, 1);
});

test('deposit retains the original loan-priority amounts and displayed balance', async () => {
  const { service, documents } = loadBanking();
  documents.set('bankLoans/l', { pupilId: 'p', amount: 70, amountRepaid: 20, status: 'ACTIVE', purpose: 'Books', createdAt: '2026-01-01' });
  const saved = await service.createTransaction(command('DEPOSIT', 80));
  assert.equal(saved.amount, 30);
  assert.equal(saved.balance, 130);
  assert.equal(documents.get('bankLoans/l').amountRepaid, 70);
  assert.equal(documents.get('bankLoans/l').status, 'PAID');
});

test('loan creation preserves the loan, disbursement and balance as one commit', async () => {
  const { service, documents } = loadBanking();
  const loan = await service.createLoan({ pupilId: 'p', amount: 50, purpose: 'Books', repaymentDate: '2026-10-01' });
  assert.equal(documents.get('bankAccounts/a').balance, 150);
  assert.equal(documents.get(`bankLoans/${loan.id}`).amount, 50);
  assert.equal([...documents.keys()].filter(key => key.startsWith('bankTransactions/')).length, 1);
});

test('enhanced loan creation uses the same atomic loan and disbursement command', async () => {
  const { service, documents } = loadBanking();
  const loan = await service.createEnhancedLoan({
    pupilId: 'p', amount: 50, purpose: 'Books', repaymentDate: '2026-10-01',
    academicYearId: 'year-1', termId: 'term-1',
  });

  assert.equal(documents.get('bankAccounts/a').balance, 150);
  assert.equal(documents.get(`bankLoans/${loan.id}`).amount, 50);
  assert.equal([...documents.keys()].filter(key => key.startsWith('bankTransactions/')).length, 1);
});

test('repeated reversal and cancellation do not change balances twice', async () => {
  const { service, documents } = loadBanking();
  documents.set('bankTransactions/original', command('WITHDRAWAL', 20));
  await service.revertTransaction('original');
  await assert.rejects(service.revertTransaction('original'), /already been reverted/);
  assert.equal(documents.get('bankAccounts/a').balance, 120);
  documents.set('bankLoans/l', { pupilId: 'p', amount: 50, amountRepaid: 10, status: 'ACTIVE', purpose: 'Books' });
  await service.cancelLoan('l');
  await assert.rejects(service.cancelLoan('l'), /Only active/);
  assert.equal(documents.get('bankAccounts/a').balance, 80);
});

test('a balance-changing command refuses an ambiguous pupil account', async () => {
  const { service, documents } = loadBanking();
  documents.set('bankAccounts/b', { pupilId: 'p', balance: 200 });

  await assert.rejects(service.createTransaction(command('WITHDRAWAL', 20)), /Multiple banking accounts/);
  assert.equal(documents.get('bankAccounts/a').balance, 100);
  assert.equal(documents.get('bankAccounts/b').balance, 200);
});

test('concurrent overdue processing creates one repayment and keeps its balance atomic', async () => {
  const { service, documents } = loadBanking();
  documents.set('bankLoans/overdue', {
    pupilId: 'p', amount: 80, amountRepaid: 0, status: 'ACTIVE', purpose: 'Books',
    repaymentDate: '2020-01-01', createdAt: '2020-01-01',
  });

  const results = await Promise.all([
    service.processOverdueLoans('p'),
    service.processOverdueLoans('p'),
  ]);

  assert.equal(results.filter((result: { processed: boolean }) => result.processed).length, 1);
  assert.equal(documents.get('bankAccounts/a').balance, 20);
  assert.equal(documents.get('bankLoans/overdue').amountRepaid, 80);
  assert.equal(documents.get('bankLoans/overdue').status, 'PAID');
  assert.equal([...documents.keys()].filter(key => key.startsWith('bankTransactions/')).length, 1);
});

test('enhanced loans without academic context retain the prior loan-only behavior', async () => {
  const { service, documents } = loadBanking();
  await service.createEnhancedLoan({ pupilId: 'p', amount: 50, purpose: 'Books', repaymentDate: '2026-10-01' });
  assert.equal(documents.get('bankAccounts/a').balance, 100);
  assert.equal([...documents.keys()].filter(key => key.startsWith('bankTransactions/')).length, 0);
});

test('enhanced disbursement preserves period and receiving actor metadata', async () => {
  const { service, documents } = loadBanking();
  await service.createEnhancedLoan({ pupilId: 'p', amount: 50, purpose: 'Books', repaymentDate: '2026-10-01', academicYearId: 'y', termId: 't' });
  const row = [...documents.entries()].find(([key]) => key.startsWith('bankTransactions/'))![1];
  assert.equal(row.academicYearId, 'y');
  assert.equal(row.termId, 't');
  assert.equal(row.processedBy, 'System');
});

test('overdue processing preserves oldest-first priority for Firestore timestamps', async () => {
  const { service, documents } = loadBanking();
  const loan = { pupilId: 'p', amount: 80, amountRepaid: 0, status: 'ACTIVE', purpose: 'Books', repaymentDate: '2020-01-01' };
  documents.set('bankLoans/newer', { ...loan, createdAt: { toDate: () => new Date('2019-06-01') } });
  documents.set('bankLoans/older', { ...loan, createdAt: { toDate: () => new Date('2019-01-01') } });
  await service.processOverdueLoans('p');
  assert.equal(documents.get('bankLoans/older').amountRepaid, 80);
  assert.equal(documents.get('bankLoans/newer').amountRepaid, 20);
  assert.equal(documents.get('bankAccounts/a').balance, 0);
});
