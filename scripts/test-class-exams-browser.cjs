// Actual class-details page and exams card; synthetic hook data, no database access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const loadConfig = require('tailwindcss/loadConfig');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(os.tmpdir(), 'trinity-class-exams-browser');
fs.mkdirSync(output, {recursive:true});
const hooks = `
import {useEffect,useReducer} from 'react';
const year={id:'2026',name:'2026',isActive:true,terms:[
 {id:'t1',name:'Term 1',startDate:'2026-01-01',endDate:'2026-06-30'},
 {id:'t2',name:'Term 2',startDate:'2026-07-01',endDate:'2026-12-31'}]};
const oldYear={id:'2025',name:'2025',terms:[{id:'old-term',name:'Term 3',startDate:'2025-09-01',endDate:'2025-12-31'}]};
const pupils=[{id:'pupil-1',firstName:'Grace',lastName:'Nakiyingi',classId:'class-1',status:'Active',gender:'Female',section:'Day',admissionNumber:'TEST/001',dateOfBirth:'2015-01-01'}];
const exams=[
 {id:'4MullFSBVOKgzFUndxTe',name:'End of Term Examination',classId:'class-1',academicYearId:'2026',termId:'t2',startDate:'2026-10-13',endDate:'2026-10-16',status:'Graded'},
 {id:'long-name',name:'Primary Four Continuous Assessment: English, Mathematics and Integrated Science',classId:'class-1',academicYearId:'2026',termId:'t2',startDate:'2026-10-02',status:'Completed'},
 {id:'no-date',name:'Midterm Assessment',classId:'class-1',academicYearId:'2026',termId:'t2',startDate:'invalid',status:'Scheduled'},
 {id:'term-one',name:'Term One Examination',classId:'class-1',academicYearId:'2026',termId:'t1',startDate:'2026-03-10',status:'Graded'},
 {id:'old',name:'Previous Year Examination',classId:'class-1',academicYearId:'2025',termId:'old-term',startDate:'2025-11-10',status:'Graded'}];
window.examFixture={mode:'ready',retries:0,enabled:false};
export const useClassDetail=()=>({data:{id:'class-1',name:'Primary Four',code:'P.4',level:'Upper Primary',order:4,subjectAssignments:[],streams:[]},isLoading:false});
export const usePupils=()=>({data:pupils,isLoading:false});
export const usePupilsByStatus=()=>({data:[]});
export const useActivePupilsByClass=usePupils;
const photos=new Map();
export const usePupilPhotos=()=>({data:photos,isLoading:false,isFetching:false});
export const useAcademicYears=()=>({data:[year,oldYear]});
export const useActiveAcademicYear=()=>({data:year});
export const useTerms=()=>({data:[year,oldYear].flatMap(y=>y.terms.map(t=>({...t,academicYearId:y.id})))});
export const useStaff=()=>({data:[]});
export const useSubjects=()=>({data:[]});
export const useSubjectsByClass=()=>({data:[{id:'english',name:'English',teacherId:''}],isLoading:false});
export const useUpdateClass=()=>({mutateAsync:async()=>{}});
export function useExamsByClass(id,options){
 const [,update]=useReducer(n=>n+1,0);
 useEffect(()=>{window.addEventListener('fixture-change',update);return()=>window.removeEventListener('fixture-change',update);},[]);
 window.examFixture.enabled=options.enabled;
 return {data:options.enabled && window.examFixture.mode==='ready'?exams:[],
 isLoading:options.enabled && window.examFixture.mode==='loading',
 error:window.examFixture.mode==='error'?new Error('Synthetic read failed'):null,
 refetch:()=>{window.examFixture.retries++;window.examFixture.mode='ready';window.dispatchEvent(new Event('fixture-change'));}};
}
`;
const fixtureModules = {
  hooks,
  navigation: `export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{},back:()=>{}});`,
  link: `import React from 'react'; export default React.forwardRef(({prefetch,...props},ref)=><a ref={ref} {...props}/>);`,
  image: `import React from 'react'; export default React.forwardRef(({fill,...props},ref)=><img ref={ref} {...props}/>);`,
  header: `import React from 'react';
    export const GlassPageTopBar=({title,actions})=><header className="flex flex-wrap items-center justify-between gap-4 p-6"><h1>{title}</h1>{actions}</header>;
    export const GlassActionDock=({children})=><div className="flex flex-wrap gap-2">{children}</div>;
    export const GlassActionButton=({label,icon,onClick})=><button type="button" className="rounded-lg border p-2" onClick={onClick}>{label}</button>;
    export const GlassPageSearchInput=()=>null;`,
  toast: `export const useToast=()=>({toast:()=>{}});`,
  requirements: `export const PupilRequirementsModal=()=>null;export const ClassRequirementsOverviewModal=()=>null;`,
};

