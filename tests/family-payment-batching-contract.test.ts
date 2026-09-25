import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function ledgerFixture() {
  const rows = Array.from({ length: 61 }, (_, i) => ({
    id: 'payment-' + i, pupilId: 'pupil-' + i, amount: i + 1,
    paymentDate: '2026-09-12', createdAt: '2026-09-12',
  }));
  rows.push({ ...rows[0], id: 'earlier', paymentDate: '2026-09-01' });
  const reads: any[] = [];
  let fail = false;
  const firestore = {
    collection: () => ({}),
    query: (_ref: unknown, ...filters: any[]) => filters,
    where: (field: string, operator: string, value: any) => ({ field, operator, value }),
    orderBy: (field: string) => ({ order: field }),
    getDocs: async (filters: any[]) => {
      reads.push(filters);
      if (fail) throw new Error('Ledger unavailable');
      const group = filters.find(f => f.field === 'pupilId');
      if (group.operator === 'in') assert.ok(group.value.length <= 30);
      const matches = rows.filter(row => group.operator === 'in' ? group.value.includes(row.pupilId) : group.value === row.pupilId);
      matches.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
      return { docs: matches.map(row => ({ id: row.id, data: () => row })) };
    },
  };
  const module = { exports: {} as any };
  const output = ts.transpileModule(fs.readFileSync('src/lib/services/payments.service.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, console: { error() {} }, require(name: string) {
    if (name === 'firebase/firestore') return firestore;
    if (name === '../firebase') return { db: {} };
    if (name === './history-log.service') return {};
    throw new Error(name);
  } });
  return { service: module.exports.PaymentsService, reads, fail: () => { fail = true; } };
}

test('family fees load sibling ledgers through bounded payment batches', () => {
  const service = fs.readFileSync(path.join(process.cwd(), 'src/lib/services/payments.service.ts'), 'utf8');
  const familyHook = fs.readFileSync(path.join(process.cwd(), 'src/app/fees/family/[...slug]/hooks/useFamilyFees.ts'), 'utf8');

  assert.match(service, /getPaymentsByPupilIds/);
  assert.match(service, /uniqueIds\.length \/ 30/);
  assert.match(service, /where\('pupilId', 'in', pupilIdBatch\)/);
  assert.match(familyHook, /PaymentsService\.getPaymentsByPupilIds\(pupilIds\)/);
  assert.doesNotMatch(familyHook, /pupilIds\.map\(async \(pupilId\)[\s\S]*getPaymentsByPupil/);
});

test('batched ledgers preserve every per-pupil record and date order without leaking other pupils', async () => {
  const f = ledgerFixture();
  const batched = await f.service.getPaymentsByPupilIds(['pupil-0', 'pupil-1', 'pupil-0', 'empty']);
  assert.equal(f.reads.length, 1);
  assert.equal(batched.size, 3);
  for (const id of ['pupil-0', 'pupil-1', 'empty']) {
    assert.equal(JSON.stringify(batched.get(id)), JSON.stringify(await f.service.getPaymentsByPupil(id)));
  }
});

test('61 pupil scopes use three bounded queries, while an empty family reads nothing', async () => {
  const f = ledgerFixture();
  await f.service.getPaymentsByPupilIds([]);
  assert.equal(f.reads.length, 0);
  await f.service.getPaymentsByPupilIds(Array.from({ length: 61 }, (_, i) => 'pupil-' + i));
  assert.equal(f.reads.length, 3);
});

test('failed batch rejects instead of returning zero paid amounts', async () => {
  const f = ledgerFixture();
  f.fail();
  await assert.rejects(f.service.getPaymentsByPupilIds(['pupil-0']), /Ledger unavailable/);
});

test('family fee hook exposes a failed ledger and suppresses incomplete calculated totals', () => {
  const failure = new Error('Ledger unavailable');
  const source = fs.readFileSync('src/app/fees/family/[...slug]/hooks/useFamilyFees.ts', 'utf8');
  const module = { exports: {} as any };
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, require(name: string) {
    if (name === 'react') return { useMemo: (fn: Function) => fn() };
    if (name === '@tanstack/react-query') return { useQueryClient: () => ({ fetchQuery: () => Promise.resolve(null) }), useQuery: (options: any) => ({
      data: new Map(), isLoading: false,
      error: options.queryKey[0] === 'family-payments-all' ? failure : null,
    }) };
    if (name === '@/lib/hooks/use-fees') return { useFeeStructures: () => ({ data: [], isLoading: false }) };
    if (name === '@/lib/hooks/use-uniforms') return { useUniforms: () => ({ data: [], isLoading: false }) };
    return {};
  } });
  const result = module.exports.useFamilyFees({
    familyId: 'f', familyPupils: [{ id: 'p' }], selectedTermId: 't',
    selectedAcademicYear: { id: 'y', terms: [{ id: 't' }] }, academicYears: [],
  });
  assert.equal(result.isError, true);
  assert.equal(result.error, failure);
  assert.equal(Object.keys(result.feesInfo).length, 0);
});
