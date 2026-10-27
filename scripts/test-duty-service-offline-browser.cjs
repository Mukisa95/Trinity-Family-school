/* Synthetic records only; real query/cache/timeline code, no hosted school or login. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/duty-offline-qa');
fs.mkdirSync(output, {recursive:true});
const fixture = {
  leadershipTerms:[{id:'term',termName:'Third term leadership',startDate:'2026-09-01',isActive:true,academicYearId:'2026'}],
  prefectoralPosts:[{id:'post',postName:'Head Prefect',positionOfHonour:1,isActive:true}],
  postAssignments:[{id:'prefect',postId:'post',pupilId:'pupil',leadershipTermId:'term',isActive:true}],
  dutyRotas:[{id:'rota',dutyName:'School supervision',startDate:'2026-10-26',endDate:'2026-11-08',frequency:'weekly',isActive:true,academicYearId:'2026',teamsInvolved:['staff'],allowances:{staff:0,pupils:0,prefects:0}}],
  dutyAssignments:[{id:'assignment',rotaId:'rota',memberId:'teacher',memberType:'staff',startDate:'2026-10-26',endDate:'2026-11-01',isActive:true,isSupervisor:true,service:'Morning supervision'}],
  polls:[], performanceRankings:[],
};
const mocks = {
  '@/lib/firebase': `export const firebaseProjectId='trinity-family-schools'; export const db={}; export const auth={currentUser:{uid:'account',getIdToken:async()=> 'fixture'}};`,
  '@/lib/contexts/auth-context': `import {useSyncExternalStore} from 'react'; const subscribe=f=>{window.addEventListener('fixture-change',f);return()=>window.removeEventListener('fixture-change',f)}; export function useAuth(){const user=useSyncExternalStore(subscribe,()=>window.fixtureUser);return {user,isAuthenticated:!!user,isLoading:false}}`,
  '@/lib/hooks/use-school-settings': `import {useSyncExternalStore} from 'react'; const subscribe=f=>{window.addEventListener('fixture-change',f);return()=>window.removeEventListener('fixture-change',f)}; export function useDashboardDataRevisions(){const revision=useSyncExternalStore(subscribe,()=>window.fixtureRevision);return {data:{dutyService:revision}}} export function useDashboardRevisionReadiness(){return true}`,
  '@/hooks/use-toast': `export function useToast(){return {toast(){}}}`,
  '@/lib/services/digital-signature.service': `export function useDigitalSignature(){return {createSignature:async()=>{}}}`,
  './dashboard-cache-revisions.service': `export function bumpDutyServiceRevisionInBatch(batch){batch.bump=true}`,
  '@/lib/access/scoped-firestore': `
    export const collection=(db,name)=>({name});export const doc=(...args)=>({id:'created',name:args[1]});
    export async function getDocsFromServer(ref){window.sourceReads.push(ref.name);if(window.failSource===ref.name)throw Error('Fixture connection failed');return {docs:window.sourceData[ref.name].map(row=>({id:row.id,data:()=>({...row,createdAt:{toDate:()=>new Date('2026-10-27')}})}))}}
    export const getDocs=getDocsFromServer;export const getDoc=async()=>({exists:()=>false});
    export const query=(ref)=>ref;export const where=()=>null;export const orderBy=()=>null;export const serverTimestamp=()=>null;
    export class Timestamp{};export const limit=()=>null;export const startAfter=()=>null;
    export function writeBatch(){const batch={set(){window.writeCalls++},update(){window.writeCalls++},delete(){window.writeCalls++},commit:async()=>{window.commits.push({bump:batch.bump})}};return batch}
  `,
};
async function run() {
  await require('esbuild').build({absWorkingDir:root,stdin:{resolveDir:root,loader:'tsx',contents:`
    import React from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
    import {useDutyServiceData} from './src/lib/hooks/use-duty-service-data';
    import {useDutyRotas,useDutyAssignments,useLeadershipTerms,usePostAssignments,usePrefectoralPosts,useDutyTimeline,usePolls,usePerformanceRankings} from './src/lib/hooks/use-duty-service';
    import {DutyServiceService} from './src/lib/services/duty-service.service';
    import {DutyService} from './src/android-offline/duty-service';
    import {DutyOnlineAction} from './src/components/duty-service/DutyOnlineAction';
    import {readRevisionedDomainCache,getDomainCacheScope} from './src/lib/cache/revisioned-domain-cache';
    import {dutyServiceCacheName} from './src/lib/duty-service/contracts';
    import {setCircumferenceUser} from './src/lib/access/circumference-session';
    import {exportAndroidCachedSnapshot} from './src/lib/offline/android-cache-export';
    import {writePersistentCollection} from './src/lib/cache/persistent-collection-cache';
    import {writeStaffCache,getStaffCacheScope} from './src/lib/cache/staff-cache';
    import {writeAcademicYearCache,getAcademicYearCacheScope} from './src/lib/cache/academic-year-cache';
    import {writeClassCache,getClassCacheScope} from './src/lib/cache/class-cache';
    window.exportDuty=async()=>{const user=window.fixtureUser;await writePersistentCollection('trinity-family-schools::pupils::user:'+user.id,[{id:'pupil',firstName:'Example',lastName:'Prefect',classId:'p4',className:'P.4',medicalConditions:'private'}]);writeStaffCache(getStaffCacheScope(user.id,user.role),1,[{id:'teacher',firstName:'Teacher',lastName:'Example',phone:'private'}]);writeAcademicYearCache(getAcademicYearCacheScope(user.id,user.role),1,[{id:'2026',name:'2026',terms:[]}]);writeClassCache(getClassCacheScope(user.id,user.role),1,[{id:'p4',name:'P.4'}]);return exportAndroidCachedSnapshot({accountId:user.id,role:user.role,pupilIds:[],grants:{dashboard:false,pupils:false,timetable:false,dutyService:true,dutyServiceCacheName:dutyServiceCacheName(user),pupilFields:[],dashboardCounts:[]}})};

    const client=new QueryClient({defaultOptions:{queries:{retry:false}}});window.queryClient=client;
    window.setUser=user=>{window.fixtureUser=user;setCircumferenceUser(user);window.dispatchEvent(new Event('fixture-change'))};
    window.setRevision=value=>{window.fixtureRevision=value;window.dispatchEvent(new Event('fixture-change'))};
    window.setOffline=value=>{Object.defineProperty(navigator,'onLine',{configurable:true,value:!value});window.dispatchEvent(new Event(value?'offline':'online'))};
    window.readSaved=()=>readRevisionedDomainCache(dutyServiceCacheName(window.fixtureUser),getDomainCacheScope(window.fixtureUser.id,window.fixtureUser.role));
    window.writeDuty=()=>DutyServiceService.createPrefectoralPost({postName:'New post',positionOfHonour:2,isActive:true});
    function App(){const q=useDutyServiceData();const r=useDutyRotas();const a=useDutyAssignments();useLeadershipTerms();usePostAssignments();usePrefectoralPosts();usePolls();usePerformanceRankings();const timeline=useDutyTimeline('rota');
      const data=q.data;const snapshot={datasets:{dutyService:data?{preparedAt:'2026-10-27',data:{...data,staff:[{id:'teacher',name:'Teacher Example'}],pupils:[{id:'pupil',name:'Prefect Example',className:'P.4'}]}}:undefined,academicYears:{data:[{id:'2026',name:'2026'}]}}};
      return <><p id="state">{data?'saved':q.isLoading?'loading':'missing'}</p><p id="rotas">{r.data?.map(x=>x.dutyName).join(',')}</p><p id="assignment-count">{a.data?.length}</p><p id="period-count">{timeline.data?.periods.length}</p><DutyOnlineAction><button>Make changes</button></DutyOnlineAction>{data&&<DutyService snapshot={snapshot}/>}</>}
    const el=document.getElementById('root');let renderer=createRoot(el);const render=()=>renderer.render(<QueryClientProvider client={client}><App/></QueryClientProvider>);window.remount=()=>{renderer.unmount();renderer=createRoot(el);render()};render();
  `},bundle:true,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID':'"trinity-family-schools"'},alias:{'@':path.join(root,'src')},outfile:path.join(output,'test.js'),plugins:[{name:'offline-fixture',setup(build){build.onResolve({filter:/.*/},args=>{const key=Object.keys(mocks).find(key=>key===args.path||key.split('/').pop()===args.path.split('/').pop());return key?{path:key,namespace:'fixture'}:undefined});build.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:mocks[args.path],loader:'js',resolveDir:root}));}}]});
  const server=http.createServer((req,res)=>{if(req.url==='/fixture-sw.js'){res.setHeader('Content-Type','text/javascript');res.end("self.addEventListener('install',e=>e.waitUntil(caches.open('fixture').then(c=>c.addAll(['/','/test.js']))));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));");return}res.setHeader('Content-Type',req.url==='/test.js'?'text/javascript':'text/html');res.end(req.url==='/test.js'?fs.readFileSync(path.join(output,'test.js')):'<div id="root"></div><script src="/test.js"></script>')});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||undefined,channel:process.env.PLAYWRIGHT_EXECUTABLE_PATH?undefined:'msedge',headless:true});
  try {
    const context=await browser.newContext({viewport:{width:375,height:812}});const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await context.addInitScript(data=>{window.fixtureUser={id:'account',role:'Staff',isActive:true,username:'Fixture',modulePermissions:[{module:'duty_service',permission:'full_access'}]};window.fixtureRevision=1;window.sourceReads=[];window.sourceData=data;window.writeCalls=0;window.commits=[];},fixture);
    const url=`http://127.0.0.1:${server.address().port}`;
    await page.goto(url);await page.locator('#state').filter({hasText:'saved'}).waitFor();assert.equal(await page.evaluate(()=>sourceReads.length),7);
    await page.waitForFunction(()=>document.getElementById('period-count').textContent==='2');
    const exported=await page.evaluate(()=>exportDuty());assert.deepEqual(exported.datasets.dutyService.data.staff,[{id:'teacher',name:'Teacher Example'}]);assert.equal(JSON.stringify(exported).includes('private'),false);assert.equal(exported.datasets.dutyService.data.dutyAssignments.length,1);assert.equal(exported.datasets.pupils,undefined);
    await page.evaluate(()=>{remount();window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('online'))});await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>sourceReads.length),7);
    await page.evaluate(()=>setOffline(true));assert.equal(await page.getByRole('button',{name:'Make changes'}).count(),0);
    const rejection=await page.evaluate(async()=>{try{await writeDuty();return ''}catch(error){return error.message}});assert.match(rejection,/Connect to save/);assert.equal(await page.evaluate(()=>writeCalls),0);
    await page.evaluate(async()=>{await navigator.serviceWorker.register('/fixture-sw.js');await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}))});await context.setOffline(true);await page.reload();await page.locator('#state').filter({hasText:'saved'}).waitFor();assert.equal(await page.evaluate(()=>sourceReads.length),0);
    await page.getByRole('button',{name:'View timeline',exact:true}).click();await page.getByRole('heading',{name:'Week 1',exact:true}).waitFor();await page.getByText('Morning supervision',{exact:true}).waitFor();await page.getByText('Teacher Example',{exact:true}).first().waitFor();
    await page.getByRole('tab',{name:'Prefectoral',exact:true}).click();await page.getByText('Prefect Example',{exact:true}).waitFor();await page.getByLabel('Leadership term',{exact:true}).selectOption('term');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(output,'offline-prefects-mobile.png'),fullPage:true});
    await context.setOffline(false);await page.evaluate(()=>setOffline(false));await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>sourceReads.length),0);
    await page.evaluate(()=>{sourceData.dutyRotas[0].dutyName='Updated supervision';setRevision(2)});await page.locator('#rotas').filter({hasText:'Updated supervision'}).waitFor();assert.equal(await page.evaluate(()=>sourceReads.length),7);
    await page.evaluate(()=>{failSource='dutyAssignments';setRevision(3)});await page.waitForTimeout(500);assert.match(await page.locator('#rotas').innerText(),/Updated supervision/);assert.equal(await page.evaluate(async()=>(await readSaved()).revision),'duty:2');
    await page.evaluate(()=>{failSource=null;setRevision(4)});await page.waitForFunction(async()=> (await readSaved())?.revision==='duty:4');
    await page.evaluate(async()=>{await writeDuty()});assert.deepEqual(await page.evaluate(()=>commits),[{bump:true}]);
    await page.evaluate(()=>{setOffline(true);setUser({...fixtureUser,modulePermissions:[]})});await page.locator('#state').filter({hasText:'missing'}).waitFor();assert.equal(await page.getByText('Prefect Example',{exact:true}).count(),0);
    await page.evaluate(()=>{setOffline(true);setUser({id:'different-account',role:'Admin',isActive:true})});await page.locator('#state').filter({hasText:'missing'}).waitFor();assert.equal(await page.getByText('Prefect Example',{exact:true}).count(),0);
    assert.deepEqual(errors,[]);await context.close();
    console.log('DUTY_OFFLINE_BROWSER_OK: seven collections shared once, warm mounts/reconnect no reads, real IndexedDB offline reload, timeline/prefects at 375px, online revision refresh, failed refresh retention, atomic revision writes, offline write guard, account isolation.');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve))}
}
run().catch(error=>{console.error(error);process.exitCode=1});
