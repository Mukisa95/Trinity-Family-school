import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appDownloadPageUrl, detectAppPlatform } from '../src/lib/app-platform';
import { readAndroidNotificationState } from '../src/lib/offline/android-notifications';

test('a desktop browser stays desktop independently of its window size', () => {
  assert.deepEqual(detectAppPlatform({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }), { nativeAndroid: false, installed: false, mobile: false, os: 'desktop' });
});
test('Android browsers and native apps remain distinct, including desktop-mode Android', () => {
  assert.deepEqual(detectAppPlatform({ userAgent: 'Mozilla/5.0 (Linux; Android 15) Mobile' }), { nativeAndroid: false, installed: false, mobile: true, os: 'android' });
  assert.deepEqual(detectAppPlatform({ userAgent: 'Desktop mode', nativeAndroid: true }), { nativeAndroid: true, installed: true, mobile: true, os: 'android' });
});
test('iPhone, iPad desktop mode and installed web apps are recognised', () => {
  assert.equal(detectAppPlatform({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS)' }).os, 'ios');
  assert.equal(detectAppPlatform({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5 }).mobile, true);
  assert.equal(detectAppPlatform({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 0 }).mobile, false);
  assert.equal(detectAppPlatform({ userAgent: 'Mozilla/5.0 (iPhone)', standalone: true }).installed, true);
  assert.equal(detectAppPlatform({ userAgent: 'Desktop', standalone: true }).installed, true);
});
test('sharing targets the current school public download page without account data or deep-link parameters', () => {
  assert.equal(appDownloadPageUrl('https://school.example/parent/settings?token=private#section'), 'https://school.example/download');
  assert.equal(appDownloadPageUrl('https://another-school.example'), 'https://another-school.example/download');
  assert.throws(() => appDownloadPageUrl('javascript:alert(1)'));
});
test('installed Android version comes from the device rather than the available release manifest', async () => {
  const previous = globalThis.window;
  const bridge = { onmessage: undefined as ((event: { data: string }) => void) | undefined, postMessage(raw: string) {
    const request = JSON.parse(raw);
    queueMicrotask(() => bridge.onmessage?.({ data: JSON.stringify({ id: request.id, success: true, appVersion: '1.2', appBuild: 3 }) }));
  } };
  globalThis.window = { TrinityOffline: bridge } as unknown as Window & typeof globalThis;
  try { const state = await readAndroidNotificationState(); assert.equal(state.appVersion, '1.2'); assert.equal(state.appBuild, 3); }
  finally { if (previous) globalThis.window = previous; else delete (globalThis as any).window; }
});
