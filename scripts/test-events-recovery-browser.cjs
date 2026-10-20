/* Synthetic event states exercise the actual calendar's recovery rendering. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const mocks={
  '@fullcalendar/react':`import React,{forwardRef,useImperativeHandle}from'react';export default forwardRef(({events},ref)=>{useImperativeHandle(ref,()=>({getApi:()=>({changeView(){}})}),[]);return <section aria-label='Calendar'>{events.map(e=><div key={e.id}>{e.title}</div>)}</section>});`,
  '@/lib/hooks/use-events-fixed':`export const useEvents=()=>window.eventState;export const useCreateEvent=()=>({}),useUpdateEvent=()=>({}),useDeleteEvent=()=>({}),useExamsAsEvents=()=>({data:[]}),useAcademicYearsForEvents=()=>({data:[]}),useCurrentTerm=()=>null;`,
  '@/lib/hooks/use-classes':'export const useClasses=()=>({data:[]});',
  '@/lib/hooks/use-subjects':'export const useSubjects=()=>({data:[]});',
  '@/lib/hooks/use-uganda-holidays':'export const useUgandaHolidays=()=>({data:[]});',
  '@/lib/hooks/use-academic-years':'export const useActiveAcademicYear=()=>({});',
  '@/lib/contexts/auth-context':'export const useAuth=()=>({user:{id:"fixture",role:"Admin"}});',
  '@/lib/contexts/navigation-context':'export const useNavigation=()=>({goBack(){},startNavigation(){}});',
  'next/link':`import React from'react';export default({children,...props})=><a {...props}>{children}</a>;`,
  'next/navigation':'export const useRouter=()=>({push(){}});export const usePathname=()=>"/events";',
  '../forms/event-form':'export const EventForm=()=>null;',
  '../ui/event-details-modal':'export const EventDetailsModal=()=>null;',
  '../ui/event-filters':'export const EventFilters=()=>null;',
  '../ui/color-legend':'export const ColorLegend=()=>null;',
  '../ui/events-list':'export const EventsList=()=>null;',
};
async function run(){
const built=await require('esbuild').build({stdin:{resolveDir:root,loader:'tsx',contents:`import React,{useState}from'react';import{createRoot}from'react-dom/client';import{CalendarWrapper}from'./src/components/events/calendar/calendar-wrapper';
window.retryCalls=0;window.eventState={data:[{id:'saved',title:'Saved sports day',isAllDay:true,startDate:'2026-10-14',endDate:'2026-10-14',type:'Co-curricular',isPublic:true,status:'Scheduled'}],error:Error('Synthetic outage'),isFetching:false,refetch:()=>{window.retryCalls++}};
function App(){const[tick,setTick]=useState(0);window.rerender=()=>setTick(x=>x+1);return <CalendarWrapper defaultView="month" showFilters={false} showLegend={false}/>};createRoot(document.getElementById('root')).render(<App/>);`},bundle:true,loader:{'.css':'empty'},format:'iife',platform:'browser',jsx:'automatic',write:false,alias:{'@':path.join(root,'src')},define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'boundaries',setup(build){build.onResolve({filter:/.*/},args=>{if(args.path.startsWith('@fullcalendar/')&&args.path!=='@fullcalendar/react')return{path:'plugin',namespace:'mock'};const key=mocks[args.path]?args.path:Object.keys(mocks).find(k=>k.startsWith('@/')&&k.split('/').pop()===args.path.split('/').pop());return key?{path:key,namespace:'mock'}:undefined;});build.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:args.path==='plugin'?'export default{};':mocks[args.path],loader:'tsx',resolveDir:root}));}}]});
const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?built.outputFiles[0].text:'<div id="root"></div><script src="/fixture.js"></script>');});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
try{const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.getByRole('region',{name:'Calendar'}).getByText('Saved sports day').waitFor();await page.getByRole('button',{name:'Month',exact:true}).waitFor();await page.getByText('Showing saved calendar events. Updates will retry when connected.').waitFor();assert.equal(await page.getByText('Unable to Load Events').count(),0);await page.getByRole('button',{name:'Retry',exact:true}).click();assert.equal(await page.evaluate(()=>retryCalls),1);
await page.evaluate(()=>{eventState={...eventState,error:null};rerender()});await page.getByRole('status').waitFor({state:'detached'});await page.getByRole('region',{name:'Calendar'}).getByText('Saved sports day').waitFor();
await page.evaluate(()=>{eventState={...eventState,data:undefined,error:Error('Cold outage')};rerender()});await page.getByText('Unable to Load Events').waitFor();assert.equal(await page.getByRole('region',{name:'Calendar'}).count(),0);await page.getByRole('button',{name:'Try Again',exact:true}).click();assert.equal(await page.evaluate(()=>retryCalls),2,'Retry does not reload the app');assert.deepEqual(errors,[]);console.log('EVENTS_RECOVERY_BROWSER_OK: saved calendar and controls survive refresh failure; healthy state quiet; cold failure retries without reloading.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(error=>{console.error(error);process.exitCode=1});
