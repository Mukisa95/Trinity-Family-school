const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { build } = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const fixture = `
export const role = new URLSearchParams(location.search).get('role') || 'teacher';
export const state = new URLSearchParams(location.search).get('state') || 'normal';
export const user = {id:new URLSearchParams(location.search).get('uid')||'user',username:'sarah',firstName:'Sarah',role:role==='admin'?'Admin':'Staff',staffId:role==='unlinked'?undefined:'sarah',isActive:true,modulePermissions:[{module:'reports',permission:'view_only'},{module:'attendance',permission:'edit'}]};
export const staff=[{id:'sarah',firstName:'Sarah',lastName:'Namuli',department:['Teaching'],role:role==='dos'?['DIRECTOR OF STUDIES']:['TEACHER'],status:'active',gender:'Female'},{id:'peter',firstName:'Peter',lastName:'Kato',department:['Teaching'],role:['TEACHER'],status:'active',gender:'Male'}];
export const classes=[{id:'p4',name:'Primary Four',code:'P.4',order:4,classTeacherId:'sarah',subjectAssignments:[{subjectId:'math',teacherIds:['sarah']}]},{id:'p5',name:'Primary Five',code:'P.5',order:5,classTeacherId:'peter',subjectAssignments:[{subjectId:'math',teacherIds:['sarah']},{subjectId:'science',teacherIds:['peter']}]},{id:'p6',name:'Primary Six',code:'P.6',order:6,classTeacherId:'peter',subjectAssignments:[]}];
const classCount=Number(new URLSearchParams(location.search).get('classes')||2);
if(classCount===1)classes[1].subjectAssignments=[{subjectId:'math',teacherIds:['peter']}];
if(classCount>=3)classes[2].subjectAssignments=[{subjectId:'english',teacherIds:['sarah']}];
if(classCount>=4)classes.push({id:'p7',name:'Primary Seven',code:'P.7',order:7,classTeacherId:'peter',subjectAssignments:[{subjectId:'math',teacherIds:['sarah']}]});
export const subjects=[{id:'math',name:'Mathematics',code:'MATH'},{id:'science',name:'Science',code:'SCI'},{id:'english',name:'English',code:'ENG'}];
export const term={id:'term',name:'Term Three',startDate:'2026-09-01',endDate:'2026-12-15',isCurrent:true};
export const years=[{id:'year',name:'2026',startDate:'2026-01-01',endDate:'2026-12-31',isActive:true,terms:[term]}];
export const profiles=[{id:'table',name:'Primary timetable',classIds:['p4','p5','p6'],academicYearId:'year',termId:'term',activeDays:[1,2,3,4,5]}];
export const periods=[{id:'now',dayOfWeek:2,periodNumber:3,type:'lesson',startTime:'10:00',endTime:'10:40'},{id:'next',dayOfWeek:2,periodNumber:4,type:'lesson',startTime:'11:20',endTime:'12:00'},{id:'later',dayOfWeek:2,periodNumber:5,type:'lesson',startTime:'14:00',endTime:'14:40'}];
const allEntries=[{id:'p4now',classId:'p4',periodId:'now',subjectId:'math',teacherId:'sarah'},{id:'p5now',classId:'p5',periodId:'now',subjectId:'science',teacherId:'peter'},{id:'p6now',classId:'p6',periodId:'now',subjectId:'english',teacherId:'peter'},{id:'p5next',classId:'p5',periodId:'next',subjectId:'math',teacherId:'sarah'},{id:'p4later',classId:'p4',periodId:'later',subjectId:'science',teacherId:'sarah'}];
export let entries=new URLSearchParams(location.search).get('lessons')==='none'?allEntries.filter(item=>item.teacherId!=='sarah'):allEntries;
window.__setTeacherLessons=available=>{entries=available?allEntries:allEntries.filter(item=>item.teacherId!=='sarah');window.dispatchEvent(new Event('fixture-timetable-change'));};
export const pupils=Array.from({length:9},(_,i)=>({id:'pupil'+i,firstName:'Pupil',lastName:String(i),classId:i<4?'p4':i<7?'p5':'p6',status:'Active',gender:i%2?'Male':'Female',section:'Day'}));
export const records=pupils.filter((_,i)=>i!==3).map((p,i)=>({pupilId:p.id,classId:p.classId,status:i===2?'Absent':'Present',recordedAt:'2026-10-27T07:00:00Z'}));
export const attendanceData={records,present:7,absent:1,late:0,delayed:0,total:8,byClass:[]};
export const events=state.startsWith('exam')?[{id:'event',title:'P.4 Mathematics examination',classIds:['p4'],subjectIds:['math'],startDate:'2026-10-27',endDate:'2026-10-27',startTime:state==='exam-future'?'11:00':'10:00',endTime:state==='exam-future'?'12:00':'11:00',isAllDay:false,isExamEvent:true,type:'Academic',status:'Scheduled',requiresApproval:false}]:[];
export const stats={totalPupils:9,malePupils:4,femalePupils:5,totalStaff:2,totalClasses:3,presentToday:7,absentToday:1,lateToday:0,delayedToday:0,attendanceTotal:8};
export const q=data=>({data,isLoading:false,isPending:false,isError:false,error:null,refetch:async()=>{}});
export const mutation=()=>({mutateAsync:async()=>{},isPending:false});
export const dashboard=()=>({...q(),pupils,staff,classes,attendanceData,stats,photos:[],schoolSettings:{generalInfo:{name:'TRINITY FAMILY SCHOOL',motto:'Guiding growth'}},today:'2026-10-27',pupilsLoading:false,staffLoading:false,classesLoading:false,attendanceLoading:false,hasError:false,refetchAll:async()=>{}});
`;
const sources = {
  'revision-firestore-fixture': `
    const observers=new Map();const params=new URLSearchParams(location.search);let confirmed=!params.has('revision-wait');let pending=false;
    const documents={'settings/data-revisions-reference':{staff:0,legacyCompatibility:false},'settings/data-revisions-operational':{dutyService:0,staffClockingPolicy:params.get('state')==='clocking-off'?1:0,staffClockingEnabled:params.get('state')==='clocking-off'?false:undefined,dashboardStaffClockingRecords:0,staffClockingStaff:{sarah:0}}};
    export const doc=(db,collection,id)=>({path:collection+'/'+id});
    const snapshot=path=>({exists:()=>Object.hasOwn(documents,path),data:()=>documents[path],metadata:{fromCache:!confirmed,hasPendingWrites:pending}});
    export function onSnapshot(ref,options,callback){const callbacks=observers.get(ref.path)||new Set();callbacks.add(callback);observers.set(ref.path,callbacks);queueMicrotask(()=>{if(callbacks.has(callback))callback(snapshot(ref.path))});return()=>callbacks.delete(callback);}
    const emit=path=>(observers.get(path)||[]).forEach(callback=>callback(snapshot(path)));
    window.__publishOperational=(changes,uncommitted=false)=>{documents['settings/data-revisions-operational']={...documents['settings/data-revisions-operational'],...changes};pending=uncommitted;emit('settings/data-revisions-operational');pending=false;};
    window.__confirmRevisions=()=>{confirmed=true;emit('settings/data-revisions-reference');emit('settings/data-revisions-operational');};
  `,
  'revision-settings-service-fixture': `export const SchoolSettingsService={getSchoolSettings:async()=>null,getSchoolSettingsFromServer:async()=>null,updateSchoolSettings:async()=>{}};`,
  'next/navigation': `export const useRouter=()=>({push:path=>(window.__routes ||= []).push(path),replace:()=>{}}); export const useSearchParams=()=>new URLSearchParams(location.search);`,
  'next/link': `import React from 'react'; export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}`,
  'next/head': `export default function Head(){return null}`,
  '@/lib/contexts/auth-context': `import {user} from 'dashboard-fixture'; export const useAuth=()=>({user,isAuthenticated:true,canEdit:()=>true,canAccessModule:module=>user.role==='Admin'||user.modulePermissions.some(item=>item.module===module)});`,
  '@/lib/firebase': `export const auth={currentUser:{uid:'fixture-user',getIdToken:async()=>'local-fixture-only'}}; export const db={}; export const firebaseProjectId='dashboard-cache-fixture';`,
  '@/lib/hooks/use-school-settings': `import {useQuery} from '@tanstack/react-query'; export function useDashboardDataRevisions(){const p=new URLSearchParams(location.search);return useQuery({queryKey:['dashboardDataRevisions'],queryFn:async()=>({}),enabled:false,initialData:{dutyService:0,staffClockingPolicy:p.get('state')==='clocking-off'?1:0,staffClockingEnabled:p.get('state')==='clocking-off'?false:undefined,dashboardStaffClockingRecords:0,staffClockingStaff:{sarah:0}}});} export function useDashboardRevisionReadiness(){return useQuery({queryKey:['fixture-revision-ready'],queryFn:async()=>true,enabled:false,initialData:!new URLSearchParams(location.search).has('revision-wait')}).data===true;}`,
  '@/lib/hooks/use-dashboard-data': `export {dashboard as useDashboardData} from 'dashboard-fixture';`,
  '@/lib/hooks/use-pupils': `import {q,pupils,mutation} from 'dashboard-fixture'; export const usePupils=()=>q(pupils); export const useUpdatePupil=mutation;`,
  '@/lib/hooks/use-attendance': `import {q,records,mutation} from 'dashboard-fixture'; export const useAttendanceByDateRange=()=>q(records); export const useUpdateAttendanceRecord=mutation;`,
  '@/lib/hooks/use-excluded-days': `import {q} from 'dashboard-fixture'; const data=[]; export const useExcludedDays=()=>q(data);`,
  '@/lib/hooks/use-academic-years': `import {q,years} from 'dashboard-fixture'; export const useAcademicYears=()=>q(years); export const useActiveAcademicYear=()=>q(years[0]);`,
  '@/lib/hooks/use-term-status': `import {term,years} from 'dashboard-fixture'; export const useTermStatus=()=>({effectiveTerm:{term,academicYear:years[0]},isRecessMode:false});`,
  '@/lib/hooks/use-subjects': `import {q,subjects} from 'dashboard-fixture'; export const useSubjects=()=>q(subjects);`,
  '@/lib/hooks/use-exams': `import {q} from 'dashboard-fixture'; const data=[]; export const useExams=()=>q(data);`,
  '@/lib/hooks/use-events-fixed': `import {q,events,years,term} from 'dashboard-fixture'; export const useEvents=()=>q(events); export const useExamsAsEvents=()=>q([]); export const useAcademicYearsForEvents=()=>q(years); export const useCurrentTerm=()=>({term,year:years[0]});`,
  '@/lib/hooks/use-staff': `import {q,staff} from 'dashboard-fixture'; export const useStaff=()=>q(staff);`,
  '@/lib/hooks/use-classes': `import {q,classes} from 'dashboard-fixture'; export const useClasses=()=>q(classes);`,
  '@/lib/hooks/use-timetable': `import {useSyncExternalStore} from 'react'; import {q,profiles,periods,entries} from 'dashboard-fixture'; export const useTimetableProfiles=()=>q(profiles); export const useTimetablePeriods=()=>q(periods); const subscribe=callback=>{window.addEventListener('fixture-timetable-change',callback);return()=>window.removeEventListener('fixture-timetable-change',callback)}; export const useTimetableEntries=()=>q(useSyncExternalStore(subscribe,()=>entries));`,
  '@/lib/services/attendance-summary-outbox': `export const queueAttendanceSummaryPublication=()=>{};`,
  '@/components/dashboard/TermScheduleCard': `export function TermScheduleCard(){return <div>Term schedule</div>}`,
  '@/components/dashboard/MonthCalendarCard': `export function MonthCalendarCard(){return <div>School calendar</div>}`,
  '@/components/dashboard/dashboard-greeting': `export function DashboardGreeting(){return <header className="px-3 py-3 text-base font-bold">TRINITY FAMILY SCHOOL</header>}`,
  '@/components/dashboard/class-attendance-summary-dialog': `export function ClassAttendanceSummaryDialog(){return null}`,
  '@/components/common/recess-status-banner': `export function RecessStatusBanner(){return null}`,
};

