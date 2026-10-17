// Browser regression for persistent minimised studio sessions and large local-only PDFs.
// Set PLAYWRIGHT_MODULE if Playwright is supplied by an external runtime.
// Uses generated local fixtures; no school records or uploaded files.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const esbuild=require('esbuild'),ts=require('typescript');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'output/studio-groups-preview-qa');
process.chdir(root);
const mocks={
 '@/lib/contexts/auth-context':`import{useState,useEffect}from'react';const initial={id:'studio-fixture',role:'Admin',isActive:true};export function useAuth(){const[,force]=useState(0);useEffect(()=>{const update=()=>force(x=>x+1);addEventListener('fixture-auth',update);return()=>removeEventListener('fixture-auth',update);},[]);return{user:Object.hasOwn(window,'fixtureUser')?window.fixtureUser:initial,isLocked:!!window.fixtureLocked,canAccessPage:()=>window.fixtureAllowed!==false};}`,
 'next/navigation':`export const usePathname=()=>'/docx',useRouter=()=>({push(){},replace(){},prefetch(){}});`,
 'next/link':`import React from 'react';export default ({href,children,...props})=><a href={href} {...props}>{children}</a>;`,
 '@/lib/contexts/navigation-context':`export const useNavigation=()=>({isNavigating:false,destination:null,isSlow:false,goBack(){}});`,
 '@/lib/offline/android-bridge':`export const hasAndroidOfflineBridge=()=>false,androidOfflineRequest=async()=>({});`,
 '@/lib/hooks/use-pupils':`const data=[{id:'pupil',firstName:'AMINA',lastName:'EXAMPLE',status:'Active',gender:'Female',section:'Boarding',classId:'P4',className:'Primary Four',admissionNumber:'FIXTURE001'}];export const usePupils=()=>({data,isLoading:false});`,
 '@/lib/hooks/use-school-settings':`export const useSchoolSettings=()=>({data:{generalInfo:{name:'Trinity Family School',logo:''}},isLoading:false});`,
 '@/lib/hooks/use-term-status':`export const useTermStatus=()=>({effectiveTerm:{academicYear:null,term:null},academicYears:[]});`,
 '@/lib/hooks/use-progressive-fees':`export const useProgressiveFees=()=>({pupilsWithFees:[],isProcessing:false});`,
 '@/hooks/use-toast':`export const useToast=()=>({toast(message){window.fixtureToast=message}});`,
 '@/components/pdf/pdf-viewer':`export const PDFViewer=()=>null;`,
};
const fixture=`import React,{useState,useEffect} from 'react';import{createRoot}from'react-dom/client';
import{PhotoStudioWorkspaceProvider}from'./src/lib/contexts/photo-studio-workspace-context';import{LazyPhotoStudioWorkspace}from'./src/components/docx/lazy-photo-studio-workspace';
import{PDFWorkspaceProvider,usePDFWorkspace}from'./src/lib/pdf/pdf-workspace-context';import{PDFWorkspace}from'./src/components/pdf/pdf-workspace';
import DocXPage from './src/app/docx/page';import{NavigationContent}from'./src/components/layout/navigation-content';
function RoutePage({route}){useEffect(()=>{if(route==='docx'){window.fixtureDocXMounts=(window.fixtureDocXMounts||0)+1;return()=>{window.fixtureDocXUnmounts=(window.fixtureDocXUnmounts||0)+1;};}},[route]);return route==='docx'?<DocXPage/>:<section><h1>Other application page</h1><label>Other app work<input aria-label="Other app work" className="border p-3"/></label><button className="h-12 border px-4">App action</button></section>;};
function WorkspaceProbe(){const value=usePDFWorkspace();useEffect(()=>{window.fixtureWorkspace=value},[value]);return null;}
function App(){const[route,setRoute]=useState('docx');const[desktop,setDesktop]=useState(innerWidth>=768);useEffect(()=>{const resize=()=>setDesktop(innerWidth>=768);addEventListener('resize',resize);return()=>removeEventListener('resize',resize)},[]);
return <PDFWorkspaceProvider><WorkspaceProbe/><PhotoStudioWorkspaceProvider><div className={desktop?'dashboard-bg-wrapper flex w-full':'flex w-full'}>
{desktop&&<aside className="w-64 shrink-0 bg-card p-4">School navigation<button className="h-12 border p-2" onClick={()=>setRoute('other')}>Other app page</button><button className="h-12 border p-2" onClick={()=>setRoute('docx')}>DocX page</button></aside>}
<div data-sidebar={desktop?'inset':undefined} className="relative flex h-[100dvh] min-w-0 flex-1 flex-col overflow-hidden">
<header className="app-topbar sticky top-0 z-40 h-11 shrink-0 bg-card px-4 sm:h-[52px] md:absolute md:left-0 md:right-0"><button className="h-full">School topbar</button></header>
<main data-fixture-scroller className="min-h-0 flex-1 overflow-y-auto px-3 md:px-6 md:pt-[52px]"><NavigationContent><nav className="flex gap-2 md:hidden"><button className="h-11" onClick={()=>setRoute('other')}>Other app page</button><button className="h-11" onClick={()=>setRoute('docx')}>DocX page</button></nav><RoutePage route={route}/></NavigationContent></main>
</div></div><LazyPhotoStudioWorkspace/><PDFWorkspace/></PhotoStudioWorkspaceProvider></PDFWorkspaceProvider>};createRoot(document.getElementById('app')).render(<App/>);`;
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 await esbuild.build({absWorkingDir:root,stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,format:'esm',platform:'browser',jsx:'automatic',alias:{'@':path.join(root,'src')},outfile:path.join(output,'fixture.js'),define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},plugins:[{name:'synthetic-records',setup(b){b.onResolve({filter:/.*/},a=>Object.hasOwn(mocks,a.path)?{path:a.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:root}));if(process.env.STUDIO_TEST_BASELINE)b.onLoad({filter:/lazy-photo-studio-workspace\.tsx$/},a=>({contents:require('child_process').execFileSync('git',['show','f43724c7:src/components/docx/lazy-photo-studio-workspace.tsx'],{encoding:'utf8'}),loader:'tsx',resolveDir:path.dirname(a.path)}));b.onLoad({filter:/(studio-pdf\.ts|pdf-document-viewer\.tsx)$/},a=>({contents:fs.readFileSync(a.path,'utf8').replace(/new URL\(\s*['"]pdfjs-dist\/build\/pdf\.worker\.min\.mjs['"],\s*import\.meta\.url,?\s*\)\.toString\(\)/g,"'/pdf.worker.min.mjs'"),loader:a.path.endsWith('.tsx')?'tsx':'ts',resolveDir:path.dirname(a.path)}));}}]});
 const config={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync('tailwind.config.ts','utf8'),{compilerOptions:{module:1}}).outputText)(require,config,config.exports);
 const css=['globals.css','theme.css','brand-theme.css'].map(p=>fs.readFileSync(path.join(root,'src/app',p),'utf8').replace(/^@import[^;]+;/,'')).join('\n');
 const cssPath=path.join(output,'fixture.css');
 if(!fs.existsSync(cssPath)||fs.statSync(cssPath).mtimeMs<Math.max(...['custom-photo-studio.tsx','studio-pdf-controls.tsx','lazy-photo-studio-workspace.tsx','docx-fonts.ts'].map(file=>fs.statSync(path.join(root,'src/components/docx',file)).mtimeMs))){
  const built=await require('postcss')([require('tailwindcss')({...config.exports.default,content:[path.join(root,'src/**/*.{ts,tsx}'),{raw:fixture,extension:'tsx'}]})]).process(css,{from:path.join(root,'src/app/globals.css')});fs.writeFileSync(cssPath,built.css);
 }
 const server=http.createServer((req,res)=>{if(req.url==='/pdf.worker.min.mjs'){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(require.resolve('pdfjs-dist/build/pdf.worker.min.mjs')));return;}if(['/fixture.js','/fixture.css'].includes(req.url)){res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync(path.join(output,req.url.slice(1))));return;}
 const file=path.resolve(root,'public','.'+decodeURIComponent(req.url.split('?')[0]));if(file.startsWith(path.join(root,'public')+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){res.end(fs.readFileSync(file));return;}
 res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="app"></div><script type="module" src="/fixture.js"></script></body></html>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 const errors=[],uploads=[];
 try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(!['GET','HEAD','OPTIONS'].includes(request.method()))uploads.push({method:request.method(),url:request.url()});});
  await page.goto('http://127.0.0.1:'+server.address().port);console.log('Browser ready');
  const editor=page.getByRole('dialog',{name:/Custom Photo Studio/});
  await editor.waitFor();
  const snapshot=async()=>{await editor.getByRole('button',{name:'Save',exact:true}).click();await page.waitForTimeout(180);return page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('trinity-document-studio',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('templates').objectStore('templates').getAll();q.onsuccess=()=>{resolve(q.result.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0]);db.close();};};}));};
  let stored;
  if(!process.env.STUDIO_TEST_BASELINE){
    assert.equal(await page.getByText('Personalised pupil documents',{exact:true}).count(),0);
    assert.equal(await editor.getByRole('button',{name:'Minimize Photo Studio',exact:true}).innerText(),'');
    await editor.getByRole('textbox',{name:'Template name',exact:true}).fill('Grouped preview regression');stored=await snapshot();
    const original=stored.pages[0].layers;
    for(const layer of original)await editor.getByRole('checkbox',{name:'Select layer '+layer.label,exact:true}).check();
    await editor.getByRole('button',{name:'Group selected layers',exact:true}).click();await editor.getByRole('textbox',{name:'Group name',exact:true}).fill('ID card');stored=await snapshot();assert.equal(stored.pages[0].groups.length,1);assert.ok(stored.pages[0].layers.every(layer=>layer.groupId===stored.pages[0].groups[0].id));
    const move=editor.getByRole('button',{name:'Move group ID card',exact:true});await move.scrollIntoViewIfNeeded();const box=await move.boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.5+25,box.y+box.height*.5+15,{steps:5});await page.mouse.up();
    stored=await snapshot();const moved=stored.pages[0].layers;assert.ok(moved[0].x>original[0].x);assert.ok(Math.abs((moved[1].x-moved[0].x)-(original[1].x-original[0].x))<1e-8);assert.ok(Math.abs((moved[1].y-moved[0].y)-(original[1].y-original[0].y))<1e-8);
    await editor.getByRole('button',{name:'Undo',exact:true}).click();stored=await snapshot();assert.equal(stored.pages[0].layers[0].x,original[0].x);await editor.getByRole('button',{name:'Redo',exact:true}).click();
    await editor.getByRole('button',{name:'Duplicate group ID card',exact:true}).click();stored=await snapshot();assert.equal(stored.pages[0].groups.length,2);assert.equal(stored.pages[0].layers.length,4);
    await editor.getByRole('button',{name:'Delete group ID card copy',exact:true}).click();stored=await snapshot();assert.equal(stored.pages[0].layers.length,2);await editor.getByRole('button',{name:'Undo',exact:true}).click();
    await editor.getByRole('button',{name:'Ungroup ID card copy',exact:true}).click();stored=await snapshot();assert.equal(stored.pages[0].layers.length,4);assert.equal(stored.pages[0].groups.length,1);await editor.getByRole('button',{name:'Undo',exact:true}).click();stored=await snapshot();
    await editor.getByRole('button',{name:'Close editor',exact:true}).click();await page.getByRole('button',{name:'Custom Photo Studio',exact:true}).click();await editor.waitFor();await editor.getByRole('combobox').filter({hasText:'Open saved template'}).click();await page.getByRole('option',{name:stored.name,exact:true}).click();
    assert.equal(await editor.getByRole('button',{name:/^Select group ID card/}).count(),2);
    await editor.getByRole('button',{name:'Duplicate page',exact:true}).click();stored=await snapshot();assert.equal(stored.pages.length,2);assert.notEqual(stored.pages[0].groups[0].id,stored.pages[1].groups[0].id);await editor.getByRole('button',{name:'Undo',exact:true}).click();
    console.log('Direct entry, icon controls, group movement, atomic undo, duplicate/delete/ungroup and saved/page copies passed');
  }
  await editor.getByRole('button',{name:'2. Pupils & output',exact:true}).click();await editor.getByRole('button',{name:/AMINA/}).click();
  await editor.getByRole('button',{name:'Open in-app print preview',exact:true}).click();
  const pdf=page.getByLabel('PDF workspace',{exact:true});await pdf.waitFor({timeout:60000});
  const hit=await pdf.locator('button[aria-label="Minimize PDF workspace"]').evaluate(el=>{const b=el.getBoundingClientRect();return{pointer:getComputedStyle(el).pointerEvents,body:getComputedStyle(document.body).pointerEvents,hit:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest('button')===el,hidden:!!el.closest('[aria-hidden="true"]')};});
  console.log('PDF preview interaction',JSON.stringify(hit));
  if(process.env.STUDIO_TEST_BASELINE){assert.ok(!hit.hit||hit.hidden);fs.writeFileSync(path.join(output,'baseline.json'),JSON.stringify({hit},null,2));console.log('BASELINE_PREVIEW_MODAL_BLOCK_REPRODUCED');return;}
  assert.ok(hit.hit,'Preview controls receive real pointer events');assert.equal(hit.hidden,false);await pdf.locator('canvas').first().waitFor({state:'visible',timeout:60000});await page.waitForFunction(()=>{const c=document.querySelector('[aria-label="PDF workspace"] canvas');if(!c||!c.width||!c.height)return false;const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return data.some((value,i)=>i%4===0&&value<200&&data[i+3]>0);},{},{timeout:60000});await page.screenshot({path:path.join(output,'real-group-pdf-preview.png')});await pdf.getByRole('button',{name:'Minimize PDF workspace',exact:true}).click();await editor.waitFor();
  await editor.getByRole('button',{name:'Minimize Photo Studio',exact:true}).click();await page.getByRole('button',{name:'Other app page',exact:true}).click();await page.getByRole('textbox',{name:'Other app work'}).fill('Application remains responsive after PDF preview');
  assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).pointerEvents),'auto');
  await page.getByRole('button',{name:'Restore Photo Studio',exact:true}).click();await editor.waitFor();
  await editor.getByRole('button',{name:'Open in-app print preview',exact:true}).click();await pdf.waitFor();await page.waitForFunction(()=>window.fixtureWorkspace.documents.length===2&&window.fixtureWorkspace.documents.every(d=>d.status==='ready'),{},{timeout:90000});
  await pdf.getByRole('tab').first().click();await pdf.getByRole('button',{name:'Close all PDF documents',exact:true}).click();await editor.waitFor();
  await editor.getByRole('button',{name:'1. Design',exact:true}).click();
  for(const size of [{width:320,height:720},{width:390,height:844},{width:1440,height:900}]){await page.setViewportSize(size);const bounds=await editor.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));assert.ok(bounds.scroll<=bounds.client+1);await page.screenshot({path:path.join(output,'groups-'+size.width+'.png')});}
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({cases:['direct studio entry','icon-only minimization','group move and atomic undo','duplicate entire group','delete entire group','ungroup','save/reopen groups','page-copy group IDs','real PDF workspace pointer/focus handoff','app navigation and typing after preview','multiple previews and tabs','mobile and desktop groups'],hit,errors},null,2));console.log('STUDIO_GROUPS_PREVIEW_BROWSER_OK');
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1});
