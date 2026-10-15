// Real hooks, scoped query owners and IndexedDB; only Firebase/service boundaries are simulated.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const esbuild = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'output/school-catalogues-qa');
async function run() {
  fs.mkdirSync(output, { recursive: true });
  const contents = `
import React,{createContext,useEffect,useState} from 'react';import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider,onlineManager} from '@tanstack/react-query';
import {useRequirements,useRequirementsByFilter} from './src/lib/hooks/use-requirements';
import {useUniforms,useUniformsByFilter} from './src/lib/hooks/use-uniforms';
import {useExcludedDays} from './src/lib/hooks/use-excluded-days';
import {workspaceCacheAccessScope,rememberVerifiedWorkspaceAccess,clearSavedWorkspaceAccess} from './src/lib/startup/workspace-cache-access';
import {writePersistentCollection,readPersistentCollectionWithMetadata,persistentCollectionCacheKey} from './src/lib/cache/persistent-collection-cache';
import {catalogueKey} from './src/lib/cache/school-catalogue-cache';
import {subscribeSchoolCatalogue} from './src/lib/cache/school-catalogue-queries';
import {useDashboardDataRevisions} from './src/lib/hooks/use-school-settings';
import {CatalogueDataNotice} from './src/components/common/catalogue-data-notice';
window.UserContext=createContext(null);const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
function GlobalOwners(){const {user}=React.useContext(window.UserContext);useDashboardDataRevisions();useEffect(()=>{const stops=['requirements','uniforms','excludedDays'].map(name=>subscribeSchoolCatalogue(client,name,user));return()=>stops.forEach(stop=>stop());},[user.id]);return null;}
function Data(){const req=useRequirements(),uni=useUniforms(),days=useExcludedDays();
const filtered=useRequirementsByFilter({gender:'male',classId:'class-a',section:'Day'});
const uf=useUniformsByFilter({gender:'male',classId:'class-a',section:'Day'});
return <>{Object.entries({requirements:req,uniforms:uni,excludedDays:days}).map(([name,q])=><section key={name}>
<h2>{name}</h2><output data-testid={name}>{q.data===undefined?q.error?'Error':'Loading':q.data.map(item=>item.name||item.id).join(',')||'Empty'}</output>
<CatalogueDataNotice label={name} saved={q.isSavedData} refreshing={q.isFetching} error={q.error} hasData={q.data!==undefined} retry={q.refetch}/></section>)}
<output data-testid="filtered">{filtered.data===undefined?'Loading':filtered.data.length}</output><output data-testid="filtered-uniforms">{uf.data===undefined?'Loading':uf.data.length}</output></>}
function Fixture(){const [user,setUser]=useState({id:'first',role:'Admin',isActive:true});const [selected,setSelected]=useState(false);const [epoch,setEpoch]=useState(0);
localStorage.setItem('trinity_user',JSON.stringify({user}));
window.fixture={scope:()=>workspaceCacheAccessScope(user),grant:()=>rememberVerifiedWorkspaceAccess(user),
switchUser:()=>{clearSavedWorkspaceAccess();window.mockAuth.currentUser={uid:'second',isAnonymous:false};setUser({id:'second',role:'Admin',isActive:true});},
seed:async(name,data)=>{rememberVerifiedWorkspaceAccess(user);await writePersistentCollection(persistentCollectionCacheKey('trinity-family-schools',name,workspaceCacheAccessScope(user)),data,workspaceCacheAccessScope(user),true);},
disk:name=>readPersistentCollectionWithMetadata(persistentCollectionCacheKey('trinity-family-schools',name,workspaceCacheAccessScope(user))),
invalidate:name=>client.invalidateQueries({queryKey:[name]}),
lateRead:name=>client.getQueryData(catalogueKey(name,workspaceCacheAccessScope(user))),
remount:()=>setEpoch(value=>value+1),
reconnect:()=>{onlineManager.setOnline(false);onlineManager.setOnline(true);window.dispatchEvent(new Event('online'));},
deny:name=>window.pending.find(read=>read.name===name&&!read.done)?.fail(Object.assign(new Error('Denied'),{code:'permission-denied'}))};
return <QueryClientProvider client={client}><window.UserContext.Provider value={{user,isAuthenticated:true}}><GlobalOwners/><Data key={epoch}/><button onClick={()=>setSelected(!selected)}>Select pupil</button><h1>{selected?'Pupil selected':'Dashboard'}</h1></window.UserContext.Provider></QueryClientProvider>}
createRoot(document.getElementById('app')).render(<Fixture/>);`;
  const mocks = new Map([
    ['src/lib/contexts/auth-context', 'import {useContext} from "react";export const useAuth=()=>useContext(window.UserContext);'],
    ['src/lib/firebase', 'export const auth=window.mockAuth;export const db={};'],
    ['src/lib/services/pupil-snapshots.service', 'export const PupilSnapshotsService={};'],
    ['src/lib/services/school-settings.service', 'export const SchoolSettingsService={};'],
    ['firebase/firestore', 'export const doc=(_,collection,id)=>({name:id});export const onSnapshot=(ref,options,next)=>window.subscribeRevision(ref,next);'],
  ]);
  for (const [name, service, method] of [['requirements', 'RequirementsService', 'getAllRequirements'], ['uniforms', 'UniformsService', 'getAllUniforms'], ['excludedDays', 'ExcludedDaysService', 'getAllExcludedDays']]) {
    const file = name === 'excludedDays' ? 'excluded-days' : name;
    mocks.set('src/lib/services/' + file + '.service', 'export const ' + service + '={' + method + ':()=>window.readServer("' + name + '")};');
  }
  await esbuild.build({ absWorkingDir: root, stdin: { contents, resolveDir: root, loader: 'tsx' }, bundle: true, jsx: 'automatic', platform: 'browser', outfile: path.join(output, 'fixture.js'),
    alias: { '@': path.join(root, 'src') }, define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID': 'undefined' },
    plugins: [{ name: 'external-boundaries', setup(build) {
      build.onResolve({ filter: /.*/ }, args => {
        const key = args.path.startsWith('@/') ? args.path.replace(/^@\//, 'src/') : args.path.startsWith('.') ? path.relative(root, path.resolve(path.dirname(args.importer), args.path)).replaceAll('\\', '/') : args.path;
        if (mocks.has(key)) return { path: key, namespace: 'boundary' };
      });
      build.onLoad({ filter: /.*/, namespace: 'boundary' }, args => ({ contents: mocks.get(args.path), loader: 'js', resolveDir: root }));
    } }],
  });
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', req.url === '/fixture.js' ? 'text/javascript' : 'text/html');
    res.end(req.url === '/fixture.js' ? fs.readFileSync(path.join(output, 'fixture.js')) : '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="app"></div><script src="/fixture.js"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: process.env.THEME_BROWSER_CHANNEL || 'chrome', headless: true });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const ready = new Promise(resolve => window.restoreAuth = () => { window.mockAuth.currentUser = { uid: 'first', isAnonymous: false }; resolve(); });
      window.mockAuth = { currentUser: null, authStateReady: () => ready };
      window.revisionListeners=[];window.revisions={requirements:1,uniforms:1,excludedDays:1};
      const snapshot=ref=>({metadata:{fromCache:false},exists:()=>true,data:()=>ref.name==='data-revisions-reference'?{...window.revisions,legacyCompatibility:false}:ref.name==='school-settings'?{dataRevisions:window.revisions}:{}});
      window.subscribeRevision=(ref,next)=>{const listener={ref,next,active:true};window.revisionListeners.push(listener);ready.then(()=>{if(listener.active)next(snapshot(ref));});return()=>listener.active=false;};
      window.emitRevision=(name,value)=>{window.revisions[name]=value;window.revisionListeners.filter(l=>l.active&&l.ref.name==='data-revisions-reference').forEach(l=>l.next(snapshot(l.ref)));};
      window.pending = [];
      window.readServer = name => new Promise((resolve, reject) => {
        const read = { name, done: false, finish(data) { read.done = true; resolve(data); }, fail(error) { read.done = true; reject(error); } };
        window.pending.push(read);
      });
      window.item = name => ({ id: name, name, group: 'Books', isActive: true, gender: 'all', classType: 'all', sectionType: 'all' });
      window.respond = (name, data) => window.pending.find(read => read.name === name && !read.done).finish(data);
    });
    const url = 'http://127.0.0.1:' + server.address().port;
    await page.goto(url);
    assert.equal(await page.getByTestId('requirements').textContent(), 'Loading', 'Missing cache is not a confirmed empty list');
    await page.evaluate(async () => {
      await window.fixture.seed('requirements', [window.item('Saved books')]);
      await window.fixture.seed('uniforms', [window.item('Saved shirt')]);
      await window.fixture.seed('excludedDays', []);
    });
    await page.reload();
    await page.waitForFunction(() => document.querySelector('[data-testid="requirements"]').textContent === 'Saved books');
    assert.equal(await page.getByTestId('uniforms').textContent(), 'Saved shirt');
    assert.equal(await page.getByTestId('excludedDays').textContent(), 'Empty');
    assert.equal(await page.evaluate(() => window.pending.length), 0, 'Cached viewing never starts protected reads before identity');
    await page.getByRole('button', { name: 'Select pupil' }).click();
    await page.getByRole('heading', { name: 'Pupil selected' }).waitFor();
    await page.evaluate(() => window.restoreAuth());
    await page.waitForFunction(() => window.pending.length === 3);
    await page.evaluate(() => {
      window.respond('requirements', []);
      window.respond('uniforms', [window.item('Current shirt')]);
      window.respond('excludedDays', [{ id: 'Current holiday' }]);
    });
    await page.waitForFunction(() => document.querySelector('[data-testid="requirements"]').textContent === 'Empty');
    assert.equal(await page.getByTestId('filtered').textContent(), '0', 'A filtered empty result is valid');
    assert.equal(await page.getByTestId('uniforms').textContent(), 'Current shirt');
    await page.waitForFunction(async () => (await window.fixture.disk('uniforms'))?.data.data[0]?.name === 'Current shirt');

    // Neither an unchanged reconnect nor repeated page/filtered mounts downloads catalogues.
    await page.evaluate(()=>{window.fixture.reconnect();window.fixture.remount();});await page.waitForTimeout(200);
    assert.equal(await page.evaluate(()=>window.pending.length),3);
    await page.evaluate(()=>window.fixture.remount());await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.pending.length),3);
    // One changed catalogue refreshes once for all open/filtered/background consumers.
    await page.evaluate(()=>window.emitRevision('uniforms',2));await page.waitForFunction(()=>window.pending.length===4);
    assert.equal(await page.evaluate(()=>window.pending[3].name),'uniforms');
    await page.evaluate(()=>window.respond('uniforms',[window.item('Changed shirt')]));
    await page.waitForFunction(()=>document.querySelector('[data-testid="uniforms"]').textContent==='Changed shirt');
    await page.waitForFunction(async()=>(await window.fixture.disk('uniforms'))?.data.revision===2);
    // A fresh JS session restores matching saved revisions without protected downloads.
    await page.reload();await page.waitForFunction(()=>window.fixture);await page.evaluate(()=>{window.revisions.uniforms=2;window.restoreAuth();});
    await page.waitForFunction(()=>document.querySelector('[data-testid="uniforms"]').textContent==='Changed shirt');
    await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.pending.length),0);
    await page.evaluate(()=>window.emitRevision('pupils',900));await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.pending.length),0);
    // Offline changes are discovered by the revision listener after reconnect, then recover a transient failure.
    await page.evaluate(()=>window.emitRevision('requirements',2));await page.waitForFunction(()=>window.pending.length===1);
    await page.evaluate(()=>window.pending[0].fail(new Error('Temporary failure')));
    await page.waitForFunction(()=>document.querySelector('[data-testid="requirements"]').textContent==='Empty');
    await page.waitForTimeout(7500); // Existing bounded query retries finish; no successful cache is discarded.
    await page.evaluate(()=>window.pending.filter(r=>!r.done).forEach(r=>r.fail(new Error('Temporary failure'))));
    await page.waitForTimeout(2500);
    await page.evaluate(()=>window.pending.filter(r=>!r.done).forEach(r=>r.fail(new Error('Temporary failure'))));
    await page.getByRole('button',{name:'Retry',exact:true}).first().waitFor();
    const before=await page.evaluate(()=>window.pending.length);await page.evaluate(()=>window.fixture.reconnect());
    await page.waitForFunction(n=>window.pending.length>n,before);
    await page.evaluate(()=>window.respond('requirements',[window.item('Changed books')]));
    await page.waitForFunction(()=>document.querySelector('[data-testid="requirements"]').textContent==='Changed books');
    assert.equal(await page.getByTestId('filtered').textContent(),'1');
    assert.ok((await page.evaluate(()=>window.pending.map(r=>r.name))).every(name=>name==='requirements'));
    // Module denial removes saved records and account replacement cannot expose them.
    await page.evaluate(()=>window.emitRevision('uniforms',3));await page.waitForFunction(()=>window.pending.some(r=>r.name==='uniforms'&&!r.done));
    await page.evaluate(()=>window.fixture.deny('uniforms'));await page.waitForFunction(()=>document.querySelector('[data-testid="uniforms"]').textContent==='Error');
    assert.ok(!(await page.locator('body').innerText()).includes('Changed shirt'));
    const oldCount=await page.evaluate(()=>window.pending.length);await page.evaluate(()=>window.fixture.switchUser());
    await page.waitForFunction(n=>window.pending.length===n+3,oldCount);
    assert.equal(await page.getByTestId('uniforms').textContent(),'Loading');
    await page.evaluate(()=>['requirements','uniforms','excludedDays'].forEach(name=>window.respond(name,[])));
    await page.waitForFunction(()=>document.querySelector('[data-testid="uniforms"]').textContent==='Empty');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ savedBeforeIdentity: true, realIndexedDb: true, confirmedEmpty: true, filteredOwnerDedup: true, noMountReads: true, noHealthyReconnectReads: true, changedRevisionOnly: true, matchingRestartNoReads: true, failureRecovery: true, accountIsolation: true, deniedAccess: true, errors }, null, 2));
    console.log('SCHOOL_CATALOGUES_BROWSER_OK: saved records before identity, server replacement, real IndexedDB, confirmed empty, one shared filtered owner, no unchanged mount/reconnect/restart reads, changed revisions, recovery and account/access isolation.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
