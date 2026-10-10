/* Original-shell network tests with synthetic pages; no school accounts or records. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/android-same-interface-qa');
fs.mkdirSync(output, { recursive: true });
require('esbuild').buildSync({ absWorkingDir: root, stdin: { contents: `export * from './src/lib/offline/android-app-shell';`, resolveDir: root, loader: 'ts' }, bundle: true, platform: 'browser', format: 'iife', globalName: 'Shell', alias: { '@': path.join(root, 'src') }, outfile: path.join(output, 'shell.js') });
async function buildBoundary() {
  await require('esbuild').build({ jsx:'automatic', absWorkingDir:root, stdin:{contents:`import React from 'react'; import {createRoot} from 'react-dom/client'; import {AndroidOfflineBoundary} from './src/components/common/android-offline-boundary'; const node=document.createElement('div'); document.body.append(node); const root=createRoot(node); window.renderBoundary=()=>root.render(<AndroidOfflineBoundary><div id="original-content"><input aria-label="Search pupils" defaultValue="retained search"/><button onClick={()=>window.edits++}>Edit pupil</button></div></AndroidOfflineBoundary>); window.renderBoundary();`,resolveDir:root,loader:'tsx'}, bundle:true,platform:'browser', alias:{'@':path.join(root,'src')},outfile:path.join(output,'boundary.js'),plugins:[{name:'fixture-auth',setup(build){build.onResolve({filter:/^@\/lib\/contexts\/auth-context$/},args=>({path:args.path,namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:"export function useAuth(){return {user:window.fixtureUser}}",loader:'js'}));}}]});
}
const html = route => `<!DOCTYPE html><html><head><link rel="stylesheet" href="/_next/static/style-fixture.css"></head><body><header>Original school header</header><nav><a href="/">Dashboard</a><a href="/timetable">Timetables</a><a href="/pupil-detail?id=child-1">Pupil details</a><a href="/finance">Finance</a></nav><main data-route="${route}">Original ${route} interface</main><script src="/_next/static/runtime-fixture.js"></script></body></html>`;
const session = { schema: 1, accountId: 'fixture', role: 'Admin', expiresAt: new Date(Date.now()+86400000).toISOString(), grants: { dashboard: true, pupils: true, timetable: true } };
(async () => {
 await buildBoundary();
 let requests = [], failPages = false;
 const server = http.createServer((req, res) => {
   const pathname = new URL(req.url, 'http://localhost').pathname; requests.push(pathname);
   if (pathname === '/sw.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(fs.readFileSync(path.join(root, 'public/sw.js'))); return; }
   if (pathname === '/_next/static/offline-document-assets.json') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(['/_next/static/document-fixture.js', '/_next/static/document-worker.mjs', '/api/private'])); return; }
   if (pathname === '/_next/static/document-fixture.js') { res.setHeader('Content-Type', 'application/javascript'); res.end('window.documentCodeExecuted=true;'); return; }
   if (pathname === '/_next/static/document-worker.mjs') { res.setHeader('Content-Type', 'application/javascript'); res.end('export const ready=true;'); return; }
   if (pathname === '/shell.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(fs.readFileSync(path.join(output, 'shell.js'))); return; }
   if (pathname === '/_next/static/style-fixture.css') { res.setHeader('Content-Type', 'text/css'); res.end('header{height:64px;background:#fff}body{font-family:sans-serif}'); return; }
   if (pathname === '/_next/static/runtime-fixture.js') { res.setHeader('Content-Type', 'application/javascript'); res.end('window.originalRuntime=true;'); return; }
   if (pathname === '/trinity-logo-192.png' || pathname === '/images/D.B%20background.png') { res.setHeader('Content-Type', 'image/png'); res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')); return; }
   if (failPages) { res.writeHead(503); res.end(); return; }
   res.setHeader('Content-Type', 'text/html'); res.end(html(pathname));
 });
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 const url = `http://127.0.0.1:${server.address().port}`;
 const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
 try {
   const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
   await context.addInitScript(() => { window.TrinityOffline = { postMessage() {} }; });
   let page = await context.newPage(); await page.goto(url+'/');
   await page.addScriptTag({ url: '/shell.js' });
   await page.evaluate(async () => { await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready; });
   await page.waitForFunction(async () => {
     for (const name of await caches.keys()) {
       if (!name.startsWith('static-')) continue;
       const cache = await caches.open(name);
       if (await cache.match('/_next/static/document-fixture.js') && await cache.match('/_next/static/document-worker.mjs')) return true;
     }
     return false;
   }, undefined, { timeout: 20_000 });
   assert.equal(await page.evaluate(() => window.documentCodeExecuted), undefined, 'Ordinary browser activation warms document assets without executing them');
   await page.waitForFunction(() => navigator.serviceWorker.controller);
   await page.evaluate(session => Shell.prepareAndroidAppShell(session), session);
   await page.waitForFunction(async () => {
     const names = (await caches.keys()).filter(name => name.startsWith('android-app-shell-'));
     for (const name of names) {
       const cache = await caches.open(name);
       if (await cache.match('/_next/static/document-fixture.js') && await cache.match('/_next/static/document-worker.mjs')) return true;
     }
     return false;
   });
   assert.equal(await page.evaluate(() => window.documentCodeExecuted), undefined, 'Offline preparation caches document bytes without running them');
   assert.equal(requests.includes('/api/private'), false, 'The document manifest cannot cache private API data');
   const online = await page.locator('body').innerText();
   await context.setOffline(true);
   await page.reload(); assert.equal(await page.locator('body').innerText(), online); assert.equal(await page.evaluate(() => originalRuntime), true);
   assert.equal(await page.locator('header').evaluate(el => getComputedStyle(el).height), '64px');
   await page.addScriptTag({ url: '/_next/static/document-fixture.js' });
   assert.equal(await page.evaluate(() => window.documentCodeExecuted), true, 'Documents can load for the first time after going offline');
   assert.equal(await page.evaluate(() => import('/_next/static/document-worker.mjs').then(module => module.ready)), true, 'Deferred worker modules also load offline');
   await page.close(); page = await context.newPage();
   for (const route of ['/timetable', '/pupils', '/pupil-detail?id=child-1']) {
     await page.goto(url+route); assert.equal(await page.locator('main').getAttribute('data-route'), route.split('?')[0]);
     assert.equal(await page.evaluate(() => originalRuntime), true);
   }
   assert.equal(await page.evaluate(() => new URL(location.href).searchParams.get('id')), 'child-1');
   // Install actual navigation guard from source, with network still blocked.
   await page.addScriptTag({ content: fs.readFileSync(path.join(output,'shell.js'),'utf8') });
   await page.evaluate(() => { window.blocked=0; window.removeGuard=Shell.installAndroidOfflineNavigation('Admin',()=>window.blocked++); });
   await page.getByRole('link',{ name:'Finance', exact:true }).click(); assert.equal(await page.evaluate(()=>window.blocked),1); assert.equal(new URL(page.url()).pathname,'/pupil-detail');
   await page.getByRole('link',{name:'Timetables',exact:true}).click(); await page.waitForURL('**/timetable'); assert.equal(await page.locator('main').getAttribute('data-route'),'/timetable');
   await page.addScriptTag({content:fs.readFileSync(path.join(output,'shell.js'),'utf8')});
   await page.evaluate(()=>{window.blocked=0;window.removeGuard=Shell.installAndroidOfflineNavigation('Admin',()=>window.blocked++);});
   const rsc = await page.evaluate(async()=>{try {await fetch('/finance?_rsc=fixture',{headers:{RSC:'1'}})} catch {} return window.blocked;}); assert.equal(rsc,1);
   await page.evaluate(()=>{void fetch('/pupil-detail?id=child-2&_rsc=fixture',{headers:{RSC:'1'}})}); await page.waitForURL('**/pupil-detail?id=child-2');
   // Reconnect changes availability without replacing the document.
   const documentId = await page.evaluate(()=>window.documentMarker='original-document');
   await context.setOffline(false); assert.equal(await page.evaluate(()=>window.documentMarker),documentId);
   assert.equal(new URL(page.url()).pathname,'/pupil-detail');
   failPages=true; await page.reload(); assert.equal(await page.locator('main').getAttribute('data-route'),'/pupil-detail'); failPages=false;
   // Worker replacements preserve completed shells across a cold load.
   await page.evaluate(async()=>{const names=await caches.keys();const name=names.find(name=>name.startsWith('android-app-shell-'));const old=await caches.open('android-app-shell-build-20260901000000000');for(const key of await (await caches.open(name)).keys()) await old.put(key,await (await caches.open(name)).match(key));await caches.delete(name);});
   await context.setOffline(true); await page.goto(url+'/'); assert.equal(await page.locator('body').innerText(),online);
   // Actual React boundary: access matches native lease/account/grants, with no
   // content remount or loss of local search when the connection changes.
   await context.setOffline(false); await page.goto(url+'/');
   await page.evaluate(session=>{
     window.fixtureUser={id:'fixture',role:'Admin'};window.fixtureSession=session;window.edits=0;
     window.TrinityOffline={postMessage(message){const request=JSON.parse(message);setTimeout(()=>this.onmessage?.({data:JSON.stringify({id:request.id,success:true,session:window.fixtureSession})}),0);}};
   },session);
   await page.addScriptTag({content:fs.readFileSync(path.join(output,'boundary.js'),'utf8')});
   await page.getByLabel('Search pupils').fill('keep my search');
   await page.waitForTimeout(200);
   await page.evaluate(()=>{window.trinityAndroidConnected=false;window.dispatchEvent(new Event('trinity-android-connectivity'));});
   await page.waitForTimeout(200);assert.equal(await page.getByLabel('Search pupils').inputValue(),'keep my search');
   await page.getByRole('button',{name:'Edit pupil'}).click();assert.equal(await page.evaluate(()=>window.edits),0);
   await page.evaluate(()=>{window.trinityAndroidConnected=true;window.dispatchEvent(new Event('trinity-android-connectivity'));});
   await page.getByRole('button',{name:'Edit pupil'}).click();assert.equal(await page.evaluate(()=>window.edits),1);
   assert.equal(await page.getByLabel('Search pupils').inputValue(),'keep my search');
   await page.evaluate(()=>{window.fixtureUser={id:'different-account',role:'Admin'};window.trinityAndroidConnected=false;window.renderBoundary();window.dispatchEvent(new Event('trinity-android-connectivity'));});
   await page.getByText('Connect to renew your secure session.',{exact:true}).waitFor();assert.equal(await page.locator('#original-content').count(),0);
   await page.evaluate(()=>{window.fixtureUser={id:'fixture',role:'Admin'};window.fixtureSession={...window.fixtureSession,grants:{dashboard:false,pupils:true,timetable:true}};window.renderBoundary();});
   await page.getByText('This section is available when connected.',{exact:true}).waitFor();
   assert.equal(await page.locator('#original-content').count(),0);
   const parentContext=await browser.newContext();const parentPage=await parentContext.newPage();
   await parentPage.goto(url+'/parent');
   await parentPage.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});
   await parentPage.waitForFunction(()=>navigator.serviceWorker.controller);
   await parentPage.evaluate(async()=>{await new Promise((resolve,reject)=>{const channel=new MessageChannel();channel.port1.onmessage=event=>event.data.type==='PARENT_APP_SHELL_CACHED'?resolve():reject(new Error('Parent preparation failed'));navigator.serviceWorker.controller.postMessage({type:'CACHE_PARENT_APP_SHELL',routes:['/','/parent','/parent/settings']},[channel.port2]);});});
   await parentContext.setOffline(true);await parentPage.goto(url+'/');assert.equal(await parentPage.locator('main').getAttribute('data-route'),'/');
   await parentPage.goto(url+'/parent');assert.equal(await parentPage.locator('main').getAttribute('data-route'),'/parent');await parentContext.close();
   console.log('PASS: same original HTML/styles, offline restart, all supported pages, query IDs, blocked anchors/RSC, reconnect without replacement, 503 fallback, retained shell, unchanged search state, blocked edits account/grant isolation and legacy parent launches.');
   await context.close();
 } finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1;});