async function main() {
  const output = path.resolve('output/dashboard-role-validation');
  await fs.mkdir(output, { recursive: true });
  const bundle = await build({ stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import Dashboard from './src/app/page';const client=new QueryClient({defaultOptions:{queries:{retry:false}}});window.__dashboardClient=client;createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><Dashboard/></QueryClientProvider>);`, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'dashboard-fixtures', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => {
        if(process.argv.includes('--column-heights-only')&&['@/components/dashboard/MonthCalendarCard','@/components/dashboard/TermScheduleCard'].includes(args.path))return {path:path.resolve(args.path.replace('@/','src/')+'.tsx')};
        if(process.argv.includes('--real-revisions')) {
          if(args.path==='./use-school-settings'||args.path==='@/lib/hooks/use-school-settings')return {path:path.resolve('src/lib/hooks/use-school-settings.ts')};
          if(args.path==='firebase/firestore'||args.path==='@/lib/access/scoped-firestore')return {path:'revision-firestore-fixture',namespace:'fixture'};
          if(args.path==='../services/school-settings.service')return {path:'revision-settings-service-fixture',namespace:'fixture'};
        }
        const source = args.path === './use-school-settings' ? '@/lib/hooks/use-school-settings' : args.path;
        return source === 'dashboard-fixture' || Object.hasOwn(sources, source) ? { path: source, namespace: 'fixture' } : undefined;
      });
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'dashboard-fixture' ? fixture : sources[args.path], loader: 'tsx', resolveDir: process.cwd() }));
    } }],
  });
  const js = bundle.outputFiles[0].contents;
  const tailwindConfig = require('tailwindcss/loadConfig')(path.resolve('tailwind.config.ts'));
  const globals = (await fs.readFile('src/app/globals.css', 'utf8')).replace(/^@import[^;]+;/gm, '');
  const compiledCss = await require('postcss')([require('tailwindcss')(tailwindConfig)]).process(globals, {from:undefined});
  const css = Buffer.concat([Buffer.from(compiledCss.css), Buffer.from('\n'), await fs.readFile('src/app/brand-theme.css'), await fs.readFile('src/app/theme.css')]);
  const server = http.createServer((req, res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(js); }
    else if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); res.end(css); }
    else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>html{background:#f8fafc}body{margin:0;font-family:Arial,sans-serif}.dark{background:#0f172a}.dark body{color:#f8fafc}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
    const page = await browser.newPage({ timezoneId: 'Africa/Kampala' });
    const errors = []; page.on('pageerror', error => { errors.push(error.message); console.error('Browser runtime error:', error.message); });
    await page.addInitScript(() => {
      const RealDate = Date; const day=new URLSearchParams(location.search).get('day')||'2026-10-27'; const fixed = new RealDate(day+'T07:26:00Z').getTime();
      window.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [fixed])); } static now() { return fixed; } };
    });
    let apiCalls = 0;
    let clockingOverride;
    let dutyOverride;
    let secondArrival = false;
    await page.route('**/api/dashboard/staff-day', async route => {
      apiCalls++;
      assert.equal(route.request().headers().authorization, 'Bearer local-fixture-only');
      const params = new URL(page.url()).searchParams;
      if (params.get('state') === 'error') return route.fulfill({ status: 500, json: { success: false, error: 'Fixture load failure' } });
      const schoolWide = ['admin', 'dos'].includes(params.get('role'));
      const arrivals = [{staffId:'sarah',staffName:'Sarah Namuli',enrolled:true,schedule:{kind:'scheduled',localDate:'2026-10-27',clockInBy:'07:30'},record:{clockInTime:'07:18',arrivalStatus:'on_time'}},{staffId:'peter',staffName:'Peter Kato',enrolled:true,schedule:{kind:'scheduled',localDate:'2026-10-27',clockInBy:'07:30'}}];
      if(secondArrival)arrivals[1].record={clockInTime:'08:00',arrivalStatus:'late'};
      for(let index=3;index<=Number(params.get('roster')||2);index++)arrivals.push({staffId:`staff-${index}`,staffName:`Teacher ${index}`,enrolled:true,schedule:{kind:'scheduled',localDate:'2026-10-27',clockInBy:'07:30'}});
      const duties = (dutyOverride ?? params.get('duties') !== 'none') ? [{id:'duty',staffId:'sarah',staffName:'Sarah Namuli',name:'Morning supervision',service:'Morning supervision',supervisor:false,startDate:'2026-10-26',endDate:params.get('duty-end')||'2026-10-30'}] : [];
      for(let index=2;duties.length&&index<=Number(params.get('duty-count')||1);index++)duties.push({...duties[0],id:`duty-${index}`,staffId:`staff-${index}`,staffName:`Teacher ${index}`});
      const clockingEnabled = clockingOverride ?? params.get('state') !== 'clocking-off';
      await route.fulfill({ json: { success: true, result: { date:params.get('day')||'2026-10-27',schoolWide,clockingEnabled,arrivals:schoolWide?arrivals:params.get('role')==='unlinked'?[]:arrivals.slice(0,1),duties } } });
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    if(process.argv.includes('--column-heights-only')) {
      const layout=()=>page.evaluate(()=>{
        const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {height:r.height,bottom:r.bottom};};
        const lastBottom=column=>{const node=document.querySelector(`[data-dashboard-column="${column}"]`);return (column==='right'?node:node.lastElementChild).getBoundingClientRect().bottom;};
        return {enrollment:rect('[data-dashboard-enrollment] .theme-dashboard-surface'),plot:rect('[data-enrollment-plot]'),calendar:rect('[data-dashboard-calendar] .theme-dashboard-surface'),calendarGrid:rect('.mini-calendar-wrapper .fc'),calendarContainer:rect('.mini-calendar-wrapper'),bottoms:['enrollment','calendar','right'].map(lastBottom)};
      });
      const aligned=value=>assert.ok(Math.max(...value.bottoms)-Math.min(...value.bottoms)<3,JSON.stringify(value));
      for(const role of ['dos','admin'])for(const width of [1024,1440])for(const theme of ['light','dark']) {
        await page.setViewportSize({width,height:900});
        await page.goto(`${origin}/?role=${role}&roster=17&duty-count=7&uid=columns-${role}-${width}-${theme}`);
        await page.evaluate(theme=>document.documentElement.classList.toggle('dark',theme==='dark'),theme);
        await page.locator('[data-dashboard-calendar] .fc-view-harness').waitFor();
        await page.getByText('Teachers on duty today',{exact:true}).waitFor();
        await page.waitForTimeout(1400);
        assert.equal(await page.getByText('Teachers on duty today',{exact:true}).evaluate(element=>element.closest('[data-dashboard-column]').dataset.dashboardColumn),'calendar','desktop duty card is in the second column');
        const dutyPosition=await page.locator('[data-dashboard-duty-slot]').evaluate(slot=>{
          const attendance=slot.previousElementSibling.getBoundingClientRect(),duty=slot.getBoundingClientRect(),calendar=slot.nextElementSibling.getBoundingClientRect();
          return {attendanceBottom:attendance.bottom,dutyTop:duty.top,dutyBottom:duty.bottom,calendarTop:calendar.top};
        });
        assert.ok(dutyPosition.dutyTop>=dutyPosition.attendanceBottom+20&&dutyPosition.calendarTop>=dutyPosition.dutyBottom+20,'duty sits directly between attendance and calendar');
        const initial=await layout();aligned(initial);
        assert.ok(initial.plot.height>=200&&initial.calendarContainer.height>=290,JSON.stringify(initial));
        assert.ok(Math.abs(initial.calendarGrid.height-initial.calendarContainer.height)<3,'calendar fills its stretched surface');
        await page.getByRole('button',{name:role==='dos'?'View all 17 teachers':'Show all 7 duties',exact:true}).click();
        await page.waitForTimeout(900);
        const expanded=await layout();aligned(expanded);
        assert.ok(expanded.plot.height>initial.plot.height+50&&expanded.calendarContainer.height>=290,JSON.stringify({initial,expanded}));
        if(role==='dos')assert.ok(expanded.calendarContainer.height>initial.calendarContainer.height+50);
        assert.equal(await page.locator('[data-dashboard-duty-slot]').evaluate(slot=>slot.nextElementSibling.getBoundingClientRect().top>=slot.getBoundingClientRect().bottom+20),true,'expanded duties do not overlap the calendar');
        await page.waitForTimeout(300);const stable=await layout();assert.ok(Math.abs(stable.calendar.height-expanded.calendar.height)<2,'height does not grow in a resize loop');
        await page.getByRole('button',{name:'Show less',exact:true}).click();await page.waitForTimeout(900);
        const collapsed=await layout();
        if(Math.max(...collapsed.bottoms)-Math.min(...collapsed.bottoms)>=3) {
          await fs.writeFile(path.join(output,'column-height-debug.json'),JSON.stringify(await page.evaluate(()=>['[data-enrollment-plot]','.mini-calendar-wrapper','[data-dashboard-column="right"]'].map(selector=>{
            let node=document.querySelector(selector);const chain=[];while(node&&chain.length<7){const s=getComputedStyle(node),r=node.getBoundingClientRect();chain.push({tag:node.tagName,classes:node.className,height:r.height,top:r.top,minHeight:s.minHeight,cssHeight:s.height,flex:s.flex,position:s.position,gridRows:s.gridTemplateRows});node=node.parentElement;}return chain;
          })),null,2));
          await page.screenshot({path:path.join(output,'column-height-debug.png'),fullPage:true});
        }
        aligned(collapsed);assert.ok(Math.abs(collapsed.calendar.height-initial.calendar.height)<3,JSON.stringify({initial,collapsed}));
        await page.screenshot({path:path.join(output,`matched-columns-${role}-${width}-${theme}.png`),fullPage:true});
        const title=await page.locator('.fc-toolbar-title').textContent();await page.locator('.fc-prev-button').click();assert.notEqual(await page.locator('.fc-toolbar-title').textContent(),title);
        const beforeResize=apiCalls;
        await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);
        const mobile=await layout();assert.equal(Math.round(mobile.plot.height),200);assert.equal(Math.round(mobile.calendarContainer.height),290);
        assert.equal(await page.getByText('Teachers on duty today',{exact:true}).evaluate(element=>element.closest('[data-dashboard-column]').dataset.dashboardColumn),'right','mobile grouping is unchanged');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
        await page.setViewportSize({width,height:900});await page.waitForTimeout(600);aligned(await layout());
        assert.equal(apiCalls,beforeResize,'layout changes add no endpoint reads');
        assert.deepEqual(errors,[]);
        console.log(`PASS matched enrollment/calendar heights, live expand/collapse, real calendar navigation and compact mobile ${role} ${width}px ${theme}`);
      }
      return;
    }
    if (process.argv.includes('--cache-only')) {
      const waitLoaded = async () => {
        await page.getByRole('button',{name:'Refresh arrival and duty information'}).waitFor();
        await page.waitForFunction(()=>{const button=document.querySelector('button[aria-label="Refresh arrival and duty information"]');return button&&!button.disabled;});
      };
      const publish = (changes) => page.evaluate(changes => window.__publishOperational ? window.__publishOperational(changes) : window.__dashboardClient.setQueryData(['dashboardDataRevisions'], previous => ({...previous,...changes})), changes);
      const nextRead = action => Promise.all([page.waitForResponse(response=>response.url().endsWith('/api/dashboard/staff-day')),action()]);
      await page.goto(origin+'/?role=teacher&revision-wait=1');
      await page.waitForTimeout(100);
      if (errors.length) throw new Error(errors.join('\n'));
      await page.getByText('Loading staff information…').waitFor();
      await page.waitForTimeout(150);
      assert.equal(apiCalls,0,'cold reads wait for authoritative revision metadata');
      await page.evaluate(()=>window.__confirmRevisions ? window.__confirmRevisions() : window.__dashboardClient.setQueryData(['fixture-revision-ready'],true));
      await waitLoaded(); assert.equal(apiCalls,1);
      await page.evaluate(()=>history.replaceState(null,'','/?role=teacher'));
      await page.reload(); await waitLoaded(); assert.equal(apiCalls,1,'warm reload uses IndexedDB with zero endpoint reads');
      await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('online'));});
      await page.waitForTimeout(150); assert.equal(apiCalls,1,'focus and reconnect do not cause endpoint reads');
      await publish({pupils:100}); await page.waitForTimeout(150); assert.equal(apiCalls,1,'unrelated data change is ignored');
      await publish({dashboardStaffClockingRecords:1,staffClockingStaff:{sarah:0,peter:1}}); await page.waitForTimeout(150); assert.equal(apiCalls,1,'another teacher clocking in is ignored by a personal dashboard');
      await nextRead(()=>publish({dashboardStaffClockingRecords:2,staffClockingStaff:{sarah:1,peter:1}})); await waitLoaded(); assert.equal(apiCalls,2);
      await nextRead(()=>publish({dutyService:1})); await waitLoaded(); assert.equal(apiCalls,3);
      await publish({dutyService:1}); await page.waitForTimeout(150); assert.equal(apiCalls,3,'repeated revision signal does not refetch');
      if(process.argv.includes('--real-revisions')) {
        await page.evaluate(()=>window.__publishOperational({dutyService:2},true));
        await page.waitForTimeout(150);assert.equal(apiCalls,3,'uncommitted metadata cannot label old server data as fresh');
        await nextRead(()=>publish({dutyService:2}));await waitLoaded();assert.equal(apiCalls,4,'commit confirmation reconciles exactly once');
      }
      await page.reload(); await waitLoaded(); // fresh mocked metadata is zero, deliberately different from the stored revision
      const restoredCalls=apiCalls;
      await page.reload(); await waitLoaded(); assert.equal(apiCalls,restoredCalls,'reconciled revision is persisted across reloads');
      await page.goto(origin+'/?role=teacher&uid=second-user'); await waitLoaded(); assert.equal(apiCalls,restoredCalls+1,'account caches remain separate');
      await page.goto(origin+'/?role=teacher&uid=second-user&day=2026-10-28'); await waitLoaded(); assert.equal(apiCalls,restoredCalls+2,'school date rollover reconciles once');
      await page.reload(); await waitLoaded(); assert.equal(apiCalls,restoredCalls+2);
      for (const role of ['dos','admin']) {
        await page.goto(origin+'/?role='+role); await waitLoaded();
        const before=apiCalls;
        await nextRead(()=>publish({dashboardStaffClockingRecords:1,staffClockingStaff:{peter:1}})); await waitLoaded(); assert.equal(apiCalls,before+1,'school-wide dashboards track all clock changes');
      }
      const beforeDisable=apiCalls;
      clockingOverride=false;
      await nextRead(()=>publish({staffClockingPolicy:1,staffClockingEnabled:false}));
      await page.getByRole('button',{name:'Refresh duty information'}).waitFor();
      assert.equal(apiCalls,beforeDisable+1);
      assert.equal(await page.getByText('Teachers’ arrival & departure',{exact:true}).count(),0);
      assert.deepEqual(errors,[]);
      console.log('PASS persistent warm reload/focus/reconnect: zero endpoint reads');
      console.log('PASS own/duty/school revision updates: one reconciliation; unrelated signals: zero');
      console.log('PASS scoped accounts, day rollover, metadata readiness, stored revisions and disabled clocking');
      return;
    }
    if(!process.argv.includes('--staff-stat-only')) {
    for (const width of [320, 1440]) for (const theme of ['light', 'dark']) {
      await page.setViewportSize({width,height:900});
      await page.goto(`${origin}/?role=teacher&state=clocking-off&lessons=none&duties=none&uid=empty-${width}-${theme}`);
      await page.evaluate(theme=>document.documentElement.classList.toggle('dark',theme==='dark'),theme);
      await page.waitForFunction(()=>{const column=document.querySelector('[data-personal-day-column]');return column&&column.children.length===0;});
      assert.equal(await page.locator('[data-dashboard-personal-tracker]').count(),0);
      assert.equal(await page.locator('[data-dashboard-staff-panels]').count(),0);
      assert.equal(await page.locator('[data-personal-day-column]').evaluate(column=>getComputedStyle(column).display),'none');
      if(width===1440) assert.equal(await page.locator('[data-personal-day-column]').evaluate(column=>getComputedStyle(column.parentElement).gridTemplateColumns.split(' ').length),2);
      assert.ok(await page.locator('[data-pill-btn]').count()>0,'general timetable stays present');
      await page.screenshot({path:path.join(output,`no-personal-activity-${width}-${theme}.png`),fullPage:true});
      await page.evaluate(()=>window.__setTeacherLessons(true));
      await page.locator('[data-dashboard-personal-tracker]').getByText('MATH · P.4',{exact:true}).waitFor();
      await page.evaluate(()=>window.__setTeacherLessons(false));
      await page.locator('[data-dashboard-personal-tracker]').waitFor({state:'detached'});
      dutyOverride=true;
      const beforeDuty=apiCalls;
      await Promise.all([page.waitForResponse(response=>response.url().endsWith('/api/dashboard/staff-day')),page.evaluate(()=>window.__dashboardClient.setQueryData(['dashboardDataRevisions'],previous=>({...previous,dutyService:1})))]);
      await page.getByText('My duty today',{exact:true}).waitFor();
      assert.equal(apiCalls,beforeDuty+1);
      dutyOverride=false;
      await Promise.all([page.waitForResponse(response=>response.url().endsWith('/api/dashboard/staff-day')),page.evaluate(()=>window.__dashboardClient.setQueryData(['dashboardDataRevisions'],previous=>({...previous,dutyService:2})))]);
      await page.locator('[data-dashboard-staff-panels]').waitFor({state:'detached'});
      dutyOverride=undefined;
      console.log(`PASS empty personal cards and layout hidden; live lesson/duty additions and removals ${width}px ${theme}`);
    }
    await page.goto(`${origin}/?role=teacher&lessons=none&duties=none&uid=arrival-only`);
    await page.getByText('My arrival today',{exact:true}).waitFor();
    assert.equal(await page.getByText('Arrival due',{exact:true}).count(),1);
    assert.equal(await page.getByText('No duty assigned today.',{exact:true}).count(),0);
    assert.equal(await page.getByText('My arrival & duty',{exact:true}).count(),0);
    for(const role of ['dos','admin']) {
      await page.setViewportSize({width:390,height:844});
      await page.goto(`${origin}/?role=${role}&lessons=none&duties=none&uid=arrival-only-${role}`);
      await page.getByText('Teachers’ arrival & departure',{exact:true}).waitFor();
      assert.equal(await page.getByText('Teachers on duty today',{exact:true}).count(),0);
    }
    await page.goto(`${origin}/?role=teacher&state=exam&lessons=none&uid=exam-without-lessons`);
    await page.locator('[data-dashboard-personal-tracker]').getByText('P.4 Mathematics examination',{exact:true}).waitFor();
    await page.goto(`${origin}/?role=teacher&state=exam-future&lessons=none&duties=none&uid=future-exam-without-lessons`);
    await page.locator('[data-dashboard-staff-panels]').waitFor();
    await page.waitForFunction(()=>!document.querySelector('[data-dashboard-personal-tracker]'));
    assert.equal(await page.getByText('No lessons assigned today.',{exact:true}).count(),0);
    assert.deepEqual(errors,[]);
    console.log('PASS active arrival cards and relevant exams survive empty duty/lesson schedules');
    if(process.argv.includes('--visibility-only')) return;
    for (const width of [320, 390, 1440]) for (const theme of ['light', 'dark']) for (const role of ['teacher', 'dos', 'admin']) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${origin}/?role=${role}`);
      await page.evaluate(theme => document.documentElement.classList.toggle('dark', theme === 'dark'), theme);
      await page.locator('[data-dashboard-staff-panels]').waitFor();
      if (role === 'teacher') {
        await page.getByRole('heading', { name: 'Your lessons today' }).waitFor();
        const teaching = page.locator('[data-dashboard-personal-tracker]');
        await teaching.getByText('MATH · P.4', { exact: true }).waitFor();
        assert.equal(await teaching.getByRole('link', { name: 'Timetable', exact: true }).count(), 0);
        const row = teaching.locator('[data-personal-lesson-row]');
        const cells = await row.locator(':scope > span').evaluateAll(elements => elements.map(element => { const r = element.getBoundingClientRect(); return { left:r.left,right:r.right,centerY:r.y+r.height/2 }; }));
        assert.ok(cells.every(cell => Math.abs(cell.centerY - cells[0].centerY) < 2), 'subject, time and countdown share one line');
        assert.ok(cells[0].right <= cells[1].left && cells[1].right <= cells[2].left, 'teaching row has no overlapping text');
        const routesBefore = await page.evaluate(() => (window.__routes || []).length);
        await teaching.getByRole('button', { name: 'Show all', exact: true }).click();
        await teaching.getByText('SCI · P.4', { exact: true }).waitFor();
        await teaching.getByText('MATH · P.5', { exact: true }).waitFor();
        assert.equal(await page.evaluate(() => (window.__routes || []).length), routesBefore, 'expanding lessons never navigates');
        await teaching.getByRole('button', { name: 'Show less', exact: true }).click();
        assert.equal(await teaching.getByText('SCI · P.4', { exact: true }).count(), 0);
        assert.equal(await page.getByText('Total Pupils', { exact: true }).count(), 0);
        assert.equal(await page.getByRole('combobox',{name:'Attendance class'}).count(),0);
        const attendance=page.locator('[data-personal-attendance]');
        assert.equal(await attendance.locator('[data-class-attendance]').count(),2);
        await attendance.locator('[data-class-attendance="p4"] figcaption').getByText('2/4',{exact:true}).waitFor();
        await attendance.locator('[data-class-attendance="p5"] figcaption').getByText('3/3',{exact:true}).waitFor();
        if(width<1024) {
          assert.ok((await attendance.boundingBox()).y<(await teaching.boundingBox()).y,'attendance is the first mobile card');
          assert.ok((await attendance.boundingBox()).y<(await page.locator('[data-dashboard-staff-panels]').boundingBox()).y);
        }
        await page.getByText('You are on duty today.',{exact:true}).waitFor();
        await page.getByText("You'll be on duty until the end of this week (Friday, 30 October).",{exact:true}).waitFor();
        if (theme === 'dark') assert.equal(await page.locator('.theme-dashboard-surface').first().evaluate(element => getComputedStyle(element).backgroundImage), 'none', 'attendance follows the existing dark surface');
        assert.equal(await page.getByText('Fee Management', { exact: true }).count(), 0);
        const donut = page.getByRole('button', { name: 'Open P.4 register', exact: true });
        assert.equal(await page.getByText('Open P.4 register', { exact: true }).count(), 0, 'no separate register button text');
        await donut.click();
        assert.ok((await page.evaluate(() => window.__routes)).some(value => value.includes('classId=p4')));
        await donut.focus();
        const beforeKey = await page.evaluate(() => window.__routes.length);
        await page.keyboard.press('Enter');
        assert.equal(await page.evaluate(() => window.__routes.length), beforeKey+1, 'donut is keyboard accessible');
      } else {
        await page.getByText('Teachers on duty today', { exact: true }).waitFor();
        assert.equal(await page.getByText('Total Pupils', { exact: true }).count(), role === 'admin' ? 1 : 0);
        if(role==='admin'&&width>=1024) {
          const stat=page.getByRole('button',{name:/Staff present/});
          await stat.getByText('1/2',{exact:true}).waitFor();
          assert.equal(await page.getByText('Teachers’ arrival & departure',{exact:true}).count(),0,'desktop inline arrival card removed');
          const beforeOpen=apiCalls;
          await stat.focus();await page.keyboard.press('Enter');
          const dialog=page.getByRole('dialog');
          await dialog.getByText('Teachers’ arrival & departure',{exact:true}).waitFor();
          await dialog.getByText('Not clocked in',{exact:true}).waitFor();
          await dialog.getByLabel('Find teacher',{exact:true}).fill('Peter');
          assert.equal(await dialog.getByText('Sarah Namuli',{exact:true}).count(),0);
          await dialog.getByLabel('Find teacher',{exact:true}).fill('');
          assert.equal(apiCalls,beforeOpen,'opening the popup uses the existing cache');
          await page.screenshot({path:path.join(output,`staff-arrival-popup-${theme}.png`),fullPage:true});
          await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
          assert.equal(await stat.evaluate(element=>element===document.activeElement),true,'focus returns to staff statistic');
        } else {
          await page.getByText('Teachers’ arrival & departure', { exact: true }).waitFor();
          await page.getByText('Not clocked in', { exact: true }).waitFor();
          await page.getByLabel('Find teacher', { exact: true }).fill('Peter');
          const roster = page.locator('[data-dashboard-staff-panels]');
          assert.equal(await roster.getByText('Sarah Namuli', { exact: true }).count(), 1);
          await page.getByLabel('Find teacher', { exact: true }).fill('');
          assert.equal(await page.getByText('Staff present',{exact:true}).count(),0);
        }
      }
      const date=page.locator('[data-dashboard-date]');
      assert.equal(await date.textContent(),'Tuesday, 27 October 2026');
      assert.equal(await date.getAttribute('datetime'),'2026-10-27');
      assert.equal(await page.getByText('Guiding growth',{exact:true}).count(),0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${role} ${width} ${theme} overflow`);
      await page.screenshot({ path: path.join(output, `${role}-${width}-${theme}.png`), fullPage: true });
      console.log(`PASS ${role} ${width}px ${theme}`);
    }
    }
    await page.setViewportSize({width:1440,height:900});
    const beforeColdAdmin=apiCalls;
    await page.goto(`${origin}/?role=admin&uid=staff-popup-live`);
    const staffStat=page.locator('.stat-card [role="button"][aria-haspopup="dialog"]');
    await staffStat.getByText('1/2',{exact:true}).waitFor();
    assert.equal(apiCalls,beforeColdAdmin+1,'stat and duty panels deduplicate their cold request');
    await staffStat.click();
    const liveDialog=page.getByRole('dialog');
    await liveDialog.getByLabel('Find teacher',{exact:true}).fill('Peter');
    secondArrival=true;
    const beforeArrival=apiCalls;
    await Promise.all([page.waitForResponse(response=>response.url().endsWith('/api/dashboard/staff-day')),page.evaluate(()=>window.__dashboardClient.setQueryData(['dashboardDataRevisions'],previous=>({...previous,dashboardStaffClockingRecords:(previous.dashboardStaffClockingRecords||0)+1})))]);
    await staffStat.getByText('2/2',{exact:true}).waitFor();
    await liveDialog.getByText('08:00',{exact:true}).waitFor();
    assert.equal(await liveDialog.getByLabel('Find teacher',{exact:true}).inputValue(),'Peter','search survives a revision update');
    assert.equal(apiCalls,beforeArrival+1,'one request refreshes the open popup and summary');
    clockingOverride=false;
    await Promise.all([page.waitForResponse(response=>response.url().endsWith('/api/dashboard/staff-day')),page.evaluate(()=>window.__dashboardClient.setQueryData(['dashboardDataRevisions'],previous=>({...previous,staffClockingEnabled:false,staffClockingPolicy:(previous.staffClockingPolicy||0)+1})))]);
    await liveDialog.waitFor({state:'detached'});
    await page.getByRole('button',{name:/Staff Members/}).waitFor();
    assert.equal(await page.getByText('Staff present',{exact:true}).count(),0);
    assert.equal(await page.getByText('Teachers’ arrival & departure',{exact:true}).count(),0);
    clockingOverride=undefined;secondArrival=false;
    console.log('PASS staff statistic popup: cold-read deduplication, live updates, retained search and disabled clocking');
    await page.goto(`${origin}/?role=admin&roster=17&uid=staff-popup-long-roster`);
    await page.getByRole('button',{name:/Staff present/}).getByText('1/17',{exact:true}).waitFor();
    await page.getByRole('button',{name:/Staff present/}).click();
    const longDialog=page.getByRole('dialog');
    assert.equal(await longDialog.locator('li').count(),17);
    assert.equal(await longDialog.locator('ul').evaluate(list=>list.scrollHeight>list.clientHeight),true,'long roster scrolls inside the popup');
    await longDialog.getByLabel('Find teacher',{exact:true}).fill('Teacher 17');
    assert.equal(await longDialog.locator('li').count(),1);
    await longDialog.getByRole('button',{name:'Close',exact:true}).click();
    await longDialog.waitFor({state:'detached'});
    console.log('PASS full 17-teacher popup stays bounded and searchable');
    if(process.argv.includes('--staff-stat-only')) return;
    for(const count of [1,3,4]) for(const theme of ['light','dark']) {
      await page.setViewportSize({width:320,height:900});
      await page.goto(`${origin}/?role=teacher&classes=${count}&uid=classes-${count}-${theme}`);
      await page.evaluate(theme=>document.documentElement.classList.toggle('dark',theme==='dark'),theme);
      const attendance=page.locator('[data-personal-attendance]');
      await attendance.waitFor();
      const boxes=await attendance.locator('[data-class-attendance]').evaluateAll(figures=>figures.map(figure=>{
        const button=figure.querySelector('button').getBoundingClientRect(),caption=figure.querySelector('figcaption').getBoundingClientRect();
        return {x:button.x,y:button.y,width:button.width,height:button.height,bottom:button.bottom,captionY:caption.y};
      }));
      assert.equal(boxes.length,count);
      assert.ok(boxes.every(box=>box.width>=44&&box.height>=44&&box.captionY>=box.bottom),'touch targets and counts below donuts');
      if(count>=3)assert.ok(boxes.slice(0,3).every(box=>Math.abs(box.y-boxes[0].y)<2),'three class donuts share a row');
      if(count===4){assert.ok(boxes[3].y>boxes[0].y);await attendance.locator('[data-class-attendance="p7"] figcaption').getByText('No pupils',{exact:true}).waitFor();}
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      await page.screenshot({path:path.join(output,`teacher-${count}-classes-320-${theme}.png`),fullPage:true});
      console.log(`PASS ${count} class donuts: counts below, three per row, no overflow 320px ${theme}`);
    }
    await page.goto(`${origin}/?role=teacher&duty-end=2026-10-27&uid=last-duty-day`);
    await page.getByText('Today is your last day on this duty.',{exact:true}).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${origin}/?role=teacher&state=exam`);
    await page.locator('[data-dashboard-personal-tracker]').getByText('P.4 Mathematics examination', { exact: true }).waitFor();
    assert.equal(await page.getByText('Affected class lessons are paused until 11:00.', { exact: true }).count(), 1);
    assert.ok(await page.locator('[data-pill-btn]').count() >= 3, 'general timetable subject pills remain present during exam');
    await page.screenshot({ path: path.join(output, 'teacher-exam-mobile.png'), fullPage: true });
    const beforeRefresh = apiCalls;
    await page.getByRole('button', { name: 'Refresh arrival and duty information' }).click();
    await page.waitForFunction(() => !document.querySelector('button[aria-label="Refresh arrival and duty information"]').disabled);
    assert.ok(apiCalls > beforeRefresh);
    await Promise.all([
      page.waitForResponse(response => response.url().endsWith('/api/dashboard/staff-day')),
      page.evaluate(() => window.__dashboardClient.setQueryData(['dashboardDataRevisions'],previous=>({...previous,dutyService:(previous.dutyService||0)+1}))),
    ]);
    console.log('PASS exam override preserves general timetable; arrival refresh fetches current data');
    await page.goto(`${origin}/?role=teacher&state=error&uid=error-fixture`);
    await page.getByText('Staff information could not load. Try refreshing.').waitFor();
    await Promise.all([page.waitForResponse(response=>response.url().endsWith('/api/dashboard/staff-day')),page.goto(`${origin}/?role=unlinked`)]);
    await page.waitForFunction(()=>!document.body.textContent.includes('Loading staff information…'));
    assert.equal(await page.locator('[data-dashboard-staff-panels]').count(),0);
    assert.equal(await page.getByText('Total Pupils', { exact: true }).count(), 0);
    for (const role of ['teacher','dos','admin']) {
      await page.goto(`${origin}/?role=${role}&state=clocking-off`);
      await page.locator('[data-dashboard-staff-panels]').waitFor();
      await page.getByRole('button', { name:'Refresh duty information' }).waitFor();
      assert.equal(await page.getByText('My arrival & duty', { exact:true }).count(), 0);
      assert.equal(await page.getByText('Teachers’ arrival & departure', { exact:true }).count(), 0);
      assert.equal(await page.getByText('Arrival due', { exact:true }).count(), 0);
      assert.equal(await page.getByText('Staff clocking is not enabled.', { exact:true }).count(), 0);
      assert.equal(await page.getByRole('link', { name:'Open my clock' }).count(), 0);
      await page.getByRole('button', { name:'Refresh duty information' }).waitFor();
      assert.ok((await page.locator('[data-dashboard-staff-panels]').innerText()).includes('Morning supervision'), 'duties survive disabled clocking');
      await page.screenshot({path:path.join(output,`${role}-clocking-off-mobile.png`),fullPage:true});
    }
    await page.goto(`${origin}/?role=teacher`);
    await page.getByText('My arrival & duty', {exact:true}).waitFor();
    clockingOverride = false;
    await Promise.all([page.waitForResponse(response=>response.url().endsWith('/api/dashboard/staff-day')),page.evaluate(()=>window.__dashboardClient.setQueryData(['dashboardDataRevisions'],previous=>({...previous,staffClockingPolicy:(previous.staffClockingPolicy||0)+1,staffClockingEnabled:false})))]);
    await page.getByText('My duty today', {exact:true}).waitFor();
    assert.equal(await page.getByText('Arrival due', {exact:true}).count(),0);
    clockingOverride = undefined;
    console.log('PASS clocking hidden for all roles when disabled, including after a live toggle');
    assert.deepEqual(errors, []);
    console.log('PASS error and unlinked-account states; no browser runtime errors');
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