async function run() {
  const built=await esbuild.build({absWorkingDir:root,stdin:{contents:`
    import React from 'react';import {createRoot} from 'react-dom/client';
    import Page from './src/app/class-detail/page';
    createRoot(document.getElementById('root')).render(<Page/>);
  `,loader:'tsx',resolveDir:root},bundle:true,write:false,platform:'browser',jsx:'automatic',
  alias:{'@':path.join(root,'src')},plugins:[{name:'synthetic-data',setup(builder){
    builder.onResolve({filter:/^@\/lib\/hooks\/use-(class-detail|pupils|subjects|staff|classes|academic-years|terms|exams)$/},()=>({path:'hooks',namespace:'fixture'}));
    for(const [filter,name] of [[/^next\/navigation$/,'navigation'],[/^next\/link$/,'link'],[/^next\/image$/,'image'],
      [/^@\/components\/common\/glass-page-top-bar$/,'header'],[/^@\/hooks\/use-toast$/,'toast'],
      [/^@\/components\/class\/(pupil-requirements-modal|class-requirements-overview-modal)$/,'requirements']])
      builder.onResolve({filter},()=>({path:name,namespace:'fixture'}));
    builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:fixtureModules[args.path],loader:'tsx',resolveDir:root}));
  }}]});
  const contentFiles=['src/app/class-detail/page.tsx','src/components/class/class-exams-card.tsx',
    'src/components/ui/card.tsx','src/components/ui/button.tsx','src/components/ui/select.tsx','src/components/ui/badge.tsx','src/components/ui/label.tsx'];
  const config=loadConfig(path.join(root,'tailwind.config.ts'));
  config.content=contentFiles.map(file=>({raw:fs.readFileSync(path.join(root,file),'utf8'),extension:'tsx'}));
  config.safelist=[...(config.safelist || []),'dark'];
  const css=(await postcss([tailwind(config)]).process(
    fs.readFileSync(path.join(root,'src/app/globals.css'),'utf8').replace(/^@import.*$/gm,''),{from:path.join(root,'src/app/globals.css')})).css
    + fs.readFileSync(path.join(root,'src/app/theme.css'),'utf8')
    + fs.readFileSync(path.join(root,'src/app/brand-theme.css'),'utf8');
  const server=http.createServer((req,res)=>{
    if(req.url==='/fixture.js'){res.setHeader('Content-Type','text/javascript');return res.end(built.outputFiles[0].text);}
    if(req.url==='/fixture.css'){res.setHeader('Content-Type','text/css');return res.end(css);}
    res.setHeader('Content-Type','text/html');
    if(req.url.startsWith('/exams/'))return res.end('<h1>Results destination fixture</h1>');
    res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Class exams fixture</title><link rel="stylesheet" href="/fixture.css"><style>@media(min-width:1024px){#root{margin-left:220px}}body{font-family:Arial}</style><div id="root"></div><script src="/fixture.js"></script>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser,page;
  const checks=[];
  try{
    browser=await chromium.launch({channel:'msedge',headless:true});
    page=await browser.newPage({viewport:{width:1600,height:1100}});
    const errors=[];page.on('pageerror',error=>{errors.push(error.message);console.error(error.stack);});
    const url='http://127.0.0.1:'+server.address().port+'/?id=class-1';
    const region=()=>page.getByRole('region',{name:'Class exams'});
    const choose=async(label,option)=>{
      await region().getByRole('combobox',{name:label,exact:true}).click();
      await page.getByRole('option',{name:option,exact:true}).click();
    };
    await page.goto(url);
    await page.getByRole('button',{name:'Exams',exact:true}).waitFor();
    assert.equal(await region().count(),0);
    assert.equal(await page.evaluate(()=>window.examFixture.enabled),false);
    await page.getByRole('button',{name:'Exams',exact:true}).click();
    await region().waitFor();
    assert.equal(await region().getByRole('link').count(),3);
    assert.match(await region().innerText(),/Date not set/);
    const target=region().getByRole('link').filter({hasText:'End of Term Examination'});
    assert.equal(await target.getAttribute('href'),'/exams/4MullFSBVOKgzFUndxTe/view-results?classId=class-1');
    assert.match(await target.locator('p').innerText(),/13.*16 Oct 2026/);
    assert.doesNotMatch(await target.locator('p').innerText(),/Term/);
    assert.equal(await region().getByText('View results',{exact:true}).count(),0);
    assert.equal(await region().getByText('Graded',{exact:true}).count(),0);
    checks.push('Single-term exam entries show only their name and dates, without an action or status');
    await target.click();
    await page.waitForURL('**/exams/4MullFSBVOKgzFUndxTe/view-results?classId=class-1');
    checks.push('Exam click opens results with the correct exam and class context');
    await page.goto(url);await page.getByRole('button',{name:'Exams',exact:true}).click();
    checks.push('Exam loading remains on demand');
    await choose('Academic year','All academic years');
    assert.equal(await region().getByRole('link').count(),5);
    assert.match(await region().getByRole('link').first().locator('p').innerText(),/Term 2/);
    checks.push('All-terms view adds the term alongside the dates');
    await choose('Academic year','2025');
    assert.equal(await region().getByRole('link').count(),1);
    await choose('Academic year','2026 (Active)');
    assert.equal(await region().getByRole('link').count(),4);
    await choose('Term','Term 1');
    assert.equal(await region().getByRole('link').count(),1);
    assert.doesNotMatch(await region().getByRole('link').first().locator('p').innerText(),/Term/);
    await choose('Term','All terms');
    assert.equal(await region().getByRole('link').count(),4);
    checks.push('All years, all terms and year changes work without a stale term selection');
    const widthBefore=(await region().boundingBox()).width;
    await page.getByRole('button',{name:'Subjects',exact:true}).click();
    assert.equal((await region().boundingBox()).width,widthBefore);
    checks.push('Subjects below exams do not change the exam column width');
    for(const width of [1600,1280,768,390]){
      await page.setViewportSize({width,height:1100});
      let lightBackground;
      for(const dark of [false,true]){
        await page.evaluate(d=>document.documentElement.classList.toggle('dark',d),dark);
        const background=await region().evaluate(el=>getComputedStyle(el).backgroundColor);
        if(dark) assert.notEqual(background,lightBackground,'Dark mode must render its actual surface palette');
        else lightBackground=background;
        const box=await region().boundingBox();
        const pupilsBox=await page.getByRole('region',{name:'Class pupils'}).boundingBox();
        if(width>=1024){
          assert.ok(box.width>=320,'Exam column must remain wide enough for readable entries');
          assert.ok(pupilsBox.x>=box.x+box.width,'Pupils must sit beside exams on desktop');
          assert.ok(Math.abs(pupilsBox.y-box.y)<4,'Both columns must start at the same height');
        }else{
          assert.ok(pupilsBox.y>=box.y+box.height,'Mobile uses one column');
        }
        const links=region().getByRole('link');
        const sizes=await links.evaluateAll(nodes=>nodes.map(n=>{
          const r=n.getBoundingClientRect(),title=n.querySelector('h3');
          return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,font:parseFloat(getComputedStyle(title).fontSize)};
        }));
        assert.ok(sizes.every(item=>item.left>=0 && item.right<=width && item.font>=16));
        assert.ok(sizes.every((item,index)=>index===0 || (Math.abs(item.left-sizes[index-1].left)<1 && item.top>=sizes[index-1].bottom)),
          'Exam cards must always form one vertical list');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
        await region().screenshot({path:path.join(output,'exams-'+width+'-'+(dark?'dark':'light')+'.png')});
        if(width===1600 || width===390) await page.screenshot({path:path.join(output,'layout-'+width+'-'+(dark?'dark':'light')+'.png'),fullPage:true});
        checks.push(width+'px '+(dark?'dark':'light')+': vertical exam list, responsive pupil placement, readable titles, no horizontal overflow');
      }
    }
    await page.evaluate(()=>{window.examFixture.mode='error';window.dispatchEvent(new Event('fixture-change'));});
    await region().getByRole('alert').waitFor();
    assert.equal(await region().getByRole('link').count(),0);
    await region().getByRole('button',{name:'Try again'}).click();
    assert.equal(await region().getByRole('link').count(),4);
    assert.equal(await page.evaluate(()=>window.examFixture.retries),1);
    checks.push('A failed read shows an error and can recover');
    await page.evaluate(()=>{window.examFixture.mode='loading';window.dispatchEvent(new Event('fixture-change'));});
    await region().getByText('Loading exams…').waitFor();
    checks.push('Loading is distinct from no matching exams');
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({checks},null,2));
    console.log('CLASS_EXAMS_BROWSER_OK',JSON.stringify({checks:checks.length,output}));
  }catch(error){
    if(page){console.error(await page.locator('body').innerText());await page.screenshot({path:path.join(output,'failure.png'),fullPage:true});}
    throw error;
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
