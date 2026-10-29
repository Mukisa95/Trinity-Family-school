const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function worker({ saved = true, build = 'current', routeBuild = build, brokenAsset = false } = {}) {
  const listeners = {}, puts = [];
  const store = new Map(saved ? [['https://school.test/', new Response('saved interface')]] : []);
  const html = `<script self="test">self.__next_f.push(${JSON.stringify([1, `0:{"b":"${build}"}\n`])})</script><script src="/_next/static/app.js"></script>`;
  let networkCalls = 0, release;
  const scope = { URL, Request, Response, Headers, TextDecoder, TextEncoder, console: { log() {}, warn() {}, error() {} },
    self: { location: { origin: 'https://school.test' }, navigator: { onLine: true }, addEventListener: (name, callback) => listeners[name] = callback },
    caches: { keys: async () => ['android-app-shell-fixture'], open: async () => ({
      match: async request => store.get(typeof request === 'string' ? request : request.url)?.clone(),
      put: async (request, response) => { const key = typeof request === 'string' ? request : request.url; puts.push(key); store.set(key, response.clone()); },
    }) },
    fetch: async (request) => {
      networkCalls++;
      if (typeof request === 'object' && request.headers?.get('RSC')) return new Response(`0:{"b":"${routeBuild}"}\n`, { headers: { 'Content-Type': 'text/x-component' } });
      const url = typeof request === 'string' ? request : request.url;
      if (url.includes('/_next/static/')) return new Response('asset', { status: brokenAsset ? 503 : 200 });
      if (scope.hang) return new Promise(resolve => release = resolve);
      return new Response(html, { headers: { 'Content-Type': 'text/html' } });
    },
  };
  vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), scope);
  return { scope, store, puts, calls: () => networkCalls, release: value => release(value),
    navigate() { let response; listeners.fetch({ request: { url: 'https://school.test/', method: 'GET', mode: 'navigate', headers: new Headers() }, respondWith: value => response = value }); return response; },
    prepare() { let work, message; listeners.message({ data: { type: 'CACHE_ANDROID_APP_SHELL', routes: ['/'], navigation: true }, ports: [{ postMessage: value => message = value }], waitUntil: value => work = value }); return work.then(() => message); },
  };
}

test('a prepared dashboard opens online without waiting for a hanging network', async () => {
  const w = worker(); w.scope.hang = true;
  assert.equal(await (await w.navigate()).text(), 'saved interface');
  assert.equal(w.calls(), 0);
});
test('first visit without a saved interface still obtains the current website', async () => {
  const w = worker({ saved: false });
  assert.match(await (await w.navigate()).text(), /current/);
  assert.equal(w.calls(), 1);
});
test('shell refresh publishes only after matching route and all referenced assets are prepared', async () => {
  const w = worker();
  assert.equal((await w.prepare()).type, 'ANDROID_APP_SHELL_CACHED');
  assert.ok(w.puts.indexOf('https://school.test/_next/static/app.js') < w.puts.indexOf('https://school.test/'));
  assert.ok(w.puts.some(key => key.includes('__trinity_saved_route/current/')));
  assert.match(await (await w.navigate()).text(), /current/);
});
test('an interrupted deployment preserves the last complete shell', async () => {
  for (const options of [{ routeBuild: 'changed' }, { brokenAsset: true }]) {
    const w = worker(options);
    assert.equal((await w.prepare()).type, 'ANDROID_APP_SHELL_CACHE_FAILED');
    assert.equal(await (await w.navigate()).text(), 'saved interface');
    assert.ok(!w.puts.includes('https://school.test/'));
  }
});
