/* Actual welcome component, CSS and hydration; synthetic users/settings only. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/dashboard-welcome-qa');
const palette = require('../tests/fixtures/android-device-palette.json');
const authMock = `import {createContext,useContext} from 'react';export const FixtureAuthContext=createContext({user:null});export const FixtureCalendarContext=createContext({events:{data:[]},exams:{data:[]},holidays:{data:[]}});export const useAuth=()=>useContext(FixtureAuthContext);`;
const calendarMock = `import {useContext} from 'react';import {FixtureCalendarContext} from '@/lib/contexts/auth-context';export const useEvents=()=>useContext(FixtureCalendarContext).events;export const useExamsAsEvents=()=>useContext(FixtureCalendarContext).exams;export const useUgandaHolidays=()=>useContext(FixtureCalendarContext).holidays;`;
const tree = `import React,{useState,useEffect} from 'react';
import {FixtureAuthContext,FixtureCalendarContext} from '@/lib/contexts/auth-context';
import {DashboardWelcomeWithEvents} from '@/components/dashboard/dashboard-welcome-with-events';
import {applyDevicePalette} from '@/lib/theme/device-colors';
function Fixture(){const [user,setUser]=useState({id:'amina',firstName:'Amina',username:'amina'}),[epoch,setEpoch]=useState(0),[events,setEvents]=useState([]),[access,setAccess]=useState(true),[settings,setSettings]=useState({generalInfo:{name:'TRINITY FAMILY NURSERY AND PRIMARY SCHOOL',motto:'GUIDING GROWTH, INSPIRING GREATNESS',logo:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="48" height="48"%3E%3Ccircle cx="24" cy="24" r="20" fill="%23008c45"/%3E%3C/svg%3E'}});
useEffect(()=>{window.setWelcomeUser=setUser;window.remountWelcome=()=>setEpoch(v=>v+1);window.setWelcomeSettings=setSettings;window.setWelcomeEvents=setEvents;window.setCalendarAccess=setAccess;window.applyWelcomePalette=applyDevicePalette;window.welcomeEffectRuns=(window.welcomeEffectRuns||0)+1;},[]);
return <FixtureAuthContext.Provider value={{user}}><FixtureCalendarContext.Provider value={{events:{data:events},exams:{data:[]},holidays:{data:[]}}}><DashboardWelcomeWithEvents key={epoch} schoolSettings={settings} enabled={access}/></FixtureCalendarContext.Provider><div data-testid="workspace" className="border p-6">Dashboard workspace</div></FixtureAuthContext.Provider>}
const tree=<React.StrictMode><Fixture/></React.StrictMode>;`;
async function build() {
  fs.mkdirSync(output, { recursive: true });
  const plugin = { name:'synthetic-auth', setup(b){b.onResolve({filter:/^@\/lib\/contexts\/auth-context$/},()=>({path:'auth',namespace:'fixture'}));b.onResolve({filter:/^@\/lib\/hooks\/use-classes$/},()=>({path:'classes',namespace:'fixture'}));b.onResolve({filter:/^@\/lib\/hooks\/(use-events-fixed|use-uganda-holidays)$/},()=>({path:'calendar',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='auth'?authMock:args.path==='classes'?`export const useClasses=()=>({data:Array.from({length:6},(_,i)=>({id:'p'+(i+1),code:'P.'+(i+1),name:'Primary '+(i+1)}))});`:calendarMock,loader:'tsx',resolveDir:root}));} };
  const shared = {absWorkingDir:root,stdin:{contents:'',resolveDir:root,loader:'tsx'},bundle:true,jsx:'automatic',alias:{'@':path.join(root,'src')},plugins:[plugin]};
  await esbuild.build({...shared,stdin:{...shared.stdin,contents:tree+`import {renderToString} from 'react-dom/server';module.exports=renderToString(tree);`},platform:'node',external:['react','react/*','react-dom','react-dom/*'],outfile:path.join(output,'server.cjs')});
  fs.writeFileSync(path.join(output,'markup.html'),require(path.join(output,'server.cjs')));
  for(const mode of ['production','development'])await esbuild.build({...shared,stdin:{...shared.stdin,contents:tree+`import {hydrateRoot} from 'react-dom/client';hydrateRoot(document.getElementById('app'),tree);`},platform:'browser',define:{'process.env.NODE_ENV':JSON.stringify(mode)},outfile:path.join(output,mode+'.js')});
  const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.join(root,'tailwind.config.ts'),'utf8'),{compilerOptions:{module:1}}).outputText)(require,mod,mod.exports);
  const css=['globals.css','theme.css','brand-theme.css'].map(f=>fs.readFileSync(path.join(root,'src/app',f),'utf8')).join('\n').replace(/^@import[^;]+;/,'');
  const result=await require('postcss')([require('tailwindcss')({...mod.exports.default,content:[{raw:tree,extension:'tsx'},path.join(root,'src/components/dashboard/dashboard-welcome-header.tsx'),path.join(root,'src/components/events/ui/exam-event-classes.tsx'),path.join(root,'src/components/ui/dialog.tsx')]})]).process(css,{from:path.join(root,'src/app/globals.css')});
  fs.writeFileSync(path.join(output,'fixture.css'),result.css);
  assert.ok(fs.readFileSync(path.join(root,'src/app/page.tsx'),'utf8').includes('<DashboardWelcomeWithEvents schoolSettings={schoolSettings} enabled={canViewCalendarSchedule} />'),'Real dashboard mounts the tested header behind calendar permission');
}
const snapshot=page=>page.evaluate(()=>{const header=document.querySelector('.dashboard-welcome-header'),g=header.querySelector('.dashboard-welcome-greeting'),i=header.querySelector('.dashboard-welcome-identity');return {greeting:header.dataset.greeting,text:g.textContent,opacity:getComputedStyle(i).opacity,greetingOpacity:getComputedStyle(g).opacity,workspaceY:document.querySelector('[data-testid="workspace"]').getBoundingClientRect().y,scrollWidth:document.documentElement.scrollWidth,width:innerWidth,transitions:[g,i,...header.querySelectorAll('img,.dashboard-welcome-text')].map(e=>({transform:getComputedStyle(e).transform,properties:getComputedStyle(e).transitionProperty,duration:getComputedStyle(e).transitionDuration}))};});
async function readable(page,selector){const colors=await page.locator(selector).evaluate(e=>[getComputedStyle(e).color,getComputedStyle(document.body).backgroundColor]);const lum=s=>s.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);const [a,b]=colors.map(lum);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,'Welcome text has readable theme contrast');}
async function run(){
  await build();const markup=fs.readFileSync(path.join(output,'markup.html'),'utf8');
  const server=http.createServer((req,res)=>{const name=req.url.slice(1);if(['production.js','development.js','fixture.css'].includes(name)){res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8');res.end(fs.readFileSync(path.join(output,name)));}else {res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><body class="bg-background text-foreground"><div id="app">'+markup+'</div><script src="/'+(req.url.includes('strict')?'development':'production')+'.js"></script>');}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:process.env.THEME_BROWSER_CHANNEL||'chrome'});
  const errors=[],reports=[];
  try{
    const check=async({width=1440,dark=false,preset='trinity-classic',device=false,reduced=false,strict=false,blocked=false}={})=>{
      const context=await browser.newContext({viewport:{width,height:900},timezoneId:'Africa/Nairobi',reducedMotion:reduced?'reduce':'no-preference'}),page=await context.newPage();
      page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      if(blocked)await page.addInitScript(()=>Object.defineProperty(window,'sessionStorage',{get(){throw new DOMException('Blocked','SecurityError');}}));
      await page.clock.install({time:new Date('2026-10-10T06:30:00Z')});await page.clock.pauseAt(new Date('2026-10-10T06:30:01Z'));
      await page.goto('http://127.0.0.1:'+server.address().port+(strict?'/strict':'/'));await page.locator('.dashboard-welcome-header').waitFor();
      await page.evaluate(({preset,dark,device,palette})=>{document.documentElement.dataset.appTheme=preset;document.documentElement.classList.toggle('dark',dark);window.applyWelcomePalette(palette,device);},{preset,dark,device,palette});
      await page.waitForTimeout(300);const start=await snapshot(page);assert.equal(start.greeting,'true');assert.ok(Number(start.greetingOpacity)>0.99);assert.ok(Number(start.opacity)<0.01);assert.match(start.text,/Good morning/);assert.match(start.text,/Amina/);assert.ok(start.scrollWidth<=width);
      await readable(page,'.dashboard-welcome-greeting p');
      if(strict)assert.equal(await page.evaluate(()=>window.welcomeEffectRuns),2,'Strict Mode effect replay is exercised');
      if(reduced)assert.ok(start.transitions.every(v=>v.transform==='none'&&v.duration==='0s'),'Reduced motion removes movement');
      else assert.ok(start.transitions.every(v=>!v.properties.includes('all')),'Only compositor properties animate');
      const name=[width,preset,dark?'dark':'light',device?'device':'preset',reduced?'reduce':'motion',strict?'strict':'production',blocked?'blocked':'storage'].join('-');
      await page.screenshot({path:path.join(output,name+'-greeting.png')});
      await page.clock.runFor(4500);assert.equal((await snapshot(page)).greeting,'true','Greeting remains visible for five seconds');
      await page.evaluate(()=>window.setWelcomeSettings(s=>({...s,generalInfo:{...s.generalInfo,name:'TRINITY FAMILY SCHOOL'}})));
      await page.waitForTimeout(30);await page.clock.runFor(500);await page.waitForTimeout(300);const settled=await snapshot(page);
      assert.equal(settled.greeting,'false','Data refresh does not restart the intro');assert.ok(Number(settled.opacity)>0.99);assert.ok(Number(settled.greetingOpacity)<0.01);assert.equal(settled.workspaceY,start.workspaceY,'Workspace does not jump during the reveal');assert.equal(await page.getByRole('heading',{level:1}).textContent(),'TRINITY FAMILY SCHOOL');
      assert.equal(await page.locator('.dashboard-welcome-logo').evaluate(e=>getComputedStyle(e).transform),'none','Logo finishes its slide in its normal position');await readable(page,'.dashboard-welcome-identity h1');
      await page.screenshot({path:path.join(output,name+'-school.png')});
      if(!blocked){await page.evaluate(()=>window.remountWelcome());await page.waitForTimeout(300);assert.equal((await snapshot(page)).greeting,'false','Return navigation does not repeat the greeting');await page.reload();await page.waitForTimeout(300);assert.equal((await snapshot(page)).greeting,'false','Reload keeps the session decision');}
      await page.evaluate(()=>window.setWelcomeUser({id:'another-user',username:'jane.smith'}));await page.waitForTimeout(300);const account=await snapshot(page);assert.equal(account.greeting,'true');assert.match(account.text,/jane/,'Account switch gets the correct name');
      await page.emulateMedia({media:'print'});const paper=await snapshot(page);assert.equal(paper.opacity,'1','School identity prints even while greeting is active');assert.equal(await page.locator('.dashboard-welcome-greeting').evaluate(e=>getComputedStyle(e).display),'none');
      await page.emulateMedia({media:'screen'});await page.evaluate(()=>window.setWelcomeUser(null));await page.waitForTimeout(300);assert.equal((await snapshot(page)).greeting,'false','Losing the account cancels its greeting');
      reports.push({name,start,settled});await context.close();
    };
    if(!process.env.DASHBOARD_EVENTS_ONLY){
      for(const width of [1440,390])for(const preset of ['trinity-classic','soft-indigo'])for(const dark of [false,true])await check({width,preset,dark});
      await check({width:360,dark:true,device:true});await check({width:390,device:true});await check({width:390,dark:true,reduced:true});await check({strict:true});await check({width:390,blocked:true});
    }
    const longTitle='Community learning week with reading workshops, science exhibitions and creative arts activities';
    for(const width of [360,1280])for(const dark of [false,true]){
      const context=await browser.newContext({viewport:{width,height:900},timezoneId:'Africa/Nairobi'}),page=await context.newPage();
      page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      await page.clock.install({time:new Date('2026-10-10T06:30:00Z')});await page.clock.pauseAt(new Date('2026-10-10T06:30:01Z'));
      await page.goto('http://127.0.0.1:'+server.address().port+'/strict');await page.locator('.dashboard-welcome-header').waitFor();
      await page.evaluate(({dark,longTitle})=>{
        document.documentElement.classList.toggle('dark',dark);
        const event=(id,title,startDate,endDate)=>({id,title,startDate,endDate,isAllDay:true,status:'Scheduled',isPublic:true});
        window.setWelcomeEvents([event('ongoing',longTitle,'2026-10-09','2026-10-12'),event('today','Parents visiting day','2026-10-10','2026-10-10'),...['Library tour','Staff planning meeting','Sports club'].map((title,i)=>({...event('later-'+i,title,'2026-10-11','2026-10-11'),description:'School calendar event',location:'Main campus'})),event('draft','Do not show this draft','2026-10-10','2026-10-10')].map(e=>e.id==='draft'?{...e,status:'Draft'}:e));
        window.setWelcomeEvents(items=>items.map(e=>e.id==='ongoing'?{...e,isExamEvent:true,classIds:['p1','p2','p3','p4','p5','p6']}:e.id==='later-0'?{...e,isExamEvent:true,classIds:['p6']}:e));
      },{dark,longTitle});
      await page.waitForTimeout(200);const start=await snapshot(page);
      await page.clock.runFor(4999);assert.equal((await snapshot(page)).greeting,'true');
      await page.clock.runFor(1);await page.waitForTimeout(250);
      assert.equal(await page.locator('.dashboard-welcome-header').getAttribute('data-phase'),'briefing');
      assert.ok(await page.getByText(longTitle,{exact:true}).isVisible());
      assert.equal(await page.locator('.dashboard-welcome-briefing [data-exam-classes]:visible').textContent(),'Classes: P.1, P.2, P.3, P.4, P.5, P.6');
      assert.ok(await page.getByText('It will end on Monday, 12 October.',{exact:true}).isVisible());
      assert.equal((await snapshot(page)).workspaceY,start.workspaceY,'Event slide reserves its space before the reveal');
      assert.ok((await snapshot(page)).scrollWidth<=width,'Briefing stays within viewport');
      const trigger=page.getByRole('button',{name:'You have 3 more events this week',exact:true});
      await trigger.click();const dialog=page.getByRole('dialog');assert.ok(await dialog.isVisible());
      assert.equal(await dialog.locator('li').count(),3);assert.equal(await dialog.getByText('Parents visiting day',{exact:true}).count(),0);
      assert.equal(await dialog.locator('[data-exam-classes]').textContent(),'Classes: P.6');
      assert.equal(await page.getByText('Do not show this draft',{exact:true}).count(),0);
      const panel=await dialog.locator('div').first().boundingBox();assert.ok(panel.width<=width&&panel.x>=0,'Popup fits the phone/desktop');
      await page.screenshot({path:path.join(output,`events-${width}-${dark?'dark':'light'}-popup.png`)});
      await page.clock.runFor(15000);assert.ok(await page.getByText(longTitle,{exact:true}).isVisible(),'Briefing pauses while the popup has focus');
      await page.keyboard.press('Escape');await page.clock.runFor(250);await page.waitForTimeout(350);await dialog.waitFor({state:'hidden',timeout:3000});
      // Radix restores focus in a timer after its exit animation unmounts.
      await page.clock.runFor(1);
      assert.equal(await trigger.evaluate(e=>e===document.activeElement),true,'Focus returns to the weekly-events button');
      await page.screenshot({path:path.join(output,`events-${width}-${dark?'dark':'light'}-briefing.png`)});
      await page.clock.runFor(29000);assert.ok(await page.getByText(longTitle,{exact:true}).isVisible(),'First of two events remains for its half of the minute');
      await page.clock.runFor(1000);assert.ok(await page.getByText('Parents visiting day',{exact:true}).isVisible(),'Second event gets the other half of the minute');
      await page.clock.runFor(29000);assert.equal(await page.locator('.dashboard-welcome-header').getAttribute('data-phase'),'briefing','School name stays hidden until the full briefing minute has elapsed');
      await page.clock.runFor(1000);await page.waitForTimeout(250);assert.equal(await page.locator('.dashboard-welcome-header').getAttribute('data-phase'),'identity');
      assert.equal((await snapshot(page)).workspaceY,start.workspaceY,'School identity retains the reserved height');
      assert.ok(await trigger.isVisible(),'Weekly events remain available after the school identity returns');
      await page.evaluate(()=>window.remountWelcome());await page.waitForTimeout(250);assert.equal(await page.locator('.dashboard-welcome-header').getAttribute('data-phase'),'identity','Same-day navigation does not replay the briefing');
      await page.evaluate(()=>window.setCalendarAccess(false));await page.waitForTimeout(250);assert.equal(await page.getByRole('button',{name:/more events this week/}).count(),0);assert.equal(await page.getByText(longTitle,{exact:true}).count(),0,'Calendar-restricted account does not mount event data/UI');
      reports.push({events:true,width,dark});await context.close();
    }
    {
      const context=await browser.newContext({viewport:{width:390,height:900},timezoneId:'Africa/Nairobi'}),page=await context.newPage();
      page.on('pageerror',e=>errors.push(e.message));
      await page.clock.install({time:new Date('2026-10-10T06:30:00Z')});await page.clock.pauseAt(new Date('2026-10-10T06:30:01Z'));
      await page.goto('http://127.0.0.1:'+server.address().port+'/strict');await page.locator('.dashboard-welcome-header').waitFor();
      await page.evaluate(()=>window.setWelcomeEvents([{id:'single',title:'School open day',startDate:'2026-10-10',endDate:'2026-10-10',isAllDay:true,status:'Scheduled',isPublic:true}]));
      await page.clock.runFor(5000);assert.equal(await page.locator('.dashboard-welcome-header').getAttribute('data-phase'),'briefing');
      await page.clock.runFor(59999);assert.equal(await page.locator('.dashboard-welcome-header').getAttribute('data-phase'),'briefing','A single event stays until the full minute has elapsed');
      await page.clock.runFor(1);await page.waitForTimeout(250);assert.equal(await page.locator('.dashboard-welcome-header').getAttribute('data-phase'),'identity','School identity follows the one-minute briefing');
      reports.push({singleEventMinute:true,width:390});await context.close();
    }
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({reports,errors},null,2));console.log('DASHBOARD_WELCOME_OK: five-second greeting, one-minute event briefing, multiple active events, future end date, three-event popup, keyboard focus, permission gating, themes, responsive layout, session revisit, account switch, Strict Mode, reduced motion and print.');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
