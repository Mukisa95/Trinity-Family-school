/* Exercises the actual Exam Management batch renderer with synthetic exam records. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ts = require('typescript');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/exam-set-selector-qa');
fs.mkdirSync(output, {recursive:true});
const source = fs.readFileSync(path.join(root, 'src/app/exams/page.tsx'), 'utf8');
const ast = ts.createSourceFile('exams.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const marker = source.indexOf('Group exams by batch - Table Version');
let batch;
function visit(n) {
  if (batch) return;
  if (ts.isJsxExpression(n) && n.getStart(ast)>marker && n.expression?.getText(ast).startsWith('(() => {') && n.getText(ast).includes('const batchGrouped:')) {batch=n.getText(ast);return;}
  ts.forEachChild(n,visit);
}
visit(ast);
assert.ok(batch, 'Actual table batch renderer must be present');
const icons = ast.statements.find(n=>ts.isImportDeclaration(n) && n.moduleSpecifier.text==='lucide-react').getText(ast);
const fixture = `
import * as React from 'react';import {createRoot} from 'react-dom/client';
${icons}
import {Button} from '@/components/ui/button';import {Badge} from '@/components/ui/badge';
import {Table,TableBody,TableCell,TableRow} from '@/components/ui/table';
const Link=({children,...props})=><a {...props}>{children}</a>;
const ExamSignatureDisplay=()=>null;
const getExamStatus=()=>({text:'Ended',color:'text-emerald-600',icon:CheckCircle});
const formatDateRange=(a,b)=>a+' – '+b;
const allClasses=Array.from({length:7},(_,i)=>({id:'p'+(i+1),code:'P.'+(i+1),name:'PRIMARY '+(i+1)}));
const initialExams=[...allClasses.slice(0,6).map(c=>({id:'mid-'+c.id,classId:c.id,batchId:'mid',baseName:'MID TERM',name:'MID TERM',examTypeId:'et_mid',examTypeName:'Mid term',examNature:'Class based',startDate:'2026-10-19',endDate:'2026-10-21'})),...[1,2,3,4].map(n=>({id:'set-'+n,classId:'p7',baseName:'PRE-PLE',name:'PRE-PLE - SIPRO '+n+' - SET '+n,examTypeId:'et_cat',academicYearId:'2026',termId:'t3',examNature:'Class based',startDate:'2026-10-15',endDate:'2026-10-16'})),{id:'steam',classId:'p7',baseName:'STEAM A',name:'STEAM A - SURE KEY - SET 1',examTypeId:'et_cat',academicYearId:'2026',termId:'t3',examNature:'Class based',startDate:'2026-09-17',endDate:'2026-09-18'}];
function Fixture(){
const [groupedAndSortedExams,setExams]=React.useState(initialExams),[expandedBatches,setExpandedBatches]=React.useState({}),[selectedCollapsedBatchExams,setSelectedCollapsedBatchExams]=React.useState({}),[selectedCATSetKeys,setSelectedCATSetKeys]=React.useState({});
const getClassMeta=id=>allClasses.find(c=>c.id===id)||{code:'N/A',name:'Unknown'};
const openExamPrintOptions=exam=>window.lastPrint=exam.id;
const handleDeleteExamStack=(ids,label)=>window.lastDelete={ids,label};
const handleDeleteExam=id=>window.lastDelete={ids:[id]};
const handleAddSet=exam=>window.lastAdd=exam.id;
const handleOpenStackGradingScaleDialog=()=>{};
return <main className="bg-blue-50 p-3 text-foreground sm:p-6 dark:bg-slate-950" style={{minHeight:'100vh'}}><div className="mx-auto max-w-6xl space-y-4">${batch}</div>
<button data-remove onClick={()=>setExams(items=>items.filter(e=>e.id!=='set-2'))}>Remove selected set 2</button>
<button data-many onClick={()=>setExams(items=>[...items,...[10,5,9,6,8,7].map(n=>({...initialExams[6],id:'set-'+n,name:'PRE-PLE - SIPRO '+n+' - SET '+n}))])}>Add more sets</button>
<button data-multiple onClick={()=>setExams(items=>[...items,{...initialExams[6],id:'set-1-p6',classId:'p6'}])}>Add another class to set 1</button>
</main>;}createRoot(document.getElementById('app')).render(<Fixture/>);`;
async function main(){
  if(process.env.SKIP_BUILD!=='1'){
    await require('esbuild').build({absWorkingDir:root,stdin:{contents:fixture,loader:'tsx',resolveDir:root},bundle:true,jsx:'automatic',platform:'browser',outfile:path.join(output,'fixture.js'),alias:{'@':path.join(root,'src')},define:{'process.env.NODE_ENV':'"production"'}});
    const config=ts.transpileModule(fs.readFileSync(path.join(root,'tailwind.config.ts'),'utf8'),{compilerOptions:{module:1}}).outputText;
    const mod={exports:{}};new Function('require','module','exports',config)(require,mod,mod.exports);
    const css=fs.readFileSync(path.join(root,'src/app/globals.css'),'utf8').replace(/^@import[^;]+;/,'')+'\n'+fs.readFileSync(path.join(root,'src/app/theme.css'),'utf8')+'\n'+(fs.existsSync(path.join(root,'src/app/brand-theme.css'))?fs.readFileSync(path.join(root,'src/app/brand-theme.css'),'utf8'):'');
    const built=await require('postcss')([require('tailwindcss')({...mod.exports.default,content:[path.join(root,'src/components/ui/{table,button,badge}.tsx'),{raw:fixture,extension:'tsx'}]})]).process(css,{from:path.join(root,'src/app/globals.css')});
    fs.writeFileSync(path.join(output,'fixture.css'),built.css);
  }
  const server=http.createServer((req,res)=>{if(['/fixture.js','/fixture.css'].includes(req.url)){res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync(path.join(output,req.url.slice(1))));}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body style="font-family:Arial"><div id="app"></div><script src="/fixture.js"></script></body></html>');}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,channel:'msedge'}),page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const cat=()=>page.locator('main .max-w-6xl > div').filter({has:page.getByRole('heading',{name:'PRE-PLE',exact:true})});
  const desktop=()=>cat().locator('div.hidden.overflow-hidden');
  const mobile=()=>cat().locator('div.space-y-2.p-2\\.5');
  const current=()=>page.viewportSize().width<640?mobile():desktop();
  const selector=()=>current().getByRole('group',{name:'Choose continuous assessment set'});
  const action=name=>current().locator('[title="'+name+'"]');
  try{
    for(const theme of ['light','dark']) for(const width of [320,375,639,640,768,1024,1366]){
      await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:'+server.address().port);await page.evaluate(t=>document.documentElement.classList.toggle('dark',t==='dark'),theme);
      await selector().waitFor();assert.deepEqual(await selector().getByRole('button').allTextContents(),['SET 1','SET 2','SET 3','SET 4']);
      assert.equal(await selector().getByRole('button',{name:'SET 4',exact:true}).getAttribute('aria-pressed'),'true');
      await selector().getByRole('button',{name:'SET 2',exact:true}).click();
      assert.equal(await action('Record Results').getAttribute('href'),'/exams/set-2/record-results?classId=p7');
      assert.equal(await action('View Results').getAttribute('href'),'/exams/set-2/view-results?classId=p7');
      assert.equal(await action('Edit Snapshot Data').getAttribute('href'),'/exams/set-2/edit-snapshot');
      await action('Print Reports').click();assert.equal(await page.evaluate(()=>window.lastPrint),'set-2');
      await action(width<640?'Delete Exam':'Delete Set').click();assert.deepEqual(await page.evaluate(()=>window.lastDelete.ids),['set-2']);
      await selector().getByRole('button',{name:'SET 3',exact:true}).focus();await page.keyboard.press('Enter');assert.equal(await action('Record Results').getAttribute('href'),'/exams/set-3/record-results?classId=p7');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Page overflow '+width);
      if(width===375||width===1366) await page.screenshot({path:path.join(output,(width<640?'mobile-':'desktop-')+theme+'.png'),fullPage:true});
      if(width>=640){await desktop().getByRole('button',{name:'Expand assessment sets',exact:true}).click();assert.equal(await desktop().locator('tbody > tr').count(),4);await cat().getByRole('button',{name:'Collapse assessment sets',exact:true}).click();assert.equal(await desktop().locator('tbody > tr').count(),1);assert.equal(await selector().getByRole('button',{name:'SET 3',exact:true}).getAttribute('aria-pressed'),'true');}
    }
    await page.setViewportSize({width:1366,height:900});await page.goto('http://127.0.0.1:'+server.address().port);await selector().getByRole('button',{name:'SET 2',exact:true}).click();await page.setViewportSize({width:375,height:900});assert.equal(await selector().getByRole('button',{name:'SET 2',exact:true}).getAttribute('aria-pressed'),'true');
    await page.locator('[data-remove]').click();assert.equal(await selector().getByRole('button',{name:'SET 4',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await action('Record Results').getAttribute('href'),'/exams/set-4/record-results?classId=p7');
    await page.locator('[data-many]').click();assert.deepEqual(await selector().getByRole('button').allTextContents(),['SET 1','SET 3','SET 4','SET 5','SET 6','SET 7','SET 8','SET 9','SET 10']);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.setViewportSize({width:1366,height:900});await selector().getByRole('button',{name:'SET 10',exact:true}).click();assert.equal(await action('Record Results').getAttribute('href'),'/exams/set-10/record-results?classId=p7');
    await page.locator('[data-multiple]').click();await selector().getByRole('button',{name:'SET 1',exact:true}).click();await desktop().locator('button').filter({has:page.locator('svg.lucide-chevron-down')}).first().click();assert.equal(await desktop().locator('tbody > tr').count(),2);
    const mid=page.locator('main .max-w-6xl > div').filter({has:page.getByRole('heading',{name:'MID TERM',exact:true})});await mid.getByRole('button',{name:'P.3',exact:true}).filter({visible:true}).click();assert.equal(await mid.locator('[title="Record Results"]').filter({visible:true}).getAttribute('href'),'/exams/mid-p3/record-results?classId=p3');
    const single=page.locator('main .max-w-6xl > div').filter({has:page.getByRole('heading',{name:'STEAM A',exact:true})});assert.equal(await single.getByRole('group',{name:'Choose continuous assessment set'}).count(),0);assert.equal(await single.locator('[title="Record Results"]').filter({visible:true}).getAttribute('href'),'/exams/steam/record-results?classId=p7');
    assert.deepEqual(errors,[]);console.log('PASS: seven widths in light/dark, all set labels, selection and action targets, keyboard, expand/collapse, cross-breakpoint state, removed-set fallback, numeric set ordering, multiple classes per set and unchanged regular/single-set actions.');
  }catch(e){console.error(e);fs.writeFileSync(path.join(output,'failure.txt'),e.stack);await page.screenshot({path:path.join(output,'failure.png'),fullPage:true});throw e;}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
