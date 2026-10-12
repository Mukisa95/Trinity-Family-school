import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isWorkspaceCacheAccessValid, workspaceCacheAccessScope,
  hasSavedWorkspaceAccess, rememberVerifiedWorkspaceAccess, clearSavedWorkspaceAccess,
} from '../src/lib/startup/workspace-cache-access';
import { androidSnapshotRevision, isAndroidSavedDataQuery } from '../src/lib/offline/android-sync-policy';
import { createAndroidOfflineSession } from '../src/lib/offline/android-session-policy';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { clearPupilSessionQueries } from '../src/lib/cache/pupil-session-cache';

const user = { id: 'first', username: 'Example', role: 'Admin' as const, isActive: true, createdAt: '2026-01-01' };
const now = 100000;
const receipt = { version: 1, scope: workspaceCacheAccessScope(user), verifiedAt: now, expiresAt: now + 7 * 86400000 };

test('saved viewing is account, school-role, family and permission scoped', () => {
  assert.equal(isWorkspaceCacheAccessValid(receipt, user, now), true);
  for (const other of [
    { ...user, id: 'second' }, { ...user, role: 'Parent' as const },
    { ...user, familyId: 'new-family' }, { ...user, isActive: false },
    { ...user, modulePermissions: [{ module: 'pupils', permission: 'read' }] as any },
  ]) assert.equal(isWorkspaceCacheAccessValid(receipt, other, now), false);
});

test('expired, malformed and future-dated receipts never grant local viewing', () => {
  for (const invalid of [null, {}, { ...receipt, version: 2 }, { ...receipt, expiresAt: Infinity },
    { ...receipt, verifiedAt: now + 1 }, { ...receipt, expiresAt: now }, { ...receipt, expiresAt: receipt.expiresAt + 1 }]) {
    assert.equal(isWorkspaceCacheAccessValid(invalid, user, now), false);
  }
  assert.equal(isWorkspaceCacheAccessValid(receipt, user, receipt.expiresAt), false);
});

test('permission object ordering does not invalidate the same saved scope', () => {
  assert.equal(workspaceCacheAccessScope({ ...user, granularPermissions: [{ moduleId: 'pupils', pages: [] }] }),
    workspaceCacheAccessScope({ ...user, granularPermissions: [{ pages: [], moduleId: 'pupils' }] }));
});

test('a profile alone grants nothing; logout and account switch invalidate the receipt', () => {
  const values = new Map<string, string>();
  const original = (globalThis as any).window;
  (globalThis as any).window = { dispatchEvent: () => {}, localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } };
  try {
    values.set('trinity_user', JSON.stringify({ user }));
    assert.equal(hasSavedWorkspaceAccess(user), false);
    rememberVerifiedWorkspaceAccess({ ...user, passwordHash: 'never-persist' });
    assert.equal(hasSavedWorkspaceAccess(user), true);
    assert.equal([...values.values()].some(value => value.includes('never-persist')), false);
    values.set('trinity_user', JSON.stringify({ user: { ...user, id: 'second' } }));
    assert.equal(hasSavedWorkspaceAccess(user), false);
    values.set('trinity_user', JSON.stringify({ user }));
    clearSavedWorkspaceAccess();
    assert.equal(hasSavedWorkspaceAccess(user), false);
  } finally { (globalThis as any).window = original; }
});

test('Android copying ignores unrelated queries and parent data uses repository writes', () => {
  const session = createAndroidOfflineSession(user, []);
  assert.equal(isAndroidSavedDataQuery(['pupils', 'list'], session), true);
  for (const key of ['photos', 'notifications', 'fees', 'workspaceSetup', 'examResults']) {
    assert.equal(isAndroidSavedDataQuery([key], session), false);
  }
  assert.equal(isAndroidSavedDataQuery(['pupils'], createAndroidOfflineSession({ ...user, role: 'Parent' }, ['child'])), false);
});

test('native comparison detects saved source changes without walking every pupil field', () => {
  const snapshot: any = { datasets: { pupils: { preparedAt: 'a', revision: 1, data: [{ id: 'one' }] } } };
  const before = androidSnapshotRevision(snapshot);
  snapshot.datasets.pupils.preparedAt = 'b';
  assert.notEqual(androidSnapshotRevision(snapshot), before);
  const stable = androidSnapshotRevision(snapshot);
  snapshot.capturedAt = 'later';
  assert.equal(androidSnapshotRevision(snapshot), stable);
});

test('mounted hydration observers survive account scrubbing and observe the new empty server snapshot', () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  client.setQueryData(['pupils', 'list'], [{ id: 'old' }]);
  client.setQueryData(['pupils', 'hydration'], 'saved');
  const observer = new QueryObserver(client, { queryKey: ['pupils', 'hydration'], enabled: false });
  const states: unknown[] = [];
  const stop = observer.subscribe(result => states.push(result.data));
  clearPupilSessionQueries(client);
  assert.equal(client.getQueryData(['pupils', 'hydration']), 'loading');
  assert.deepEqual(client.getQueryData(['pupils', 'list']), []);
  client.setQueryData(['pupils', 'hydration'], 'live');
  assert.equal(observer.getCurrentResult().data, 'live');
  assert.ok(states.includes('loading'));
  stop(); client.clear();
});
