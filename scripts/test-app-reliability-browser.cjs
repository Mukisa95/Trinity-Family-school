// Local synthetic fixture only: no hosted app, real accounts or school records.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const esbuild = require('esbuild');

(async () => {
  const output = path.join(process.cwd(), 'output/app-reliability-qa'); fs.mkdirSync(output, { recursive: true });
  const cssInput = path.join(output, 'fixture-input.css');
  const cssOutput = path.join(output, 'fixture.css');
  fs.writeFileSync(cssInput, '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
  require('node:child_process').execFileSync(process.execPath, [require.resolve('tailwindcss/lib/cli.js'), '-i', cssInput, '-o', cssOutput,
    '--content', 'src/components/common/app-help.tsx,src/components/ui/button.tsx,src/components/ui/dialog.tsx'], { stdio: 'pipe', timeout: 60000 });
  const built = await esbuild.build({ stdin: { contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {AppHelp} from './src/components/common/app-help';
    import * as diagnostics from './src/lib/utils/app-diagnostics';
    window.fixtureDiagnostics = diagnostics;
    createRoot(document.getElementById('root')).render(<AppHelp/>);
    `, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    alias: { '@': path.join(process.cwd(), 'src') }, define: { 'process.env.NODE_ENV': '"production"' } });
  const server = http.createServer((req, res) => {
    if (req.url === '/fixture.css') { res.setHeader('Content-Type', 'text/css'); res.end(fs.readFileSync(cssOutput)); return; }
    if (req.url === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(built.outputFiles[0].text); return; }
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><link rel="stylesheet" href="/fixture.css"/><style>:root{--background:0 0% 100%;--foreground:222 47% 11%;--muted-foreground:215 16% 47%;--border:214 32% 91%;--input:214 32% 91%;--primary:221 83% 53%;--primary-foreground:0 0% 100%;--ring:221 83% 53%}.dark{--background:222 47% 11%;--foreground:210 40% 98%;--muted-foreground:215 20% 65%;--input:217 33% 25%}body{font-family:Arial;background:hsl(var(--background));color:hsl(var(--foreground))}h1{padding:16px}</style></head><body><h1>Fixture sign-in screen</h1><div id="root"></div><script>
    if(!location.search.includes('browser'))window.TrinityOffline={postMessage(message){const request=JSON.parse(message);if(request.action==='diagnostics')setTimeout(()=>this.onmessage?.({data:JSON.stringify({id:request.id,success:false,error:'Unsupported action'})}),0)}};
    </script><script src="/fixture.js"></script></body></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 375, height: 760 } });
    const page = await context.newPage();
    const origin = `http://127.0.0.1:${server.address().port}`;
    await page.goto(origin);
    await page.getByRole('button', { name: 'App help', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    assert.match(await page.getByRole('textbox').inputValue(), /TRI-/);
    assert.match(await page.getByRole('textbox').inputValue(), /web_started/);
    await page.evaluate(() => {
      for (let i=0;i<100;i++)window.fixtureDiagnostics.recordAppDiagnostic('offline_snapshot_failed');
      window.fixtureDiagnostics.recordAppDiagnostic('token=private-value');
      window.fixtureDiagnostics.flushAppDiagnostics();
    });
    const report = JSON.parse(await page.evaluate(() => window.fixtureDiagnostics.createAppDiagnosticReport()));
    assert.equal(report.events.length, 80);
    assert.equal(JSON.stringify(report).includes('private-value'), false);
    await page.keyboard.press('Escape');
    await page.reload();
    await page.getByRole('button', { name: 'App help', exact: true }).click();
    assert.match(await page.getByRole('textbox').inputValue(), /offline_snapshot_failed/);
    await page.screenshot({ path: path.join(output, 'mobile-report-light.png') });
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.screenshot({ path: path.join(output, 'mobile-report-dark.png') });
    await page.keyboard.press('Escape');
    await page.evaluate(() => { window.trinityNativeDiagnostics=true; window.dispatchEvent(new Event('trinity-native-diagnostics')); });
    await page.getByRole('button', { name: 'App help', exact: true }).waitFor({ state: 'hidden' });
    await page.goto(origin+'?browser');
    assert.equal(await page.getByRole('button', { name: 'App help', exact: true }).count(), 0);
    console.log('APP_RELIABILITY_BROWSER_OK: login access, old-native fallback, bounded private reports, persistence, keyboard close, native help ownership, browser inactivity.');
    await context.close();
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode=1; });
