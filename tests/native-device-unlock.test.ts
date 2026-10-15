import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import { randomUUID } from 'node:crypto';

function service(options: { cancelled?: boolean; differentAccount?: boolean; native?: boolean; browser?: boolean; serverRejects?: boolean; changedAccount?: boolean } = {}) {
  const values = new Map<string, string>();
  const calls: string[] = [];
  const auth = { currentUser: { uid: 'account-a' }, authStateReady: async () => {} } as any;
  auth.currentUser.getIdToken = async () => 'mock-id-token';
  const module = { exports: {} as any };
  const window = { isSecureContext: true, dispatchEvent: () => {} };
  runInNewContext(transformSync(readFileSync('src/lib/services/passkey.service.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code, {
    module, exports: module.exports, window, Event, crypto: { randomUUID },
    localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) },
    fetch: async (_url: string, request: any) => {
      calls.push('server:' + JSON.parse(request.body).action);
      return { ok: !options.serverRejects, json: async () => options.serverRejects ? { error: 'Current password is incorrect.' } : { userId: options.differentAccount ? 'account-b' : 'account-a' } };
    },
    require: (name: string) => {
      if (name === '@/lib/firebase') return { auth };
      if (name === './secure-auth.service') return {};
      if (name === '@simplewebauthn/browser') return { browserSupportsPasskeys: async () => Boolean(options.browser), platformAuthenticatorIsAvailable: async () => Boolean(options.browser) };
      if (name === '@/lib/android/device-unlock') return {
        hasNativeDeviceUnlock: () => options.native !== false,
        nativeDeviceUnlockAvailable: async () => true,
        authenticateNativeDevice: async (id: string) => { calls.push('native:' + id); if (options.cancelled) throw new Error('Cancelled'); if (options.changedAccount) auth.currentUser.uid = 'account-b'; return true; },
      };
      throw new Error(name);
    },
  });
  return { value: module.exports.PasskeyService, calls, values };
}

test('Android privacy setup works without browser passkeys and preserves an account-scoped preference', async () => {
  const subject = service();
  assert.equal(await subject.value.supported(), false);
  assert.equal(await subject.value.localSupported(), true);
  await subject.value.enableNativeUnlock('current-password');
  assert.deepEqual(subject.calls, ['server:verify-local', 'native:account-a']);
  assert.equal(subject.value.hasLocalUnlock('account-a'), true);
  assert.equal(subject.value.hasLocalUnlock('account-b'), false);
  subject.calls.length = 0;
  assert.equal(await subject.value.unlockLocalSession('account-a'), true);
  assert.deepEqual(subject.calls, ['native:account-a'], 'unlock must make no server request');
  subject.value.disableNativeUnlock('account-a');
  assert.equal(subject.value.hasLocalUnlock('account-a'), false);
  await assert.rejects(subject.value.unlockLocalSession('account-a'), /Enable device unlock/);
});

test('incorrect password, cancellation and account changes never enable or unlock another account', async () => {
  for (const options of [{ cancelled: true }, { differentAccount: true }, { serverRejects: true }, { changedAccount: true }]) {
    const subject = service(options);
    await assert.rejects(subject.value.enableNativeUnlock('password'));
    assert.equal(subject.value.hasNativeUnlock('account-a'), false);
  }
  const cancelled = service({ cancelled: true });
  cancelled.values.set('trinity_native_unlock:account-a', 'enabled');
  await assert.rejects(cancelled.value.unlockLocalSession('account-a'), /Cancelled/);
  assert.deepEqual(cancelled.calls, ['native:account-a']);
  const changed = service({ changedAccount: true });
  changed.values.set('trinity_native_unlock:account-a', 'enabled');
  await assert.rejects(changed.value.unlockLocalSession('account-a'), /account changed/);
});

test('web users keep the existing passkey capability behavior', async () => {
  assert.equal(await service({ native: false, browser: true }).value.localSupported(), true);
  assert.equal(await service({ native: false, browser: false }).value.localSupported(), false);
});

test('native transport ignores unrelated messages and rejects cancellation or the wrong session', async () => {
  let mode = 'success';
  const bridge: any = { postMessage: (text: string) => {
    const request = JSON.parse(text);
    queueMicrotask(() => {
      bridge.onmessage({ data: JSON.stringify({ id: randomUUID(), ok: true, userId: 'account-a' }) });
      bridge.onmessage({ data: JSON.stringify({ id: request.id, ok: mode !== 'cancel', supported: true, userId: mode === 'wrong' ? 'account-b' : request.userId, error: 'Cancelled' }) });
    });
  } };
  const module = { exports: {} as any };
  runInNewContext(transformSync(readFileSync('src/lib/android/device-unlock.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code, {
    module, exports: module.exports, window: { TrinityDeviceUnlock: bridge }, crypto: { randomUUID }, setTimeout, clearTimeout,
  });
  assert.equal(await module.exports.nativeDeviceUnlockAvailable(), true);
  assert.equal(await module.exports.authenticateNativeDevice('account-a'), true);
  mode = 'cancel'; await assert.rejects(module.exports.authenticateNativeDevice('account-a'), /Cancelled/);
  mode = 'wrong'; await assert.rejects(module.exports.authenticateNativeDevice('account-a'), /current session/);
});
