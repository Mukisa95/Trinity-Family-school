/* Real PDF.js rendering with synthetic documents; no school data or external writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const esbuild = require('esbuild');
const { jsPDF } = require('jspdf');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/page-zoom-qa');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function build() {
  fs.mkdirSync(output, { recursive: true });
  const pdf = new jsPDF({ unit: 'pt', format: [360, 480] });
  for (let i = 1; i <= 2; i++) {
    if (i > 1) pdf.addPage();
    pdf.setTextColor(15, 23, 42).setFontSize(22).text(`Trinity test report ${i}`, 28, 48);
    pdf.setFontSize(12).text('Document colours remain unchanged.', 28, 76);
    [[37, 99, 235], [5, 150, 105], [225, 29, 72]].forEach((rgb, n) => {
      pdf.setFillColor(...rgb).rect(28 + n * 102, 105, 92, 92, 'F');
    });
    pdf.setDrawColor(15, 23, 42).rect(28, 225, 300, 180);
    pdf.setTextColor(15, 23, 42).text('White paper • original PDF', 40, 250);
  }
  fs.writeFileSync(path.join(output, 'source.pdf'), Buffer.from(pdf.output('arraybuffer')));
  await esbuild.build({ absWorkingDir: root, stdin: { resolveDir: root, loader: 'tsx', contents: `
import React,{useEffect,useState} from 'react';import {createRoot} from 'react-dom/client';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';pdfjs.GlobalWorkerOptions.workerSrc='/worker.mjs';
import {ThemeProvider} from './src/components/providers/theme-provider';
import {ThemeToggle} from './src/components/ui/theme-toggle';
import {PDFWorkspaceProvider,usePDFWorkspace} from './src/lib/pdf/pdf-workspace-context';
import {PDFWorkspace} from './src/components/pdf/pdf-workspace';import {usePageSwipe} from './src/lib/hooks/use-page-swipe';
function Fixture(){const api=usePDFWorkspace();const [swipes,setSwipes]=useState(0);const swipe=usePageSwipe(()=>setSwipes(value=>value+1));useEffect(()=>{window.pdfAPI=api;window.swipeCount=swipes},[api,swipes]);return <div style={{'--theme-primary':'37 99 235'}}><main {...swipe} data-page-swipe className="h-[100dvh] overflow-auto bg-background p-6 text-foreground"><h1 className="text-xl">School workspace</h1><div data-zoom-anchor className="mt-6 h-40 rounded-xl border p-6">Pinch anywhere on the page</div><label>Search<input aria-label="School search" className="block h-12 border"/></label><div data-timetable-surface className="mt-6 h-48 overflow-auto touch-pan-x touch-pan-y touch-pinch-zoom"><div className="h-96 w-[1200px]">Timetable scroll surface</div></div><div className="h-[1200px]"/><p>End of page</p></main><div className="fixed bottom-4 left-4 z-[110]"><ThemeToggle/></div><PDFWorkspace/></div>}
createRoot(document.getElementById('app')).render(<ThemeProvider><PDFWorkspaceProvider><Fixture/></PDFWorkspaceProvider></ThemeProvider>);
` }, bundle: true, format: 'esm', jsx: 'automatic', platform: 'browser', alias: { '@': path.join(root, 'src') }, outfile: path.join(output, 'fixture.js'), define: { 'process.env.NODE_ENV': '"production"' } });
  const config = require('typescript').transpileModule(fs.readFileSync(path.join(root, 'tailwind.config.ts'), 'utf8'), { compilerOptions: { module: 1 } }).outputText;
  const mod = { exports: {} }; new Function('require', 'module', 'exports', config)(require, mod, mod.exports);
  const css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/^@import[^;]+;/, '') + '\n' + fs.readFileSync(path.join(root, 'src/app/theme.css'), 'utf8');
  const built = await require('postcss')([require('tailwindcss')({ ...mod.exports.default, content: [{raw:['src/components/pdf/pdf-document-viewer.tsx','src/components/pdf/pdf-workspace.tsx','src/components/ui/button.tsx','src/components/ui/progress.tsx','src/components/ui/dropdown-menu.tsx','src/components/ui/theme-toggle.tsx'].map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n')+fs.readFileSync(__filename,'utf8'),extension:'tsx'}] })]).process(css, { from: path.join(root, 'src/app/globals.css') });
  fs.writeFileSync(path.join(output, 'fixture.css'), built.css);
}
async function run() {
  await build();
  const server = http.createServer((req, res) => {
    const files = { '/fixture.js': ['text/javascript', path.join(output, 'fixture.js')], '/fixture.css': ['text/css', path.join(output, 'fixture.css')], '/source.pdf': ['application/pdf', path.join(output, 'source.pdf')], '/worker.mjs': ['text/javascript', path.join(root, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs')] };
    if (files[req.url]) { res.setHeader('Content-Type', files[req.url][0]); res.end(fs.readFileSync(files[req.url][1])); }
    else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="app"></div><script type="module" src="/fixture.js"></script></body></html>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const errors=[];
    const url=`http://127.0.0.1:${server.address().port}`;
    const results=[];
    async function setup(mobile){
      const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},hasTouch:true,isMobile:mobile,deviceScaleFactor:1});
      page.on('pageerror',error=>errors.push(error.message));await page.goto(url);await page.waitForFunction(()=>window.pdfAPI);return page;
    }
    async function pinch(page,target,source='touch',factor=1.6){
      const box=await target.boundingBox();const session=await page.context().newCDPSession(page);
      const before=await page.evaluate(()=>({scale:visualViewport.scale,width:visualViewport.width}));
      if(source==='mouse') await session.send('Input.synthesizePinchGesture',{x:box.x+box.width/2,y:Math.min(box.y+box.height/2,400),scaleFactor:factor,relativeSpeed:800,gestureSourceType:source});
      else {
        const viewport=page.viewportSize();const x=Math.max(110,Math.min(box.x+box.width/2,viewport.width-110));const y=Math.max(100,Math.min(box.y+box.height/2,viewport.height-120));
        // Raw touch points exercise Chromium's real touchscreen recognizer. Its synthetic touch pinch command is a no-op in headless Edge.
        for(let i=0;i<=12;i++){const distance=60*(1+(factor-1)*i/12);await session.send('Input.dispatchTouchEvent',{type:i===0?'touchStart':'touchMove',touchPoints:[{x:x-distance,y,id:0,radiusX:4,radiusY:4},{x:x+distance,y,id:1,radiusX:4,radiusY:4}]});await page.waitForTimeout(20);}
        await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      }
      await page.waitForTimeout(250);
      const after=await page.evaluate(()=>({scale:visualViewport.scale,width:visualViewport.width}));
      console.log('Pinch',source,before,after);results.push({source,mobile:await page.evaluate(()=>innerWidth<768),before,after});return {before,after,session};
    }
    const desktop=await setup(false);
    let native=await pinch(desktop,desktop.locator('[data-zoom-anchor]'),'mouse');
    console.log('Desktop touchpad pinch:',native.before,native.after);
    assert.ok(native.after.scale>native.before.scale+0.2,'Touchpad pinch must zoom the browser page');
    await native.session.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});
    native=await pinch(desktop,desktop.locator('[data-zoom-anchor]'),'touch');assert.ok(native.after.scale>1.2,'Desktop touchscreen pinch must zoom the page');await native.session.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});
    await desktop.evaluate(async()=>window.pdfAPI.addPDFBlob(await(await fetch('/source.pdf')).blob(),{title:'Test report',fileName:'test-report.pdf'}));
    const canvas=desktop.locator('[data-pdf-page="1"] canvas');await canvas.waitFor();await desktop.waitForFunction(()=>!document.querySelector('[aria-label="Rendering PDF page"]'));
    const label=desktop.getByRole('button',{name:'Show zoom controls',exact:true});const pdfZoom=await label.innerText();
    const pixelHash=()=>canvas.evaluate(c=>{let hash=0;const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=0;i<pixels.length;i++)hash=(hash*31+pixels[i])|0;return {hash,width:c.width,height:c.height}});
    const originalPixels=await pixelHash();
    for(const key of ['+','=','-','0'])for(const ctrl of [true,false]){
      const prevented=await desktop.evaluate(({key,ctrl})=>{const event=new KeyboardEvent('keydown',{key,ctrlKey:ctrl,metaKey:!ctrl,bubbles:true,cancelable:true});window.dispatchEvent(event);return event.defaultPrevented},{key,ctrl});assert.equal(prevented,false,'Browser zoom shortcut must remain available');
    }
    assert.equal(await label.innerText(),pdfZoom);
    const wheelBlocked=await canvas.evaluate(c=>{const event=new WheelEvent('wheel',{ctrlKey:true,deltaY:-60,bubbles:true,cancelable:true});c.dispatchEvent(event);return event.defaultPrevented});assert.equal(wheelBlocked,false);
    native=await pinch(desktop,canvas,'mouse');assert.ok(native.after.scale>1.2);assert.equal(await label.innerText(),pdfZoom);assert.deepEqual(await pixelHash(),originalPixels);
    await desktop.screenshot({path:path.join(output,'desktop-page-zoom-over-pdf.png')});
    await native.session.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});
    await desktop.keyboard.press('Control+f');await desktop.getByRole('searchbox',{name:'Search this PDF',exact:true}).waitFor();await desktop.getByRole('button',{name:'Close PDF search'}).click();
    await label.click();await desktop.getByRole('button',{name:'Reset zoom to 100 percent'}).click();await desktop.getByRole('button',{name:'Zoom in',exact:true}).click();assert.notEqual(await desktop.getByRole('button',{name:'Hide zoom controls',exact:true}).innerText(),pdfZoom);await desktop.getByRole('button',{name:'Reset zoom to 100 percent'}).click();
    const mobile=await setup(true);const anchor=mobile.locator('[data-zoom-anchor]');
    assert.ok((await mobile.locator('main').evaluate(el=>getComputedStyle(el).touchAction)).includes('manipulation'));
    native=await pinch(mobile,anchor,'touch');assert.ok(native.after.scale>1.2,'Touchscreen pinch must zoom the whole page');
    await mobile.screenshot({path:path.join(output,'mobile-page-zoom.png')});const zoomOut=await pinch(mobile,anchor,'touch',0.55);assert.ok(zoomOut.after.scale<zoomOut.before.scale-0.1,'Pinching inward must zoom the page back out');await native.session.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});
    native=await pinch(mobile,mobile.locator('[data-timetable-surface]'),'touch');assert.ok(native.after.scale>1.2,'Nested scrolling surfaces must allow page pinch');await native.session.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});
    await mobile.evaluate(async()=>window.pdfAPI.addPDFBlob(await(await fetch('/source.pdf')).blob(),{title:'Test report',fileName:'test-report.pdf'}));await mobile.locator('[data-pdf-page="1"] canvas').waitFor();await mobile.waitForFunction(()=>!document.querySelector('[aria-label="Rendering PDF page"]'));
    const hideThumbnails=mobile.getByRole('button',{name:'Hide page thumbnails',exact:true});if(await hideThumbnails.isVisible())await hideThumbnails.click();const mobileLabel=mobile.getByRole('button',{name:'Show zoom controls',exact:true});const mobilePdfZoom=await mobileLabel.innerText();
    native=await pinch(mobile,mobile.locator('[data-pdf-page="1"] canvas'),'touch');assert.ok(native.after.scale>1.2);assert.equal(await mobileLabel.innerText(),mobilePdfZoom);await mobile.screenshot({path:path.join(output,'mobile-page-zoom-over-pdf.png')});
    await native.session.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});await mobile.getByRole('button',{name:'Minimize PDF workspace',exact:true}).click();
    async function touches(page,sequence){return page.locator('[data-page-swipe]').evaluate((el,sequence)=>{for(const [type,points] of sequence){const touches=points.map(([clientX,clientY],identifier)=>new Touch({identifier,target:el,clientX,clientY}));el.dispatchEvent(new TouchEvent(type,{touches,targetTouches:touches,changedTouches:touches,bubbles:true,cancelable:true}));}},sequence);}
    const single=[['touchstart',[[20,200]]],['touchmove',[[150,205]]],['touchend',[]]];
    await touches(mobile,single);await mobile.waitForFunction(()=>window.swipeCount===1);
    await touches(mobile,[['touchstart',[[20,200]]],['touchstart',[[20,200],[100,200]]],['touchmove',[[20,200],[180,205]]],['touchend',[[180,205]]],['touchmove',[[260,205]]],['touchend',[]]]);assert.equal(await mobile.evaluate(()=>window.swipeCount),1);
    await touches(mobile,[['touchstart',[[20,200]]],['touchmove',[[150,205]]],['touchcancel',[]],['touchend',[]]]);assert.equal(await mobile.evaluate(()=>window.swipeCount),1);
    await native.session.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});await touches(mobile,single);assert.equal(await mobile.evaluate(()=>window.swipeCount),1,'Panning a zoomed page must not open a sidebar');
    await native.session.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});await touches(mobile,single);await mobile.waitForFunction(()=>window.swipeCount===2);
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({gestures:results,browserErrors:errors,originalPixels,pdfZoom,mobilePdfZoom},null,2));
    console.log('PAGE_ZOOM_BROWSER_OK: browser-native touchpad/touchscreen zoom, including over rendered PDF and nested scrolling surfaces; unchanged PDF zoom/pixels; browser zoom shortcuts; explicit PDF zoom buttons; multi-touch/cancel/zoomed-pan sidebar guards.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(e => { console.error(e); process.exitCode = 1; });
