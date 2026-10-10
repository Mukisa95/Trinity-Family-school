const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/startup-qa');
fs.mkdirSync(output, { recursive: true });
const navigation = { name: 'pathname', setup(build) {
  build.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'pathname', namespace: 'mock' }));
  build.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: `export const usePathname=()=>typeof window==='undefined'?globalThis.fixturePath:window.location.pathname;`, loader: 'js' }));
} };
const imports = `import React,{useEffect,useState} from 'react';
import {StartupBootstrap} from './src/components/common/premium-splash-loader';
import {StartupPaintGate} from './src/components/common/startup-paint-gate';
import {StartupHandoff} from './src/components/common/startup-handoff';
import {usePathname} from 'next/navigation';
function Runtime(){const pathname=usePathname();const[loading,setLoading]=useState(true),[authenticated,setAuthenticated]=useState(false),[,setRoute]=useState(0);useEffect(()=>{window.runtimeMounted=performance.now();window.resolveAuth=user=>{setAuthenticated(user);setLoading(false)};window.redirect=path=>{history.replaceState(null,'',path);setRoute(v=>v+1)};window.dataStillPending=true},[]);return <><StartupHandoff pathname={pathname} authLoading={loading} isAuthenticated={authenticated}/><div id="workspace">{loading?'Authenticating':authenticated?'Dashboard':'Public page'}</div></>}
function Fixture(){return <StartupPaintGate><Runtime/></StartupPaintGate>}`;
async function run() {
  await esbuild.build({ absWorkingDir: root, stdin: { contents: imports + `import {renderToStaticMarkup} from 'react-dom/server';exports.html=p=>{globalThis.fixturePath=p;return renderToStaticMarkup(<><StartupBootstrap/><div id="app"><Fixture/></div></>)};`, resolveDir: root, loader: 'tsx' }, bundle: true, platform: 'node', jsx: 'automatic', external: ['react', 'react-dom/server'], alias: { '@': path.join(root, 'src') }, outfile: path.join(output, 'server.cjs'), plugins: [navigation] });
  await esbuild.build({ absWorkingDir: root, stdin: { contents: imports + `import {hydrateRoot} from 'react-dom/client';window.loaderNode=document.getElementById('trinity-startup-screen');requestAnimationFrame(()=>window.firstLoaderFrame=performance.now());hydrateRoot(document.getElementById('app'),<Fixture/>);`, resolveDir: root, loader: 'tsx' }, bundle: true, platform: 'browser', jsx: 'automatic', alias: { '@': path.join(root, 'src') }, outfile: path.join(output, 'fixture.js'), plugins: [navigation], define: { 'process.env.NODE_ENV': '"production"' } });
  const { html } = require(path.join(output, 'server.cjs'));
  const server = http.createServer((req, res) => {
    if (req.url === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(fs.readFileSync(path.join(output, 'fixture.js'))); }
    if (req.url === '/trinity-logo-192.png') { res.setHeader('Content-Type', 'image/png'); return res.end(fs.readFileSync(path.join(root, 'public/trinity-logo-192.png'))); }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');res.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${html(req.url)}<script defer src="/fixture.js"></script></body></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    let release;const barrier = new Promise(resolve => { release = resolve; });
    await page.route('**/fixture.js', async route => { await barrier; await route.continue(); });
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'commit' });
    await page.locator('#trinity-startup-screen').waitFor();
    assert.equal(await page.locator('.startup-message').innerText(), 'Opening your school workspace…');
    assert.equal(await page.locator('#workspace').count(), 0, 'Dashboard cannot mount ahead of the initial loading surface');
    assert.equal(await page.locator('.startup-block').first().evaluate(el => getComputedStyle(el).animationName), 'startup-block-motion', 'Animation exists before application JS');
    await page.screenshot({ path: path.join(output, 'before-javascript.png') });
    release(); await page.waitForFunction(() => window.resolveAuth);
    assert.equal(await page.evaluate(() => runtimeMounted >= firstLoaderFrame), true, 'Runtime starts after the first loader frame');
    assert.equal(await page.evaluate(() => loaderNode === document.getElementById('trinity-startup-screen')), true, 'Hydration retains one loading surface');
    const session = await page.context().newCDPSession(page);
    // Ordinary screenshot RPCs wait for the renderer. Trace compositor frames
    // instead, so the measurement includes frames during a real long JS task.
    await session.send('Tracing.start', { categories: 'devtools.timeline,blink.user_timing,disabled-by-default-devtools.screenshot', transferMode: 'ReturnAsStream' });
    await page.evaluate(() => { performance.mark('startup-busy-start'); const until = performance.now() + 1600; while (performance.now() < until) {} performance.mark('startup-busy-end'); });
    const finished = new Promise(resolve => session.once('Tracing.tracingComplete', resolve));
    await session.send('Tracing.end');
    const { stream } = await finished;
    let trace = '';
    while (true) { const part = await session.send('IO.read', { handle: stream }); trace += part.data; if (part.eof) break; }
    await session.send('IO.close', { handle: stream });
    fs.writeFileSync(path.join(output, 'busy-trace.json'), trace);
    const events = JSON.parse(trace).traceEvents;
    const start = events.find(event => event.name === 'startup-busy-start');
    const end = events.find(event => event.name === 'startup-busy-end');
    const frames = events.filter(event => event.name === 'Screenshot' && event.ts > start.ts && event.ts < end.ts);
    assert.ok(frames.length > 1, 'Compositor produces frames during the blocked main thread');
    assert.ok(new Set(frames.map(frame => frame.args.snapshot)).size > 1, 'Loading animation changes during the blocked main thread');
    fs.writeFileSync(path.join(output, 'busy-animation-result.json'), JSON.stringify({ blockedMs: (end.ts-start.ts)/1000, frameCount: frames.length, differentFrames: new Set(frames.map(frame => frame.args.snapshot)).size }, null, 2));
    await page.evaluate(() => window.resolveAuth(true));
    await page.waitForFunction(() => document.getElementById('trinity-startup-screen').hidden);
    assert.equal(await page.evaluate(() => window.dataStillPending), true, 'Data completion does not gate the handoff');
    assert.equal(await page.locator('#workspace').innerText(), 'Dashboard');
    await page.goto(`http://127.0.0.1:${server.address().port}/login`);await page.waitForFunction(() => window.resolveAuth);
    await page.evaluate(() => window.resolveAuth(true));
    await page.waitForTimeout(350);assert.equal(await page.locator('#trinity-startup-screen').isVisible(), true, 'Signed-in login stays covered until redirect');
    await page.evaluate(() => window.redirect('/'));
    await page.waitForFunction(() => document.getElementById('trinity-startup-screen').hidden);
    await page.goto(`http://127.0.0.1:${server.address().port}/login`);await page.waitForFunction(() => window.resolveAuth);
    await page.evaluate(() => window.resolveAuth(false));await page.waitForFunction(() => document.getElementById('trinity-startup-screen').hidden);
    await page.goto(`http://127.0.0.1:${server.address().port}/about-trinity`);
    assert.equal(await page.locator('#trinity-startup-screen').isVisible(), false, 'Public pages are not covered');
    assert.ok(html('/about-trinity').includes('id="workspace"'), 'Public content remains server-rendered');
    const noScript = await browser.newContext({ javaScriptEnabled: false });
    const publicPage = await noScript.newPage();
    await publicPage.goto(`http://127.0.0.1:${server.address().port}/about-trinity`);
    assert.equal(await publicPage.locator('#trinity-startup-screen').isVisible(), false, 'Public HTML is readable with JavaScript disabled');
    assert.equal(await publicPage.locator('#workspace').isVisible(), true);
    await noScript.close();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    assert.equal(await page.locator('.startup-block').first().evaluate(el => getComputedStyle(el).animationName), 'none');
    assert.deepEqual(errors, []);
    console.log('STARTUP_BROWSER_OK: initial HTML before JS, paint-before-mount, one surface, animation under blocked main thread, frontend-only handoff, login redirects, public SSR, mobile and reduced motion');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
