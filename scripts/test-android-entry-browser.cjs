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
        ? 'const router={push:url=>{window.routes.push(url);if(window.updateHistory)history.pushState(history.state,"",url)}};export const useRouter=()=>router;'
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

    // Native emits full URLs. Read its real shortcut paths instead of assuming
    // that the bridge sends the relative paths used by the router above.
    const nativeSource = fs.readFileSync('android-app/app/src/main/java/ug/trinityfamilyschool/photo/AppShortcuts.java', 'utf8');
    const nativePaths = Object.fromEntries([...nativeSource.matchAll(/case "([^"]+)": return PhotoPolicy\.ORIGIN \+ "([^"]+)";/g)].map(match => [match[1], match[2]]));
    assert.deepEqual(nativePaths, { search: '/?openSearch=1', timetable: '/timetable', events: '/events', pupils: '/pupils', exams: '/exams' });
    const origins = JSON.parse(fs.readFileSync('src/lib/android/app-releases.json', 'utf8')).map(school => school.websiteOrigin);
    for (const origin of origins) {
      const nativePage = await browser.newPage();
      const nativeErrors = [];
      nativePage.on('pageerror', error => nativeErrors.push(error.message));
      await nativePage.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) return route.abort();
        return route.fulfill({ status: 200, contentType: url.pathname === '/fixture.js' ? 'text/javascript' : 'text/html',
          body: url.pathname === '/fixture.js' ? bundle.outputFiles[0].text : '<div id="app"></div><script src="/fixture.js"></script>' });
      });
      await nativePage.addInitScript(() => {
        window.routes = []; window.warnings = []; window.messages = []; window.offline = false; window.updateHistory = true;
        window.documentMarker = crypto.randomUUID(); window.searchOpened = 0;
        window.addEventListener('trinity-open-dashboard-search', () => window.searchOpened++);
        window.TrinityOffline = { postMessage(raw) { const message = JSON.parse(raw); window.messages.push(message);
          queueMicrotask(() => window.TrinityOffline.onmessage?.({ data: JSON.stringify({ id: message.id, success: true }) })); } };
      });
      await nativePage.goto(origin + '/classes');
      await nativePage.waitForFunction(() => window.messages.some(message => message.action === 'navigationReady'));
      const nativeMarker = await nativePage.evaluate(() => window.documentMarker);
      for (const [shortcut, path] of Object.entries(nativePaths)) {
        const result = await nativePage.evaluate(({ origin, path }) => {
          history.replaceState(history.state, '', '/classes');
          const requestId = crypto.randomUUID();
          window.dispatchEvent(new CustomEvent('trinity-android-navigate', { detail: { requestId, url: origin + path } }));
          const destination = location.pathname + location.search;
          const acknowledged = window.messages.some(message => message.action === 'navigationHandled' && message.requestId === requestId);
          // A late duplicate must not undo a subsequent user navigation.
          history.replaceState(history.state, '', '/staff');
          window.dispatchEvent(new CustomEvent('trinity-android-navigate', { detail: { requestId, url: origin + path } }));
          return { destination, acknowledged, afterDuplicate: location.pathname };
        }, { origin, path });
        assert.equal(result.destination, path, origin + ': native ' + shortcut + ' opens its destination');
        assert.equal(result.acknowledged, true);
        assert.equal(result.afterDuplicate, '/staff');
      }
      await nativePage.evaluate(origin => {
        history.replaceState(history.state, '', '/');
        window.dispatchEvent(new CustomEvent('trinity-android-navigate', { detail: { requestId: crypto.randomUUID(), url: origin + '/?openSearch=1' } }));
      }, origin);
      assert.equal(await nativePage.evaluate(() => window.searchOpened), 1);
      const rejected = [origins.find(value => value !== origin) + '/pupils', 'https://external.test/events', origin.replace('https:', 'http:') + '/timetable', origin + '/api/payments/create', origin + '/login', origin + '/_next/static/file.js', origin.replace('https://', 'https://user:password@') + '/events'];
      const rejectedResult = await nativePage.evaluate(urls => {
        const before = window.routes.length, acknowledgements = window.messages.filter(message => message.action === 'navigationHandled').length;
        for (const url of urls) window.dispatchEvent(new CustomEvent('trinity-android-navigate', { detail: { requestId: crypto.randomUUID(), url } }));
        return { changed: window.routes.length !== before, acknowledged: window.messages.filter(message => message.action === 'navigationHandled').length !== acknowledgements };
      }, rejected);
      assert.deepEqual(rejectedResult, { changed: false, acknowledged: false });
      await nativePage.evaluate(origin => {
        window.offline = true;
        window.dispatchEvent(new CustomEvent('trinity-android-navigate', { detail: { requestId: crypto.randomUUID(), url: origin + '/exams' } }));
        window.dispatchEvent(new CustomEvent('trinity-android-navigate', { detail: { requestId: crypto.randomUUID(), url: origin + '/events' } }));
      }, origin);
      assert.equal(await nativePage.evaluate(() => window.warnings.length), 1);
      assert.equal(await nativePage.evaluate(() => location.pathname), '/events');
      assert.equal(await nativePage.evaluate(() => window.documentMarker), nativeMarker);
      assert.deepEqual(nativeErrors, []);
      await nativePage.close();
      console.log('PASS native absolute shortcut URLs for all five actions: ' + origin);
    }
    console.log('ANDROID_ENTRY_BROWSER_OK: readiness, acknowledgement, duplicate suppression, route validation, offline handling, search and legacy shortcuts preserve the document.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
