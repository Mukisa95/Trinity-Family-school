/* Real shared controls and grading dialogs, synthetic pupils, no school-data writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/record-results-search-qa');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
fs.mkdirSync(output, { recursive: true });
const source = fs.readFileSync(path.join(root, 'src/app/exams/[examId]/record-results/RecordResultsView.tsx'), 'utf8');
const ast = ts.createSourceFile('record.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const editor = ast.statements.find(s => ts.isFunctionDeclaration(s) && s.name?.text === 'GradingScaleModal').getText(ast);
const defaults = ast.statements.find(s => ts.isVariableStatement(s) && s.declarationList.declarations[0].name.getText(ast) === 'DEFAULT_GRADING_SCALE_ITEMS').getText(ast);
assert.ok(!source.includes('<GlassSummaryBar'), 'Scale must not occupy permanent table space');
assert.match(source, /<ExamGradingScaleAction[\s\S]*?canEdit=\{resultLease.canSave\}/);
const fixture = `
import React,{useState,useEffect,useCallback} from 'react';import {createRoot} from 'react-dom/client';
import {GlassPageTopBar,GlassPageSearchInput,GlassActionDock,GlassActionButton} from '@/components/common/glass-page-top-bar';
import {ExamGradingScaleAction} from '@/components/exam/exam-grading-scale-action';
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';import {Input} from '@/components/ui/input';
${defaults}
${editor}
function Fixture(){const [query,setQuery]=useState(''),[edit,setEdit]=useState(false),[scale,setScale]=useState(DEFAULT_GRADING_SCALE_ITEMS),[locked,setLocked]=useState(false),[nursery,setNursery]=useState(false);
return <main className="px-3 sm:px-6 text-foreground bg-gradient-to-br from-orange-50 via-white to-blue-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950" style={{minHeight:1800,paddingTop:64}}>
<GlassPageTopBar title="PRE-PLE - SIPRO" recordDetails="P.7 · All streams | 15/10/2026 - 16/10/2026" leading={<button aria-label="Back to exams" className="h-9 w-9 shrink-0">Back</button>} meta={<span>37 of 77 pupils</span>} badges={<span>Unsaved changes</span>}
titleControls={<select aria-label="Class"><option>P.7 · All streams</option><option>P.6</option></select>}
actionsLeading={<GlassPageSearchInput placeholder="Search pupils..." value={query} onChange={e=>setQuery(e.target.value)} containerClassName="lg:hidden"/>}
center={<GlassPageSearchInput placeholder="Search pupils..." value={query} onChange={e=>setQuery(e.target.value)}/>}
actions={<GlassActionDock><GlassActionButton label="Sets"/><GlassActionButton label="View"/><ExamGradingScaleAction gradingScale={scale} canEdit={!locked} isNursery={nursery} onEdit={()=>setEdit(true)}/><GlassActionButton label="Save"/></GlassActionDock>}/>
<div data-results className="overflow-y-auto rounded-xl border bg-white dark:bg-slate-900" style={{height:'calc(100dvh - 260px)',minHeight:160}}>
<table className="w-full"><thead className="sticky top-0 bg-blue-50 dark:bg-slate-800"><tr><th>Pupil</th><th>Mark</th><th>Grade</th></tr></thead><tbody>{['Namuli Grace','Nambi Sarah',...Array.from({length:40},(_,i)=>'Test pupil '+i)].filter(n=>n.toLowerCase().includes(query.toLowerCase())).map(n=><tr key={n} className="h-12 border-b"><td>{n}</td><td>75</td><td>D2</td></tr>)}</tbody></table></div>
<button data-outside className="mt-4 border p-3">Outside search</button><button data-lock onClick={()=>setLocked(v=>!v)}>Toggle lock</button><button data-nursery onClick={()=>setNursery(v=>!v)}>Toggle nursery</button>
<GradingScaleModal isOpen={edit} onClose={()=>setEdit(false)} gradingScale={scale} onGradeScaleChange={()=>{}} onSave={next=>{setScale(next);setEdit(false);window.savedScale=next;}}/>
</main>};createRoot(document.getElementById('app')).render(<Fixture/>);`;
async function main() {
  if (process.env.SKIP_BUILD !== '1') {
  const mocks = {
    'next/link': "import React from 'react';export default React.forwardRef((props,ref)=><a ref={ref} {...props}/>);",
    'next/navigation': "export const usePathname=()=>'/exams/test/record-results';",
    '@/components/common/SmartBackButton': "export const SmartBackButton=({children,label,fallbackHref,...props})=><button aria-label={label} {...props}>{children}</button>;",
  };
  await require('esbuild').build({absWorkingDir:root,stdin:{contents:fixture,loader:'tsx',resolveDir:root},bundle:true,jsx:'automatic',platform:'browser',outfile:path.join(output,'fixture.js'),alias:{'@':path.join(root,'src')},define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'synthetic-navigation',setup(b){b.onResolve({filter:/^(next\/(link|navigation)|@\/components\/common\/SmartBackButton)$/},a=>({path:a.path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:root}));}}]});
  const config=ts.transpileModule(fs.readFileSync(path.join(root,'tailwind.config.ts'),'utf8'),{compilerOptions:{module:1}}).outputText;
  const mod={exports:{}};new Function('require','module','exports',config)(require,mod,mod.exports);
  const css=fs.readFileSync(path.join(root,'src/app/globals.css'),'utf8').replace(/^@import[^;]+;/,'')+'\n'+fs.readFileSync(path.join(root,'src/app/theme.css'),'utf8')+'\n'+(fs.existsSync(path.join(root,'src/app/brand-theme.css'))?fs.readFileSync(path.join(root,'src/app/brand-theme.css'),'utf8'):'');
  const result=await require('postcss')([require('tailwindcss')({...mod.exports.default,content:[path.join(root,'src/components/common/glass*.tsx'),path.join(root,'src/components/exam/exam-grading-scale-action.tsx'),path.join(root,'src/components/ui/{dialog,dropdown-menu,button,input}.tsx'),{raw:fixture,extension:'tsx'}]})]).process(css,{from:path.join(root,'src/app/globals.css')});
  fs.writeFileSync(path.join(output,'fixture.css'),result.css);
  }
  const server=http.createServer((req,res)=>{if(['/fixture.js','/fixture.css'].includes(req.url)){res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync(path.join(output,req.url.slice(1))));}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body style="font-family:Arial"><div id="app"></div><script src="/fixture.js"></script></body></html>');}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  const page=await browser.newPage({viewport:{width:375,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const search=()=>page.getByRole('textbox',{name:'Search pupils...'}).filter({visible:true}).first();
  const geometry=()=>page.evaluate(()=>{const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};return {bar:rect('.glass-page-topbar-enter'),back:rect('[aria-label="Back to exams"]'),table:rect('[data-results]'),select:rect('select')};});
  try {
    for(const theme of ['light','dark']) for(const width of [320,375,390,480,639,640,768,1280]) {
      await page.setViewportSize({width,height:720});await page.goto('http://127.0.0.1:'+server.address().port);await page.evaluate(t=>document.documentElement.classList.toggle('dark',t==='dark'),theme);await page.waitForTimeout(250);
      const before=await geometry();
      if(width<640) assert.equal(await search().getAttribute('placeholder'),'');
      await search().focus();await search().fill('Nam');await page.waitForTimeout(250);
      if(width<640) await page.waitForFunction(()=>document.activeElement?.getBoundingClientRect().width>=Math.min(innerWidth*0.72,352)-1);
      assert.equal(await page.locator('[data-results] tbody tr').count(),2);
      const box=await search().boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width,JSON.stringify({width,box}));
      if(width<640){assert.deepEqual(await geometry(),before,'Search must not move the header or table');assert.match(await search().evaluate(el=>getComputedStyle(el.parentElement).backdropFilter),/blur\(20px\)/);assert.ok(box.width>150);}
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow '+width);
      if(width===375) await page.screenshot({path:path.join(output,'search-'+theme+'.png')});
      if(width<640){await page.getByRole('button',{name:'Close search'}).click();await page.waitForTimeout(250);assert.equal(await search().getAttribute('placeholder'),'');assert.equal(await search().inputValue(),'Nam');assert.deepEqual(await geometry(),before);await search().focus();await page.keyboard.press('Escape');assert.equal(await search().evaluate(el=>el===document.activeElement),false);}
      await search().fill('');await page.locator('[data-outside]').click();
      const table=page.locator('[data-results]');await table.evaluate(el=>el.scrollTop=180);const head=await table.locator('thead').boundingBox(),tableBox=await table.boundingBox();assert.ok(Math.abs(head.y-tableBox.y)<=2,'Sticky table heading');
    }
    await page.setViewportSize({width:375,height:440});await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForTimeout(250);
    await search().focus();await search().fill('Nam');assert.equal(await page.locator('[data-results] tbody tr').count(),2);await page.screenshot({path:path.join(output,'short-viewport.png')});
    await page.locator('[data-outside]').click();await page.getByRole('button',{name:'Grading scale',exact:true}).click();await page.getByRole('menuitem',{name:'View grading scale',exact:true}).click();
    const dialog=page.getByRole('dialog');await dialog.waitFor();assert.equal(await dialog.getByRole('textbox').count(),0);assert.equal(await dialog.locator('tbody tr').count(),9);await page.screenshot({path:path.join(output,'view-scale.png')});
    await page.keyboard.press('Escape');await page.waitForTimeout(250);assert.equal(await page.getByRole('button',{name:'Grading scale',exact:true}).evaluate(el=>el===document.activeElement),true);
    await page.getByRole('button',{name:'Grading scale',exact:true}).click();await page.getByRole('menuitem',{name:'Edit grading scale',exact:true}).click();await page.getByRole('heading',{name:'Grading Scale Configuration'}).waitFor();
    await page.screenshot({path:path.join(output,'edit-scale.png')});assert.equal(await dialog.getByRole('spinbutton').count(),27);assert.equal(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth),false);
    await dialog.getByRole('textbox').first().fill('D1');await page.keyboard.press('Escape');
    await page.locator('[data-lock]').click();await page.getByRole('button',{name:'Grading scale',exact:true}).click();assert.equal(await page.getByRole('menuitem',{name:'Edit grading scale',exact:true}).getAttribute('aria-disabled'),'true');await page.getByRole('menuitem',{name:'View grading scale',exact:true}).click();await dialog.waitFor();await page.keyboard.press('Escape');
    await page.locator('[data-nursery]').click();await page.getByRole('button',{name:'Grading scale',exact:true}).click();assert.equal(await page.getByRole('menuitem',{name:'Edit grading scale',exact:true}).count(),0);await page.getByRole('menuitem',{name:'View grading scale',exact:true}).click();await page.getByRole('heading',{name:'Nursery Assessment Scale'}).waitFor();await page.keyboard.press('Escape');
    await page.setViewportSize({width:375,height:720});await page.evaluate(()=>window.scrollTo(0,350));await page.waitForTimeout(400);await search().focus();await search().fill('Nam');await page.waitForTimeout(250);const floating=await search().boundingBox();assert.ok(floating.x>=0&&floating.y>=40);await page.screenshot({path:path.join(output,'floating-search.png')});
    await page.emulateMedia({reducedMotion:'reduce'});await page.keyboard.press('Escape');await search().focus();assert.ok(parseFloat(await search().evaluate(el=>getComputedStyle(el.parentElement).transitionDuration))<=0.001);
    assert.deepEqual(errors,[]);console.log('PASS: 8 widths in both themes; stable mobile header/table geometry; filtering, blur, close/Escape, sticky headings, short viewport, floating controls, reduced motion, scale view/edit, lock and nursery access.');
  } catch(e) {console.error(e);fs.writeFileSync(path.join(output,'failure.txt'),e.stack);await page.screenshot({path:path.join(output,'failure.png')});fs.writeFileSync(path.join(output,'failure.html'),await page.content());throw e;} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
