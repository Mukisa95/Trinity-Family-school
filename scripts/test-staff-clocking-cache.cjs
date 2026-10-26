const assert = require('node:assert/strict');
const http = require('node:http');
const { build } = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

async function main() {
  const fixture = `
    import React, {useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import {QueryClient, QueryClientProvider, useQuery, useQueryClient} from '@tanstack/react-query';
    import {useStaffClockingBootstrap, useStaffClockingSchedules, useStaffClockingDailyRecords, useOwnStaffClockingDashboard, useOwnStaffClockingNotifications} from './src/lib/hooks/use-staff-clocking';
    const client = new QueryClient({defaultOptions:{queries:{retry:false}}});
    function Record(){const a=useStaffClockingSchedules();const b=useStaffClockingDailyRecords({from:'2026-10-25',to:'2026-10-25'});return <p>{a.data && b.data?'Record ready':'Loading record'}</p>}
    function Clock(){const a=useOwnStaffClockingDashboard(true);const b=useOwnStaffClockingNotifications(true);return <p>{a.data && b.data?'Clock ready':'Loading clock'}</p>}
    function Records(){const [query,setQuery]=useState('');const a=useStaffClockingDailyRecords({from:'2026-10-25',to:'2026-10-25',query});return <><input aria-label="Search" value={query} onChange={e=>setQuery(e.target.value)}/><p>{a.data?'Records ready':'Loading records'}</p></>}
    function App(){const a=useStaffClockingBootstrap();const [page,setPage]=useState('Record');window.__setRevision=(key,value)=>client.setQueryData(['cache-test-revisions'],old=>({...old,[key]:value}));return <><p>{a.data?'Bootstrap ready':'Loading bootstrap'}</p>{['Record','Clock','Records','Away'].map(name=><button key={name} onClick={()=>setPage(name)}>{name}</button>)}{page==='Record'?<Record/>:page==='Clock'?<Clock/>:page==='Records'?<Records/>:null}</>}
    createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><App/></QueryClientProvider>);
  `;
  const result = await build({
    stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"', 'process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID': '"cache-test"' },
    plugins: [{ name: 'clocking-cache-fixtures', setup(builder) {
      builder.onResolve({ filter: /^(?:@\/lib\/firebase|@\/lib\/access\/scoped-firestore|@\/lib\/contexts\/auth-context|\.\/use-school-settings)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ resolveDir: process.cwd(), contents: args.path.endsWith('auth-context')
        ? 'export const useAuth=()=>({isAuthenticated:true,user:{id:globalThis.__cacheActor||"cache-user",staffId:"staff-one",role:"Admin"}});'
        : args.path.endsWith('firebase') ? 'export const db={}; export const auth={get currentUser(){return {uid:globalThis.__cacheActor||"cache-user",getIdToken:async()=>"cache-test-only"}}};'
        : args.path.endsWith('scoped-firestore') ? `const watchers=new Map();const values=new Map();globalThis.__listenerCount=0;export const doc=(_db,_collection,id)=>({id});export const onSnapshot=(ref,_options,next)=>{globalThis.__listenerCount++;let set=watchers.get(ref.id)||new Set();set.add(next);watchers.set(ref.id,set);const emit=value=>({exists:()=>true,data:()=>value,metadata:{fromCache:false}});queueMicrotask(()=>next(emit(values.get(ref.id)||{})));globalThis.__personalRevision=(id,value)=>{values.set(id,value);watchers.get(id)?.forEach(fn=>fn(emit(value)));};return()=>{globalThis.__listenerCount--;set.delete(next);};};`
        : `import {useQuery} from '@tanstack/react-query'; export const useDashboardDataRevisions=()=>useQuery({queryKey:['cache-test-revisions'],enabled:false,initialData:{staffClockingConfig:0,staffClockingRecords:0,staffClockingRequests:0,staffClockingNotifications:0,staff:0,events:0}});` }));
    } }],
  });
  const server = http.createServer((req, res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(result.outputFiles[0].contents); }
    else { res.setHeader('Content-Type', 'text/html'); res.end('<html><body><div id="root"></div><script src="/bundle.js"></script></body></html>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH} : {})});
    const page = await browser.newPage();
    await page.clock.install({ time: new Date('2026-10-25T10:00:00Z') });
    const calls = [];
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/staff-clocking/**', async route => {
      const url = new URL(route.request().url());
      const pathname = url.pathname;
      calls.push(pathname + url.search);
      const data = pathname.endsWith('/records') ? {records:[{id:'one',staffId:'staff-one',staffName:'Ada Staff',status:'open',localDate:'2026-10-25'}],summary:{total:1,complete:0,open:1,late:0,exempted:0,corrected:0}}
        : pathname.endsWith('/schedules') ? {schedules:[]} : pathname.endsWith('/bootstrap') ? {feature:{enabled:true},access:{canClock:true}} : pathname.endsWith('/notifications') ? {notifications:[]} : {localDate:'2026-10-25',staff:{id:'staff-one',name:'Ada Staff'},schedule:{kind:'scheduled'},history:[]};
      await route.fulfill({json:{success:true,result:data}});
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByText('Record ready',{exact:true}).waitFor();
    await page.getByText('Bootstrap ready',{exact:true}).waitFor();
    assert.equal(calls.length,3);
    await page.getByRole('button',{name:'Clock',exact:true}).click();
    await page.getByText('Clock ready',{exact:true}).waitFor();
    assert.equal(calls.length,7);
    assert.equal(await page.evaluate(()=>window.__listenerCount),1,'Personal parts and notifications must share one listener');
    await page.getByRole('button',{name:'Records',exact:true}).click();
    await page.getByText('Records ready',{exact:true}).waitFor();
    await page.getByRole('textbox',{name:'Search'}).fill('Ada');
    await page.getByRole('button',{name:'Away',exact:true}).click();
    await page.getByRole('button',{name:'Record',exact:true}).click();
    await page.getByText('Record ready',{exact:true}).waitFor();
    assert.equal(calls.length,7,'Navigation and local search must reuse the same period');
    await page.clock.fastForward(120_000);
    await page.getByRole('button',{name:'Away',exact:true}).click();
    await page.getByRole('button',{name:'Record',exact:true}).click();
    await page.getByText('Record ready',{exact:true}).waitFor();
    assert.equal(calls.length,7,'The former 15/30/60 second expiry must not cause a read');
    await page.reload();
    await page.getByText('Record ready',{exact:true}).waitFor();
    await page.getByText('Bootstrap ready',{exact:true}).waitFor();
    assert.equal(calls.length,7,'A fresh QueryClient must restore the persistent cache');
    await page.evaluate(()=>window.__setRevision('staffClockingRecords',1));
    await page.getByText('Record ready',{exact:true}).waitFor();
    await page.waitForTimeout(100);
    assert.equal(calls.length,8,'An attendance change must refresh records only');
    assert.equal(calls.filter(path=>path.endsWith('/bootstrap')).length,1);
    assert.equal(calls.filter(path=>path.endsWith('/schedules')).length,1);
    await page.getByRole('button',{name:'Clock',exact:true}).click();
    await page.getByText('Clock ready',{exact:true}).waitFor();
    assert.equal(calls.length,8,'Another staff scan must not reload any personal dashboard part');
    await page.evaluate(()=>window.__setRevision('staffClockingNotifications',1));
    await page.getByRole('button',{name:'Away',exact:true}).click();
    await page.getByRole('button',{name:'Clock',exact:true}).click();
    await page.getByText('Clock ready',{exact:true}).waitFor();
    assert.equal(calls.length,8,'An unrelated notification must not reload attendance');
    await page.evaluate(()=>window.__personalRevision('staff-two',{dates:{'2026-10-25':1}}));
    await page.waitForTimeout(100);
    assert.equal(calls.length,8,'Another teacher revision must not trigger any request');
    await page.evaluate(()=>window.__personalRevision('staff-one',{dates:{'2026-10-25':1}}));
    await page.waitForTimeout(100);
    assert.equal(calls.length,9,'Own scan must reload only today status');
    assert.ok(calls.at(-1).endsWith('part=status'));
    await page.evaluate(()=>window.__personalRevision('staff-one',{dates:{'2026-10-25':1,'2026-10-24':1}}));
    await page.waitForTimeout(100);
    assert.equal(calls.length,10,'Earlier correction must reload history only');
    assert.ok(calls.at(-1).endsWith('part=history'));
    await page.evaluate(()=>window.__personalRevision('staff-one',{dates:{'2026-10-25':1,'2026-10-24':1},notifications:1}));
    await page.waitForTimeout(100);
    assert.equal(calls.length,11,'Own notice must not reread schedule, status or history');
    assert.ok(calls.at(-1).endsWith('/notifications'));
    await page.clock.setSystemTime(new Date('2026-10-26T00:01:00Z'));
    await page.clock.fastForward(30_000);
    await page.getByText('Clock ready',{exact:true}).waitFor();
    assert.equal(calls.length,14,'A new school day needs schedule/status/history for the new date');
    await page.evaluate(()=>{window.__cacheActor='another-account';});
    await page.getByRole('button',{name:'Record',exact:true}).click();
    await page.getByText('Record ready',{exact:true}).waitFor();
    await page.getByText('Bootstrap ready',{exact:true}).waitFor();
    assert.equal(calls.length,17,'Another account must receive its own authorised responses');
    await page.evaluate(()=>{window.__cacheActor='cache-user';});
    await page.getByRole('button',{name:'Clock',exact:true}).click();
    await page.getByText('Clock ready',{exact:true}).waitFor();
    assert.equal(calls.length,17,'Returning to the original account must reuse only that account cache');
    assert.deepEqual(errors,[]);
    console.log('PASS persistent reload/navigation, one personal listener, other-staff isolation, independent status/history/notification refresh, day rollover and account separation');
  } finally { await browser?.close(); await new Promise(resolve=>server.close(resolve)); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
