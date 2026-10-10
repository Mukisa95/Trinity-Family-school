/* Render the actual custom dashboard widgets and shared controls with synthetic data. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ts = require('typescript');
const esbuild = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/theme-correction-qa');
const term = { id: 'term3', name: 'Term 3', startDate: '2026-09-01', endDate: '2026-12-15' };
const year = { id: '2026', name: '2026', startDate: '2026-01-01', endDate: '2026-12-31', isActive: true, terms: [term] };
const events = [
  { id: 'past', title: 'Sample assessment', startDate: '2026-09-17', endDate: '2026-09-17', isAllDay: true, type: 'Academic', priority: 'Normal', targetAudience: [] },
  { id: 'ongoing', title: 'School activity', startDate: '2026-10-09', endDate: '2026-10-09', isAllDay: true, type: 'Co-curricular', priority: 'Normal' },
  { id: 'upcoming', title: 'Parent meeting', startDate: '2026-10-10', endDate: '2026-10-10', isAllDay: true, type: 'Administrative', priority: 'Normal' },
];
const mocks = {
  'next/navigation': `export const usePathname=()=>'/';export const useRouter=()=>({push:url=>window.lastNavigation=url});export const useSearchParams=()=>new URLSearchParams();`,
  'next/link': `import React from 'react';export default React.forwardRef(({children,...props},ref)=><a {...props} ref={ref}>{children}</a>);`,
  '@/lib/hooks/use-academic-years': `const year=${JSON.stringify(year)};export const useAcademicYears=()=>({data:[year],isLoading:false});export const useActiveAcademicYear=()=>({data:year});`,
  '@/lib/hooks/use-excluded-days': `export const useExcludedDays=()=>({data:[]});`,
  '@/lib/hooks/use-term-status': `export const useTermStatus=()=>({effectiveTerm:{term:${JSON.stringify(term)},academicYear:${JSON.stringify(year)}},isRecessMode:false,periodMessage:''});`,
  '@/lib/hooks/use-events-fixed': `const events=${JSON.stringify(events)},year=${JSON.stringify(year)};export const useEvents=()=>({data:events,isLoading:false});export const useExamsAsEvents=()=>({data:[]});export const useAcademicYearsForEvents=()=>({data:[year],isLoading:false});export const useCurrentTerm=()=>({term:year.terms[0],academicYear:year});`,
  '@/lib/hooks/use-uganda-holidays': `export const useUgandaHolidays=()=>({data:[]});`,
  '@/lib/hooks/use-timetable': `export const useTimetableProfiles=()=>({data:[{id:'primary',name:'Primary',classIds:Array.from({length:8},(_,i)=>'c'+i)},{id:'nursery',name:'Nursery',classIds:['c0']}],isLoading:false});export const useTimetablePeriods=()=>({data:[{id:'p',dayOfWeek:5,startTime:'09:30',endTime:'11:00',periodNumber:1,type:'lesson'}]});export const useTimetableEntries=()=>({data:Array.from({length:8},(_,i)=>({id:'e'+i,classId:'c'+i,subjectId:'math',teacherId:'t',periodId:'p',dayOfWeek:5}))});`,
  '@/lib/hooks/use-classes': `export const useClasses=()=>({data:Array.from({length:8},(_,i)=>({id:'c'+i,code:'P.'+(i+1),name:'Primary '+(i+1)}))});`,
  '@/lib/hooks/use-subjects': `export const useSubjects=()=>({data:[{id:'math',code:'MATH',name:'Mathematics'}]});`,
  '@/lib/hooks/use-staff': `export const useStaff=()=>({data:[{id:'t',firstName:'Test',lastName:'Teacher'}]});`,
  '@/lib/hooks/use-digital-signature': `export const useRecordSignatures=()=>({data:[],isLoading:false});`,
  '@/lib/services/passkey.service': `export const PASSKEYS_CHANGED_EVENT='test-passkeys';export const PasskeyService={supported:async()=>false,hasLocalUnlock:()=>false,list:async()=>[]};`,
  '@/lib/contexts/auth-context': `const user={id:'synthetic',firstName:'Amina',lastName:'Test',username:'amina',role:'Admin'};export const useAuth=()=>({user,logout:async()=>{},autoLockEnabled:true,autoLockAction:'lock-on-close',deviceUnlockForAutoLock:false,setAutoLockEnabled:()=>{},setAutoLockAction:()=>{},setDeviceUnlockForAutoLock:()=>{},lockAccount:()=>{}});`,
  '@/components/common/LogoutMessage': `export default ()=>null;`,
};
function extractedWidgets() {
  const file = path.join(root, 'src/app/page.tsx');
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set(['CountUp', 'AnimatedDoughnut', 'StatCard', 'ExpandableStaffCard', 'ExpandableAttendanceCard', 'PhotoSlideshow', 'AnimatedBarLabel', 'ClassEnrollmentChart', 'TodaysAttendanceChart']);
  const imports = new Set(['react', 'framer-motion', 'lucide-react', 'recharts', 'next/navigation', 'date-fns', '@/components/ui/charts/pill-bar', '@/components/ui/card', '@/data/quotes.json', '@/components/common/photo-viewer-dialog', '@/components/ui/button', '@/components/ui/badge', '@/lib/hooks/use-excluded-days', '@/lib/hooks/use-academic-years', '@/lib/hooks/use-term-status', '@/lib/utils/term-status-utils', '@/lib/utils/attendance-academic-utils']);
  const chosen = source.statements.filter(n => (ts.isImportDeclaration(n) && imports.has(n.moduleSpecifier.text)) || (ts.isVariableStatement(n) && n.declarationList.declarations.some(d => names.has(d.name.getText(source)))));
  assert.equal(chosen.filter(ts.isVariableStatement).length, names.size, 'Dashboard widget extraction must use the current application source');
  return chosen.map(n => n.getText(source)).join('\n') + '\nexport {StatCard,ExpandableStaffCard,ExpandableAttendanceCard,PhotoSlideshow,ClassEnrollmentChart,TodaysAttendanceChart};';
}
function scheduleStyles() {
  const file = path.join(root, 'src/components/timetable/TimetableViewPanel.tsx');
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set(['SUBJECT_HUES_W', 'getSubjectHueW', 'getWeekCellStyle', 'WeekPeriodState']);
  return `import React from 'react';\n` + source.statements.filter(n => (ts.isFunctionDeclaration(n) || ts.isTypeAliasDeclaration(n)) ? names.has(n.name?.text) : ts.isVariableStatement(n) && n.declarationList.declarations.some(d => names.has(d.name.getText(source)))).map(n => n.getText(source)).join('\n') + '\nexport {getWeekCellStyle};';
}
async function build({ navigation = false, pageLayers = false, networkDetails = false } = {}) {
  const headerSource = ts.createSourceFile('header.tsx', fs.readFileSync(path.join(root, 'src/components/layout/enhanced-header.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const iconNames = headerSource.statements.filter(n => ts.isImportDeclaration(n) && n.moduleSpecifier.text === '@phosphor-icons/react').flatMap(n => n.importClause.namedBindings.elements.map(e => e.name.text));
  const navigationMocks = {
    // Use the real icons directly; avoid scanning thousands of unused icon exports.
    '@phosphor-icons/react': [...new Set([...iconNames, 'CurrencyCircleDollar'])].map(name => `export {${name}} from ${JSON.stringify(path.join(root, 'node_modules/@phosphor-icons/react/dist/csr', name + '.es.js'))};`).join('\n'),
    '@/lib/hooks/use-school-settings': `export const useSchoolSettings=()=>({data:{generalInfo:{name:'Trinity Family School',motto:'Guiding growth, inspiring greatness',logo:''}},isLoading:false});`,
    '@/lib/hooks/use-pupils': `export const usePupils=()=>({data:[]});`,
    '@/lib/hooks/use-schoolpay-badge': `export const useSchoolPayBadge=()=>0;`,
    '@/lib/contexts/navigation-context': `export const useNavigation=()=>({isNavigating:false,startNavigation:()=>{}});`,
    '@/lib/services/granular-permissions.service': `export const GranularPermissionService={canAccessPage:()=>true,canAccessInventoryWorkspace:()=>true};`,
    '@/components/layout/network-strength-indicator': `export const NetworkStrengthIndicator=()=>null;`,
  };
  const fixtureMocks = { ...mocks, ...(navigation ? navigationMocks : {}) };
  if (networkDetails) {
    delete fixtureMocks['@/components/layout/network-strength-indicator'];
    fixtureMocks['@/lib/contexts/auth-context'] = `import {useEffect,useState} from 'react';` + mocks['@/lib/contexts/auth-context'].replace('export const useAuth=', 'const useBaseAuth=') + `
export const useAuth=()=>{const base=useBaseAuth();const [session,setSession]=useState({isSessionVerificationDelayed:true,sessionMessage:'The live session check is waiting for a stable connection. Your current session remains available.'});useEffect(()=>{const update=e=>setSession(e.detail);window.addEventListener('fixture-session-change',update);return()=>window.removeEventListener('fixture-session-change',update);},[]);return {...base,...session};};`;
  }
  const navigationImports = navigation ? `import EnhancedHeader from './src/components/layout/enhanced-header';import {MobileSidebar} from './src/components/layout/mobile-sidebar';import {SidebarNav} from './src/components/layout/sidebar-nav';import {navItems} from './src/config/nav';import {SchoolSettingsLoader} from './src/components/layout/school-settings-loader';` : '';
  const header = navigation ? '<EnhancedHeader onMenuClick={()=>setMobileOpen(true)} showMenuButton={true}/>' : '<header className="p-4 border-b border-border">School workspace</header>';
  const sidebarItems = navigation ? '<SidebarNav items={navItems}/>' : '<p className="px-4">Dashboard</p><p className="px-4">Timetable</p><p className="px-4">Pupils</p>';
  const mobileNav = navigation ? '<button data-testid="open-mobile" onClick={()=>setMobileOpen(true)}>Open mobile navigation</button><MobileSidebar items={navItems} isOpen={mobileOpen} onClose={()=>setMobileOpen(false)}/><div data-testid="settings-loader"><SchoolSettingsLoader/></div>' : '';
  fs.mkdirSync(output, { recursive: true });
  let contents = `
${navigationImports}
import React from 'react';import {createRoot} from 'react-dom/client';import {Users} from 'lucide-react';
import {ThemeProvider} from './src/components/providers/theme-provider';import {ThemeToggle} from './src/components/ui/theme-toggle';
import {StatCard,ExpandableStaffCard,ExpandableAttendanceCard,PhotoSlideshow,ClassEnrollmentChart,TodaysAttendanceChart} from 'dashboard-widgets';import {getWeekCellStyle} from 'schedule-styles';
window.getScheduleStyles=()=>Array.from({length:100},(_,i)=>['active','past','upcoming'].map(state=>getWeekCellStyle('subject-'+i,false,false,state))).flat();
import {MonthCalendarCard} from './src/components/dashboard/MonthCalendarCard';import {TermScheduleCard} from './src/components/dashboard/TermScheduleCard';
import {DashboardLiveTracker} from './src/components/dashboard/DashboardLiveTracker';import {PupilNavigationTile} from './src/components/parent/pupil-navigation-tile';
import {PaymentModal} from './src/app/fees/collect/[id]/components/PaymentModal';import {AutoLockSettings} from './src/components/settings/auto-lock-settings';import {PasskeySettings} from './src/components/settings/passkey-settings';
import {Input} from './src/components/ui/input';import {Textarea} from './src/components/ui/textarea';import {Button} from './src/components/ui/button';import {Select,SelectTrigger,SelectValue} from './src/components/ui/select';
import {AttendanceSignatureDisplay} from './src/components/attendance/AttendanceSignatureDisplay';import {EventsList} from './src/components/events/ui/events-list';
import {EventFilters} from './src/components/events/ui/event-filters';import {EventDetailsModal} from './src/components/events/ui/event-details-modal';
import {SidebarProvider,Sidebar,SidebarHeader,SidebarContent,SidebarFooter,SidebarInset} from './src/components/ui/sidebar';import {SidebarUserFooter} from './src/components/layout/sidebar-user-footer';
const counts=[65,62,67,88,95,55,78,94,70],classes=counts.map((n,i)=>({id:'c'+i,name:'Class '+i,code:['MID','TOP','P.1','P.2','P.3','P.4','P.5','P.6','P.7'][i]}));
const pupils=counts.flatMap((n,i)=>Array.from({length:n},(_,j)=>({id:'p'+i+'-'+j,classId:'c'+i,status:'Active',gender:j%2?'Female':'Male'})));
const colours=['blue','violet','pink','purple','emerald','orange'];const statColors=colours.map((colour,i)=>({accent:i===0?'rgb(var(--brand-500))':['#3b82f6','#8b5cf6','#ec4899','#a855f7','#10b981','#f97316'][i],text:i===0?'text-brand-ink-600 dark:text-brand-ink-400':'text-'+colour+'-600 dark:text-'+colour+'-400',bg:'',gradient:'transparent'}));const photoUrl='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#476b50"/><circle cx="460" cy="90" r="60" fill="#f9e4a4"/></svg>');const samplePhotos=[{id:'one',title:'Sample school moment',url:photoUrl,isActive:true},{id:'two',title:'Sample second moment',url:photoUrl,isActive:true}];const metrics=['Total pupils','Male pupils','Female pupils','Staff members','Present today','Delayed today'];
function Fixture(){const [mobileOpen,setMobileOpen]=React.useState(false);return <ThemeProvider><div className="dashboard-bg-wrapper"><div className="lg:hidden fixed top-2 right-2 z-50"><ThemeToggle/></div><SidebarProvider><Sidebar variant="sidebar" collapsible="icon"><SidebarHeader><strong className="p-3">Trinity Family School</strong></SidebarHeader><SidebarContent>${sidebarItems}</SidebarContent><SidebarFooter><SidebarUserFooter/></SidebarFooter></Sidebar><SidebarInset className="min-w-0">${header}<main className="p-6 ${navigation ? 'pt-16' : ''}"><h1 className="text-2xl font-bold mb-6">Trinity School Online</h1><div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-6">{metrics.map((title,i)=>i===3?<ExpandableStaffCard key={title} title={title} value={18} icon={Users} color={statColors[i]} staff={[]}/>:i>=4?<ExpandableAttendanceCard key={title} title={title} value={0} icon={Users} color={statColors[i]} filterType={i===4?'present':'delayed'} attendanceData={{records:[],byClass:[]}} pupils={pupils} animateConfigs={i===5?[{title:'Absent today',value:0,icon:Users,color:{...statColors[i],accent:'#ef4444',text:'text-red-600 dark:text-red-400'},filterType:'absent'},{title:'Delayed today',value:0,icon:Users,color:statColors[i],filterType:'delayed'}]:undefined}/>:<StatCard key={title} title={title} value={[pupils.length,360,pupils.length-360][i]} icon={Users} color={statColors[i]}/>)}</div><div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><div data-testid="enrollment"><ClassEnrollmentChart classes={classes} pupils={pupils}/></div><div data-testid="attendance"><TodaysAttendanceChart classes={classes} pupils={pupils} attendanceData={{records:[]}}/></div><div data-testid="tracker"><DashboardLiveTracker/></div><div className="lg:col-start-2" data-testid="calendar"><MonthCalendarCard/></div><div data-testid="term"><TermScheduleCard/></div><div data-testid="slideshow"><PhotoSlideshow photos={samplePhotos}/></div><div data-testid="empty-slideshow"><PhotoSlideshow photos={[]}/></div></div><div data-testid="schedule" className="grid grid-cols-3 gap-2 mt-6">{['active','past','upcoming'].map(state=><div key={state} className="border p-3 rounded-lg font-semibold" style={getWeekCellStyle('sample',false,false,state)}>{state} lesson</div>)}</div><div className="mt-6" data-testid="parent"><PupilNavigationTile pupilName="Sample pupil" activeView="info" onViewChange={()=>{}}/></div><div data-testid="events" className="mt-6"><EventsList events={${JSON.stringify(events)}} onEventClick={()=>{}}/></div><AttendanceSignatureDisplay recordId="sample" date="2026-10-09" className="mt-4 rounded-lg"/>${mobileNav}</main></SidebarInset></SidebarProvider></div></ThemeProvider>}
function ExtraControls(){const [open,setOpen]=React.useState(false);return <div className="grid gap-4 p-6" data-testid="settings"><AutoLockSettings/><PasskeySettings/><div data-testid="invalid-controls" className="grid gap-2"><Input aria-label="Invalid example" aria-invalid="true" value="Example" readOnly/><Textarea aria-invalid="true" aria-label="Invalid text" value="Example" readOnly/><Button aria-invalid="true">Invalid button</Button><Select><SelectTrigger aria-invalid="true"><SelectValue placeholder="Invalid selection"/></SelectTrigger></Select></div><button onClick={()=>setOpen(true)}>Preview payment</button><PaymentModal isOpen={open} onClose={()=>setOpen(false)} onSubmit={async()=>{window.paymentSubmitted=true}} fee={{feeId:'sample',name:'Sample tuition',amount:100000,balance:80000,amountPaid:20000}}/></div>}
function EventExamples(){const [open,setOpen]=React.useState(false);return <div className="hidden lg:block p-6" style={{marginLeft:256}} data-testid="event-examples"><EventFilters filters={{types:[],statuses:[],priorities:[],academicYearIds:[],termIds:[],classIds:[],subjectIds:[]}} onFiltersChange={()=>{}}/><button onClick={()=>setOpen(true)}>Preview event</button><EventDetailsModal event={${JSON.stringify(events[0])}} isOpen={open} onClose={()=>setOpen(false)} onEdit={()=>{}}/></div>}
createRoot(document.getElementById('app')).render(<><Fixture/><EventExamples/><ExtraControls/></>);`;
  if (networkDetails) {
    contents = contents.replace('<div className="lg:hidden fixed top-2 right-2 z-50"><ThemeToggle/></div>', '');
    const start = contents.indexOf('<main className="p-6 '), end = contents.indexOf('</main></SidebarInset>', start);
    assert.ok(start >= 0 && end > start);
    contents = contents.slice(0, start) + '<main className="p-6 pt-16"><h1>School workspace</h1>' + contents.slice(end);
    contents = contents.replace('<><Fixture/><EventExamples/><ExtraControls/></>', '<Fixture/>');
  }
  if (pageLayers) {
    contents = `import {GlassPageTopBar,GlassActionDock,GlassActionButton} from './src/components/common/glass-page-top-bar';
import {GlassSummaryBar} from './src/components/common/glass-summary-bar';
import {GlassPageRouteSkeleton} from './src/components/common/glass-page-loading';
import {Tabs,TabsContent} from './src/components/ui/tabs';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem} from './src/components/ui/dropdown-menu';
function LayeredPage(){const [variant,setVariant]=React.useState('wrapped');window.setLayerVariant=setVariant;
const summary=<GlassSummaryBar left={<div className="flex flex-wrap gap-2"><select aria-label="Academic year" className="border rounded-full bg-transparent px-3 py-1"><option>2025 (Current)</option></select><button className="border rounded-full px-3 py-1 text-link">Term 2</button><button className="border rounded-full px-3 py-1 text-link">Term 3</button></div>} right={<>{['Total fees: USh 740,000','Total paid: USh 680,000','Balance: USh 60,000'].map(t=><span key={t} className="rounded-full bg-brand-alt-surface-50 border border-brand-alt-100 px-2 py-1 text-xs text-brand-alt-ink-700 dark:bg-brand-alt-surface-950/40 dark:text-brand-alt-ink-200">{t}</span>)}</>}/>;
return <div data-testid="page-stack" className="min-h-screen">{variant==='skeleton'?<GlassPageRouteSkeleton showSummaryBar variant="list"/>:<><GlassPageTopBar title="KIRABO DAVID" recordDetails="TFU/12M/847 · P.7 · Boarding" backHref="/fees/collection" backMode="href" className="mb-1.5" inlineActions actions={<GlassActionDock>{['Notes','Pay','Family','Siblings','Assign','Wire','Print'].map(t=><GlassActionButton key={t} label={t} icon={<Users className="h-4 w-4"/>} onClick={()=>window.layerAction=t}/>)}<DropdownMenu><DropdownMenuTrigger asChild><GlassActionButton label="Track" icon={<Users className="h-4 w-4"/>}/></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onSelect={()=>window.layerAction='Tracking'}>View tracking</DropdownMenuItem></DropdownMenuContent></DropdownMenu></GlassActionDock>}/>{variant==='wrapped'?<Tabs defaultValue="fees" className="w-full">{summary}<TabsContent value="fees"><div className="p-4">Fee records</div></TabsContent></Tabs>:variant==='direct'?summary:null}</>}<div className="p-4"><div className="border rounded-xl bg-card p-4 h-[1800px]">Workspace content</div></div></div>}
` + contents;
    const start = contents.indexOf('<main className="p-6 '), end = contents.indexOf('</main></SidebarInset>', start);
    assert.ok(start >= 0 && end > start);
    contents = contents.slice(0,start) + '<main data-testid="workspace-scroller" className="min-h-0 md:flex-1 md:overflow-y-auto px-3 md:px-6 md:pt-[52px]"><LayeredPage/>' + contents.slice(end);
    contents = contents.replace('<div className="lg:hidden fixed top-2 right-2 z-50"><ThemeToggle/></div>', '');
    contents = contents.replace('SidebarInset className="min-w-0"','SidebarInset className="min-w-0 md:h-[100dvh] md:overflow-hidden"');
  }
  await esbuild.build({ absWorkingDir: root, stdin: { resolveDir: root, contents, loader: 'tsx' }, bundle: true, jsx: 'automatic', platform: 'browser', alias: { '@': path.join(root, 'src') }, outfile: path.join(output, 'fixture.js'), define: { 'process.env.NODE_ENV': '"production"', 'process.env.__NEXT_IMAGE_OPTS': 'undefined' }, plugins: [{ name: 'synthetic-data', setup(b) {
    b.onResolve({ filter: /.*/ }, a => Object.hasOwn(fixtureMocks, a.path) || ['dashboard-widgets', 'schedule-styles'].includes(a.path) ? { path: a.path, namespace: 'fixture' } : undefined);
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: a.path === 'dashboard-widgets' ? extractedWidgets() : a.path === 'schedule-styles' ? scheduleStyles() : fixtureMocks[a.path], loader: 'tsx', resolveDir: root }));
  } }] });
  const compiled = ts.transpileModule(fs.readFileSync(path.join(root, 'tailwind.config.ts'), 'utf8'), { compilerOptions: { module: 1 } }).outputText;
  const mod = { exports: {} }; new Function('require', 'module', 'exports', compiled)(require, mod, mod.exports);
  const css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/^@import[^;]+;/, '') + '\n' + fs.readFileSync(path.join(root, 'src/app/theme.css'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'src/app/brand-theme.css'), 'utf8');
  const built = await require('postcss')([require('tailwindcss')({ ...mod.exports.default, content: [path.join(root, 'src/**/*.{ts,tsx}'), { raw: contents, extension: 'tsx' }] })]).process(css, { from: path.join(root, 'src/app/globals.css') });
  fs.writeFileSync(path.join(output, 'fixture.css'), built.css);
}
function contrast(a, b) {
  const luminance = rgb => rgb.slice(0, 3).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
  const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
async function run() {
  await build();
  console.log('Dashboard fixture built; starting rendered contrast checks.');
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (['/fixture.js', '/fixture.css'].includes(url)) { res.setHeader('Content-Type', url.endsWith('js') ? 'text/javascript' : 'text/css'); res.end(fs.readFileSync(path.join(output, url.slice(1)))); }
    else if (url.startsWith('/images/')) { const file = path.resolve(root, 'public', '.' + url); if (file.startsWith(path.join(root, 'public') + path.sep) && fs.existsSync(file)) { res.setHeader('Content-Type', 'image/png'); res.end(fs.readFileSync(file)); } else { res.statusCode = 404; res.end(); } }
    else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="app"></div><script src="/fixture.js"></script></body></html>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: process.env.THEME_BROWSER_CHANNEL || 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 });
    const errors = []; page.on('pageerror', e => { errors.push(e.message); console.error('Dashboard browser error:',e.message); });
    await page.clock.setFixedTime(new Date('2026-10-09T10:00:00'));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.locator('[data-testid="calendar"] .fc-toolbar-title').waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="enrollment"] svg text')].some(t => t.textContent === '95'));
    const lessonReports = [];
    const setPreset = async preset => {
      await page.evaluate(preset => {
        const value=JSON.stringify({preset,background:'illustration',dimming:37});
        localStorage.setItem('trinity-look-and-feel',value);
        window.dispatchEvent(new StorageEvent('storage',{key:'trinity-look-and-feel',newValue:value}));
      },preset);
      await page.waitForFunction(preset=>document.documentElement.dataset.appTheme===preset,preset);
    };
    const setMode = async dark => {
      if(await page.evaluate(()=>document.documentElement.classList.contains('dark'))!==dark) {
        await page.getByRole('switch',{name:'Dark theme'}).first().click();
        await page.waitForFunction(dark=>document.documentElement.classList.contains('dark')===dark&&!document.documentElement.dataset.themeReveal,dark);
      }
    };
    const readPair = locator => locator.evaluate(el=>{
      const style=getComputedStyle(el),rgb=value=>value.match(/[\d.]+/g).slice(0,3).map(Number);
      return {color:rgb(style.color),background:rgb(style.backgroundColor)};
    });
    const checkPair = (pair,label) => assert.ok(contrast(pair.color,pair.background)>=4.5,label+': '+JSON.stringify(pair));
    for(const preset of ['trinity-classic','soft-indigo']) {
      await setPreset(preset);
      for(const dark of [false,true]) {
        await setMode(dark);await page.mouse.move(0,0);
        const pills=page.locator('[data-testid="tracker"] [data-pill-btn]');
        assert.ok(await pills.count()>=8,'Fixture must cover all eight class colours');
        const pairs=[];
        for(let i=0;i<8;i++) {
          const pill=pills.nth(i),normal=await readPair(pill);checkPair(normal,`${preset}/${dark}/lesson ${i}`);
          await pill.hover();await page.waitForTimeout(220);
          const hover=await readPair(pill);checkPair(hover,'Hovered lesson');
          await pill.click();assert.equal(await pill.getAttribute('aria-expanded'),'true');
          const selected=await readPair(pill);checkPair(selected,'Selected lesson');
          const popover=page.locator('[data-pill-popover]'),header=await readPair(popover.locator(':scope > div').first());
          checkPair(header,'Expanded lesson heading');
          const body=popover.locator(':scope > div').nth(1),background=(await readPair(body)).background;
          for(const text of await body.locator('p,span').all()) checkPair({...await readPair(text),background},'Expanded lesson detail');
          await popover.getByRole('button',{name:'Close lesson details'}).click();
          pairs.push({normal,hover,selected,header});
        }
        await page.mouse.move(0,0);
        await page.locator('[data-testid="tracker"]').screenshot({path:path.join(output,`timetable-${preset}-${dark?'dark':'light'}.png`)});
        await page.getByRole('button',{name:'Preview event',exact:true}).click();
        const dialog=page.getByRole('dialog');await dialog.waitFor();
        for(const heading of [page.locator('[data-testid="event-examples"] .bg-clip-text').first(),dialog.locator('.bg-clip-text').first()]) {
          const gradient=await heading.evaluate(el=>{
            let parent=el,background=getComputedStyle(parent).backgroundColor;
            while(background==='rgba(0, 0, 0, 0)'&&parent.parentElement){parent=parent.parentElement;background=getComputedStyle(parent).backgroundColor;}
            const rgb=v=>v.match(/[\d.]+/g).slice(0,3).map(Number);
            return {stops:(getComputedStyle(el).backgroundImage.match(/rgba?\([^)]+\)/g)||[]).map(rgb),background:rgb(background)};
          });
          assert.equal(gradient.stops.length,2,'Actual event heading gradient');
          for(const color of gradient.stops)checkPair({color,background:gradient.background},'Event heading gradient');
        }
        await page.keyboard.press('Escape');
        lessonReports.push({preset,dark,pairs});
        console.log(`TIMETABLE_CONTRAST_OK ${preset} ${dark?'dark':'light'}: eight colours, hover/selected states, detail popovers and event headings.`);
      }
    }
    for(const dark of [false,true]) {
      const classic=lessonReports.find(r=>r.preset==='trinity-classic'&&r.dark===dark),soft=lessonReports.find(r=>r.preset==='soft-indigo'&&r.dark===dark);
      for(const i of [1,5]) assert.notDeepEqual(classic.pairs[i].normal,soft.pairs[i].normal,'Indigo/violet class labels must change with preset');
    }
    await setPreset('soft-indigo');await setMode(true);await page.emulateMedia({media:'print'});
    const printPair=await readPair(page.locator('[data-testid="tracker"] [data-pill-btn]').nth(1));
    assert.deepEqual(printPair,lessonReports[0].pairs[1].normal,'Printed lesson labels retain Classic/light colours');
    await page.emulateMedia({media:'screen'});await setPreset('trinity-classic');await setMode(false);
    await page.screenshot({ path: path.join(output, 'dashboard-light.png'), fullPage: true });
    const lightSnapshot = await page.locator('[data-testid="calendar"] .fc-toolbar-title').evaluate(el => ({ color: getComputedStyle(el).color, text: el.textContent }));
    const schedulePalette = () => page.evaluate(() => window.getScheduleStyles().map(style => {
      const el=document.createElement('div');Object.assign(el.style,style);document.body.append(el);
      const computed=getComputedStyle(el),result={color:computed.color.match(/[\d.]+/g).map(Number),background:computed.backgroundColor.match(/[\d.]+/g).map(Number)};el.remove();return result;
    }));
    const lightSchedule = await schedulePalette();
    await page.getByRole('switch', { name: 'Dark theme' }).first().click();
    await page.waitForFunction(() => document.documentElement.classList.contains('dark') && !document.documentElement.dataset.themeReveal);
    const readings = await page.evaluate(() => {
      const rgb = value => (value.match(/[\d.]+/g) || []).map(Number);
      const read = selector => { const el = document.querySelector(selector); if (!el) throw Error('Missing: ' + selector); const c = getComputedStyle(el); return { color: rgb(c.color), fill: rgb(c.fill), background: rgb(c.backgroundColor), image: c.backgroundImage, text: el.textContent }; };
      return { calendarTitle: read('[data-testid="calendar"] .fc-toolbar-title'), calendarDate: read('[data-testid="calendar"] .fc-daygrid-day:not(.fc-day-today):not(.fc-day-other):not(.fc-day-sunday-red) .fc-daygrid-day-number'), chartLabel: read('[data-testid="enrollment"] svg text[font-weight="700"]'), track: read('[data-testid="attendance"] .recharts-bar-background-rectangle'), attendance: read('[data-testid="attendance"] .theme-dashboard-surface'), status: read('[data-testid="term"] span.uppercase'), schedule: [...document.querySelectorAll('[data-testid="schedule"] > div')].map(el => { const c = getComputedStyle(el); return { color: rgb(c.color), background: rgb(c.backgroundColor) }; }) };
    });
    const cardRGB = [24, 35, 56];
    for (const key of ['calendarTitle', 'calendarDate']) assert.ok(contrast(readings[key].color, cardRGB) >= 4.5, `${key} contrast`);
    assert.ok(contrast(readings.chartLabel.fill, cardRGB) >= 4.5, 'Chart values must be readable');
    assert.ok(readings.track.fill.every(n => n < 100), 'Attendance tracks must be dark');
    assert.ok(!readings.attendance.image.includes('255, 255, 255'), 'Attendance surface must be dark');
    assert.ok(readings.status.background.slice(0, 3).every(n => n < 100), 'Status badges must be dark');
    assert.ok(contrast(readings.status.color, cardRGB) >= 4.5, 'Status text must be readable');
    for (const cell of readings.schedule) { assert.ok(contrast(cell.color, cell.background) >= 4.5, 'Schedule state contrast'); assert.ok(Math.max(...cell.background) < 150, 'Schedule states must avoid pale surfaces'); }
    const darkSchedule = await schedulePalette();
    for (const cell of darkSchedule) assert.ok(contrast(cell.color,cell.background)>=4.5, 'Every subject colour must have readable text: '+JSON.stringify(cell));
    await page.emulateMedia({media:'print'});
    assert.deepEqual(await schedulePalette(),lightSchedule,'Print must use the exact original light timetable colours');
    await page.emulateMedia({media:'screen'});
    const today = page.locator('[data-testid="calendar"] .fc-day-today .fc-daygrid-day-number');
    const todayColors = await today.evaluate(el => ({ color: getComputedStyle(el).color.match(/[\d.]+/g).map(Number), background: getComputedStyle(el).backgroundColor.match(/[\d.]+/g).map(Number) }));
    assert.ok(contrast(todayColors.color, todayColors.background) >= 4.5);
    await page.screenshot({ path: path.join(output, 'dashboard-dark.png'), fullPage: true });
    const badge = page.locator('[data-testid="term"] span.uppercase').first(); assert.ok((await badge.getAttribute('class')).includes('dark:bg-slate-900/60 '));
    await page.locator('[data-testid="calendar"] [data-date="2026-10-09"]').click();
    await page.getByRole('dialog').waitFor();
    await page.screenshot({ path: path.join(output, 'calendar-popover-dark.png') });
    await page.keyboard.press('Escape');
    for(const section of await page.locator('[data-testid="settings"] > section').all()){
      const colours=await section.evaluate(el=>({background:getComputedStyle(el).backgroundColor.match(/[\d.]+/g).map(Number),heading:getComputedStyle(el.querySelector('h2')).color.match(/[\d.]+/g).map(Number)}));
      assert.ok(Math.max(...colours.background)<100);assert.ok(contrast(colours.heading,colours.background)>=4.5);
    }
    for(const control of await page.locator('[data-testid="invalid-controls"] [aria-invalid="true"]').all()){
      const colours=await control.evaluate(el=>({background:getComputedStyle(el).backgroundColor.match(/[\d.]+/g).map(Number),color:getComputedStyle(el).color.match(/[\d.]+/g).map(Number)}));
      assert.ok(Math.max(...colours.background.slice(0,3))<100,'Invalid shared controls must be dark');assert.ok(contrast(colours.color,[24,35,56])>=4.5,'Invalid shared text must remain readable');
    }
    await page.getByText('Preview payment',{exact:true}).click();
    const paymentDialog=page.getByRole('dialog');await paymentDialog.waitFor();
    const paymentBackground=await paymentDialog.evaluate(el=>getComputedStyle(el).backgroundColor.match(/[\d.]+/g).map(Number));
    assert.ok(Math.max(...paymentBackground)<100,'Important payment-dialog classes must follow dark theme');
    await page.getByLabel('Payment Amount (UGX)',{exact:true}).fill('90000');
    await page.getByRole('button',{name:'Record Payment',exact:true}).click();
    await page.getByText('Amount cannot exceed balance',{exact:false}).first().waitFor();
    assert.equal(await page.evaluate(()=>!!window.paymentSubmitted),false);
    const errorBackground=await page.locator('#paymentAmount').evaluate(el=>getComputedStyle(el).backgroundColor.match(/[\d.]+/g).map(Number));
    assert.ok(errorBackground.slice(0,3).every(n=>n<100),'Invalid payment state must follow dark theme');
    await page.screenshot({path:path.join(output,'payment-dialog-dark.png')});await page.keyboard.press('Escape');
    await page.locator('[data-testid="events"]').scrollIntoViewIfNeeded();
    await page.getByText('Academic', { exact: false }).first().click();
    await page.getByText('Academic', { exact: false }).first().click();
    await page.screenshot({ path: path.join(output, 'shared-controls-dark.png') });
    await page.evaluate(()=>window.scrollTo(0,0));
    const hover = page.locator('[data-testid="enrollment"] .recharts-bar-rectangle').first();
    await hover.hover();
    await page.locator('[data-testid="enrollment"] .recharts-tooltip-wrapper').waitFor({ state: 'visible' });
    await page.getByText('Class MID',{exact:true}).waitFor();
    await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('[data-testid="enrollment"] .recharts-tooltip-wrapper > div')).opacity)>.99);
    const tooltipBackground=await page.locator('[data-testid="enrollment"] .recharts-tooltip-wrapper > div').evaluate(el=>getComputedStyle(el).backgroundColor.match(/[\d.]+/g).map(Number));
    assert.ok(tooltipBackground.slice(0,3).every(n=>n<100),'Chart tooltip must follow dark theme');
    await page.screenshot({ path: path.join(output, 'chart-tooltip-dark.png') });
    await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(output, 'dashboard-mobile-dark.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.getByRole('switch', { name: 'Dark theme' }).filter({ visible: true }).first().click();
    await page.waitForFunction(() => !document.documentElement.classList.contains('dark') && !document.documentElement.dataset.themeReveal);
    assert.deepEqual(await page.locator('[data-testid="calendar"] .fc-toolbar-title').evaluate(el => ({ color: getComputedStyle(el).color, text: el.textContent })), lightSnapshot, 'Light palette must restore exactly');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'dashboard-verification.json'), JSON.stringify({ lessonReports, minimumLessonContrast:Math.min(...lessonReports.flatMap(r=>r.pairs.flatMap(p=>Object.values(p).map(c=>contrast(c.color,c.background))))), readings, todayColors, minimumSubjectContrast:Math.min(...darkSchedule.map(c=>contrast(c.color,c.background))), printPaletteUnchanged:true, browserErrors: errors }, null, 2));
    console.log('DASHBOARD_THEME_BROWSER_OK: actual charts, calendar, status badges, timetable colours, parent/events/signature/settings controls, payment validation, tooltips/popovers, mobile layout, print colours and light restoration.');
  } catch (error) { console.error(error); throw error; }
  finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
module.exports={build,output};
if(require.main===module)run().catch(e => { console.error(e); process.exitCode = 1; });
