/* Actual top bar, network indicator and portalled popover; synthetic session states. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {build,output:fixture}=require('./test-dashboard-theme-browser.cjs');
const palette=require('../tests/fixtures/android-device-palette.json');
const output=path.resolve(__dirname,'../output/network-session-qa');
async function run(){
 const layout=fs.readFileSync(path.resolve(__dirname,'../src/components/layout/app-layout.tsx'),'utf8');
 assert.ok(!layout.includes('SessionVerificationBanner'),'Delayed verification never inserts a page banner');
 assert.equal((layout.match(/<SessionStaleBanner /g)||[]).length,3,'Permission refresh banners remain on all three layout branches');
 await build({navigation:true,networkDetails:true});fs.mkdirSync(output,{recursive:true});
 const server=http.createServer((req,res)=>{const name=req.url.slice(1);if(['fixture.js','fixture.css'].includes(name)){res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8');res.end(fs.readFileSync(path.join(fixture,name)));}else res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="app"></div><script src="/fixture.js"></script>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:process.env.THEME_BROWSER_CHANNEL||'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[],reports=[];let requests=0;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://www.gstatic.com/generate_204',async route=>{requests++;await route.fulfill({status:204});});
  await page.addInitScript(p=>{window.fixtureOnline=true;Object.defineProperty(navigator,'onLine',{get:()=>window.fixtureOnline});window.fixturePingTimers=[];const interval=window.setInterval;window.setInterval=(fn,delay,...args)=>{const id=interval(fn,delay,...args);if(delay===10000)window.fixturePingTimers.push(id);return id;};window.TrinityOffline={postMessage(raw){const r=JSON.parse(raw);queueMicrotask(()=>window.TrinityOffline.onmessage?.({data:JSON.stringify({id:r.id,success:true,...(r.action==='deviceColors'?{palette:p}:{})})}));}};},palette);
  await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('.app-topbar').waitFor();await page.getByRole('button',{name:'Collapse Sidebar',exact:true}).click();
  // Keep the initial measurement, but pause scheduled pings during click checks.
  // Otherwise an unrelated ten-second timer can be mistaken for a click request.
  await page.evaluate(()=>window.fixturePingTimers.forEach(window.clearInterval));
  const button=page.locator('.app-topbar').getByRole('button',{name:/^Network:/});
  const dialog=page.getByRole('dialog',{name:'Connection details'});
  const delayed=page.getByRole('heading',{name:'Live session check delayed',exact:true});
  const setDelayed=async value=>{await page.evaluate(v=>window.dispatchEvent(new CustomEvent('fixture-session-change',{detail:{isSessionVerificationDelayed:v,sessionMessage:v?'The live session check is waiting for a stable connection. Your current session remains available.':null}})),value);await page.waitForTimeout(50);};
  const apply=async(preset,dark,deviceColors)=>{await page.evaluate(s=>{const v=JSON.stringify({...s,background:'plain',dimming:37});localStorage.setItem('trinity-look-and-feel',v);window.dispatchEvent(new StorageEvent('storage',{key:'trinity-look-and-feel',newValue:v}));},{preset,deviceColors});await page.waitForFunction(d=>(document.documentElement.dataset.deviceColors==='true')===d,deviceColors);if(await page.evaluate(()=>document.documentElement.classList.contains('dark'))!==dark){await page.locator('.app-topbar').getByRole('switch',{name:'Dark theme'}).click();await page.waitForFunction(d=>document.documentElement.classList.contains('dark')===d&&!document.documentElement.dataset.themeReveal,dark);}await page.waitForTimeout(250);};
  const verify=async name=>{
   await setDelayed(true);assert.equal(await dialog.count(),0);assert.equal(await delayed.count(),0,'Message stays out of the page until clicked');
   await button.hover();await page.waitForTimeout(100);assert.equal(await delayed.count(),0,'Hover does not reveal the session message');
   const baseline=requests;await button.click();await dialog.waitFor();assert.ok(await delayed.isVisible());assert.ok(await dialog.getByText('This check does not read Firestore and will retry after the connection recovers.',{exact:true}).isVisible());
   const details=await dialog.evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {x:r.x,right:r.right,y:r.y,bottom:r.bottom,background:s.backgroundColor,color:s.color,insideHeader:!!e.closest('.app-topbar')};});
   assert.equal(details.insideHeader,false,'Popup is not clipped by the top bar');assert.ok(details.x>=0&&details.right<=page.viewportSize().width,'Phone popup fits viewport');assert.ok(details.bottom<=page.viewportSize().height);
   assert.equal(requests,baseline,'Opening details does not trigger a session or network check');await page.screenshot({path:path.join(output,name+'.png')});
   await setDelayed(false);assert.equal(await delayed.count(),0,'Recovery clears the message while the popup is open');assert.ok(await dialog.isVisible());
   await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await button.getAttribute('aria-expanded'),'false');assert.ok(await button.evaluate(e=>e===document.activeElement),'Escape returns focus to the network button');
   await setDelayed(true);await button.press('Enter');await dialog.waitFor();assert.ok(await delayed.isVisible(),'Keyboard opens the details');await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
   reports.push({name,width:page.viewportSize().width,details});
  };
  for(const width of [1440,390]){await page.setViewportSize({width,height:900});for(const preset of ['trinity-classic','soft-indigo'])for(const dark of [false,true]){await apply(preset,dark,false);await verify(width+'-'+preset+'-'+(dark?'dark':'light'));}}
  await page.setViewportSize({width:360,height:800});await apply('trinity-classic',true,true);await verify('360-device-dark');
  await page.evaluate(()=>{window.fixtureOnline=false;window.dispatchEvent(new Event('offline'));});await button.click();await dialog.waitFor();assert.ok(await dialog.getByText('No internet connection',{exact:true}).isVisible());assert.ok(await delayed.isVisible());
  await page.emulateMedia({media:'print'});assert.equal(await page.locator('[role="dialog"]').evaluate(e=>getComputedStyle(e).display),'none','Connection details do not print');await page.emulateMedia({media:'screen'});
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});await setDelayed(false);await page.evaluate(()=>{window.fixtureOnline=true;window.dispatchEvent(new Event('online'));});await button.click();await dialog.waitFor();assert.equal(await delayed.count(),0);assert.ok(await dialog.getByText(/connection$/).isVisible());
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({reports,offline:true,printIsolation:true,noClickRequests:true,errors},null,2));
  console.log('NETWORK_SESSION_OK: actual top-bar click/tap/keyboard popup, message hidden by default and hover, live recovery, offline, theme/device colours, phone fit, focus restoration, no click requests, preserved auth warnings and print isolation.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
