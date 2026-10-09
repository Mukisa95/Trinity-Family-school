/* Real primitives and provider, synthetic native palette; no school records or network writes. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const ts = require('typescript'), esbuild = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'output/device-surfaces-qa');
const warm = require('../tests/fixtures/android-device-palette.json');
const loginSource = ts.createSourceFile('login.tsx',fs.readFileSync(path.join(root,'src/app/login/page.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let loginCss = '';
function loginStyles(node) {
  if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(loginSource)==='style')for(const child of node.children){if(ts.isJsxExpression(child)&&child.expression&&ts.isNoSubstitutionTemplateLiteral(child.expression))loginCss+=child.expression.text;}
  ts.forEachChild(node,loginStyles);
}
loginStyles(loginSource);
assert.ok(loginCss.includes('.modal-card'),'Use the actual sign-in stylesheet');
const cool = JSON.parse(JSON.stringify(warm));
cool.palettes.neutral = cool.palettes.secondary; cool.palettes.neutralVariant = cool.palettes.secondary;
for (const mode of ['light', 'dark']) {
  const dark = mode === 'dark', tones = cool.palettes.neutral;
  Object.assign(cool[mode], { background: tones[dark ? 900 : 10], surface: tones[dark ? 900 : 10], foreground: tones[dark ? 100 : 900], muted: tones[dark ? 800 : 100], mutedForeground: tones[dark ? 200 : 700], outline: tones[dark ? 700 : 200] });
}
const contents = `import React,{useEffect,useState} from 'react';import {createRoot} from 'react-dom/client';
import {ThemeProvider,useAppearance} from './src/components/providers/theme-provider';
import {Card} from './src/components/ui/card';import {Button} from './src/components/ui/button';import {Input} from './src/components/ui/input';
import {GlassSummaryBar} from './src/components/common/glass-summary-bar';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './src/components/ui/dialog';
import {ModernDialog,ModernDialogContent,ModernDialogTitle,ModernDialogDescription} from './src/components/ui/modern-dialog';
import {AlertDialog,AlertDialogContent,AlertDialogTitle,AlertDialogDescription,AlertDialogCancel} from './src/components/ui/alert-dialog';
import {Sheet,SheetContent,SheetTitle,SheetDescription} from './src/components/ui/sheet';
import {Popover,PopoverTrigger,PopoverContent} from './src/components/ui/popover';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem} from './src/components/ui/dropdown-menu';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from './src/components/ui/select';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from './src/components/ui/table';
function Fixture(){const appearance=useAppearance(),[modal,setModal]=useState('');useEffect(()=>{window.appearance=appearance},[appearance]);
const fields=<><div className="rounded border border-gray-200 bg-gray-100 p-3 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200" data-testid="dialog-section">Legacy dialog section</div><Input aria-label="Dialog input" defaultValue="Keep dialog input"/></>;
return <main className="dashboard-bg-wrapper min-h-screen bg-background p-6 text-foreground"><div className="relative grid gap-4">
<button id="mode-control" onClick={e=>appearance.changeTheme(appearance.dark?'light':'dark',e.currentTarget)}>Change appearance</button>
<Card className="p-4" data-testid="card">Card surface<Input aria-label="Page input" defaultValue="Keep page input"/></Card>
<GlassSummaryBar left={<strong>Shared statistics</strong>} right={<span className="text-green-700 dark:text-green-300" data-testid="status">Paid</span>}/>
<div data-sidebar="menu-button" className="p-4" data-testid="sidebar-material">Sidebar material</div>
<div className="grid gap-2">{['slate','gray','zinc','neutral','stone'].map(family=><div key={family} data-neutral={family} className={'rounded border p-3 bg-'+family+'-100 text-'+family+'-700 dark:bg-'+family+'-900 dark:text-'+family+'-100 dark:border-'+family+'-700'}>{family} legacy surface</div>)}</div>
<div className="rounded bg-slate-100/80 p-4 text-gray-700 dark:bg-slate-800/80 dark:text-gray-200" data-testid="legacy-alpha">Translucent panel</div>
<div className="rounded bg-gradient-to-r from-slate-100 to-gray-200 p-4 text-gray-700 dark:from-slate-900 dark:to-gray-800 dark:text-gray-100" data-testid="legacy-gradient">Neutral gradient</div>
<div className="trinity-portal-landing"><div className="modal-overlay"><div className="modal-card" data-testid="sign-in-surface">Sign-in surface</div></div></div>
<Table><TableHeader><TableRow className="bg-gray-100 dark:bg-slate-900"><TableHead>Class</TableHead></TableRow></TableHeader><TableBody><TableRow className="bg-slate-50 dark:bg-slate-800" data-testid="table-row"><TableCell>P.1</TableCell></TableRow></TableBody></Table>
<div className="flex flex-wrap gap-2">{['dialog','modern','alert','sheet'].map(name=><Button key={name} onClick={()=>setModal(name)}>{'Open '+name}</Button>)}
<Popover><PopoverTrigger asChild><Button>Open popover</Button></PopoverTrigger><PopoverContent data-testid="popover">Popover surface</PopoverContent></Popover>
<DropdownMenu><DropdownMenuTrigger asChild><Button>Open menu</Button></DropdownMenuTrigger><DropdownMenuContent data-testid="menu"><DropdownMenuItem>Menu surface</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
<Select><SelectTrigger aria-label="Choose class"><SelectValue placeholder="Choose class"/></SelectTrigger><SelectContent data-testid="select"><SelectItem value="p1">P.1</SelectItem></SelectContent></Select></div>
<div data-theme-surface="paper" className="bg-white p-3"><div data-testid="paper-neutral" className="bg-slate-900 text-slate-100 border border-gray-200 p-3">Document colours</div></div>
<Dialog open={modal==='dialog'} onOpenChange={open=>!open&&setModal('')}><DialogContent className="device-modal-test"><DialogTitle>Dialog preview</DialogTitle><DialogDescription>Actual shared dialog</DialogDescription>{fields}</DialogContent></Dialog>
<ModernDialog open={modal==='modern'} onOpenChange={open=>!open&&setModal('')}><ModernDialogContent className="device-modal-test"><ModernDialogTitle>Modern preview</ModernDialogTitle><ModernDialogDescription>Actual modern dialog</ModernDialogDescription>{fields}</ModernDialogContent></ModernDialog>
<AlertDialog open={modal==='alert'} onOpenChange={open=>!open&&setModal('')}><AlertDialogContent className="device-modal-test"><AlertDialogTitle>Alert preview</AlertDialogTitle><AlertDialogDescription>Actual alert dialog</AlertDialogDescription>{fields}<AlertDialogCancel>Close alert</AlertDialogCancel></AlertDialogContent></AlertDialog>
<Sheet open={modal==='sheet'} onOpenChange={open=>!open&&setModal('')}><SheetContent className="device-modal-test"><SheetTitle>Sheet preview</SheetTitle><SheetDescription>Actual sheet</SheetDescription>{fields}</SheetContent></Sheet>
</div></main>};createRoot(document.getElementById('app')).render(<ThemeProvider><Fixture/></ThemeProvider>);`;
async function build() {
  fs.mkdirSync(output, { recursive: true });
  await esbuild.build({ absWorkingDir: root, stdin: { contents, resolveDir: root, loader: 'tsx' }, bundle: true, jsx: 'automatic', platform: 'browser', alias: { '@': path.join(root, 'src') }, define: { 'process.env.NODE_ENV': '"production"' }, outfile: path.join(output, 'fixture.js') });
  const config = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(root, 'tailwind.config.ts'), 'utf8'), { compilerOptions: { module: 1 } }).outputText)(require, config, config.exports);
  const files = ['card','button','input','dialog','modern-dialog','alert-dialog','sheet','popover','dropdown-menu','select','table'].map(name=>'src/components/ui/'+name+'.tsx').concat(['src/components/common/glass-summary-bar.tsx']);
  const dynamic = ['slate','gray','zinc','neutral','stone'].flatMap(f=>[`bg-${f}-100`,`text-${f}-700`,`dark:bg-${f}-900`,`dark:text-${f}-100`,`dark:border-${f}-700`]).join(' ');
  const css = require('postcss').parse(['globals.css','theme.css','brand-theme.css'].map(name=>fs.readFileSync(path.join(root,'src/app',name),'utf8')).join('\n')+'\n'+loginCss);
  css.walkAtRules('import',rule=>rule.remove());
  const result = await require('postcss')([require('tailwindcss')({ ...config.exports.default, content: [{ raw: contents+' '+dynamic+' '+files.map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n'), extension:'tsx' }] })]).process(css,{from:path.join(root,'src/app/globals.css')});
  fs.writeFileSync(path.join(output,'fixture.css'),result.css);
}
const rgb = value => value.match(/[\d.]+/g).slice(0,3).map(Number);
const hexRgb = value => [1,3,5].map(i=>parseInt(value.slice(i,i+2),16));
const contrast = (a,b) => { const l=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);const x=l(rgb(a)),y=l(rgb(b));return(Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
const read = locator => locator.evaluate(el=>({color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor,border:getComputedStyle(el).borderColor,image:getComputedStyle(el).backgroundImage}));
async function run() {
  await build();
  const server=http.createServer((req,res)=>{if(['/fixture.js','/fixture.css'].includes(req.url)){res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync(path.join(output,req.url.slice(1))));}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="app"></div><script src="/fixture.js"></script></body></html>');}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,channel:process.env.THEME_BROWSER_CHANNEL||'msedge'});
  try {
    const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:'dark',reducedMotion:'reduce'}),page=await context.newPage(),errors=[],reports=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(palette=>{localStorage.setItem('trinity-look-and-feel',JSON.stringify({deviceColors:false,background:'plain'}));window.nativePalette=palette;window.TrinityOffline={postMessage(raw){const request=JSON.parse(raw);queueMicrotask(()=>window.TrinityOffline.onmessage?.({data:JSON.stringify({id:request.id,success:true,...(request.action==='deviceColors'?{palette:window.nativePalette}:{})})}));}};},warm);
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const idle=()=>page.waitForFunction(()=>window.appearance?.ready&&!window.appearance.changing);
    await idle();await page.waitForFunction(()=>window.appearance.deviceColorsSupported);
    const paper=await read(page.getByTestId('paper-neutral')),status=await read(page.getByTestId('status'));
    const defaultSlate=await read(page.locator('[data-neutral="slate"]'));
    assert.deepEqual(rgb(defaultSlate.background),[15,23,42]);
    for(const [name,palette] of [['warm',warm],['cool',cool]]) {
      await page.evaluate(p=>{window.nativePalette=p;window.dispatchEvent(new Event('trinity-android-colors-change'));},palette);
      await page.evaluate(()=>window.appearance.changeLookAndFeel({deviceColors:true}));
      await page.waitForFunction(expected=>getComputedStyle(document.documentElement).getPropertyValue('--ui-neutral-slate-900').trim()===expected,[1,3,5].map(i=>parseInt(palette.palettes.neutral[900].slice(i,i+2),16)).join(' '));
      for(const dark of [false,true]) {
        if(await page.evaluate(()=>window.appearance.dark)!==dark){await page.locator('#mode-control').click();await idle();}
        const readings=[];
        for(const surface of await page.locator('[data-neutral]').all()){
          const value=await read(surface);assert.ok(contrast(value.color,value.background)>=4.5,`${name}/${dark} neutral text`);assert.ok(name==='warm'?rgb(value.background)[0]>rgb(value.background)[2]:rgb(value.background)[2]>rgb(value.background)[0],`${name} surface hue`);readings.push(value);
        }
        for(const id of ['card','table-row']){const value=await read(page.getByTestId(id));const expected=id==='card'?palette[dark?'dark':'light'].surface:palette.palettes.neutral[dark?800:10];assert.deepEqual(rgb(value.background),hexRgb(expected),id+' must use '+name+' device neutral');readings.push(value);}
        assert.deepEqual(await read(page.getByTestId('paper-neutral')),paper,'Paper neutral colours must remain exact');
        assert.deepEqual(rgb((await read(page.getByTestId('sign-in-surface'))).background),hexRgb(palette.palettes.neutral[900]),'Custom sign-in surface must also use the device neutral');
        const sidebar=await read(page.getByTestId('sidebar-material'));assert.ok(!sidebar.image.includes('30, 41, 59')&&!sidebar.image.includes('15, 23, 42'),'Sidebar must not retain navy gradient');
        const gradient=await read(page.getByTestId('legacy-gradient'));assert.ok(!gradient.image.includes('15, 23, 42'),'Legacy gradients adapt too');
        for(const name of ['dialog','modern','alert','sheet']){
          await page.getByRole('button',{name:'Open '+name,exact:true}).click();const surface=page.locator('.device-modal-test');await surface.waitFor();const value=await read(surface);
          assert.ok(contrast(value.color,value.background)>=4.5,name+' foreground contrast');assert.deepEqual(rgb(value.background),hexRgb(palette[dark?'dark':'light'][name==='sheet'?'background':'muted']),name+' must use the active surface role');
          const section=await read(page.getByTestId('dialog-section'));assert.ok(contrast(section.color,section.background)>=4.5,name+' nested section contrast');
          await page.getByRole('textbox',{name:'Dialog input'}).fill('Preserve edited dialog input');
          if(name==='dialog')await page.screenshot({path:path.join(output,`${reports.length}-${dark?'dark':'light'}-dialog.png`)});
          if(name==='alert')await page.getByRole('button',{name:'Close alert',exact:true}).click();else await page.keyboard.press('Escape');await surface.waitFor({state:'hidden'});readings.push(value);
        }
        for(const [button,id] of [['Open popover','popover'],['Open menu','menu']]){await page.getByRole('button',{name:button,exact:true}).click();const surface=page.getByTestId(id);await surface.waitFor();const value=await read(surface);assert.ok(contrast(value.color,value.background)>=4.5,id+' contrast');readings.push(value);await page.keyboard.press('Escape');await surface.waitFor({state:'hidden'});}
        await page.getByRole('combobox',{name:'Choose class'}).click();const select=page.getByTestId('select');await select.waitFor();const value=await read(select);assert.ok(contrast(value.color,value.background)>=4.5,'select contrast');await page.keyboard.press('Escape');await select.waitFor({state:'hidden'});
        assert.equal(await page.getByRole('textbox',{name:'Page input'}).inputValue(),'Keep page input');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        reports.push({name,dark,minimumContrast:Math.min(...readings.map(value=>contrast(value.color,value.background)))});
        console.log(`DEVICE_SURFACES_OK ${name} ${dark?'dark':'light'}: neutral utilities, nested dialog sections and seven actual overlay primitives`);
      }
    }
    // Refresh an open dialog without replacing it or discarding its entered values.
    await page.getByRole('button',{name:'Open dialog',exact:true}).click();await page.getByRole('textbox',{name:'Dialog input'}).fill('Keep during wallpaper change');
    await page.evaluate(p=>{window.nativePalette=p;window.dispatchEvent(new Event('trinity-android-colors-change'));},warm);
    await page.waitForFunction(()=>getComputedStyle(document.documentElement).getPropertyValue('--night-background').trim()==='45 21 8');
    assert.equal(await page.getByRole('textbox',{name:'Dialog input'}).inputValue(),'Keep during wallpaper change');await page.keyboard.press('Escape');
    assert.equal((await read(page.getByTestId('status'))).color,status.color,'Status colours must stay independent');
    await page.emulateMedia({media:'print'});assert.deepEqual(await read(page.getByTestId('paper-neutral')),paper);assert.deepEqual(rgb((await read(page.locator('[data-neutral="slate"]'))).background),[15,23,42]);await page.emulateMedia({media:'screen'});
    await page.evaluate(()=>window.appearance.changeLookAndFeel({deviceColors:false}));assert.deepEqual(await read(page.locator('[data-neutral="slate"]')),defaultSlate,'Disabling device colours restores exact defaults');
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({reports,paperUnchanged:true,statusUnchanged:true,inputPreserved:true,defaultsRestored:true,mobileFits:true,browserErrors:errors},null,2));
    console.log('DEVICE_SURFACE_BROWSER_OK: warm/cool light-dark cohesion, live open-dialog refresh, input retention, exact paper/status/default restoration and mobile fit.');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
