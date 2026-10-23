/* Public MediaPipe portrait fixture and synthetic camera file; no pupil data. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { webkit, chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'output/iphone-photo-qa');
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 Version/27.0 Mobile/15E148 Safari/604.1';

async function build() {
  fs.mkdirSync(output, { recursive: true });
  const sample = path.join(output, 'portrait.jpg');
  if (!fs.existsSync(sample)) {
    const response = await fetch('https://storage.googleapis.com/mediapipe-assets/portrait.jpg');
    if (!response.ok) throw new Error('Public MediaPipe sample unavailable: ' + response.status);
    fs.writeFileSync(sample, Buffer.from(await response.arrayBuffer()));
  }
  await require('esbuild').build({ absWorkingDir: root, stdin: { resolveDir: root, loader: 'tsx', contents: `
import React from 'react';import {createRoot} from 'react-dom/client';
import {PhotoUploadCrop} from './src/components/ui/photo-upload-crop';
import {PhotoToolsClient} from './src/lib/photo/photo-tools-client';
import {createImage,createEnhancedPupilPhoto} from './src/components/ui/photo-editor-utils';
import {DEFAULT_PHOTO_SETTINGS} from './src/lib/photo/photo-processing';
const detect=PhotoToolsClient.prototype.detect,segment=PhotoToolsClient.prototype.segment;
PhotoToolsClient.prototype.detect=async function(canvas){const faces=await detect.call(this,canvas);window.detectedFaces=faces;return faces};
PhotoToolsClient.prototype.segment=async function(...args){const mask=await segment.apply(this,args);window.segmented=true;return mask};
window.photoTest={PhotoToolsClient,createImage,createEnhancedPupilPhoto,DEFAULT_PHOTO_SETTINGS};
createRoot(document.getElementById('app')).render(<PhotoUploadCrop onPhotoChange={photo=>{window.savedPhoto=photo}}/>);
` }, bundle: true, platform: 'browser', jsx: 'automatic', alias: { '@': path.join(root, 'src') }, define: { 'process.env.NODE_ENV': '"production"' }, outfile: path.join(output, 'fixture.js'), plugins: [{ name: 'next-image-only', setup(build) {
    build.onResolve({ filter: /^next\/image$/ }, () => ({ path: 'next/image', namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `import React from 'react';export default function Image({fill,priority,...props}){return <img {...props}/>}`, loader: 'tsx', resolveDir: root }));
  } }] });
  const ts = require('typescript'), mod = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(root, 'tailwind.config.ts'), 'utf8'), { compilerOptions: { module: 1 } }).outputText)(require, mod, mod.exports);
  const css = ['src/app/globals.css', 'src/app/theme.css', 'node_modules/react-easy-crop/react-easy-crop.css'].map(file => fs.readFileSync(path.join(root, file), 'utf8').replace(/^@import[^;]+;/gm, '')).join('\n');
  const result = await require('postcss')([require('tailwindcss')({ ...mod.exports.default, content: [path.join(root, 'src/components/ui/**/*.tsx')] })]).process(css, { from: path.join(root, 'src/app/globals.css') });
  fs.writeFileSync(path.join(output, 'fixture.css'), result.css);
}

