/* Actual settings, theme provider, UI primitives and CSS. Synthetic data only. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const ts=require('typescript'),esbuild=require('esbuild');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'output/look-and-feel-qa');
const contents=`import React,{useEffect} from 'react';import {createRoot} from 'react-dom/client';
import {ThemeProvider,useAppearance} from './src/components/providers/theme-provider';
import {LookAndFeelSettings} from './src/components/settings/look-and-feel-settings';
import {Button} from './src/components/ui/button';import {getPupilRowTheme} from './src/components/pupils/pupil-row-theme';
function Probe(){const appearance=useAppearance();useEffect(()=>{window.appearance=appearance},[appearance]);return <><LookAndFeelSettings/><div data-testid="role-probes" className="grid gap-3 p-6 bg-card">{['brand','brand-alt','brand-secondary','brand-secondary-alt'].map(family=><button key={family} data-family={family} className={'rounded p-3 text-'+family+'-ink-700 bg-'+family+'-surface-50 hover:bg-'+family+'-surface-100'}>Example link</button>)}<button data-testid="male-row" className={getPupilRowTheme('Male').row}><span className={getPupilRowTheme('Male').name}>Example pupil</span></button><div data-theme-surface="paper" className="p-4 bg-white"><Button data-testid="paper-button">Print example</Button></div></div></>}
createRoot(document.getElementById('app')).render(<ThemeProvider><div className="dashboard-bg-wrapper"><main className="relative min-h-screen p-3 bg-background/80 text-foreground"><Probe/></main></div></ThemeProvider>);`;
async function build(){
 fs.mkdirSync(output,{recursive:true});
 const mocks={'next/link':`import React from 'react';export default React.forwardRef(({children,...props},ref)=><a {...props} ref={ref}>{children}</a>);`,'@/components/common/SmartBackButton':`import React from 'react';export const SmartBackButton=({children,fallbackHref,label,...props})=><button {...props}>{children}</button>;`};
 await esbuild.build({absWorkingDir:root,stdin:{contents,resolveDir:root,loader:'tsx'},bundle:true,jsx:'automatic',platform:'browser',alias:{'@':path.join(root,'src')},define:{'process.env.NODE_ENV':'"production"'},outfile:path.join(output,'fixture.js'),plugins:[{name:'isolated-navigation',setup(b){b.onResolve({filter:/.*/},a=>Object.hasOwn(mocks,a.path)?{path:a.path,namespace:'mock'}:undefined);b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:root}));}}]});
 const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.join(root,'tailwind.config.ts'),'utf8'),{compilerOptions:{module:1}}).outputText)(require,mod,mod.exports);
 const roles=Object.keys({brand:1,'brand-alt':1,'brand-secondary':1,'brand-secondary-alt':1}).flatMap(f=>[50,100,200,300,400,500,600,700,800,900,950].flatMap(s=>['text-'+f+'-ink-'+s,'bg-'+f+'-surface-'+s,'hover:bg-'+f+'-surface-'+s])).join(' ');
 const css=['globals.css','theme.css','brand-theme.css'].map(name=>fs.readFileSync(path.join(root,'src/app',name),'utf8')).join('\n').replace(/^@import[^;]+;/,'');
 const result=await require('postcss')([require('tailwindcss')({...mod.exports.default,content:[path.join(root,'src/**/*.{ts,tsx}'),{raw:contents+' '+roles,extension:'tsx'}]})]).process(css,{from:path.join(root,'src/app/globals.css')});fs.writeFileSync(path.join(output,'fixture.css'),result.css);
}
const rgb=value=>value.match(/[\d.]+/g).slice(0,3).map(Number);
function contrast(a,b){const lum=c=>c.map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
async function reading(locator){return locator.evaluate(el=>{const c=getComputedStyle(el);let parent=el,background=c.backgroundColor;while(background==='rgba(0, 0, 0, 0)'&&parent.parentElement){parent=parent.parentElement;background=getComputedStyle(parent).backgroundColor;}return {color:c.color,background};});}
async function run(){
 await build();const server=http.createServer((req,res)=>{
  const uri=decodeURIComponent(req.url.split('?')[0]);
  if(['/fixture.js','/fixture.css'].includes(uri)){res.setHeader('Content-Type',uri.endsWith('js')?'text/javascript':'text/css');res.end(fs.readFileSync(path.join(output,uri.slice(1))));}
  else if(uri.startsWith('/images/')){const asset=path.resolve(root,'public','.'+uri);if(asset.startsWith(path.join(root,'public')+path.sep)&&fs.existsSync(asset)){res.setHeader('Content-Type','image/png');res.end(fs.readFileSync(asset));}else{res.statusCode=404;res.end();}}
  else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="app"></div><script src="/fixture.js"></script></body></html>');}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:process.env.THEME_BROWSER_CHANNEL||'msedge'});
 try{
  const context=await browser.newContext({viewport:{width:1366,height:900},colorScheme:'dark'}),page=await context.newPage(),url=`http://127.0.0.1:${server.address().port}`;
  const errors=[];page.on('pageerror',e=>errors.push(e.message));const reports=[];
  await page.addInitScript(()=>{window.nativeAppearanceRequests=[];window.TrinityOffline={postMessage(raw){const request=JSON.parse(raw);window.nativeAppearanceRequests.push(request);queueMicrotask(()=>window.TrinityOffline.onmessage?.({data:JSON.stringify({id:request.id,success:true})}));}};});
  const idle=()=>page.waitForFunction(()=>window.appearance?.ready&&!window.appearance.changing&&!document.documentElement.dataset.themeReveal);
  const click=async(name)=>{const button=page.getByRole('button',{name,exact:true});await button.click();await idle();};
  await page.goto(url);await idle();assert.equal(await page.getByRole('button',{name:'Follow device',exact:true}).getAttribute('aria-pressed'),'true');assert.ok(await page.evaluate(()=>document.documentElement.classList.contains('dark')));
  await page.waitForFunction(()=>window.nativeAppearanceRequests.some(r=>r.action==='appearance'&&r.preference==='system'&&r.dark===true));
  const paper=await reading(page.getByTestId('paper-button'));
  for(const preset of ['Trinity Classic','Soft Indigo']){
   await page.getByRole('button',{name:new RegExp('^'+preset)}).click();await idle();
   for(const mode of ['Dark','Light']){
    await click(mode);const primary=await reading(page.getByRole('button',{name:'Primary button',exact:true})),link=await reading(page.getByRole('button',{name:'Example link',exact:true}).first());
    assert.ok(contrast(rgb(primary.color),rgb(primary.background))>=4.5,'Filled button contrast');assert.ok(contrast(rgb(link.color),rgb(link.background))>=4.5,'Link contrast');
    for(const family of ['brand','brand-alt','brand-secondary','brand-secondary-alt']){
     const probe=page.locator('[data-family="'+family+'"]');await probe.hover();const c=await reading(probe);assert.ok(contrast(rgb(c.color),rgb(c.background))>=4.5,`${preset} ${mode} ${family} hover contrast`);
     if(mode==='Dark')assert.ok(Math.max(...rgb(c.background))<100,'Pale hover surfaces must become dark');
    }
    assert.deepEqual(await reading(page.getByTestId('paper-button')),paper,'Paper controls retain Classic/light roles');
    await page.mouse.move(0,0);
    const families=await page.locator('[data-family]').evaluateAll(elements=>elements.map(el=>({family:el.dataset.family,color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor})));
    reports.push({preset,mode,primary,link,families});await page.screenshot({path:path.join(output,preset.toLowerCase().replaceAll(' ','-')+'-'+mode.toLowerCase()+'.png'),fullPage:true});
    console.log('PRESET_CONTRAST_OK '+preset+' '+mode+'; all four accent families.');
   }
  }
  for(const mode of ['Dark','Light']){
   const classic=reports.find(r=>r.preset==='Trinity Classic'&&r.mode===mode),soft=reports.find(r=>r.preset==='Soft Indigo'&&r.mode===mode);
   for(let i=0;i<classic.families.length;i++)assert.notDeepEqual(classic.families[i],soft.families[i],mode+' '+classic.families[i].family+' must respond to preset');
  }
  if(process.argv.includes('--contrast-only')){
   assert.deepEqual(errors,[]);
   fs.writeFileSync(path.join(output,'accent-verification.json'),JSON.stringify({reports,allAccentFamiliesChange:true,paperPaletteUnchanged:true,browserErrors:errors},null,2));
   console.log('THEME_ACCENT_BROWSER_OK: both presets in light/dark, all four accent families change, readable links/buttons/hover colours and unchanged paper colours.');
   return;
  }
  // Begin the persistence/background checks on a fresh page after the full-page snapshots.
  await page.reload();await idle();
  await click('Dark');await page.getByRole('button',{name:/^Soft Indigo/}).click();await idle();
  await click('Plain');assert.equal(await page.locator('.dashboard-bg-wrapper').evaluate(el=>getComputedStyle(el,'::after').backgroundImage),'none');
  assert.ok(await page.getByLabel('Night illustration brightness').isDisabled());await click('School illustration');
  await page.getByLabel('Night illustration brightness').evaluate(el=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'45');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--night-dim-top').trim()),'0.5');
  await page.reload();await idle();assert.equal(await page.getByLabel('Night illustration brightness').inputValue(),'45');assert.equal(await page.getByRole('button',{name:/^Soft Indigo/}).getAttribute('aria-pressed'),'true');assert.equal(await page.getByRole('button',{name:'Dark',exact:true}).getAttribute('aria-pressed'),'true');
  const other=await context.newPage();await other.goto(url);await other.waitForFunction(()=>window.appearance?.ready);
  // Restore the page being clicked; background tabs throttle animation frames.
  await page.bringToFront();
  await click('Plain');await other.waitForFunction(()=>document.documentElement.dataset.appBackground==='plain');
  await page.evaluate(()=>localStorage.setItem('trinity-look-and-feel',JSON.stringify({preset:'invented',background:'bad',dimming:900})));
  await page.reload();await idle();assert.equal(await page.getByLabel('Night illustration brightness').inputValue(),'30');assert.equal(await page.getByRole('button',{name:/^Trinity Classic/}).getAttribute('aria-pressed'),'true');
  await page.evaluate(()=>localStorage.setItem('trinity-look-and-feel','{broken'));await page.reload();await idle();assert.equal(await page.getByLabel('Night illustration brightness').inputValue(),'63');
  await click('Follow device');await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>!document.documentElement.classList.contains('dark'));await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.classList.contains('dark'));
  await page.getByRole('button',{name:/^Soft Indigo/}).click();await idle();await page.emulateMedia({media:'print'});assert.deepEqual(await reading(page.getByRole('button',{name:'Primary button',exact:true})),paper,'Print restores Classic button palette');await page.emulateMedia({media:'screen'});
  await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));assert.ok(await page.evaluate(()=>!document.documentElement.classList.contains('dark')));await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));assert.ok(await page.evaluate(()=>document.documentElement.classList.contains('dark')));
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(output,'mobile-soft-indigo-dark.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const button=page.getByRole('button',{name:'Light',exact:true});await button.focus();assert.equal(await button.evaluate(el=>document.activeElement===el),true);await page.keyboard.press('Enter');await idle();assert.equal(await button.getAttribute('aria-pressed'),'true');
  await click('Restore defaults');assert.equal(await page.evaluate(()=>localStorage.getItem('trinity-appearance')),'system');assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('trinity-look-and-feel'))),{preset:'trinity-classic',background:'illustration',dimming:37,deviceColors:false});
  await page.waitForFunction(()=>window.nativeAppearanceRequests.at(-1)?.preference==='system');
  await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:/^Soft Indigo/}).click();await idle();assert.equal(await page.evaluate(()=>document.documentElement.dataset.appTheme),'soft-indigo');
  await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Storage blocked','SecurityError')}});await click('Plain');await page.getByRole('status').getByText(/could not save/).waitFor();
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({reports,deviceDefault:true,persistence:true,crossTab:true,invalidStorage:true,printPalette:true,keyboardAndMobile:true,browserErrors:errors},null,2));
  console.log('LOOK_AND_FEEL_BROWSER_OK: both presets/light-dark contrast, dark hovers, settings persistence and cross-tab sync, device defaults, native appearance bridge, corrupt storage recovery, background brightness, original print palette, mobile/keyboard/reduced-motion and storage-failure handling.');
 }catch(error){console.error(error);throw error;}
 finally{await browser.close();await new Promise(r=>server.close(r));}
}
module.exports={build};
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
