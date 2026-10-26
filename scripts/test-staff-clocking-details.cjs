const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { build } = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

async function main() {
  const output = path.resolve('output/staff-clocking-validation');
  fs.mkdirSync(output, {recursive:true});
  const cssPath = path.join(output,'details-browser.css');
  const css = spawnSync(process.execPath,[require.resolve('tailwindcss/lib/cli.js'),'-i','src/app/globals.css','-o',cssPath,'--content','src/components/staff-clocking/staff-clocking-staff-details.tsx,src/components/staff-clocking/staff-clocking-detail-mobile.tsx,src/components/staff-clocking/staff-clocking-period-picker.tsx,src/components/ui/*.tsx,src/components/common/*.tsx','--minify'],{encoding:'utf8'});
  if(css.status) throw new Error(css.stderr);
  const fixture = `import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{StaffClockingStaffDetails}from'./src/components/staff-clocking/staff-clocking-staff-details';const client=new QueryClient({defaultOptions:{queries:{retry:false}}});function App(){const[shown,setShown]=useState(true);window.__sharedRevision=(key,value)=>client.setQueryData(['details-revisions'],old=>({...old,[key]:value}));return <><button onClick={()=>setShown(!shown)}>{shown?'Away':'Return'}</button>{shown&&<StaffClockingStaffDetails staffId={location.pathname.split('/').pop()}/>}</>}createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><App/></QueryClientProvider>);`;
  const result=await build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"','process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID':'"details-test"'},plugins:[{name:'details-fixtures',setup(builder){
    builder.onResolve({filter:/^(?:next\/link|next\/navigation|@\/lib\/contexts\/(?:auth-context|navigation-context)|@\/lib\/hooks\/(?:use-staff|use-academic-years|use-school-settings|use-permissions)|\.\/use-school-settings|@\/lib\/firebase|@\/lib\/access\/scoped-firestore)$/},args=>({path:args.path,namespace:'fixture'}));
    builder.onLoad({filter:/.*/,namespace:'fixture'},args=>{
      const key=args.path;
      let contents;
      if(key==='next/link') contents=`import React from'react';export default React.forwardRef(({children,...props},ref)=><a {...props} ref={ref}>{children}</a>);`;
      else if(key==='next/navigation') contents=`export const usePathname=()=>location.pathname;`;
      else if(key.endsWith('navigation-context')) contents=`export const useNavigation=()=>({goBack:href=>location.assign(href)});`;
      else if(key.endsWith('auth-context')) contents=`export const useAuth=()=>({isAuthenticated:true,user:{id:globalThis.__actor==='Staff'?'staff-login':'manager',staffId:globalThis.__actor==='Staff'?'staff-one':undefined,role:globalThis.__actor||'Admin'}});`;
      else if(key.endsWith('use-permissions')) contents=`export const usePermissions=()=>({canPerformAction:()=>globalThis.__actor!=='Staff'});`;
      else if(key.endsWith('use-staff')) contents=`export const useStaffById=()=>({data:{firstName:'Ada',lastName:'Staff'}});`;
      else if(key.endsWith('use-academic-years')) contents=`export const useAcademicYears=()=>({data:[{id:'2026',name:'2026',terms:[{id:'term-three',name:'Term Three',startDate:'2026-09-07',endDate:'2026-12-04',isCurrent:true}]}]});`;
      else if(key.endsWith('use-school-settings')) contents=`import{useQuery}from'@tanstack/react-query';export const dashboardDataRevisionKeys={all:['details-revisions']};export const useSchoolSettings=()=>({data:{generalInfo:{name:'Trinity Family School'}}});export const useDashboardDataRevisions=()=>useQuery({queryKey:['details-revisions'],enabled:false,initialData:{staffClockingConfig:0,staffClockingRecords:0,staffClockingRequests:0,staff:0,events:0}});`;
      else if(key.endsWith('firebase')) contents=`export const db={};export const auth={get currentUser(){return{uid:globalThis.__actor==='Staff'?'staff-login':'manager',getIdToken:async()=>'fixture'}}};`;
      else contents=`const values=new Map(JSON.parse(sessionStorage.getItem('detail-counters')||'[]')),watchers=new Map();globalThis.__listeners=0;export const doc=(_db,_collection,id)=>({id});export const onSnapshot=(ref,_options,next)=>{globalThis.__listeners++;const set=watchers.get(ref.id)||new Set();set.add(next);watchers.set(ref.id,set);const snapshot=value=>({exists:()=>true,data:()=>value,metadata:{fromCache:false}});queueMicrotask(()=>next(snapshot(values.get(ref.id)||{})));globalThis.__personalRevision=(id,value)=>{values.set(id,value);sessionStorage.setItem('detail-counters',JSON.stringify([...values]));watchers.get(id)?.forEach(fn=>fn(snapshot(value)));};return()=>{globalThis.__listeners--;set.delete(next);};};`;
      return{contents,resolveDir:process.cwd(),loader:key==='next/link'?'jsx':'js'};
    });
  }}]});
  const server=http.createServer((req,res)=>{
    if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(result.outputFiles[0].contents);}
    else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(fs.readFileSync(cssPath));}
    else{res.setHeader('Content-Type','text/html');res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>:root{--background:210 40% 98%;--foreground:222 47% 11%;--card:0 0% 100%;--card-foreground:222 47% 11%;--primary:221 83% 53%;--primary-foreground:0 0% 100%;--border:214 32% 91%;--input:214 32% 91%;--muted:210 40% 96%;--muted-foreground:215 16% 47%;--ring:221 83% 53%}.dark{--background:222 47% 11%;--foreground:210 40% 98%;--card:222 47% 11%;--card-foreground:210 40% 98%;--border:217 33% 25%;--input:217 33% 25%;--muted:217 33% 17%;--muted-foreground:215 20% 70%}body{background:hsl(var(--background));color:hsl(var(--foreground))}</style></head><body><div id="root"></div><script>window.__actor=new URLSearchParams(location.search).get("actor")||"Admin"</script><script src="/bundle.js"></script></body></html>');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser, page;
  try{
    browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
    page=await browser.newPage({viewport:{width:1440,height:1000}});await page.clock.install({time:new Date('2026-10-26T10:00:00Z')});
    const calls=[],errors=[],mutations=[];
    page.on('pageerror',error=>{errors.push(error.message);console.error('Browser error:',error.message);});
    const schedule={id:'school',scope:'school',kind:'recurring',weekdays:[1,2,3,4,5],clockInBy:'07:30',clockOutBy:'17:00',graceMinutes:10,isActive:true,availableFrom:'2026-10-01'};
    const plan={staffId:'staff-one',groups:['Teaching'],stableSince:'2026-10-01',schedules:[schedule],closures:[]};
    const records=[['2026-10-20','07:25','on_time'],['2026-10-21','07:35','grace'],['2026-10-22','07:52','late'],['2026-10-26','07:28','on_time']].map(([localDate,clockInTime,arrivalStatus])=>({id:localDate,staffId:'staff-one',accountId:'staff-login',localDate,clockInTime,clockInAt:`${localDate}T${clockInTime}:00+03:00`,clockOutTime:localDate.endsWith('26')?undefined:'17:05',status:localDate.endsWith('26')?'open':'complete',arrivalStatus,scheduleSnapshot:{...schedule,groups:['Teaching']}}));
    let dateRevision=0,exemptionStatus='approved';
    await page.route('**/api/staff-clocking/**',async route=>{
      const url=new URL(route.request().url()),part=url.searchParams.get('part'),actor=url.searchParams.get('actor');
      if(route.request().method()==='POST'){const input=route.request().postDataJSON();mutations.push(input);if(input.action==='cancel_exemption') exemptionStatus='cancelled';await route.fulfill({json:{success:true,result:{id:'saved'}}});await page.evaluate(value=>window.__personalRevision('staff-one',{requests:value,dates:{'2026-10-22':value}}),++dateRevision);return;}
      calls.push({part,from:url.searchParams.get('from'),to:url.searchParams.get('to')});
      const own=await page.evaluate(()=>window.__actor==='Staff');
      const profile={staff:{id:'staff-one',name:'Ada Staff',employeeId:'TCH-0024',groups:['Teaching'],roles:['Teacher'],status:'active',email:'ada@example.test',phone:'0700000000'},permissions:{own,profile:!own,export:true,manage:!own,exempt:!own,request:true,explain:own,audit:true,reviewExemptions:!own,reviewCorrections:!own,reviewExplanations:!own}};
      const data=part==='profile'?profile:part==='plan'?plan:part==='today'?{localDate:'2026-10-26',record:records[3]}:part==='history'?{records:records.filter(record=>record.localDate>=url.searchParams.get('from')&&record.localDate<=url.searchParams.get('to'))}:part==='requests'||part==='exemptions'?{requests:[{id:'request-one',kind:part==='exemptions'?'exemption':'correction',status:'pending',localDate:'2026-10-22',reason:'Attendance correction request',createdBy:{id:'someone-else',name:'Teacher'}}]}:part==='audit'?{events:[{id:'event-one',type:'clock_in',localTime:'07:52',localDate:'2026-10-22',occurredAt:'2026-10-22T04:52:00Z'}]}:{profile,rows:[],generatedAt:'2026-10-26T10:00:00Z'};
      if(part==='export') data.rows=records.map(record=>({date:record.localDate,status:record.arrivalStatus,dayType:'normal',scheduled:true,expectedIn:'07:30',expectedOut:'17:00',graceMinutes:10,recordedGroup:'Teaching',record}));
      if(part==='exemptions') data.requests[0]={...data.requests[0],status:exemptionStatus,reason:'Approved external school duty'};
      if(part==='history') data.verifiedAt='2026-10-26T10:00:00Z';
      const revisionData=part==='revisions'?{shared:{staffClockingConfig:0,staffClockingRecords:0,staffClockingRequests:0,staff:0,events:0},personal:await page.evaluate(()=>JSON.parse(sessionStorage.getItem('detail-counters')||'[]').find(([id])=>id==='staff-one')?.[1]||{})}:undefined;
      await route.fulfill({json:{success:true,result:revisionData||data}});
    });
    const base=`http://127.0.0.1:${server.address().port}`;
    await page.goto(`${base}/staff-one?period=month&from=2026-10-26&to=2026-10-31`);await page.getByRole('heading',{name:'Ada Staff',exact:true}).waitFor();await page.getByRole('button',{name:'Details for 2026-10-01'}).waitFor();
    // Match the shared app content gutter: the glass header intentionally
    // extends into this space on all pages.
    await page.addStyleTag({content:'#root{padding-inline:12px}@media(min-width:768px){#root{padding-inline:24px}}'});
    assert.equal(calls.length,4,'Only profile, plan, today and the current month load initially');
    assert.equal(await page.getByRole('tablist',{name:'Staff clocking details'}).evaluate(element=>!!element.closest('.glass-page-topbar')),true,'Desktop section navigation must be inside the shared glass top bar');
    assert.equal(await page.locator('main [role="tablist"]').count(),0,'Do not repeat section navigation inside the page');
    assert.equal(await page.evaluate(()=>window.__listeners),1,'All personal sections share one revision listener');
    await page.getByRole('combobox',{name:'Dates per page'}).selectOption('50');
    await page.screenshot({path:path.join(output,'staff-details-desktop.png'),fullPage:true});
    await page.getByRole('button',{name:/Attended$/}).click();assert.equal(await page.getByRole('button',{name:'Details for 2026-10-01'}).count(),0);await page.getByRole('button',{name:'Details for 2026-10-22'}).waitFor();await page.getByRole('button',{name:'Clear filters',exact:true}).click();
    await page.getByRole('combobox',{name:'Attendance status',exact:true}).selectOption('late');
    await page.getByRole('button',{name:'Details for 2026-10-22'}).waitFor();assert.equal(calls.length,4,'Local filters must not request attendance again');
    await page.getByRole('button',{name:'Save preset',exact:true}).click();await page.getByRole('button',{name:'Clear filters',exact:true}).click();await page.getByRole('button',{name:'Load preset',exact:true}).click();assert.equal(await page.getByLabel('Attendance status',{exact:true}).inputValue(),'late');
    await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('menuitem',{name:'Export attendance',exact:true}).click();
    const csvDownload=page.waitForEvent('download');await page.getByRole('button',{name:'CSV (opens in Excel)',exact:true}).click();const csvFile=await csvDownload;const csvPath=path.join(output,'individual-attendance.csv');await csvFile.saveAs(csvPath);const csvText=fs.readFileSync(csvPath,'utf8');assert.ok(csvText.includes('2026-10-22'));assert.ok(!csvText.includes('2026-10-20'));assert.ok(!csvText.includes('Attendance correction request'));
    await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('menuitem',{name:'Export attendance',exact:true}).click();const pdfDownload=page.waitForEvent('download');await page.getByRole('button',{name:'PDF',exact:true}).click();const pdfFile=await pdfDownload;const pdfPath=path.join(output,'individual-attendance.pdf');await pdfFile.saveAs(pdfPath);const pdfText=fs.readFileSync(pdfPath,'latin1');assert.ok(pdfText.startsWith('%PDF'));assert.ok(pdfText.includes('2026-10-22'));assert.ok(!pdfText.includes('2026-10-20'));
    await page.getByRole('button',{name:'More',exact:true}).click();const popup=page.waitForEvent('popup');await page.getByRole('menuitem',{name:'Print report',exact:true}).click();const printPage=await popup;await printPage.getByRole('heading',{name:'Trinity Family School',exact:true}).waitFor();assert.equal(await printPage.locator('tbody tr').count(),1);assert.ok((await printPage.locator('tbody').innerText()).includes('2026-10-22'));await printPage.close();
    await page.getByRole('button',{name:'Clear filters',exact:true}).click();
    await page.getByRole('tab',{name:'Attendance History'}).focus();await page.keyboard.press('ArrowRight');await page.getByLabel("This week's effective schedule").waitFor();assert.equal(calls.filter(call=>call.part!=='export').length,4,'Schedule tab reuses its saved plan');
    await page.getByRole('tab',{name:'Requests & Reviews'}).click();await page.getByText('Attendance correction request',{exact:true}).waitFor();assert.equal(calls.filter(call=>call.part==='requests').length,1);
    await page.getByRole('button',{name:'Approve',exact:true}).click();await page.waitForFunction(()=>window.__listeners===1);await page.waitForTimeout(100);assert.equal(mutations[0].action,'review');
    await page.getByRole('tab',{name:'Attendance History'}).click();await page.getByRole('button',{name:'Calendar view',exact:true}).click();await page.getByLabel('Attendance calendar').waitFor();
    await page.getByRole('button',{name:/Thu, 22 Oct 2026.*Late/}).click();await page.getByRole('dialog').waitFor();await page.getByText('Original arrival',{exact:true}).waitFor();await page.getByRole('button',{name:'Close',exact:true}).click();
    await page.getByRole('button',{name:'Away',exact:true}).click();const count=calls.length;await page.getByRole('button',{name:'Return',exact:true}).click();await page.getByRole('heading',{name:'Ada Staff',exact:true}).waitFor();await page.waitForTimeout(100);assert.equal(calls.length,count,'Returning does not reread unchanged sections');
    await page.reload();await page.getByRole('button',{name:'Details for 2026-10-01'}).waitFor();const refreshed=calls.length;
    assert.equal(refreshed,count,'Reload restores unchanged persistent snapshots without another attendance request');
    await page.getByRole('button',{name:'Week',exact:true}).click();await page.getByRole('button',{name:'Details for 2026-10-26'}).waitFor();
    await page.getByRole('button',{name:'Month',exact:true}).click();await page.getByRole('button',{name:'Details for 2026-10-01'}).waitFor();assert.equal(calls.length,refreshed+1,'This boundary week only fetches the previously unseen November bucket');
    assert.equal(calls.filter(call=>call.part==='history'&&call.from==='2026-11-01').length,1);
    await page.evaluate(()=>window.__personalRevision('unrelated-staff',{dates:{'2026-10-26':2}}));await page.waitForTimeout(100);assert.equal(calls.length,refreshed+1,'Another employee cannot invalidate this profile');
    await page.getByRole('button',{name:'Term',exact:true}).click();await page.getByRole('button',{name:/2026-09 On time/}).waitFor();assert.equal(calls.filter(call=>call.part==='history'&&call.from==='2026-09-01').length,1);
    const historyReads=calls.filter(call=>call.part==='history').length;await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('menuitem',{name:'Check for updates',exact:true}).click();await page.getByRole('status').filter({hasText:'Change counters checked'}).waitFor();assert.equal(calls.filter(call=>call.part==='revisions').length,1);assert.equal(calls.filter(call=>call.part==='history').length,historyReads,'An unchanged metadata check must not reread attendance');
    await page.goto(`${base}/staff-one?actor=Staff&period=month&from=2026-10-26&to=2026-10-31`);await page.getByRole('heading',{name:'Ada Staff',exact:true}).waitFor();await page.getByRole('combobox',{name:'Dates per page'}).selectOption('50');
    await page.addStyleTag({content:'#root{padding-inline:12px}@media(min-width:768px){#root{padding-inline:24px}}'});
    await page.getByRole('button',{name:'Details for 2026-10-22'}).click();await page.getByRole('button',{name:'Explain lateness',exact:true}).click();
    const form=page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'Explain lateness',exact:true})});await form.getByLabel('Reason',{exact:true}).fill('Transport disruption on route');await form.getByRole('button',{name:'Save request',exact:true}).click();await page.waitForTimeout(100);assert.equal(mutations.at(-1).action,'explain');await page.getByRole('button',{name:'Close',exact:true}).click();
    await page.getByRole('tab',{name:'Requests & Reviews'}).click();await page.getByText('Attendance correction request',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Approve',exact:true}).count(),0,'Staff cannot approve requests');
    await page.setViewportSize({width:390,height:844});await page.getByRole('tab',{name:'Attendance History'}).click();await page.evaluate(()=>window.scrollTo(0,0));
    await page.getByRole('button',{name:'View today\'s clocking details',exact:true}).waitFor();
    assert.equal(await page.getByText('ada@example.test',{exact:true}).count(),0,'Mobile profile must not show contact information');
    const mobileHistoryReads=calls.filter(call=>call.part==='history').length;
    const sectionY=await page.evaluate(()=>['[aria-label="Employee profile"]','[aria-label="Reporting period"]','[aria-label="Attendance summary"]','[role="tabpanel"]'].map(selector=>document.querySelector(selector).getBoundingClientRect().top));
    assert.ok(sectionY.every((y,index)=>index===0||y>sectionY[index-1]),'Mobile content must be profile, period, statistics, history');
    const floatingSections=page.getByRole('tablist',{name:'Staff clocking details'});assert.equal(await floatingSections.evaluate(element=>!!element.closest('.glass-navigation-floating')),true,'Phone sections must use the shared floating navigation bar');assert.equal(await page.locator('main [role="tablist"]').count(),0);assert.equal(await floatingSections.getByRole('tab').count(),5);await page.clock.runFor(650);
    // Playwright's school-date clock advances JavaScript timers but not the
    // browser's native Web Animation timeline. Settle those for visual checks.
    await page.evaluate(()=>document.getAnimations().forEach(animation=>{if(animation.effect?.getTiming().iterations!==Infinity) animation.finish();}));await page.clock.runFor(50);
    const selectedIndicator=page.locator('.glass-navigation-floating .glass-navigation-indicator');const indicatorStyle=await selectedIndicator.evaluate(element=>({opacity:getComputedStyle(element).opacity,background:getComputedStyle(element).backgroundImage}));assert.ok(Number(indicatorStyle.opacity)>0.9&&indicatorStyle.background!=='none',`The selected section must have a visible shared navigation indicator: ${JSON.stringify(indicatorStyle)}`);
    const tiles=page.getByRole('region',{name:'Attendance summary'}).getByRole('button');assert.equal(await tiles.count(),6);const boxes=await tiles.evaluateAll(elements=>elements.map(element=>element.getBoundingClientRect().toJSON()));assert.equal(boxes[0].top,boxes[2].top);assert.ok(boxes[3].top>boxes[2].top);
    const compactProfile=await page.getByRole('region',{name:'Employee profile'}).boundingBox();assert.ok(compactProfile.height<=88,'Profile must stay compact with an inline status badge');const compactStats=await page.getByRole('region',{name:'Attendance summary'}).boundingBox();assert.ok(compactStats.height<=128,'Six tiles must fit in two compact rows');const compactRows=await page.getByRole('button',{name:/^Details for/}).evaluateAll(elements=>elements.slice(0,5).map(element=>element.getBoundingClientRect().toJSON()));assert.equal(compactRows.length,5);assert.ok(compactRows.every(box=>box.height<=64),'Attendance records must use short single-row cards');assert.ok(compactRows[4].bottom<=844,'At least five attendance rows should fit in the first 390px-wide screen');
    await page.screenshot({path:path.join(output,'staff-details-mobile-light-viewport.png')});
    await page.getByRole('button',{name:'Select reporting period',exact:true}).click();let dateSheet=page.getByRole('dialog',{name:'Choose reporting period',exact:true});await dateSheet.getByLabel('Month and year',{exact:true}).fill('2026-09');assert.equal(calls.filter(call=>call.part==='history').length,mobileHistoryReads,'Editing a month draft must not request another month');await page.keyboard.press('Escape');await page.getByRole('button',{name:'Select reporting period',exact:true}).click();dateSheet=page.getByRole('dialog',{name:'Choose reporting period',exact:true});assert.equal(await dateSheet.getByLabel('Month and year',{exact:true}).inputValue(),'2026-10');await dateSheet.getByRole('button',{name:'Apply period',exact:true}).click();assert.equal(calls.filter(call=>call.part==='history').length,mobileHistoryReads,'Applying an unchanged month must reuse the cached records');
    await page.getByRole('button',{name:/^Filter records/}).click();let filterSheet=page.getByRole('dialog',{name:'Filter Records'});await filterSheet.waitFor();
    await filterSheet.getByLabel('Attendance status',{exact:true}).selectOption('late');assert.equal(await page.getByRole('button',{name:'Apply Filters',exact:true}).isVisible(),true);assert.equal(calls.filter(call=>call.part==='history').length,mobileHistoryReads,'Editing filter drafts must not read attendance');
    await page.setViewportSize({width:844,height:390});assert.equal(await filterSheet.getByLabel('Attendance status',{exact:true}).inputValue(),'late','Rotating the phone must retain the filter draft');const rotatedApply=await filterSheet.getByRole('button',{name:'Apply Filters',exact:true}).boundingBox();assert.ok(rotatedApply.y+rotatedApply.height<=390,'Filter actions must remain visible in landscape');await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'staff-details-mobile-filters-light.png')});await page.keyboard.press('Escape');
    await page.getByRole('button',{name:/^Filter records/}).click();filterSheet=page.getByRole('dialog',{name:'Filter Records'});assert.equal(await filterSheet.getByLabel('Attendance status',{exact:true}).inputValue(),'all','Closing without Apply discards the draft');
    await filterSheet.getByLabel('Attendance status',{exact:true}).selectOption('late');await filterSheet.getByRole('button',{name:'Apply Filters',exact:true}).click();await page.getByRole('button',{name:'Details for 2026-10-22'}).waitFor();assert.equal(await page.getByRole('button',{name:'Details for 2026-10-01'}).count(),0);
    await page.getByRole('button',{name:'Clear filters',exact:true}).click();
    await page.getByRole('button',{name:'Late 1',exact:true}).click();await page.getByRole('button',{name:'Details for 2026-10-22'}).waitFor();await page.getByRole('button',{name:'Details for 2026-10-22'}).click();const dailySheet=page.getByRole('dialog');await dailySheet.waitFor();const dailyBox=await dailySheet.boundingBox();assert.ok(Math.abs(dailyBox.x)<1&&Math.abs(dailyBox.width-390)<1&&dailyBox.y+dailyBox.height<=845,'Daily details must be a full-width bottom sheet');await page.screenshot({path:path.join(output,'staff-details-mobile-record-sheet.png')});await dailySheet.getByRole('button',{name:'Request correction',exact:true}).click();const correctionSheet=page.getByRole('dialog',{name:'Request correction',exact:true});await correctionSheet.waitFor();assert.equal(await correctionSheet.getByLabel('Proposed arrival',{exact:true}).inputValue(),'07:52');await page.keyboard.press('Escape');await page.getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('button',{name:'Clear filters',exact:true}).click();
    await page.getByRole('button',{name:'Week',exact:true}).click();await page.getByRole('button',{name:'Details for 2026-10-26',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:/^Details for/}).count(),7,'Weekly mode shows seven compact days');
    await page.getByRole('button',{name:'Term',exact:true}).click();await page.getByLabel('Term monthly summaries').waitFor();assert.equal(await page.locator('[aria-label="Term monthly summaries"] details[open]').count(),0);await page.locator('[aria-label="Term monthly summaries"] summary').filter({hasText:'October 2026'}).click();await page.getByRole('button',{name:'Details for 2026-10-22'}).waitFor();assert.equal(calls.filter(call=>call.part==='history').length,mobileHistoryReads+3,'The teacher loads only the three months not previously requested under their own account');
    await page.getByRole('button',{name:'Month',exact:true}).click();await page.evaluate(()=>{document.documentElement.classList.add('dark');window.scrollTo(0,0);});await page.screenshot({path:path.join(output,'staff-details-mobile-dark.png'),fullPage:true});
    await page.screenshot({path:path.join(output,'staff-details-mobile-dark-viewport.png')});
    await page.getByRole('button',{name:/^Filter records/}).click();filterSheet=page.getByRole('dialog',{name:'Filter Records'});await filterSheet.getByLabel('Minimum late minutes',{exact:true}).fill('12');const applyBox=await filterSheet.getByRole('button',{name:'Apply Filters',exact:true}).boundingBox();assert.ok(applyBox.y>=0&&applyBox.y+applyBox.height<=844,'Apply stays visible while filters scroll');await page.screenshot({path:path.join(output,'staff-details-mobile-filters-dark.png')});await filterSheet.getByRole('button',{name:'Reset',exact:true}).click();assert.equal(await filterSheet.getByLabel('Minimum late minutes',{exact:true}).inputValue(),'');await filterSheet.getByRole('button',{name:'Apply Filters',exact:true}).click();
    await page.setViewportSize({width:320,height:720});await page.evaluate(()=>window.scrollTo(0,0));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'320px screen must fit without horizontal scrolling');await page.screenshot({path:path.join(output,'staff-details-mobile-320-dark.png')});
    await page.getByRole('tab',{name:'Requests & Reviews'}).click();await page.getByRole('button',{name:/^correction/i}).click();const requestSheet=page.getByRole('dialog',{name:'correction details',exact:true});await requestSheet.getByText('Attendance correction request',{exact:true}).waitFor();assert.equal(await requestSheet.getByRole('button',{name:'Approve',exact:true}).count(),0,'Staff review sheets must hide manager-only actions');await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'Mobile detail page must not overflow horizontally');
    await page.getByRole('button',{name:'More',exact:true}).click();assert.equal(await page.getByRole('menuitem',{name:'Record exemption',exact:true}).count(),0);await page.keyboard.press('Escape');
    await page.goto(`${base}/staff-one?period=month&from=2026-10-26&to=2026-10-31`);await page.addStyleTag({content:'#root{padding-inline:12px}@media(min-width:768px){#root{padding-inline:24px}}'});await page.getByRole('heading',{name:'Ada Staff',exact:true}).waitFor();await page.getByRole('tab',{name:'Exemptions & Leave'}).click();await page.getByRole('button',{name:/^exemption/i}).click();const exemptionSheet=page.getByRole('dialog',{name:'exemption details',exact:true});await exemptionSheet.getByText('Approved external school duty',{exact:true}).waitFor();await exemptionSheet.getByRole('button',{name:'Cancel exemption',exact:true}).click();const cancelSheet=page.getByRole('dialog',{name:'Cancel exemption',exact:true});await cancelSheet.getByLabel('Reason for cancellation',{exact:true}).fill('School duty cancelled by manager');await cancelSheet.getByRole('button',{name:'Confirm cancellation',exact:true}).click();await page.locator('article').getByText('cancelled',{exact:true}).waitFor();assert.equal(mutations.at(-1).action,'cancel_exemption');assert.equal(mutations.at(-1).reason,'School duty cancelled by manager');
    await page.goto(`${base}/staff-two?actor=Staff`);await page.getByRole('alert').filter({hasText:'permission'}).waitFor();assert.equal(await page.getByRole('heading',{name:'Ada Staff',exact:true}).count(),0);
    for (const width of [1440,390]) {
      await page.setViewportSize({width,height:width===1440?1000:844});
      await page.goto(`${base}/staff-one`);
      await page.getByRole('button',{name:'Details for 2026-10-26',exact:true}).waitFor();
      assert.equal(await page.getByRole('button',{name:'Week',exact:true}).getAttribute('aria-pressed'),'true','Direct visits default to Week');
      assert.equal(await page.getByRole('button',{name:'Day',exact:true}).count(),0,'Day is removed from both screen sizes');
      assert.equal(await page.getByText('Reporting date',{exact:true}).count(),0,'No separate reporting date field');
      const picker=page.getByRole('button',{name:'Select reporting period',exact:true});
      assert.match(await picker.innerText(),width===1440?/26 Oct 2026.*1 Nov 2026/:/26 Oct.*1 Nov/,'Week control shows both dates');
      if(width===1440){
        assert.equal(await page.getByText('Employment status and attendance status are separate.',{exact:true}).count(),0);
        assert.equal(await page.getByText('ada@example.test',{exact:true}).count(),0,'Desktop duplicate contact card is removed');
        const chips=page.locator('.glass-summary-bar button');assert.equal(await chips.count(),7);assert.ok((await chips.first().boundingBox()).height<30,'Desktop uses compact shared summary chips');
        await picker.getByText('Today',{exact:false}).click();
      }else await picker.click();
      let periodDialog=page.getByRole('dialog',{name:'Choose reporting period',exact:true});
      assert.equal(await periodDialog.getByLabel('Week date range',{exact:true}).inputValue(),'2026-10-26');
      const periodReads=calls.filter(call=>call.part==='history').length;
      await periodDialog.getByLabel('Calendar year',{exact:true}).fill('2025');
      assert.equal(await periodDialog.getByLabel('Week date range',{exact:true}).inputValue(),'2024-12-30','Changing year also changes the selected week draft');
      assert.equal(calls.filter(call=>call.part==='history').length,periodReads,'Picker drafts do not read attendance');
      await page.keyboard.press('Escape');await picker.click();periodDialog=page.getByRole('dialog',{name:'Choose reporting period',exact:true});
      await periodDialog.getByLabel('Week date range',{exact:true}).selectOption('2026-10-19');
      await periodDialog.getByRole('button',{name:'Apply period',exact:true}).click();
      await page.getByRole('button',{name:'Details for 2026-10-19',exact:true}).waitFor();
      assert.equal(calls.filter(call=>call.part==='history').length,periodReads,'Another week in a cached month needs no new read');
      assert.match(await picker.innerText(),width===1440?/19 Oct 2026.*25 Oct 2026/:/19 Oct.*25 Oct/);
      await page.getByRole('button',{name:'Month',exact:true}).click();await picker.click();
      periodDialog=page.getByRole('dialog',{name:'Choose reporting period',exact:true});await periodDialog.getByLabel('Month and year',{exact:true}).waitFor();await page.keyboard.press('Escape');
      await page.getByRole('button',{name:'Term',exact:true}).click();await picker.click();
      periodDialog=page.getByRole('dialog',{name:'Choose reporting period',exact:true});await periodDialog.getByLabel('Academic term',{exact:true}).waitFor();await page.keyboard.press('Escape');
      await page.goto(`${base}/staff-one?period=day&from=2026-10-26&to=2026-10-26`);
      await page.getByRole('button',{name:'Details for 2026-10-26',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Week',exact:true}).getAttribute('aria-pressed'),'true','Legacy day links open the containing week');
      await page.addStyleTag({content:'#root{padding-inline:12px}@media(min-width:768px){#root{padding-inline:24px}}'});
      await page.clock.runFor(650);await page.evaluate(()=>document.getAnimations().forEach(animation=>{if(animation.effect?.getTiming().iterations!==Infinity) animation.finish();}));
      await page.screenshot({path:path.join(output,`staff-details-week-${width}.png`),fullPage:true});
      if(width===1440){await page.evaluate(()=>document.documentElement.classList.add('dark'));await page.screenshot({path:path.join(output,'staff-details-week-desktop-dark.png'),fullPage:true});}
    }
    assert.deepEqual(errors,[]);
    console.log('PASS desktop and mobile 320/390px light/dark layouts, compact profile and six stats, draft/apply/reset filter sheets, bottom-sheet daily details, keyboard tabs, local filters/presets, month cache reuse, weekly/expandable term views, exports, lazy reviews/audit, correction/explanation actions and employee isolation');
  } catch(error){console.error(error);if(page){console.error((await page.locator('body').innerText()).slice(0,4500));await page.screenshot({path:path.join(output,'staff-details-failure.png'),fullPage:true});}throw error;}
  finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
