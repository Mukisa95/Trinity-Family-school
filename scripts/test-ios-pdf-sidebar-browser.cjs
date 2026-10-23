/* Real PDF.js, viewport layers and drawer scrolling; synthetic documents/account data only. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/ios-pdf-sidebar-qa');
const missingMethods = `for (const Type of [Map, WeakMap]) { delete Type.prototype.getOrInsert; delete Type.prototype.getOrInsertComputed; }`;

async function build() {
  fs.mkdirSync(output, { recursive: true });
  const { jsPDF } = require('jspdf');
  const pdf = new jsPDF();
  pdf.setFillColor(30, 90, 170).rect(20, 20, 170, 60, 'F');
  pdf.setTextColor(255).text('iPhone compatibility test', 30, 45);
  pdf.addPage().setTextColor(20).text('Second page', 20, 30);
  fs.writeFileSync(path.join(output, 'source.pdf'), Buffer.from(pdf.output('arraybuffer')));
  const mocks = {
    'next/navigation': `export const usePathname=()=>'/';export const useRouter=()=>({push:()=>{},prefetch:()=>{}});`,
    'next/link': `import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}`,
    'next/image': `import React from 'react';export default function Image({fill,...props}){return <img {...props}/>}`,
    '@/lib/contexts/auth-context': `export const useAuth=()=>({user:{id:'fixture',role:'Admin'},isSignedIdentityReady:true});`,
    '@/lib/contexts/navigation-context': `export const useNavigation=()=>({startNavigation:()=>{}});`,
    '@/lib/hooks/use-navigation-prefetch': `export const useNavigationPrefetch=()=>()=>{};`,
    '@/lib/hooks/use-school-settings': `export const useSchoolSettings=()=>({data:{generalInfo:{name:'Test school',logo:''}},isLoading:false});`,
    './sidebar-navigation': `export const visibleSidebarItems=items=>items;`,
    './sidebar-user-footer': `import React from 'react';import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem} from '@/components/ui/dropdown-menu';export function SidebarUserFooter(){return <DropdownMenu><DropdownMenuTrigger>Test account</DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem>App settings</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}`,
    './sidebar-nav': `import React from 'react';export function SidebarNav(){return <nav>{Array.from({length:70},(_,n)=><a key={n} href={'#item'+n} style={{display:'block',height:48}}>Section {n+1}</a>)}</nav>}`,
  };
  await require('esbuild').build({ absWorkingDir: root, stdin: { resolveDir: root, loader: 'tsx', contents: `
import React,{useEffect,useState} from 'react';import {createRoot} from 'react-dom/client';
import {PDFWorkspaceProvider,usePDFWorkspace} from './src/lib/pdf/pdf-workspace-context';
import {PDFWorkspace} from './src/components/pdf/pdf-workspace';
import {MobileSidebar} from './src/components/layout/mobile-sidebar';
window.reproduceModernError=async()=>{const engine=await import('pdfjs-dist');engine.GlobalWorkerOptions.workerSrc='/modern-worker.mjs';const task=engine.getDocument({data:new Uint8Array(await(await fetch('/source.pdf')).arrayBuffer())});try{const pdf=await task.promise;await pdf.getOptionalContentConfig();return null;}catch(error){return error.message}finally{await task.destroy()}};
function Fixture(){const api=usePDFWorkspace(),[open,setOpen]=useState(false);useEffect(()=>{window.pdfAPI=api;window.openSidebar=()=>setOpen(true)},[api]);return <div style={{transform:'translateZ(0)'}} data-fixture-ancestor><h1>School workspace</h1><button onClick={()=>setOpen(true)}>Open navigation</button><div style={{height:2600}}>Scrollable school page</div><MobileSidebar items={[]} isOpen={open} onClose={()=>setOpen(false)}/><PDFWorkspace/></div>}
createRoot(document.getElementById('app')).render(<PDFWorkspaceProvider><Fixture/></PDFWorkspaceProvider>);
` }, bundle: true, platform: 'browser', format: 'esm', jsx: 'automatic', alias: { '@': path.join(root, 'src') }, outfile: path.join(output, 'fixture.js'), define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
    plugins: [{ name: 'synthetic-data-and-worker-url', setup(b) {
      b.onResolve({ filter: /.*/ }, a => mocks[a.path] ? { path: a.path, namespace: 'fixture' } : undefined);
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: mocks[a.path], loader: 'tsx', resolveDir: root }));
      b.onLoad({ filter: /pdf-document-viewer\.tsx$/ }, a => ({ contents: fs.readFileSync(a.path, 'utf8').replace(/new URL\(\s*"pdfjs-dist\/legacy\/build\/pdf.worker.min.mjs",\s*import.meta.url,?\s*\).toString\(\)/, "'/worker.mjs'"), loader: 'tsx', resolveDir: path.dirname(a.path) }));
    } }] });
  const ts = require('typescript'), mod = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(root, 'tailwind.config.ts'), 'utf8'), { compilerOptions: { module: 1 } }).outputText)(require, mod, mod.exports);
  const css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/^@import[^;]+;/gm, '') + '\n' + fs.readFileSync(path.join(root, 'src/app/theme.css'), 'utf8');
  const built = await require('postcss')([require('tailwindcss')({ ...mod.exports.default, content: [path.join(root, 'src/components/pdf/**/*.tsx'), path.join(root, 'src/components/ui/**/*.tsx'), path.join(root, 'src/components/layout/mobile-sidebar.tsx')] })]).process(css, { from: path.join(root, 'src/app/globals.css') });
  fs.writeFileSync(path.join(output, 'fixture.css'), built.css);
}

