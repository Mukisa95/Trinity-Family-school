// Browser regression for persistent minimised studio sessions and large local-only PDFs.
// Set PLAYWRIGHT_MODULE if Playwright is supplied by an external runtime.
// Uses generated local fixtures; no school records or uploaded files.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const esbuild=require('esbuild'),ts=require('typescript');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'output/studio-workspace-qa');
process.chdir(root);
const mocks={
 '@/lib/pdf/pdf-workspace-context':`import{useEffect,useState}from'react';export function usePDFWorkspace(){const[,force]=useState(0);useEffect(()=>{const update=()=>force(x=>x+1);addEventListener('fixture-pdf',update);return()=>removeEventListener('fixture-pdf',update);},[]);return{documents:window.fixturePDFDock?[{id:'print-preview'}]:[],mode:window.fixturePDFDock?'minimized':'expanded'};}`,
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
 '@/lib/hooks/use-pdf-viewer':`export const usePDFViewer=()=>({isOpen:false,closePDF(){},async runPDFJob(_options,generator){const blob=await generator({updateProgress(){}});window.fixturePDF=blob;return blob}});`,
};
const fixture=`import React,{useState,useEffect} from 'react';import{createRoot}from'react-dom/client';
import{PhotoStudioWorkspaceProvider}from'./src/lib/contexts/photo-studio-workspace-context';import{LazyPhotoStudioWorkspace}from'./src/components/docx/lazy-photo-studio-workspace';
import DocXPage from './src/app/docx/page';import{NavigationContent}from'./src/components/layout/navigation-content';
function RoutePage({route}){useEffect(()=>{if(route==='docx'){window.fixtureDocXMounts=(window.fixtureDocXMounts||0)+1;return()=>{window.fixtureDocXUnmounts=(window.fixtureDocXUnmounts||0)+1;};}},[route]);return route==='docx'?<DocXPage/>:<section><h1>Other application page</h1><label>Other app work<input aria-label="Other app work" className="border p-3"/></label><button className="h-12 border px-4">App action</button></section>;};
function App(){const[route,setRoute]=useState('docx');const[desktop,setDesktop]=useState(innerWidth>=768);useEffect(()=>{const resize=()=>setDesktop(innerWidth>=768);addEventListener('resize',resize);return()=>removeEventListener('resize',resize)},[]);
return <PhotoStudioWorkspaceProvider><div className={desktop?'dashboard-bg-wrapper flex w-full':'flex w-full'}>
{desktop&&<aside className="w-64 shrink-0 bg-card p-4">School navigation<button className="h-12 border p-2" onClick={()=>setRoute('other')}>Other app page</button><button className="h-12 border p-2" onClick={()=>setRoute('docx')}>DocX page</button></aside>}
<div data-sidebar={desktop?'inset':undefined} className="relative flex h-[100dvh] min-w-0 flex-1 flex-col overflow-hidden">
<header className="app-topbar sticky top-0 z-40 h-11 shrink-0 bg-card px-4 sm:h-[52px] md:absolute md:left-0 md:right-0"><button className="h-full">School topbar</button></header>
<main data-fixture-scroller className="min-h-0 flex-1 overflow-y-auto px-3 md:px-6 md:pt-[52px]"><NavigationContent><nav className="flex gap-2 md:hidden"><button className="h-11" onClick={()=>setRoute('other')}>Other app page</button><button className="h-11" onClick={()=>setRoute('docx')}>DocX page</button></nav><RoutePage route={route}/></NavigationContent></main>
</div></div><LazyPhotoStudioWorkspace/></PhotoStudioWorkspaceProvider>};createRoot(document.getElementById('app')).render(<App/>);`;
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 await esbuild.build({absWorkingDir:root,stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,format:'esm',platform:'browser',jsx:'automatic',alias:{'@':path.join(root,'src')},outfile:path.join(output,'fixture.js'),define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},plugins:[{name:'synthetic-records',setup(b){b.onResolve({filter:/.*/},a=>Object.hasOwn(mocks,a.path)?{path:a.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:root}));b.onLoad({filter:/studio-pdf\.ts$/},a=>({contents:fs.readFileSync(a.path,'utf8').replace("new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()","'/pdf.worker.min.mjs'"),loader:'ts',resolveDir:path.dirname(a.path)}));}}]});
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
  const editor=page.getByRole('dialog',{name:/Custom Photo Studio/}),importer=page.getByRole('dialog',{name:'Import PDF artwork'}),selection=page.getByRole('dialog',{name:/Select & refine/});
  const dock=page.getByRole('button',{name:'Restore Photo Studio',exact:true});
  const {PDFDocument,PDFRawStream,PDFName,rgb}=require('pdf-lib'),crypto=require('crypto');
  const document=await PDFDocument.create();const sheet=document.addPage([400,560]);sheet.drawRectangle({x:0,y:0,width:400,height:560,color:rgb(.1,.2,.6)});
  sheet.drawRectangle({x:70,y:110,width:260,height:340,color:rgb(1,1,1)});
  const unused=document.context.register(PDFRawStream.of(document.context.obj({Type:'EmbeddedFile'}),new Uint8Array(26*1024*1024)));
  document.catalog.set(PDFName.of('LocalStudioFixture'),unused);
  const large=Buffer.from(await document.save({useObjectStreams:false}));assert.ok(large.length>25*1024*1024);
  const originalHash=crypto.createHash('sha256').update(large).digest('hex');
  await page.getByRole('dialog',{name:/Custom Photo Studio/}).waitFor();await editor.waitFor();
  await editor.getByRole('textbox',{name:'Template name',exact:true}).fill('Persistent local studio');
  await editor.getByRole('button',{name:'Import PDF',exact:true}).click();await importer.waitFor();assert.equal(await importer.getByLabel('PDF file',{exact:true}).isVisible(),true);
  const uploadPath=path.join(output,'large-local.pdf');fs.writeFileSync(uploadPath,large);
  await importer.getByLabel('PDF file',{exact:true}).setInputFiles(uploadPath,{timeout:60000});
  await importer.getByRole('button',{name:'Minimize Photo Studio',exact:true}).click();await dock.waitFor();await editor.waitFor({state:'hidden'});await importer.waitFor({state:'hidden'});assert.equal(await editor.count(),0);assert.equal(await importer.count(),0);
  await page.getByRole('button',{name:'Other app page',exact:true}).click();await page.getByRole('textbox',{name:'Other app work'}).fill('Working elsewhere while the PDF stays local');
  assert.ok(await page.evaluate(()=>window.fixtureDocXUnmounts>0),'The actual DocX route component unmounts');
  assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).pointerEvents),'auto','Minimizing releases the app pointer lock');
  assert.equal(await page.getByRole('heading',{name:'Other application page'}).isVisible(),true);
  await dock.click();await importer.waitFor();await importer.getByText(/large-local.pdf.*1 page/).waitFor({timeout:90000});
  await importer.getByLabel('PDF import destination').selectOption('replace');await importer.getByRole('button',{name:'Import pages',exact:true}).click();await importer.waitFor({state:'hidden',timeout:90000});
  await editor.getByRole('link',{name:'Download unchanged source PDF'}).waitFor();const sourceUrl=await editor.getByRole('link',{name:'Download unchanged source PDF'}).getAttribute('href');assert.match(sourceUrl,/^blob:/);
  console.log('26 MB local PDF, import minimization and route navigation passed');
  // Keep a manual selection and edge settings alive while doing unrelated app work.
  const picture=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=300;c.height=300;const x=c.getContext('2d');x.fillStyle='#e92828';x.fillRect(0,0,150,300);x.fillStyle='#2040e9';x.fillRect(150,0,150,300);return c.toDataURL('image/png').split(',')[1];});
  await editor.locator('input[accept="image/*"]').nth(1).setInputFiles({name:'local-photo.png',mimeType:'image/png',buffer:Buffer.from(picture,'base64')});
  await editor.getByRole('button',{name:'Background remover & object selector',exact:true}).click();await selection.waitFor();await selection.getByRole('button',{name:'Rectangle',exact:true}).click();
  const bounds=await selection.getByLabel('Layer selection canvas',{exact:true}).boundingBox();await page.mouse.move(bounds.x+bounds.width*.1,bounds.y+bounds.height*.1);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.5,bounds.y+bounds.height*.9);await page.mouse.up();
  await selection.getByRole('spinbutton',{name:'Feather amount',exact:true}).fill('7');const selected=await selection.getByLabel('Layer selection canvas',{exact:true}).evaluate(c=>c.toDataURL('image/png'));
  await selection.getByRole('button',{name:'Minimize Photo Studio',exact:true}).click();await dock.waitFor();
  await page.getByRole('textbox',{name:'Other app work'}).fill('More work in another part of the application');await page.getByRole('button',{name:'App action',exact:true}).click();await page.keyboard.press('Control+z');assert.equal(await page.getByRole('textbox',{name:'Other app work'}).inputValue(),'Working elsewhere while the PDF stays local','Undo works normally in the other app form');await page.getByRole('textbox',{name:'Other app work'}).fill('More work in another part of the application');
  await dock.click();await selection.waitFor().catch(async error=>{console.error('Restore errors',errors);console.error('Dialogs',await page.getByRole('dialog').evaluateAll(els=>els.map(el=>el.innerText.slice(0,250))));console.error((await page.locator('body').innerText()).slice(-1800));await page.screenshot({path:path.join(output,'restore-failure.png')});throw error;});assert.equal(await selection.getByRole('spinbutton',{name:'Feather amount',exact:true}).inputValue(),'7');assert.equal(await selection.getByLabel('Layer selection canvas',{exact:true}).evaluate(c=>c.toDataURL('image/png')),selected,'Selection pixels survive minimization');
  await selection.getByRole('button',{name:'Layer via copy',exact:true}).click();await selection.waitFor({state:'hidden'});
  assert.equal(await editor.getByRole('textbox',{name:'Template name',exact:true}).inputValue(),'Persistent local studio','Other-page undo never changes the studio');
  const save=async()=>{await editor.getByRole('button',{name:'Save',exact:true}).click();await page.waitForFunction(()=>window.fixtureToast?.title==='Template saved');await page.waitForTimeout(100);};
  const metadata=()=>page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('trinity-document-studio',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('templates').objectStore('templates').getAll();q.onsuccess=async()=>{const t=q.result[0],source=Object.values(t.pdfSources)[0];resolve({name:t.name,layers:t.pages[0].layers.length,size:source.blob?.size,dataUrl:source.dataUrl,hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await source.blob.arrayBuffer()))).map(x=>x.toString(16).padStart(2,'0')).join('')});db.close();};};}));
  await save();let saved=await metadata();assert.equal(saved.layers,2);assert.equal(saved.size,large.length);assert.equal(saved.hash,originalHash);assert.equal(saved.dataUrl,undefined);
  await editor.getByRole('button',{name:'Undo',exact:true}).click();await save();assert.equal((await metadata()).layers,1);await editor.getByRole('button',{name:'Redo',exact:true}).click();await save();assert.equal((await metadata()).layers,2);
  console.log('Selection, feather, undo/redo and original local Blob bytes survive minimization');
  // Selected pupils and output stage survive restoring from a different route.
  await editor.getByRole('button',{name:'2. Pupils & output',exact:true}).click();await editor.getByRole('button',{name:/Select all 1 filtered pupils/}).click();
  await editor.getByRole('button',{name:'Back to app',exact:true}).click();await dock.waitFor();assert.equal(await page.getByRole('textbox',{name:'Other app work'}).inputValue(),'More work in another part of the application');
  for(const size of [{width:320,height:720},{width:390,height:844},{width:812,height:375},{width:1440,height:900}]){
   await page.setViewportSize(size);const box=await dock.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=size.width+1&&box.y+box.height<=size.height+1);await page.screenshot({path:path.join(output,`minimized-${size.width}.png`)});
  }
  await page.evaluate(()=>document.documentElement.classList.add('dark'));await page.screenshot({path:path.join(output,'minimized-dark.png')});await page.evaluate(()=>document.documentElement.classList.remove('dark'));
  // Both minimized workspaces remain reachable on mobile, including lazy-viewer swaps.
  await page.setViewportSize({width:320,height:720});
  await page.evaluate(()=>{const pdf=document.createElement('aside');pdf.setAttribute('aria-label','Minimized PDF workspace');pdf.textContent='Print preview dock';Object.assign(pdf.style,{position:'fixed',bottom:'12px',right:'12px',width:'calc(100vw - 24px)',height:'180px',background:'white',border:'1px solid #bbb',zIndex:90});document.body.append(pdf);window.fixturePDFDock=true;dispatchEvent(new Event('fixture-pdf'));});
  const separateDocks=()=>{const photo=document.querySelector('[aria-label="Restore Photo Studio"]'),pdf=document.querySelector('[aria-label="Minimized PDF workspace"]');return photo&&pdf&&photo.getBoundingClientRect().bottom+8<=pdf.getBoundingClientRect().top;};
  await page.waitForFunction(separateDocks);await page.evaluate(()=>document.querySelector('[aria-label="Minimized PDF workspace"]').style.height='260px');await page.waitForFunction(separateDocks);
  await page.evaluate(()=>{const previous=document.querySelector('[aria-label="Minimized PDF workspace"]'),replacement=previous.cloneNode(true);replacement.style.height='220px';previous.replaceWith(replacement);});await page.waitForFunction(separateDocks);
  await page.screenshot({path:path.join(output,'both-workspaces-mobile.png')});
  await page.evaluate(()=>{document.querySelector('[aria-label="Minimized PDF workspace"]').remove();window.fixturePDFDock=false;dispatchEvent(new Event('fixture-pdf'));});await page.setViewportSize({width:1440,height:900});
  await dock.click();assert.equal(await editor.getByRole('button',{name:'Open in-app print preview',exact:true}).isEnabled(),true);
  await editor.getByRole('button',{name:'Open in-app print preview',exact:true}).click();await page.waitForFunction(()=>window.fixturePDF instanceof Blob,{},{timeout:90000});
  fs.writeFileSync(path.join(output,'large-local-export.pdf'),Buffer.from(await page.evaluate(async()=>Array.from(new Uint8Array(await window.fixturePDF.arrayBuffer())))));
  await editor.getByRole('button',{name:'1. Design',exact:true}).click();
  const download=page.waitForEvent('download');await editor.getByRole('link',{name:'Download unchanged source PDF'}).click();const result=await download;const downloaded=path.join(output,'original-local.pdf');await result.saveAs(downloaded);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(downloaded)).digest('hex'),originalHash);
  await editor.getByRole('button',{name:'Close editor',exact:true}).click();await editor.waitFor({state:'hidden'});
  await page.getByRole('button',{name:'DocX page',exact:true}).click();await editor.waitFor();
  await editor.getByRole('combobox').filter({hasText:'Open saved template'}).click();await page.getByRole('option',{name:'Persistent local studio',exact:true}).click();await editor.getByRole('link',{name:'Download unchanged source PDF'}).waitFor();
  console.log('Pupil selection, output stage, responsive dock, PDF export, download and save/reopen passed');
  // Locked or replaced accounts cannot keep a previous visible studio session.
  await editor.getByRole('button',{name:'Minimize Photo Studio',exact:true}).click();await page.evaluate(()=>{window.fixtureLocked=true;dispatchEvent(new Event('fixture-auth'));});await dock.waitFor({state:'hidden'});
  await page.evaluate(()=>{window.fixtureLocked=false;dispatchEvent(new Event('fixture-auth'));});await dock.waitFor();await dock.click();assert.equal(await editor.getByRole('textbox',{name:'Template name',exact:true}).inputValue(),'Persistent local studio');
  await page.evaluate(()=>{window.fixtureUser=null;dispatchEvent(new Event('fixture-auth'));});await editor.waitFor({state:'hidden'});assert.equal(await dock.count(),0);
  await page.evaluate(()=>{window.fixtureUser={id:'different-user',role:'Admin',isActive:true};dispatchEvent(new Event('fixture-auth'));});
  await page.getByRole('button',{name:'Custom Photo Studio',exact:true}).click();await editor.waitFor();assert.equal(await editor.getByRole('textbox',{name:'Template name',exact:true}).inputValue(),'Untitled pupil design');
  await page.evaluate(()=>{window.fixtureUser={id:'different-user',role:'Staff',isActive:true,circumference:{classIds:['P4'],sections:null,genders:null}};dispatchEvent(new Event('fixture-auth'));});await editor.waitFor({state:'hidden'});
  assert.deepEqual(uploads,[],'The studio never uploads PDFs, photo edits or templates');assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({cases:['PDF above 25 MB','minimize during PDF inspection','route unmount preserves session','underlying app pointer and focus access','selection pixels and feather preserved','other-page shortcuts isolated','undo and redo survive','local Blob bytes unchanged','selected pupils and output stage preserved','responsive restore dock','photo and print docks remain separated','PDF print output','original PDF download','local save and reopen','lock hides session without losing it','logout and scope change clear active session','no HTTP uploads'],sourceBytes:large.length,uploads,errors},null,2));console.log('STUDIO_WORKSPACE_BROWSER_OK');
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1});
