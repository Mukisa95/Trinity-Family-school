// Verify shared cut/copy instructions in actual two-pupil PDF pages, using synthetic photos.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/studio-shared-print-qa');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 await require('esbuild').build({absWorkingDir:root,stdin:{contents:`import{createCustomPhotoPdf}from'./src/components/docx/custom-photo-renderer';import{createBlankTemplate,createImageLayer}from'./src/components/docx/custom-photo-types';window.tools={createCustomPhotoPdf,createBlankTemplate,createImageLayer};`,resolveDir:root,loader:'ts'},bundle:true,format:'esm',platform:'browser',alias:{'@':path.join(root,'src')},outfile:path.join(out,'fixture.js'),plugins:[{name:'pdf-worker-url',setup(b){b.onLoad({filter:/studio-pdf\.ts$/},a=>({contents:fs.readFileSync(a.path,'utf8').replace("new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()","'/unused-pdf-worker.mjs'"),loader:'ts',resolveDir:path.dirname(a.path)}));}}]});
 const server=http.createServer((req,res)=>{if(req.url==='/fixture.js'){res.setHeader('Content-Type','text/javascript');return res.end(fs.readFileSync(path.join(out,'fixture.js')));}res.end('<!doctype html><html><body><script type="module" src="/fixture.js"></script></body></html>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.tools);
  const result=await page.evaluate(async()=>{
   const t=window.tools,template=t.createBlankTemplate(),source=t.createImageLayer('avatar');
   Object.assign(source,{x:.1,y:.1,width:.3,height:.4,shape:'rectangle'});source.appearance.stroke.enabled=false;
   const settings={removeBackground:true,feather:0,edgeShift:0,selection:[{tool:'rectangle',mode:'replace',points:[{x:.25,y:.25},{x:.75,y:.75}]}]};
   source.photoSelection={...settings,keep:false};const copy={...source,id:'shared-copy',x:.6,photoSelection:settings};template.pages[0].layers=[source,copy];
   const pupils=['#e92828','#20b050'].map((color,i)=>{const c=document.createElement('canvas');c.width=c.height=200;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,200,200);return{id:'synthetic-'+i,firstName:'Example '+i,photo:c.toDataURL('image/png')};});
   const sheets=[],toBlob=HTMLCanvasElement.prototype.toBlob;
   HTMLCanvasElement.prototype.toBlob=function(callback,type,quality){if(type==='image/jpeg')sheets.push(this.toDataURL('image/png'));return toBlob.call(this,callback,type,quality);};
   const pdf=await t.createCustomPhotoPdf(template,pupils,{}, {paperSize:'a4',orientation:'portrait',cardsPerPage:1,marginMm:0,gapMm:0,showCutLines:false});
   const samples=[];
   for(const src of sheets){const img=new Image();img.src=src;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);samples.push([[.25,.3],[.75,.3],[.13,.14],[.63,.14]].map(([x,y])=>[...ctx.getImageData(Math.floor(x*c.width),Math.floor(y*c.height),1,1).data]));}
   return{bytes:Array.from(new Uint8Array(await pdf.arrayBuffer())),sheets,samples};
  });
  const pdf=Buffer.from(result.bytes);fs.writeFileSync(path.join(out,'shared-cut-copy.pdf'),pdf);
  assert.equal((await require('pdf-lib').PDFDocument.load(pdf)).getPageCount(),2);assert.equal(result.sheets.length,2);
  result.samples.forEach(([cutCenter,copyCenter,cutCorner,copyCorner],i)=>{assert.ok(cutCenter.slice(0,3).every(v=>v>245));assert.ok(copyCorner.slice(0,3).every(v=>v>245));assert.ok(i===0?copyCenter[0]>200&&copyCenter[1]<80:copyCenter[1]>150&&copyCenter[0]<80);assert.deepEqual(cutCorner,copyCenter);fs.writeFileSync(path.join(out,'sheet-'+i+'.png'),Buffer.from(result.sheets[i].split(',')[1],'base64'));});
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({pages:2,samples:result.samples,errors},null,2));console.log('STUDIO_SHARED_PRINT_BROWSER_OK');
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
