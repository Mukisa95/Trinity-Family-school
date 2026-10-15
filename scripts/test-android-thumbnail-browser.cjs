const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(os.tmpdir(), 'trinity-audit-improvements-20261013', 'thumbnail-browser');
fs.mkdirSync(output, { recursive: true });

const fixture = `
import {projectOfflinePhotos} from './src/lib/offline/android-photo-projection';
import {setNavigationPending} from './src/lib/navigation/navigation-work';
window.runPhotoCheck = async () => {
  const source = document.createElement('canvas'); source.width = source.height = 500;
  const context = source.getContext('2d'); const image = context.createImageData(500,500);
  let seed = 123;
  for (let i=0;i<image.data.length;i+=4) {
    for(let j=0;j<3;j++) {seed=(1664525*seed+1013904223)>>>0;image.data[i+j]=seed>>>24;}
    image.data[i+3]=255;
  }
  context.putImageData(image,0,0);
  const photo=source.toDataURL('image/jpeg',0.9);
  const pupils=Array.from({length:20},(_,id)=>({id:String(id),photo}));
  const originals=pupils.map(pupil=>pupil.photo);
  // Simulate the deferred-callback path being unavailable, using real JPEG encoding.
  const toBlob=HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob=()=>{throw new Error('Deferred toBlob callback was used');};
  performance.clearMeasures();
  try {
    const started=performance.now();
    const projected=await projectOfflinePhotos('synthetic-browser-fixture',pupils);
    const elapsed=performance.now()-started;
    if(projected.some(pupil=>!pupil.photo?.startsWith('data:image/jpeg;base64,')||pupil.photo.length>8192)) throw new Error('Invalid bounded JPEG thumbnail');
    if(pupils.some((pupil,index)=>pupil.photo!==originals[index])) throw new Error('Original photo mutated');
    const encodes=performance.getEntriesByName('trinity:workspace:android:photo-encode');
    const encodeCount=encodes.length;
    await projectOfflinePhotos('synthetic-browser-fixture',pupils);
    if(performance.getEntriesByName('trinity:workspace:android:photo-encode').length!==encodeCount) throw new Error('Unchanged photos encoded again');
    setNavigationPending(true); let resumed=false;
    const waiting=projectOfflinePhotos('synthetic-browser-fixture',pupils).then(()=>{resumed=true;});
    await new Promise(resolve=>setTimeout(resolve,30));
    if(resumed) throw new Error('Photo preparation ran through navigation');
    setNavigationPending(false); await waiting;
    const controller=new AbortController(); controller.abort();
    let cancelled=false;
    try {await projectOfflinePhotos('synthetic-browser-fixture',pupils,controller.signal);} catch(error) {cancelled=error.name==='AbortError';}
    if(!cancelled) throw new Error('Cancelled photo preparation continued');
    return {pupils:projected.length,sourceChars:photo.length,thumbnailChars:projected[0].photo.length,encodeCount,maximumEncodeMs:Math.max(0,...encodes.map(entry=>entry.duration)),elapsedMs:elapsed};
  } finally {HTMLCanvasElement.prototype.toBlob=toBlob;setNavigationPending(false);}
};`;

async function run() {
  const bundled = await esbuild.build({
    absWorkingDir: root, stdin: { contents: fixture, resolveDir: root, loader: 'ts' },
    bundle: true, platform: 'browser', alias: { '@': path.join(root, 'src') }, write: false,
    define: { 'process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID': '"synthetic-browser-project"' },
  });
  const script = bundled.outputFiles[0].text;
  const server = http.createServer((request, response) => {
    if (request.url === '/fixture.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(script); }
    else { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><title>Thumbnail verification</title><script src="/fixture.js"></script>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const url = `http://127.0.0.1:${server.address().port}`;
    await page.goto(url);
    const cold = await page.evaluate(() => window.runPhotoCheck());
    assert.ok(cold.encodeCount > 0); assert.equal(cold.pupils, 20);
    await page.reload();
    const restored = await page.evaluate(() => window.runPhotoCheck());
    assert.equal(restored.encodeCount, 0, 'Reload must reuse account-scoped IndexedDB thumbnails');
    assert.deepEqual(errors, []);
    const result = { environment: 'Desktop Edge; synthetic photos, not an Android device trace', cold, restored };
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
    console.log('ANDROID_THUMBNAIL_BROWSER_OK', JSON.stringify(result));
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
