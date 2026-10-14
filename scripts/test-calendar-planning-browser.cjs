// Real FullCalendar, event form, toolbar and panels; synthetic service data only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const loadConfig = require('tailwindcss/loadConfig');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(os.tmpdir(), 'trinity-calendar-planning-browser');
fs.mkdirSync(output, { recursive: true });
const hooks = `
import {useEffect,useReducer,useState} from 'react';
const year={id:'2026',name:'2026',startDate:'2026-01-01',endDate:'2026-12-31',isActive:true,terms:[{id:'term-3',name:'Term 3',startDate:'2026-09-01',endDate:'2026-12-09'}]};
const years=[year];
const classes=[{id:'p4',name:'Primary Four',code:'P.4',classTeacherId:'staff-1',subjectAssignments:[]},{id:'p5',name:'Primary Five',code:'P.5',subjectAssignments:[]}];
const subjects=[{id:'maths',name:'Mathematics'}];
const base={type:'Academic',priority:'Medium',status:'Scheduled',startDate:'2026-10-14',endDate:'2026-10-14',startTime:'09:00',endTime:'10:00',isAllDay:false,location:'Main Hall',targetAudience:['Staff'],academicYearId:'2026',termId:'term-3',classIds:['p4'],recurrence:{frequency:'None'},isExamEvent:false,isRecurringInstance:false,reminders:[],notificationsSent:[],sendReminders:false,colorCode:'#3b82f6',requiresApproval:false,requiresAttendance:false,isPublic:true,createdBy:'fixture',createdByName:'Alice Organiser',createdAt:'2026-10-01'};
window.fixture={user:{id:'fixture',staffId:'staff-1',role:'Admin',firstName:'Alice'},offline:false,readOnly:false,failWrite:false,error:null,missing:false,calls:[],retries:0,
 events:[{...base,id:'meeting',title:'Staff planning meeting',type:'Administrative',description:'Review the assessment schedule.',requiresAttendance:true,expectedAttendees:['staff-1'],attachments:[{id:'doc',name:'Meeting agenda',url:'https://example.test/agenda.pdf'}]},
 {...base,id:'exam',title:'P.4 Mathematics examination',isExamEvent:true,startTime:'09:30',endTime:'11:00',examIntegration:{examIds:['linked-exam']},subjectIds:['maths']},
 {...base,id:'multi',title:'P.5 Field trip',startDate:'2026-10-16',endDate:'2026-10-18',isAllDay:true,type:'Co-curricular',classIds:['p5'],location:'Museum',targetAudience:['P5'],createdBy:'other'},
 {...base,id:'cancelled',title:'Cancelled rehearsal',startDate:'2026-10-15',endDate:'2026-10-15',status:'Cancelled',location:'Stage'},
 {...base,id:'draft',title:'Draft visiting day',startDate:'2026-10-20',endDate:'2026-10-20',status:'Draft',location:'',requiresApproval:true,approvalStatus:'Pending'},
 {...base,id:'sports',title:'Inter-house sports',startDate:'2026-10-21',endDate:'2026-10-21',type:'Co-curricular',location:'Sports field',targetAudience:['P5'],classIds:['p5'],createdBy:'other'},
 ...Array.from({length:6},(_,i)=>({...base,id:'busy-'+i,title:'Thursday activity '+(i+1),startDate:'2026-10-22',endDate:'2026-10-22',startTime:String(8+i).padStart(2,'0')+':00',endTime:String(9+i).padStart(2,'0')+':00',location:'Room '+i}))]};
const projection={...base,id:'exam-linked-exam',title:'Duplicate legacy exam',isExamEvent:true};
const exams=[projection];
const holidays=[{...base,id:'holiday',title:'Uganda Independence Day',startDate:'2026-10-09',endDate:'2026-10-09',isAllDay:true,type:'Holiday',classIds:[],academicYearId:'',termId:'',customFields:{isUgandaPublicHoliday:true},createdBy:'system',targetAudience:['All citizens']}];
function useChanges(){const [,update]=useReducer(n=>n+1,0);useEffect(()=>{window.addEventListener('fixture-change',update);return()=>window.removeEventListener('fixture-change',update);},[]);}
export const useAuth=()=>{useChanges();return {user:window.fixture.user,canPerformAction:(_module,_page,action)=>!window.fixture.readOnly || action.startsWith('view_')};};
export const useAndroidOfflineStatus=()=>{useChanges();return window.fixture.offline;};
export const useActiveAcademicYear=()=>({data:year});
export const useAcademicYearsForEvents=()=>({data:years});
export const useCurrentTerm=()=>({year,term:year.terms[0]});
export const useClasses=()=>({data:classes});
export const useSubjects=()=>({data:subjects});
export const useUgandaHolidays=()=>({data:holidays});
export const useExamsAsEvents=()=>({data:exams});
export const useEvents=()=>{useChanges();return {data:window.fixture.missing?undefined:window.fixture.events,isLoading:window.fixture.missing&&!window.fixture.error,error:window.fixture.error,isFetching:false,refetch:()=>{window.fixture.retries++;}};};
function useWrite(kind){const [pending,setPending]=useState(false);return {isPending:pending,mutateAsync:async value=>{setPending(true);window.fixture.calls.push({kind,value});try{await new Promise(resolve=>setTimeout(resolve,120));if(window.fixture.failWrite)throw new Error('Synthetic save failed. Your changes are still here.');if(kind==='update')window.fixture.events=window.fixture.events.map(event=>event.id===value.eventId?{...event,...value.data}:event);if(kind==='create')window.fixture.events=[...window.fixture.events,{...value,id:'created-'+window.fixture.calls.length}];if(kind==='delete')window.fixture.events=window.fixture.events.filter(event=>event.id!==value);window.dispatchEvent(new Event('fixture-change'));return value;}finally{setPending(false);}}};}
export const useCreateEvent=()=>useWrite('create');
export const useUpdateEvent=()=>useWrite('update');
export const useDeleteEvent=()=>useWrite('delete');
export const useCreateExamFromEvent=()=>useWrite('exam');
`;
const mocks = {
  hooks,
  auth: `export {useAuth} from 'fixture:hooks';`,
  navigation: `export const useNavigation=()=>({goBack(){},startNavigation(){}});export const useRouter=()=>({push(){},back(){}});export const usePathname=()=>'/events';`,
  link: `import React from 'react';export default React.forwardRef(({prefetch,...props},ref)=><a ref={ref} {...props}/>);`,
  toast: `export const toast=value=>{window.lastToast=value;};export const useToast=()=>({toast});`,
  calendar: `import React from 'react';import Calendar from ${JSON.stringify(require.resolve('@fullcalendar/react').replace(/\.cjs$/, '.js'))};export default React.forwardRef((props,ref)=>{window.calendarOptions=props;return <Calendar {...props} ref={ref}/>});`,
};
async function run() {
  const built = await esbuild.build({ absWorkingDir: root, outdir: output, stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import Page from './src/app/events/page';createRoot(document.getElementById('root')).render(<React.StrictMode><Page/></React.StrictMode>);`, loader: 'tsx', resolveDir: root }, bundle: true, write: false, platform: 'browser', jsx: 'automatic', alias: { '@': path.join(root, 'src') }, define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'fixtures', setup(builder) {
    builder.onResolve({ filter: /^fixture:hooks$/ }, () => ({ path: 'hooks', namespace: 'fixture' }));
    builder.onResolve({ filter: /^@\/lib\/hooks\/use-(events-fixed|uganda-holidays|academic-years|classes|subjects|android-offline-status)$/ }, () => ({ path: 'hooks', namespace: 'fixture' }));
    for (const [filter, name] of [[/^@\/lib\/contexts\/auth-context$/, 'auth'], [/^(next\/navigation|@\/lib\/contexts\/navigation-context)$/, 'navigation'], [/^next\/link$/, 'link'], [/^@\/hooks\/use-toast$/, 'toast'], [/^@fullcalendar\/react$/, 'calendar']]) builder.onResolve({ filter }, () => ({ path: name, namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'tsx', resolveDir: root }));
  } }] });
  const contentFiles = [];
  for (const dir of ['src/components/events', 'src/components/ui', 'src/components/common']) {
    const visit = dirPath => { for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) { const file = path.join(dirPath, entry.name); if (entry.isDirectory()) visit(file); else if (file.endsWith('.tsx')) contentFiles.push(file); } };
    visit(path.join(root, dir));
  }
  const config = loadConfig(path.join(root, 'tailwind.config.ts'));
  config.content = contentFiles.map(file => ({ raw: fs.readFileSync(file, 'utf8'), extension: 'tsx' })); config.safelist = [...(config.safelist || []), 'dark'];
  const css = (await postcss([tailwind(config)]).process(fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/^@import.*$/gm, ''), { from: path.join(root, 'src/app/globals.css') })).css
    + fs.readFileSync(path.join(root, 'src/app/theme.css'), 'utf8') + fs.readFileSync(path.join(root, 'src/app/brand-theme.css'), 'utf8') + built.outputFiles.find(file => file.path.endsWith('.css')).text;
  const server = http.createServer((req, res) => {
    if (req.url === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(built.outputFiles.find(file => file.path.endsWith('.js')).text); }
    if (req.url === '/fixture.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
    res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>School planning fixture</title><link rel="stylesheet" href="/fixture.css"><style>body{font-family:Arial}#root{min-width:0;padding:44px 12px 80px}@media(min-width:640px){#root{padding-top:52px}}@media(min-width:768px){#root{padding:52px 24px 32px}}@media(min-width:1024px){#root{margin-left:220px}}</style><div id="root"></div><script src="/fixture.js"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser, page;
  const checks = [];
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 1680, height: 1100 }, timezoneId: 'Africa/Kampala' });
    await context.addInitScript(() => { const NativeDate = Date; const fixed = new NativeDate('2026-10-14T09:00:00+03:00').getTime(); window.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [fixed])); } static now() { return fixed; } }; });
    page = await context.newPage(); const errors = []; page.on('pageerror', error => { errors.push(error.message); console.error(error.stack); });
    const url = 'http://127.0.0.1:' + server.address().port;
    const calendar = () => page.getByRole('region', { name: 'School planning calendar' });
    const options = () => page.getByRole('group', { name: 'Calendar view', exact: true });
    const event = title => calendar().locator('.fc-event').filter({ hasText: title }).first();
    const details = () => page.getByRole('region', { name: 'Event details', exact: true });
    const changeFixture = async change => page.evaluate(change);
    const emit = () => page.evaluate(() => window.dispatchEvent(new Event('fixture-change')));
    await page.goto(url); await calendar().locator('.fc-dayGridMonth-view').waitFor();
    assert.equal(await page.getByRole('region', { name: 'Upcoming and attention' }).count(), 1);
    assert.equal(await event('Duplicate legacy exam').count(), 0);
    assert.equal(await calendar().locator('.fc-day-today').getAttribute('data-date'), '2026-10-14');
    checks.push('Real calendar loads with upcoming activities, today highlighted, and no duplicate exam projection');
    await page.getByRole('button', { name: 'Next calendar period' }).click(); await calendar().getByRole('heading', { name: 'November 2026', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Today', exact: true }).click(); await calendar().getByRole('heading', { name: 'October 2026', exact: true }).waitFor();
    for (const view of ['Week', 'Day', 'Agenda', 'Term', 'Month']) {
      await options().getByRole('button', { name: view, exact: true }).click();
      if (view === 'Term') await page.getByRole('region', { name: 'Term planner', exact: true }).waitFor();
      else await calendar().locator('.fc-view').waitFor();
    }
    checks.push('Compact view control switches Month, Week, Day, Agenda and Term; date navigation follows the actual period');
    await page.getByRole('button', { name: /^Filters \(/ }).click();
    const filters = page.getByRole('complementary', { name: 'Calendar filters', exact: true });
    await filters.waitFor(); assert.equal(await filters.isVisible(), true);
    assert.equal(await page.getByRole('dialog').count(), 0, 'Wide desktop filters must not leave a hidden sheet overlay');
    await filters.getByRole('checkbox', { name: 'Academic', exact: true }).check();
    await filters.getByRole('checkbox', { name: 'Primary Four', exact: true }).check();
    await filters.getByRole('checkbox', { name: '2026 · Term 3', exact: true }).check();
    await page.getByRole('textbox', { name: 'Search calendar events' }).fill('mathematics');
    assert.equal(await calendar().locator('.fc-event').count(), 1);
    await filters.getByRole('textbox', { name: 'Personal view name' }).fill('P4 exams');
    await filters.getByRole('button', { name: 'Save current view', exact: true }).click();
    await filters.getByRole('button', { name: 'Reset all', exact: true }).click();
    await filters.getByRole('button', { name: 'P4 exams', exact: true }).click();
    assert.equal(await calendar().locator('.fc-event').count(), 1);
    await filters.getByRole('button', { name: 'Reset all', exact: true }).click();
    await page.getByRole('button', { name: /^Filters \(/ }).click();
    checks.push('Search and multiple filters combine; a personal filter view can be saved, reset and restored');
    await event('P.4 Mathematics examination').click(); await details().waitFor();
    assert.equal(await details().getByRole('link', { name: 'Open exam', exact: true }).getAttribute('href'), '/exams/linked-exam/view-results?classId=p4');
    assert.match(await details().innerText(), /Primary Four/); assert.match(await details().innerText(), /Main Hall/);
    await details().getByRole('button', { name: 'Close event details' }).click();
    await event('Staff planning meeting').click();
    assert.match(await details().innerText(), /Alice Organiser/);
    assert.equal(await details().getByRole('link', { name: 'Meeting agenda' }).count(), 1);
    assert.equal(await details().getByRole('link', { name: 'View attendance' }).count(), 1);
    checks.push('Event details show real metadata, resources, attendance and source exam links beside the calendar');
    await details().getByRole('button', { name: 'Edit / reschedule', exact: true }).click();
    const form = () => page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Edit Event', exact: true }) });
    await form().waitFor();
    await form().locator('#title').fill('Updated staff planning'); await form().locator('#location').fill('Room Two');
    await changeFixture(() => { window.fixture.failWrite = true; });
    await form().getByRole('button', { name: 'Update Event', exact: true }).click();
    await form().getByText('Synthetic save failed. Your changes are still here.', { exact: true }).first().waitFor();
    assert.equal(await form().locator('#title').inputValue(), 'Updated staff planning');
    await changeFixture(() => { window.fixture.failWrite = false; });
    await form().getByRole('button', { name: 'Update Event', exact: true }).click();
    await form().waitFor({ state: 'hidden' }); assert.match(await details().innerText(), /Updated staff planning/);
    assert.equal(await page.evaluate(()=>Object.prototype.hasOwnProperty.call(window.fixture.calls.filter(call=>call.kind==='update').at(-1).value.data,'createdBy')),false);
    checks.push('Actual event editor waits for save success, retains failed drafts and preserves creation metadata');
    await details().getByRole('button', {name:'Edit / reschedule',exact:true}).click();
    await form().locator('#location').fill('Main Hall');
    const beforeConflict=await page.evaluate(()=>window.fixture.calls.length);
    await form().getByRole('button',{name:'Update Event',exact:true}).click();
    await page.getByRole('alertdialog').getByRole('heading',{name:'Review scheduling conflicts',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.fixture.calls.length),beforeConflict);
    await page.getByRole('alertdialog').getByRole('button',{name:'Continue editing',exact:true}).click();
    await form().getByText('Save cancelled. Your changes are still here.',{exact:true}).first().waitFor();
    assert.equal(await form().locator('#location').inputValue(),'Main Hall');
    await form().getByRole('button',{name:'Cancel',exact:true}).click();
    checks.push('Conflicting edits warn before writing and cancellation preserves the editable draft');
    await page.getByRole('button',{name:'My calendar',exact:true}).click();
    assert.equal(await event('Inter-house sports').count(),0);
    assert.equal(await event('Updated staff planning').count(),1);
    await page.getByRole('button',{name:'School calendar',exact:true}).click();
    assert.equal(await event('Inter-house sports').count(),1);
    checks.push('Personal calendar includes assigned or invited activities and hides unrelated class activities');

    await event('P.5 Field trip').click(); await details().getByRole('button', { name: 'Edit / reschedule', exact: true }).click();
    await form().getByRole('button', { name: 'Continuous date range', exact: true }).waitFor();
    assert.equal(await form().getByRole('button', { name: 'Continuous date range', exact: true }).getAttribute('aria-pressed'), 'true');
    await form().getByRole('button', { name: 'Update Event', exact: true }).click(); await form().waitFor({ state: 'hidden' });
    const trip = await page.evaluate(() => window.fixture.calls.filter(call => call.kind === 'update').at(-1).value.data);
    assert.equal(trip.startDate, '2026-10-16'); assert.equal(trip.endDate, '2026-10-18');
    checks.push('Editing a continuous all-day event preserves its full inclusive date range');
    await calendar().locator('[data-date="2026-10-22"] .fc-daygrid-more-link').click();
    await page.getByRole('region', { name: 'Selected day schedule' }).waitFor();
    assert.equal(await page.getByRole('region', { name: 'Selected day schedule' }).getByRole('button').filter({ hasText: 'Thursday activity' }).count(), 6);
    await page.keyboard.press('Escape');
    checks.push('Daily overflow opens the complete schedule instead of hiding extra events');
    await calendar().locator('[data-date="2026-10-28"] .fc-daygrid-day-number').dblclick();
    const creator = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: /Create New Event/ }) });
    await creator.waitFor(); assert.equal(await creator.getByRole('button', { name: 'Create Event', exact: true }).count(), 1);
    await creator.getByRole('button', { name: 'Continuous date range', exact: true }).click();
    assert.ok((await creator.innerText()).includes('October 28, 2026'));
    await creator.getByRole('button', { name: 'Cancel', exact: true }).click(); await creator.waitFor({ state: 'hidden' });
    checks.push('Double-click creation opens the real form with the chosen date prefilled');
    const beforeMove = await page.evaluate(() => window.fixture.calls.length);
    await page.evaluate(() => { window.moveReverted = 0; window.calendarOptions.eventDrop({ event: { id: 'multi', start: new Date(2026, 9, 17), end: new Date(2026, 9, 20), allDay: true }, revert: () => window.moveReverted++ }); });
    await page.getByRole('alertdialog').waitFor(); assert.equal(await page.evaluate(() => window.moveReverted), 1);
    assert.equal(await page.evaluate(() => window.fixture.calls.length), beforeMove);
    await page.getByRole('alertdialog').getByRole('button', { name: 'Continue editing' }).click();
    assert.equal(await page.evaluate(() => window.fixture.calls.length), beforeMove);
    await page.evaluate(() => window.calendarOptions.eventResize({ event: { id: 'multi', start: new Date(2026, 9, 17), end: new Date(2026, 9, 20), allDay: true }, revert() {} }));
    await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm', exact: true }).click(); await page.getByRole('alertdialog').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => window.fixture.calls.at(-1).value.data.endDate), '2026-10-19');
    checks.push('Drop and resize callbacks revert unsaved moves, require confirmation and persist inclusive end dates');
    await changeFixture(()=>{window.fixture.user={...window.fixture.user,role:'Staff'};window.fixture.events=window.fixture.events.map(event=>event.id==='multi'?{...event,location:'Main Hall'}:event);}); await emit();
    const beforeStaffConflict=await page.evaluate(()=>window.fixture.calls.length);
    await page.evaluate(()=>window.calendarOptions.eventDrop({event:{id:'multi',start:new Date(2026,9,14),end:new Date(2026,9,15),allDay:true},revert(){}}));
    assert.equal(await page.getByRole('alertdialog').count(),0);
    assert.equal(await page.evaluate(()=>window.fixture.calls.length),beforeStaffConflict);
    assert.equal(await page.evaluate(()=>window.lastToast.title),'Scheduling conflict');
    await changeFixture(()=>{window.fixture.user={...window.fixture.user,role:'Admin'};}); await emit();
    await page.evaluate(()=>window.calendarOptions.eventDrop({event:{id:'multi',start:new Date(2026,9,14),end:new Date(2026,9,15),allDay:true},revert(){}}));
    await page.getByRole('alertdialog').getByRole('button',{name:'Save despite conflicts',exact:true}).waitFor();
    await page.getByRole('alertdialog').getByRole('button',{name:'Continue editing',exact:true}).click();
    await changeFixture(()=>{window.fixture.events=window.fixture.events.map(event=>event.id==='multi'?{...event,location:'Museum'}:event);}); await emit();
    checks.push('Staff cannot override a scheduling conflict; administrators receive an explicit review choice');
    await event('Inter-house sports').click();
    await details().getByRole('button',{name:'Cancel event',exact:true}).click();
    await page.getByRole('alertdialog').getByRole('button',{name:'Confirm',exact:true}).click();
    await page.getByRole('alertdialog').waitFor({state:'hidden'});
    assert.equal(await page.evaluate(()=>window.fixture.events.find(event=>event.id==='sports').status),'Cancelled');
    await details().getByRole('button',{name:'Duplicate',exact:true}).click();
    const copy=page.getByRole('dialog').filter({has:page.getByRole('heading',{name:/Create New Event/})});
    await copy.waitFor(); assert.equal(await copy.locator('#title').inputValue(),'Inter-house sports (copy)');
    await copy.getByRole('button',{name:'Create Event',exact:true}).click(); await copy.waitFor({state:'hidden'});
    await event('Inter-house sports (copy)').click();
    await details().getByRole('button',{name:'Publish',exact:true}).click();
    await page.getByRole('alertdialog').getByRole('button',{name:'Confirm',exact:true}).click(); await page.getByRole('alertdialog').waitFor({state:'hidden'});
    assert.equal(await page.evaluate(()=>window.fixture.events.find(event=>event.title==='Inter-house sports (copy)').status),'Scheduled');
    await details().getByRole('button',{name:'Delete',exact:true}).click();
    await page.getByRole('alertdialog').getByRole('button',{name:'Confirm',exact:true}).click(); await page.getByRole('alertdialog').waitFor({state:'hidden'});
    assert.equal(await page.evaluate(()=>window.fixture.events.some(event=>event.title==='Inter-house sports (copy)')),false);
    checks.push('Cancel, duplicate, publish and delete actions run through confirmed real UI workflows');

    await changeFixture(() => { window.fixture.readOnly = true; }); await emit();
    assert.equal(await page.getByRole('button', { name: 'New Event', exact: true }).count(), 0);
    await event('Updated staff planning').click(); assert.equal(await details().getByRole('button', { name: 'Edit / reschedule', exact: true }).count(), 0);
    await changeFixture(() => { window.fixture.readOnly = false; window.fixture.offline = true; }); await emit();
    assert.equal(await page.getByRole('button', { name: 'New Event', exact: true }).count(), 0);
    await changeFixture(() => { window.fixture.offline = false; }); await emit();
    checks.push('View-only and offline users retain the calendar without mutation controls');
    await page.screenshot({path:path.join(output,'planning-event-details.png'),fullPage:true});
    await details().getByRole('button', { name: 'Close event details' }).click();
    for (const width of [1680, 1280, 768, 390]) {
      await page.setViewportSize({ width, height: 1100 }); await page.evaluate(() => {scrollTo(0, 0);getSelection()?.removeAllRanges();});
      for (const dark of [false, true]) {
        await page.evaluate(value => document.documentElement.classList.toggle('dark', value), dark);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `No page overflow at ${width}px`);
        const box = await calendar().boundingBox(); assert.ok(box.width <= width);
        if(width===390){
          const searchBox=await page.getByRole('textbox',{name:'Search calendar events'}).boundingBox();
          const headerBox=await page.locator('.glass-page-topbar').boundingBox();
          assert.ok(searchBox.width>280,'Mobile event search must have its own full row');
          assert.ok(searchBox.y>=headerBox.y+headerBox.height,'Mobile header must not cover the search input');
          for(const name of ['New Event', 'Hide planning panel']){
            const control=page.getByRole('button',{name,exact:true});
            assert.equal(await control.evaluate(button=>{const r=button.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&button.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));}),true,'Floating actions remain fully accessible');
          }
        }

        await page.screenshot({ path: path.join(output, `planning-${width}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
        checks.push(`${width}px ${dark ? 'dark' : 'light'}: responsive planning layout without horizontal overflow`);
      }
      if (width < 1536) {
        await page.getByRole('button', { name: /^Filters \(/ }).click(); await page.getByRole('dialog', { name: 'Calendar filters', exact: true }).waitFor();
        await page.keyboard.press('Escape'); await page.getByRole('dialog', { name: 'Calendar filters', exact: true }).waitFor({ state: 'hidden' });
      }
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ checks }, null, 2));
    console.log('CALENDAR_PLANNING_BROWSER_OK', JSON.stringify({ checks: checks.length, output }));
  } catch (error) {
    if (page) { console.error((await page.locator('body').innerText()).slice(-14000)); await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }); }
    throw error;
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
