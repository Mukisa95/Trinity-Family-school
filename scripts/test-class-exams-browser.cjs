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
import {useEffect,useMemo,useReducer} from 'react';
import {selectSubjectsByAssignments} from '@/lib/selectors/subject-selectors';
const year={id:'2026',name:'2026',isActive:true,terms:[
 {id:'t1',name:'Term 1',startDate:'2026-01-01',endDate:'2026-06-30'},
 {id:'t2',name:'Term 2',startDate:'2026-07-01',endDate:'2026-12-31'}]};
const oldYear={id:'2025',name:'2025',terms:[{id:'old-term',name:'Term 3',startDate:'2025-09-01',endDate:'2025-12-31'}]};
const three=new URLSearchParams(location.search).get('three')==='1';
const pupils=[
 {id:'pupil-1',firstName:'Grace',lastName:'Nakiyingi',classId:'class-1',status:'Active',gender:'Female',section:'Day',admissionNumber:'TEST/001',dateOfBirth:'2015-01-01',streamId:'west',streamClassId:'class-1',streamAcademicYearId:'2026'},
 {id:'pupil-2',firstName:'Ada',lastName:'Test',classId:'class-1',status:'Active',gender:'Female',section:'Day',admissionNumber:'TEST/002',dateOfBirth:'2016-01-01',streamId:'east',streamClassId:'class-1',streamAcademicYearId:'2026'},
 {id:'pupil-3',firstName:'Ben',lastName:'Sample',classId:'class-1',status:'Active',gender:'Male',section:'Boarding',admissionNumber:'TEST/003',dateOfBirth:'2015-01-01',streamId:three?'north':'west',streamClassId:'class-1',streamAcademicYearId:'2026'}];
const definitions=[{id:'east',name:'East',code:'E'},{id:'west',name:'West',code:'W'},...(three?[{id:'north',name:'North',code:'N'}]:[])];
const subjects=Array.from({length:10},(_,i)=>({id:'subject-'+i,name:'Subject '+(i+1)}));
const staff=[{id:'teacher-1',firstName:'Alice',lastName:'Teacher',department:['Teaching'],role:['TEACHER']},{id:'teacher-2',firstName:'Bob',lastName:'Teacher',department:['Teaching'],role:['TEACHER']}];
const schoolClass={id:'class-1',name:'Primary Four',code:'P.4',level:'Upper Primary',order:4,subjectAssignments:[...subjects.map((subject,i)=>({subjectId:subject.id,...(i===0?{teacherId:'teacher-1'}:{teacherIds:[]})})),{subjectId:'unavailable-subject',teacherIds:['teacher-1']}],streams:definitions,
 streamConfigurations:[{academicYearId:'2026',activeStreamIds:definitions.map(s=>s.id),enabled:true,version:4}]};
window.streamFixture={empty:new URLSearchParams(location.search).get('late')==='1'};
window.streamFixture.pupils=pupils;
window.classFixture={schoolClass,updates:[],failSave:false};
function useFixtureChanges(){const [version,update]=useReducer(n=>n+1,0);useEffect(()=>{window.addEventListener('fixture-change',update);return()=>window.removeEventListener('fixture-change',update);},[]);return version;}

const exams=[
 {id:'4MullFSBVOKgzFUndxTe',name:'End of Term Examination',classId:'class-1',academicYearId:'2026',termId:'t2',startDate:'2026-10-13',endDate:'2026-10-16',status:'Graded'},
 {id:'long-name',name:'Primary Four Continuous Assessment: English, Mathematics and Integrated Science',classId:'class-1',academicYearId:'2026',termId:'t2',startDate:'2026-10-02',status:'Completed'},
 {id:'no-date',name:'Midterm Assessment',classId:'class-1',academicYearId:'2026',termId:'t2',startDate:'invalid',status:'Scheduled'},
 {id:'term-one',name:'Term One Examination',classId:'class-1',academicYearId:'2026',termId:'t1',startDate:'2026-03-10',status:'Graded'},
 {id:'old',name:'Previous Year Examination',classId:'class-1',academicYearId:'2025',termId:'old-term',startDate:'2025-11-10',status:'Graded'}];
