import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { onlineManager, QueryClient, QueryObserver } from '@tanstack/react-query';

const workspaceRoot = process.cwd();

function loadHook(
  relativePath: string,
  hookName: string,
  serviceImport: string,
  serviceName: string,
  serviceMethod: string,
  queryKey: readonly unknown[],
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  let reads = 0;
  const source = fs.readFileSync(path.join(workspaceRoot, relativePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} as Record<string, unknown> };

  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    require(name: string) {
      if (name === '@tanstack/react-query') {
        return { useQuery: (options: unknown) => options, useQueryClient: () => queryClient };
      }
      if (name === serviceImport) {
        return {
          [serviceName]: {
            [serviceMethod]: async () => {
              reads += 1;
              return [{ id: 'shared-record', amount: 800 }];
            },
          },
        };
      }
      if (name === '@/lib/services/pupil-snapshots.service' || name === '@/lib/utils/requirements-data-integrity'
        || name === './use-digital-signature' || name === '../contexts/auth-context') {
        return {};
      }
      throw new Error(`Unexpected import: ${name}`);
    },
    console: { log() {}, warn() {}, error() {} },
    process: { env: { NODE_ENV: 'test' } },
  }, { filename: relativePath });

  return { queryClient, hook: (module.exports[hookName] as (...args: any[]) => unknown), queryKey, getReads: () => reads };
}

function loadUniformHook() {
  return loadHook('src/lib/hooks/use-uniforms.ts', 'useUniforms', '../services/uniforms.service', 'UniformsService', 'getAllUniforms', ['uniforms']);
}

test('uniform management retries an empty preloaded catalogue when opened', async () => {
  const subject = loadUniformHook();
  subject.queryClient.setQueryData(subject.queryKey, []);
  const observer = new QueryObserver(subject.queryClient, subject.hook() as never);
  const unsubscribe = observer.subscribe(() => {});
  try {
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(subject.getReads(), 1);
    assert.deepEqual(subject.queryClient.getQueryData(subject.queryKey), [{ id: 'shared-record', amount: 800 }]);
  } finally {
    unsubscribe();
    subject.queryClient.clear();
  }
});

test('uniform management retries an empty catalogue after reconnecting', async () => {
  const subject = loadUniformHook();
  subject.queryClient.mount();
  subject.queryClient.setQueryData(subject.queryKey, []);
  const observer = new QueryObserver(subject.queryClient, { ...(subject.hook() as object), refetchOnMount: false } as never);
  const unsubscribe = observer.subscribe(() => {});
  try {
    onlineManager.setOnline(false);
    onlineManager.setOnline(true);
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(subject.getReads(), 1);
    assert.deepEqual(subject.queryClient.getQueryData(subject.queryKey), [{ id: 'shared-record', amount: 800 }]);
  } finally {
    unsubscribe();
    subject.queryClient.unmount();
    subject.queryClient.clear();
    onlineManager.setOnline(true);
  }
});

test('uniform management automatically refreshes populated data when reopened', async () => {
  const subject = loadUniformHook();
  subject.queryClient.setQueryData(subject.queryKey, [{ id: 'shared-record', amount: 500 }]);
  const observer = new QueryObserver(subject.queryClient, subject.hook() as never);
  const unsubscribe = observer.subscribe(() => {});
  try {
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(subject.getReads(), 1);
    assert.deepEqual(subject.queryClient.getQueryData(subject.queryKey), [{ id: 'shared-record', amount: 800 }]);
    unsubscribe();
    subject.queryClient.setQueryData(subject.queryKey, [{ id: 'shared-record', amount: 500 }]);
    const reopened = new QueryObserver(subject.queryClient, subject.hook() as never);
    const unsubscribeReopened = reopened.subscribe(() => {});
    try {
      await new Promise<void>(resolve => setImmediate(resolve));
      assert.equal(subject.getReads(), 2);
      assert.deepEqual(subject.queryClient.getQueryData(subject.queryKey), [{ id: 'shared-record', amount: 800 }]);
    } finally {
      unsubscribeReopened();
    }
  } finally {
    unsubscribe();
    subject.queryClient.clear();
  }
});

