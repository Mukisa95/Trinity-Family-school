// Browser regression for the real studio, with synthetic pupils and local PDF fixtures.
// Set PLAYWRIGHT_MODULE if Playwright is supplied by an external runtime.
// Optional STUDIO_ENCRYPTED_PDF points to a password-protected fixture for rejection testing.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const esbuild=require('esbuild'),ts=require('typescript');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'output/studio-pdf-qa');
process.chdir(root);
const mocks={
 '@/lib/pdf/pdf-workspace-context':`export const usePDFWorkspace=()=>({documents:[],mode:'expanded'});`,
 '@/lib/contexts/auth-context':`export const useAuth=()=>({user:{id:'studio-fixture',role:'Admin',isActive:true},isLocked:false,canAccessPage:()=>true});`,
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
function App(){const[desktop,setDesktop]=useState(innerWidth>=768);useEffect(()=>{const resize=()=>setDesktop(innerWidth>=768);addEventListener('resize',resize);return()=>removeEventListener('resize',resize)},[]);
return <PhotoStudioWorkspaceProvider><div className={desktop?'dashboard-bg-wrapper flex w-full':'flex w-full'}>
{desktop&&<aside className="w-64 shrink-0 bg-card p-4">School navigation</aside>}
<div data-sidebar={desktop?'inset':undefined} className="relative flex h-[100dvh] min-w-0 flex-1 flex-col overflow-hidden">
<header className="app-topbar sticky top-0 z-40 h-11 shrink-0 bg-card px-4 sm:h-[52px] md:absolute md:left-0 md:right-0"><button className="h-full">School topbar</button></header>
<main data-fixture-scroller className="min-h-0 flex-1 overflow-y-auto px-3 md:px-6 md:pt-[52px]"><NavigationContent><DocXPage/></NavigationContent></main>
</div></div><LazyPhotoStudioWorkspace/></PhotoStudioWorkspaceProvider>};createRoot(document.getElementById('app')).render(<App/>);`;
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 await esbuild.build({absWorkingDir:root,stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,format:'esm',platform:'browser',jsx:'automatic',alias:{'@':path.join(root,'src')},outfile:path.join(output,'fixture.js'),define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},plugins:[{name:'synthetic-records',setup(b){b.onResolve({filter:/.*/},a=>Object.hasOwn(mocks,a.path)?{path:a.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:root}));b.onLoad({filter:/studio-pdf\.ts$/},a=>({contents:fs.readFileSync(a.path,'utf8').replace("new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString()","'/pdf.worker.min.mjs'"),loader:'ts',resolveDir:path.dirname(a.path)}));}}]});
 const config={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync('tailwind.config.ts','utf8'),{compilerOptions:{module:1}}).outputText)(require,config,config.exports);
 const css=['globals.css','theme.css','brand-theme.css'].map(p=>fs.readFileSync(path.join(root,'src/app',p),'utf8').replace(/^@import[^;]+;/,'')).join('\n');
 const cssPath=path.join(output,'fixture.css');
 if(!fs.existsSync(cssPath)||fs.statSync(cssPath).mtimeMs<Math.max(...['custom-photo-studio.tsx','studio-pdf-controls.tsx','lazy-photo-studio-workspace.tsx','docx-fonts.ts'].map(file=>fs.statSync(path.join(root,'src/components/docx',file)).mtimeMs))){
  const built=await require('postcss')([require('tailwindcss')({...config.exports.default,content:[path.join(root,'src/**/*.{ts,tsx}'),{raw:fixture,extension:'tsx'}]})]).process(css,{from:path.join(root,'src/app/globals.css')});fs.writeFileSync(cssPath,built.css);
 }
 const server=http.createServer((req,res)=>{if(req.url==='/pdf.worker.min.mjs'){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(require.resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs')));return;}if(['/fixture.js','/fixture.css'].includes(req.url)){res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync(path.join(output,req.url.slice(1))));return;}
 const file=path.resolve(root,'public','.'+decodeURIComponent(req.url.split('?')[0]));if(file.startsWith(path.join(root,'public')+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){res.end(fs.readFileSync(file));return;}
 res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="app"></div><script type="module" src="/fixture.js"></script></body></html>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 const errors=[];
 try{
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});page.on('pageerror',e=>{errors.push(e.message);console.error('Browser:',e.message)});
  page.setDefaultTimeout(15000);console.log('Browser ready');await page.goto('http://127.0.0.1:'+server.address().port);
  const editor=page.getByRole('dialog',{name:/Custom Photo Studio/});
  const {PDFDocument,rgb,StandardFonts}=require('pdf-lib');
  const fixtures={};
  const raster=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=600;c.height=840;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,600,840);x.fillStyle='#183080';x.fillRect(0,0,600,168);x.fillRect(0,672,600,168);x.fillRect(0,0,90,840);x.fillRect(510,0,90,840);x.fillStyle='white';x.font='bold 23px sans-serif';x.fillText('PROTECTED FLAT ARTWORK',105,80);return c.toDataURL('image/png').split(',')[1];}),'base64');
  for(const kind of ['flat','vector','mixed']){
   const pdf=await PDFDocument.create();const font=await pdf.embedFont(StandardFonts.HelveticaBold);
   const dims=kind==='mixed'?[[560,400],[400,560]]:[[400,560]];
   for(const [w,h]of dims){const p=pdf.addPage([w,h]);
    if(kind==='flat'){const png=await pdf.embedPng(raster);p.drawImage(png,{x:0,y:0,width:w,height:h});}
    else{p.drawRectangle({x:0,y:h*.8,width:w,height:h*.2,color:rgb(.094,.188,.5)});p.drawRectangle({x:0,y:0,width:w,height:h*.2,color:rgb(.094,.188,.5)});p.drawRectangle({x:0,y:0,width:w*.15,height:h,color:rgb(.094,.188,.5)});p.drawRectangle({x:w*.85,y:0,width:w*.15,height:h,color:rgb(.094,.188,.5)});p.drawText('LOCKED VECTOR PDF',{x:w*.2,y:h*.9,size:12,font,color:rgb(1,1,1)});}
   }
   fixtures[kind]=Buffer.from(await pdf.save());fs.writeFileSync(path.join(output,kind+'.pdf'),fixtures[kind]);
  }
  const red=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=200;c.height=200;const x=c.getContext('2d');x.fillStyle='#e02020';x.fillRect(0,0,200,200);return c.toDataURL('image/png').split(',')[1];}),'base64');
  await page.getByRole('dialog',{name:/Custom Photo Studio/}).waitFor();await editor.waitFor();
  const canvas=editor.locator('[data-studio-canvas]');
  const pixel=async(x,y)=>{const bytes=await canvas.screenshot();return await page.evaluate(async({url,x,y})=>{const image=new Image();image.src=url;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return Array.from(ctx.getImageData(Math.floor(x*image.width),Math.floor(y*image.height),1,1).data);},{url:'data:image/png;base64,'+bytes.toString('base64'),x,y});};
  const isRed=p=>p[0]>180&&p[1]<75&&p[2]<75;
  const isWhite=p=>p[0]>230&&p[1]>230&&p[2]>230;
  async function importPdf(kind,replace=true,range){
   console.log('Importing '+kind);
   await editor.getByRole('button',{name:'Import PDF',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Import PDF artwork',exact:true});await dialog.waitFor();
   await dialog.getByLabel('PDF file',{exact:true}).setInputFiles({name:kind+'.pdf',mimeType:'application/pdf',buffer:fixtures[kind]});await dialog.getByRole('button',{name:'Import pages',exact:true}).waitFor();
   await dialog.getByLabel('Pages to import',{exact:true}).waitFor({timeout:20000}).catch(async error=>{console.error(await dialog.innerText());throw error;});
   if(kind==='flat'){await dialog.getByLabel('Pages to import',{exact:true}).fill('0');await dialog.getByRole('button',{name:'Import pages',exact:true}).click();await dialog.getByRole('alert').waitFor();assert.match(await dialog.getByRole('alert').innerText(),/Choose pages/);await dialog.getByLabel('Pages to import',{exact:true}).fill('1');}
   if(range!==undefined)await dialog.getByLabel('Pages to import',{exact:true}).fill(range);
   await dialog.getByLabel('PDF import destination').selectOption(replace?'replace':'append');
   await dialog.getByRole('button',{name:'Import pages',exact:true}).click();await dialog.waitFor({state:'hidden',timeout:15000}).catch(async error=>{console.error(await dialog.innerText());await page.screenshot({path:path.join(output,'import-failure.png')});throw error;});console.log('Imported '+kind);
   await canvas.locator('svg image').evaluate(async img=>{const source=new Image();source.src=img.getAttribute('href');await source.decode();});
  }
  async function addPhoto(){await editor.locator('input[accept="image/*"]').nth(1).setInputFiles({name:'red-photo.png',mimeType:'image/png',buffer:red});await editor.getByLabel('Position relative to PDF').waitFor();assert.equal(await editor.getByLabel('Position relative to PDF').inputValue(),'below');await canvas.click({position:{x:3,y:3}});}
  // Flattened white openings remain opaque until a non-destructive cutout is added.
  await importPdf('flat');await addPhoto();assert.ok(isWhite(await pixel(.5,.4)),'White source hides a photo underneath');
  await editor.getByRole('button',{name:'Add cutout',exact:true}).click();await editor.getByRole('button',{name:'Finish cutouts',exact:true}).click();assert.ok(isRed(await pixel(.5,.4)),'Cutout reveals photo');
  await editor.getByRole('button',{name:'Undo',exact:true}).click();assert.ok(isWhite(await pixel(.5,.4)),'Undo restores source appearance');await editor.getByRole('button',{name:'Redo',exact:true}).click();assert.ok(isRed(await pixel(.5,.4)),'Redo restores opening');
  await editor.getByRole('button',{name:'Edit cutouts',exact:true}).click();await editor.getByLabel('Opening 1 shape').selectOption('oval');await editor.getByRole('button',{name:'Finish cutouts',exact:true}).click();assert.ok(isWhite(await pixel(.31,.31)),'Oval leaves its corners covered');assert.ok(isRed(await pixel(.5,.4)),'Oval opens its center');
  // Touch drag is grouped as one undo, precise inputs remain available.
  await editor.getByRole('button',{name:'Edit cutouts',exact:true}).click();const handle=canvas.getByLabel('Move opening 1');let box=await handle.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+40,box.y+box.height/2+15,{steps:5});await page.mouse.up();
  const moved=await editor.getByLabel('Opening 1 x percent').inputValue();assert.ok(Number(moved)>30);await editor.getByRole('button',{name:'Undo',exact:true}).click();assert.equal(Number(await editor.getByLabel('Opening 1 x percent').inputValue()),30);
  await editor.getByLabel('Opening 1 shape').selectOption('rectangle');await editor.getByRole('button',{name:'Finish cutouts',exact:true}).click();
  // Studio objects can freely change sides without touching PDF objects.
  await editor.getByRole('button',{name:/Photo art Below/}).click();await editor.getByLabel('Position relative to PDF').selectOption('above');await canvas.click({position:{x:3,y:3}});assert.ok(isRed(await pixel(.5,.25)),'Above PDF covers white source');
  await editor.getByRole('button',{name:/Photo art Above/}).click();await editor.getByLabel('Position relative to PDF').selectOption('below');await canvas.click({position:{x:3,y:3}});assert.ok(isWhite(await pixel(.5,.25)),'Below PDF respects white source outside cutout');console.log('Cutouts and placement passed');
  await editor.getByRole('textbox',{name:'Template name'}).fill('PDF roundtrip');await editor.getByRole('button',{name:'Save',exact:true}).click();await page.waitForFunction(()=>window.fixtureToast?.title==='Template saved');
  const saved=await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('trinity-document-studio',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('templates').objectStore('templates').getAll();q.onsuccess=()=>{resolve(q.result[0]);db.close()};q.onerror=()=>reject(q.error)};}));
  assert.equal(saved.pages[0].pdfArtwork.cutouts.length,1);assert.equal(saved.pages[0].layers[0].pdfPlacement,'below');assert.ok(Object.values(saved.pdfSources)[0].blob);assert.equal(Object.values(saved.pdfSources)[0].dataUrl,undefined,'New sources avoid base64 copies');const sourceHash=await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('trinity-document-studio',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('templates').objectStore('templates').getAll();q.onsuccess=async()=>{const blob=Object.values(q.result[0].pdfSources)[0].blob;resolve(Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))).map(x=>x.toString(16).padStart(2,'0')).join(''));db.close();};};}));assert.equal(sourceHash,require('crypto').createHash('sha256').update(fixtures.flat).digest('hex'),'Original PDF bytes are unchanged');
  await page.screenshot({path:path.join(output,'flat-cutout-desktop.png')});
  await editor.getByRole('button',{name:'2. Pupils & output',exact:true}).click();await editor.getByRole('button',{name:/Select all 1 filtered pupils/}).click();await editor.getByRole('button',{name:'Open in-app print preview',exact:true}).click();await page.waitForFunction(()=>window.fixturePDF instanceof Blob,{},{timeout:60000});
  fs.writeFileSync(path.join(output,'flat-cutout-export.pdf'),Buffer.from(await page.evaluate(async()=>Array.from(new Uint8Array(await window.fixturePDF.arrayBuffer())))));await page.evaluate(()=>window.fixturePDF=null);
  await editor.getByRole('button',{name:'1. Design',exact:true}).click();
  await importPdf('vector');await addPhoto();assert.ok(isRed(await pixel(.5,.4)),'Transparent vector PDF permits photo underneath without cutouts');assert.ok((await pixel(.1,.4))[2]>100,'PDF frame remains visible');
  await page.screenshot({path:path.join(output,'vector-desktop.png')});
  // Mixed dimensions remain independent of the template's default paper size.
  await importPdf('mixed');assert.ok(await canvas.evaluate(el=>el.clientWidth>el.clientHeight),'Landscape source uses landscape canvas');
  await editor.getByRole('button',{name:'2. Pupils & output',exact:true}).click();await editor.getByRole('button',{name:'Clear filtered pupils',exact:true}).click();await editor.getByRole('checkbox',{name:'Export once without pupil data',exact:true}).check();await editor.getByRole('button',{name:'Open in-app print preview',exact:true}).click();await page.waitForFunction(()=>window.fixturePDF instanceof Blob,{},{timeout:60000});
  const mixedExport=Buffer.from(await page.evaluate(async()=>Array.from(new Uint8Array(await window.fixturePDF.arrayBuffer()))));fs.writeFileSync(path.join(output,'mixed-export.pdf'),mixedExport);
  const check=await PDFDocument.load(mixedExport);assert.equal(check.getPageCount(),2);assert.ok(Math.abs(check.getPage(0).getWidth()-560)<.1);assert.ok(Math.abs(check.getPage(1).getWidth()-400)<.1);
  await editor.getByRole('button',{name:'1. Design',exact:true}).click();
  await editor.getByRole('button',{name:'Close editor'}).click();await editor.waitFor({state:'hidden'});await page.getByRole('button',{name:'Custom Photo Studio',exact:true}).click();await editor.waitFor();
  const savedSelector=editor.getByText('Saved on this device',{exact:true}).locator('..').getByRole('combobox');await savedSelector.click();await page.getByRole('option',{name:'PDF roundtrip',exact:true}).click();await page.waitForFunction(()=>!!document.querySelector('[data-studio-canvas] svg image'));assert.ok(isRed(await pixel(.5,.4)),'Saved template restores artwork, cutouts, and placement');
  await importPdf('vector',false);await editor.getByRole('button',{name:'Undo',exact:true}).click();assert.ok(isRed(await pixel(.5,.4)),'Undoing appended PDF pages restores the existing design');
  for(const size of [{width:320,height:720},{width:390,height:844},{width:812,height:375},{width:1440,height:900}]){await page.setViewportSize(size);await page.waitForTimeout(100);const body=await editor.locator('main').evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));assert.ok(body.scroll<=body.client+1);await page.screenshot({path:path.join(output,`pdf-${size.width}.png`)});}
  await page.setViewportSize({width:390,height:844});await editor.getByRole('button',{name:'Import PDF',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Import PDF artwork',exact:true});await dialog.waitFor();await dialog.getByLabel('PDF file',{exact:true}).setInputFiles({name:'broken.pdf',mimeType:'application/pdf',buffer:Buffer.from('not a pdf')});await dialog.getByRole('alert').waitFor({timeout:20000});assert.match(await dialog.getByRole('alert').innerText(),/could not be opened/);await page.screenshot({path:path.join(output,'mobile-import-error.png')});await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await dialog.waitFor({state:'hidden'});await editor.waitFor({state:'visible'});
  if(process.env.STUDIO_ENCRYPTED_PDF){await editor.getByRole('button',{name:'Import PDF',exact:true}).click();await dialog.getByLabel('PDF file',{exact:true}).setInputFiles(process.env.STUDIO_ENCRYPTED_PDF);await dialog.getByRole('alert').waitFor({timeout:20000});assert.match(await dialog.getByRole('alert').innerText(),/password protected/);await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await dialog.waitFor({state:'hidden'});console.log('Encrypted PDF reports a useful error');}
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({cases:['flattened PDF opaque and cutout','undo/redo','oval shape','drag group','above/below placement','source byte preservation','IndexedDB save and reopen','transparent vector artwork','mixed page dimensions','document-only export without pupils','append and undo','invalid page selection','responsive layout','invalid PDF',...(process.env.STUDIO_ENCRYPTED_PDF?['password-protected PDF']:[])],errors},null,2));console.log('STUDIO_PDF_BROWSER_OK');
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