window.examFixture={mode:'ready',retries:0,enabled:false};
export const useClassDetail=()=>{useFixtureChanges();return {data:schoolClass,isLoading:false};};
export const usePupils=()=>{const version=useFixtureChanges();const data=useMemo(()=>window.streamFixture.empty?[]:pupils.map(p=>({...p})),[version]);return {data,isLoading:false};};
export const applyPupilChangesToQueryCaches=(_client,changes)=>{window.savedPupilChanges=changes;};
export const classesKeys={lists:()=>['classes','list']};
const client={setQueriesData:(_key,fn)=>{window.savedClass=fn([schoolClass]);}};
export const useQueryClient=()=>client;
export const auth={currentUser:{getIdToken:async()=>'fixture-only-token'}};
export const usePupilsByStatus=()=>({data:[]});
export const useActivePupilsByClass=usePupils;
const photos=new Map();
export const usePupilPhotos=()=>({data:photos,isLoading:false,isFetching:false});
export const useAcademicYears=()=>({data:[year,oldYear]});
export const useActiveAcademicYear=()=>({data:year});
export const useTerms=()=>({data:[year,oldYear].flatMap(y=>y.terms.map(t=>({...t,academicYearId:y.id})))});
export const useStaff=()=>({data:staff});
export const useSubjects=()=>({data:subjects});
export const useSubjectsByClass=()=>{useFixtureChanges();return {data:selectSubjectsByAssignments(subjects,schoolClass.subjectAssignments),isLoading:false};};
export const useUpdateClass=()=>({mutateAsync:async patch=>{window.classFixture.updates.push(patch);if(window.classFixture.failSave)throw new Error('Synthetic save failed');Object.assign(schoolClass,patch.data);window.dispatchEvent(new Event('fixture-change'));}});
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
  navigation: `export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:path=>{window.lastNavigation=path;},back:()=>{}});export const useParams=()=>({classId:'class-1'});`,
  link: `import React from 'react'; export default React.forwardRef(({prefetch,...props},ref)=><a ref={ref} {...props}/>);`,
  image: `import React from 'react'; export default React.forwardRef(({fill,...props},ref)=><img ref={ref} {...props}/>);`,
  header: `import React from 'react';
    export const GlassPageTopBar=({title,actions,meta,className=''})=><header className={'sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 bg-background p-6 '+className}><h1>{title}</h1>{meta}{actions}</header>;
    export const GlassActionDock=({children})=><div className="flex flex-wrap gap-2">{children}</div>;
    export const GlassActionButton=React.forwardRef(({label,icon,tone,badge,href,...props},ref)=><button ref={ref} type="button" className="rounded-lg border p-2" {...props}>{label}</button>);
    export const GlassPageSearchInput=()=>null;`,
  toast: `export const useToast=()=>({toast:()=>{}});`,
  requirements: `export const PupilRequirementsModal=()=>null;export const ClassRequirementsOverviewModal=()=>null;`,
};

