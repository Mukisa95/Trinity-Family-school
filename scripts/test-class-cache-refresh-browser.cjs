/* Real class bootstrap/selectors/cache with a synthetic database boundary. */
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');

const mocks = {
  '@/lib/contexts/auth-context': `export const useAuth=()=>({user:window.identity,isAuthenticated:!!window.identity});`,
  '@/lib/hooks/use-school-settings': `export const useDashboardDataRevisions=()=>({data:{classes:window.revision}});`,
  '@/lib/hooks/use-digital-signature': `export const useDigitalSignatureHelpers=()=>({});`,
  '@/lib/startup/workspace-auth': `export const withWorkspaceIdentity=async(id,read)=>read();`,
  '@/lib/startup/workspace-setup': `export const registerWorkspaceRecovery=(q,s,k,fn)=>{window.recover=fn;return()=>{}};export const reportWorkspaceTask=(q,s,k,state)=>{window.taskState=state};`,
  '@/lib/services/classes.service': `export const ClassesService={hydrateSharedClasses(data){window.shared=data},clearSharedClasses(){window.shared=null},getAllFromFirestoreCache:async()=>[],refreshSharedClasses:load=>load(),getAllForCache:async()=>{window.reads++;if(window.fail)throw Error('Synthetic outage');return new Promise(resolve=>window.finishRead=()=>resolve(structuredClone(window.serverClasses)))}};`,
};

