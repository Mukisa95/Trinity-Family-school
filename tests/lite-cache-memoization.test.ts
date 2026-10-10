import assert from 'node:assert/strict';
import { test } from 'node:test';
import { liteWrite, liteReadMemoized, liteInvalidate, liteClearAll } from '../src/lib/cache/lite-cache';

test('memoized snapshots reuse parsing while honoring writes, other tabs, expiry, scope and logout', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'window', { value: { localStorage: storage }, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  try {
    liteWrite('account-a', { revision: 1, rows: ['a'] });
    const initial = liteReadMemoized('account-a');
    assert.equal(liteReadMemoized('account-a'), initial);
    assert.equal(liteReadMemoized('account-b'), null);
    liteWrite('account-a', { revision: 2, rows: ['b'] });
    assert.deepEqual(liteReadMemoized('account-a'), { revision: 2, rows: ['b'] });
    storage.setItem('trinity_lite_account-a', JSON.stringify({ version: 4, writtenAt: Date.now(), ttlMs: 10_000, data: ['cross-tab'] }));
    assert.deepEqual(liteReadMemoized('account-a'), ['cross-tab']);
    liteInvalidate('account-a');
    assert.equal(liteReadMemoized('account-a'), null);
    storage.setItem('trinity_lite_account-a', JSON.stringify({ version: 4, writtenAt: 0, ttlMs: 1, data: ['expired'] }));
    assert.equal(liteReadMemoized('account-a'), null);
    liteWrite('account-a', ['restored']);
    const restored = liteReadMemoized('account-a');
    liteClearAll();
    // Simulate a broader logout clearing storage, as the real owner also does.
    values.clear();
    assert.equal(liteReadMemoized('account-a'), null);
    liteWrite('account-a', ['restored']);
    assert.notEqual(liteReadMemoized('account-a'), restored);
    Object.defineProperty(globalThis, 'window', { value: { get localStorage() { throw new Error('Storage blocked'); } }, configurable: true });
    assert.equal(liteReadMemoized('account-a'), null, 'Unavailable persistence cannot block live data');
    assert.doesNotThrow(() => liteWrite('account-a', ['live data']));
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage); else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
