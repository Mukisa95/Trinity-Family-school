// Browser regression for document-wide pupil photo treatment using two distinct public sample portraits.
// Set PLAYWRIGHT_MODULE if Playwright is supplied by an external runtime.
// Requires STUDIO_TEST_PORTRAIT pointing to a public sample portrait. No school data is loaded.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const esbuild=require('esbuild'),ts=require('typescript');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'output/studio-pupil-treatment-qa');
process.chdir(root);
const mocks={
 '@/lib/pdf/pdf-workspace-context':`export const usePDFWorkspace=()=>({documents:[],mode:'expanded'});`,
 '@/lib/contexts/auth-context':`export const useAuth=()=>({user:{id:'studio-fixture',role:'Admin',isActive:true},isLocked:false,canAccessPage:()=>true});`,
 'next/navigation':`export const usePathname=()=>'/docx',useRouter=()=>({push(){},replace(){},prefetch(){}});`,
 'next/link':`import React from 'react';export default ({href,children,...props})=><a href={href} {...props}>{children}</a>;`,
 '@/lib/contexts/navigation-context':`export const useNavigation=()=>({isNavigating:false,destination:null,isSlow:false,goBack(){}});`,
 '@/lib/offline/android-bridge':`export const hasAndroidOfflineBridge=()=>false,androidOfflineRequest=async()=>({});`,
 '@/lib/hooks/use-pupils':`const data=[{id:'pupil',firstName:'AMINA',lastName:'EXAMPLE',status:'Active',gender:'Female',section:'Boarding',classId:'P4',className:'Primary Four',admissionNumber:'FIXTURE001',get photo(){return window.fixturePhotoA||'';}},{id:'pupil-b',firstName:'JOHN',lastName:'EXAMPLE',status:'Active',classId:'P4',className:'Primary Four',admissionNumber:'FIXTURE002',get photo(){return window.fixturePhotoB||'';}}];window.fixturePupils=data;export const usePupils=()=>({data,isLoading:false});`,
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
import{getStudioPupilTreatmentRaster,rasterizeStudioLayer}from'./src/components/docx/custom-photo-renderer';window.fixtureRenderer={getStudioPupilTreatmentRaster,rasterizeStudioLayer};
function App(){const[desktop,setDesktop]=useState(innerWidth>=768);useEffect(()=>{const resize=()=>setDesktop(innerWidth>=768);addEventListener('resize',resize);return()=>removeEventListener('resize',resize)},[]);
return <PhotoStudioWorkspaceProvider><div className={desktop?'dashboard-bg-wrapper flex w-full':'flex w-full'}>
{desktop&&<aside className="w-64 shrink-0 bg-card p-4">School navigation</aside>}
<div data-sidebar={desktop?'inset':undefined} className="relative flex h-[100dvh] min-w-0 flex-1 flex-col overflow-hidden">
<header className="app-topbar sticky top-0 z-40 h-11 shrink-0 bg-card px-4 sm:h-[52px] md:absolute md:left-0 md:right-0"><button className="h-full">School topbar</button></header>
<main data-fixture-scroller className="min-h-0 flex-1 overflow-y-auto px-3 md:px-6 md:pt-[52px]"><NavigationContent><DocXPage/></NavigationContent></main>
</div></div><LazyPhotoStudioWorkspace/></PhotoStudioWorkspaceProvider>};createRoot(document.getElementById('app')).render(<App/>);`;
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 await esbuild.build({absWorkingDir:root,stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,format:'esm',platform:'browser',jsx:'automatic',alias:{'@':path.join(root,'src')},outfile:path.join(output,'fixture.js'),define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},plugins:[{name:'synthetic-records',setup(b){b.onResolve({filter:/.*/},a=>Object.hasOwn(mocks,a.path)?{path:a.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:root}));b.onLoad({filter:/studio-pdf\.ts$/},a=>({contents:fs.readFileSync(a.path,'utf8').replace("new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()","'/pdf.worker.min.mjs'"),loader:'ts',resolveDir:path.dirname(a.path)}));}}]});
 const config={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync('tailwind.config.ts','utf8'),{compilerOptions:{module:1}}).outputText)(require,config,config.exports);
 const css=['globals.css','theme.css','brand-theme.css'].map(p=>fs.readFileSync(path.join(root,'src/app',p),'utf8').replace(/^@import[^;]+;/,'')).join('\n');
 const cssPath=path.join(output,'fixture.css');
 if(!fs.existsSync(cssPath)||fs.statSync(cssPath).mtimeMs<Math.max(...['custom-photo-studio.tsx','studio-pdf-controls.tsx','lazy-photo-studio-workspace.tsx','docx-fonts.ts','studio-layer-editor.tsx','studio-photo-treatment-controls.tsx'].map(file=>fs.statSync(path.join(root,'src/components/docx',file)).mtimeMs))){
  const built=await require('postcss')([require('tailwindcss')({...config.exports.default,content:[path.join(root,'src/**/*.{ts,tsx}'),{raw:fixture,extension:'tsx'}]})]).process(css,{from:path.join(root,'src/app/globals.css')});fs.writeFileSync(cssPath,built.css);
 }
 const server=http.createServer((req,res)=>{if(req.url==='/pdf.worker.min.mjs'){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(require.resolve('pdfjs-dist/build/pdf.worker.min.mjs')));return;}if(['/fixture.js','/fixture.css'].includes(req.url)){res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync(path.join(output,req.url.slice(1))));return;}
 const file=path.resolve(root,'public','.'+decodeURIComponent(req.url.split('?')[0]));if(file.startsWith(path.join(root,'public')+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){res.setHeader('Content-Type',(/\.m?js$/.test(file))?'text/javascript':file.endsWith('.wasm')?'application/wasm':file.endsWith('.jpg')?'image/jpeg':'application/octet-stream');res.end(fs.readFileSync(file));return;}
 res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="app"></div><script type="module" src="/fixture.js"></script></body></html>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 const errors=[];
 try{
  assert.ok(process.env.STUDIO_TEST_PORTRAIT,'Set STUDIO_TEST_PORTRAIT to a public sample portrait.');
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(20000);console.log('Browser ready');
  await page.goto('http://127.0.0.1:'+server.address().port);
  const portrait='data:image/jpeg;base64,'+fs.readFileSync(process.env.STUDIO_TEST_PORTRAIT).toString('base64');
  await page.evaluate(async source=>{
   const image=new Image();image.src=source;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
   const ctx=canvas.getContext('2d');ctx.translate(canvas.width,0);ctx.scale(-1,1);ctx.drawImage(image,0,0);
   window.fixturePhotoA=source;window.fixturePhotoB=canvas.toDataURL('image/png');
   const toBlob=HTMLCanvasElement.prototype.toBlob;window.fixtureSheets=[];
   HTMLCanvasElement.prototype.toBlob=function(callback,type,quality){if(type==='image/jpeg')window.fixtureSheets.push(this.toDataURL('image/png'));return toBlob.call(this,callback,type,quality);};
  },portrait);
  if(process.env.STUDIO_TEST_PORTRAIT_SECOND)await page.evaluate(src=>window.fixturePhotoB=src,'data:image/jpeg;base64,'+fs.readFileSync(process.env.STUDIO_TEST_PORTRAIT_SECOND).toString('base64'));
  const originalPhotos=await page.evaluate(()=>[window.fixturePhotoA,window.fixturePhotoB]);
  const editor=page.getByRole('dialog',{name:/Custom Photo Studio/}),workspace=page.getByRole('dialog',{name:/Select & refine/});
  const snapshot=async()=>{await editor.getByRole('button',{name:'Save',exact:true}).click();await page.waitForFunction(()=>window.fixtureToast?.title==='Template saved');await page.waitForTimeout(150);return page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('trinity-document-studio',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('templates').objectStore('templates').getAll();q.onsuccess=()=>{resolve(q.result.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0]);db.close();};};}));};
  const openTools=async()=>{await editor.getByRole('button',{name:'Background remover & object selector',exact:true}).click();await workspace.waitFor({timeout:60000});await workspace.getByRole('button',{name:'Zoom selection out',exact:true}).click();await workspace.getByRole('button',{name:'Zoom selection out',exact:true}).click();};
  // Keep the entire portrait visible so synthetic pointer gestures never hit the fixed footer.
  const remove=async()=>{await workspace.getByRole('button',{name:'Remove photo background',exact:true}).click();await page.waitForFunction(()=>{const el=document.querySelector('[aria-label="Layer selection workspace"]');return el&&!el.querySelector('[role="status"]');},{},{timeout:90000});assert.equal(await workspace.getByRole('alert').count(),0);};
  const processed=async name=>{const image=editor.getByRole('img',{name:'Background removed · '+name,exact:true});await image.first().waitFor({timeout:90000}).catch(async error=>{console.error((await editor.innerText()).slice(-2500));await page.screenshot({path:path.join(output,'failure.png')});throw error;});return image.first().getAttribute('src');};
  await page.getByRole('dialog',{name:/Custom Photo Studio/}).waitFor();await editor.waitFor();
  await editor.locator('aside').first().getByRole('button',{name:'Pupil photo',exact:true}).click();await openTools();
  assert.equal(await workspace.getByLabel('Background removal scope').inputValue(),'document','Background removal defaults to all pupils');
  for(const size of [{width:320,height:720},{width:390,height:844},{width:812,height:375},{width:1440,height:900}]){
   await page.setViewportSize(size);const scope=workspace.getByLabel('Background removal scope');await scope.scrollIntoViewIfNeeded();
   const bounds=await workspace.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth})),box=await scope.boundingBox();assert.ok(bounds.scroll<=bounds.client+1);assert.ok(box.x>=0&&box.x+box.width<=size.width+1,'Pupil scope stays within the mobile viewport');
   await page.screenshot({path:path.join(output,`pupil-selection-${size.width}.png`)});
  }
  console.log('Pupil selection scope fits mobile, landscape and desktop');
  if(process.env.STUDIO_TEST_MOBILE_ONLY){assert.deepEqual(errors,[]);console.log('STUDIO_PUPIL_TREATMENT_MOBILE_OK');return;}
  await remove();await workspace.getByRole('spinbutton',{name:'Feather amount',exact:true}).fill('8');await workspace.getByRole('slider',{name:'Expand or contract edge',exact:true}).fill('-2');
  const previewA=await workspace.getByLabel('Layer selection canvas',{exact:true}).evaluate(c=>c.toDataURL('image/png'));
  await workspace.getByRole('button',{name:'Keep selection / remove background',exact:true}).click();await workspace.waitFor({state:'hidden'});
  let stored=await snapshot();assert.deepEqual(stored.pupilPhotoTreatment,{removeBackground:true,feather:8,edgeShift:-2});
  assert.ok(!stored.pages[0].layers[0].pupilImageEdits?.pupil,'Shared treatment stores instructions, not the first pupil portrait');
  const processedA=await processed('EXAMPLE AMINA');assert.equal(processedA,previewA,'Shared preview uses exactly the same AI, matte and feather pipeline');
  await editor.getByRole('button',{name:'2. Pupils & output',exact:true}).click();await editor.getByRole('button',{name:/JOHN/}).click();await editor.getByRole('button',{name:'1. Design',exact:true}).click();
  const processedB=await processed('EXAMPLE JOHN');assert.notEqual(processedB,processedA,'Selecting another pupil processes their own photo automatically');
  console.log('Automatic document scope, exact preview match and later pupil selection passed');
  const originalLayerCount=(await snapshot()).pages[0].layers.length;
  const waitSelection=async()=>{await page.waitForFunction(()=>{const el=document.querySelector('[aria-label="Layer selection workspace"]');return el&&!el.querySelector('[role="status"]');},{},{timeout:120000});assert.equal(await workspace.getByRole('alert').count(),0);};
  const clickObject=async()=>{await workspace.getByRole('button',{name:'AI object',exact:true}).click();const box=await workspace.getByLabel('Layer selection canvas',{exact:true}).boundingBox();await page.mouse.click(box.x+box.width*.5,box.y+box.height*.4);await waitSelection();};
  const ownRasters=async(layer,settings)=>page.evaluate(async({layer,settings})=>{const output=[];for(const pupil of window.fixturePupils)output.push(await window.fixtureRenderer.getStudioPupilTreatmentRaster(layer,{pupil,pupilPhotoTreatment:settings},{widthMm:210,heightMm:297}));return output;},{layer,settings});
  await openTools();await clickObject();await workspace.getByRole('button',{name:'Keep selection / remove background',exact:true}).click();await workspace.waitFor({state:'hidden'});
  stored=await snapshot();assert.equal(stored.pupilPhotoTreatment.selection[0].tool,'object');
  const objectRasters=await ownRasters(stored.pages[0].layers[0],stored.pupilPhotoTreatment);assert.notEqual(objectRasters[0],objectRasters[1]);
  for(let i=0;i<objectRasters.length;i++)fs.writeFileSync(path.join(output,'object-pupil-'+i+'.png'),Buffer.from(objectRasters[i].split(',')[1],'base64'));
  await openTools();await workspace.getByRole('button',{name:'Rectangle',exact:true}).click();let cutBox=await workspace.getByLabel('Layer selection canvas',{exact:true}).boundingBox();await page.mouse.move(cutBox.x+cutBox.width*.3,cutBox.y+cutBox.height*.2);await page.mouse.down();await page.mouse.move(cutBox.x+cutBox.width*.7,cutBox.y+cutBox.height*.8);await page.mouse.up();
  await workspace.getByRole('button',{name:'Layer via cut',exact:true}).click();await workspace.waitFor({state:'hidden'});stored=await snapshot();
  const cutSource=stored.pages[0].layers[0],cutCopy=stored.pages[0].layers.at(-1);assert.equal(cutSource.photoSelection.keep,false);assert.equal(cutCopy.kind,'avatar');assert.equal(cutCopy.pupilScopeId,undefined);assert.equal(cutCopy.rasterOverride,undefined);
  const cuts=await ownRasters(cutSource,stored.pupilPhotoTreatment),copies=await ownRasters(cutCopy,stored.pupilPhotoTreatment);assert.notEqual(copies[0],copies[1]);
  const alpha=await page.evaluate(async({cuts,copies})=>{const sums=[];for(let n=0;n<cuts.length;n++){const data=[];for(const src of [cuts[n],copies[n]]){const img=new Image();img.src=src;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);data.push(ctx.getImageData(Math.floor(c.width*.5),Math.floor(c.height*.5),1,1).data[3]);}sums.push(data);}return sums;},{cuts,copies});assert.ok(alpha.every(([outside,inside])=>outside<10&&inside>240));
  await editor.getByRole('button',{name:'Undo',exact:true}).click();
  await openTools();await clickObject();await workspace.getByRole('button',{name:'Layer via copy',exact:true}).click();await workspace.waitFor({state:'hidden'});stored=await snapshot();assert.equal(stored.pages[0].layers.at(-1).photoSelection.selection[0].tool,'object');
  const objectCopies=await ownRasters(stored.pages[0].layers.at(-1),stored.pupilPhotoTreatment);assert.notEqual(objectCopies[0],objectCopies[1]);
  await editor.getByRole('button',{name:'Undo',exact:true}).click();await editor.getByRole('button',{name:'Undo',exact:true}).click();stored=await snapshot();assert.equal(stored.pupilPhotoTreatment.selection,undefined);assert.equal(stored.pages[0].layers.length,originalLayerCount);
  console.log('Shared AI object masks, dynamic object copies and complementary cuts passed for distinct pupils');

  await editor.getByRole('button',{name:'Add layer',exact:true}).click();await page.getByRole('menuitem',{name:'Pupil photo',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('img[alt="Background removed · EXAMPLE JOHN"]').length===2,{},{timeout:90000});
  // Manual geometry remains a pupil-specific correction even when shared removal is active.
  await openTools();await workspace.getByLabel('Background removal scope').selectOption('pupil');assert.equal(await workspace.getByRole('spinbutton',{name:'Feather amount',exact:true}).inputValue(),'8','The selection editor remembers the shared feather amount');await workspace.getByRole('button',{name:'Rectangle',exact:true}).click();
  const box=await workspace.getByLabel('Layer selection canvas',{exact:true}).boundingBox();
  await page.mouse.move(box.x+box.width*.3,box.y+box.height*.2);await page.mouse.down();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.8);await page.mouse.up();
  await workspace.getByRole('button',{name:'Keep selection / remove background',exact:true}).click();await workspace.waitFor({state:'hidden'});
  stored=await snapshot();assert.ok(stored.pages[0].layers.at(-1).pupilImageEdits['pupil-b']);assert.equal(stored.pupilPhotoTreatment.removeBackground,true);
  await editor.getByRole('button',{name:'Undo',exact:true}).click();await processed('EXAMPLE JOHN');
  await editor.getByRole('button',{name:'Undo',exact:true}).click(); // Remove the additional photo layer.
  // Explicit single-pupil automatic removal must leave shared settings untouched.
  await openTools();await workspace.getByLabel('Background removal scope').selectOption('pupil');await remove();
  await workspace.getByRole('spinbutton',{name:'Feather amount',exact:true}).fill('12');
  await workspace.getByRole('button',{name:'Keep selection / remove background',exact:true}).click();await workspace.waitFor({state:'hidden'});
  stored=await snapshot();assert.equal(stored.pupilPhotoTreatment.feather,8);assert.ok(stored.pages[0].layers[0].pupilImageEdits['pupil-b']);
  await editor.getByRole('button',{name:'Undo',exact:true}).click();
  stored=await snapshot();
  await editor.getByRole('checkbox',{name:'Remove backgrounds from all pupil photos',exact:true}).uncheck();assert.equal(await editor.getByRole('spinbutton',{name:'Shared photo feather',exact:true}).count(),0);
  await editor.getByRole('checkbox',{name:'Remove backgrounds from all pupil photos',exact:true}).check();assert.equal(await editor.getByRole('spinbutton',{name:'Shared photo feather',exact:true}).inputValue(),'8');await processed('EXAMPLE JOHN');
  await snapshot();
  console.log('New photo layers, individual corrections, single-pupil scope and toggle controls passed');
  await editor.getByRole('button',{name:'Close editor',exact:true}).click();await page.getByRole('button',{name:'Custom Photo Studio',exact:true}).click();await editor.waitFor();
  await editor.getByRole('combobox').filter({hasText:'Open saved template'}).click();await page.getByRole('option',{name:stored.name,exact:true}).click();
  assert.equal(await editor.getByRole('checkbox',{name:'Remove backgrounds from all pupil photos',exact:true}).isChecked(),true);assert.equal(await editor.getByRole('spinbutton',{name:'Shared photo feather',exact:true}).inputValue(),'8');await processed('EXAMPLE AMINA');
  for(const size of [{width:320,height:720},{width:390,height:844},{width:1440,height:900}]){
   await page.setViewportSize(size);await page.waitForTimeout(100);const bounds=await editor.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));assert.ok(bounds.scroll<=bounds.client+1);await editor.getByRole('checkbox',{name:'Remove backgrounds from all pupil photos',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,`shared-treatment-${size.width}.png`)});
  }
  await page.evaluate(()=>document.documentElement.classList.add('dark'));await page.screenshot({path:path.join(output,'shared-treatment-dark.png')});
  await editor.getByRole('button',{name:'2. Pupils & output',exact:true}).click();await editor.getByRole('button',{name:/Select all 2 filtered pupils/}).click();await editor.getByRole('button',{name:'Open in-app print preview',exact:true}).click();
  await page.waitForFunction(()=>window.fixturePDF instanceof Blob,{},{timeout:120000});
  const pdfBytes=Buffer.from(await page.evaluate(async()=>Array.from(new Uint8Array(await window.fixturePDF.arrayBuffer()))));fs.writeFileSync(path.join(output,'shared-treatment-export.pdf'),pdfBytes);
  const {PDFDocument}=require('pdf-lib');assert.equal((await PDFDocument.load(pdfBytes)).getPageCount(),2);
  const sheets=await page.evaluate(()=>window.fixtureSheets);assert.equal(sheets.length,2);assert.notEqual(sheets[0],sheets[1],'Printed pupil pages remain distinct');
  for(let index=0;index<sheets.length;index++)fs.writeFileSync(path.join(output,`sheet-${index+1}.png`),Buffer.from(sheets[index].split(',')[1],'base64'));
  // Check actual canvas output at a pixel the AI removed inside the original frame.
  const printed=await page.evaluate(async({processedA,layer})=>{
   const load=async src=>{const img=new Image();img.src=src;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return {c,ctx,pixels:ctx.getImageData(0,0,c.width,c.height).data};};
   const raw=await window.fixtureRenderer.rasterizeStudioLayer(layer,{pupil:window.fixturePupils[0]},{widthMm:210,heightMm:297});
   const original=raw.getContext('2d').getImageData(0,0,raw.width,raw.height).data,treated=await load(processedA),sheet=await load(window.fixtureSheets[0]);let sample;
   for(let y=Math.floor(raw.height*.15);y<raw.height*.85&&!sample;y+=5)for(let x=Math.floor(raw.width*.15);x<raw.width*.85;x+=5){const i=(y*raw.width+x)*4;if(original[i+3]===255&&treated.pixels[i+3]===0){sample={x:x/raw.width,y:y/raw.height};break;}}
   if(!sample)throw new Error('No removed opaque background sample found.');
   const rgba=[...sheet.ctx.getImageData(Math.floor((layer.x+layer.width*sample.x)*sheet.c.width),Math.floor((layer.y+layer.height*sample.y)*sheet.c.height),1,1).data];
   return {sample,rgba};
  },{processedA,layer:stored.pages[0].layers[0]});
  assert.ok(printed.rgba.slice(0,3).every(v=>v>245),'The printed sheet shows white through the removed photo background');
  assert.deepEqual(await page.evaluate(()=>[window.fixturePhotoA,window.fixturePhotoB]),originalPhotos,'Stored pupil photos remain unchanged');
  console.log('Save/reopen, responsive controls and two-pupil PDF output passed');
  // A failed photo must report the pupil, and retrying the same URL must recover.
  let allowPhoto=false;await page.route('**/retry-portrait.jpg',route=>allowPhoto?route.fulfill({status:200,contentType:'image/jpeg',body:fs.readFileSync(process.env.STUDIO_TEST_PORTRAIT)}):route.fulfill({status:404,body:''}));
  const retry=()=>page.evaluate(async layer=>{try{return await window.fixtureRenderer.getStudioPupilTreatmentRaster(layer,{pupil:{id:'retry',firstName:'RETRY',lastName:'PUPIL',photo:location.origin+'/retry-portrait.jpg'},pupilPhotoTreatment:{removeBackground:true,feather:8,edgeShift:-2}},{widthMm:210,heightMm:297});}catch(error){return {error:error.message};}},stored.pages[0].layers[0]);
  assert.match((await retry()).error,/Background removal failed for PUPIL RETRY/);allowPhoto=true;assert.match(await retry(),/^data:image\/png/);
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({cases:['shared AI object masks','dynamic object copies for distinct pupils','shared geometric cuts and complementary alpha','automatic document scope','exact interactive/batch preview','each pupil uses their own original photo','later pupil selection','new pupil photo layers','manual correction priority','single-pupil automatic scope','toggle retains treatment amount','saved shared instructions reopen','responsive and dark controls','two distinct printed pupil pages','printed background is removed','original records unchanged','failure names pupil and same-URL retry recovers'],printed,errors},null,2));
  console.log('STUDIO_PUPIL_TREATMENT_BROWSER_OK');
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1});
