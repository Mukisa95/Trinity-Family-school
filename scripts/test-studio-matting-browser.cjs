// Real local models: compare the former selfie mask with portrait alpha matting.
// Pass at least two public sample files as command arguments. No school records are loaded.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/studio-matting-qa');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 await require('esbuild').build({absWorkingDir:root,stdin:{contents:`import{PhotoToolsClient}from'./src/lib/photo/photo-tools-client';import{StudioObjectClient}from'./src/lib/photo/studio-object-client';import{segmentStudioPortrait,disposeStudioMatting}from'./src/lib/photo/studio-matting-client';import{studioPersonSelection}from'./src/components/docx/studio-photo-treatment';import{extractSelectedPixels}from'./src/components/docx/studio-selection';window.tools={PhotoToolsClient,StudioObjectClient,segmentStudioPortrait,disposeStudioMatting,studioPersonSelection,extractSelectedPixels};`,resolveDir:root,loader:'ts'},bundle:true,platform:'browser',format:'iife',alias:{'@':path.join(root,'src')},outfile:path.join(out,'fixture.js')});
 const server=http.createServer((req,res)=>{
  if(req.url==='/fixture.js'){res.setHeader('Content-Type','text/javascript');return res.end(fs.readFileSync(path.join(out,'fixture.js')));}
  const file=path.resolve(root,'public','.'+req.url);
  if(file.startsWith(path.join(root,'public')+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){res.setHeader('Content-Type',/\.m?js$/.test(file)?'text/javascript':file.endsWith('.wasm')?'application/wasm':'application/octet-stream');return res.end(fs.readFileSync(file));}
  res.end('<!doctype html><html><body><script src="/fixture.js"></script></body></html>');
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  const samples=process.argv.slice(2);assert.ok(samples.length>=2,'Provide at least two different public portraits.');
  browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();const errors=[],uploads=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))uploads.push(r.url());});
  await page.goto('http://127.0.0.1:'+server.address().port);const results=[];
  for(const [index,file]of samples.entries()){
   const result=await page.evaluate(async source=>{
    const t=window.tools,img=new Image();img.src=source;await img.decode();const c=document.createElement('canvas');const scale=Math.min(1,768/Math.max(img.width,img.height));c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);const ctx=c.getContext('2d');ctx.drawImage(img,0,0,c.width,c.height);const original=ctx.getImageData(0,0,c.width,c.height);
    const person=new t.PhotoToolsClient(),edge=new t.StudioObjectClient();const start=performance.now();
    const old=t.studioPersonSelection(await edge.refine(c,await person.segment(c)),c.width,c.height);person.dispose();edge.dispose();
    const inference=performance.now();const current=t.studioPersonSelection(await t.segmentStudioPortrait(c),c.width,c.height);const elapsed=performance.now()-inference;
    const montage=document.createElement('canvas');montage.width=c.width*3;montage.height=c.height+32;const m=montage.getContext('2d');m.fillStyle='#202735';m.fillRect(0,0,montage.width,montage.height);m.fillStyle='white';m.font='16px sans-serif';['Original','Previous selfie mask','Portrait matting'].forEach((name,i)=>m.fillText(name,i*c.width+8,22));m.drawImage(c,0,32);
    const stats=[];for(const [i,mask]of [old,current].entries()){ctx.putImageData(new ImageData(t.extractSelectedPixels(original.data,mask),c.width,c.height),0,0);m.drawImage(c,(i+1)*c.width,32);stats.push({foreground:mask.filter(v=>v>245).length,transparent:mask.filter(v=>v<10).length,soft:mask.filter(v=>v>=10&&v<=245).length});}
    return{image:montage.toDataURL('image/png'),stats,elapsed,total:performance.now()-start};
   },'data:image/jpeg;base64,'+fs.readFileSync(file).toString('base64'));
   fs.writeFileSync(path.join(out,'comparison-'+index+'.png'),Buffer.from(result.image.split(',')[1],'base64'));delete result.image;results.push({sample:path.basename(file),...result});assert.ok(result.stats[1].foreground>100);assert.ok(result.stats[1].transparent>100);console.log('Matting sample passed:',path.basename(file),Math.round(result.elapsed)+'ms');
  }
  // Cached processing tools must work after the network is unavailable.
  await page.context().setOffline(true);await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=128;c.height=128;await window.tools.segmentStudioPortrait(c);window.tools.disposeStudioMatting();});
  assert.deepEqual(errors,[]);assert.deepEqual(uploads,[]);fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({results,offline:true,uploads,errors},null,2));console.log('STUDIO_MATTING_BROWSER_OK');
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