async function run() {
  await build();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let file;
    if (['/fixture.js', '/fixture.css', '/portrait.jpg'].includes(url.pathname)) file = path.join(output, url.pathname.slice(1));
    else if (url.pathname.startsWith('/photo-tools/')) {
      const assets = path.resolve(root, 'public/photo-tools');
      const resolved = path.resolve(root, 'public', '.' + url.pathname);
      if (resolved.startsWith(assets + path.sep)) file = resolved;
    }
    if (file && fs.existsSync(file)) {
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.wasm') ? 'application/wasm' : file.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream');
      res.end(fs.readFileSync(file));
    } else if (url.pathname !== '/') { res.writeHead(404); res.end(); }
    else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/fixture.css"></head><body><div id="app"></div><script src="/fixture.js"></script></body></html>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const reports = [];
  try {
    for (const [engine, browserType] of [['webkit', webkit], ['chromium', chromium]]) {
      const browser = await browserType.launch({ headless: true, ...(engine === 'chromium' ? { channel: 'msedge' } : {}) });
      try {
        for (const standalone of [false, true]) {
          console.log('Checking iPhone photo editor: ' + engine + (standalone ? ' Home Screen' : ' Safari tab'));
          const page = await browser.newPage({ viewport: { width: 390, height: 844 }, userAgent: iphone, isMobile: true, hasTouch: true, deviceScaleFactor: 3, reducedMotion: 'reduce' });
          page.setDefaultTimeout(60000);
          const errors = []; page.on('pageerror', error => errors.push(error.message));
          if (standalone) await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
          await page.goto('http://127.0.0.1:' + server.address().port);
          await page.waitForFunction(() => window.photoTest);
          const source = await page.evaluate(async () => {
            const image = await photoTest.createImage('/portrait.jpg');
            const canvas = document.createElement('canvas'); canvas.width = 2460; canvas.height = 3072;
            canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.96));
            canvas.width = 0; canvas.height = 0;
            return [...new Uint8Array(await blob.arrayBuffer())];
          });
          await page.getByText('ADD PHOTO', { exact: true }).click();
          const chooser = page.waitForEvent('filechooser');
          await page.getByRole('button', { name: /Take Photo/ }).click();
          await (await chooser).setFiles({ name: 'iphone-camera.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(source) });
          await page.waitForFunction(() => window.detectedFaces?.length === 1 && window.segmented);
          await page.getByRole('button', { name: 'Review photo', exact: true }).waitFor();
          await page.waitForFunction(() => document.querySelector('img[alt="Enhanced crop preview"]')?.naturalWidth === 1024);
          const retained = await page.locator('.reactEasyCrop_Image').getAttribute('src');
          assert.deepEqual(Buffer.from(retained.split(',')[1], 'base64'), Buffer.from(source), 'Camera bytes must reach the crop editor unchanged');
          const enhanced = await page.locator('img[alt="Enhanced crop preview"]').evaluate(image => ({ width: image.naturalWidth, height: image.naturalHeight }));
          assert.deepEqual(enhanced, { width: 1024, height: 1024 });
          await page.getByRole('button', { name: 'Compare original', exact: true }).click();
          assert.equal(await page.locator('img[alt="Original crop preview"]').evaluate(image => image.naturalWidth), 1024);
          await page.getByRole('button', { name: 'Show enhanced', exact: true }).click();
          await page.screenshot({ path: path.join(output, `${engine}-${standalone ? 'installed' : 'safari'}-crop.png`) });
          await page.getByRole('button', { name: 'Review photo', exact: true }).click();
          await page.getByRole('button', { name: 'Save photo', exact: true }).click();
          await page.waitForFunction(() => window.savedPhoto);
          const saved = await page.evaluate(async () => {
            const image = await photoTest.createImage(savedPhoto), blob = await (await fetch(savedPhoto)).blob();
            return { width: image.naturalWidth, height: image.naturalHeight, type: blob.type, bytes: blob.size };
          });
          assert.equal(saved.width, 500); assert.equal(saved.height, 500); assert.equal(saved.type, 'image/jpeg'); assert.ok(saved.bytes <= 180 * 1024);
          const safety = await page.evaluate(async () => {
            const tools = new photoTest.PhotoToolsClient();
            try {
              const source = '/portrait.jpg';
              const small = await photoTest.createEnhancedPupilPhoto(source, { x: 0, y: 0, width: 600, height: 600 }, photoTest.DEFAULT_PHOTO_SETTINGS, tools, undefined, 1024);
              const image = await photoTest.createImage(small.previewPhoto);
              let rejected = false;
              try { await photoTest.createEnhancedPupilPhoto(source, { x: 0, y: 0, width: 400, height: 400 }, photoTest.DEFAULT_PHOTO_SETTINGS, tools, undefined, 1024); } catch { rejected = true; }
              const standard = await photoTest.createEnhancedPupilPhoto(source, { x: 0, y: 0, width: 600, height: 600 }, photoTest.DEFAULT_PHOTO_SETTINGS, tools);
              return { width: image.naturalWidth, rejected, standardSamePreview: standard.photo === standard.previewPhoto };
            } finally { tools.dispose(); }
          });
          assert.deepEqual(safety, { width: 600, rejected: true, standardSamePreview: true }, 'Never invent source pixels or change the standard 500px flow');
          assert.deepEqual(errors, []);
          reports.push({ engine, standalone, realFaceAndMask: true, cameraBytesPreserved: true, preview: enhanced, saved, noSourceUpscaling: true });
          await page.close();
        }
      } finally { await browser.close(); }
    }
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ reports, physicalIPhoneTest: false, fixtureSource: 'https://storage.googleapis.com/mediapipe-assets/portrait.jpg' }, null, 2));
    console.log('IPHONE_PHOTO_OK: real detection/segmentation in WebKit and Chromium, camera file byte integrity, detailed iPhone previews, original comparison, unchanged bounded 500px JPEG saves, no source upscaling, Safari/Home Screen.');
  } finally { await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
