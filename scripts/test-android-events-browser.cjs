/* Synthetic events only: real scoped cache export, calendar query and packaged UI. */
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'), output=path.join(root,'output/android-events-qa'); fs.mkdirSync(output,{recursive:true});
const common={absWorkingDir:root,bundle:true,platform:'browser',alias:{'@':path.join(root,'src')},define:{'process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID':'"trinity-family-schools"','process.env.NODE_ENV':'"production"'}};
require('esbuild').buildSync({...common,stdin:{contents:`export {exportAndroidCachedSnapshot} from './src/lib/offline/android-cache-export'; export * from './src/lib/cache/event-cache';`,resolveDir:root,loader:'ts'},format:'iife',globalName:'EventsCache',outfile:path.join(output,'cache.js')});
const mocks={
  '@/lib/firebase':'export const db={};',
  '@/lib/hooks/use-academic-years':'export const useAcademicYears=()=>({data:[]});export const useAcademicNow=()=>new Date();',
  '@/lib/hooks/use-classes':'export const useClasses=()=>({data:[]});',
  '@/lib/hooks/use-subjects':'export const useSubjects=()=>({data:[]});',
  '@/lib/hooks/use-exams':'export const useExams=()=>({data:[]});',
  '@/lib/services/dashboard-cache-revisions.service':'export const bumpExamDefinitionRevisionsInBatch=()=>{},bumpEventsRevisionInBatch=()=>{};',
  '@/lib/contexts/auth-context':'export function useAuth(){return {user:window.fixtureUser,isAuthenticated:true}}',
  '@/lib/hooks/use-school-settings':"import{useQuery}from'@tanstack/react-query';export function useDashboardDataRevisions(){return useQuery({queryKey:['dashboardDataRevisions'],enabled:false,staleTime:Infinity})}",
  'firebase/firestore':`export const collection=()=>({}),query=()=>({}),orderBy=()=>({}),where=()=>({}); export async function getDocsFromServer(){window.eventReads++;return {docs:window.serverEvents.map(event=>({id:event.id,data:()=>event}))}} export const getDocs=getDocsFromServer; export const doc=()=>({}), getDoc=()=>({}),serverTimestamp=()=>null,writeBatch=()=>({});`,
};
(async()=>{
await require('esbuild').build({...common,jsx:'automatic',stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{useEvents}from'./src/lib/hooks/use-events-fixed';function View(){const{data}=useEvents();return <div id="calendar-events">{data?.map(e=><div key={e.id}>{e.title}</div>)}</div>}const root=createRoot(document.getElementById('root'));const client=new QueryClient();client.setQueryData(['dashboardDataRevisions'],{events:2});window.renderCalendar=()=>root.render(<QueryClientProvider client={client}><View /></QueryClientProvider>);window.renderCalendar();`,resolveDir:root,loader:'tsx'},outfile:path.join(output,'query.js'),plugins:[{name:'service-fixtures',setup(build){build.onResolve({filter:/.*/},args=>{const key=mocks[args.path]?args.path:Object.keys(mocks).find(key=>key.startsWith('@') && key.split('/').pop()===args.path.split('/').pop());return key?{path:key,namespace:'mock'}:undefined;});build.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js',resolveDir:root}));}}]});
const assets=path.join(root,'android-app/app/src/main/assets/offline');
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;let file=pathname==='/cache.js'?path.join(output,'cache.js'):pathname==='/query.js'?path.join(output,'query.js'):path.join(assets,pathname==='/events'? 'index.html':pathname.slice(1));res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');try{res.end(fs.readFileSync(file))}catch{res.end('<div id="root"></div>')}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true});
try{
const context=await browser.newContext({viewport:{width:375,height:812}}),page=await context.newPage();await page.goto(origin+'/fixture');await page.addScriptTag({url:'/cache.js'});
const snapshot=await page.evaluate(async()=>{
window.fixtureUser={id:'events-a',role:'Admin'};window.eventReads=0;window.TrinityOffline={postMessage(){}};window.trinityAndroidConnected=false;
const scope=EventsCache.getEventCacheScope('events-a','Admin');const event={id:'a',title:'Sports day',status:'Scheduled',type:'Co-curricular',startDate:'2026-10-16',endDate:'2026-10-17',startTime:'09:00',endTime:'15:00',isAllDay:false,location:'School field',description:'Family sports',isPublic:true,createdBy:'private-author',actualAttendees:['private-attendee']};window.serverEvents=[{...event,title:'Updated sports day'}];
EventsCache.writeEventCache(scope,1,[event]); EventsCache.writeEventCache(EventsCache.getEventCacheScope('other','Admin'),1,[{...event,id:'private',title:'Other account'}]);
window.fixtureSession={schema:1,accountId:'events-a',role:'Admin',displayName:'Example',timeZone:'Africa/Kampala',issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),pupilIds:[],grants:{dashboard:false,pupils:false,timetable:false,events:true,eventCacheScope:scope,pupilFields:[],dashboardCounts:[]}};
return await EventsCache.exportAndroidCachedSnapshot(window.fixtureSession);
});
assert.equal(snapshot.datasets.events.data.length,1);assert.equal(snapshot.datasets.events.data[0].title,'Sports day');assert.equal('actualAttendees' in snapshot.datasets.events.data[0],false);assert.equal('createdBy' in snapshot.datasets.events.data[0],false);
await page.addScriptTag({url:'/query.js'});await page.getByText('Sports day',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>eventReads),0);
await page.evaluate(()=>{window.trinityAndroidConnected=true;window.dispatchEvent(new Event('trinity-android-connectivity'))});await page.getByText('Updated sports day',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>eventReads),1);
await context.addInitScript(({snapshot})=>{window.TrinityOffline={postMessage(raw){const request=JSON.parse(raw);const result=request.action==='status'?{available:true}:request.action==='unlock'?{session:window.testSession,snapshot}:{};queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({...result,id:request.id,success:true})}))}};window.testSession={schema:1,accountId:'events-a',role:'Admin',displayName:'Example',grants:{events:true}};},{snapshot});
await page.goto(origin+'/events?page=events');await page.getByRole('button',{name:'Unlock',exact:true}).click();await page.getByRole('heading',{name:'Sports day',exact:true}).waitFor();
await context.setOffline(true);await page.getByLabel('Calendar date').fill('2026-10-17');await page.getByRole('heading',{name:'Sports day',exact:true}).waitFor();await page.getByLabel('Calendar date').fill('2026-10-18');await page.getByText('No events match this date or search.').waitFor();await page.getByRole('button',{name:'Show all events',exact:true}).click();await page.getByLabel('Search events').fill('field');await page.getByRole('heading',{name:'Sports day',exact:true}).waitFor();await page.screenshot({path:path.join(output,'offline-events-mobile.png'),fullPage:true});
console.log('ANDROID_EVENTS_BROWSER_OK: account-scoped export, no offline server reads, automatic reconciliation, offline date/search/details.');
}finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
