import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { QueryClient } from '@tanstack/react-query';
import { filterSchoolCatalogue } from '../src/lib/selectors/school-catalogue-selectors';

const user = { id: 'first', role: 'Admin', isActive: true };
const scope = 'first:Admin';
function fixture() {
  let resolve!: (value: unknown) => void;
  let access = true, reads = 0;
  const writes: unknown[][] = [];
  const disk = new Promise(done => { resolve = done; });
  const auth = { currentUser: { uid: 'first', isAnonymous: false } };
  const module = { exports: {} as any };
  const source = ts.transpileModule(fs.readFileSync('src/lib/cache/school-catalogue-cache.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports, process: { env: {} },
    require(name: string) {
      if (name === '@/lib/firebase') return { auth };
      if (name.includes('workspace-auth')) return { withWorkspaceIdentity: (_: string, read: () => unknown) => read() };
      if (name.includes('workspace-cache-access')) return {
        workspaceCacheAccessScope: (item: typeof user) => item.id + ':' + item.role,
        hasSavedWorkspaceAccess: () => access,
      };
      if (name.includes('persistent-collection-cache')) return {
        persistentCollectionCacheKey: (...parts: string[]) => parts.join(':'),
        readPersistentCollectionWithMetadata: () => { reads++; return disk; },
        writePersistentCollection: (...args: unknown[]) => { writes.push(args); return Promise.resolve(); },
      };
      throw new Error(name);
    },
  });
  return { api: module.exports, auth, writes, resolve, reads: () => reads, revoke: () => { access = false; },
    client: new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }) };
}

test('saved copies require complete data and the matching permission scope, including confirmed empty', () => {
  const { api } = fixture();
  assert.equal(api.isSavedCatalogueSnapshot({ data: [], complete: true, authorizationScope: scope }, scope), true);
  for (const snapshot of [null, { data: [], authorizationScope: scope }, { data: [], complete: false, authorizationScope: scope },
    { data: [], complete: true, authorizationScope: 'other' }, { data: {}, complete: true, authorizationScope: scope }]) {
    assert.equal(api.isSavedCatalogueSnapshot(snapshot, scope), false);
  }
});

test('concurrent restoration reads once and a late saved list cannot replace live empty data', async () => {
  const f = fixture(), key = f.api.catalogueKey('requirements', scope);
  const first = f.api.restoreCatalogue(f.client, 'requirements', user);
  const second = f.api.restoreCatalogue(f.client, 'requirements', user);
  assert.equal(f.reads(), 1);
  f.client.setQueryData(key, []);
  f.resolve({ data: [{ id: 'old' }], complete: true, authorizationScope: scope });
  await Promise.all([first, second]);
  assert.deepEqual(f.client.getQueryData(key), []);
  f.client.clear();
});

test('logout or an account change rejects a pending saved restoration', async () => {
  for (const changedAccount of [false, true]) {
    const f = fixture();
    const restore = f.api.restoreCatalogue(f.client, 'uniforms', user);
    if (changedAccount) f.auth.currentUser.uid = 'other'; else f.revoke();
    f.resolve({ data: [{ id: 'private' }], complete: true, authorizationScope: scope });
    await restore;
    assert.equal(f.client.getQueryData(f.api.catalogueKey('uniforms', scope)), undefined);
    f.client.clear();
  }
});

test('refresh reads the server and a transient failure retains the displayed saved copy', async () => {
  const f = fixture(), key = f.api.catalogueKey('excludedDays', scope);
  f.client.setQueryData(key, [{ id: 'old' }]);
  let calls = 0;
  const options = f.api.catalogueQueryOptions(f.client, 'excludedDays', user, async () => { calls++; return [{ id: 'current' }]; });
  await f.client.fetchQuery({ ...options, staleTime: 0 });
  assert.equal(calls, 1);
  assert.deepEqual(f.client.getQueryData(key), [{ id: 'current' }]);
  await assert.rejects(f.client.fetchQuery({ ...options, staleTime: 0, retry: false,
    queryFn: f.api.catalogueQueryOptions(f.client, 'excludedDays', user, async () => { throw new Error('Unavailable'); }).queryFn }));
  assert.deepEqual(f.client.getQueryData(key), [{ id: 'current' }]);
  assert.equal(f.client.getQueryData(f.api.catalogueStateKey('excludedDays', scope)), 'saved');
  f.client.clear();
});

test('permission rejection removes the displayed and reusable persisted module copy', async () => {
  const f = fixture(), key = f.api.catalogueKey('uniforms', scope);
  f.client.setQueryData(key, [{ id: 'private' }]);
  const options = f.api.catalogueQueryOptions(f.client, 'uniforms', user, async () => {
    throw Object.assign(new Error('Denied'), { code: 'permission-denied' });
  });
  await assert.rejects(f.client.fetchQuery({ ...options, staleTime: 0 }));
  assert.equal((f.client.getQueryData(key) as unknown[]).length, 0);
  assert.equal(f.client.getQueryData(f.api.catalogueStateKey('uniforms', scope)), 'denied');
  assert.equal(f.writes.at(-1)?.at(-1), false);
  const restore = f.api.restoreCatalogue(f.client, 'uniforms', user);
  f.resolve({ data: [{ id: 'private' }], complete: true, authorizationScope: scope });
  await restore;
  assert.equal((f.client.getQueryData(key) as unknown[]).length, 0);
  f.client.clear();
});

test('a cancelled or changed-identity server response is never persisted', async () => {
  for (const cancelled of [false, true]) {
    const f = fixture(), controller = new AbortController();
    const options = f.api.catalogueQueryOptions(f.client, 'requirements', user, async () => {
      if (cancelled) controller.abort(); else f.auth.currentUser.uid = 'other';
      return [{ id: 'old account' }];
    });
    await assert.rejects(options.queryFn({ signal: controller.signal }), (error: any) => error.code === 'auth/workspace-identity');
    assert.equal(f.writes.length, 0);
    f.client.clear();
  }
});

test('filtered views follow catalogue applicability and preserve valid empty selections', () => {
  const common = { id: 'all', isActive: true, gender: 'all', classType: 'all', sectionType: 'all' } as any;
  const specific = { ...common, id: 'specific', gender: 'male', classType: 'specific', classIds: ['a'], sectionType: 'specific', section: 'Boarding' };
  assert.deepEqual(filterSchoolCatalogue([common, specific, { ...common, id: 'off', isActive: false }], { gender: 'male', classId: 'a', section: 'Boarding' }).map(item => item.id), ['all', 'specific']);
  assert.deepEqual(filterSchoolCatalogue([specific], { classId: 'b' }), []);
});
