import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { QueryClient, QueryObserver } from '@tanstack/react-query';

const workspaceRoot = process.cwd();

function loadHook(
  relativePath: string,
  hookName: string,
  serviceImport: string,
  serviceName: string,
  serviceMethod: string,
  queryKey: readonly string[],
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
      if (name === '@/lib/services/pupil-snapshots.service' || name === '@/lib/utils/requirements-data-integrity') {
        return {};
      }
      throw new Error(`Unexpected import: ${name}`);
    },
    console: { log() {}, warn() {}, error() {} },
    process: { env: { NODE_ENV: 'test' } },
  }, { filename: relativePath });

  return { queryClient, hook: (module.exports[hookName] as () => unknown), queryKey, getReads: () => reads };
}

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

    await subject.queryClient.invalidateQueries({ queryKey: subject.queryKey });

    assert.deepEqual(subject.queryClient.getQueryData(subject.queryKey), [{ id: 'shared-record', amount: 800 }]);
    assert.equal(subject.getReads(), 1);
    unsubscribe();
    subject.queryClient.clear();
  });
}
