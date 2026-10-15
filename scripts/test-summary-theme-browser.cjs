/* Render actual summary-bar JSX with synthetic totals; no accounts or payment writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ts = require('typescript');
const esbuild = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/summary-theme-qa');
const files = [
  'src/app/fees/collect/[id]/PupilFeesCollectionClient.tsx',
  'src/app/banking/list/page.tsx',
  'src/app/banking/pupil-banking-details/page.tsx',
  'src/app/fees/analytics/page.tsx',
  'src/app/inventory/page.tsx',
  'src/app/procurement/page.tsx',
];
const sources = files.map(file => fs.readFileSync(path.join(root, file), 'utf8'));
function bars(source) {
  const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(ast.parseDiagnostics.length, 0);
  const found = [];
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'GlassSummaryBar') {
      assert.doesNotMatch(node.getText(ast), /\b(?:text|bg|border)-[\w-]+-(?:350|650|750|850)\b/);
      const prop = name => node.attributes.properties.find(p => p.name?.getText(ast) === name)?.initializer.expression.getText(ast);
      found.push({ left: prop('left'), right: prop('right') });
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return found;
}
const extracted = sources.map(bars);
const termStyles = sources[0].match(/const TERM_TAB_NEON_STYLES = ([\s\S]*?) as const;/)[1];
const contents = `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {GlassSummaryBar} from './src/components/common/glass-summary-bar';
import {Tabs,TabsList,TabsTrigger} from './src/components/ui/tabs';import {cn} from './src/lib/utils';
const TERM_TAB_NEON_STYLES=${termStyles};
const formatCurrency=n=>'USh '+n.toLocaleString('en-UG');
const summary=new Proxy({lowStockCount:2},{get:(o,k)=>o[k]??10}),stats=new Proxy({collectionRate:50},{get:(o,k)=>o[k]??10});
const accounts=[1,2],getActiveAccounts=()=>accounts,getPositiveBalances=()=>accounts,getTotalBalance=()=>920000;
const account={balance:920000},activeLoans=[1],totalOutstanding=920000,transactions=[1,2],releaseRequests=[{canRelease:true}],issuedItems=[1];
const isDataReady=true,hasTermSelectionError=false,isFinancialDataLoading=false,termTotals={totalFees:920000,totalPaid:0,totalBalance:920000};
const validAcademicYears=[{id:'2026',name:'2026',endDate:'2026-12-31'}],currentAcademicYearId='2026',validTerms=[1,2,3].map(n=>({id:'term'+n,name:'Term '+n})),isLoadingAcademicYears=false;
function Fixture(){const [selectedTermId,setSelectedTermId]=useState('term1'),[selectedAcademicYear,setSelectedAcademicYear]=useState(validAcademicYears[0]);
return <main className="p-6 grid gap-4"><section data-testid="fees"><Tabs value={selectedTermId} onValueChange={setSelectedTermId}><GlassSummaryBar left={${extracted[0][0].left}} right={${extracted[0][0].right}}/></Tabs></section>
${extracted.slice(1).flatMap((items, i) => items.map((bar, j) => `<section data-testid="summary-${i}-${j}"><GlassSummaryBar left={<strong>${files[i+1]}</strong>} right={${bar.right}}/></section>`)).join('\n')}
</main>};createRoot(document.getElementById('app')).render(<Fixture/>);`;
async function build() {
  fs.mkdirSync(output, { recursive: true });
  await esbuild.build({ absWorkingDir: root, stdin: { contents, resolveDir: root, loader: 'tsx' }, bundle: true, jsx: 'automatic', platform: 'browser', alias: { '@': path.join(root, 'src') }, define: { 'process.env.NODE_ENV': '"production"' }, outfile: path.join(output, 'fixture.js') });
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(root, 'tailwind.config.ts'), 'utf8'), { compilerOptions: { module: 1 } }).outputText)(require, mod, mod.exports);
  const css = ['globals.css', 'theme.css', 'brand-theme.css'].map(file => fs.readFileSync(path.join(root, 'src/app', file), 'utf8')).join('\n').replace(/^@import[^;]+;/, '');
  const content = sources.join('\n') + contents + ['src/components/common/glass-summary-bar.tsx', 'src/components/ui/tabs.tsx'].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
  const result = await require('postcss')([require('tailwindcss')({ ...mod.exports.default, content: [{ raw: content, extension: 'tsx' }] })]).process(css, { from: path.join(root, 'src/app/globals.css') });
  fs.writeFileSync(path.join(output, 'fixture.css'), result.css);
}
function contrast(a, b) {
  const luminance = c => c.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((v, n, i) => v + n * [.2126, .7152, .0722][i], 0);
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
async function colours(locator) {
  return locator.evaluate(el => {
    const rgb = v => v.match(/[\d.]+/g).map(Number);
    const blend = (front, back) => front.slice(0, 3).map((v, i) => v * (front[3] ?? 1) + back[i] * (1 - (front[3] ?? 1)));
    let stack = [], parent = el;
    while (parent) {
      const surface=parent.classList.contains('glass-summary-bar')?getComputedStyle(parent,'::before'):null;
      if(surface && surface.content!=='none')stack.unshift(rgb(surface.backgroundColor));
      stack.unshift(rgb(getComputedStyle(parent).backgroundColor));parent=parent.parentElement;
    }
    const background = stack.reduce((back, front) => blend(front, back), [255, 255, 255]);
    return { text: el.textContent, color: blend(rgb(getComputedStyle(el).color), background), background };
  });
}
async function run() {
  await build();
  const server = http.createServer((req, res) => {
    if (['/fixture.js', '/fixture.css'].includes(req.url)) { res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(fs.readFileSync(path.join(output, req.url.slice(1)))); }
    else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body style="background:white"><div id="app"></div><script src="/fixture.js"></script></body></html>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, channel: process.env.THEME_BROWSER_CHANNEL || 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors = [], reports = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole('tab', { name: 'Term 1' }).waitFor();
    for (const preset of ['trinity-classic', 'soft-indigo']) {
      for (const dark of [false, true]) {
        await page.evaluate(({ preset, dark }) => { document.documentElement.dataset.appTheme = preset; document.documentElement.classList.toggle('dark', dark); }, { preset, dark });
        // Let both the bar and tab colour transitions settle before measuring.
        await page.waitForTimeout(350);
        const readings = [];
        for (const term of ['Term 1', 'Term 2', 'Term 3']) {
          await page.getByRole('tab', { name: term }).click();
          await page.waitForTimeout(250);
          for (const button of await page.getByRole('tab').all()) {
            const value = await colours(button); readings.push(value);
            assert.ok(contrast(value.color, value.background) >= 4.5, `${preset} ${dark ? 'dark' : 'light'} ${value.text} tab contrast`);
          }
        }
        const labels = page.locator('.glass-summary-bar span').filter({ visible: true });
        for (const label of await labels.all()) {
          if (await label.locator('span').count()) continue;
          const value = await colours(label); readings.push(value);
          assert.ok(contrast(value.color, value.background) >= 4.5, `${preset} ${dark ? 'dark' : 'light'} ${value.text} statistic contrast: ${contrast(value.color, value.background).toFixed(2)}`);
        }
        reports.push({ preset, dark, minimumContrast: Math.min(...readings.map(r => contrast(r.color, r.background))), readings });
        await page.screenshot({ path: path.join(output, `summary-${preset}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
        console.log(`SUMMARY_CONTRAST_OK ${preset} ${dark ? 'dark' : 'light'}: statistics and all term-tab selections`);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Summary bars must fit small screens');
    await page.screenshot({ path: path.join(output, 'summary-mobile-dark.png'), fullPage: true });
    await page.emulateMedia({ media: 'print' });
    const paper = await colours(page.locator('.glass-summary-bar').first());
    assert.ok(paper.background.every(n => n > 240), 'Printed bar must remain light');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ reports, mobileFits: true, printStaysLight: true, browserErrors: errors }, null, 2));
    console.log('SUMMARY_THEME_BROWSER_OK: actual shared bar and seven source summary rows, both presets/modes, every term selection, mobile layout and light print surface.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
