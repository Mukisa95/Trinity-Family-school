// Real Pupils route, canonical usePupils/useSearchPupils/useClasses observers and
// permissions. Hold only management code; database reads are forbidden.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/cached-pupils-list-qa');

async function run() {
  fs.mkdirSync(output, { recursive: true });
  const contents = `
import React,{createContext,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import PupilsPage from './src/app/pupils/page';
import {usePupils,useSearchPupils,pupilsKeys} from './src/lib/hooks/use-pupils';
import {classesKeys} from './src/lib/hooks/use-classes';
import {getClassCacheScope} from './src/lib/cache/class-cache';
window.Auth=createContext(null);window.dbReads=0;window.navRequests=[];
window.client=new QueryClient({defaultOptions:{queries:{retry:false}}});
window.seed=Array.from({length:76},(_,i)=>({id:'p'+i,firstName:'Alice',lastName:'Pupil '+String(i).padStart(2,'0'),admissionNumber:'PIN-'+i,classId:i%2?'c2':'c1',className:i%2?'P.2':'P.1',status:'Active',gender:i%2?'Female':'Male',section:'Day'}));
window.publish=data=>window.client.setQueryData(pupilsKeys.lists(),data);
window.publish(window.seed);window.setHydration=value=>window.client.setQueryData(['pupils','hydration'],value);window.setHydration('saved');
window.client.setQueryData(classesKeys.list(getClassCacheScope('admin','Admin')),[{id:'c1',name:'P.1',code:'P1'},{id:'c2',name:'P.2',code:'P2'}]);
function OtherConsumers(){const list=usePupils(),search=useSearchPupils('Alice');return <aside id='other-consumers' data-total={list.data?.length??'missing'} data-search={search.data.length}/>;}
function ManagementFixture(){return <div id='management-ready'>Management tools ready</div>;}
window.loadManagement=()=>new Promise((resolve,reject)=>{window.releaseTools=()=>resolve({default:ManagementFixture});window.failTools=()=>reject(Error('Offline management chunk'));});
function App(){const [user,setUser]=useState({id:'admin',role:'Admin'});window.setUser=setUser;
return <window.Auth.Provider value={{user,isAuthenticated:!!user,isSignedIdentityReady:false,isLoading:false}}><QueryClientProvider client={window.client}><OtherConsumers/><PupilsPage/></QueryClientProvider></window.Auth.Provider>;}
createRoot(document.getElementById('root')).render(<App/>);`;
  const mocks = {
    './pupils-management': `export default ()=>null;`,
    'next/link': `import React from 'react';export default function Link({href,onClick,children,prefetch,...props}){return <a {...props} href={href} onClick={e=>{onClick?.(e);e.preventDefault();}}>{children}</a>;}`,
    '@/lib/contexts/auth-context': `import {useContext} from 'react';export const useAuth=()=>useContext(window.Auth);`,
    '../contexts/auth-context': `import {useContext} from 'react';export const useAuth=()=>useContext(window.Auth);`,
    '@/lib/contexts/navigation-context': `export const useNavigation=()=>({goBack:href=>window.navRequests.push(href),startNavigation:(_name,href)=>window.navRequests.push(href)});`,
    '../services/pupils.service': `export const PupilsService=new Proxy({}, {get:()=>()=>{window.dbReads++;throw Error('Unexpected pupil database read');}});`,
    '../services/classes.service': `export const ClassesService=new Proxy({}, {get:()=>()=>{window.dbReads++;throw Error('Unexpected class database read');}});`,
    './use-digital-signature': `export const useDigitalSignatureHelpers=()=>({});`,
  };
  const built = await esbuild.build({
    stdin: { contents, loader: 'tsx', resolveDir: root }, bundle: true, format: 'iife',
    platform: 'browser', jsx: 'automatic', write: false,
    define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID': '"trinity-family-schools"' },
    plugins: [{ name: 'boundaries', setup(build) {
      build.onResolve({ filter: /.*/ }, args => Object.hasOwn(mocks, args.path) ? { path: args.path, namespace: 'mock' } : undefined);
      build.onLoad({filter:/[\\/]pupils[\\/]page\.tsx$/},args=>({contents:fs.readFileSync(args.path,'utf8').replace("import('./pupils-management')",'window.loadManagement()'),loader:'tsx'}));
      build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'tsx', resolveDir: root }));
    } }],
  });
  const cssDir = path.join(root, '.next/static/css');
  const css = fs.readdirSync(cssDir).filter(file => file.endsWith('.css')).map(file => fs.readFileSync(path.join(cssDir, file), 'utf8')).join('\n');
  const server = http.createServer((request, response) => {
    response.setHeader('Content-Type', request.url === '/fixture.js' ? 'text/javascript' : request.url === '/styles.css' ? 'text/css' : 'text/html');
    response.end(request.url === '/fixture.js' ? built.outputFiles[0].text : request.url === '/styles.css' ? css
      : '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><div id="root"></div><script src="/fixture.js"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/pupils`);
    await page.locator('[data-cached-pupils-list]').waitFor();
    assert.equal(await page.locator('tbody tr').count(), 50, 'Only the first batch mounts');
    assert.equal(await page.locator('#other-consumers').getAttribute('data-total'), '76');
    assert.equal(await page.locator('#other-consumers').getAttribute('data-search'), '76');
    assert.equal(await page.getByRole('status').count(), 0, 'Ready cache cannot show a loading card');
    assert.equal(await page.locator('[inert]').count(), 0);
    await page.getByRole('button', { name: 'Show more pupils' }).click();
    assert.equal(await page.locator('tbody tr').count(), 76);
    await page.getByLabel('Class', { exact: true }).selectOption('c1');
    assert.equal(await page.locator('tbody tr').count(), 38);
    await page.getByLabel('Search pupils').fill('Pupil 04');
    assert.equal(await page.locator('tbody tr').count(), 1);
    assert.equal(await page.evaluate(() => new URLSearchParams(location.search).get('q')), 'Pupil 04');
    await page.getByRole('link', { name: 'Pupil 04 Alice' }).click();
    assert.deepEqual(await page.evaluate(() => window.navRequests), ['/pupil-detail?id=p4']);
    await page.getByRole('link', { name: 'Pupil 04 Alice' }).click({modifiers:['Control']});
    assert.deepEqual(await page.evaluate(() => window.navRequests), ['/pupil-detail?id=p4'], 'Opening a new tab must not start an in-app loading wait');
    await page.screenshot({ path: path.join(output, 'mobile-light.png') });
    await page.getByLabel('Search pupils').fill('');
    await page.getByLabel('Class', { exact: true }).selectOption('');
    // A single upstream cache update reaches the list, global search, and the
    // other consumer, even before Firebase's signed identity finishes restoring.
    await page.evaluate(() => window.publish([{ ...window.seed[0], lastName: 'Changed' }]));
    await page.getByRole('link', { name: 'Changed Alice' }).waitFor();
    assert.equal(await page.locator('#other-consumers').getAttribute('data-total'), '1');
    assert.equal(await page.locator('#other-consumers').getAttribute('data-search'), '1');
    assert.equal(await page.evaluate(() => window.dbReads), 0);
    await page.evaluate(() => window.setHydration('denied'));
    await page.getByRole('alert').waitFor();
    assert.equal(await page.locator('tbody tr').count(), 0, 'Denied data cannot leak');
    await page.evaluate(() => window.setHydration('loading'));
    await page.getByRole('status').waitFor();
    assert.equal(await page.locator('tbody tr').count(), 0, 'An account transition cannot reveal the old cache');
    await page.evaluate(() => { window.publish([]); window.setHydration('ready'); });
    await page.getByText('No pupils match these filters.').waitFor();
    assert.equal(await page.getByRole('status').count(), 0, 'An authorized empty snapshot is ready');
    await page.evaluate(() => { window.publish(window.seed); window.setUser({ id: 'parent', role: 'Parent' }); });
    await page.getByText('Pupil access is unavailable.').waitFor();
    assert.equal(await page.locator('tbody tr').count(), 0);
    await page.evaluate(() => window.setUser({ id: 'staff', role: 'Staff', granularPermissions: [{ moduleId: 'pupils', pages: [{ pageId: 'list', canAccess: true, actions: [] }] }] }));
    await page.locator('tbody tr').first().waitFor();
    assert.equal(await page.getByLabel('Search pupils').count(), 0);
    assert.equal(await page.locator('tbody a').count(), 0, 'A page grant cannot bypass action/detail grants');
    await page.evaluate(() => { window.setUser({ id: 'admin', role: 'Admin' }); document.documentElement.classList.add('dark'); });
    await page.setViewportSize({ width: 320, height: 640 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, 'mobile-dark-320.png') });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: path.join(output, 'desktop-dark.png') });
    await page.evaluate(() => window.failTools());
    await page.getByRole('button', {name:'Retry management tools'}).waitFor();
    assert.equal(await page.locator('tbody tr').count(),50,'An offline management chunk failure must leave cached records usable');
    assert.equal(await page.locator('[data-cached-pupils-list][data-route-content-pending]').count(),0,'Failed code loading must release native preparation without hiding records');
    await page.getByRole('button', {name:'Retry management tools'}).click();
    await page.evaluate(() => window.releaseTools());
    await page.locator('#management-ready').waitFor();
    assert.equal(await page.evaluate(() => window.dbReads), 0);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ canonicalCacheShared: true, unsignedIdentityDoesNotBlockSavedData: true, zeroDatabaseReads: true, readyRowsInteractive: true, classAndSearchImmediate: true, denialAndAccountTransitionProtected: true, emptyReady: true, actionGrantsPreserved: true, managementChunkFailureKeepsCacheVisible: true, errors }, null, 2));
    console.log('Cached pupils shared-pipeline browser checks passed.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
