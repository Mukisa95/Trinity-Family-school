// Real drawer, navigation context, content status and Android synchronizer; router/network boundaries are simulated.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const esbuild=require('esbuild'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'output/mobile-navigation-qa');
async function run(){
 fs.mkdirSync(output,{recursive:true});
 const contents=`
import React,{createContext,useState,useRef} from 'react';import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {Users,Home,Wallet,Zap} from 'lucide-react';
import {NavigationProvider,useNavigation} from './src/lib/contexts/navigation-context';
import {NavigationContent} from './src/components/layout/navigation-content';import {MobileSidebar} from './src/components/layout/mobile-sidebar';
import {AndroidOfflineProvider} from './src/components/providers/android-offline-provider';
import {isNavigationPending} from './src/lib/navigation/navigation-work';
window.Auth=createContext(null);window.NavFixture=createContext(null);window.prefetchCalls=[];window.prepared=new Set();window.exportCount=0;window.saveCount=0;window.Native=true;window.recoveryRequests=[];
window.session={schema:1,accountId:'test-admin',role:'Admin',grants:{pupils:true,timetable:false},pupilIds:[]};
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});window.changeSavedData=()=>{client.setQueryData(['pupils','list'],[{id:'synthetic'}]);window.dispatchEvent(new CustomEvent('trinity-native-cache-written',{detail:{key:'trinity-family-schools::pupils::user:test-admin'}}));};
const items=[{title:'Dashboard',href:'/',icon:Home,section:'Overview'},{title:'Pupils',href:'/pupils',icon:Users,section:'Academics'},
{title:'Timetable',href:'/timetable',icon:Home,section:'Academics'},
{title:'Fees',href:'/fees/collection',icon:Wallet,section:'Finance'},{title:'SchoolPay',href:'/accounts/schoolpay-feed',icon:Zap,section:'Finance'},
{title:'Disabled',href:'/disabled',icon:Zap,disabled:true,section:'Administration'}];
function Page(){const nav=useNavigation();window.nav=nav;window.navigationPending=isNavigationPending;
const state=React.useContext(window.NavFixture);if(state.loading)return <div data-route-content-pending id='route-fallback'>Loading route</div>;
return <><span id='path'>{nav.currentPath}</span><button id='old-record'>Old page action</button><div style={{height:1800}}>Page content</div></>;}
function App(){const [pathname,setPath]=useState('/'),[open,setOpen]=useState(false),[signed,setSigned]=useState(false),[epoch,setEpoch]=useState(0),[loading,setLoading]=useState(false);window.setRouteLoading=setLoading;
const timer=useRef();window.setSigned=setSigned;window.setDrawer=setOpen;window.wake=()=>setEpoch(n=>n+1);
window.setOffline=offline=>{window.trinityAndroidConnected=!offline;window.dispatchEvent(new Event('trinity-android-connectivity'));};
window.commit=(href)=>{history.pushState({},'',href);setPath(new URL(href,location.origin).pathname);};
window.router=window.router||{prefetch:href=>{window.prefetchCalls.push(href);setTimeout(()=>window.prepared.add(href),20);},
push:href=>{clearTimeout(timer.current);const delay=window.routeDelay??(window.prepared.has(href)?25:5200);timer.current=setTimeout(()=>window.commit(href),delay);},replace:href=>window.router.push(href)};
const auth={user:{id:'test-admin',role:'Admin',username:'Test',isActive:true},isLoading:false,isLocked:false,isSignedIdentityReady:signed};
return <window.Auth.Provider value={auth}><window.NavFixture.Provider value={{path:pathname,epoch,loading}}><QueryClientProvider client={client}>
<AndroidOfflineProvider/><NavigationProvider><header className='app-topbar'><button id='menu' onClick={()=>setOpen(true)}>Menu</button><button id='header-action' onClick={()=>window.headerClicks=(window.headerClicks||0)+1}>Header action</button></header>
<aside id='desktop-nav'>Desktop sidebar</aside><main id='main'><NavigationContent><Page/></NavigationContent></main>
<MobileSidebar items={items} isOpen={open} onClose={()=>setOpen(false)}/></NavigationProvider></QueryClientProvider></window.NavFixture.Provider></window.Auth.Provider>;}
createRoot(document.getElementById('root')).render(<App/>);`;
 const mocks={
  '@/lib/navigation/route-recovery':`export {claimAutomaticRouteRecovery,internalNavigationHref,ROUTE_RECOVERY_AFTER_MS} from './src/lib/navigation/route-recovery';export const navigateToRecoveryRoute=href=>window.recoveryRequests.push(href);`,
  'next/navigation':`import {useContext} from 'react';export const usePathname=()=>useContext(window.NavFixture).path;export const useRouter=()=>window.router;`,
  'next/link':`import React from 'react';export default function Link({href,onClick,children,...rest}){return <a {...rest} href={href} onClick={e=>{onClick?.(e);if(!e.defaultPrevented&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();window.router.push(href);}}}>{children}</a>;}`,
  'next/image':`import React from 'react';export default ({fill,...props})=><img {...props}/>;`,
  '@/lib/contexts/auth-context':`import {useContext} from 'react';export const useAuth=()=>useContext(window.Auth);`,
  '@/lib/hooks/use-school-settings':`const data={generalInfo:{name:'School',logo:'',motto:''},socialMedia:{}};export const useSchoolSettings=()=>({data,isLoading:false});`,
  '@/components/layout/sidebar-user-footer':`export const SidebarUserFooter=()=>null;`,
  './sidebar-user-footer':`export const SidebarUserFooter=()=>null;`,
  '@/lib/services/granular-permissions.service':`export const GranularPermissionService={canAccessPage:()=>true,canAccessInventoryWorkspace:()=>true};`,
  '@/lib/firebase':`export const auth={currentUser:{uid:'test-admin',getIdToken:async()=>'test-token'},onIdTokenChanged:()=>()=>{}};`,
  '@/lib/offline/android-bridge':`export const hasAndroidOfflineBridge=()=>window.Native;export const androidOfflineRequest=async action=>{if(action==='save')window.saveCount++;return {session:window.session};};`,
  '@/lib/offline/android-cache-export':`export const exportAndroidCachedSnapshot=async()=>{window.exportCount++;return {schema:1,accountId:'test-admin',role:'Admin',capturedAt:new Date().toISOString(),datasets:{pupils:{data:[],preparedAt:new Date().toISOString()}}};};`,
  '@/lib/offline/android-contracts':`export const isAndroidOfflineSnapshot=()=>true;`,
  '@/lib/parent-offline/repository':`export const subscribeToParentOfflineChanges=()=>()=>{};`,
  '@/lib/offline/android-app-shell':`export const isAndroidOffline=()=>false;export const prepareAndroidAppShell=async()=>{};export const installAndroidOfflineNavigation=()=>()=>{};`,
  '@/hooks/use-toast':`export const toast=()=>{};`,
  '@/lib/hooks/use-academic-years':`export const useAcademicYears=()=>({data:[]});`,
  '@/lib/hooks/use-timetable':`export const useTimetableEntries=()=>({});export const useTimetablePeriods=()=>({});export const useTimetableProfiles=()=>({data:[]});`,
  '@/lib/hooks/use-classes':`export const useClasses=()=>({data:[]});`,
  '@/lib/hooks/use-subjects':`export const useSubjects=()=>({data:[]});`,
  '@/lib/hooks/use-staff':`export const useStaff=()=>({data:[]});`,
  '@/lib/hooks/use-events-fixed':`export const useEvents=()=>({data:[]});export const useExamsAsEvents=()=>({data:[]});`,
 };
 const built=await esbuild.build({stdin:{contents,loader:'tsx',resolveDir:root},bundle:true,format:'iife',platform:'browser',write:false,jsx:'automatic',
 define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID':'"trinity-family-schools"'},
 plugins:[{name:'boundaries',setup(build){build.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:undefined);
 build.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'tsx',resolveDir:root}));}}]});
 // Compile the current styles instead of relying on an unrelated local Next build.
 const ts=require('typescript'),config={exports:{}};
 new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.join(root,'tailwind.config.ts'),'utf8'),{compilerOptions:{module:1}}).outputText)(require,config,config.exports);
 const sourceCss=fs.readFileSync(path.join(root,'src/app/globals.css'),'utf8').replace(/^@import[^;]+;/,'')+'\n'+fs.readFileSync(path.join(root,'src/app/theme.css'),'utf8')+'\n'+fs.readFileSync(path.join(root,'src/app/brand-theme.css'),'utf8');
 const css=(await require('postcss')([require('tailwindcss')({...config.exports.default,content:[path.join(root,'src/**/*.{ts,tsx}'),{raw:contents,extension:'tsx'}]})]).process(sourceCss,{from:path.join(root,'src/app/globals.css')})).css;
 const extra=`body{margin:0} .app-topbar{position:sticky;top:0;z-index:40;height:52px;background:var(--background,#fff);display:flex;gap:16px;align-items:center}#main{padding:0 16px;min-height:700px}#desktop-nav{display:none}@media(min-width:768px){#desktop-nav{display:block;position:fixed;top:0;left:0;width:240px;height:100vh;z-index:20;background:#ddd}.app-topbar{margin-left:240px}#main{margin-left:240px;height:calc(100vh - 52px);overflow:auto}}`;
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':req.url==='/styles.css'?'text/css':'text/html');res.end(req.url==='/fixture.js'?built.outputFiles[0].text:req.url==='/styles.css'?css+extra:'<!doctype html><link rel="stylesheet" href="/styles.css"><div id="root"></div><script src="/fixture.js"></script>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',error=>{errors.push(error.message);console.error('Fixture page error:',error.message);});const url='http://127.0.0.1:'+server.address().port;
  await page.goto(url);await page.waitForFunction(()=>window.nav);await page.waitForFunction(()=>window.exportCount>0);
  assert.equal(await page.evaluate(()=>window.prefetchCalls.length),0,'Unverified identity must not start route warmups');
  await page.evaluate(()=>{window.routeDelay=9000;window.exportsBefore=window.exportCount;});
  await page.locator('#menu').click();await page.locator('.app-mobile-sidebar').getByRole('link',{name:'Pupils',exact:true}).click();
  await page.getByRole('status').waitFor();await page.evaluate(()=>window.changeSavedData());
  assert.equal(await page.locator('#old-record').evaluate(el=>!!el.closest('[inert]')),false,'Navigation must not make existing records inert');
  await page.waitForTimeout(5100);assert.ok(await page.getByRole('status').isVisible(),'Progress must remain through a five-second wait');
  assert.ok(await page.getByText('This is taking longer than usual.').isVisible());
  assert.equal(await page.evaluate(()=>window.exportCount),await page.evaluate(()=>window.exportsBefore),'Native snapshot export must wait until navigation settles');
  const bounds=await page.evaluate(()=>{const card=document.querySelector('[role=status]').getBoundingClientRect(),header=document.querySelector('.app-topbar').getBoundingClientRect();return {top:card.top,bottom:header.bottom,left:card.left,right:card.right,width:innerWidth,height:card.height};});
  assert.ok(bounds.top>=bounds.bottom);assert.ok(bounds.left>=0&&bounds.right<=bounds.width);
  assert.ok(bounds.height>200,'Card surface must contain the spinner and text rather than collapse to a border strip');
  await page.locator('#header-action').click();assert.equal(await page.evaluate(()=>window.headerClicks),1);
  await page.screenshot({path:path.join(output,'mobile-wait-light.png')});
  await page.locator('#menu').click();assert.ok(await page.locator('.app-mobile-sidebar').isVisible(),'Menu must open over the content card');await page.locator('.app-mobile-sidebar button').first().click();
  await page.waitForFunction(()=>window.nav.currentPath==='/pupils'&&!window.nav.isNavigating);await page.waitForFunction(()=>window.exportCount>window.exportsBefore);
  assert.equal(await page.getByRole('status').count(),0);assert.equal(await page.locator('#old-record').evaluate(el=>!!el.closest('[inert]')),false);
  await page.evaluate(()=>{window.setSigned(true);window.routeDelay=undefined;});
  await page.waitForFunction(()=>window.prepared.has('/fees/collection')&&window.prepared.has('/accounts/schoolpay-feed')&&window.prepared.has('/timetable'));
  assert.equal(await page.locator('.app-mobile-sidebar').count(),0,'Common routes prepare while drawer is closed');
  const prefetched=await page.evaluate(()=>window.prefetchCalls);assert.ok(!prefetched.includes('/disabled'));assert.ok(prefetched.length<=4);
  await page.locator('#menu').click();await page.locator('.app-mobile-sidebar').getByRole('link',{name:'Fees',exact:true}).click();
  await page.waitForFunction(()=>window.nav.currentPath==='/fees/collection');assert.equal(await page.getByRole('status').count(),0,'Fast prepared navigation should not flash a card');
  await page.evaluate(()=>{window.nav.startNavigation('Another term','/fees/collection?term=two');window.commit('/fees/collection?term=two');});
  await page.waitForFunction(()=>!window.nav.isNavigating,'query-only route changes must finish progress');
  await page.evaluate(()=>{window.setRouteLoading(true);window.exportsBefore=window.exportCount;window.nav.startNavigation('Pupils','/pupils');window.commit('/pupils');window.changeSavedData();});
  await page.locator('#route-fallback').waitFor();await page.waitForTimeout(900);
  assert.equal(await page.evaluate(()=>!window.nav.isNavigating&&window.navigationPending()),true,'URL commit releases UI while native preparation waits for an explicit route fallback');
  assert.equal(await page.evaluate(()=>window.exportCount),await page.evaluate(()=>window.exportsBefore),'Fallback must keep Android preparation paused after URL commit');
  await page.evaluate(()=>window.setRouteLoading(false));await page.waitForFunction(()=>!window.nav.isNavigating);
  assert.equal(await page.getByRole('status').count(),0,'Ready content must immediately remove the card');
  assert.equal(await page.locator('#old-record').evaluate(el=>!!el.closest('[inert]')),false);
  await page.evaluate(()=>{const node=document.createElement('div');node.hidden=true;node.setAttribute('data-route-content-pending','');document.querySelector('[aria-busy]').append(node);});
  await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.navigationPending()),false,'Hidden streaming fallbacks must not block ready content');
  await page.evaluate(()=>window.nav.startNavigation('Current page',location.pathname+location.search));assert.equal(await page.evaluate(()=>window.nav.isNavigating),false);
  await page.evaluate(()=>{window.setOffline(true);window.prefetchCalls=[];window.setDrawer(true);});await page.waitForTimeout(1000);assert.equal(await page.evaluate(()=>window.prefetchCalls.length),0);
  await page.evaluate(()=>{window.setOffline(false);window.routeDelay=5500;document.documentElement.classList.add('dark');window.nav.startNavigation('Timetable','/timetable');});
  await page.getByRole('status').waitFor();await page.setViewportSize({width:320,height:640});await page.screenshot({path:path.join(output,'mobile-wait-dark-menu-320.png')});
  await page.evaluate(()=>window.setDrawer(false));await page.screenshot({path:path.join(output,'mobile-wait-dark-320.png')});
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('[role=status] .rounded-full.animate-spin').evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.emulateMedia({media:'print'});assert.equal(await page.locator('[data-navigation-loading]').evaluate(el=>getComputedStyle(el).display),'none');await page.emulateMedia({media:'screen'});
  await page.setViewportSize({width:1280,height:800});await page.evaluate(()=>window.setDrawer(false));
  const desktopBounds=await page.evaluate(()=>{const card=document.querySelector('[role=status]').getBoundingClientRect(),sidebar=document.querySelector('#desktop-nav').getBoundingClientRect(),header=document.querySelector('.app-topbar').getBoundingClientRect();return {cardLeft:card.left,sidebarRight:sidebar.right,cardTop:card.top,headerBottom:header.bottom};});
  assert.ok(desktopBounds.cardLeft>=desktopBounds.sidebarRight&&desktopBounds.cardTop>=desktopBounds.headerBottom);
  await page.screenshot({path:path.join(output,'desktop-wait-dark.png')});await page.evaluate(()=>window.nav.stopNavigation());
  // Ordinary page loaders do not start navigation or trigger reloads.
  await page.evaluate(()=>{window.commit('/timetable');const node=document.createElement('div');node.setAttribute('data-workspace-page-loading','');node.textContent='Loading one field';document.querySelector('[aria-busy]').append(node);});
  await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.nav.isNavigating),false);
  assert.equal(await page.getByRole('status').count(),0);assert.equal(await page.evaluate(()=>window.recoveryRequests.length),0);
  await page.evaluate(()=>{window.Native=false;window.setRouteLoading(true);window.commit('/browser-pupils');});
  await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.nav.isNavigating||window.navigationPending()),false,'Browser route fallbacks must not acquire native preparation pauses or a navigation card');
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({fiveSecondProgress:true,chromeUsable:true,contentInteractive:true,prefetchBeforeTap:true,offlineNoPrefetch:true,queryOnlyCompletion:true,snapshotDeferred:true,urlCommitReleasesUI:true,hiddenFallbackIgnored:true,ordinaryLoadersDoNotBlock:true,noAutomaticReload:true,fastNoFlash:true,errors},null,2));
  console.log('Mobile navigation browser checks passed.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
