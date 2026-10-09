/* Uses real appearance/navigation components and synthetic data; no school account or network writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/theme-qa');
fs.mkdirSync(output, { recursive: true });
const mocks = {
  'next/link': `import React from 'react'; export default React.forwardRef(({children,...props},ref)=><a ref={ref} {...props}>{children}</a>);`,
  'next/navigation': `export const useRouter=()=>({push:()=>{},replace:()=>{},back:()=>{}}); export const usePathname=()=>'/';`,
  '@/lib/contexts/auth-context': `export const useAuth=()=>({user:{firstName:'Amina',lastName:'Test',username:'amina',role:'Admin'},logout:async()=>{}});`,
  '@/components/common/LogoutMessage': `export default ()=>null;`,
  '@/components/common/SmartBackButton': `import React from 'react'; export const SmartBackButton=({children,...props})=><button {...props}>{children}</button>;`,
};
async function build() {
  await esbuild.build({ absWorkingDir: root, stdin: { resolveDir: root, loader: 'tsx', contents: `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {ThemeProvider} from './src/components/providers/theme-provider';
import {ThemeToggle} from './src/components/ui/theme-toggle';
import {SidebarProvider,Sidebar,SidebarHeader,SidebarContent,SidebarFooter,SidebarInset} from './src/components/ui/sidebar';
import {SidebarUserFooter} from './src/components/layout/sidebar-user-footer';
import {GlassPageTopBar} from './src/components/common/glass-page-top-bar';
import {GlassStickyTableShell,GlassStickyTable,GlassStickyTableHeader} from './src/components/common/glass-sticky-table';
import {Card,CardContent} from './src/components/ui/card';
import {Dialog,DialogTrigger,DialogContent,DialogTitle,DialogDescription} from './src/components/ui/dialog';
function Fixture(){return <ThemeProvider><div className="dashboard-bg-wrapper"><SidebarProvider><Sidebar collapsible="icon"><SidebarHeader><strong className="p-3 text-slate-900 dark:text-slate-100">Trinity Family School</strong></SidebarHeader><SidebarContent><button data-sidebar="menu-button" data-active="true" className="text-blue-700 dark:text-blue-300">Overview</button><button data-sidebar="menu-button" className="text-slate-700 dark:text-slate-200">Pupils</button></SidebarContent><SidebarFooter><SidebarUserFooter/></SidebarFooter></Sidebar><SidebarInset><header className="flex items-center justify-between px-6"><strong>School workspace</strong><ThemeToggle className="md:hidden" compact/></header><main className="px-6 py-8"><GlassPageTopBar title="Welcome back, Amina" recordDetails="Academic year 2026 • Term 3"/><div className="grid grid-cols-1 gap-4 md:grid-cols-3"><Card><CardContent className="pt-6"><p className="text-muted-foreground">Active pupils</p><h2 className="text-3xl font-bold">624</h2><span className="text-emerald-700 dark:text-emerald-300">Attendance improving</span></CardContent></Card><Card><CardContent className="pt-6"><p className="text-muted-foreground">Fees collected</p><h2 className="text-3xl font-bold">Shs. 12.4M</h2><span className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-full px-2">This term</span></CardContent></Card><Card><CardContent className="pt-6"><p className="text-muted-foreground">School updates</p><h2 className="text-3xl font-bold">18</h2><Dialog><DialogTrigger className="text-primary">Open details</DialogTrigger><DialogContent><DialogTitle>School updates</DialogTitle><DialogDescription>Theme also applies to menus and dialogs.</DialogDescription><input aria-label="Message" className="border border-input bg-background text-foreground p-3 rounded-lg" placeholder="Write a message"/></DialogContent></Dialog></CardContent></Card></div><div className="mt-6"><GlassStickyTableShell><GlassStickyTable><GlassStickyTableHeader><tr><th className="p-4 text-left">Pupil</th><th className="p-4 text-left">Class</th><th className="p-4 text-left">Status</th></tr></GlassStickyTableHeader><tbody>{['Alex Test','Grace Test','Noah Test'].map((name,i)=><tr key={name} className="border-t border-slate-100 dark:border-slate-700"><td className="p-4">{name}</td><td className="p-4 text-muted-foreground">Primary {i+3}</td><td className="p-4"><span className="rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 px-3 py-1">Active</span></td></tr>)}</tbody></GlassStickyTable></GlassStickyTableShell></div><div data-theme-surface="paper" className="mt-6 rounded-lg p-4"><strong>Report preview</strong><p>Paper retains its white background.</p></div></main></SidebarInset></SidebarProvider></div></ThemeProvider>}
createRoot(document.getElementById('app')).render(<Fixture/>);
` }, bundle: true, jsx: 'automatic', platform: 'browser', alias: { '@': path.join(root, 'src') }, outfile: path.join(output, 'fixture.js'), define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'fixture-data', setup(b) { b.onResolve({filter:/^(next\/(link|navigation)|@\/lib\/contexts\/auth-context|@\/components\/common\/(LogoutMessage|SmartBackButton))$/}, a=>({path:a.path,namespace:'mock'})); b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:root})); } }] });
  const config = require('typescript').transpileModule(fs.readFileSync(path.join(root,'tailwind.config.ts'),'utf8'),{compilerOptions:{module:1}}).outputText;
  const mod = {exports:{}}; new Function('require','module','exports',config)(require,mod,mod.exports);
  const css = fs.readFileSync(path.join(root,'src/app/globals.css'),'utf8').replace(/^@import[^;]+;/,'') + '\n' + fs.readFileSync(path.join(root,'src/app/theme.css'),'utf8');
  const built = await require('postcss')([require('tailwindcss')({...mod.exports.default,content:[path.join(root,'src/**/*.{ts,tsx}'),{raw:fs.readFileSync(__filename,'utf8'),extension:'tsx'}]})]).process(css,{from:path.join(root,'src/app/globals.css')});
  fs.writeFileSync(path.join(output,'fixture.css'),built.css);
  const hydrationTree = `import React,{useEffect} from 'react'; import {ThemeProvider,useAppearance} from './src/components/providers/theme-provider'; import {ThemeToggle} from './src/components/ui/theme-toggle'; function Probe(){const {ready}=useAppearance();useEffect(()=>{window.themeHydrated=ready},[ready]);return <ThemeToggle/>;} const tree=<ThemeProvider><div className="bg-background text-foreground"><Probe/></div></ThemeProvider>;`;
  await esbuild.build({absWorkingDir:root,stdin:{contents:hydrationTree+`import {renderToString} from 'react-dom/server'; module.exports=renderToString(tree);`,resolveDir:root,loader:'tsx'},jsx:'automatic',bundle:true,platform:'node',mainFields:['module','main'],external:['react','react/*','react-dom','react-dom/*'],alias:{'@':path.join(root,'src')},outfile:path.join(output,'hydration.cjs')});
  await esbuild.build({absWorkingDir:root,stdin:{contents:hydrationTree+`import {hydrateRoot} from 'react-dom/client'; hydrateRoot(document.getElementById('app'),tree);`,resolveDir:root,loader:'tsx'},jsx:'automatic',bundle:true,platform:'browser',alias:{'@':path.join(root,'src')},define:{'process.env.NODE_ENV':'"production"'},outfile:path.join(output,'hydration.js')});
  fs.writeFileSync(path.join(output,'hydration.html'),require(path.join(output,'hydration.cjs')));
}
async function run() {
  await build();
  console.log('Theme fixture built from application CSS and components.');
  const server = http.createServer((req,res)=>{
    const file = req.url.split('?')[0];
    if(file==='/fixture.js'||file==='/fixture.css'||file==='/hydration.js') {res.setHeader('Content-Type',file.endsWith('js')?'text/javascript':'text/css');res.end(fs.readFileSync(path.join(output,file.slice(1))));}
    else if(file==='/hydration') {res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="theme-color" content="#f1f7ff"><link rel="stylesheet" href="/fixture.css"></head><body><div id="app">'+fs.readFileSync(path.join(output,'hydration.html'),'utf8')+'</div><script src="/hydration.js"></script></body></html>');}
    else if(file.startsWith('/images/')) {res.setHeader('Content-Type','image/png');res.end(fs.readFileSync(path.join(root,'public/images/D.B background.png')));}
    else {res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="theme-color" content="#f1f7ff"><link rel="stylesheet" href="/fixture.css"></head><body style="font-family:Arial,sans-serif"><div id="app"></div><script src="/fixture.js"></script></body></html>');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  const url=`http://127.0.0.1:${server.address().port}`;
  const context=await browser.newContext({viewport:{width:1440,height:960}});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.addInitScript(()=>{
    const animate=Element.prototype.animate;
    Element.prototype.animate=function(frames,options){const a=animate.call(this,frames,options);if(options?.pseudoElement){window.themeAnimation=a;window.themeFrames=frames;window.themeAnimationOptions=options;}return a;};
  });
  try {
    await page.goto(url);const toggle=page.getByRole('switch',{name:'Dark theme'}).filter({visible:true}).first();
    await toggle.waitFor();await page.waitForFunction(()=>!document.querySelector('[role="switch"]').disabled);
    await page.screenshot({path:path.join(output,'desktop-light.png')});
    const adjacent=await toggle.evaluate(el=>el.parentElement.querySelector('button:not([role="switch"])')?.textContent);assert.match(adjacent,/Amina/);
    await toggle.click();await page.waitForFunction(()=>window.themeAnimation);
    await page.evaluate(()=>{window.themeAnimation.pause();window.themeAnimation.currentTime=225;});
    await page.screenshot({path:path.join(output,'desktop-reveal.png'),animations:'allow'});
    assert.equal(await page.evaluate(()=>window.themeAnimationOptions.duration),450);
    assert.match(await page.evaluate(()=>window.themeFrames.clipPath[0]),/^circle\(0px at /);
    await page.evaluate(()=>window.themeAnimation.play());
    await page.waitForFunction(()=>!document.documentElement.dataset.themeReveal);
    console.log('Circular reveal verified.');
    assert.equal(await toggle.getAttribute('aria-checked'),'true');
    assert.equal(await page.evaluate(()=>localStorage.getItem('trinity-appearance')),'dark');
    const paper=await page.locator('[data-theme-surface="paper"]').evaluate(el=>getComputedStyle(el).backgroundColor);assert.equal(paper,'rgb(255, 255, 255)');
    const header=await page.locator('th').first().evaluate(el=>getComputedStyle(el).backgroundImage);assert.ok(!header.includes('255, 255, 255'),header);
    await page.screenshot({path:path.join(output,'desktop-dark.png')});
    await page.getByText('Open details',{exact:true}).click();assert.equal(await page.getByRole('dialog').count(),1);
    await page.screenshot({path:path.join(output,'dark-dialog.png')});await page.getByRole('button',{name:'Close',exact:true}).click();
    await page.reload();await toggle.waitFor();assert.equal(await toggle.getAttribute('aria-checked'),'true');
    await page.getByRole('button',{name:/Amina Test/}).click();await page.getByRole('menuitemradio',{name:'Use device setting'}).click();await page.keyboard.press('Escape');
    await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.classList.contains('dark'));
    await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>!document.documentElement.classList.contains('dark'));
    await toggle.click();await page.waitForFunction(()=>!document.documentElement.dataset.themeReveal);
    await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));await page.emulateMedia({media:'print'});
    assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('dark')),false);
    await page.screenshot({path:path.join(output,'print-from-dark.png')});
    await page.pdf({path:path.join(output,'print-from-dark.pdf'),printBackground:true});
    await page.emulateMedia({media:'screen'});await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
    assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('dark')),true);
    await page.getByRole('button',{name:'Collapse Sidebar',exact:true}).click();
    await page.screenshot({path:path.join(output,'collapsed-dark.png')});
    const box=await toggle.boundingBox();assert.ok(box.width>=44&&box.height>=44);
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'mobile-dark.png')});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const mobile=page.getByRole('switch',{name:'Dark theme'}).filter({visible:true}).first();await mobile.click();await page.waitForFunction(()=>!document.documentElement.dataset.themeReveal);
    await page.screenshot({path:path.join(output,'mobile-light.png')});
    console.log('Saved/system preferences, print restoration, collapsed sidebar and mobile layout verified.');
    // Older WebViews still get a fade, and reduced motion never receives a radial reveal.
    await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>window.themeAnimation=undefined);await mobile.click();
    await page.waitForFunction(()=>document.querySelector('[role="switch"][aria-busy="true"]')===null);
    assert.equal(await page.evaluate(()=>window.themeAnimation===undefined),true);
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.evaluate(()=>{document.startViewTransition=undefined;});await mobile.click();
    await page.waitForFunction(()=>document.querySelector('[role="switch"][aria-busy="true"]')===null);assert.equal(await mobile.getAttribute('aria-checked'),'false');
    await page.emulateMedia({reducedMotion:'reduce'});await mobile.click();await page.waitForFunction(()=>document.querySelector('[role="switch"][aria-busy="true"]')===null);
    assert.equal(await mobile.getAttribute('aria-checked'),'true');
    assert.equal(await page.evaluate(()=>getComputedStyle(document.body).opacity),'1');
    await page.goto(url+'/hydration');await page.waitForFunction(()=>window.themeHydrated);
    assert.equal(await page.getByRole('switch',{name:'Dark theme'}).getAttribute('aria-checked'),'true');
    assert.equal(await page.getByRole('switch',{name:'Dark theme'}).getAttribute('title'),'Switch to light theme');
    assert.deepEqual(errors,[]);
    console.log('THEME_BROWSER_OK: reveal, preference reload/system changes, portal dialog, collapsed/mobile controls, fallback, reduced motion, paper, print restoration and saved-dark SSR hydration.');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
