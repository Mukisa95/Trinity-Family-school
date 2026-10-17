/* Real production Next router + service worker, with synthetic pages and records.
 * No hosted school, Firebase account, or private records are opened. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'), fixture=path.join(root,'output/android-spa-fixture');
const playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const homeScreen=process.env.OFFLINE_PLATFORM==='pwa';
fs.mkdirSync(path.join(fixture,'app'),{recursive:true});fs.mkdirSync(path.join(fixture,'public'),{recursive:true});
if(!fs.existsSync(path.join(fixture,'node_modules')))fs.symlinkSync(path.join(root,'node_modules'),path.join(fixture,'node_modules'),'junction');
fs.writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'offline-navigation-fixture',private:true}));
fs.writeFileSync(path.join(fixture,'next.config.js'),`module.exports={typescript:{ignoreBuildErrors:true},eslint:{ignoreDuringBuilds:true},experimental:{cpus:2,externalDir:true},webpack(config){config.resolve.alias['@']=${JSON.stringify(path.join(root,'src'))};return config}}`);
fs.copyFileSync(path.join(root,'public/sw.js'),path.join(fixture,'public/sw.js'));
fs.mkdirSync(path.join(fixture,'public/images'),{recursive:true});
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
for(const file of ['trinity-logo-192.png','trinity-logo-512.png','images/D.B background.png'])fs.writeFileSync(path.join(fixture,'public',file),pixel);
for(const file of ['manifest.json','parent-manifest.json'])fs.writeFileSync(path.join(fixture,'public',file),'{}');
const appShell=path.join(root,'src/lib/offline/android-app-shell').replaceAll('\\','/');
const indicator=path.join(root,'src/components/layout/network-strength-indicator').replaceAll('\\','/');
const shortcuts=path.join(root,'src/components/common/android-shortcut-navigator').replaceAll('\\','/');
fs.writeFileSync(path.join(fixture,'app/client.jsx'),`'use client';
import React,{useEffect,useState}from'react';import Link from'next/link';import{useRouter,usePathname,useSearchParams}from'next/navigation';
import{installAndroidOfflineNavigation,prepareAndroidAppShell}from'${appShell}';import{NetworkStrengthIndicator}from'${indicator}';
import{AndroidShortcutNavigator}from'${shortcuts}';
const session={schema:1,accountId:'fixture',role:'Admin',grants:{dashboard:true,pupils:true,timetable:true,events:true}};
export function Shell({children}){const router=useRouter();const[ready,setReady]=useState(false);const[blocked,setBlocked]=useState(0);
useEffect(()=>{window.shellMounts=(window.shellMounts||0)+1;window.fixtureRouter=router;window.prepareFixture=async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;await prepareAndroidAppShell(window.parentFixture?{...session,role:'Parent'}:session);setReady(true)};return installAndroidOfflineNavigation(window.parentFixture?'Parent':'Admin',()=>setBlocked(x=>x+1),{navigate:href=>router.push(href)})},[router]);
return <><AndroidShortcutNavigator/><header><input aria-label="Header state" defaultValue="kept"/><NetworkStrengthIndicator/><span id="blocked">{blocked}</span><span id="ready">{ready?'ready':'waiting'}</span></header><nav>{['/','/pupils','/pupil-detail?id=child-1','/pupil-detail?id=child-2','/timetable','/events','/parent','/parent/settings','/finance'].map(href=><Link prefetch={false} key={href} href={href}>{href}</Link>)}<a href="/events" id="plain-events">Plain events</a><button onClick={()=>router.push('/timetable')}>Programmatic timetable</button><button onClick={()=>router.push('/finance')}>Programmatic finance</button><button onClick={()=>router.back()}>Back</button><button onClick={()=>router.replace('/events')}>Replace events</button></nav>{children}</>}
export function Content(){const path=usePathname(),query=useSearchParams();return <main><h1>{path}</h1><output id="pupil">{query.get('id')}</output><input aria-label="Page state" defaultValue="saved page"/></main>}
`);
fs.writeFileSync(path.join(fixture,'app/layout.jsx'),`import React,{Suspense}from'react';import{Shell}from'./client';export default function Layout({children}){return <html><body><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify({name:'School 😀 é'.repeat(300)})}}/><Suspense><Shell>{children}</Shell></Suspense></body></html>}`);
for(const route of ['','pupils','pupil-detail','timetable','events','exams','parent','parent/settings','settings/account','finance','login']){
 const dir=path.join(fixture,'app',route);fs.mkdirSync(dir,{recursive:true});const relative=path.relative(dir,path.join(fixture,'app/client')).replaceAll('\\','/');fs.writeFileSync(path.join(dir,'page.jsx'),`import React,{Suspense}from'react';import{Content}from'${relative.startsWith('.')?relative:'./'+relative}';export default function Page(){return <Suspense><Content/></Suspense>}`);
}
function command(args){return new Promise((resolve,reject)=>{const proc=spawn(process.execPath,[require.resolve('next/dist/bin/next'),...args],{cwd:fixture,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});let output='';proc.stdout.on('data',x=>output+=x);proc.stderr.on('data',x=>output+=x);proc.on('exit',code=>code===0?resolve():reject(new Error(output)));});}
(async()=>{
if(!process.env.SKIP_FIXTURE_BUILD)await command(['build']);console.log('NEXT_NAVIGATION_FIXTURE_BUILT');
const port=19347,origin='http://127.0.0.1:'+port;const server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','-p',String(port)],{cwd:fixture,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
let startupOutput='';server.stdout.on('data',chunk=>startupOutput+=chunk);server.stderr.on('data',chunk=>startupOutput+=chunk);
let browser;try{
let ready=false;for(let i=0;i<400;i++){try{if((await fetch(origin)).ok){ready=true;break}}catch{}if(server.exitCode!==null)break;await new Promise(r=>setTimeout(r,150));}
if(!ready)throw new Error('Fixture server did not start: '+startupOutput);
browser=await playwright[process.env.PLAYWRIGHT_ENGINE||'chromium'].launch({...(process.env.PLAYWRIGHT_ENGINE==='webkit'?{}:{channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'}),headless:true});
for(const parent of [false,true]){
 const context=await browser.newContext({viewport:{width:390,height:844}});await context.addInitScript(({parent,homeScreen})=>{window.parentFixture=parent;window.shortcutReady=false;window.searchRequests=0;window.addEventListener('trinity-open-dashboard-search',()=>window.searchRequests++);if(homeScreen)Object.defineProperty(navigator,'standalone',{value:true});else window.TrinityOffline={postMessage(raw){const message=JSON.parse(raw);if(message.action==='shortcutRouterReady')window.shortcutReady=true;queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({id:message.id,success:true})}));}};window.trinityAndroidConnected=true;},{parent,homeScreen});
 let probes=0;await context.route('https://www.gstatic.com/**',route=>{probes++;return route.fulfill({status:204,body:''})});
 let page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(origin+(parent?'/parent':'/'));await page.waitForFunction(()=>window.prepareFixture);await page.evaluate(()=>window.prepareFixture());await page.waitForFunction(()=>navigator.serviceWorker.controller);await page.locator('#ready').filter({hasText:'ready'}).waitFor();
 await page.getByLabel('Header state').fill('keep session and header');await page.evaluate(()=>window.documentMarker='same-document');const baseMounts=await page.evaluate(()=>window.shellMounts);
 let documentRequests=0;page.on('request',request=>{if(request.isNavigationRequest())documentRequests++});
 if(!parent&&!homeScreen){
  await page.waitForFunction(()=>window.shortcutReady);
  for(const [id,route] of [['timetable','/timetable'],['events','/events'],['pupils','/pupils'],['exams','/exams'],['search','/?openSearch=1']]){
   await page.evaluate(id=>window.dispatchEvent(new CustomEvent('trinity-android-shortcut',{detail:id})),id);await page.waitForURL(origin+route);await page.waitForFunction(path=>document.querySelector('h1')?.textContent===path,route.split('?')[0]);
   assert.equal(await page.evaluate(()=>window.documentMarker),'same-document');assert.equal(await page.evaluate(()=>window.shellMounts),baseMounts);assert.equal(await page.getByLabel('Header state').inputValue(),'keep session and header');
  }
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('trinity-android-shortcut',{detail:'search'})));await page.waitForFunction(()=>window.searchRequests===1);
  assert.equal(documentRequests,0);
 }
 // Native offline signal arrives while WebView navigator still reports online.
 if(homeScreen)await context.setOffline(true);
 await page.evaluate(()=>{window.trinityAndroidConnected=false;window.dispatchEvent(new Event('trinity-android-connectivity'))});await page.getByRole('button',{name:'Network: Offline',exact:true}).waitFor();const measured=probes;
 if(!parent){await page.waitForTimeout(10_100);assert.equal(probes,measured);await page.getByRole('button',{name:'Network: Offline',exact:true}).waitFor();}
 await context.setOffline(true);
 const routes=parent?['/parent/settings','/parent','/parent/settings']:['/pupils','/pupil-detail?id=child-1','/pupil-detail?id=child-2','/timetable','/events','/pupils'];
 for(const route of routes){await page.getByRole('link',{name:route,exact:true}).click();await page.waitForURL(origin+route);await page.waitForFunction(path=>document.querySelector('h1')?.textContent===path,route.split('?')[0]);assert.equal(await page.evaluate(()=>window.documentMarker),'same-document');assert.equal(await page.getByLabel('Header state').inputValue(),'keep session and header');assert.equal(await page.evaluate(()=>window.shellMounts),baseMounts);if(route.includes('?'))assert.equal(await page.locator('#pupil').innerText(),new URL(route,origin).searchParams.get('id'));}
 if(!parent){
  if(!homeScreen){
   for(const [id,route] of [['timetable','/timetable'],['events','/events'],['pupils','/pupils']]){await page.evaluate(id=>window.dispatchEvent(new CustomEvent('trinity-android-shortcut',{detail:id})),id);await page.waitForURL(origin+route);assert.equal(await page.evaluate(()=>window.documentMarker),'same-document');assert.equal(await page.evaluate(()=>window.shellMounts),baseMounts);}
   await page.evaluate(()=>window.dispatchEvent(new CustomEvent('trinity-android-shortcut',{detail:'exams'})));await page.waitForTimeout(150);assert.equal(page.url(),origin+'/pupils');
  }
  await page.getByRole('button',{name:'Programmatic timetable',exact:true}).click();await page.waitForURL(origin+'/timetable');await page.getByRole('button',{name:'Back',exact:true}).click();await page.waitForURL(origin+'/pupils');
  await page.getByRole('button',{name:'Replace events',exact:true}).click();await page.waitForURL(origin+'/events');await page.locator('#plain-events').click();
  await page.getByRole('link',{name:'/finance',exact:true}).click();await page.waitForFunction(()=>Number(document.querySelector('#blocked').textContent)>0);assert.equal(page.url(),origin+'/events');
  await page.getByRole('button',{name:'Programmatic finance',exact:true}).click();await page.waitForTimeout(250);assert.equal(page.url(),origin+'/events');assert.equal(await page.evaluate(()=>window.documentMarker),'same-document');
  // Delete one prepared tree: remain on the useful current page, then recover online.
  await page.evaluate(async()=>{for(const name of await caches.keys())if(name.startsWith('android-app-shell-')){const cache=await caches.open(name);for(const key of await cache.keys())if(key.url.endsWith('/%2Ftimetable'))await cache.delete(key)}});
  await page.getByRole('link',{name:'/timetable',exact:true}).click();await page.waitForTimeout(150);assert.equal(page.url(),origin+'/events');
 }
 assert.equal(documentRequests,0);assert.equal(probes,measured);assert.deepEqual(errors,[]);
 if(process.env.PLAYWRIGHT_ENGINE==='webkit'){
  // Playwright WebKit rejects even a literal SW navigation with setOffline(true):
  // https://github.com/microsoft/playwright/issues/42775
  // Keep the warm-navigation coverage above; do not call cold launch verified.
  console.log('WEBKIT_COLD_OFFLINE_NOT_VERIFIED: Playwright offline navigation limitation; test on iPhone.');
  await context.setOffline(false);await page.evaluate(()=>{window.trinityAndroidConnected=true;window.dispatchEvent(new Event('trinity-android-connectivity'))});
  await page.getByRole('link',{name:parent?'/parent':'/timetable',exact:true}).click();await page.waitForURL(origin+(parent?'/parent':'/timetable'));assert.equal(await page.evaluate(()=>window.documentMarker),'same-document');
  await context.close();continue;
 }
 // Cold offline launch remains supported; next transitions remain in that document.
 await page.close();page=await context.newPage();await page.goto(origin+(parent?'/parent':'/'));await page.waitForFunction(()=>window.fixtureRouter);await page.evaluate(()=>{window.trinityAndroidConnected=false;window.documentMarker='cold-document';window.dispatchEvent(new Event('trinity-android-connectivity'))});
 if(!parent){
  // A newer deployment's tree must never be replayed into an older open client.
  await page.evaluate(async()=>{const cache=await caches.open('android-app-shell-build-99999999999999999');await cache.put('/__trinity_saved_route/foreign-build/%2Ftimetable',new Response('0:{"b":"foreign-build","f":[],"S":false}\n',{headers:{'Content-Type':'text/x-component'}}))});
  await page.getByRole('button',{name:'Programmatic timetable',exact:true}).click();await page.waitForTimeout(250);assert.equal(page.url(),origin+'/');assert.equal(await page.evaluate(()=>window.documentMarker),'cold-document');
  // Failure of the storage API must cancel navigation, not trigger Next's MPA fallback.
  await page.evaluate(()=>{window.cacheKeys=caches.keys.bind(caches);caches.keys=async()=>{throw new Error('fixture storage unavailable')}});
  await page.evaluate(()=>window.fixtureRouter.push('/pupils'));await page.waitForTimeout(150);assert.equal(page.url(),origin+'/');assert.equal(await page.evaluate(()=>window.documentMarker),'cold-document');
  await page.getByRole('link',{name:'/events',exact:true}).click();await page.waitForTimeout(150);assert.equal(page.url(),origin+'/');await page.evaluate(()=>{caches.keys=window.cacheKeys});
 }
 const coldRoute=parent?'/parent/settings':'/events';await page.getByRole('link',{name:coldRoute,exact:true}).click();await page.waitForURL(origin+coldRoute);assert.equal(await page.evaluate(()=>window.documentMarker),'cold-document');
 await context.setOffline(false);await page.evaluate(()=>{window.trinityAndroidConnected=true;window.dispatchEvent(new Event('trinity-android-connectivity'))});await page.getByRole('link',{name:parent?'/parent':'/timetable',exact:true}).click();await page.waitForURL(origin+(parent?'/parent':'/timetable'));assert.equal(await page.evaluate(()=>window.documentMarker),'cold-document');
 await context.close();
}
console.log(`${homeScreen?'PWA':'ANDROID'}_OFFLINE_SPA_OK: real Next routes, push/replace/back, parent routes, zero document reloads/pings, unavailable routes and reconnect. Cold launch checked in Chromium only.`);
}finally{if(browser)await browser.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1});
