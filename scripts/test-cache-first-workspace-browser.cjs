// Real preloader, pupil hooks and calendar hook; only external boundaries are mocked.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const esbuild = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'output/cache-first-workspace-qa');
const mocks = new Map();
const owners = ['class', 'academic-year', 'staff', 'subject', 'house', 'access-level', 'exam'];
for (const name of owners) mocks.set('src/lib/hooks/use-' + name + '-cache-bootstrap',
  'export const use' + name.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join('') + 'CacheBootstrap=()=>{};');
const source = fs.readFileSync(path.join(root, 'src/components/providers/global-data-preloader.tsx'), 'utf8');
for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)) {
  const key = match[2].replace(/^@\//, 'src/');
  if (!key.includes('/cache/') && !['src/lib/hooks/use-fees'].includes(key)) continue;
  let code = key === 'src/lib/cache/persistent-collection-cache'
    ? 'import {readPersistentCollectionWithMetadata as diskRead,writePersistentCollection as diskWrite} from "@real/persistent-cache";window.writeDiskSnapshot=diskWrite;'
    : '';
  for (const name of match[1].split(',').map(item => item.trim()).filter(Boolean)) {
    if (name === 'readPersistentCollectionWithMetadata') code += 'export const ' + name + '=key=>window.useDiskCache?diskRead(key):window.readSnapshot(key);';
    else if (name === 'readPupilCache') code += 'export const ' + name + '=async()=>null;';
    else if (name === 'writePersistentCollection') code += 'export const ' + name + '=async()=>{};';
    else if (name === 'clearPupilSessionQueries') code += 'export const ' + name + '=client=>client.setQueryData(["pupils","list"],[]);';
    else if (name === 'isParentPupilSnapshotOwnedByAccount') code += 'export const ' + name + '=(id,data)=>data.every(p=>p.parentAccountId===id&&p.parentAccountActive===true);';
    else if (name === 'getPupilCacheScope') code += 'export const ' + name + '=(id,role)=>id+":"+role;';
    else if (name === 'persistentCollectionCacheKey') code += 'export const ' + name + '=(...parts)=>parts.join("::");';
    else if (name === 'FEES_QUERY_KEYS') code += 'export const ' + name + '={structures:()=>["fees","structures"]};';
    else if (name === 'LITE_KEYS') code += 'export const ' + name + '={requirements:"requirements"};';
    else code += 'export const ' + name + '=()=>{};';
  }
  mocks.set(key, code);
}
mocks.set('src/lib/contexts/auth-context', 'import {useContext} from "react";export const useAuth=()=>useContext(window.UserContext);');
mocks.set('src/lib/firebase', 'export const auth=window.mockAuth;export const db={};');
for (const [name, service] of [['pupils', 'PupilsService'], ['fees', 'FeesService'], ['uniforms', 'UniformsService']]) {
  mocks.set('src/lib/services/' + name + '.service', 'export const ' + service +
    '=new Proxy({}, {get:(_,method)=>method.startsWith("get")?async()=>{window.reads++;return [];}:()=>{}});');
}
mocks.set('firebase/firestore', `
export const collection=(_,name)=>({name});export const where=(field,op,value)=>({field,op,value});
export const query=(base,...filters)=>({...base,filters});
export const getDocs=async()=>{window.reads++;return {docs:[]};};
export const onSnapshot=(query,options,next,error)=>{const l={query,next,error,active:true};window.listeners.push(l);return()=>l.active=false;};
`);
mocks.set('src/lib/cache/school-catalogue-cache', 'export const restoreCatalogue=async()=>{};');
mocks.set('src/lib/cache/school-catalogue-queries', 'export const schoolCatalogueOptions=(_,name)=>({queryKey:[name],queryFn:async()=>[],staleTime:Infinity});');
async function run() {
  fs.mkdirSync(output, { recursive: true });
  const cssDirectory = path.join(root, '.next/static/css');
  const css = fs.existsSync(cssDirectory) ? fs.readdirSync(cssDirectory).filter(file => file.endsWith('.css'))
    .map(file => fs.readFileSync(path.join(cssDirectory, file), 'utf8')).join('\n') : '';
  const contents = `
import React,{createContext,useEffect,useState} from 'react';import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {GlobalDataPreloader} from './src/components/providers/global-data-preloader';
import {usePupil,usePupils} from './src/lib/hooks/use-pupils';
import {useUgandaHolidays} from './src/lib/hooks/use-uganda-holidays';
import {SavedPupilDataNotice} from './src/components/pupils/saved-pupil-data-notice';
import {rememberVerifiedWorkspaceAccess,workspaceCacheAccessScope} from './src/lib/startup/workspace-cache-access';
window.UserContext=createContext(null);
const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});
function Data(){const [id,setId]=useState('one');const pupils=usePupils();const pupil=usePupil(id);
const holidays=useUgandaHolidays(new Date());useEffect(()=>{window.holidayBuilds++;},[holidays.data]);
return <><h1>Dashboard</h1><SavedPupilDataNotice/><div data-testid="count">{pupils.data===undefined?(pupils.error?'Error':'Loading'):pupils.data.length}</div>
<h2>{pupil.data?.firstName||'Waiting for pupil'}</h2><button onClick={()=>setId(id==='one'?'two':'one')}>Select pupil</button></>;}
function Fixture(){const [user,setUser]=useState(window.startUser||{id:'first',role:'Admin',isActive:true});
window.fixture={switchUser:next=>{localStorage.setItem('trinity_user',JSON.stringify({user:next}));setUser(next);},
grant:next=>rememberVerifiedWorkspaceAccess(next||user),scope:next=>workspaceCacheAccessScope(next||user)};
useEffect(()=>{localStorage.setItem('trinity_user',JSON.stringify({user}));if(window.seedGrant)rememberVerifiedWorkspaceAccess(user);},[]);
return <QueryClientProvider client={client}><window.UserContext.Provider value={{user,isAuthenticated:true}}><GlobalDataPreloader/><Data/></window.UserContext.Provider></QueryClientProvider>;}
createRoot(document.getElementById('app')).render(<Fixture/>);`;
  await esbuild.build({
    absWorkingDir: root, stdin: { contents, resolveDir: root, loader: 'tsx' },
    bundle: true, jsx: 'automatic', platform: 'browser', outfile: path.join(output, 'fixture.js'),
    alias: { '@': path.join(root, 'src') },
    define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID': 'undefined' },
    plugins: [{ name: 'external-boundaries', setup(build) {
      build.onResolve({ filter: /.*/ }, args => {
        if (args.path === '@real/persistent-cache') return { path: path.join(root, 'src/lib/cache/persistent-collection-cache.ts') };
        const key = args.path.startsWith('@/') ? args.path.replace(/^@\//, 'src/')
          : args.path.startsWith('.') ? path.relative(root, path.resolve(path.dirname(args.importer), args.path)).replaceAll('\\', '/') : args.path;
        if (mocks.has(key)) return { path: key, namespace: 'boundary' };
      });
      build.onLoad({ filter: /.*/, namespace: 'boundary' }, args => ({ contents: mocks.get(args.path), loader: 'js', resolveDir: root }));
    } }],
  });
  const server = http.createServer((req, res) => {
    if (req.url === '/fixture.css') { res.setHeader('Content-Type', 'text/css'); res.end(css); return; }
    res.setHeader('Content-Type', req.url === '/fixture.js' ? 'text/javascript' : 'text/html');
    res.end(req.url === '/fixture.js' ? fs.readFileSync(path.join(output, 'fixture.js'))
      : '<!doctype html><link rel="stylesheet" href="/fixture.css"><div id="app"></div><script src="/fixture.js"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: process.env.THEME_BROWSER_CHANNEL || 'chrome', headless: true });
  const reports = [], errors = [];
  const open = async (seedGrant = true, parent = false) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(({ granted, parent }) => {
      window.useDiskCache = new URL(location.href).searchParams.has('disk');
      window.startUser = parent ? { id: 'first', role: 'Parent', isActive: true } : null;
      window.seedGrant = granted; window.reads = 0; window.holidayBuilds = 0; window.listeners = [];
      window.cacheReads = [];
      window.readSnapshot = key => new Promise(resolve => window.cacheReads.push({ key, resolve }));
      const ready = new Promise(resolve => window.restoreAuth = () => { window.mockAuth.currentUser = { uid: 'first', isAnonymous: false }; resolve(); });
      window.mockAuth = { currentUser: null, authStateReady: () => ready };
      window.emit = (data, fromCache = false) => window.listeners.filter(l => l.active && l.query.name === 'pupils')
        .forEach(l => l.next({ metadata: { fromCache }, empty: data.length === 0,
          docs: data.map(p => ({ id: p.id, data: () => p })), docChanges: () => [] }));
      window.saved = [{ id: 'one', firstName: 'Saved pupil' }, { id: 'two', firstName: 'Second pupil' }];
      if (parent) window.saved.forEach(pupil => { pupil.parentAccountId = 'first'; pupil.parentAccountActive = true; });
    }, { granted: seedGrant, parent });
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForFunction(() => window.cacheReads.length > 0);
    return page;
  };
  try {
    // Authentication remains unresolved throughout saved viewing and navigation.
    let page = await open();
    await page.evaluate(() => window.cacheReads[0].resolve({ data: window.saved, writtenAt: Date.now(), authorizationScope: window.fixture.scope() }));
    await page.getByRole('heading', { name: 'Saved pupil', exact: true }).waitFor();
    assert.equal(await page.getByRole('status').count(), 1);
    if (css) {
      const notice = page.getByRole('status');
      const box = await notice.boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= 390, 'Saved notice fits the phone viewport');
      await page.screenshot({ path: path.join(output, 'saved-data-light.png') });
      await page.evaluate(() => document.documentElement.classList.add('dark'));
      await page.screenshot({ path: path.join(output, 'saved-data-dark.png') });
      await page.emulateMedia({ media: 'print' });
      assert.equal(await page.locator('[role="status"]').evaluate(element => getComputedStyle(element).display), 'none', 'Saved-data state does not alter printed reports');
      await page.emulateMedia({ media: 'screen' });
    }
    assert.equal(await page.getByTestId('count').textContent(), '2');
    assert.equal(await page.evaluate(() => window.mockAuth.currentUser), null);
    assert.equal(await page.evaluate(() => window.reads), 0);
    assert.equal(await page.evaluate(() => window.listeners.length), 0);
    // Prepare a real IndexedDB snapshot for the subsequent process-style reload.
    await page.evaluate(async () => {
      const data = [...window.saved, ...Array.from({ length: 1005 }, (_, index) => ({
        id: 'extra-' + index, firstName: 'Saved name ' + index, lastName: 'Surname ' + index,
        classId: 'class-a', status: 'Active', createdAt: '2026-10-01T00:00:00.000Z',
      }))];
      await window.writeDiskSnapshot('trinity-family-schools::pupils::user:first', data, window.fixture.scope());
    });
    const clickedAt = Date.now();
    await page.getByRole('button', { name: 'Select pupil' }).click();
    await page.getByRole('heading', { name: 'Second pupil', exact: true }).waitFor();
    reports.push({ savedBeforeIdentity: true, clickToVisibleMs: Date.now() - clickedAt });
    assert.equal(await page.evaluate(() => window.holidayBuilds), 1, 'Calendar inputs remain stable across pupil renders');
    await page.evaluate(() => window.restoreAuth());
    await page.waitForFunction(() => window.listeners.some(l => l.active && l.query.name === 'pupils'));
    await page.evaluate(() => window.emit([{ id: 'one', firstName: 'Partial cache' }], true));
    assert.equal(await page.getByTestId('count').textContent(), '2', 'Partial Firestore cache cannot replace a complete saved list');
    await page.evaluate(() => window.emit([{ id: 'two', firstName: 'Live pupil' }]));
    await page.getByRole('heading', { name: 'Live pupil', exact: true }).waitFor();
    assert.equal(await page.getByRole('status').count(), 0, 'Server reconciliation removes the saved-data notice');
    await page.evaluate(() => window.listeners.find(l => l.active && l.query.name === 'pupils').error(Object.assign(new Error('Disconnected'), { code: 'unavailable' })));
    assert.equal(await page.getByTestId('count').textContent(), '1', 'Transient failure preserves loaded records');
    assert.ok(await page.evaluate(() => performance.getEntriesByName('trinity:workspace:pupils-first-paint').length > 0));
    await page.close();

    page = await open();
    await page.evaluate(() => window.cacheReads[0].resolve({ data: [], writtenAt: Date.now(), complete: true, authorizationScope: window.fixture.scope() }));
    await page.waitForFunction(() => document.querySelector('[data-testid="count"]').textContent === '0');
    assert.equal(await page.getByRole('status').count(), 1, 'A previously confirmed empty saved list is a valid offline result');
    assert.equal(await page.evaluate(() => window.mockAuth.currentUser), null);
    await page.close();

    // Actual browser IndexedDB, 1,007 pupils, no Firebase restoration.
    page = await open();
    await page.evaluate(async () => {
      const data = [...window.saved, ...Array.from({ length: 1005 }, (_, index) => ({ id: 'extra-' + index, firstName: 'Name ' + index, status: 'Active' }))];
      await window.writeDiskSnapshot('trinity-family-schools::pupils::user:first', data, window.fixture.scope());
    });
    await page.goto('http://127.0.0.1:' + server.address().port + '/?disk=1');
    await page.getByRole('heading', { name: 'Saved pupil', exact: true }).waitFor();
    assert.equal(await page.getByTestId('count').textContent(), '1007');
    assert.equal(await page.evaluate(() => window.mockAuth.currentUser), null);
    assert.equal(await page.evaluate(() => window.reads), 0);
    reports.push(await page.evaluate(() => ({
      actualIndexedDbPupils: 1007,
      cacheReadMs: performance.getEntriesByName('trinity:workspace:pupils-cache-read')[0].duration,
      cachePublishedFromNavigationMs: performance.getEntriesByName('trinity:workspace:pupils-cache-published')[0].duration,
    })));
    await page.close();

    // Parents mount only their saved pupils; payments wait for signed identity
    // but then start directly from those IDs without a pupil server response.
    page = await open(true, true);
    await page.evaluate(() => window.cacheReads[0].resolve({ data: window.saved, writtenAt: Date.now(), authorizationScope: window.fixture.scope() }));
    await page.getByRole('heading', { name: 'Saved pupil', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.listeners.length), 0);
    await page.evaluate(() => window.restoreAuth());
    await page.waitForFunction(() => window.listeners.filter(l => l.active && l.query.name === 'payments').length === 2);
    assert.equal(await page.getByTestId('count').textContent(), '2');
    await page.close();

    // A cached profile alone cannot publish private records.
    page = await open(false);
    await page.evaluate(() => window.cacheReads[0].resolve({ data: window.saved, writtenAt: Date.now() }));
    await page.waitForTimeout(100);
    assert.equal(await page.getByTestId('count').textContent(), 'Loading');
    await page.evaluate(() => window.fixture.grant());
    await page.getByRole('heading', { name: 'Saved pupil', exact: true }).waitFor();
    await page.close();

    // A complete server-empty result wins against a late local read.
    page = await open();
    await page.evaluate(() => window.restoreAuth());
    await page.waitForFunction(() => window.listeners.some(l => l.active && l.query.name === 'pupils'));
    await page.evaluate(() => { window.emit([]); window.cacheReads[0].resolve({ data: window.saved, writtenAt: Date.now() }); });
    await page.waitForFunction(() => document.querySelector('[data-testid="count"]').textContent === '0');
    await page.waitForTimeout(100);
    assert.equal(await page.getByTestId('count').textContent(), '0');
    await page.close();

    // An old account's pending cache read cannot cross an account switch.
    page = await open();
    await page.evaluate(() => { window.fixture.switchUser({ id: 'second', role: 'Admin', isActive: true }); });
    await page.waitForFunction(() => window.cacheReads.length === 2);
    assert.equal(await page.getByTestId('count').textContent(), 'Loading', 'Account switching cannot advertise a false zero');
    await page.evaluate(() => {
      window.fixture.grant();
      window.cacheReads[0].resolve({ data: [{ id: 'one', firstName: 'Old private pupil' }], writtenAt: Date.now() });
      window.cacheReads[1].resolve({ data: [{ id: 'one', firstName: 'New account pupil' }], writtenAt: Date.now(), authorizationScope: window.fixture.scope() });
    });
    await page.getByRole('heading', { name: 'New account pupil', exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Old private pupil', exact: true }).count(), 0);
    await page.close();

    // Permission rejection prevents both late cache publication and a subsequent receipt event.
    page = await open();
    await page.evaluate(() => window.restoreAuth());
    await page.waitForFunction(() => window.listeners.some(l => l.active && l.query.name === 'pupils'));
    await page.evaluate(() => {
      window.listeners.find(l => l.active && l.query.name === 'pupils').error(Object.assign(new Error('Denied'), { code: 'permission-denied' }));
      window.fixture.grant();
      window.cacheReads[0].resolve({ data: window.saved, writtenAt: Date.now() });
    });
    await page.waitForTimeout(100);
    assert.equal(await page.getByTestId('count').textContent(), 'Error');
    await page.close();

    // Changing the saved permission scope requires authoritative reconciliation.
    page = await open();
    await page.evaluate(() => window.cacheReads[0].resolve({ data: window.saved, writtenAt: Date.now(), authorizationScope: 'old permissions' }));
    await page.waitForTimeout(100);
    assert.equal(await page.getByTestId('count').textContent(), 'Loading');
    await page.close();
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ reports, errors, accountSwitch: true, serverWins: true, transientRetention: true, revokedAccess: true, stableCalendar: true, printParity: !!css }, null, 2));
    console.log('CACHE_FIRST_WORKSPACE_OK: saved viewing and clicks before Firebase, no protected downloads, server reconciliation, transient retention, account/permission isolation, revocation and stable calendar.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
