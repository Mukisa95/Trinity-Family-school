import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const uniform = {
  name: 'SHIRT', group: 'Shirts', price: 30000, gender: 'all',
  classType: 'all', sectionType: 'all', isActive: true,
};

function snapshot(items: Record<string, unknown>[]) {
  return { empty: items.length === 0, docs: items.map((data, index) => ({ id: `item-${index}`, data: () => data })) };
}

function loadService(file: string, serviceName: string, serverData: Record<string, unknown>[], cachedData: Record<string, unknown>[], readError?: Error) {
  let serverReads = 0;
  let cacheReads = 0;
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} as any };
  vm.runInNewContext(output, {
    module, exports: module.exports, console: { error() {}, warn() {} },
    require(name: string) {
      if (name === '../firebase') return { db: {} };
      if (name === '@/lib/fees/fee-reminder-change-client') return { notifyFeeReminderChange: async () => {} };
      if (name === 'firebase/firestore') return {
        collection: (_db: unknown, collection: string) => collection,
        query: (...constraints: unknown[]) => constraints,
        orderBy: (...args: unknown[]) => args,
        where: (...args: unknown[]) => args,
        getDocs: async () => { throw new Error('Use a server read so an empty offline cache cannot masquerade as current data'); },
        getDocsFromServer: async () => {
          serverReads++;
          if (readError) throw readError;
          return snapshot(serverData);
        },
        getDocsFromCache: async () => { cacheReads++; return snapshot(cachedData); },
      };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return { service: module.exports[serviceName], getReads: () => ({ serverReads, cacheReads }) };
}

for (const method of ['getAllUniforms', 'getActiveUniforms', 'getUniformsByFilter']) {
  test(`${method} checks the server even when the local catalogue is empty`, async () => {
    const subject = loadService('src/lib/services/uniforms.service.ts', 'UniformsService', [uniform], []);
    const items = await subject.service[method]({ gender: 'male' });
    assert.equal(items.length, 1);
    assert.equal(items[0].name, 'SHIRT');
    assert.deepEqual(subject.getReads(), { serverReads: 1, cacheReads: 0 });
  });

  test(`${method} preserves a server error when the offline cache is empty`, async () => {
    const error = new Error('permission-denied');
    const subject = loadService('src/lib/services/uniforms.service.ts', 'UniformsService', [], [], error);
    await assert.rejects(() => subject.service[method]({}), failure => failure === error);
    assert.deepEqual(subject.getReads(), { serverReads: 1, cacheReads: 1 });
  });
}

test('a populated uniform cache remains usable offline', async () => {
  const subject = loadService('src/lib/services/uniforms.service.ts', 'UniformsService', [], [uniform], new Error('unavailable'));
  const items = await subject.service.getAllUniforms();
  assert.equal(items.length, 1);
  assert.equal(items[0].name, 'SHIRT');
});

test('only a successful server read confirms an empty uniform catalogue', async () => {
  const subject = loadService('src/lib/services/uniforms.service.ts', 'UniformsService', [], [uniform]);
  assert.equal((await subject.service.getAllUniforms()).length, 0);
  assert.deepEqual(subject.getReads(), { serverReads: 1, cacheReads: 0 });
});

test('pupil tracking reads the server and preserves legacy assignment metadata', async () => {
  const subject = loadService('src/lib/services/uniform-tracking.service.ts', 'UniformTrackingService', [{ pupilId: 'pupil', uniformId: 'shirt', createdAt: '2026-01-01' }], []);
  const records = await subject.service.getTrackingRecordsByPupil('pupil');
  assert.equal(records.length, 1);
  assert.equal(records[0].academicYearId, 'legacy-record');
  assert.deepEqual(subject.getReads(), { serverReads: 1, cacheReads: 0 });
});

test('a tracking server failure with no cached assignments cannot become a zero-record success', async () => {
  const error = new Error('unavailable');
  const subject = loadService('src/lib/services/uniform-tracking.service.ts', 'UniformTrackingService', [], [], error);
  await assert.rejects(() => subject.service.getTrackingRecordsByPupil('pupil'), failure => failure === error);
});

test('existing pupil assignments remain usable offline', async () => {
  const subject = loadService('src/lib/services/uniform-tracking.service.ts', 'UniformTrackingService', [], [{ pupilId: 'pupil', uniformId: 'shirt' }], new Error('unavailable'));
  assert.equal((await subject.service.getTrackingRecordsByPupil('pupil')).length, 1);
});
