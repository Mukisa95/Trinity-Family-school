/* Actual settings/provider/CSS with a public Android palette and a local native bridge fixture. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {build}=require('./test-look-and-feel-browser.cjs');
const root=path.resolve(__dirname,'..'),output=path.join(root,'output/device-colors-browser');
const palette=require('../tests/fixtures/android-device-palette.json');
const moduleValue={exports:{}};
new Function('module','exports',require('typescript').transpileModule(fs.readFileSync(path.join(root,'src/lib/theme/device-colors.ts'),'utf8'),{compilerOptions:{module:1}}).outputText)(moduleValue,moduleValue.exports);
const bootstrap=moduleValue.exports.DEVICE_COLORS_BOOTSTRAP;
function bridgeScript(colors){return `window.nativePalette=${JSON.stringify(colors)};window.nativeRequests=[];window.TrinityOffline={postMessage(raw){const request=JSON.parse(raw);nativeRequests.push(request);queueMicrotask(()=>TrinityOffline.onmessage?.({data:JSON.stringify({id:request.id,success:true,...(request.action==='deviceColors'?{palette:nativePalette}:{})})}));}};`;}
const lum=c=>c.map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=lum(a.match(/[\d.]+/g).slice(0,3).map(Number)),y=lum(b.match(/[\d.]+/g).slice(0,3).map(Number));return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
const reading=locator=>locator.evaluate(el=>({color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor}));
async function run(){
 await build();fs.mkdirSync(output,{recursive:true});
 const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><script>'+bootstrap+'</script></head><body><div id="app"></div><script src="/fixture.js"></script></body></html>';
 // Saved fixture also supports a human visual review in the in-app browser.
 fs.writeFileSync(path.join(output,'preview.html'),html.replace('<script>'+bootstrap, '<script>'+bridgeScript(palette)+'localStorage.setItem("trinity-appearance","dark");localStorage.setItem("trinity-look-and-feel",JSON.stringify({deviceColors:true,background:"plain"}));'+bootstrap));
 const server=http.createServer((req,res)=>{
  const uri=req.url.split('?')[0];
  if(['/fixture.js','/fixture.css'].includes(uri)){res.setHeader('Content-Type',uri.endsWith('js')?'text/javascript':'text/css');res.end(fs.readFileSync(path.join(root,'output/look-and-feel-qa',uri.slice(1))));}
  else{res.setHeader('Content-Type','text/html');res.end(html);}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:process.env.THEME_BROWSER_CHANNEL||'msedge'});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:'light',reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(bridgeScript(palette));
  const idle=()=>page.waitForFunction(()=>window.appearance?.ready&&!window.appearance.changing);
  await page.goto(`http://127.0.0.1:${server.address().port}`);await idle();
  const toggle=page.getByRole('switch',{name:'Use device colours'});await toggle.waitFor({state:'visible'});await page.waitForFunction(()=>window.appearance.deviceColorsSupported);
  const paper=await reading(page.getByTestId('paper-button')),semantic=await reading(page.getByTestId('male-row').locator('span'));
  const baseline=await reading(page.getByRole('button',{name:'Primary button',exact:true}));
  await toggle.click();await page.waitForFunction(()=>document.documentElement.dataset.deviceColors==='true');
  await page.waitForFunction(()=>window.nativeRequests.some(r=>r.action==='appearance'&&r.deviceColors===true));
  for(const mode of ['Light','Dark']){
   await page.getByRole('button',{name:mode,exact:true}).click();await idle();
   const primary=await reading(page.getByRole('button',{name:'Primary button',exact:true}));assert.ok(contrast(primary.color,primary.background)>=4.5,mode+' primary contrast');
   assert.deepEqual(await reading(page.getByTestId('paper-button')),paper,'Paper controls retain their palette');
   for(const family of ['brand','brand-alt','brand-secondary','brand-secondary-alt']){
    const probe=page.locator('[data-family="'+family+'"]');await probe.hover();const colors=await reading(probe);assert.ok(contrast(colors.color,colors.background)>=4.5,mode+' '+family+' contrast');
   }
   await page.screenshot({path:path.join(output,mode.toLowerCase()+'.png'),fullPage:true});
   if(mode==='Dark'){await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(output,'device-colors-setting.png')});}
  }
  await page.getByRole('button',{name:'Light',exact:true}).click();await idle();assert.deepEqual(await reading(page.getByTestId('male-row').locator('span')),semantic,'Gender colours stay unchanged');
  // A fresh native palette refreshes the open page without reloading or clearing form state.
  await page.evaluate(()=>{window.pageToken=crypto.randomUUID();const input=document.createElement('input');input.id='qa-input';input.value='Preserve this';document.body.appendChild(input);nativePalette.palettes.primary=nativePalette.palettes.secondary;nativePalette.light.primary=nativePalette.light.secondary;nativePalette.dark.primary=nativePalette.dark.secondary;window.dispatchEvent(new Event('trinity-android-colors-change'));});
  const token=await page.evaluate(()=>window.pageToken);await page.waitForFunction(()=>getComputedStyle(document.documentElement).getPropertyValue('--link').trim()==='65 98 119');assert.equal(await page.evaluate(()=>window.pageToken),token);assert.equal(await page.locator('#qa-input').inputValue(),'Preserve this');
  await page.reload();await idle();assert.equal(await toggle.getAttribute('aria-checked'),'true');assert.equal(await page.evaluate(()=>document.documentElement.dataset.deviceColors),'true');
  await page.emulateMedia({media:'print'});assert.deepEqual(await reading(page.getByRole('button',{name:'Primary button',exact:true})),paper,'Print resets screen colours');await page.emulateMedia({media:'screen'});
  await page.getByRole('button',{name:/^Trinity Classic/}).click();await idle();assert.equal(await toggle.getAttribute('aria-checked'),'false');assert.deepEqual(await reading(page.getByRole('button',{name:'Primary button',exact:true})),baseline);
  await page.evaluate(()=>{nativePalette={supported:false};window.dispatchEvent(new Event('trinity-android-colors-change'));});await page.waitForFunction(()=>!window.appearance.deviceColorsSupported);assert.equal(await toggle.isDisabled(),true);
  // Cached colours apply before the UI bundle, including an offline start.
  const cached=await context.newPage();await cached.addInitScript(bridgeScript(palette)+'localStorage.setItem("trinity-look-and-feel",JSON.stringify({deviceColors:true}));localStorage.setItem("trinity-device-colors",JSON.stringify(nativePalette));');
  await cached.route('**/fixture.js',route=>route.abort());await cached.goto(`http://127.0.0.1:${server.address().port}`);assert.equal(await cached.evaluate(()=>document.documentElement.dataset.deviceColors),'true');assert.ok(await cached.locator('#trinity-device-colors').count());
  const web=await browser.newPage();await web.goto(`http://127.0.0.1:${server.address().port}`);await web.waitForFunction(()=>window.appearance?.ready);assert.equal(await web.getByRole('switch',{name:'Use device colours'}).count(),0,'PWA has no unavailable native switch');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  console.log('DEVICE_COLORS_BROWSER_OK: real settings/provider, native preference bridge, paired contrast, live palette refresh without input loss, reload/offline bootstrap, unsupported fallback, PWA isolation, unchanged paper/status/print.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
