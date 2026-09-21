import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isParentAppShellReady } from '../src/lib/parent-offline/app-shell';

test('offline shell is ready only when the launch route, both parent pages, and their assets are cached', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
  const originalCaches = Object.getOwnPropertyDescriptor(globalThis, 'caches');
  const entries = new Map<string, Response>();
  const html = '<script src="/_next/static/chunks/parent.js"></script>';
  entries.set('https://school.example/', new Response(html));
  entries.set('https://school.example/parent', new Response(html));
  entries.set('https://school.example/parent/settings', new Response(html));
  const cache = { match: async (request: string | Request) => entries.get(typeof request === 'string' ? request : request.url) };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { caches: {} } });
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { origin: 'https://school.example' } });
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: { keys: async () => ['parent-app-shell-v1'], open: async () => cache } });
  try {
    assert.equal(await isParentAppShellReady(), false, 'missing JavaScript must never show Ready');
    entries.set('https://school.example/_next/static/chunks/parent.js', new Response('ok'));
    assert.equal(await isParentAppShellReady(), true);
    entries.delete('https://school.example/parent/settings');
    assert.equal(await isParentAppShellReady(), false, 'both parent pages must be present');
    entries.set('https://school.example/parent/settings', new Response(html));
    entries.delete('https://school.example/');
    assert.equal(await isParentAppShellReady(), false, 'the existing installed-app launch route must be present');
  } finally {
    for (const [key, descriptor] of [['window', originalWindow], ['location', originalLocation], ['caches', originalCaches]] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
