/* Generate synthetic PDFs with the real renderer AND the complete app stylesheet.
 * Run: node scripts/timetable-pdf-qa.cjs
 * Open http://127.0.0.1:9022/frame.html?case=full (also sparse/dense).
 * Exported PDFs and label geometry are saved in output/pdf.
 * Rasterize each PDF with pdftoppm -f 1 -singlefile -scale-to 1600 -png,
 * then run python scripts/check-timetable-pdf-raster.py full.
 */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'output/pdf-timetable-qa');
const fixture=path.join(root,'tests/fixtures/timetable-pdf');
async function start(){
 fs.mkdirSync(output,{recursive:true});
 const config=require('typescript').transpileModule(fs.readFileSync(path.join(root,'tailwind.config.ts'),'utf8'),{compilerOptions:{module:1}}).outputText;
 const mod={exports:{}};new Function('require','module','exports',config)(require,mod,mod.exports);
 const css=fs.readFileSync(path.join(root,'src/app/globals.css'),'utf8').replace(/^@import[^;]+;/,'')+'\n'+fs.readFileSync(path.join(root,'src/app/theme.css'),'utf8');
 const built=await require('postcss')([require('tailwindcss')({...mod.exports.default,content:[path.join(root,'src/**/*.{ts,tsx}')]})]).process(css,{from:path.join(root,'src/app/globals.css')});
 fs.writeFileSync(path.join(output,'fixture.css'),built.css);
 const data=path.join(fixture,'data.tsx');
 await require('esbuild').build({absWorkingDir:root,entryPoints:[path.join(fixture,'entry.tsx')],bundle:true,platform:'browser',format:'iife',jsx:'automatic',alias:{'@/lib/hooks/use-school-settings':data,'@/lib/hooks/use-pdf-viewer':data,'@':path.join(root,'src')},define:{'process.env.NODE_ENV':'"development"'},outfile:path.join(output,'app.js')});
 const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>';
 http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  res.setHeader('Cache-Control','no-store');
  if(['/save-pdf','/save-labels'].includes(url.pathname)&&req.method==='POST'){
   const scenario=url.searchParams.get('case');
   if(!['full','sparse','dense'].includes(scenario)){res.writeHead(400);res.end();return;}
   const chunks=[];let size=0;
   req.on('data',chunk=>{size+=chunk.length;if(size>20*1024*1024){req.destroy();return;}chunks.push(chunk);});
   req.on('end',()=>{const dir=path.join(root,'output/pdf');fs.mkdirSync(dir,{recursive:true});const data=Buffer.concat(chunks);const extension=url.pathname==='/save-labels'?'.json':'.pdf';fs.writeFileSync(path.join(dir,'timetable-pdf-'+scenario+extension),data);console.log('Saved '+scenario+extension+': '+data.length+' bytes');res.end('saved');});return;
  }
  if(url.pathname==='/app.js'||url.pathname==='/fixture.css'){
   res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync(path.join(output,path.basename(url.pathname))));return;
  }
  res.setHeader('Content-Type','text/html');res.end(html);
 }).listen(9022,'127.0.0.1',()=>console.log('Timetable PDF QA: http://127.0.0.1:9022/frame.html?case=full'));
}
start().catch(error=>{console.error(error);process.exitCode=1});
