// Real collector, User Timing, query/mutation caches and page readiness; simulated storage transport/native bridge.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const esbuild=require('esbuild'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'output/operational-measurements-qa');
async function run(){
 fs.mkdirSync(output,{recursive:true});
 const contents=`
import React,{createContext,useState} from 'react';import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider,useMutation} from '@tanstack/react-query';
import {OperationalAuditProvider} from './src/components/providers/operational-audit-provider';
import {usePageDataTiming} from './src/lib/hooks/use-page-data-timing';
import {measureWorkspaceStep,measureWorkspaceDuration,measureWorkspaceOperation} from './src/lib/startup/workspace-timing';
import {androidOfflineRequest} from './src/lib/offline/android-bridge';
import {buildOperationalAuditMarkdown} from './src/lib/operational-audit/core';
window.Auth=createContext(null);window.auditWrites=[];window.failRecovery=true;
window.saveAudit=async input=>{if(input.appVersion==='old-build'&&window.failRecovery)throw Error('offline replay');window.auditWrites.push(input);};
const interval=window.setInterval.bind(window);window.setInterval=(fn,ms)=>{if(ms===600000)window.flushAudit=fn;return interval(fn,ms);};
const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
function Fixture(){const [user,setUser]=useState({id:'fixture-admin',role:'Admin',username:'Fixture'});
const [ready,setReady]=useState(false),[visible,setVisible]=useState(false),[visit,setVisit]=useState('first');
usePageDataTiming('pupils',ready,visit);
const mutation=useMutation({mutationKey:['payments','create'],mutationFn:async()=>{await new Promise(r=>setTimeout(r,60));return 'saved';}});
window.cloneUser=()=>setUser(u=>({...u}));window.setReady=setReady;window.setVisible=setVisible;window.setVisit=setVisit;
window.runMutation=()=>mutation.mutateAsync();window.runQuery=()=>client.fetchQuery({queryKey:['pupils','list'],queryFn:async()=>{await new Promise(r=>setTimeout(r,50));return [];}});
window.fillQueries=()=>Promise.all(Array.from({length:70},(_,i)=>client.fetchQuery({queryKey:['reference','family-'+i],queryFn:async()=>[]})));
window.measure=(name)=>measureWorkspaceStep(name,performance.now()-75);
window.measureActive=()=>measureWorkspaceDuration('test:foreground',25,performance.now()-500);
window.bridgeSave=()=>measureWorkspaceOperation('android:snapshot-save',()=>androidOfflineRequest('save',{snapshot:{accountId:'private-account',datasets:{pupils:['private pupil']}}}));
window.exportAudit=()=>buildOperationalAuditMarkdown(window.auditWrites.map((s,i)=>({...s,id:String(i),ts:new Date()})),'2026-10-12',false);
return <window.Auth.Provider value={{user,isAuthenticated:true}}><QueryClientProvider client={client}>
<OperationalAuditProvider/><div data-workspace-visible={visible?'true':'false'}><output>{ready?'Data ready':'Loading'}</output>
<button onClick={()=>{const end=performance.now()+130;while(performance.now()<end){};}}>Slow test click</button></div>
</QueryClientProvider></window.Auth.Provider>;}
createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><Fixture/></QueryClientProvider>);`;
 const result=await esbuild.build({stdin:{contents,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',
 define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA':'"measurement-build"','process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID':'"trinity-family-schools"'},
 plugins:[{name:'boundaries',setup(build){
 build.onResolve({filter:/^(next\/navigation|@\/lib\/contexts\/auth-context|@\/lib\/services\/operational-audit.service)$/},args=>({path:args.path,namespace:'fixture'}));
 build.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',resolveDir:root,contents:args.path==='next/navigation'?'export const usePathname=()=>"/pupils";':args.path.includes('auth-context')?'import {useContext} from "react";export const useAuth=()=>useContext(window.Auth);':'export const OperationalAuditService={writeSummary:input=>window.saveAudit(input)};'}));
 }}]});
 const js=result.outputFiles[0].text;
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?js:'<!doctype html><div id="root"></div><script src="/fixture.js"></script>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'chrome',headless:true});const errors=[];
 try{
  const native=await browser.newContext({userAgent:'Mozilla/5.0 Android 15 Chrome/131.0 Safari/537.36',viewport:{width:390,height:844}});
  await native.addInitScript(()=>{
   window.TrinityOffline={postMessage(message){const parsed=JSON.parse(message);window.lastBridgeMessage=message;setTimeout(()=>window.TrinityOffline.onmessage({data:JSON.stringify({id:parsed.id,success:true})}),25);}};
   const old={startedAt:'2026-10-11T06:00:00Z',savedAt:Date.now()-900000,appVersion:'old-build',device:'phone',sessionId:'old-session',context:{runtime:'pwa',browser:'Chrome 130',os:'Android',startup:'repeat-startup'},
    events:[{kind:'performance',name:'workspace:old',severity:'info',source:'workspace-timing',route:'/pupils',count:1,firstAt:'2026-10-11T06:00:01Z',lastAt:'2026-10-11T06:00:02Z',totalMs:1000,minMs:1000,maxMs:1000}]};
   localStorage.setItem('trinity_operational_audit_pending_v1:fixture-admin:abandoned',JSON.stringify(old));
  });
  const page=await native.newPage();page.on('pageerror',error=>errors.push(error.message));
  const url='http://127.0.0.1:'+server.address().port;
  await page.goto(url);await page.waitForFunction(()=>!!window.flushAudit);
  await page.evaluate(()=>window.setReady(true));await page.waitForFunction(()=>performance.getEntriesByName('trinity:workspace:page:pupils:data-ready').length===1);
  assert.equal(await page.evaluate(()=>performance.getEntriesByName('trinity:workspace:page:pupils:first-data-visible').length),0,'Welcome overlay must exclude hidden data paint');
  await page.evaluate(()=>window.setVisible(true));await page.locator('[data-workspace-visible="true"]').waitFor();
  await page.evaluate(()=>window.dispatchEvent(new Event('trinity-workspace-visible')));
  await page.waitForFunction(()=>performance.getEntriesByName('trinity:workspace:page:pupils:first-data-visible').length===1);
  await page.evaluate(async()=>{await window.runQuery();await window.runMutation();await window.bridgeSave();});
  await page.getByRole('button',{name:'Slow test click'}).click();
  await page.waitForTimeout(180);await page.evaluate(()=>window.cloneUser());await page.waitForTimeout(80);
  await page.evaluate(()=>window.flushAudit());await page.waitForFunction(()=>window.auditWrites.length>0);
  let writes=await page.evaluate(()=>window.auditWrites),all=writes.flatMap(s=>s.events);
  assert.equal(writes[0].appVersion,'measurement-build');assert.equal(writes[0].context.runtime,'native-android');assert.equal(writes[0].context.startup,'first-setup');
  assert.ok(all.some(e=>e.name==='mutation:payments/create'));
  assert.equal(all.filter(e=>e.name==='workspace:page:pupils:data-ready').reduce((n,e)=>n+e.count,0),1,'Buffered observers must not count an entry twice after auth rerender');
  assert.ok(all.some(e=>e.name==='workspace:android:snapshot-serialize'));
  assert.ok(all.some(e=>e.name==='workspace:android:snapshot-save'));
  assert.ok(all.some(e=>e.name==='interaction-to-paint'||e.name==='click-handler-to-paint-opportunity'));
  await page.evaluate(()=>window.measureActive());await page.waitForTimeout(80);await page.evaluate(()=>window.flushAudit());
  await page.waitForFunction(()=>window.auditWrites.some(s=>s.events.some(e=>e.name==='workspace:test:foreground')));
  const active=await page.evaluate(()=>window.auditWrites.flatMap(s=>s.events).find(e=>e.name==='workspace:test:foreground'));
  assert.equal(active.maxMs,25);assert.ok(Date.parse(active.lastAt)-Date.parse(active.firstAt)>=490,'Active duration must retain the real observation window');
  assert.doesNotMatch(JSON.stringify(writes),/private-account|private pupil|first-data-visible.*private/);
  assert.equal(await page.evaluate(()=>!!localStorage.getItem('trinity_operational_audit_pending_v1:fixture-admin:abandoned')),true,'A failed recovery must retain the disk batch');
  await page.evaluate(()=>{window.failRecovery=false;window.flushAudit();});await page.waitForFunction(()=>window.auditWrites.some(s=>s.appVersion==='old-build'));
  const old=await page.evaluate(()=>window.auditWrites.find(s=>s.appVersion==='old-build'));
  assert.equal(old.context.runtime,'pwa');assert.equal(old.events[0].firstAt,'2026-10-11T06:00:01Z');assert.equal(old.sessionId,'old-session');
  assert.equal(await page.evaluate(()=>localStorage.getItem('trinity_operational_audit_pending_v1:fixture-admin:abandoned')),null);
  await page.evaluate(async()=>{await window.fillQueries();window.measure('android:snapshot-export');});await page.waitForTimeout(80);
  await page.evaluate(()=>window.flushAudit());await page.waitForTimeout(80);
  writes=await page.evaluate(()=>window.auditWrites);assert.ok(writes.every(s=>s.events.length<=40));
  assert.ok(writes.at(-1).events.some(e=>e.name==='workspace:android:snapshot-export'),'Routine queries must not displace new stage measurements');
  const markdown=await page.evaluate(()=>window.exportAudit());fs.writeFileSync(path.join(output,'sample-export.md'),markdown);
  assert.match(markdown,/Observed first \| Observed last \| Batch saved/);assert.match(markdown,/native-android/);assert.match(markdown,/old-build/);
  await native.close();
  const fallback=await browser.newContext();await fallback.addInitScript(()=>{
   localStorage.setItem('trinity:workspace-setup:v1:trinity-family-schools:fixture-admin:Admin','complete');
   const original=window.PerformanceObserver;
   window.PerformanceObserver=class{static supportedEntryTypes=original.supportedEntryTypes.filter(type=>type!=='event');constructor(cb){this.inner=new original(cb);}observe(options){this.inner.observe(options);}disconnect(){this.inner.disconnect();}};
   const match=window.matchMedia.bind(window);window.matchMedia=query=>query==='(display-mode: standalone)'?{matches:true}:match(query);
  });
  const fp=await fallback.newPage();fp.on('pageerror',error=>errors.push(error.message));await fp.goto(url);await fp.waitForFunction(()=>!!window.flushAudit);
  await fp.getByRole('button',{name:'Slow test click'}).click();await fp.waitForTimeout(180);await fp.evaluate(()=>window.flushAudit());
  await fp.waitForFunction(()=>window.auditWrites.length>0);
  const fw=await fp.evaluate(()=>window.auditWrites);assert.equal(fw[0].context.runtime,'pwa');
  assert.equal(fw[0].context.startup,'repeat-startup');
  assert.ok(fw.flatMap(s=>s.events).some(e=>e.name==='click-handler-to-paint-opportunity'));
  assert.ok(!fw.flatMap(s=>s.events).some(e=>e.name==='interaction-input-delay'));
  await fallback.close();assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({nativeContext:true,versionPreserved:true,observationTimes:true,visiblePaintGate:true,namedMutation:true,bridgeStages:true,interactionFallback:true,bufferBounded:true,errors},null,2));
  console.log('Operational measurement browser checks passed.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
