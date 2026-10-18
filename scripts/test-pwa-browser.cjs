/* Actual installed-app components and IndexedDB, with synthetic school records.
 * No production Firebase/hosting access and no notification delivery to users. */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const esbuild = require('esbuild'), ts = require('typescript');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'output/pwa-browser');
const publicKey = 'BMOU7Zc7H4Kx4pgm8KBjrIxPBZcYxFYoz5kxVOmHHI4Up5mNxnXGpbc91fBEZcndzU0E9Zk7AFUAelNuD6RXnWY';
function session(accountId = 'fixture', fields = {}) { const issuedAt = Date.now(); return { schema: 1, accountId, role: 'Admin', displayName: 'Synthetic account', timeZone: 'Africa/Kampala', issuedAt: new Date(issuedAt).toISOString(), expiresAt: new Date(issuedAt + 7 * 86400_000).toISOString(), pupilIds: [], grants: { dashboard: true, pupils: true, timetable: true, events: true, pupilFields: ['id', 'firstName'], dashboardCounts: ['pupils'] }, ...fields }; }
function snapshot(accountId = 'fixture') {
  const now = new Date(), year = now.getFullYear(), preparedAt = now.toISOString();
  const tomorrow = new Date(now.getTime() + 86400_000).toISOString().slice(0, 10);
  const periods = Array.from({ length: 7 }, (_, index) => ({ id: `p${index}`, dayOfWeek: index + 1, periodNumber: 1, startTime: '09:00', endTime: '10:00', type: 'lesson' }));
  const entries = periods.flatMap(period => ['p4', 'p5'].map(classId => ({ id: classId + period.id, classId, subjectId: 'math', teacherId: 'private-teacher', periodId: period.id })));
  const saved = data => ({ preparedAt, data });
  return { schema: 1, accountId, role: 'Admin', capturedAt: preparedAt, datasets: {
    pupils: saved([{ id: 'child', firstName: 'Synthetic' }]), dashboard: saved({ pupils: 1 }),
    classes: saved([{ id: 'p4', code: 'P4' }, { id: 'p5', code: 'P5' }]), subjects: saved([{ id: 'math', code: 'MTC', name: 'Mathematics' }]),
    academicYears: saved([{ id: 'year', isActive: true, terms: [{ id: 'term', isCurrent: true, startDate: `${year}-01-01`, endDate: `${year}-12-31` }] }]),
    timetables: saved([{ complete: true, profile: { id: 'table', name: 'School day', academicYearId: 'year', termId: 'term', classIds: ['p4', 'p5'] }, periods, entries }]),
    events: saved([{ id: 'tomorrow', title: 'School celebration', status: 'Scheduled', startDate: tomorrow, endDate: tomorrow, isAllDay: true }]),
  } };
}
const mocks = {
  'next/navigation': `const router={push:()=>{}}; export const useRouter=()=>router;export const usePathname=()=>'/';`,
  'next/link': `import React from'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}`,
  'next/dist/client/app-build-id': `export const getAppBuildId=()=> 'fixture-build';`,
  '@/lib/contexts/auth-context': `import{useSyncExternalStore}from'react';const listeners=new Set();window.fixtureAuth={user:null,isLoading:false,isLocked:false};window.setFixtureAuth=value=>{window.fixtureAuth={...window.fixtureAuth,...value};listeners.forEach(fn=>fn())};export const useAuth=()=>useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn)},()=>window.fixtureAuth);`,
  '@/lib/firebase': `export const auth={get currentUser(){const user=window.fixtureAuth.user;return user?{uid:user.id,isAnonymous:false,getIdToken:async()=> 'signed:'+user.id}:null},onIdTokenChanged(){return()=>{}}};`,
  '@/lib/offline/android-cache-export': `export const exportAndroidCachedSnapshot=async()=>window.fixturePauseSnapshots?null:window.fixtureSnapshot;`,
  '@/lib/parent-offline/repository': `export const subscribeToParentOfflineChanges=()=>()=>{};`,
  '@/lib/hooks/use-academic-years': `export const useAcademicYears=()=>({data:[]});`,
  '@/lib/hooks/use-timetable': `export const useTimetablePeriods=()=>({data:[]});export const useTimetableEntries=useTimetablePeriods;export const useTimetableProfiles=useTimetablePeriods;`,
  '@/lib/hooks/use-events-fixed': `export const useEvents=()=>({data:[]});export const useExamsAsEvents=useEvents;`,
  ...Object.fromEntries(['classes', 'subjects', 'staff'].map(name => [`@/lib/hooks/use-${name}`, `export const use${name[0].toUpperCase() + name.slice(1)}=()=>({data:[]});`])),
  '@/lib/offline/android-app-shell': `export const isAndroidOffline=()=>!navigator.onLine;export const prepareAndroidAppShell=async()=>{window.fixtureShellPreparations=(window.fixtureShellPreparations||0)+1};export const installAndroidOfflineNavigation=()=>()=>{};`,
  '@/hooks/use-toast': `export const toast=()=>{};`,
};

