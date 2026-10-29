// Real native entry router and bridge, with a synthetic Next router only.
const fs = require('node:fs'), http = require('node:http'), path = require('node:path'), assert = require('node:assert/strict');
const esbuild = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
async function run() {
  const bundle = await esbuild.build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {AndroidShortcutNavigator} from './src/components/common/android-shortcut-navigator';
    createRoot(document.getElementById('app')).render(<AndroidShortcutNavigator/>);` },
    bundle: true, write: false, jsx: 'automatic', alias: { '@': path.resolve('src') },
    define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'router-boundaries', setup(build) {
      build.onResolve({ filter: /^(next\/navigation|@\/hooks\/use-toast|@\/lib\/offline\/android-app-shell)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', contents: args.path === 'next/navigation'
        ? 'const router={push:url=>window.routes.push(url)};export const useRouter=()=>router;'
        : args.path.includes('use-toast') ? 'export const toast=value=>window.warnings.push(value);'
        : 'export const isAndroidOffline=()=>window.offline;export const isAndroidOfflineRoute=p=>["/","/pupils","/events","/timetable"].includes(p);' }));
    } }] });
  const server = http.createServer((request, response) => {
    if (request.url === '/fixture.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(bundle.outputFiles[0].text); }
    else response.end('<div id="app"></div><script src="/fixture.js"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.routes = []; window.warnings = []; window.messages = []; window.offline = false;
      window.documentMarker = crypto.randomUUID();
      window.TrinityOffline = { postMessage(raw) { const message = JSON.parse(raw); window.messages.push(message);
        queueMicrotask(() => window.TrinityOffline.onmessage?.({ data: JSON.stringify({ id: message.id, success: true }) })); } };
    });
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForFunction(() => window.messages.some(message => message.action === 'navigationReady'));
    const marker = await page.evaluate(() => window.documentMarker);
    await page.evaluate(() => {
      const id = crypto.randomUUID(); window.request = id;
      for (let repeat = 0; repeat < 3; repeat++) window.dispatchEvent(new CustomEvent('trinity-android-navigate', { detail: { requestId: id, url: '/events' } }));
    });
    await page.waitForFunction(() => window.messages.filter(message => message.action === 'navigationHandled').length === 3);
    assert.deepEqual(await page.evaluate(() => window.routes), ['/events']);
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('trinity-android-navigate', { detail: { requestId: crypto.randomUUID(), url: 'https://external.test/' } }));
      window.offline = true;
      window.dispatchEvent(new CustomEvent('trinity-android-navigate', { detail: { requestId: crypto.randomUUID(), url: '/exams' } }));
      window.dispatchEvent(new CustomEvent('trinity-android-navigate', { detail: { requestId: crypto.randomUUID(), url: '/pupils' } }));
    });
    assert.deepEqual(await page.evaluate(() => window.routes), ['/events', '/pupils']);
    assert.equal(await page.evaluate(() => window.warnings.length), 1);
    await page.evaluate(() => { window.offline = false; window.dispatchEvent(new CustomEvent('trinity-android-shortcut', { detail: 'timetable' })); });
    assert.deepEqual(await page.evaluate(() => window.routes), ['/events', '/pupils', '/timetable']);
    await page.evaluate(() => { window.searchOpened = 0; window.addEventListener('trinity-open-dashboard-search', () => window.searchOpened++);
      window.dispatchEvent(new CustomEvent('trinity-android-navigate', { detail: { requestId: crypto.randomUUID(), url: '/?openSearch=1' } })); });
    assert.equal(await page.evaluate(() => window.searchOpened), 1);
    assert.equal(await page.evaluate(() => window.documentMarker), marker);
    assert.deepEqual(errors, []);
    console.log('ANDROID_ENTRY_BROWSER_OK: readiness, acknowledgement, duplicate suppression, route validation, offline handling, search and legacy shortcuts preserve the document.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
