const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { build } = require('esbuild');
const QRCode = require('qrcode');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

async function main() {
  const output = path.resolve('output/staff-clocking-validation');
  await fs.mkdir(output, { recursive: true });
  const result = await build({
    stdin: { contents: `import React from 'react'; import { createRoot } from 'react-dom/client'; import { QueryClient, QueryClientProvider } from '@tanstack/react-query'; import { StaffClockingQrDisplay } from './src/components/staff-clocking/staff-clocking-qr-display'; import { StaffClockingQrScanner } from './src/components/staff-clocking/staff-clocking-qr-scanner'; const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}>{location.pathname === '/display' ? <StaffClockingQrDisplay available /> : <StaffClockingQrScanner available />}</QueryClientProvider>);`, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'local-auth-fixture', setup(builder) {
      builder.onResolve({ filter: /^@\/lib\/firebase$/ }, () => ({ path: 'firebase-fixture', namespace: 'fixture' }));
      builder.onResolve({ filter: /^@\/lib\/contexts\/auth-context$/ }, () => ({ path: 'auth-fixture', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'auth-fixture' ? 'export const useAuth = () => ({ user: { id: "staff-fixture", role: "Staff", staffId: "staff-one" } });' : 'export const auth = { currentUser: { uid: "staff-fixture", getIdToken: async () => "local-fixture-only" } };' }));
    } }],
  });
  const bundle = result.outputFiles[0].contents;
  await fs.writeFile(path.join(output, 'browser-test-bundle.js'), bundle);
  const server = http.createServer((req, res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle); }
    else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1" /><style>.hidden{display:none}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try { browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) }); }
  catch (error) { await new Promise(resolve => server.close(resolve)); throw error; }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const calls = [];
  await page.route('**/api/staff-clocking/**', async route => {
    const request = route.request(); const body = request.postDataJSON() || {};
    calls.push({ path: new URL(request.url()).pathname, method: request.method(), body });
    const result = request.url().includes('/record/session') ? { sessionId: '11111111-1111-4111-8111-111111111111', token: 'rotating-school-qr-payload-for-browser-validation', expiresAt: new Date(Date.now() + 2_000).toISOString() } : { event: { type: 'clock_in', arrivalStatus: 'on_time' } };
    await route.fulfill({ json: { success: true, result } });
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    await page.goto(`${origin}/display`);
    await page.getByRole('button', { name: 'Start QR display' }).click();
    await page.getByText('Staff can scan this QR now').waitFor();
    await page.waitForResponse(response => response.request().method() === 'POST' && response.url().includes('/record/session') && response.request().postDataJSON()?.sessionId);
    await page.getByRole('button', { name: 'End display' }).click();
    await page.getByRole('button', { name: 'Start QR display' }).waitFor();
    assert.ok(calls.some(call => call.method === 'POST' && call.body.sessionId));
    assert.ok(calls.some(call => call.method === 'DELETE'));
    console.log('PASS rotating QR refresh and server revocation');

    await page.goto(`${origin}/scanner`);
    await page.evaluate(() => {
      window.__cameraRequests = 0;
      window.TrinityOffline = { postMessage(message) {
        const { id } = JSON.parse(message);
        queueMicrotask(() => this.onmessage({ data: JSON.stringify({ id, success: true, lowRam: false }) }));
      } };
      navigator.mediaDevices.getUserMedia = async () => { window.__cameraRequests++; throw new Error('Old APK must not request camera'); };
    });
    await page.getByRole('button', { name: 'Scan school QR', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Install the latest school app update' }).waitFor();
    await page.getByRole('link', { name: 'Get the latest school app' }).waitFor();
    assert.equal(await page.evaluate(() => window.__cameraRequests), 0);
    console.log('PASS older APK receives update guidance before requesting unsupported camera access');

    await page.goto(`${origin}/scanner`);
    await page.evaluate(() => {
      window.TrinityOffline = { postMessage(message) {
        const { id } = JSON.parse(message);
        queueMicrotask(() => this.onmessage({ data: JSON.stringify({ id, success: true, webCameraCapture: true }) }));
      } };
      navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Permission denied', 'NotAllowedError'); };
    });
    await page.getByRole('button', { name: 'Scan school QR', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Open Android Settings' }).waitFor();
    assert.ok(await page.getByRole('status').evaluate(status => status.compareDocumentPosition(document.querySelector('form')) & Node.DOCUMENT_POSITION_FOLLOWING));
    await page.getByRole('button', { name: 'Scan school QR', exact: true }).waitFor({ state: 'visible' });
    console.log('PASS Android camera denial explains recovery beside the scan controls');

    await page.goto(`${origin}/scanner`);
    await page.evaluate(() => {
      window.__tracksStopped = 0;
      window.TrinityOffline = { postMessage(message) {
        const { id } = JSON.parse(message);
        queueMicrotask(() => this.onmessage({ data: JSON.stringify({ id, success: true, webCameraCapture: true }) }));
      } };
      navigator.mediaDevices.getUserMedia = async () => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 300;
        canvas.getContext('2d').fillRect(0, 0, 300, 300);
        const stream = canvas.captureStream(10);
        stream.getTracks().forEach(track => { const stop = track.stop.bind(track); track.stop = () => { window.__tracksStopped++; stop(); }; });
        return stream;
      };
      window.BarcodeDetector = class { async detect() { return [{ rawValue: 'valid-qr-from-camera-fixture' }]; } };
    });
    await page.getByRole('button', { name: 'Scan school QR', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Clock in recorded' }).waitFor();
    assert.ok(await page.evaluate(() => window.__tracksStopped > 0));
    assert.equal(calls.filter(call => call.path === '/api/staff-clocking/clock').length, 1);
    console.log('PASS updated Android camera capability starts decoding, submits once and releases tracks');

    await page.goto(`${origin}/scanner`);
    await page.evaluate(() => {
      window.__tracksStopped = 0;
      navigator.mediaDevices.getUserMedia = () => new Promise(resolve => { window.__resolveCamera = () => { const stream = document.createElement('canvas').captureStream(10); stream.getTracks().forEach(track => { const stop = track.stop.bind(track); track.stop = () => { window.__tracksStopped++; stop(); }; }); resolve(stream); }; });
      window.BarcodeDetector = class { async detect() { return []; } };
    });
    await page.getByRole('button', { name: 'Scan school QR', exact: true }).click();
    await page.getByRole('button', { name: 'Opening camera…', exact: true }).waitFor();
    assert.ok(await page.locator('video').isVisible(), 'The camera video must be visible before play resolves');
    await page.getByRole('button', { name: 'Stop camera' }).click();
    await page.evaluate(() => window.__resolveCamera());
    await page.waitForFunction(() => window.__tracksStopped > 0);
    await page.getByText('Camera is off').waitFor();
    console.log('PASS cancellation while permission is pending releases late camera stream');

    const qr = await QRCode.toDataURL('valid-fallback-scanner-payload', { width: 400, margin: 4 });
    await page.goto(`${origin}/scanner`);
    await page.evaluate(dataUrl => {
      Object.defineProperty(window, 'BarcodeDetector', { value: undefined, configurable: true, writable: true });
      navigator.mediaDevices.getUserMedia = async () => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 400;
        const image = new Image(); image.src = dataUrl; await image.decode();
        const draw = () => canvas.getContext('2d').drawImage(image, 0, 0);
        draw(); window.__fixtureDraw = setInterval(draw, 50);
        return canvas.captureStream(20);
      };
    }, qr);
    await page.getByRole('button', { name: 'Scan school QR', exact: true }).click();
    try { await page.getByRole('status').filter({ hasText: 'Clock in recorded' }).waitFor({ timeout: 30_000 }); }
    catch (error) { await page.screenshot({ path: path.join(output, 'fallback-failure.png'), fullPage: true }); console.error(await page.locator('body').innerText(), errors, await page.locator('video').evaluate(video => ({ readyState: video.readyState, width: video.videoWidth, height: video.videoHeight, paused: video.paused }))); throw error; }
    console.log('PASS fallback decoder reads an actual QR image from a synthetic camera stream');
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(output, 'scanner-mobile.png'), fullPage: true });
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
