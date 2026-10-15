/* Real exam recorder and selectors; synthetic, deliberately stale labels. */
const assert = require('node:assert/strict'), path = require('node:path'), http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const mocks = {
  'next/navigation': `const router={push(){},replace(url){history.replaceState({},'',url);window.rerender()}};export const useRouter=()=>router,useParams=()=>({examId:'pre-ple'}),useSearchParams=()=>new URLSearchParams(location.search);`,
  '@/lib/hooks/use-exams': `export const useExams=()=>({data:window.exams}),useExam=()=>({data:window.exams[0]}),useExamResultByExamId=()=>({data:window.savedResult}),useUpdateExamResult=()=>({mutateAsync:async args=>{window.saves.push(args)}});`,
  '@/lib/hooks/use-pupils': 'export const usePupils=()=>({data:window.pupils});',
  '@/lib/hooks/use-classes': 'export const useClasses=()=>({data:window.classes});',
  '@/lib/hooks/use-exam-result-lease': 'export const useExamResultLease=()=>({canSave:true,canOverride:false,status:"owned",holder:null,ensureLease:async()=>({token:"synthetic"})});',
  '@/lib/hooks/use-push-subscribe': 'export const usePushSubscribe=()=>({isSubscribed:false,isLoading:false});',
  '@/lib/contexts/auth-context': 'export const useAuth=()=>({user:{id:"admin",role:"Admin"}});',
  '@/lib/firebase': 'export const auth={currentUser:{uid:"admin"}};',
  '@/hooks/use-toast': 'const toast=()=>{};export const useToast=()=>({toast});',
  '@/components/exam/ExamSignatureDisplay': 'export const ExamSignatureDisplay=()=>null;',
  '@/components/common/glass-summary-bar': 'export const GlassSummaryBar=()=>null;',
  '@/components/common/glass-page-top-bar': `import React from'react';export const GlassPageTopBar=({title,leading,meta,actions,recordDetails})=><header><h1>{title}</h1><p>{recordDetails}</p>{leading}{meta}{actions}</header>;export const GlassActionDock=({children})=><div>{children}</div>;export const GlassActionButton=({label,icon,tone,tooltip,...props})=><button {...props}>{label}</button>;export const GlassPageSearchInput=()=>null;`,
};

async function run() {
  const built = await require('esbuild').build({
    stdin: { resolveDir: root, loader: 'tsx', contents: `
      import React,{useState}from'react';import{createRoot}from'react-dom/client';
      import RecordResultsView from'./src/app/exams/[examId]/record-results/RecordResultsView';
      window.exams=[{id:'pre-ple',name:'PRE-PLE - SIPRO - SET 1',classId:'p7',academicYearId:'2026',termId:'t3',examNature:'Set based',startDate:'2026-10-01',endDate:'2026-10-02',maxMarks:100,streamScope:{streams:[{id:'angels',name:'Stars',code:'S'},{id:'stars',name:'Angels',code:'A'}]}}];
      window.classes=[{id:'p7',name:'Primary Seven',code:'P.7',streams:[{id:'angels',name:'Stars',code:'S'},{id:'stars',name:'Angels',code:'A'}]}];
      window.pupils=[{id:'p1',classId:'p7',firstName:'Ada',lastName:'Example',streamId:'stars',streamName:'Stars',streamAcademicYearId:'2026'},{id:'p2',classId:'p7',firstName:'Ben',lastName:'Example',streamId:'angels',streamName:'Angels',streamAcademicYearId:'2026'}];
      window.savedResult={id:'result1',examId:'pre-ple',academicYearId:'2026',classId:'p7',classSnapshot:{classId:'p7',name:'Primary Seven',code:'P.7'},pupilSnapshots:[{pupilId:'p1',name:'Ada Example',admissionNumber:'TEST1',classNameAtExam:'Primary Seven Stars',classCodeAtExam:'P.7 S',streamIdAtExam:'angels',streamNameAtExam:'Stars',streamCodeAtExam:'S'},{pupilId:'p2',name:'Ben Example',admissionNumber:'TEST2',classNameAtExam:'Primary Seven Angels',classCodeAtExam:'P.7 A',streamIdAtExam:'stars',streamNameAtExam:'Angels',streamCodeAtExam:'A'}],subjectSnapshots:[{subjectId:'math',name:'Mathematics',code:'MATH',maxMarks:100,passingMarks:50}],results:{p1:{math:{marks:61,status:'present'}},p2:{math:{marks:72,status:'present'}}}};
      window.before=JSON.stringify(window.savedResult);window.saves=[];
      function App(){const[tick,setTick]=useState(0);window.rerender=()=>setTick(x=>x+1);return <RecordResultsView/>}
      createRoot(document.getElementById('root')).render(<App/>);
    ` },
    bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false,
    alias: { '@': path.join(root, 'src') }, define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'boundaries', setup(build) {
      build.onResolve({ filter: /.*/ }, args => mocks[args.path] ? { path: args.path, namespace: 'mock' } : undefined);
      build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'tsx', resolveDir: root }));
    } }],
  });
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', req.url === '/app.js' ? 'text/javascript' : 'text/html');
    res.end(req.url === '/app.js' ? built.outputFiles[0].text : '<div id="root"></div><script src="/app.js"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port + '/?classId=p7&streamId=angels');
    const selector = page.getByRole('combobox', { name: 'Choose stream pupils to record' });
    await selector.waitFor();
    assert.match(await selector.innerText(), /Stars/);
    const table = page.getByRole('region', { name: 'Record results table', exact: true });
    await table.getByText('Example Ada', { exact: true }).waitFor();
    const marks = table.getByRole('spinbutton');
    await marks.fill('62');
    await page.evaluate(() => {
      classes=[{...classes[0],streams:[{id:'angels',name:'Angels',code:'A'},{id:'stars',name:'Stars',code:'S'}]}];
      rerender();
    });
    await page.waitForFunction(() => document.querySelector('[aria-label="Choose stream pupils to record"]').textContent.includes('Angels'));
    assert.equal(await marks.inputValue(), '62', 'Label refresh preserves unsaved marks');
    assert.match(await table.innerText(), /TEST1 · P\.7 A/);
    assert.doesNotMatch(await table.innerText(), /Example Ben/);
    await selector.click();
    await page.getByRole('option', { name: /Stars/ }).click();
    await table.getByText('Example Ben', { exact: true }).waitFor();
    assert.equal(await table.getByRole('spinbutton').inputValue(), '72');
    assert.match(await table.innerText(), /TEST2 · P\.7 S/);
    assert.doesNotMatch(await table.innerText(), /Example Ada/);
    assert.equal(await page.evaluate(() => JSON.stringify(savedResult)), await page.evaluate(() => before));
    await selector.click();
    await page.getByRole('option', { name: /Angels/ }).click();
    await table.getByText('Example Ada', { exact: true }).waitFor();
    assert.equal(await table.getByRole('spinbutton').inputValue(), '62');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.waitForFunction(() => saves.length === 1);
    const data = await page.evaluate(() => saves[0].data);
    assert.equal(data.results.p1.math.marks, 62);
    assert.equal(data.results.p2.math.marks, 72);
    assert.equal('pupilSnapshots' in data, false, 'Saving marks does not rewrite historical snapshots');
    assert.deepEqual(errors, []);
    console.log('EXAM_STREAM_LABELS_BROWSER_OK: canonical names refresh in the actual recorder; recorded groups, unsaved marks, other-stream marks and raw snapshots are preserved.');
  } finally {
    await browser.close(); await new Promise(resolve => server.close(resolve));
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
