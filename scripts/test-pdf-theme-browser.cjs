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
const output = path.join(root, 'output/pdf-theme-qa');
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
import React,{useEffect} from 'react';import {createRoot} from 'react-dom/client';
import * as pdfjs from 'pdfjs-dist';pdfjs.GlobalWorkerOptions.workerSrc='/worker.mjs';
import {ThemeProvider,useAppearance} from './src/components/providers/theme-provider';
import {ThemeToggle} from './src/components/ui/theme-toggle';
import {PDFWorkspaceProvider,usePDFWorkspace} from './src/lib/pdf/pdf-workspace-context';
import {PDFWorkspace} from './src/components/pdf/pdf-workspace';
function Fixture(){const api=usePDFWorkspace(),appearance=useAppearance();useEffect(()=>{window.pdfAPI=api;window.appearance=appearance},[api,appearance]);return <div style={{'--theme-primary':'37 99 235'}}><div className="fixed bottom-4 left-4 z-[110]"><ThemeToggle/></div><PDFWorkspace/></div>}
createRoot(document.getElementById('app')).render(<ThemeProvider><PDFWorkspaceProvider><Fixture/></PDFWorkspaceProvider></ThemeProvider>);
` }, bundle: true, format: 'esm', jsx: 'automatic', platform: 'browser', alias: { '@': path.join(root, 'src') }, outfile: path.join(output, 'fixture.js'), define: { 'process.env.NODE_ENV': '"production"' } });
  const config = require('typescript').transpileModule(fs.readFileSync(path.join(root, 'tailwind.config.ts'), 'utf8'), { compilerOptions: { module: 1 } }).outputText;
  const mod = { exports: {} }; new Function('require', 'module', 'exports', config)(require, mod, mod.exports);
  const css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/^@import[^;]+;/, '') + '\n' + fs.readFileSync(path.join(root, 'src/app/theme.css'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'src/app/brand-theme.css'), 'utf8');
  const built = await require('postcss')([require('tailwindcss')({ ...mod.exports.default, content: [path.join(root, 'src/**/*.{ts,tsx}'), { raw: fs.readFileSync(__filename, 'utf8'), extension: 'tsx' }] })]).process(css, { from: path.join(root, 'src/app/globals.css') });
  fs.writeFileSync(path.join(output, 'fixture.css'), built.css);
}
async function run() {
  await build();
  const server = http.createServer((req, res) => {
    const files = { '/fixture.js': ['text/javascript', path.join(output, 'fixture.js')], '/fixture.css': ['text/css', path.join(output, 'fixture.css')], '/source.pdf': ['application/pdf', path.join(output, 'source.pdf')], '/worker.mjs': ['text/javascript', path.join(root, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs')] };
    if (files[req.url]) { res.setHeader('Content-Type', files[req.url][0]); res.end(fs.readFileSync(files[req.url][1])); }
    else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="app"></div><script type="module" src="/fixture.js"></script></body></html>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => window.pdfAPI);
    await page.evaluate(async () => { const blob = await (await fetch('/source.pdf')).blob(); window.pdfAPI.addPDFBlob(blob, { title: 'Test report', fileName: 'test-report.pdf' }); });
    const canvas = page.locator('[data-pdf-page="1"] canvas');
    await canvas.waitFor();
    await page.waitForFunction(() => !document.querySelector('[aria-label="Rendering PDF page"]'));
    await page.locator('[aria-label="Page thumbnails"] canvas').first().waitFor();
    const inspect = () => page.evaluate(async () => {
      const canvases = [...document.querySelectorAll('canvas')];
      const digest = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(b => b.toString(16).padStart(2, '0')).join('');
      return Promise.all(canvases.map(async c => ({ width: c.width, height: c.height, pixels: await digest(c.getContext('2d').getImageData(0, 0, c.width, c.height).data), filter: getComputedStyle(c).filter, background: getComputedStyle(c.closest('[data-theme-surface="paper"]')).backgroundColor })));
    });
    // Wait until both page and thumbnail paints have completed before hashing.
    await page.waitForFunction(() => document.querySelectorAll('canvas').length === 4 && [...document.querySelectorAll('canvas')].every(c => c.width > 0 && c.getContext('2d').getImageData(40, 40, 1, 1).data[3] === 255));
    const light = await inspect();
    await page.screenshot({ path: path.join(output, 'desktop-light.png') });
    const pageLight = hash(await canvas.screenshot());
    const pngDownload = async name => {
      await page.getByRole('button', { name: 'Download PDF or image' }).click();
      const waiting = page.waitForEvent('download');
      await page.getByRole('menuitem', { name, exact: true }).click();
      const download = await waiting; return fs.readFileSync(await download.path());
    };
    const pngLight = await pngDownload('Download current page as PNG');
    await page.getByRole('switch', { name: 'Dark theme' }).click();
    await page.waitForFunction(() => document.documentElement.classList.contains('dark') && !document.documentElement.dataset.themeReveal && !document.querySelector('[aria-busy="true"]'));
    assert.deepEqual(await inspect(), light, 'Page and thumbnail pixels/dimensions must be identical');
    assert.equal(hash(await canvas.screenshot()), pageLight, 'Paper appearance must be identical');
    const header = await page.locator('section > header').evaluate(el => ({ bg: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color }));
    assert.match(header.bg, /^rgba?\(15, 23, 42(?:, 0\.9)?\)$/);
    assert.equal(header.color, 'rgb(241, 245, 249)');
    for (const rendered of light) { assert.equal(rendered.background, 'rgb(255, 255, 255)'); assert.equal(rendered.filter, 'none'); }
    assert.equal(hash(await pngDownload('Download current page as PNG')), hash(pngLight), 'PNG export must be unchanged');
    assert.equal(hash(await pngDownload('Download PDF')), hash(fs.readFileSync(path.join(output, 'source.pdf'))), 'PDF download must preserve every byte');
    const printSource = await page.locator('iframe[title="Test report print source"]').getAttribute('src');
    const printHash = await page.evaluate(async src => {
      const bytes = await (await fetch(src)).arrayBuffer(); return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(b => b.toString(16).padStart(2, '0')).join('');
    }, printSource);
    assert.equal(printHash, hash(fs.readFileSync(path.join(output, 'source.pdf'))), 'Printing must use the unchanged original PDF');
    await page.screenshot({ path: path.join(output, 'desktop-dark.png') });
    await page.evaluate(async () => window.appearance.changeLookAndFeel({ preset: 'soft-indigo', background: 'plain', dimming: 60 }, document.querySelector('[role="switch"]')));
    assert.deepEqual(await inspect(), light, 'Soft Indigo must preserve page and thumbnail pixels');
    assert.equal(hash(await canvas.screenshot()), pageLight, 'Soft Indigo must preserve paper appearance');
    assert.equal(hash(await pngDownload('Download current page as PNG')), hash(pngLight), 'Soft Indigo must preserve PNG exports');
    assert.equal(hash(await pngDownload('Download PDF')), hash(fs.readFileSync(path.join(output, 'source.pdf'))), 'Soft Indigo must preserve PDF bytes');
    await page.screenshot({ path: path.join(output, 'soft-indigo-dark.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Hide page thumbnails' }).click();
    await page.screenshot({ path: path.join(output, 'mobile-dark.png') });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.getByRole('button', { name: 'Minimize PDF workspace', exact: true }).click();
    const dock = page.locator('.pdf-workspace-solid-surface').last();
    assert.notEqual(await dock.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)');
    await page.screenshot({ path: path.join(output, 'minimized-dark.png') });
    await page.evaluate(() => {
      const job = window.pdfAPI.runPDFJob({ title: 'Generating report' }, async ({ updateProgress }) => {
        updateProgress(46, 'Preparing test report…'); return new Promise(resolve => { window.finishPDF = resolve; });
      }); job.promise.catch(() => {});
    });
    await page.getByText('Creating Generating report').waitFor();
    await page.screenshot({ path: path.join(output, 'generating-dark.png') });
    await page.getByRole('button', { name: 'Minimize PDF workspace', exact: true }).click();
    await page.evaluate(async () => window.finishPDF(await (await fetch('/source.pdf')).blob()));
    await page.getByText('Your PDF is ready').waitFor();
    await page.screenshot({ path: path.join(output, 'ready-dark.png') });
    await page.evaluate(() => { const job = window.pdfAPI.runPDFJob({ title: 'Error report' }, async () => { throw new Error('Synthetic test error'); }); job.promise.catch(() => {}); });
    await page.getByText('PDF creation failed').waitFor();
    await page.screenshot({ path: path.join(output, 'error-dark.png') });
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ lightCanvases: light, pageScreenshotSHA256: pageLight, exportedPNGSHA256: hash(pngLight), sourcePDFSHA256: printHash, darkHeader: header, browserErrors: errors }, null, 2));
    console.log('PDF_THEME_BROWSER_OK: themed desktop/mobile controls, generating/error/minimized/ready states; identical page/thumbnail pixels, page appearance, PNG exports, PDF download and original print source.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(e => { console.error(e); process.exitCode = 1; });
