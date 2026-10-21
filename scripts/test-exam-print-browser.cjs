/* Real print controller, dialogs and PDF tables; synthetic scoped exam data and service boundaries. */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict'), ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'output/exam-print-browser');
fs.mkdirSync(out, { recursive: true });
const fixtureData = `
export const subjects=['ENG','MATH','SCI','SST','RE','ART'].map((code,i)=>({subjectId:'s'+i,code,name:code,maxMarks:100,passingMarks:40}));
export const pupils=[{pupilId:'a',name:'ALICE TEST',admissionNumber:'PIN_A',classNameAtExam:'Primary Seven',streamIdAtExam:'east',streamNameAtExam:'East',streamCodeAtExam:'E'},{pupilId:'b',name:'BOB TEST',admissionNumber:'PIN_B',classNameAtExam:'Primary Seven',streamIdAtExam:'west',streamNameAtExam:'West',streamCodeAtExam:'W'}];
export const streams=[{id:'east',name:'East',code:'E'},{id:'west',name:'West',code:'W'}];
export const exam={id:'exam7',name:'PRE-PLE - SET 4',baseName:'PRE-PLE',classId:'p7',examTypeId:'et_cat',examTypeName:'Continuous Assessment',academicYearId:'y',termId:'t',startDate:'2026-10-15',endDate:'2026-10-16',streamScope:{streams}};
export const scale=[{minMark:90,maxMark:100,grade:'D1',aggregates:1},{minMark:0,maxMark:89,grade:'F9',aggregates:9}];
export const result={id:'r',examId:exam.id,academicYearId:'y',termId:'t',classSnapshot:{classId:'p7',name:'Primary Seven',code:'P.7',streamScope:{streams}},pupilSnapshots:pupils,subjectSnapshots:subjects,gradingScale:scale,majorSubjects:['ENG','MATH','SCI','SST'],results:Object.fromEntries(pupils.map(p=>[p.pupilId,Object.fromEntries(subjects.map(s=>[s.subjectId,{marks:88,grade:'D2',aggregates:2}]))]))};
export const classes=[{id:'p7',name:'Primary Seven',code:'P.7',streams}];
export const years=[{id:'y',name:'2026',terms:[{id:'t',name:new URLSearchParams(location.search).get('term')||'TERM 2'}]}];
export const settings={generalInfo:{name:'TRINITY FAMILY SCHOOL'}};
`;
fs.writeFileSync(path.join(out, 'data.ts'), fixtureData);
const dataImport = `import {exam,result,classes,years,settings} from '${path.join(out, 'data.ts').replaceAll('\\', '/')}';`;
const stubs = {
  '@/lib/contexts/navigation-context': `export const useNavigation=()=>({goBack:()=>{}});`,
  '@/lib/access/authorized-fetch': `export const authorizedFetch=async()=>({ok:true,json:async()=>({})});`,
  'next/navigation': `export const useParams=()=>({examId:'exam7'});export const usePathname=()=>'/exams';import {useState,useEffect} from 'react';export const useSearchParams=()=>{const[q,setQ]=useState(location.search);useEffect(()=>{const changed=()=>setQ(location.search);window.addEventListener('fixture-route',changed);return()=>window.removeEventListener('fixture-route',changed)},[]);return new URLSearchParams(q)};const nav=(...a)=>{window.navigations.push(a);throw Error('Print navigated away')};const replace=url=>{if(new URLSearchParams(location.search).get('view')==='1'){const target=new URL(url,location.origin);target.searchParams.set('view','1');target.searchParams.set('term',new URLSearchParams(location.search).get('term')||'TERM 2');history.replaceState({},'',target);window.dispatchEvent(new Event('fixture-route'));}else nav(url)};export const useRouter=()=>({push:nav,replace,back:nav});`,
  'next/link': `import React from 'react';export default function Link(p){return <a {...p}/>;}`,
  '@/lib/hooks/use-exams': dataImport + `const exams=[exam];export const useExam=()=>({data:exam,isLoading:false});export const useExams=()=>({data:exams,isLoading:false});export const useExamResultByExamId=()=>({data:window.noResults||window.loading?null:result,error:window.loadError?Error('Results unavailable'):null,isLoading:!!window.loading});`,
  '@/lib/hooks/use-classes': dataImport + `export const useClasses=()=>({data:classes});`,
  '@/lib/hooks/use-academic-years': dataImport + `export const useAcademicYears=()=>({data:years});`,
  '@/lib/hooks/use-pupils': `const pupils=[];export const usePupils=()=>({data:pupils});`,
  '@/lib/hooks/use-staff': `const staff=[];export const useStaff=()=>({data:staff});`,
  '@/lib/services/school-settings.service': dataImport + `export const SchoolSettingsService={getSchoolSettings:async()=>settings};`,
  '@/lib/services/exams.service': `export const ExamsService=new Proxy({},{get:()=>async()=>[]});`,
  '@/lib/hooks/use-results-release': `export const useReleaseInfo=()=>({});const mutation={isPending:false,mutateAsync:async()=>{}};export const useReleaseResults=()=>mutation;export const useRevokeResults=()=>mutation;export const useReleaseAllResults=()=>mutation;`,
  '@/lib/contexts/auth-context': `export const useAuth=()=>({user:{id:'test',role:'Admin'}});`,
  '@/lib/contexts/print-context': `const registerPrintHandler=()=>()=>{};export const usePrint=()=>({registerPrintHandler});`,
  '@/hooks/use-toast': `const toast=(data)=>window.toasts.push(data);export const useToast=()=>({toast});`,
  '@/components/exam/ExamSignatureDisplay': `export const ExamSignatureDisplay=()=>null;`,
  '@/lib/hooks/use-pdf-viewer': `import {useState} from 'react';export function usePDFViewer(){const [doc,setDoc]=useState(null);return {isOpen:!!doc,pdfBlob:doc?.blob,fileName:doc?.fileName,title:doc?.title,closePDF:()=>setDoc(null),runPDFJob:async(options,generate)=>{const blob=await generate({updateProgress:()=>{},signal:new AbortController().signal});window.generated.push({title:options.title,size:blob.size,bytes:Array.from(new Uint8Array(await blob.arrayBuffer()))});setDoc({...options,blob});return blob;},openPDFFromBlob:()=>{},openPDF:async()=>{}};}`,
  '@/components/pdf/pdf-viewer': `import React from 'react';import {Dialog,DialogContent,DialogTitle} from '@/components/ui/dialog';export const PDFViewer=p=><Dialog open={p.isOpen} onOpenChange={open=>{if(!open)p.onClose()}}><DialogContent><DialogTitle>{p.title}</DialogTitle><button onClick={p.onClose}>Close preview</button></DialogContent></Dialog>;`,
  '@react-pdf/renderer': `export const PDFDownloadLink=()=>null;export const pdf=()=>({toBlob:async()=>new Blob(['pdf'])});`,
};
// Keep the primary/nursery assessment generators real; stub other renderers at their boundary.
const source = fs.readFileSync(path.join(root, 'src/app/exams/[examId]/view-results/ViewResultsView.tsx'), 'utf8');
const ast = ts.createSourceFile('view.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
for (const node of ast.statements) {
  if (!ts.isImportDeclaration(node)) continue;
  const id = node.moduleSpecifier.text;
  if (!id.startsWith('@/components/exam/') || !/PDF/.test(id) || /\/(ExamResultsPDF|NurseryAssessmentPDF)$/.test(id)) continue;
  const names = node.importClause?.namedBindings?.elements?.filter(e => !e.isTypeOnly).map(e => e.propertyName?.text || e.name.text) || [];
  stubs[id] = names.map(name => `export const ${name}=(...args)=>{window.templates.push({name:'${name}',data:args[0]});return Promise.resolve(new Blob(['report']));};`).join('\n') + (node.importClause?.name ? '\nexport default function Report(){return null;}' : '');
}
const fixture = `import React from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import View from '@/app/exams/[examId]/view-results/ViewResultsView';import {BlankAssessmentPrintButton} from '@/components/exam/blank-assessment-print-button';import {exam,pupils,subjects,scale} from './data';
window.navigations=[];window.generated=[];window.templates=[];window.toasts=[];const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
function Fixture(){const[open,setOpen]=React.useState(false);if(new URLSearchParams(location.search).get('view')==='1')return <QueryClientProvider client={client}><main className="px-3 md:px-6"><View/></main></QueryClientProvider>;return <QueryClientProvider client={client}><main><h1>Exam Management</h1><button onClick={()=>setOpen(true)}>Print exam</button><BlankAssessmentPrintButton exam={exam} pupils={pupils.slice(0,1)} subjects={subjects} gradingScale={scale} className="P.7 East" isNursery={false}/>{open&&<View printTarget={{examId:exam.id,classId:exam.classId,onClose:()=>setOpen(false)}}/>}</main></QueryClientProvider>};createRoot(document.getElementById('app')).render(<Fixture/>);`;
async function main() {
  const pdfText = async bytes => {
    const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');const task=getDocument({data:Uint8Array.from(bytes),useSystemFonts:true});const pdf=await task.promise;let text='';
    for(let page=1;page<=pdf.numPages;page++){const content=await (await pdf.getPage(page)).getTextContent();text+=content.items.map(i=>i.str||'').join(' ');}
    await task.destroy();return text;
  };
  await require('esbuild').build({absWorkingDir:root,stdin:{contents:fixture,loader:'tsx',resolveDir:out},bundle:true,jsx:'automatic',platform:'browser',outfile:path.join(out,'fixture.js'),alias:{'@':path.join(root,'src')},define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},plugins:[{name:'boundaries',setup(build){build.onResolve({filter:/.*/},args=>Object.hasOwn(stubs,args.path)?{path:args.path,namespace:'fixture-stub'}:undefined);build.onLoad({filter:/.*/,namespace:'fixture-stub'},args=>({contents:stubs[args.path],loader:'tsx',resolveDir:root}));}}]});
  const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.join(root,'tailwind.config.ts'),'utf8'),{compilerOptions:{module:1}}).outputText)(require,mod,mod.exports);
  const css=['globals.css','theme.css','brand-theme.css'].map(f=>fs.readFileSync(path.join(root,'src/app',f),'utf8')).join('\n').replace(/^@import[^;]+;/,'');
  const built=await require('postcss')([require('tailwindcss')({...mod.exports.default,content:[path.join(root,'src/app/exams/[[]examId]/view-results/ViewResultsView.tsx'),path.join(root,'src/components/exam/report-creation-dialog.tsx'),path.join(root,'src/components/exam/promotion-ranking-options.tsx'),path.join(root,'src/components/common/glass-page-top-bar.tsx'),path.join(root,'src/components/ui/glass-navigation-surface.tsx'),path.join(root,'src/components/ui/{button,input,dialog}.tsx'),{raw:fixture,extension:'tsx'}]})]).process(css,{from:path.join(root,'src/app/globals.css')});fs.writeFileSync(path.join(out,'fixture.css'),built.css);
  const server=http.createServer((req,res)=>{if(['/fixture.js','/fixture.css'].includes(req.url)){res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync(path.join(out,req.url.slice(1))));}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="app"></div><script src="/fixture.js"></script></body></html>');}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try {
    browser=await chromium.launch({headless:true,channel:'msedge'});const page=await browser.newPage(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.message);});
    const widths=process.env.EXAM_PRINT_WIDTHS?process.env.EXAM_PRINT_WIDTHS.split(',').map(Number):[320,375,768,1366];
    for(const width of widths)for(const dark of [false,true]){
      await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:'+server.address().port+'/exams');await page.evaluate(dark=>document.documentElement.classList.toggle('dark',dark),dark);
      await page.getByRole('button',{name:'Print exam',exact:true}).click();await page.getByRole('button',{name:/East/}).click();
      await page.getByRole('heading',{name:'Create pupil reports'}).waitFor();assert.equal(await page.getByRole('heading',{name:'Exam Management',exact:true,includeHidden:true}).count(),1);
      await page.getByRole('radio',{name:'Assessment report',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();
      await page.getByRole('heading',{name:'Configure assessment report'}).waitFor();await page.getByRole('dialog').getByText('P.7 E · 1 pupil',{exact:true}).waitFor();await page.screenshot({path:path.join(out,width+'-'+(dark?'dark':'light')+'.png'),fullPage:true});
      const bounds=await page.getByRole('dialog').boundingBox();assert.ok(bounds.x>=0&&bounds.width<=width);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.getByRole('button',{name:'Create PDF',exact:true}).click();await page.getByRole('heading',{name:'Exam Results',exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>window.generated.length),1);assert.deepEqual(await page.evaluate(()=>window.navigations),[]);assert.ok(page.url().endsWith('/exams'));
      const bytes=await page.evaluate(()=>window.generated[0].bytes);fs.writeFileSync(path.join(out,'management-results.pdf'),Buffer.from(bytes));
      if(width===320&&!dark){const text=await pdfText(bytes);assert.ok(text.includes('ALICE TEST')&&!text.includes('BOB TEST'));assert.ok(text.includes('P.7 E'));}
      await page.getByRole('button',{name:'Close preview'}).click();await page.getByRole('button',{name:'Close',exact:true}).first().click();
      await page.getByRole('button',{name:'Print',exact:true}).click();await page.getByRole('heading',{name:'Blank assessment',exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>window.generated.length),2);fs.writeFileSync(path.join(out,'record-blank.pdf'),Buffer.from(await page.evaluate(()=>window.generated[1].bytes)));
      if(width===320&&!dark){const text=await pdfText(await page.evaluate(()=>window.generated[1].bytes));assert.ok(text.includes('ALICE TEST')&&!text.includes('BOB TEST'));assert.ok(!text.includes('PIN_A')&&text.includes('P.7 East'));}
      assert.deepEqual(await page.evaluate(()=>window.navigations),[]);
    }
    for(const state of ['loading','loadError','noResults']){
      await page.goto('http://127.0.0.1:'+server.address().port+'/exams');await page.evaluate(state=>window[state]=true,state);await page.getByRole('button',{name:'Print exam',exact:true}).click();await page.getByRole('heading',{name:'Print exam reports'}).waitFor();
      if(state==='loading')await page.getByText('Loading print data…',{exact:true}).waitFor();if(state==='loadError')await page.getByRole('alert').waitFor();if(state==='noResults')await page.getByText(/No pupil results are available/).waitFor();
      await page.getByRole('button',{name:'Close',exact:true}).first().click();assert.deepEqual(await page.evaluate(()=>window.navigations),[]);
    }
    for(const report of ['Full report','Bespoke report']){
      await page.goto('http://127.0.0.1:'+server.address().port+'/exams');await page.getByRole('button',{name:'Print exam',exact:true}).click();await page.getByRole('button',{name:/All streams/}).click();
      await page.getByRole('radio',{name:report,exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('heading',{name:'Choose a full-report format'}).waitFor();assert.deepEqual(await page.evaluate(()=>window.navigations),[]);
    }

    for(const view of [false,true])for(const term of ['TERM 2','TERM 3'])for(const report of ['Full report','Bespoke report']){
      await page.setViewportSize({width:report==='Bespoke report'?375:1366,height:900});
      await page.goto('http://127.0.0.1:'+server.address().port+'/exams?term='+encodeURIComponent(term)+(view?'&view=1':''));
      if(view){await page.getByRole('button',{name:/All streams/}).click();await page.locator('button[title="Print"]').filter({visible:true}).click();}
      else{await page.getByRole('button',{name:'Print exam',exact:true}).click();await page.getByRole('button',{name:/All streams/}).click();}
      console.log('Promotion flow:',{view,term,report});await page.getByRole('heading',{name:'Create pupil reports'}).waitFor();assert.equal(await page.getByRole('heading',{name:'Term 3 Promotion Ranking',exact:true}).count(),0);
      await page.getByRole('radio',{name:report,exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('radio',{name:'Grading scale',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('heading',{name:'Configure full report'}).waitFor();
      const ranking=page.getByRole('checkbox',{name:'Term 3 promotion ranking',exact:true});assert.equal(await ranking.count(),term==='TERM 3'?1:0);
      if(term==='TERM 3'){assert.equal(await ranking.isChecked(),false);await ranking.check();await page.getByLabel('Promoted max',{exact:true}).fill('12');await page.getByLabel('Promoted on probation min',{exact:true}).fill('13');await page.screenshot({path:path.join(out,(view?'view':'management')+'-'+report.replaceAll(' ','-')+'-promotion.png'),fullPage:true});}
      await page.getByRole('button',{name:'Create PDF',exact:true}).click();await page.waitForFunction(()=>window.templates.length>0);
      const call=await page.evaluate(()=>window.templates.at(-1));assert.equal(call.name,report==='Full report'?'generateTransBatchReportPDF':'generateFullReport2PDF');assert.equal(call.data.reportConfig.promoted.show,term==='TERM 3');assert.equal(!!call.data.promotionRankingConfig,term==='TERM 3');if(term==='TERM 3')assert.equal(call.data.promotionRankingConfig.ranges.promoted.max,12);
    }
    for(const report of ['Assessment report','Mini report']){
      await page.goto('http://127.0.0.1:'+server.address().port+'/exams?term=TERM%203');await page.getByRole('button',{name:'Print exam',exact:true}).click();await page.getByRole('button',{name:/All streams/}).click();await page.getByRole('radio',{name:report,exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();
      if(report==='Assessment report')await page.getByRole('heading',{name:'Configure assessment report'}).waitFor();else await page.waitForFunction(()=>window.templates.length>0);
      assert.equal(await page.getByRole('checkbox',{name:'Term 3 promotion ranking',exact:true}).count(),0);
    }
    assert.deepEqual(errors,[]);console.log('Exam printing browser: '+widths.length*2+' responsive/light-dark cases, scoped result and blank PDFs, full-report choices, loading/error/empty states passed.');
  } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