async function boundaryTouch(page, selector, direction, pinch = false) {
  return page.locator(selector).evaluate((target, { direction, pinch }) => {
    const dispatch = (type, y) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      const touches = [{ clientX: 100, clientY: y, identifier: 1, target }];
      if (pinch) touches.push({ clientX: 150, clientY: y, identifier: 2, target });
      Object.defineProperties(event, { touches: { value: touches }, changedTouches: { value: touches } });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    };
    dispatch('touchstart', 200);
    const prevented = dispatch('touchmove', 200 + direction * 60);
    const end = new Event('touchcancel', { bubbles: true });
    target.dispatchEvent(end);
    return prevented;
  }, { direction, pinch });
}

async function run() {
  await build();
  let workerRequests = 0;
  const server = http.createServer((req, res) => {
    if (['/worker.mjs', '/modern-worker.mjs'].includes(req.url)) {
      workerRequests++;
      res.setHeader('Content-Type', 'text/javascript');
      // The negative check isolates the display build's missing method; both workers
      // use the same version with polyfills, so a worker exception cannot hide it.
      res.end(missingMethods + fs.readFileSync(require.resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs'), 'utf8'));
    } else if (['/fixture.js', '/fixture.css', '/source.pdf'].includes(req.url)) {
      res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : req.url.endsWith('.css') ? 'text/css' : 'application/pdf');
      res.end(fs.readFileSync(path.join(output, req.url.slice(1))));
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=yes"><link rel="stylesheet" href="/fixture.css"></head><body><div id="app"></div><script type="module" src="/fixture.js"></script></body></html>');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port;
  const results = [];
  try {
    for (const engine of ['webkit', 'chromium']) {
      const browser = await (engine === 'webkit' ? webkit.launch({ headless: true }) : chromium.launch({ headless: true, channel: 'msedge' }));
      try {
        console.log('Checking ' + engine + ' PDF and sidebar');
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
        page.setDefaultTimeout(15000);
        const errors = [];
        page.on('pageerror', e => { errors.push(e.message); console.error(engine + ': ' + e.message); });
        await page.addInitScript(missingMethods + `document.addEventListener('DOMContentLoaded',()=>{document.documentElement.dataset.homeScreen='true'});Object.defineProperty(navigator,'standalone',{value:true});`);
        await page.goto(url);
        await page.waitForFunction(() => !!window.pdfAPI);
        assert.equal(await page.evaluate(() => typeof Map.prototype.getOrInsertComputed), 'undefined');
        const reproduced = await page.evaluate(() => Promise.race([window.reproduceModernError(), new Promise((_, reject) => setTimeout(() => reject(Error('Modern-build reproduction timed out')), 10000))]));
        assert.match(reproduced, /getOrInsertComputed/);
        await page.evaluate(async () => pdfAPI.addPDFBlob(await (await fetch('/source.pdf')).blob(), { fileName: 'iphone.pdf', title: 'iPhone test PDF' }));
        const canvas = page.getByRole('main').locator('[data-pdf-page="1"] canvas');
        await page.waitForFunction(() => { const canvas = document.querySelector('[data-pdf-page="1"] canvas'); return canvas?.width > 0 && !document.querySelector('[aria-label="Rendering PDF page"]'); });
        assert.ok(await canvas.evaluate(canvas => { const context = canvas.getContext('2d'), pixel = context.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 8), 1, 1).data; return pixel[2] > pixel[0] + 40 && pixel[2] < 230; }));
        assert.equal(await page.getByRole('alert').count(), 0);
        await page.getByRole('button', { name: 'Minimize PDF workspace', exact: true }).click();
        const mini = page.getByLabel('Minimized PDF workspace');
        assert.equal(await mini.evaluate(el => el.closest('.viewport-overlay').parentElement === document.body), true);
        const bottomGap = async () => mini.evaluate(el => visualViewport.height + visualViewport.offsetTop - el.getBoundingClientRect().bottom);
        const gap = await bottomGap();
        await page.evaluate(() => window.scrollTo(0, 1100));
        await page.waitForFunction(() => window.scrollY > 1000);
        assert.ok(Math.abs(await bottomGap() - gap) < 2, 'Minimized PDF stays at the visible bottom while the document scrolls');
        await page.screenshot({ path: path.join(output, engine + '-minimized.png') });
        await mini.getByRole('button', { name: 'Restore PDF workspace' }).click();
        await page.getByRole('main').waitFor();
        await page.waitForFunction(() => document.querySelector('[data-pdf-page="1"] canvas')?.width > 0);
        await page.getByRole('button', { name: 'Minimize PDF workspace', exact: true }).click();

        await page.evaluate(() => openSidebar());
        const drawer = page.getByRole('dialog', { name: 'School navigation' });
        await drawer.waitFor();
        await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Close sidebar');
        await page.waitForFunction(() => document.body.hasAttribute('data-scroll-locked'));
        assert.equal(await drawer.evaluate(el => el.closest('.viewport-overlay').parentElement === document.body), true);
        const scrollY = await page.evaluate(() => window.scrollY);
        for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 568 }]) {
          await page.setViewportSize(size);
          await page.waitForFunction(() => Math.abs(document.querySelector('.app-mobile-sidebar').getBoundingClientRect().height - visualViewport.height) < 2);
          const content = drawer.locator('[data-sidebar="content"]');
          await content.evaluate(el => { el.style.scrollBehavior = 'auto'; el.scrollTop = el.scrollHeight; });
          await page.waitForFunction(() => { const el = document.querySelector('.mobile-sidebar-scroll'); return el.scrollTop + el.clientHeight >= el.scrollHeight - 1; });
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          await page.mouse.move(125, Math.min(size.height / 2, 300));
          if (engine === 'chromium') await page.mouse.wheel(0, 6000);
          assert.equal(await boundaryTouch(page, '.mobile-sidebar-scroll', -1), true, 'Upward swipes stop at the bottom of the navigation list');
          await content.evaluate(el => { el.scrollTop = 0; });
          assert.equal(await boundaryTouch(page, '.mobile-sidebar-scroll', 1), true, 'Downward swipes stop at the top of the navigation list');
          assert.equal(await boundaryTouch(page, '.mobile-sidebar-scroll', 1, true), false, 'Page pinch zoom remains available');
          assert.ok(Math.abs(await page.evaluate(() => window.scrollY) - scrollY) < 2);
          assert.ok(await drawer.evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= -1 && r.bottom <= visualViewport.height + 1; }));
          assert.ok(await drawer.locator('[data-sidebar="footer"]').evaluate(el => el.getBoundingClientRect().bottom <= visualViewport.height + 1));
        }
        await drawer.getByRole('button', { name: 'Test account' }).click();
        await page.getByRole('menu').waitFor();
        await page.keyboard.press('Escape');
        await page.getByRole('menu').waitFor({ state: 'hidden' });
        assert.ok(await drawer.isVisible());
        await page.screenshot({ path: path.join(output, engine + '-sidebar.png') });
        await page.keyboard.press('Escape');
        await drawer.waitFor({ state: 'detached' });
        await page.evaluate(() => window.scrollTo(0, 1500));
        await page.waitForFunction(() => window.scrollY > 1400);
        // Model Safari moving/shrinking the visible area independently of layout
        // (keyboard/browser chrome). The real viewport listeners must re-anchor it.
        await page.evaluate(() => {
          Object.defineProperties(visualViewport, { height: { configurable: true, value: 400 }, width: { configurable: true, value: 260 }, offsetTop: { configurable: true, value: 74 }, offsetLeft: { configurable: true, value: 20 } });
          visualViewport.dispatchEvent(new Event('resize'));
          visualViewport.dispatchEvent(new Event('scroll'));
        });
        await page.waitForFunction(() => { const r = document.querySelector('[aria-label="Minimized PDF workspace"]').getBoundingClientRect(); return Math.abs(r.bottom - 462) < 2 && r.right <= 280 && r.width <= 236; });
        await page.evaluate(() => {
          for (const key of ['height', 'width', 'offsetTop', 'offsetLeft']) delete visualViewport[key];
          visualViewport.dispatchEvent(new Event('resize'));
        });
        assert.deepEqual(errors, []);
        results.push({ engine, reproduced, compatiblePdfRendered: true, minimizedDock: true, drawerScrollContainment: true, pinchAllowed: true, standalone: true });
      } finally { await browser.close(); }
    }
    assert.ok(workerRequests >= 4, 'Both browser engines load real workers');
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ results, workerRequests, physicalIPhoneTest: false }, null, 2));
    console.log('IOS_PDF_SIDEBAR_OK: reproduced missing method, real compatible PDF rendering, standalone portrait/landscape, stable minimized dock, bounded drawer touch/wheel scrolling, account popup and pinch access.');
  } finally { await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
