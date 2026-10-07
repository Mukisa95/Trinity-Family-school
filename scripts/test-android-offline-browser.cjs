/* Fixture-only visual/interaction checks. This never opens the hosted school or real accounts. */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const assets = path.join(root, 'android-app/app/src/main/assets/offline');
const output = path.join(root, 'output/android-offline-qa');
fs.mkdirSync(output, { recursive: true });
require('esbuild').buildSync({ absWorkingDir: root, stdin: { contents: `
export { exportAndroidCachedSnapshot } from './src/lib/offline/android-cache-export';
export { writePersistentCollection } from './src/lib/cache/persistent-collection-cache';
export { saveParentOfflineFamily, saveParentOfflineFees } from './src/lib/parent-offline/repository';
export { writeClassCache, getClassCacheScope } from './src/lib/cache/class-cache';
export { liteWrite } from './src/lib/cache/lite-cache';
export { projectOfflinePhotos } from './src/lib/offline/android-photo-projection';
`, resolveDir: root, loader: 'ts' }, bundle: true, platform: 'browser', format: 'iife', globalName: 'AndroidCacheFixture',
  alias: { '@': path.join(root, 'src') }, outfile: path.join(output, 'cache-test.js'),
  define: { 'process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID': '"trinity-family-schools"' },
});
const mockHook = "import { useEffect } from 'react'; import { liteWrite } from '@/lib/cache/lite-cache'; const read = () => window.providerFixture; const base = () => 'timetable:' + encodeURIComponent(['trinity-family-schools', read().session.accountId, read().session.role, 'school'].map(encodeURIComponent).join(':')) + ':2026:3:'; export function useTimetableProfiles() { const tables = read().snapshot.datasets.timetables?.data || []; useEffect(() => { liteWrite(base() + 'profiles:', { schema: 2, revision: 4, data: tables.map(table => table.profile) }, Number.MAX_SAFE_INTEGER); }, []); return { data: tables.map(table => table.profile) }; } export function useTimetablePeriods(year, term, id) { useEffect(() => { const table = read().snapshot.datasets.timetables.data.find(table => table.profile.id === id); liteWrite(base() + 'periods:' + id, { schema: 2, revision: 4, data: table.periods }, Number.MAX_SAFE_INTEGER); }, []); } export function useTimetableEntries(year, term, id) { useEffect(() => { const table = read().snapshot.datasets.timetables.data.find(table => table.profile.id === id); liteWrite(base() + 'entries:' + id, { schema: 2, revision: 4, data: table.entries }, Number.MAX_SAFE_INTEGER); }, []); }";
const providerMocks = {
  '@/lib/firebase': "export const auth = { get currentUser() { return { uid: window.providerFixture.session.accountId, getIdToken: async () => 'synthetic-test-token' }; }, onIdTokenChanged: () => () => {} };",
  '@/lib/contexts/auth-context': "export function useAuth() { return { user: { id: window.providerFixture.session.accountId, role: window.providerFixture.session.role }, isLoading: false, isLocked: false }; }",
  '@/lib/hooks/use-academic-years': "export function useAcademicYears() { return { data: window.providerFixture.snapshot.datasets.academicYears?.data || [] }; }",
  '@/lib/hooks/use-classes': "export function useClasses() { return { data: [] }; }",
  '@/lib/hooks/use-subjects': "export function useSubjects() { return { data: [] }; }",
  '@/lib/hooks/use-staff': "export function useStaff() { return { data: [] }; }",
  '@/lib/hooks/use-timetable': mockHook,
};
async function buildProviderTest() { await require('esbuild').build({ jsx: 'automatic', absWorkingDir: root, stdin: { contents: `import React from 'react'; import { createRoot } from 'react-dom/client'; import { QueryClient, QueryClientProvider } from '@tanstack/react-query'; import { AndroidOfflineProvider } from './src/components/providers/android-offline-provider'; const element = document.createElement('div'); document.body.append(element); const root = createRoot(element); window.stopProvider = () => root.unmount(); root.render(<QueryClientProvider client={new QueryClient()}><AndroidOfflineProvider /></QueryClientProvider>);`, resolveDir: root, loader: 'tsx' }, bundle: true, platform: 'browser', alias: { '@': path.join(root, 'src') }, outfile: path.join(output, 'provider-test.js'), define: { 'process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID': '\"trinity-family-schools\"' }, plugins: [{ name: 'fixture-auth-and-query-owners', setup(build) { build.onResolve({ filter: /^@\/lib\/(firebase|contexts\/auth-context|hooks\/(use-academic-years|use-classes|use-subjects|use-staff|use-timetable))$/ }, args => ({ path: args.path, namespace: 'fixture' })); build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: providerMocks[args.path], loader: 'js', resolveDir: root })); } }] }); }

