import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificationDeadline, verificationRetryDelay } from '../src/lib/auth/startup-verification';
import { assertLiveWorkspace, setSavedWorkspaceView } from '../src/lib/auth/saved-view';

test('stalled verification has a bounded retryable failure and late completion cannot change its result', async () => {
  let complete!: (value: string) => void;
  const pending = new Promise<string>(resolve => { complete = resolve; });
  const result = verificationDeadline(pending, 15);
  await assert.rejects(result, { code: 'auth/timeout' });
  complete('late');
  await assert.rejects(result, { code: 'auth/timeout' });
  assert.equal(await verificationDeadline(Promise.resolve('verified')), 'verified');
});
test('verification retry backs off and caps at one minute', () => {
  assert.deepEqual([0, 1, 2, 3, 20].map(verificationRetryDelay), [5000, 15000, 60000, 60000, 60000]);
});
test('saved viewing blocks writes until verification restores live access', () => {
  setSavedWorkspaceView(true);
  try { assert.throws(assertLiveWorkspace, { code: 'app/verification-pending' }); }
  finally { setSavedWorkspaceView(false); }
  assert.doesNotThrow(assertLiveWorkspace);
});

test('direct API mutations are blocked but authentication and read-only requests still work', async () => {
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const priorLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
  const calls: string[] = [];
  const browser: { fetch: typeof fetch } = { fetch: async input => { calls.push(String(input)); return new Response('ok'); } };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { origin: 'https://school.test' } });
  try {
    setSavedWorkspaceView(true);
    await assert.rejects(browser.fetch('/api/payments/create', { method: 'POST' }), { code: 'app/verification-pending' });
    assert.equal(calls.length, 0);
    await browser.fetch('/api/auth/session');
    await browser.fetch('/api/access/circumference', { method: 'POST' });
    setSavedWorkspaceView(false);
    await browser.fetch('/api/payments/create', { method: 'POST' });
    assert.equal(calls.length, 3);
  } finally {
    setSavedWorkspaceView(false);
    if (priorWindow) Object.defineProperty(globalThis, 'window', priorWindow); else delete (globalThis as any).window;
    if (priorLocation) Object.defineProperty(globalThis, 'location', priorLocation); else delete (globalThis as any).location;
  }
});
