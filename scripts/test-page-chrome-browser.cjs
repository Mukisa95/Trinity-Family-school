/* Actual navigation, shared glass layers, portals and loading states; synthetic records only. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {build,output:fixture}=require('./test-dashboard-theme-browser.cjs');
const palette=require('../tests/fixtures/android-device-palette.json');
const output=path.resolve(__dirname,'../output/page-chrome-qa');
const inspect=loc=>loc.evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e),p=getComputedStyle(e,'::after');return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,radius:s.borderRadius,margin:s.marginBottom,background:s.backgroundColor,blur:s.backdropFilter,shadow:s.boxShadow,position:s.position,corner:{content:p.content,clip:p.clipPath,pointer:p.pointerEvents}};});
async function run(){
 await build({navigation:true,pageLayers:true});fs.mkdirSync(output,{recursive:true});
 const server=http.createServer((req,res)=>{const f=['/fixture.js','/fixture.css'].includes(req.url)?req.url.slice(1):null;if(f){res.setHeader('Content-Type',f.endsWith('js')?'text/javascript':'text/css');res.end(fs.readFileSync(path.join(fixture,f)));}else res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="app"></div><script src="/fixture.js"></script></body></html>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:process.env.THEME_BROWSER_CHANNEL||'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],reports=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(p=>{window.TrinityOffline={postMessage(raw){const r=JSON.parse(raw);queueMicrotask(()=>window.TrinityOffline.onmessage?.({data:JSON.stringify({id:r.id,success:true,...(r.action==='deviceColors'?{palette:p}:{})})}));}};},palette);
  await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('.glass-page-topbar').waitFor();
  const reset=async variant=>{await page.evaluate(v=>{window.setLayerVariant(v);document.querySelector('[data-testid="workspace-scroller"]').scrollTop=0;window.scrollTo(0,0);},variant);await page.waitForTimeout(300);};
  const apply=async(preset,dark,deviceColors)=>{await page.evaluate(s=>{const v=JSON.stringify({...s,background:'plain',dimming:37});localStorage.setItem('trinity-look-and-feel',v);window.dispatchEvent(new StorageEvent('storage',{key:'trinity-look-and-feel',newValue:v}));},{preset,deviceColors});await page.waitForFunction(d=>(document.documentElement.dataset.deviceColors==='true')===d,deviceColors);if(await page.evaluate(()=>document.documentElement.classList.contains('dark'))!==dark){await page.getByRole('switch',{name:'Dark theme'}).first().click();await page.waitForFunction(d=>document.documentElement.classList.contains('dark')===d,dark);}await page.waitForTimeout(350);};
  const verify=async name=>{
   const main=await inspect(page.locator('.app-topbar')),header=await inspect(page.locator('.glass-page-topbar')),summary=await inspect(page.locator('.glass-summary-bar'));
   assert.equal(main.bottom,header.y,name+': main and page header meet');assert.equal(header.bottom,summary.y,name+': glass layers meet');
   for(const layer of [header,summary]){assert.equal(layer.x,main.x,name+': matching left edge');assert.equal(layer.right,main.right,name+': matching right edge');assert.equal(layer.radius,'20px 0px 0px',name+': carved frame curves');assert.ok(layer.blur.startsWith('blur('),name+': glass retained');assert.notEqual(layer.shadow,'none',name+': depth shadow');assert.ok(layer.corner.clip.startsWith('path('));assert.equal(layer.corner.pointer,'none');assert.ok(/rgba\(.+, 0\./.test(layer.background),name+': translucent surface');}
   if(!name.includes('skeleton'))assert.notEqual(header.background,summary.background,name+': distinct layer tones');assert.notEqual(main.background,header.background,name+': glass and navigation remain distinct');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+': no horizontal overflow');
   reports.push({name,width:page.viewportSize().width,main,header,summary});await page.screenshot({path:path.join(output,name+'.png')});
  };
  for(const width of [1440,768,640,390]){
   await page.setViewportSize({width,height:1000});await reset('wrapped');
   for(const preset of ['trinity-classic','soft-indigo'])for(const dark of [false,true]){await apply(preset,dark,false);await verify(width+'-'+preset+'-'+(dark?'dark':'light'));}
   for(const dark of [false,true]){await apply('trinity-classic',dark,true);await verify(width+'-device-'+(dark?'dark':'light'));}
   await reset('direct');await verify(width+'-direct');await reset('skeleton');await verify(width+'-skeleton');
  }
  await page.setViewportSize({width:1440,height:1000});await reset('wrapped');
  await page.getByRole('button',{name:'Collapse Sidebar',exact:true}).click();await page.waitForTimeout(350);await verify('collapsed');
  await page.getByRole('button',{name:'Track',exact:true}).click();await page.getByRole('menuitem',{name:'View tracking'}).click();assert.equal(await page.evaluate(()=>window.layerAction),'Tracking');
  await page.getByRole('button',{name:'Pay',exact:true}).click();assert.equal(await page.evaluate(()=>window.layerAction),'Pay');
  await page.getByTestId('workspace-scroller').evaluate(e=>e.scrollTop=350);await page.waitForTimeout(200);
  const main=await inspect(page.locator('.app-topbar')),sticky=await inspect(page.locator('.glass-page-topbar'));assert.equal(sticky.position,'sticky');assert.equal(sticky.y,main.bottom,'Scrolled page header stays below navigation');
  await reset('standalone');assert.equal(await page.locator('.glass-summary-bar').count(),0);assert.equal((await inspect(page.locator('.glass-page-topbar'))).margin,'6px','Standalone custom spacing remains available');
  await reset('wrapped');await page.emulateMedia({media:'print'});for(const selector of ['.app-topbar','.glass-page-topbar','.glass-summary-bar'])assert.equal((await inspect(page.locator(selector))).corner.content,'none','Carved screen corners do not reach print');
  await page.emulateMedia({media:'screen'});assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({reports,sticky:true,actions:true,printIsolation:true,errors},null,2));
  console.log('PAGE_CHROME_OK: actual joined navigation/page/summary layers, glass and depth, presets/device light-dark, direct/Tabs hosts, skeletons, 640px gutters, collapsed rail, sticky header, actions/portal and print isolation.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