const now = '2026-10-07T10:00:00.000Z';
function sample(parent = false) {
  const session = { schema: 1, accountId: parent ? 'parent-fixture' : 'staff-fixture', role: parent ? 'Parent' : 'Admin', displayName: 'Example Account', timeZone: 'Africa/Kampala', issuedAt: now, expiresAt: '2026-10-14T10:00:00.000Z', pupilIds: ['child-fixture'], grants: { dashboard: !parent, pupils: !parent, timetable: !parent, pupilFields: ['id', 'firstName', 'lastName', 'admissionNumber', 'classId', 'className', 'status', 'guardians'], dashboardCounts: ['pupils', 'staff'] } };
  const dataset = data => ({ preparedAt: now, data });
  const pupil = { id: 'child-fixture', firstName: 'Example', lastName: 'Pupil', admissionNumber: 'DEMO001', classId: 'class-fixture', className: 'Primary Four', status: 'Active', guardians: [{ firstName: 'Sample', lastName: 'Guardian', relationship: 'Parent', phone: 'Example contact' }] };
  const datasets = parent ? { parent: dataset({ family: { schema: 1, accountId: session.accountId, preparedAt: now, pupils: [pupil] }, fees: [{ schema: 1, key: 'fee-fixture', accountId: session.accountId, pupilId: pupil.id, academicYearId: '2026', termId: '3', preparedAt: now, totals: { totalFees: 500000, totalPaid: 200000, totalBalance: 300000 }, fees: [{ id: 'tuition', name: 'Tuition', amount: 500000, paid: 200000, balance: 300000, payments: [] }] }], attendance: [{ schema: 1, key: 'attendance-fixture', accountId: session.accountId, pupilId: pupil.id, preparedAt: now, revision: 1, records: [{ id: 'record-fixture', date: '2026-10-07', status: 'Present', pupilId: pupil.id }] }], banking: [], results: [] }) } : {
    academicYears: dataset([{ id: '2026', startDate: '2026-01-01', endDate: '2026-12-31', terms: [{ id: '3', startDate: '2026-09-01', endDate: '2026-12-01' }] }]), pupils: dataset([pupil]), dashboard: dataset({ pupils: 120, staff: 12 }), classes: dataset([{ id: 'class-fixture', name: 'Primary Four', streams: [] }]),
    subjects: dataset([{ id: 'english', name: 'English' }]), teachers: dataset([{ id: 'teacher-fixture', firstName: 'Sample', lastName: 'Teacher' }]),
    timetables: dataset([{ complete: true, profile: { id: 'table-fixture', name: 'Upper Primary', classIds: ['class-fixture'], academicYearId: '2026', termId: '3' }, periods: [{ id: 'period-fixture', dayOfWeek: 3, periodNumber: 1, startTime: '08:00', endTime: '09:00', type: 'lesson' }, { id: 'period-continuation', dayOfWeek: 3, periodNumber: 2, startTime: '09:00', endTime: '10:00', type: 'lesson' }], entries: [{ id: 'entry-fixture', classId: 'class-fixture', periodId: 'period-fixture', periodSpan: 2, subjectId: 'english', teacherId: 'teacher-fixture' }] }]),
  };
  return { session, snapshot: { schema: 1, accountId: session.accountId, role: session.role, capturedAt: now, datasets } };
}
async function run() {
  await buildProviderTest();
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/provider-test.js') { response.setHeader('Content-Type', 'application/javascript'); response.end(fs.readFileSync(path.join(output, 'provider-test.js'))); return; }
    if (pathname === '/cache-test.js') { response.setHeader('Content-Type', 'application/javascript'); response.end(fs.readFileSync(path.join(output, 'cache-test.js'))); return; }
    const filename = ['/', '/index.html'].includes(pathname) ? 'index.html' : pathname.slice(1);
    if (!['index.html', 'app.js', 'app.css'].includes(filename)) { response.writeHead(404); response.end(); return; }
    response.setHeader('Content-Type', filename.endsWith('.js') ? 'application/javascript' : filename.endsWith('.css') ? 'text/css' : 'text/html');
    response.end(fs.readFileSync(path.join(assets, filename)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
  try {
    for (const parent of [false, true]) {
      const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
      const value = sample(parent);
      await context.addInitScript(({ session, snapshot }) => {
        window.fixtureActions = []; window.providerFixture = { session, snapshot };
        window.TrinityOffline = { postMessage(message) {
          const request = JSON.parse(message); window.fixtureActions.push(request.action);
          if (request.action === 'save') window.preparedNativeSnapshot = request.snapshot;
          const reply = request.action === 'connect' ? { session } : request.action === 'status' ? { available: true } : request.action === 'unlock' ? { session, snapshot } : {};
          setTimeout(() => this.onmessage?.({ data: JSON.stringify({ id: request.id, success: true, ...reply }) }), 0);
        } };
      }, value);
      const page = await context.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(url);
      await page.addScriptTag({ url: `${url}/cache-test.js` });
      const cacheResult = await page.evaluate(async ({ session, snapshot, now }) => {
        const cache = window.AndroidCacheFixture;
        const pupil = snapshot.datasets.parent?.data.family.pupils[0] || snapshot.datasets.pupils.data[0];
        if (session.role === 'Parent') {
          const first = await cache.exportAndroidCachedSnapshot(session);
          if (first !== null) throw new Error('Unprepared family must not become an empty family');
          await cache.saveParentOfflineFamily({ accountId: session.accountId, pupils: [pupil, { ...pupil, id: 'outside-child' }] });
          const fees = snapshot.datasets.parent.data.fees[0];
          await cache.saveParentOfflineFees({ accountId: session.accountId, pupilId: pupil.id, academicYearId: fees.academicYearId, termId: fees.termId, fees: fees.fees, totals: fees.totals });
          await cache.saveParentOfflineFamily({ accountId: 'another-parent', pupils: [{ ...pupil, id: 'private-other-child' }] });
          const exported = await cache.exportAndroidCachedSnapshot(session);
          return { pupilIds: exported.datasets.parent.data.family.pupils.map(item => item.id), feeCount: exported.datasets.parent.data.fees.length, keys: Object.keys(exported.datasets) };
        }
        let writes = 0; window.addEventListener('trinity-native-cache-written', () => writes++);
        await cache.writePersistentCollection('trinity-family-schools::pupils::user:staff-fixture', [pupil]);
        await cache.writePersistentCollection('trinity-family-schools::pupils::user:someone-else', [{ ...pupil, id: 'outside-child' }]);
        const scope = cache.getClassCacheScope(session.accountId, session.role);
        cache.writeClassCache(scope, 4, [{ id: 'class-fixture', name: 'Primary Four', streams: [] }]);
        const tableScope = ['trinity-family-schools', session.accountId, session.role, 'school'].map(encodeURIComponent).join(':');
        const prefix = `timetable:${encodeURIComponent(tableScope)}:2026:3:`;
        const table = snapshot.datasets.timetables.data[0];
        cache.liteWrite(prefix + 'profiles:', { schema: 2, revision: 4, data: [table.profile] }, Number.MAX_SAFE_INTEGER);
        cache.liteWrite(prefix + 'periods:table-fixture', { schema: 2, revision: 4, data: table.periods }, Number.MAX_SAFE_INTEGER);
        cache.liteWrite(prefix + 'entries:table-fixture', { schema: 2, revision: 3, data: table.entries }, Number.MAX_SAFE_INTEGER);
        const partial = await cache.exportAndroidCachedSnapshot(session);
        cache.liteWrite(prefix + 'entries:table-fixture', { schema: 2, revision: 4, data: table.entries }, Number.MAX_SAFE_INTEGER);
        const complete = await cache.exportAndroidCachedSnapshot(session);
        cache.liteWrite(prefix + 'profiles:', { schema: 2, revision: 5, data: [] }, Number.MAX_SAFE_INTEGER);
        const cleared = await cache.exportAndroidCachedSnapshot(session);
        return { pupilIds: complete.datasets.pupils.data.map(item => item.id), partial: partial.datasets.timetables.data[0].complete,
          complete: complete.datasets.timetables.data[0].complete, cleared: cleared.datasets.timetables.data.length, preparedAt: complete.datasets.pupils.preparedAt, writes };
      }, { ...value, now });
      const photoCheck = await page.evaluate(async () => {
        const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 800;
        const context = canvas.getContext('2d');
        for (let y = 0; y < 800; y += 4) { context.fillStyle = `rgb(${y % 255},${(y * 7) % 255},${(y * 13) % 255})`; context.fillRect(0, y, 800, 4); }
        const original = canvas.toDataURL('image/jpeg', 0.95);
        const projected = await window.AndroidCacheFixture.projectOfflinePhotos('photo-fixture', [{ id: 'large', photo: original }, { id: 'broken', photo: 'data:image/jpeg;base64,' + 'invalid'.repeat(2000) }, { id: 'remote', photo: 'https://example.invalid/pupil.jpg' }]);
        return { originalLength: original.length, thumbnailLength: projected[0].photo?.length, jpeg: projected[0].photo?.startsWith('data:image/jpeg;base64,'), brokenMissing: !projected[1].photo, remote: projected[2].photo };
      });
      assert.ok(photoCheck.originalLength > 8192); assert.ok(photoCheck.thumbnailLength <= 8192); assert.equal(photoCheck.jpeg, true); assert.equal(photoCheck.brokenMissing, true); assert.equal(photoCheck.remote, 'https://example.invalid/pupil.jpg');
      assert.deepEqual(cacheResult.pupilIds, ['child-fixture']);
      if (parent) { assert.deepEqual(cacheResult.keys, ['parent']); assert.equal(cacheResult.feeCount, 1); }
      else { assert.equal(cacheResult.partial, false); assert.equal(cacheResult.complete, true); assert.equal(cacheResult.cleared, 0); assert.ok(Date.parse(cacheResult.preparedAt) > 0); assert.ok(cacheResult.writes >= 5); }
      await page.evaluate(() => { window.originalFixtureReplyHandler = window.TrinityOffline.onmessage; });
      await page.addScriptTag({ url: `${url}/provider-test.js` });
      await page.waitForFunction(() => Boolean(window.preparedNativeSnapshot));
      assert.equal(await page.evaluate(() => window.preparedNativeSnapshot.accountId), value.session.accountId);
      if (!parent) { await page.waitForFunction(() => window.preparedNativeSnapshot.datasets.timetables?.data[0]?.complete); }
      await page.evaluate(() => { window.stopProvider(); window.TrinityOffline.onmessage = window.originalFixtureReplyHandler; });
      await page.getByRole('button', { name: 'Unlock', exact: true }).click();
      await page.getByRole('heading', { name: parent ? 'My family dashboard' : 'School dashboard' }).waitFor();
      assert.equal(await page.locator('.notice').count(), 0);
      assert.equal(await page.getByText(/saved information|saved access|saved schedule/i).count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: path.join(output, `${parent ? 'parent' : 'staff'}-dashboard.png`), fullPage: true });
      await page.getByRole('navigation').getByRole('button', { name: parent ? 'My children' : 'Pupils', exact: true }).click();
      await page.getByRole('button', { name: /Pupil Example/ }).click();
      await page.getByRole('heading', { name: 'Pupil Example' }).waitFor();
      if (parent) {
        assert.equal(await page.getByRole('navigation').getByRole('button', { name: 'Timetable' }).count(), 0);
        await page.getByRole('tab', { name: 'Fees', exact: true }).click();
        await page.getByText('Tuition', { exact: true }).waitFor();
        await page.screenshot({ path: path.join(output, 'parent-fees.png'), fullPage: true });
        await page.getByRole('tab', { name: 'Results', exact: true }).click();
        await page.getByText('Connect to load this information.', { exact: false }).waitFor();
      } else {
        await page.getByRole('heading', { name: 'Guardians', exact: true }).waitFor();
        await page.screenshot({ path: path.join(output, 'staff-pupil.png'), fullPage: true });
        await page.getByRole('navigation').getByRole('button', { name: 'Timetable', exact: true }).click();
        await page.getByLabel('Day', { exact: true }).selectOption('3');
        await page.getByRole('heading', { name: 'English', exact: true }).waitFor();
        assert.equal(await page.getByRole('heading', { name: 'English', exact: true }).count(), 1);
        await page.getByText('08:00 – 10:00', { exact: false }).waitFor();
        assert.equal(await page.getByRole('heading', { name: 'Unassigned lesson', exact: true }).count(), 0);
        await page.getByRole('button', { name: 'Enable notification card' }).click();
        assert.equal(await page.evaluate(() => window.fixtureActions.includes('selectTimetable')), true);
        await page.screenshot({ path: path.join(output, 'staff-timetable.png'), fullPage: true });
      }
      await page.getByRole('button', { name: 'Lock' }).click();
      await page.getByRole('button', { name: 'Unlock', exact: true }).waitFor();
      assert.equal(await page.getByRole('heading', { name: 'Pupil Example' }).count(), 0);
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.getByRole('button', { name: 'Unlock', exact: true }).click();
      await page.setViewportSize({ width: 812, height: 375 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log('ANDROID_OFFLINE_BROWSER_OK: automatic provider connect/export/save, real IndexedDB/localStorage exports, account isolation, parent fee/family reuse, timetable revision completeness, staff/parent UI, locking, 375px, landscape, dark mode. Fixture bridge; not Android device validation.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
