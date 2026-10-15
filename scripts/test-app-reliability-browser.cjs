// Local synthetic fixture only: no hosted app, real accounts or school records.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const esbuild = require('esbuild');

(async () => {
  const output = path.join(process.cwd(), 'output/app-reliability-qa'); fs.mkdirSync(output, { recursive: true });
  const built = await esbuild.build({ stdin: { contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {AppDiagnosticsMonitor} from './src/components/common/app-diagnostics-monitor';
    import * as diagnostics from './src/lib/utils/app-diagnostics';
    window.fixtureDiagnostics = diagnostics;
    createRoot(document.getElementById('root')).render(<AppDiagnosticsMonitor/>);
    `, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    alias: { '@': path.join(process.cwd(), 'src') }, define: { 'process.env.NODE_ENV': '"production"' } });
  const server = http.createServer((req, res) => {
    if (req.url === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(built.outputFiles[0].text); return; }
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>:root{--background:0 0% 100%;--foreground:222 47% 11%;--muted-foreground:215 16% 47%;--border:214 32% 91%;--input:214 32% 91%;--primary:221 83% 53%;--primary-foreground:0 0% 100%;--ring:221 83% 53%}.dark{--background:222 47% 11%;--foreground:210 40% 98%;--muted-foreground:215 20% 65%;--input:217 33% 25%}body{font-family:Arial;background:hsl(var(--background));color:hsl(var(--foreground))}h1{padding:16px}</style></head><body><h1>Fixture sign-in screen</h1><div id="root"></div><script>
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
    await page.waitForFunction(()=>window.fixtureDiagnostics?.createAppDiagnosticReport().includes('web_started'));
    assert.equal(await page.getByRole('button', { name: 'App help', exact: true }).count(), 0);
    assert.equal(await page.getByRole('dialog').count(), 0);
    await page.evaluate(() => {
      for (let i=0;i<100;i++)window.fixtureDiagnostics.recordAppDiagnostic('offline_snapshot_failed');
      window.fixtureDiagnostics.recordAppDiagnostic('token=private-value');
      window.fixtureDiagnostics.flushAppDiagnostics();
    });
    const report = JSON.parse(await page.evaluate(() => window.fixtureDiagnostics.createAppDiagnosticReport()));
    assert.equal(report.events.length, 80);
    assert.equal(JSON.stringify(report).includes('private-value'), false);
    await page.reload();
    await page.waitForFunction(()=>window.fixtureDiagnostics);
    assert.match(await page.evaluate(()=>window.fixtureDiagnostics.createAppDiagnosticReport()), /offline_snapshot_failed/);
    assert.equal(await page.locator('#root').innerHTML(), '');
    await context.close();
    const ordinaryContext=await browser.newContext();
    const ordinaryPage=await ordinaryContext.newPage();
    await ordinaryPage.goto(origin+'?browser');
    await ordinaryPage.waitForFunction(()=>window.fixtureDiagnostics);
    assert.equal(await ordinaryPage.getByRole('button', { name: 'App help', exact: true }).count(), 0);
    assert.equal(await ordinaryPage.evaluate(()=>localStorage.getItem('trinity_reliability_v1')),null);
    console.log('APP_RELIABILITY_BROWSER_OK: no floating help UI, retained bounded private reports, persistence and browser inactivity.');
    await ordinaryContext.close();
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode=1; });
