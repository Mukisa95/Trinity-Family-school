/* Synthetic events: exercise the real hook with controlled collection reads. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/event-revisions-qa');
const mocks = {
  '@/lib/firebase': 'export const db={};',
  '@/lib/hooks/use-academic-years': 'export const useAcademicYears=()=>({data:[]});export const useAcademicNow=()=>new Date();',
  '@/lib/hooks/use-classes': 'export const useClasses=()=>({data:[]});',
  '@/lib/hooks/use-subjects': 'export const useSubjects=()=>({data:[]});',
  '@/lib/hooks/use-exams': 'export const useExams=()=>({data:[]});',
  '@/lib/services/dashboard-cache-revisions.service': 'export const bumpExamDefinitionRevisionsInBatch=()=>{},bumpEventsRevisionInBatch=()=>{};',
  '@/lib/contexts/auth-context': 'export function useAuth(){return {user:window.fixtureUser,isAuthenticated:true}}',
  '@/lib/hooks/use-school-settings': `import {useQuery} from '@tanstack/react-query';export function useDashboardDataRevisions(){return useQuery({queryKey:['dashboardDataRevisions'],enabled:false,staleTime:Infinity});}`,
  'firebase/firestore': `export const collection=()=>({}),query=(...args)=>args,orderBy=()=>({}),where=(...args)=>({where:args});
    export async function getDocsFromServer(q){const request={q,revision:window.client.getQueryData(['dashboardDataRevisions']).events};window.requests.push(request);if(window.hold)await new Promise(resolve=>window.release=resolve);if(window.fail)throw Error('Synthetic outage');return {docs:[{id:'e',data:()=>({title:'Revision '+request.revision,isPublic:true,startDate:'2026-10-14'})},{id:'private',data:()=>({title:'Staff only',isPublic:false,startDate:'2026-10-14'})}]};}
    export const getDocs=getDocsFromServer,doc=()=>({}),getDoc=()=>({}),serverTimestamp=()=>null,writeBatch=()=>({});`,
};
async function run() {
  fs.mkdirSync(output, { recursive: true });
  const contents = `import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider,onlineManager}from'@tanstack/react-query';
    import{useEvents}from'./src/lib/hooks/use-events-fixed';import{getEventCacheScope,writeEventCache,readEventCache}from'./src/lib/cache/event-cache';
    window.fixtureUser={id:'calendar-admin',role:'Admin'};window.requests=[];window.hold=false;window.fail=false;
    window.scope=getEventCacheScope('calendar-admin','Admin');writeEventCache(window.scope,1,[{id:'e',title:'Saved revision 1',isPublic:true,startDate:'2026-10-14'}]);
    window.readSaved=()=>readEventCache(window.scope);window.client=new QueryClient({defaultOptions:{queries:{retryDelay:25}}});window.revise=events=>window.client.setQueryData(['dashboardDataRevisions'],{events});window.revise(1);
    window.goOnline=value=>onlineManager.setOnline(value);
    function View({name,filters}){const q=useEvents(filters);return <section id={name} data-fetching={q.isFetching} data-error={!!q.error}>{q.data?.map(e=><div key={e.id}>{e.title}</div>)}</section>}
    function App(){const[shown,setShown]=useState(true),[tick,setTick]=useState(0);window.setShown=setShown;window.rerender=()=>setTick(x=>x+1);return <QueryClientProvider client={window.client}>{shown&&<><View name='calendar'/><View name='filtered' filters={{searchTerm:'revision'}}/></>}</QueryClientProvider>}
    createRoot(document.getElementById('root')).render(<App/>);`;
  const built = await require('esbuild').build({stdin:{contents,resolveDir:root,loader:'tsx'},bundle:true,platform:'browser',format:'iife',jsx:'automatic',write:false,
    define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID':'"trinity-family-schools"'},
    plugins:[{name:'boundaries',setup(build){build.onResolve({filter:/.*/},args=>{const key=mocks[args.path]?args.path:Object.keys(mocks).find(k=>k.startsWith('@')&&k.split('/').pop()===args.path.split('/').pop());return key?{path:key,namespace:'mock'}:undefined;});build.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js',resolveDir:root}));}}]});
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?built.outputFiles[0].text:'<div id="root"></div><script src="/fixture.js"></script>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
  try {
    const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
    await page.locator('#calendar').getByText('Saved revision 1').waitFor();assert.equal(await page.evaluate(()=>requests.length),0);
    for(let i=0;i<3;i++){await page.evaluate(()=>setShown(false));await page.locator('#calendar').waitFor({state:'detached'});await page.evaluate(()=>setShown(true));await page.locator('#calendar').getByText('Saved revision 1').waitFor();}
    await page.evaluate(()=>{goOnline(false);goOnline(true);window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('online'));});await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>requests.length),0,'Unchanged revision is read-free on remount/reconnect');
    await page.evaluate(()=>{hold=true;revise(2)});await page.waitForFunction(()=>requests.length===1);await page.evaluate(()=>revise(3));assert.equal(await page.evaluate(()=>requests.length),1,'Two views join the pending read');
    await page.evaluate(()=>{hold=false;release()});await page.locator('#calendar').getByText('Revision 3',{exact:true}).waitFor();assert.deepEqual(await page.evaluate(()=>requests.map(r=>r.revision)),[2,3]);assert.equal(await page.evaluate(()=>readSaved().revision),3,'An update during a request is reconciled');
    await page.evaluate(()=>{fail=true;revise(4)});await page.waitForFunction(()=>document.querySelector('#calendar')?.dataset.error==='true');assert.equal(await page.evaluate(()=>requests.length),4,'One bounded retry for the failed revision');await page.locator('#calendar').getByText('Revision 3',{exact:true}).waitFor();await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>requests.length),4,'Failure cannot loop indefinitely');
    await page.evaluate(()=>{fail=false;goOnline(false);goOnline(true)});await page.locator('#calendar').getByText('Revision 4',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>requests.length),5);
    await page.evaluate(()=>{window.storageSet=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw Error('Quota')};revise(5)});await page.locator('#calendar').getByText('Revision 5',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>requests.length),6);await page.evaluate(()=>{setShown(false);Storage.prototype.setItem=window.storageSet});await page.locator('#calendar').waitFor({state:'detached'});await page.evaluate(()=>setShown(true));await page.locator('#calendar').getByText('Revision 5',{exact:true}).waitFor();await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>requests.length),6,'RAM revision remains valid after persistence fails');
    await page.evaluate(()=>{fixtureUser={id:'calendar-parent',role:'Parent',familyId:'family'};hold=true;rerender()});await page.waitForFunction(()=>requests.length===7);assert.equal(await page.locator('#calendar').getByText('Revision 5',{exact:true}).count(),0,'Account switch never shows another scope');await page.evaluate(()=>{hold=false;release()});await page.locator('#calendar').getByText('Revision 5',{exact:true}).waitFor();assert.equal(await page.locator('#calendar').getByText('Staff only').count(),0);assert.ok(await page.evaluate(()=>requests.at(-1).q.some(arg=>arg.where?.[0]==='isPublic')),'Parent query is public-only');
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({warmReads:0,midReadRevisionCaught:true,boundedErrorRecovery:true,persistenceFailureKeepsRamCache:true,accountScopeProtected:true,parentPublicOnly:true,errors},null,2));
    console.log('EVENT_REVISIONS_BROWSER_OK: no warm mount/reconnect reads, shared revision reads, mid-request updates, bounded failure recovery and account isolation.');
  } finally { await browser.close();await new Promise(resolve=>server.close(resolve)); }
}
run().catch(error=>{console.error(error);process.exitCode=1});
