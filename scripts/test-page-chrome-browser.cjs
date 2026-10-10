/* Actual navigation, shared glass layers, portals and loading states; synthetic records only. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {build,output:fixture}=require('./test-dashboard-theme-browser.cjs');
const palette=require('../tests/fixtures/android-device-palette.json');
const output=path.resolve(__dirname,'../output/page-chrome-qa');
const inspect=loc=>loc.evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e),p=getComputedStyle(e,'::before'),a=getComputedStyle(e,'::after');return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,radius:s.borderRadius,margin:s.marginBottom,background:s.backgroundColor,blur:s.backdropFilter,shadow:s.boxShadow,position:s.position,surface:{content:p.content,background:p.backgroundColor,blur:p.backdropFilter,mask:p.maskImage,bottom:p.bottom,pointer:p.pointerEvents},after:a.content};});
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
   const mobile=page.viewportSize().width<768;
   for(const layer of [header,summary]){assert.equal(layer.x,main.x,name+': matching left edge');assert.equal(layer.right,main.right,name+': matching right edge');assert.equal(layer.radius,mobile?'20px 20px 0px 0px':'20px 0px 0px',name+': carved frame curves');assert.equal(layer.blur,'none',name+': no second blur plane');assert.ok(layer.surface.blur.startsWith('blur('),name+': glass retained');assert.notEqual(layer.shadow,'none',name+': depth shadow');assert.equal(layer.surface.mask.split('radial-gradient').length-1,mobile?2:1,name+': both mobile carves');assert.equal(layer.surface.bottom,'-20px',name+': glass body continues through corners');assert.equal(layer.surface.pointer,'none');assert.equal(layer.after,'none',name+': no detached corner patch');assert.ok(/rgba\(.+, 0\./.test(layer.surface.background),name+': translucent surface');}
   if(!name.includes('skeleton'))assert.notEqual(header.surface.background,summary.surface.background,name+': distinct layer tones');assert.notEqual(main.background,header.surface.background,name+': glass and navigation remain distinct');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+': no horizontal overflow');
   reports.push({name,width:page.viewportSize().width,main,header,summary});await page.screenshot({path:path.join(output,name+'.png')});
  };
  for(const width of [1440,768,640,390,360]){
   await page.setViewportSize({width,height:1000});await reset('wrapped');
   for(const preset of ['trinity-classic','soft-indigo'])for(const dark of [false,true]){await apply(preset,dark,false);await verify(width+'-'+preset+'-'+(dark?'dark':'light'));}
   for(const dark of [false,true]){await apply('trinity-classic',dark,true);await verify(width+'-device-'+(dark?'dark':'light'));}
   await reset('direct');await verify(width+'-direct');await reset('skeleton');await verify(width+'-skeleton');
   if(width<768)for(const variant of ['wrapped','direct','skeleton']){
    await reset(variant);await page.evaluate(()=>window.scrollTo(0,450));await page.waitForTimeout(250);
    const main=await inspect(page.locator('.app-topbar')),header=await inspect(page.locator('.glass-page-topbar'));
    assert.equal(main.y,0,'Mobile navigation remains pinned');assert.equal(header.position,'sticky');assert.equal(header.y,main.bottom,width+' '+variant+': entire page header remains pinned');
    if(variant!=='skeleton'){assert.ok(await page.getByRole('link',{name:'Back',exact:true}).isVisible());assert.equal(await page.locator('.glass-page-topbar').getByText('KIRABO DAVID').count(),1);}
    await page.screenshot({path:path.join(output,width+'-'+variant+'-scrolled.png')});
   }
  }
  await page.setViewportSize({width:1440,height:1000});await reset('wrapped');
  await page.getByRole('button',{name:'Collapse Sidebar',exact:true}).click();await page.waitForTimeout(350);await verify('collapsed');
  await page.getByRole('button',{name:'Track',exact:true}).click();await page.getByRole('menuitem',{name:'View tracking'}).click();assert.equal(await page.evaluate(()=>window.layerAction),'Tracking');
  await page.getByRole('button',{name:'Pay',exact:true}).click();assert.equal(await page.evaluate(()=>window.layerAction),'Pay');
  await page.getByTestId('workspace-scroller').evaluate(e=>e.scrollTop=350);await page.waitForTimeout(200);
  const main=await inspect(page.locator('.app-topbar')),sticky=await inspect(page.locator('.glass-page-topbar'));assert.equal(sticky.position,'sticky');assert.equal(sticky.y,main.bottom,'Scrolled page header stays below navigation');
  await reset('standalone');assert.equal(await page.locator('.glass-summary-bar').count(),0);assert.equal((await inspect(page.locator('.glass-page-topbar'))).margin,'6px','Standalone custom spacing remains available');
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'no-preference'});await reset('skeleton');await reset('wrapped');
  await page.evaluate(()=>window.scrollTo(0,450));await page.waitForTimeout(300);assert.equal((await inspect(page.locator('.glass-page-topbar'))).y,(await inspect(page.locator('.app-topbar'))).bottom,'Normal entry motion settles at the pinned mobile position');
  await page.getByRole('button',{name:'Track',exact:true}).click();await page.getByRole('menuitem',{name:'View tracking'}).click();assert.equal(await page.evaluate(()=>window.layerAction),'Tracking','Mobile dock and portalled menu remain usable while scrolling');
  // Magnified pixel checks at the actual shared surface's body/corner join.
  await page.evaluate(()=>{const host=document.createElement('div');host.id='corner-probe';host.style.cssText='position:fixed;inset:200px 0 auto;height:100px;background:rgb(80,120,160);z-index:100;';host.innerHTML='<div class="glass-summary-bar" style="margin:0;padding:0;height:60px"></div>';document.body.appendChild(host);});
  await page.waitForTimeout(100);const pixels=await page.screenshot({clip:{x:0,y:240,width:390,height:40}});fs.writeFileSync(path.join(output,'mobile-glass-join.png'),pixels);
  const joins=await page.evaluate(async data=>{const img=new Image();img.src=data;await img.decode();const c=document.createElement('canvas');c.width=390;c.height=40;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return [1,388].map(x=>[19,20].map(y=>Array.from(ctx.getImageData(x,y,1,1).data).slice(0,3)));},'data:image/png;base64,'+pixels.toString('base64'));
  for(const [above,below] of joins)assert.ok(above.every((v,i)=>Math.abs(v-below[i])<=3),'Glass stays continuous at the left and right corner joins');await page.evaluate(()=>document.getElementById('corner-probe').remove());
  await reset('wrapped');await page.emulateMedia({media:'print'});for(const selector of ['.app-topbar','.glass-page-topbar','.glass-summary-bar']){const layer=await inspect(page.locator(selector));assert.equal(layer.surface.content,'none','Carved screen surfaces do not reach print');assert.equal(layer.after,'none','Carved screen corners do not reach print');}assert.equal((await inspect(page.locator('.glass-page-topbar'))).position,'relative','Mobile pinning stays out of printed output');
  await page.emulateMedia({media:'screen'});assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({reports,sticky:true,actions:true,printIsolation:true,errors},null,2));
  console.log('PAGE_CHROME_OK: joined glass layers, continuous corner pixels, both mobile carves, presets/device light-dark, direct/Tabs hosts, skeletons, 360/390/640px scrolling, collapsed rail, normal entry motion, mobile actions/portal and print isolation.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
