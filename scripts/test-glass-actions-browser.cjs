const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const esbuild = require('esbuild'), ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'output/glass-actions-qa');

// Exercise the real page and the exact portalled controls from its view panel,
// with deterministic records and without connecting a browser fixture to Firebase.
function timetableControls() {
  const source = fs.readFileSync(path.join(root, 'src/components/timetable/TimetableViewPanel.tsx'), 'utf8');
  const start = source.indexOf('{mobileControlTargets?.view && createPortal('), end = source.indexOf('<TimetablePrintClassDialog', start);
  assert.ok(start > 0 && end > start);
  const options = source.slice(source.indexOf('const FILTER_OPTIONS ='), source.indexOf('// Compute the initialDay'));
  return `import * as React from 'react';import {createPortal} from 'react-dom';import {Check,Pencil} from 'lucide-react';import {GlassActionButton} from '@/components/common/glass-page-top-bar';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
export function TimetableViewPanel({mobileControlTargets,printSelectorOpen,onPrintSelectorOpenChange}){
const [viewMode,setViewMode]=React.useState('day'),[filterMode,setFilterMode]=React.useState('all'),[filterId,setFilterId]=React.useState(''),[isEditing,setIsEditing]=React.useState(false);
const profileClasses=[{id:'p7',name:'Primary Seven'}],staffList=[{id:'teacher',firstName:'Amina',lastName:'Teacher'}],subjects=[{id:'math',name:'Mathematics'}];
${options}
return <><div style={{height:800}}>Synthetic timetable</div>${source.slice(start,end)}
<Dialog open={printSelectorOpen} onOpenChange={onPrintSelectorOpenChange}><DialogContent><DialogTitle>Print classes</DialogTitle><DialogDescription>Choose timetable classes</DialogDescription><button onClick={()=>onPrintSelectorOpenChange(false)}>Cancel print</button></DialogContent></Dialog></>;}`;
}

