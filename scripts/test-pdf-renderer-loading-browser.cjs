/* Real PDF job/helper behaviour; synthetic renderer documents and blobs only. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'output/pdf-renderer-loading-qa');
async function run(){
fs.mkdirSync(output,{recursive:true});
await require('esbuild').build({stdin:{resolveDir:root,loader:'tsx',contents:`
import React,{useEffect}from'react';import{createRoot}from'react-dom/client';
import{usePDFViewer}from'./src/lib/hooks/use-pdf-viewer';import{PDFWorkspaceProvider,useOptionalPDFWorkspace}from'./src/lib/pdf/pdf-workspace-context';
window.rendererLoads=0;window.renderedDocuments=[];
function View(){const api=usePDFViewer(),workspace=useOptionalPDFWorkspace();useEffect(()=>{window.pdfAPI=api;window.workspace=workspace},[api,workspace]);return <div id='state' data-open={api.isOpen} data-loading={api.isLoading} data-documents={workspace?.documents.length??0}>{api.pdfBlob?.size??0}</div>}
const render=createRoot(document.getElementById('root'));window.renderMode=global=>render.render(global?<PDFWorkspaceProvider><View/></PDFWorkspaceProvider>:<View/>);window.renderMode(false);
`},bundle:true,platform:'browser',format:'esm',splitting:true,jsx:'automatic',outdir:output,entryNames:'fixture',alias:{'@':path.join(root,'src')},define:{'process.env.NODE_ENV':'"production"'},
plugins:[{name:'synthetic-renderer',setup(build){build.onResolve({filter:/^@react-pdf\/renderer$/},()=>({path:'renderer',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',contents:`window.rendererLoads++;export function pdf(document){window.renderedDocuments.push(document.props.children);return {toBlob:async()=>{if(window.holdRenderer)await new Promise(resolve=>window.releaseRenderer=resolve);if(window.failRenderer)throw Error('Synthetic rendering error');return new Blob(['%PDF-synthetic'],{type:'application/pdf'})}};}`}));}}]});
const server=http.createServer((req,res)=>{if(req.url.endsWith('.js')){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(path.join(output,path.basename(req.url))));}else{res.setHeader('Content-Type','text/html');res.end('<div id="root"></div><script type="module" src="/fixture.js"></script>');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
try{
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>!!pdfAPI);assert.equal(await page.evaluate(()=>rendererLoads),0,'Mounting the helper never initializes the renderer');
await page.evaluate(()=>{window.holdRenderer=true;window.pendingPDF=pdfAPI.openPDF({type:'synthetic',props:{children:'original document'}},'example.pdf','Example');});await page.waitForFunction(()=>rendererLoads===1&&!!releaseRenderer);assert.equal(await page.locator('#state').getAttribute('data-loading'),'true');await page.evaluate(async()=>{holdRenderer=false;releaseRenderer();await pendingPDF});await page.waitForFunction(()=>document.querySelector('#state').dataset.open==='true');assert.deepEqual(await page.evaluate(()=>renderedDocuments),['original document']);assert.equal(await page.evaluate(()=>pdfAPI.fileName),'example.pdf');
await page.evaluate(()=>{renderMode(true)});await page.waitForFunction(()=>!!workspace);await page.evaluate(()=>{window.holdRenderer=true;window.releaseRenderer=null;window.pendingPDF=pdfAPI.openPDF({type:'synthetic',props:{children:'workspace document'}},'workspace.pdf','Workspace');});await page.waitForFunction(()=>workspace.documents[0]?.status==='generating'&&!!releaseRenderer);await page.evaluate(async()=>{holdRenderer=false;releaseRenderer();await pendingPDF});await page.waitForFunction(()=>workspace.documents[0]?.status==='ready');assert.equal(await page.evaluate(()=>rendererLoads),1,'Module reused between callers');assert.equal(await page.evaluate(()=>workspace.documents[0].fileName),'workspace.pdf');
await page.evaluate(()=>{window.failRenderer=true;window.errorPDF=pdfAPI.openPDF({type:'synthetic',props:{children:'failure'}},'fail.pdf','Fail').catch(e=>e.message)});await page.waitForFunction(()=>workspace.documents.some(d=>d.status==='error'));assert.equal(await page.evaluate(()=>errorPDF),'Synthetic rendering error');assert.deepEqual(errors,[]);
console.log('PDF_RENDERER_LOADING_BROWSER_OK: zero initialization on mount, deferred rendering, original document/metadata preserved, shared job progress and failures.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(error=>{console.error(error);process.exitCode=1});