async function run() {
  const built=await esbuild.build({absWorkingDir:root,stdin:{contents:`
    import React from 'react';import {createRoot} from 'react-dom/client';
    import Page from './src/app/class-detail/page';
    import Streams from './src/app/classes/[classId]/streams/page';
    createRoot(document.getElementById('root')).render(<React.StrictMode>{location.pathname.includes('/streams')?<Streams/>:<Page/>}</React.StrictMode>);
  `,loader:'tsx',resolveDir:root},bundle:true,write:false,platform:'browser',jsx:'automatic',
  alias:{'@':path.join(root,'src')},plugins:[{name:'synthetic-data',setup(builder){
    builder.onResolve({filter:/^(@tanstack\/react-query|@\/lib\/firebase)$/},()=>({path:'hooks',namespace:'fixture'}));
    builder.onResolve({filter:/^@\/lib\/hooks\/use-(class-detail|pupils|subjects|staff|classes|academic-years|terms|exams)$/},()=>({path:'hooks',namespace:'fixture'}));
    for(const [filter,name] of [[/^next\/navigation$/,'navigation'],[/^next\/link$/,'link'],[/^next\/image$/,'image'],
      [/^@\/components\/common\/glass-page-top-bar$/,'header'],[/^@\/hooks\/use-toast$/,'toast'],
      [/^@\/components\/class\/(pupil-requirements-modal|class-requirements-overview-modal)$/,'requirements']])
      builder.onResolve({filter},()=>({path:name,namespace:'fixture'}));
    builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:fixtureModules[args.path],loader:'tsx',resolveDir:root}));
  }}]});
  const contentFiles=['src/app/class-detail/page.tsx','src/components/class/class-exams-card.tsx',
    'src/components/class/class-subjects-card.tsx','src/components/class/subject-teacher-selector.tsx','src/components/ui/popover.tsx','src/components/ui/input.tsx',
    'src/components/ui/card.tsx','src/components/ui/button.tsx','src/components/ui/select.tsx','src/components/ui/badge.tsx','src/components/ui/label.tsx','src/components/ui/dropdown-menu.tsx','src/components/ui/checkbox.tsx','src/app/classes/[classId]/streams/page.tsx'];
  const config=loadConfig(path.join(root,'tailwind.config.ts'));
  config.content=contentFiles.map(file=>({raw:fs.readFileSync(path.join(root,file),'utf8'),extension:'tsx'}));
  config.safelist=[...(config.safelist || []),'dark'];
  const css=(await postcss([tailwind(config)]).process(
    fs.readFileSync(path.join(root,'src/app/globals.css'),'utf8').replace(/^@import.*$/gm,''),{from:path.join(root,'src/app/globals.css')})).css
    + fs.readFileSync(path.join(root,'src/app/theme.css'),'utf8')
    + fs.readFileSync(path.join(root,'src/app/brand-theme.css'),'utf8');
  const savedRequests=[];
  const server=http.createServer((req,res)=>{
    if(req.method==='PUT' && req.url.startsWith('/api/classes/')) {
      let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{savedRequests.push(JSON.parse(body));res.setHeader('Content-Type','application/json');res.end(JSON.stringify({version:5}));});return;
    }
    if(req.url==='/fixture.js'){res.setHeader('Content-Type','text/javascript');return res.end(built.outputFiles[0].text);}
    if(req.url==='/fixture.css'){res.setHeader('Content-Type','text/css');return res.end(css);}
    res.setHeader('Content-Type','text/html');
    if(req.url.startsWith('/exams/'))return res.end('<h1>Results destination fixture</h1>');
    res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Class exams fixture</title><link rel="stylesheet" href="/fixture.css"><style>@media(min-width:1024px){#root{margin-left:220px}}body{font-family:Arial}#root::after{content:"";display:block;height:800px}</style><div id="root"></div><script src="/fixture.js"></script>');
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
    assert.equal(await page.getByRole('button',{name:/Switch to (Tiles|List) View|^Tiles$|^List$|Open Stream Setup/}).count(),0);
    assert.equal(await page.getByText('Class Captain:',{exact:true}).count(),0);
    assert.equal(await page.getByText('Assistant Class Captain:',{exact:true}).count(),0);
    await page.evaluate(()=>{Object.assign(window.classFixture.schoolClass,{classCaptainId:'pupil-1',assistantClassCaptainId:'pupil-2'});window.dispatchEvent(new Event('fixture-change'));});
    await page.getByText('Class Captain:',{exact:true}).waitFor();
    await page.getByText('Assistant Class Captain:',{exact:true}).waitFor();
    await page.evaluate(()=>{window.classFixture.schoolClass.assistantClassCaptainId='';window.dispatchEvent(new Event('fixture-change'));});
    assert.equal(await page.getByText('Assistant Class Captain:',{exact:true}).count(),0);
    assert.equal(await page.getByText('Class Captain:',{exact:true}).count(),1);
    await page.evaluate(()=>{window.classFixture.schoolClass.classCaptainId='';window.dispatchEvent(new Event('fixture-change'));});
    checks.push('Unassigned leaders are hidden independently; assigned leaders remain visible');
    await page.getByRole('button',{name:'Edit Class',exact:true}).click();
    assert.equal(await page.getByRole('menuitem').count(),2);
    assert.equal(await page.getByRole('menuitem',{name:'Streams',exact:true}).getAttribute('href'),'/classes/class-1/streams');
    await page.getByRole('menuitem',{name:'Details',exact:true}).click();
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({state:'hidden'});
    checks.push('One Edit menu offers Details and Streams; the manual layout switch is removed');

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
    const subjectsCard=page.getByRole('region',{name:'Subjects and teachers',exact:true});
    const firstSubject=subjectsCard.getByRole('group',{name:'Subject 1',exact:true});
    const openTeachers=()=>firstSubject.getByRole('button',{name:'Manage subject teachers'}).click();
    const closeTeachers=()=>page.keyboard.press('Escape');
    await subjectsCard.getByRole('button',{name:'Edit subject teachers'}).click();
    await openTeachers();
    assert.equal(await page.getByRole('checkbox',{name:'Alice Teacher',exact:true}).isChecked(),true);
    await page.getByRole('checkbox',{name:'Bob Teacher',exact:true}).check();
    await page.getByRole('button',{name:'Move Bob Teacher up',exact:true}).click();
    await closeTeachers();
    await subjectsCard.screenshot({path:path.join(output,'subjects-edit-desktop.png')});
    await subjectsCard.getByRole('button',{name:'Save teachers',exact:true}).click();
    await subjectsCard.getByRole('button',{name:'Edit subject teachers'}).waitFor();
    const saved=await page.evaluate(()=>window.classFixture.updates.at(-1));
    assert.deepEqual(Object.keys(saved.data),['subjectAssignments']);
    assert.deepEqual(saved.data.subjectAssignments[0],{subjectId:'subject-0',teacherIds:['teacher-2','teacher-1']});
    assert.deepEqual(saved.data.subjectAssignments.at(-1),{subjectId:'unavailable-subject',teacherIds:['teacher-1']});
    assert.match(await firstSubject.innerText(),/Subject teacher: Bob Teacher; Assistant subject teacher 1: Alice Teacher/);
    checks.push('Subjects card saves primary and assistant teacher order while preserving other class fields and unavailable subjects');
    await subjectsCard.getByRole('button',{name:'Edit subject teachers'}).click();
    await openTeachers();
    await page.getByRole('checkbox',{name:'Alice Teacher',exact:true}).uncheck();
    await closeTeachers();
    await subjectsCard.getByRole('button',{name:'Cancel',exact:true}).click();
    assert.match(await firstSubject.innerText(),/Alice Teacher/);
    assert.equal(await page.evaluate(()=>window.classFixture.updates.length),1);
    checks.push('Cancel restores saved subject teachers without writing');
    await subjectsCard.getByRole('button',{name:'Edit subject teachers'}).click();
    await openTeachers();
    await page.getByRole('checkbox',{name:'Alice Teacher',exact:true}).uncheck();
    await page.getByRole('checkbox',{name:'Bob Teacher',exact:true}).uncheck();
    await closeTeachers();
    await page.evaluate(()=>{window.classFixture.failSave=true;});
    await subjectsCard.getByRole('button',{name:'Save teachers',exact:true}).click();
    await subjectsCard.getByRole('alert').waitFor();
    assert.match(await firstSubject.innerText(),/Not assigned/);
    await page.evaluate(()=>{window.classFixture.failSave=false;});
    await subjectsCard.getByRole('button',{name:'Save teachers',exact:true}).click();
    await subjectsCard.getByRole('button',{name:'Edit subject teachers'}).waitFor();
    assert.deepEqual(await page.evaluate(()=>window.classFixture.updates.at(-1).data.subjectAssignments[0]),{subjectId:'subject-0',teacherIds:[]});
    assert.match(await firstSubject.innerText(),/Not assigned/);
    checks.push('Failed subject saves retain drafts and retry; clearing teachers removes the legacy fallback');

    const pupilsPanel=page.getByRole('region',{name:'Class pupils'});
    const streamFilters=pupilsPanel.getByRole('group',{name:'Visible pupil streams'});
    assert.equal(await pupilsPanel.getByRole('table').first().getByRole('columnheader').count(),3);
    assert.match(await pupilsPanel.getByRole('table').first().locator('thead').innerText(),/Name.*Details.*Req/is);
    await streamFilters.getByRole('button',{name:/^West/}).click();
    assert.equal(await pupilsPanel.getByRole('link',{name:'Nakiyingi Grace'}).count(),0);
    assert.equal(await streamFilters.getByRole('button',{name:/^West/}).getAttribute('aria-pressed'),'false');
    await streamFilters.getByRole('button',{name:/^West/}).click();
    await streamFilters.getByRole('button',{name:/^East/}).click();
    await streamFilters.getByRole('button',{name:/^West/}).click();
    await pupilsPanel.getByText('All pupil streams are hidden.').waitFor();
    await pupilsPanel.getByRole('button',{name:'Show all streams'}).click();
    assert.equal(await pupilsPanel.getByRole('link',{name:'Nakiyingi Grace'}).count(),1);
    await pupilsPanel.getByRole('button',{name:'Sort pupil details'}).first().click();
    await page.getByRole('menuitem',{name:'Sort by age',exact:true}).click();
    checks.push('Three compact columns retain detail sorting and stream buttons hide/show pupils');
    await page.evaluate(()=>window.scrollTo(0,230));
    await page.waitForFunction(()=>window.scrollY>200);
    const pinned=await pupilsPanel.boundingBox();
    const header=await page.locator('.class-detail-topbar').boundingBox();
    assert.ok(Math.abs(pinned.y-header.height-12)<3,'Pupil panel must pin below the measured top bar');
    const pinnedTop=pinned.y;
    await page.evaluate(()=>window.scrollBy(0,80));
    await page.waitForFunction(()=>window.scrollY>300);
    assert.ok(Math.abs((await pupilsPanel.boundingBox()).y-pinnedTop)<3);
    await page.evaluate(()=>window.scrollTo(0,0));
    checks.push('Desktop page scroll leaves the pupils panel pinned beside exams and subjects');
    for(const width of [1600,1280,768,390]){
      await page.setViewportSize({width,height:1100});
      await page.evaluate(()=>window.scrollTo(0,0));
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
        assert.ok(sizes.every(item=>item.left>=0 && item.right<=width && item.font>=14), JSON.stringify({width,dark,sizes}));
        assert.ok(sizes.every((item,index)=>index===0 || (Math.abs(item.left-sizes[index-1].left)<1 && item.top>=sizes[index-1].bottom)),
          'Exam cards must always form one vertical list');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
        await region().screenshot({path:path.join(output,'exams-'+width+'-'+(dark?'dark':'light')+'.png')});
        if(width===1600 || width===390) await page.screenshot({path:path.join(output,'layout-'+width+'-'+(dark?'dark':'light')+'.png'),fullPage:true});
        checks.push(width+'px '+(dark?'dark':'light')+': vertical exam list, responsive pupil placement, readable titles, no horizontal overflow');
      }
    }
    for(const dark of [false,true]){
      await page.evaluate(d=>document.documentElement.classList.toggle('dark',d),dark);
      await subjectsCard.getByRole('button',{name:'Edit subject teachers'}).click();
      await openTeachers();
      const picker=page.getByRole('dialog');
      await picker.getByRole('textbox',{name:'Search subject teachers'}).fill('Bob');
      assert.equal(await picker.getByRole('checkbox').count(),1);
      const pickerBox=await picker.boundingBox();
      assert.ok(pickerBox.x>=0 && pickerBox.x+pickerBox.width<=390,'Teacher picker must fit mobile screens');
      await page.screenshot({path:path.join(output,'subjects-edit-mobile-'+(dark?'dark':'light')+'.png')});
      await closeTeachers();
      await subjectsCard.getByRole('button',{name:'Cancel',exact:true}).click();
      checks.push('390px '+(dark?'dark':'light')+': searchable teacher picker fits the screen and editing remains usable');
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
    const streamUrl=url.replace('/?id=class-1','/classes/class-1/streams');
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(streamUrl);
    const savedWest=()=>page.getByRole('checkbox',{name:/^Assign Nakiyingi Grace to West$/});
    await savedWest().waitFor();
    assert.equal(await savedWest().isChecked(),true,'Reopening must retain the saved distribution in Strict Mode');
    assert.equal(await page.getByRole('checkbox',{name:/^Assign Test Ada to West$/}).isChecked(),false);
    await savedWest().uncheck();
    await page.evaluate(()=>window.dispatchEvent(new Event('fixture-change')));
    assert.equal(await savedWest().isChecked(),false,'Refreshing pupil data must not undo an unsaved edit');
    await page.getByRole('button',{name:'Save stream setup',exact:true}).click();
    await page.waitForFunction(()=>window.lastNavigation?.startsWith('/class-detail'));
    assert.equal(savedRequests.length,1);
    assert.deepEqual(savedRequests[0].assignments.map(a=>[a.pupilId,a.streamId]).sort(),[['pupil-1','east'],['pupil-2','east'],['pupil-3','west']]);
    assert.equal(savedRequests[0].expectedVersion,4);
    checks.push('Reopening preserves saved two-stream distribution; editing saves only the intended new distribution');
    await page.goto(streamUrl+'?late=1');
    await page.getByText('No active pupils are currently enrolled in this class.').waitFor();
    await page.evaluate(()=>{window.streamFixture.empty=false;window.dispatchEvent(new Event('fixture-change'));});
    await savedWest().waitFor();assert.equal(await savedWest().isChecked(),true);
    await page.evaluate(()=>{window.streamFixture.pupils[0].streamId='east';window.dispatchEvent(new Event('fixture-change'));});
    await page.waitForFunction(()=>document.querySelector('[aria-label="Assign Nakiyingi Grace to West"]')?.getAttribute('aria-checked')==='false');
    await page.evaluate(()=>{window.streamFixture.pupils[0].streamId='west';window.dispatchEvent(new Event('fixture-change'));});
    await page.waitForFunction(()=>document.querySelector('[aria-label="Assign Nakiyingi Grace to West"]')?.getAttribute('aria-checked')==='true');
    checks.push('Late pupil hydration restores each saved stream instead of assigning everyone to the first');
    await page.goto(streamUrl+'?three=1');
    const chooseNorth=page.getByRole('combobox',{name:'Choose stream for Sample Ben'});
    await chooseNorth.waitFor();assert.match(await chooseNorth.innerText(),/North/);
    assert.match(await page.getByRole('combobox',{name:'Choose stream for Nakiyingi Grace'}).innerText(),/West/);
    checks.push('Existing three-stream distribution is preserved');
    await page.screenshot({path:path.join(output,'stream-editor-restored.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({checks},null,2));
    console.log('CLASS_EXAMS_BROWSER_OK',JSON.stringify({checks:checks.length,output}));
  }catch(error){
    if(page){console.error(await page.locator('body').innerText());await page.screenshot({path:path.join(output,'failure.png'),fullPage:true});}
    throw error;
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
