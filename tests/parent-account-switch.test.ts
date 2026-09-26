import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { clearPupilSessionQueries, isParentPupilSnapshotOwnedByAccount } from '../src/lib/cache/pupil-session-cache';
import { planParentAccountScopeRepair } from '../src/lib/parent-account-scope-repair';

test('switching parent accounts removes the previous family and private payments', () => {
  const client = new QueryClient();
  const activePupilView = new QueryObserver(client, {
    queryKey: ['pupils', 'list'],
    queryFn: async () => [],
    enabled: false,
  });
  const unsubscribe = activePupilView.subscribe(() => undefined);
  const activePaymentView = new QueryObserver(client, {
    queryKey: ['payments', 'pupil', 'first-parent-child'],
    queryFn: async () => [],
    enabled: false,
  });
  const unsubscribePayments = activePaymentView.subscribe(() => undefined);
  const activeDetailView = new QueryObserver(client, {
    queryKey: ['pupils', 'detail', 'first-parent-child'],
    queryFn: async () => null,
    enabled: false,
  });
  const unsubscribeDetail = activeDetailView.subscribe(() => undefined);
  client.setQueryData(['pupils', 'list'], [{ id: 'first-parent-child' }]);
  client.setQueryData(['pupils', 'detail', 'first-parent-child'], { id: 'first-parent-child' });
  client.setQueryData(['payments', 'pupil', 'first-parent-child'], [{ id: 'first-payment' }]);
  client.setQueryData(['classes'], [{ id: 'shared-school-class' }]);

  clearPupilSessionQueries(client);

  assert.deepEqual(client.getQueryData(['pupils', 'list']), []);
  assert.deepEqual(activePupilView.getCurrentResult().data, []);
  assert.equal(client.getQueryData(['pupils', 'detail', 'first-parent-child']), undefined);
  assert.equal(activeDetailView.getCurrentResult().data, null);
  assert.equal(client.getQueryData(['payments', 'pupil', 'first-parent-child']), undefined);
  assert.deepEqual(activePaymentView.getCurrentResult().data, []);
  assert.deepEqual(client.getQueryData(['classes']), [{ id: 'shared-school-class' }]);

  client.setQueryData(['pupils', 'list'], [{ id: 'second-parent-child' }]);
  assert.deepEqual(client.getQueryData(['pupils', 'list']), [{ id: 'second-parent-child' }]);
  assert.deepEqual(activePupilView.getCurrentResult().data, [{ id: 'second-parent-child' }]);
  unsubscribe();
  unsubscribePayments();
  unsubscribeDetail();
});

test('legacy family members and standalone pupils can be linked to their existing parent', () => {
  assert.deepEqual(planParentAccountScopeRepair('parent-b', [
    { id: 'child-b1' },
    { id: 'child-b2', parentAccountId: 'retired-parent', parentAccountActive: false },
  ], false), ['child-b1', 'child-b2']);
  assert.deepEqual(planParentAccountScopeRepair('parent-b', [
    { id: 'standalone-b', parentAccountId: 'parent-b', parentAccountActive: true },
  ], false), []);
});

test('recovery refuses another active parent or an owned pupil', () => {
  assert.throws(() => planParentAccountScopeRepair('parent-b', [{ id: 'child-b' }], true), /ACCOUNT_SCOPE_CONFLICT/);
  assert.throws(() => planParentAccountScopeRepair('parent-b', [
    { id: 'child-b', parentAccountId: 'parent-a', parentAccountActive: true },
  ], false), /ACCOUNT_SCOPE_CONFLICT/);
});

test('a poisoned or pre-link offline snapshot cannot hydrate another parent', () => {
  assert.equal(isParentPupilSnapshotOwnedByAccount('parent-b', [
    { id: 'child-a', parentAccountId: 'parent-a', parentAccountActive: true } as any,
  ]), false);
  assert.equal(isParentPupilSnapshotOwnedByAccount('parent-b', [
    { id: 'child-b' } as any,
  ]), false);
  assert.equal(isParentPupilSnapshotOwnedByAccount('parent-b', [
    { id: 'child-b', parentAccountId: 'parent-b', parentAccountActive: true } as any,
  ]), true);
});

test('the exceptional repair endpoint derives its account from verified auth', () => {
  const route = readFileSync('src/app/api/pupils/parent-scope-repair/route.ts', 'utf8');
  assert.match(route, /const actor = await requireAppUser\(request\)/);
  assert.match(route, /actor\.user\.role !== 'Parent'/);
  assert.match(route, /planParentAccountScopeRepair\(\s*actor\.user\.id/);
  assert.doesNotMatch(route, /await request\.json\(\)/);
});
