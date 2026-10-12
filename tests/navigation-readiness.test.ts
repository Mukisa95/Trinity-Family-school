import test from 'node:test';
import assert from 'node:assert/strict';
import { isNavigationPending, setNavigationPending, setRouteContentPending, subscribeNavigationWork } from '../src/lib/navigation/navigation-work';
import { claimAutomaticRouteRecovery, internalNavigationHref } from '../src/lib/navigation/route-recovery';

test('a URL commit cannot release Android preparation while route content still loads', () => {
  const first = {}, second = {}, events: boolean[] = [];
  const unsubscribe = subscribeNavigationWork(value => events.push(value));
  try {
    setNavigationPending(true); setRouteContentPending(first, true);
    setNavigationPending(false); assert.equal(isNavigationPending(), true);
    setRouteContentPending(second, true); setRouteContentPending(first, false);
    assert.equal(isNavigationPending(), true);
    setRouteContentPending(second, false); assert.equal(isNavigationPending(), false);
    assert.deepEqual(events, [true, false]);
  } finally { setNavigationPending(false); setRouteContentPending(first, false); setRouteContentPending(second, false); unsubscribe(); }
});

test('route recovery stays same-origin and preserves the intended query', () => {
  const base = 'https://school.example/';
  assert.equal(internalNavigationHref('/pupils?class=P1', base), '/pupils?class=P1');
  assert.equal(internalNavigationHref('https://school.example/pupils', base), '/pupils');
  assert.equal(internalNavigationHref('//another.example/pupils', base), null);
  assert.equal(internalNavigationHref('javascript:alert(1)', base), null);
});

test('automatic recovery is bounded across reloads and disabled when storage is unavailable', () => {
  let value: string | null = null;
  const storage = { getItem: () => value, setItem: (_: string, next: string) => { value = next; } };
  assert.equal(claimAutomaticRouteRecovery(storage, '/pupils', 1000), true);
  assert.equal(claimAutomaticRouteRecovery(storage, '/pupils', 21_000), false);
  assert.equal(claimAutomaticRouteRecovery(storage, '/pupils', 121_000), true);
  assert.equal(claimAutomaticRouteRecovery({ getItem: () => { throw new Error('Unavailable'); }, setItem: () => {} }, '/pupils'), false);
});
