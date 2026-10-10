/* Actual first-run controller and screen with controlled data completion. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const ts = require('typescript'), esbuild = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'output/workspace-setup-qa');
const palette = require('../tests/fixtures/android-device-palette.json');
async function run() {
  fs.mkdirSync(output, { recursive: true });
  const contents = `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider,QueryObserver} from '@tanstack/react-query';
import {ThemeProvider} from './src/components/providers/theme-provider';
import {WorkspaceSetupScreen} from './src/components/common/workspace-setup-screen';
import {useFirstWorkspaceSetup} from './src/lib/hooks/use-first-workspace-setup';
import {readWorkspaceSetup,reportWorkspaceTask,workspaceSetupScope,workspaceSetupMarker} from './src/lib/startup/workspace-setup';
const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});
function Fixture(){const [user,setUser]=useState({id:'first',role:'Admin',enabled:true});
const setup=useFirstWorkspaceSetup({enabled:user.enabled,userId:user.id,role:user.role});const scope=workspaceSetupScope(user.id,user.role);
window.fixture={user:setUser,report:(id,state)=>reportWorkspaceTask(client,scope,id,state),
readyExcept:(id)=>{client.setQueryData(['schoolSettings','settings'],{});readWorkspaceSetup(client,scope,user.role).tasks.filter(t=>!['settings','page',id].includes(t.id)).forEach(t=>reportWorkspaceTask(client,scope,t.id,'ready'));},
marker:()=>localStorage.getItem(workspaceSetupMarker(scope)),
pending:()=>{const observer=new QueryObserver(client,{queryKey:['timetable','entries',user.id],queryFn:()=>new Promise(resolve=>window.finishPage=()=>resolve([]))});window.stopPage=observer.subscribe(()=>{});}};
return <>{setup.required?<WorkspaceSetupScreen {...setup}/>:<h1>Workspace available</h1>}<output data-testid="phase">{setup.fading?'fading':setup.required?'loading':'complete'}</output></>}
createRoot(document.getElementById('app')).render(<ThemeProvider><QueryClientProvider client={client}><Fixture/></QueryClientProvider></ThemeProvider>);`;
  await esbuild.build({ absWorkingDir: root, stdin: { contents, resolveDir: root, loader: 'tsx' }, bundle: true, jsx: 'automatic', platform: 'browser', alias: { '@': path.join(root, 'src') }, outfile: path.join(output, 'fixture.js'), define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID': 'undefined' } });
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(root, 'tailwind.config.ts'), 'utf8'), { compilerOptions: { module: 1 } }).outputText)(require, mod, mod.exports);
  const css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/^@import[^;]+;/, '') + '\n' + fs.readFileSync(path.join(root, 'src/app/theme.css'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'src/app/brand-theme.css'), 'utf8');
  const built = await require('postcss')([require('tailwindcss')({ ...mod.exports.default, content: [path.join(root, 'src/components/common/workspace-setup-screen.tsx'), { raw: contents, extension: 'tsx' }] })]).process(css, { from: path.join(root, 'src/app/globals.css') });
  fs.writeFileSync(path.join(output, 'fixture.css'), built.css);
  const server = http.createServer((req, res) => {
    if (['/fixture.js', '/fixture.css'].includes(req.url)) { res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8'); res.end(fs.readFileSync(path.join(output, req.url.slice(1)))); }
    else if (req.url === '/logo.png') { res.setHeader('Content-Type', 'image/png'); res.end(fs.readFileSync(path.join(root, 'public/logo.png'))); }
    else { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="app"></div><script src="/fixture.js"></script>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: process.env.THEME_BROWSER_CHANNEL || 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => { errors.push(error.message); console.error('Setup browser error:', error.message); });
    await page.addInitScript(p => {
      window.fixtureOnline = true; Object.defineProperty(navigator, 'onLine', { get: () => window.fixtureOnline });
      localStorage.setItem('trinity-appearance', 'light');
      window.TrinityOffline = { postMessage(raw) { const r = JSON.parse(raw); queueMicrotask(() => window.TrinityOffline.onmessage?.({ data: JSON.stringify({ id: r.id, success: true, ...(r.action === 'deviceColors' ? { palette: p } : {}) }) })); } };
    }, palette);
    const url = 'http://127.0.0.1:' + server.address().port;
    await page.goto(url);
    const screen = page.getByRole('dialog', { name: 'Setting up your workspace' });
    await screen.waitFor();
    assert.ok(await screen.getByText(/This is a one-time setup/).isVisible());
    await page.evaluate(() => window.fixture.readyExcept('pupils'));
    await page.waitForTimeout(250);
    const value = await screen.getByRole('progressbar').getAttribute('aria-valuenow');
    await page.waitForTimeout(1300);
    assert.equal(await screen.getByRole('progressbar').getAttribute('aria-valuenow'), value, 'Elapsed time does not invent progress');
    assert.equal(await page.evaluate(() => window.fixture.marker()), null);
    await page.screenshot({ path: path.join(output, 'desktop-light.png') });
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 800 });
      assert.equal(await screen.evaluate(e => e.scrollWidth <= window.innerWidth), true, 'No horizontal phone overflow');
      await page.screenshot({ path: path.join(output, width + '-light.png') });
    }
    await page.evaluate(() => { document.documentElement.classList.add('dark'); localStorage.setItem('trinity-look-and-feel', JSON.stringify({ preset: 'soft-indigo', background: 'plain', deviceColors: true })); window.dispatchEvent(new StorageEvent('storage', { key: 'trinity-look-and-feel', newValue: localStorage.getItem('trinity-look-and-feel') })); });
    await page.waitForFunction(() => document.documentElement.dataset.deviceColors === 'true');
    await page.screenshot({ path: path.join(output, '320-device-dark.png') });
    await page.keyboard.press('Tab');
    assert.ok(await screen.evaluate(e => e.contains(document.activeElement)), 'Keyboard focus remains inside setup');
    const text = await screen.getByRole('status').textContent();
    await page.waitForTimeout(6800);
    assert.notEqual(await screen.getByRole('status').textContent(), text, 'Helpful subtext rotates');
    await page.evaluate(() => { window.fixtureOnline = false; window.dispatchEvent(new Event('offline')); });
    assert.ok(await screen.getByText('Waiting for your connection…', { exact: true }).isVisible());
    assert.ok(await screen.getByRole('button', { name: 'Retry setup' }).isDisabled());
    await page.evaluate(() => { window.fixtureOnline = true; window.dispatchEvent(new Event('online')); window.fixture.report('pupils', 'error'); });
    await page.waitForTimeout(200);
    assert.ok(await screen.getByText('Some records could not be downloaded.', { exact: true }).isVisible());
    assert.ok(await screen.getByRole('button', { name: 'Retry setup' }).isEnabled());
    assert.equal(await page.evaluate(() => window.fixture.marker()), null);
    await page.evaluate(() => window.fixture.report('pupils', 'ready'));
    await page.waitForTimeout(300);
    await page.evaluate(() => window.fixture.pending());
    await page.waitForTimeout(1200);
    assert.ok(await screen.isVisible(), 'Dependent page requests prevent early dismissal');
    assert.equal(await page.evaluate(() => window.fixture.marker()), null);
    await page.evaluate(() => window.finishPage());
    await screen.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => window.fixture.marker()), 'complete');
    await page.reload(); await page.getByRole('heading', { name: 'Workspace available' }).waitFor();
    assert.equal(await screen.count(), 0, 'Returning account has quick startup');
    await page.evaluate(() => window.fixture.user({ id: 'parent', role: 'Parent', enabled: true }));
    await screen.waitFor();
    assert.equal(await screen.getByText('Staff records').count(), 0);
    await screen.getByText('Your children’s payment records').waitFor();
    await page.evaluate(() => window.fixture.readyExcept('payments'));
    await page.waitForTimeout(1200); assert.ok(await screen.isVisible());
    await page.evaluate(() => window.fixture.report('payments', 'ready')); await screen.waitFor({ state: 'hidden' });
    await page.evaluate(() => window.fixture.user({ id: 'signed-out', role: 'Admin', enabled: false }));
    assert.equal(await screen.count(), 0, 'Public and signed-out pages never download a workspace');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ stalledProgress: value, returningUser: true, accountIsolation: true, parentPayments: true, dependencyGate: true, offline: true, retry: true, widths: [1440, 390, 320], deviceColours: true, focus: true, errors }, null, 2));
    console.log('WORKSPACE_SETUP_BROWSER_OK: real progress, stalled downloads, errors/offline, rotating text, dependent queries, first-run persistence, account/parent isolation, mobile/device colours and keyboard focus.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
