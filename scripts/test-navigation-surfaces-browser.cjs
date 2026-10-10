const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {build,output:fixture}=require('./test-dashboard-theme-browser.cjs');
const warm=require('../tests/fixtures/android-device-palette.json');
const output=path.resolve(__dirname,'../output/navigation-surfaces-qa');
const cool=JSON.parse(JSON.stringify(warm));
cool.palettes.neutral=cool.palettes.secondary;cool.palettes.neutralVariant=cool.palettes.secondary;
for(const mode of ['light','dark']){const dark=mode==='dark',t=cool.palettes.neutral;Object.assign(cool[mode],{background:t[dark?900:10],surface:t[dark?900:10],foreground:t[dark?100:900],muted:t[dark?800:100],mutedForeground:t[dark?200:700],outline:t[dark?700:200]});}
const read=loc=>loc.evaluate(el=>{const s=getComputedStyle(el);return {background:s.backgroundColor,image:s.backgroundImage,color:s.color,border:s.borderColor,width:s.borderBottomWidth,right:s.borderRightWidth,radius:s.borderRadius,rect:{x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y,right:el.getBoundingClientRect().right,height:el.getBoundingClientRect().height},blur:s.backdropFilter,filter:s.filter,shadow:s.boxShadow};});
const contrast=(a,b)=>{const lum=s=>s.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
async function run(){
 await build({navigation:true});fs.mkdirSync(output,{recursive:true});
 const server=http.createServer((req,res)=>{const f=['/fixture.js','/fixture.css'].includes(req.url)?req.url.slice(1):null;if(f){res.setHeader('Content-Type',f.endsWith('js')?'text/javascript':'text/css');res.end(fs.readFileSync(path.join(fixture,f)));}else res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="app"></div><script src="/fixture.js"></script></body></html>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:process.env.THEME_BROWSER_CHANNEL||'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(p=>{window.nativePalette=p;window.TrinityOffline={postMessage(raw){const r=JSON.parse(raw);queueMicrotask(()=>window.TrinityOffline.onmessage?.({data:JSON.stringify({id:r.id,success:true,...(r.action==='deviceColors'?{palette:window.nativePalette}:{})})}));}};},warm);
  await page.clock.setFixedTime(new Date('2026-10-09T10:00:00'));await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('.app-topbar').waitFor();
  const apply=async(preset,dark,deviceColors)=>{await page.evaluate(s=>{const v=JSON.stringify({...s,background:'plain',dimming:37});localStorage.setItem('trinity-look-and-feel',v);window.dispatchEvent(new StorageEvent('storage',{key:'trinity-look-and-feel',newValue:v}));},{preset,deviceColors});await page.waitForFunction(d=>(document.documentElement.dataset.deviceColors==='true')===d,deviceColors);if(await page.evaluate(()=>document.documentElement.classList.contains('dark'))!==dark){await (await page.locator('.app-mobile-sidebar').count()?page.locator('.app-mobile-sidebar'):page).getByRole('switch',{name:'Dark theme'}).first().click();await page.waitForFunction(d=>document.documentElement.classList.contains('dark')===d&&!document.documentElement.dataset.themeReveal,dark);}await page.waitForTimeout(350);};
  const reports=[];
  const verify=async(name,mobile=false)=>{
   const header=await read(page.locator('.app-topbar'));const nav=await read(page.locator(mobile?'.app-mobile-sidebar':'[data-sidebar="sidebar"]'));
   for(const s of [header,nav]){assert.equal(s.image,'none',name+': solid surface');assert.equal(s.blur,'none');assert.equal(s.filter,'none');assert.equal(s.shadow,'none');assert.ok(contrast(s.color,s.background)>=4.5,name+': readable surface text');}
   assert.equal(header.width,'1px',name+': fine bottom outline');
   assert.equal(nav.right,'1px',name+': single sidebar divider');
   assert.equal(header.background,nav.background,name+': shared navigation tone');
   assert.equal(nav.radius,'0px',name+': flush sidebar');
   if(!mobile){assert.equal(nav.rect.x,0);assert.equal(nav.rect.y,0);assert.equal(nav.rect.height,page.viewportSize().height);assert.equal(header.rect.y,0);assert.equal(header.rect.x,nav.rect.right,name+': bars join without a gap or overlap');}
   for(const selector of ['.app-topbar',mobile?'.app-mobile-sidebar':'[data-sidebar="sidebar"]']){
    const effects=await page.locator(selector).evaluate(el=>[el,...el.querySelectorAll('*')].flatMap(e=>[getComputedStyle(e),getComputedStyle(e,'::before'),getComputedStyle(e,'::after')]).filter(s=>s.display!=='none'&&s.content!=='none').filter(s=>s.backgroundImage.includes('gradient')||/shimmer|subtle-glow/.test(s.animationName)).map(s=>({image:s.backgroundImage,animation:s.animationName})));assert.deepEqual(effects,[],name+': navigation has no gradient/shimmer/glow layers');
   }
   assert.equal(await page.locator('.dashboard-stat-surface').evaluateAll(els=>els.some(e=>getComputedStyle(e).backdropFilter!=='none')),false);
   assert.equal(await page.locator('.dashboard-bg-wrapper').evaluate(e=>getComputedStyle(e,'::before').backdropFilter),'none');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+': fits viewport');
   const backdrop=await page.locator('.app-mobile-sidebar').evaluateAll(els=>els.length?getComputedStyle(els[0].previousElementSibling).backdropFilter:'none');assert.equal(backdrop,'none');
   reports.push({name,width:page.viewportSize().width,header,nav});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(output,name+'.png')});
  };
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});
   if(width<768){await page.getByTestId('open-mobile').click();await page.locator('.app-mobile-sidebar').waitFor();}
   for(const preset of ['trinity-classic','soft-indigo'])for(const dark of [false,true]){await apply(preset,dark,false);await verify(width+'-'+preset+'-'+(dark?'dark':'light'),width<768);}
   for(const dark of [false,true]){await apply('trinity-classic',dark,true);await verify(width+'-device-'+(dark?'dark':'light'),width<768);}
   if(width<768)await page.locator('.app-mobile-sidebar button').first().click();
  }
  for(const width of [1440,390])for(const mode of ['light','dark']){
   const classic=reports.find(r=>r.name===width+'-trinity-classic-'+mode),indigo=reports.find(r=>r.name===width+'-soft-indigo-'+mode),device=reports.find(r=>r.name===width+'-device-'+mode);
   assert.notEqual(classic.header.background,indigo.header.background,'Preset changes are visible on both bars');
   assert.notEqual(device.header.background,classic.header.background,'Material You colours reach both bars');
   if(mode==='light')for(const r of [classic,indigo,device])assert.notEqual(r.header.background,'rgb(255, 255, 255)','Light navigation has a visible theme tint');
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'Collapse Sidebar',exact:true}).click();await page.waitForTimeout(400);assert.equal(await page.locator('.app-topbar').getByRole('switch',{name:'Dark theme'}).count(),1);await verify('desktop-collapsed-device-dark');
  await page.evaluate(p=>{window.nativePalette=p;window.dispatchEvent(new Event('trinity-android-colors-change'));},cool);
  await page.waitForFunction(()=>getComputedStyle(document.documentElement).getPropertyValue('--ui-neutral-slate-950').trim()==='0 30 45');
  await page.waitForTimeout(350);
  await verify('desktop-refreshed-device-dark');
  assert.notEqual(reports.at(-1).nav.background,reports.at(-2).nav.background,'Open sidebar follows live neutral palette changes');
  await page.setViewportSize({width:360,height:800});await page.getByTestId('open-mobile').click();await verify('small-phone-device-dark',true);
  await page.locator('.app-mobile-sidebar button').first().click();
  await page.emulateMedia({media:'print'});assert.equal(await page.locator('.dashboard-bg-wrapper').evaluate(e=>getComputedStyle(e,'::before').content),'none');await page.emulateMedia({media:'screen'});
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({reports,printIsolation:true,errors},null,2));
  console.log('NAVIGATION_SURFACES_OK: actual desktop/mobile bars, tinted joined outlined surfaces, visible presets/device light-dark, collapse, mobile controls, static dimming, no gradients/glow/shimmer/blur and print isolation.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