const fixture = `import * as React from 'react';import {createRoot} from 'react-dom/client';import TimetablePage from './src/app/timetable/page';
import {GlassActionDock,GlassActionButton} from './src/components/common/glass-page-top-bar';
import {Popover,PopoverTrigger,PopoverContent} from './src/components/ui/popover';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem} from './src/components/ui/dropdown-menu';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from './src/components/ui/select';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './src/components/ui/dialog';
import {Sheet,SheetContent,SheetTitle,SheetDescription} from './src/components/ui/sheet';
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogCancel} from './src/components/ui/alert-dialog';
import {ModernDialog,ModernDialogContent,ModernDialogTitle,ModernDialogDescription} from './src/components/ui/modern-dialog';
import {createPortal} from 'react-dom';
function PopupExamples(){const [controlled,setControlled]=React.useState(false),[dialog,setDialog]=React.useState(false),[second,setSecond]=React.useState(false),[slot,setSlot]=React.useState(null),[sheet,setSheet]=React.useState(false),[alert,setAlert]=React.useState(false),[legacy,setLegacy]=React.useState(false);window.mountLatePopup=()=>setSecond(true);
return <><GlassActionDock className='popup-examples'>
<Popover><PopoverTrigger asChild><GlassActionButton label='First popup' icon={<span>A</span>}/></PopoverTrigger><PopoverContent aria-label='First popup content'><input aria-label='First field'/></PopoverContent></Popover>
<Popover open={controlled} onOpenChange={setControlled}><PopoverTrigger asChild><GlassActionButton label='Second popup' icon={<span>B</span>}/></PopoverTrigger><PopoverContent aria-label='Second popup content'><input aria-label='Second field'/></PopoverContent></Popover>
<DropdownMenu><DropdownMenuTrigger asChild><GlassActionButton label='Menu popup' icon={<span>C</span>}/></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onSelect={()=>setDialog(true)}>Open modal</DropdownMenuItem><DropdownMenuItem>Another action</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
<Select><SelectTrigger aria-label='Custom selector'><SelectValue placeholder='Select'/></SelectTrigger><SelectContent><SelectItem value='one'>Option one</SelectItem><SelectItem value='two'>Option two</SelectItem></SelectContent></Select>
<GlassActionButton label='Plain action' icon={<span>D</span>} onClick={()=>window.plainClicks=(window.plainClicks||0)+1}/>
<GlassActionButton label='Sheet popup' icon={<span>S</span>} onClick={()=>setSheet(true)}/>
<GlassActionButton label='Alert popup' icon={<span>!</span>} onClick={()=>setAlert(true)}/>
<GlassActionButton label='Legacy popup' icon={<span>L</span>} onClick={()=>setLegacy(true)}/>
<div ref={setSlot}/>
</GlassActionDock>
{slot&&createPortal(<GlassActionButton label='Portalled action' icon={<span>P</span>} onClick={()=>window.portalClicks=(window.portalClicks||0)+1}/>,slot)}
<Dialog open={dialog} onOpenChange={setDialog}><DialogContent><DialogTitle>Modal opened</DialogTitle><DialogDescription>From the action menu</DialogDescription></DialogContent></Dialog>
<Sheet open={sheet} onOpenChange={setSheet}><SheetContent><SheetTitle>Sheet shown</SheetTitle><SheetDescription>Action sheet</SheetDescription></SheetContent></Sheet>
<AlertDialog open={alert} onOpenChange={setAlert}><AlertDialogContent><AlertDialogTitle>Alert shown</AlertDialogTitle><AlertDialogDescription>Confirm an action</AlertDialogDescription><AlertDialogCancel>Cancel alert</AlertDialogCancel></AlertDialogContent></AlertDialog>
<ModernDialog open={legacy} onOpenChange={setLegacy}><ModernDialogContent size='sm'><ModernDialogTitle>Legacy shown</ModernDialogTitle><ModernDialogDescription>Existing school dialog</ModernDialogDescription></ModernDialogContent></ModernDialog>
{second&&<div style={{position:'fixed',right:0,top:150}}><GlassActionDock className='second-examples'><Popover><PopoverTrigger asChild><GlassActionButton label='Other bar' icon={<span>E</span>}/></PopoverTrigger><PopoverContent aria-label='Other bar content'>Other bar content</PopoverContent></Popover></GlassActionDock></div>}</>;}
function App(){const generic=location.pathname==='/popups';return <div style={{padding:16}}>{generic?<PopupExamples/>:<TimetablePage/>}</div>;}createRoot(document.getElementById('app')).render(<App/>);`;