async function run() {
  const built = await require('esbuild').build({
    stdin: { resolveDir: root, loader: 'tsx', contents: `
      import React,{useState}from'react';import{createRoot}from'react-dom/client';
      import{QueryClient,QueryClientProvider}from'@tanstack/react-query';
      import{useClassCacheBootstrap}from'./src/lib/hooks/use-class-cache-bootstrap';
      import{useClasses}from'./src/lib/hooks/use-classes';
      import{getClassCacheScope,writeClassCache,readClassCache}from'./src/lib/cache/class-cache';
      import{getPupilClassDisplay}from'./src/lib/utils/class-streams';
      window.identity={id:'admin',role:'Admin'};window.revision=7;window.reads=0;
      const oldClass={id:'p7',name:'Primary Seven',code:'P.7',order:7,streams:[{id:'a',name:'Old A',code:'A'}]};
      window.serverClasses=[{...oldClass,streams:[{id:'a',name:'Corrected A',code:'A'}]}];
      writeClassCache(getClassCacheScope('admin','Admin'),7,[oldClass]);
      window.snapshot=()=>readClassCache(getClassCacheScope(window.identity.id,window.identity.role));
      const queryClient=new QueryClient();
      function Owner(){useClassCacheBootstrap();return null}
      function Viewer(){const{data}=useClasses();const cls=data?.[0];return <p>{cls?getPupilClassDisplay({classId:'p7',streamId:'a',streamName:'Old A',streamClassId:'p7'},cls).name:'No classes'}</p>}
      function App(){const[tick,setTick]=useState(0),[owner,setOwner]=useState(true);window.rerender=()=>setTick(x=>x+1);window.setOwner=setOwner;return <QueryClientProvider client={queryClient}>{owner&&<Owner/>}<Viewer/><Viewer/></QueryClientProvider>}
      createRoot(document.getElementById('root')).render(<App/>);
    ` },
    bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false,
    alias: { '@': path.join(root, 'src') },
    define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID': '"fixture"' },
    plugins: [{ name: 'boundaries', setup(build) {
      build.onResolve({ filter: /.*/ }, args => {
        const resolved = args.path.startsWith('.') ? path.resolve(args.resolveDir, args.path) : '';
        const key = mocks[args.path] ? args.path : Object.keys(mocks).find(k => resolved === path.join(root, 'src', k.slice(2)));
        return key ? { path: key, namespace: 'mock' } : undefined;
      });
      build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'tsx', resolveDir: root }));
    } }],
  });
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', req.url === '/fixture.js' ? 'text/javascript' : 'text/html');
    res.end(req.url === '/fixture.js' ? built.outputFiles[0].text : '<div id="root"></div><script src="/fixture.js"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install();
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForFunction(() => window.reads === 1);
    assert.equal(await page.getByText('Primary Seven Old A', { exact: true }).count(), 2, 'Warm data remains visible during server verification');
    await page.evaluate(() => finishRead());
    await page.getByText('Primary Seven Corrected A', { exact: true }).first().waitFor();
    assert.equal(await page.evaluate(() => snapshot().data[0].streams[0].name), 'Corrected A');
    assert.equal(await page.evaluate(() => shared[0].streams[0].name), 'Corrected A');
    await page.evaluate(() => { rerender(); window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); });
    assert.equal(await page.evaluate(() => reads), 1, 'Consumers, rerenders and immediate focus share the read');

    await page.clock.fastForward(61_000);
    await page.evaluate(() => { serverClasses[0].streams[0].name='Renamed while away'; window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction(() => reads === 2).catch(async error => { console.error(await page.evaluate(() => ({reads, taskState, visibility:document.visibilityState,online:navigator.onLine}))); throw error; });
    await page.evaluate(() => finishRead());
    await page.getByText('Primary Seven Renamed while away', { exact: true }).first().waitFor();
    await page.clock.fastForward(1_100);
    await page.evaluate(() => { serverClasses[0].streams[0].name='Renamed offline'; window.dispatchEvent(new Event('online')); });
    await page.waitForFunction(() => reads === 3);
    await page.evaluate(() => finishRead());
    await page.getByText('Primary Seven Renamed offline', { exact: true }).first().waitFor();

    await page.evaluate(() => { fail=true; recover(); });
    await page.waitForFunction(() => taskState === 'error');
    await page.clock.fastForward(3_100);
    await page.clock.fastForward(3_100);
    await page.waitForFunction(() => reads === 6);
    assert.equal(await page.getByText('Primary Seven Renamed offline', { exact: true }).count(), 2, 'Failed reconciliation preserves warm labels');
    assert.equal(await page.evaluate(() => snapshot().data[0].streams[0].name), 'Renamed offline');
    await page.clock.fastForward(1_100);
    await page.evaluate(() => { fail=false; serverClasses[0].streams[0].name='Recovered'; window.dispatchEvent(new Event('online')); });
    await page.waitForFunction(() => reads === 7);
    await page.evaluate(() => finishRead());
    await page.getByText('Primary Seven Recovered', { exact: true }).first().waitFor();

    await page.clock.fastForward(5 * 60_000);
    await page.waitForFunction(() => reads === 8);
    await page.evaluate(() => finishRead());
    await page.waitForFunction(() => taskState === 'ready');
    await page.evaluate(() => { revision++; rerender(); });
    await page.waitForFunction(() => reads === 9);
    await page.evaluate(() => finishRead());
    await page.waitForFunction(() => snapshot().revision === 8);

    await page.evaluate(() => setOwner(false));
    await page.clock.fastForward(5 * 60_000);
    assert.equal(await page.evaluate(() => reads), 9, 'Unmount cleans the visible-tab timer');
    await page.evaluate(() => setOwner(true));
    await page.waitForFunction(() => reads === 10);
    await page.evaluate(() => finishRead());
    await page.waitForFunction(() => taskState === 'ready');
    await page.evaluate(() => { identity={id:'different-admin',role:'Admin'}; serverClasses=[]; rerender(); });
    await page.waitForFunction(() => reads === 11);
    await page.getByText('No classes', { exact: true }).first().waitFor();
    await page.evaluate(() => finishRead());
    await page.waitForFunction(() => snapshot()?.data.length === 0);
    assert.deepEqual(errors, []);
    console.log('CLASS_CACHE_REFRESH_BROWSER_OK: unchanged revisions recover console renames; warm paint, shared cache, focus coalescing, reconnect, bounded retry, periodic check, revision sync, cleanup and identity isolation passed.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