async function run() {
  fs.mkdirSync(output, { recursive: true });
  await esbuild.build({ absWorkingDir: root, stdin: { resolveDir: root, loader: 'tsx', contents: `
    import React from'react';import{createRoot}from'react-dom/client';
    import{HomeScreenSettings}from'./src/components/pwa/home-screen-settings';
    import{HomeScreenLifecycle}from'./src/components/pwa/lifecycle';import{AndroidOfflineProvider}from'./src/components/providers/android-offline-provider';
    import{browserOfflineRequest,readBrowserWorkspace,clearBrowserOfflineAccess}from'./src/lib/pwa/offline-store';
    import{hasBrowserOfflineWorkspace,isAppleMobile}from'./src/lib/pwa/platform';import{supportsWebPush,enablePushSubscription}from'./src/lib/push-subscription-client';
    window.fixtureAPI={browserOfflineRequest,readBrowserWorkspace,clearBrowserOfflineAccess,hasBrowserOfflineWorkspace,isAppleMobile,supportsWebPush,enablePushSubscription};
    createRoot(document.getElementById('app')).render(<><AndroidOfflineProvider/><HomeScreenLifecycle/><HomeScreenSettings/></>);
  ` }, bundle: true, jsx: 'automatic', platform: 'browser', alias: { '@': path.join(root, 'src') }, define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' }, outfile: path.join(output, 'fixture.js'), plugins: [{ name: 'synthetic-school', setup(build) {
    build.onResolve({ filter: /.*/ }, args => Object.hasOwn(mocks, args.path) ? { path: args.path, namespace: 'mock' } : undefined);
    build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'tsx', resolveDir: root }));
  } }] });
  console.log('PWA_COMPONENTS_BUNDLED');
  if (!process.env.SKIP_PWA_CSS || !fs.existsSync(path.join(output, 'fixture.css'))) {
  const config = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(root, 'tailwind.config.ts'), 'utf8'), { compilerOptions: { module: 1 } }).outputText)(require, config, config.exports);
  const css = ['globals.css', 'theme.css', 'brand-theme.css'].map(file => fs.readFileSync(path.join(root, 'src/app', file), 'utf8')).join('\n').replace(/^@import[^;]+;/, '');
  const built = await require('postcss')([require('tailwindcss')({ ...config.exports.default, content: [path.join(root, 'src/components/pwa/**/*.tsx'), path.join(root, 'src/components/ui/button.tsx')] })]).process(css, { from: path.join(root, 'src/app/globals.css') });
  fs.writeFileSync(path.join(output, 'fixture.css'), built.css);
  }
  console.log('PWA_CSS_BUILT');
  let requests = [], apiStatus = 200, delayResponse;
  const server = http.createServer(async (request, response) => {
    const url = request.url.split('?')[0]; requests.push(url);
    if (url === '/api/offline/session') {
      if (delayResponse) await delayResponse;
      response.writeHead(apiStatus, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(session((request.headers.authorization || '').replace('Bearer signed:', '') || 'fixture'))); return;
    }
    if (url === '/api/notifications/vapid-public-key') { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ publicKey })); return; }
    if (url === '/api/notifications/subscribe') { for await (const chunk of request) {} response.setHeader('Content-Type', 'application/json'); response.end('{"active":true}'); return; }
    if (['/fixture.js', '/fixture.css'].includes(url)) { response.setHeader('Content-Type', url.endsWith('.js') ? 'text/javascript' : 'text/css'); response.end(fs.readFileSync(path.join(output, url.slice(1)))); return; }
    response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/fixture.css"></head><body><main id="app" class="mx-auto max-w-xl space-y-6 p-4"></main><script src="/fixture.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    for (const engine of ['chromium', 'webkit']) {
      browser = await playwright[engine].launch({ headless: true, ...(engine === 'chromium' ? { channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' } : {}) });
      for (const dark of [false, true]) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 Version/16.4 Mobile/15E148 Safari/604.1', colorScheme: dark ? 'dark' : 'light', reducedMotion: 'reduce', acceptDownloads: true });
        await context.addInitScript(({ dark }) => {
          Object.defineProperty(navigator, 'standalone', { value: true });
          window.fixturePauseSnapshots = true;
          Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true });
          // Browser test stand-ins exercise the real permission/registration flow;
          // actual APNs delivery and OS prompts still require an iPhone.
          window.permissionGestures = [];
          Object.defineProperty(window, 'Notification', { configurable: true, value: { permission: 'default', requestPermission() { window.permissionGestures.push(navigator.userActivation?.isActive ?? true); this.permission = 'granted'; return Promise.resolve('granted'); } } });
          window.PushManager = function () {};
          const subscription = { endpoint: 'https://example.invalid/synthetic-endpoint', options: {}, toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'synthetic', auth: 'synthetic' } }; }, unsubscribe: async () => true };
          const registration = { pushManager: { getSubscription: async () => null, subscribe: async options => { window.lastPushOptions = options; return subscription; } } };
          Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register: async () => registration, getRegistration: async () => registration, ready: Promise.resolve(registration) } });
          document.addEventListener('DOMContentLoaded', () => { if (dark) { document.documentElement.classList.add('dark'); document.documentElement.style.fontSize = '150%'; } });
        }, { dark });
        let page = await context.newPage(); const errors = [];
        page.on('pageerror', error => { errors.push(error.message); console.error('BROWSER_ERROR', error.message); });
        await page.goto(origin); await page.waitForFunction(() => window.fixtureAPI);
        const seed = { session: session(), snapshot: snapshot() };
        await page.evaluate(async seed => {
          window.fixtureSnapshot = seed.snapshot;
          await window.fixtureAPI.browserOfflineRequest('connect', { token: 'signed:fixture', accountId: 'fixture' });
          await window.fixtureAPI.browserOfflineRequest('save', { snapshot: seed.snapshot });
          await window.fixtureAPI.browserOfflineRequest('shellReady', { build: 'fixture-build' });
          const cache = await caches.open('android-app-shell-fixture');
          for (const path of ['/', '/pupils', '/timetable', '/events']) await cache.put('/__trinity_saved_route/fixture-build/' + encodeURIComponent(path), new Response('fixture', { headers: { 'Content-Type': 'text/x-component' } }));
        }, seed);
        // Cold auth hydration gap must preserve a saved session, including offline.
        await context.setOffline(true);
        await page.evaluate(() => window.setFixtureAuth({ user: { id: 'fixture', role: 'Admin' } }));
        await page.getByRole('heading', { name: 'Home Screen app', exact: true }).waitFor().catch(async error => { console.error(JSON.stringify(await page.evaluate(() => ({ auth: window.fixtureAuth, capable: window.fixtureAPI.hasBrowserOfflineWorkspace(), text: document.body.innerText })), null, 2)); throw error; });
        await page.waitForFunction(async () => (await window.fixtureAPI.readBrowserWorkspace())?.snapshot?.accountId === 'fixture');
        assert.equal(await page.evaluate(async () => {
          const saved = await window.fixtureAPI.readBrowserWorkspace();
          return !saved.snapshot.datasets.pupils && !saved.snapshot.datasets.parent && !saved.snapshot.datasets.teachers
            && saved.sections.some(section => section.path === '/pupils' && section.saved);
        }), true);
        await page.getByText('Saved', { exact: true }).first().waitFor();
        assert.equal(await page.getByRole('button', { name: 'Prepare offline access', exact: true }).isDisabled(), true);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.screenshot({ path: path.join(output, `${engine}-${dark ? 'dark-large-text' : 'light'}.png`), fullPage: true });
        for (const viewport of [{ width: 375, height: 812 }, { width: 844, height: 390 }]) {
          await page.setViewportSize(viewport);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          await page.screenshot({ path: path.join(output, `${engine}-${viewport.width}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
        }
        // Diagnostics remain available offline, with an explicit, user-controlled export.
        await page.getByRole('button', { name: 'Share problem report', exact: true }).click();
        const report = JSON.parse(await page.getByLabel('Problem report text', { exact: true }).inputValue());
        assert.equal(report.environment.homeScreen, true); assert.equal(report.environment.iosVersion, '16.4'); assert.equal(report.online, false);
        assert.ok(report.bugId.startsWith('TRI-')); assert.equal(JSON.stringify(report).includes('signed:'), false);
        const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save report file', exact: true }).click(); assert.equal((await download).suggestedFilename(), 'school-problem-report.json');
        await context.setOffline(false);
        await page.getByRole('button', { name: 'Enable notifications', exact: true }).click();
        await page.getByText('This device is registered for school notifications.', { exact: true }).waitFor();
        assert.deepEqual(await page.evaluate(() => window.permissionGestures), [true]);
        assert.equal(await page.evaluate(() => window.lastPushOptions.userVisibleOnly), true);
        // Storage failures reject promptly, retaining the previous committed snapshot.
        assert.equal(await page.evaluate(async () => {
          const put = IDBObjectStore.prototype.put;
          IDBObjectStore.prototype.put = () => { throw new DOMException('Synthetic full disk', 'QuotaExceededError'); };
          try { await window.fixtureAPI.browserOfflineRequest('save', { snapshot: window.fixtureSnapshot }); return false; }
          catch { return (await window.fixtureAPI.readBrowserWorkspace())?.snapshot?.accountId === 'fixture'; }
          finally { IDBObjectStore.prototype.put = put; }
        }), true);
        // Failed validation must not erase usable access; revocation must.
        apiStatus = 503;
        assert.equal(await page.evaluate(async () => { try { await window.fixtureAPI.browserOfflineRequest('connect', { token: 'signed:fixture', accountId: 'fixture' }); } catch {} return !!(await window.fixtureAPI.readBrowserWorkspace()); }), true);
        apiStatus = 401;
        assert.equal(await page.evaluate(async () => { try { await window.fixtureAPI.browserOfflineRequest('connect', { token: 'signed:fixture', accountId: 'fixture' }); } catch {} return await window.fixtureAPI.readBrowserWorkspace(); }), null);
        apiStatus = 200;
        await page.evaluate(() => window.fixtureAPI.browserOfflineRequest('connect', { token: 'signed:fixture', accountId: 'fixture' }));
        // A response arriving after explicit logout cannot restore saved identity.
        let release; delayResponse = new Promise(resolve => { release = resolve; });
        await page.evaluate(() => { window.lateConnection = window.fixtureAPI.browserOfflineRequest('connect', { token: 'signed:fixture', accountId: 'fixture' }).then(() => 'saved', () => 'cancelled'); });
        await page.evaluate(() => window.fixtureAPI.clearBrowserOfflineAccess()); release(); delayResponse = undefined;
        assert.equal(await page.evaluate(() => window.lateConnection), 'cancelled');
        assert.equal(await page.evaluate(() => window.fixtureAPI.readBrowserWorkspace()), null);
        // Different accounts and reduced permissions never inherit old snapshots.
        await page.evaluate(() => window.fixtureAPI.browserOfflineRequest('connect', { token: 'signed:other', accountId: 'other' }));
        assert.equal(await page.evaluate(async () => (await window.fixtureAPI.readBrowserWorkspace())?.snapshot || null), null);
        await page.evaluate(() => window.setFixtureAuth({ user: { id: 'other', role: 'Admin' }, isLocked: true }));
        await page.getByRole('heading', { name: 'Home Screen app', exact: true }).waitFor({ state: 'hidden' });
        assert.deepEqual(errors, []);
        await context.close();
        console.log(`PWA_BROWSER_OK ${engine} ${dark ? 'dark 150% text' : 'light'}: saved auth gap, offline readiness, diagnostics, permission gesture, disk failure, outage/revocation/logout/account switch and lock.`);
      }
      // Ordinary Safari remains inert and gives installation instructions.
      const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15' });
      const page = await context.newPage(); requests = []; await page.goto(origin); await page.getByRole('heading', { name: 'Your school, on iPhone' }).waitFor();
      assert.equal(await page.evaluate(() => window.fixtureAPI.hasBrowserOfflineWorkspace()), false);
      assert.equal(await page.evaluate(() => window.fixtureAPI.supportsWebPush()), false);
      assert.equal(requests.includes('/api/offline/session'), false);
      await context.close();
      // iPhone-specific management must never add UI to desktop or Android apps.
      for (const platform of [
        { name: 'Windows installed', agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36', native: false },
        { name: 'Android installed', agent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36', native: false },
        { name: 'Android native', agent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36', native: true },
      ]) {
        const other = await browser.newContext({ userAgent: platform.agent });
        await other.addInitScript(({ native }) => {
          Object.defineProperty(navigator, 'standalone', { value: true });
          if (native) window.TrinityOffline = {};
        }, platform);
        const otherPage = await other.newPage();
        const otherErrors = []; otherPage.on('pageerror', error => otherErrors.push(error.message));
        await otherPage.goto(origin); await otherPage.waitForFunction(() => window.fixtureAPI);
        await otherPage.evaluate(() => window.setFixtureAuth({ user: { id: 'fixture', role: 'Admin' } }));
        // Drain effects and rendering before checking for unwanted visible controls.
        await otherPage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.equal(await otherPage.locator('#app').innerText(), '', platform.name);
        assert.deepEqual(otherErrors, [], platform.name);
        console.log(`PWA_PLATFORM_UI_OK ${engine} ${platform.name}: no iPhone settings or install panel.`);
        await other.close();
      }
      await browser.close(); browser = undefined;
    }
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