async function run() {
  fs.mkdirSync(output,{recursive:true});
  const mocks = {
    'next/navigation':`export const usePathname=()=>'/timetable';export const useRouter=()=>({push(){},replace(){},prefetch(){}});`,
    'next/link':`import * as React from 'react';export default ({href,children,...props})=><a href={href} {...props}>{children}</a>;`,
    '@/lib/contexts/navigation-context':`export const useNavigation=()=>({goBack(){}});`,
    '@/lib/offline/android-bridge':`export const hasAndroidOfflineBridge=()=>false;export const androidOfflineRequest=async()=>({});`,
    '@/hooks/use-toast':`export const useToast=()=>({toast(){}});`,
    '@/lib/hooks/use-academic-years':`const data=[{id:'year',name:'2026',isActive:true,startDate:'2026-01-01',endDate:'2026-12-31',terms:[{id:'term',name:'Term 3',startDate:'2026-09-01',endDate:'2026-12-10'}]}];export const useAcademicYears=()=>({data});`,
    '@/lib/hooks/use-timetable':`const data=[{id:'profile',name:'Main Timetable'}];export const useTimetableProfiles=()=>({data});export const useClearTimetableOptionalSubjects=()=>({isPending:false,mutateAsync:async()=>0});`,
    '@/components/timetable/TimetableClock':`export const TimetableClock=()=>null;`,
    '@/components/timetable/CombinedTimelineView':`export const CombinedTimelineView=()=>null;`,
    '@/components/timetable/LiveTracker':`export const LiveTracker=()=>null;`,
    '@/components/timetable/TimetableViewPanel':timetableControls(),
    '@/components/timetable/StructureGenerator':`import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';export const StructureGenerator=({isOpen,onClose})=><Dialog open={isOpen} onOpenChange={v=>!v&&onClose()}><DialogContent><DialogTitle>New structure</DialogTitle><DialogDescription>Timetable structure</DialogDescription></DialogContent></Dialog>;`,
  };
  await esbuild.build({absWorkingDir:root,stdin:{contents:fixture,loader:'tsx',resolveDir:root},bundle:true,format:'iife',platform:'browser',jsx:'automatic',outfile:path.join(output,'fixture.js'),define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},plugins:[{name:'records',setup(b){b.onResolve({filter:/.*/},a=>Object.hasOwn(mocks,a.path)?{path:a.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:root}));}}]});
  const config={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.join(root,'tailwind.config.ts'),'utf8'),{compilerOptions:{module:1}}).outputText)(require,config,config.exports);
  const css=['globals.css','theme.css','brand-theme.css'].map(file=>fs.readFileSync(path.join(root,'src/app',file),'utf8').replace(/^@import[^;]+;/,'')).join('\n');
  const built=await require('postcss')([require('tailwindcss')({...config.exports.default,content:[path.join(root,'src/**/*.{ts,tsx}'),{raw:fixture,extension:'tsx'}]})]).process(css,{from:path.join(root,'src/app/globals.css')});fs.writeFileSync(path.join(output,'fixture.css'),built.css);
  const server=http.createServer((req,res)=>{const asset=['/fixture.js','/fixture.css'].includes(req.url)&&req.url.slice(1);if(asset){res.setHeader('Content-Type',asset.endsWith('js')?'text/javascript':'text/css');res.end(fs.readFileSync(path.join(output,asset)));}else res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="app"></div><script src="/fixture.js"></script></body></html>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[],reports=[];
  try {
    const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});page.on('pageerror',e=>{errors.push(e.message);console.error('Fixture page error:',e.message);});const url='http://127.0.0.1:'+server.address().port;
    console.log('Glass actions fixture ready; checking the actual timetable controls.');
    await page.goto(url);const filter=page.getByRole('combobox',{name:'Filter timetable by classes, class, teacher, or subject'});await filter.waitFor();await filter.selectOption('class');await page.getByRole('combobox',{name:'Choose class',exact:true}).waitFor();
    for(const width of [320,360,390,480,639,768,1440]){
      await page.setViewportSize({width,height:844});
      await page.waitForFunction(()=>{
        const bar=document.querySelector('.glass-navigation-surface');if(!bar||bar.getBoundingClientRect().width===0)return false;
        const actual=[...bar.querySelectorAll('button,a[href]:not(:has(button)),select,input,[role="button"]')].filter(el=>el.getBoundingClientRect().width>0).length;
        return Number(bar.style.getPropertyValue('--glass-navigation-items'))===Math.max(1,actual);
      });
      if(width<640)await page.waitForFunction(()=>{
        const items=document.querySelector('.glass-navigation-items');return items&&items.scrollWidth<=items.clientWidth+1;
      });
      const sizes=await page.locator('.glass-navigation-surface').evaluate(el=>{const i=el.querySelector('.glass-navigation-items'),b=el.getBoundingClientRect(),floating=el.closest('.glass-navigation-floating');return {width:innerWidth,bar:b.width,left:b.left,right:b.right,scroll:i.scrollWidth,client:i.clientWidth,controls:el.style.getPropertyValue('--glass-navigation-items'),available:floating?.getBoundingClientRect().width,accessory:document.querySelector('#timetable-mobile-edit-control')?.getBoundingClientRect().width};});
      assert.ok(sizes.bar>0&&sizes.left>=0&&sizes.right<=width+1,'Dock stays visible and on screen');
      if(width>=320&&width<640)assert.ok(sizes.scroll<=sizes.client+1,'Native selectors and buttons fit without scrolling at '+width);
      reports.push(sizes);
    }
    console.log('Timetable widths checked:',JSON.stringify(reports));
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'timetable-light.png')});await page.locator('.glass-navigation-floating').screenshot({path:path.join(output,'timetable-action-bar.png')});await page.evaluate(()=>document.documentElement.classList.add('dark'));await page.screenshot({path:path.join(output,'timetable-dark.png')});
    await page.getByRole('button',{name:'Actions',exact:true}).click();await page.getByRole('menu').waitFor();await filter.click();await filter.selectOption('teacher');await page.getByRole('menu').waitFor({state:'hidden'});
    await page.goto(url+'/popups');await page.setViewportSize({width:1440,height:900});const first=page.getByRole('button',{name:'First popup',exact:true}),second=page.getByRole('button',{name:'Second popup',exact:true});
    await first.click();await page.getByLabel('First field').waitFor();await second.click();await page.getByLabel('Second field').waitFor();await page.getByLabel('First field').waitFor({state:'hidden'});assert.ok(await page.getByLabel('Second field').evaluate(el=>el.closest('[role="dialog"]').contains(document.activeElement)),'Replaced popup does not steal focus');
    await second.click();await page.getByLabel('Second field').waitFor({state:'hidden'});
    await first.click();await page.getByRole('button',{name:'Portalled action',exact:true}).click();await page.getByLabel('First field').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>window.portalClicks),1);
    await first.click();await page.getByRole('button',{name:'Menu popup',exact:true}).click();await page.getByRole('menu').waitFor();await page.getByLabel('First field').waitFor({state:'hidden'});await second.click();await page.getByRole('menu').waitFor({state:'hidden'});await page.getByLabel('Second field').waitFor();
    // Radix Select temporarily hides background roles while its listbox is open;
    // use the still-visible button title to exercise a physical mouse switch.
    await page.getByRole('combobox',{name:'Custom selector'}).click();await page.getByRole('listbox').waitFor();await page.getByLabel('Second field').waitFor({state:'hidden'});await page.getByTitle('First popup',{exact:true}).click();await page.getByRole('listbox').waitFor({state:'hidden'});await page.getByLabel('First field').waitFor();
    await page.evaluate(()=>window.mountLatePopup());await page.getByRole('button',{name:'Other bar',exact:true}).click();await page.getByLabel('First field').waitFor({state:'hidden'});await page.getByText('Other bar content',{exact:true}).waitFor();
    await first.focus();await page.keyboard.press('Enter');await page.getByText('Other bar content',{exact:true}).waitFor({state:'hidden'});await page.getByLabel('First field').waitFor();await page.keyboard.press('Escape');await page.getByLabel('First field').waitFor({state:'hidden'});
    for(const [button,title] of [['Sheet popup','Sheet shown'],['Alert popup','Alert shown'],['Legacy popup','Legacy shown']]){
      await first.click();await page.getByLabel('First field').waitFor();await page.getByRole('button',{name:button,exact:true}).click();await page.getByRole('heading',{name:title,exact:true}).waitFor();await page.getByLabel('First field').waitFor({state:'hidden'});
      if(button==='Alert popup')await page.getByRole('button',{name:'Cancel alert',exact:true}).click();else await page.keyboard.press('Escape');await page.getByRole('heading',{name:title,exact:true}).waitFor({state:'hidden'});
    }
    await page.getByRole('button',{name:'Menu popup',exact:true}).click();await page.getByRole('menuitem',{name:'Open modal',exact:true}).click();await page.getByRole('heading',{name:'Modal opened',exact:true}).waitFor();assert.equal(await page.getByRole('menu').count(),0);await page.keyboard.press('Escape');
    const touch=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});touch.on('pageerror',e=>errors.push(e.message));await touch.goto(url+'/popups');
    await touch.getByRole('button',{name:'Menu popup',exact:true}).tap();await touch.getByRole('menu').waitFor();await touch.getByRole('button',{name:'Second popup',exact:true}).tap();await touch.getByRole('menu').waitFor({state:'hidden'});await touch.getByLabel('Second field').waitFor();await touch.getByRole('button',{name:'Second popup',exact:true}).tap();await touch.getByLabel('Second field').waitFor({state:'hidden'});
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({reports,exclusivePopups:true,portalledControls:true,keyboard:true,touch:true,errors},null,2));console.log('GLASS_ACTIONS_OK: real timetable controls fit from 320px through desktop; popup switching, same-trigger toggle, portals, keyboard, touch and modal handoff.');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