for (const catalog of [
  ['useActiveUniforms', 'getActiveUniforms', ['uniforms', 'active'], []],
  ['useUniformsByFilter', 'getUniformsByFilter', ['uniforms', 'filtered', { gender: 'male' }], [{ gender: 'male' }]],
] as const) {
  test(`${catalog[0]} fetches again when opened with a recently cached list`, async () => {
    const subject = loadHook('src/lib/hooks/use-uniforms.ts', catalog[0], '../services/uniforms.service', 'UniformsService', catalog[1], catalog[2]);
    subject.queryClient.setQueryData(subject.queryKey, [{ id: 'shared-record', amount: 500 }]);
    const observer = new QueryObserver(subject.queryClient, subject.hook(...catalog[3]) as never);
    const unsubscribe = observer.subscribe(() => {});
    try {
      await new Promise<void>(resolve => setImmediate(resolve));
      assert.equal(subject.getReads(), 1);
      assert.deepEqual(subject.queryClient.getQueryData(subject.queryKey), [{ id: 'shared-record', amount: 800 }]);
    } finally {
      unsubscribe();
      subject.queryClient.clear();
    }
  });
}

test('pupil uniform tracking fetches on opening and does not reuse another pupil as placeholder data', async () => {
  const subject = loadHook('src/lib/hooks/use-uniform-tracking.ts', 'useUniformTrackingByPupil', '../services/uniform-tracking.service', 'UniformTrackingService', 'getTrackingRecordsByPupil', ['uniformTracking', 'pupil', 'pupil-a']);
  subject.queryClient.setQueryData(subject.queryKey, [{ id: 'shared-record', amount: 500 }]);
  const observer = new QueryObserver(subject.queryClient, subject.hook('pupil-a') as never);
  const unsubscribe = observer.subscribe(() => {});
  try {
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(subject.getReads(), 1);
    observer.setOptions(subject.hook('pupil-b') as never);
    assert.equal(observer.getCurrentResult().data, undefined);
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(subject.getReads(), 2);
  } finally {
    unsubscribe();
    subject.queryClient.clear();
  }
});

for (const catalog of [
  ['src/lib/hooks/use-fees.ts', 'useFeeStructures', '../services/fees.service', 'FeesService', 'getAllFeeStructures', ['fees', 'structures', 'server-confirmed-v1']],
  ['src/lib/hooks/use-uniforms.ts', 'useUniforms', '../services/uniforms.service', 'UniformsService', 'getAllUniforms', ['uniforms']],
  ['src/lib/hooks/use-requirements.ts', 'useRequirements', '../services/requirements.service', 'RequirementsService', 'getAllRequirements', ['requirements']],
] as const) {
  test(`${catalog[1]} refreshes the server data after invalidation`, async () => {
    const subject = loadHook(catalog[0], catalog[1], catalog[2], catalog[3], catalog[4], catalog[5]);
    subject.queryClient.setQueryData(subject.queryKey, [{ id: 'shared-record', amount: 500 }]);
    const observer = new QueryObserver(subject.queryClient, subject.hook() as never);
    const unsubscribe = observer.subscribe(() => {});

    await new Promise<void>(resolve => setImmediate(resolve));
    const readsBeforeInvalidation = subject.getReads();

    await subject.queryClient.invalidateQueries({ queryKey: subject.queryKey });

    assert.deepEqual(subject.queryClient.getQueryData(subject.queryKey), [{ id: 'shared-record', amount: 800 }]);
    assert.equal(subject.getReads(), readsBeforeInvalidation + 1);
    unsubscribe();
    subject.queryClient.clear();
  });
}
