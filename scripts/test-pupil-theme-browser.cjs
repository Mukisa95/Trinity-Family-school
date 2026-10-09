/* Real row class expressions and theme controls, with synthetic pupil data. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ts = require('typescript');
const esbuild = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/pupil-theme-qa');

function actualRowClasses() {
  const file = path.join(root, 'src/app/pupils/page.tsx');
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const expressions = {};
  function visit(node) {
    if (ts.isJsxAttribute(node) && node.name.text === 'className' && ts.isJsxExpression(node.initializer)) {
      const text = node.initializer.expression?.getText(source) || '';
      for (const field of ['row', 'name', 'detail', 'action']) {
        if (text.includes(`getPupilRowTheme(pupil.gender).${field}`)) expressions[field] ||= text;
      }
      if (text.includes('getPupilRowTheme(sibling.gender).sibling')) expressions.sibling = text;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.deepEqual(Object.keys(expressions).sort(), ['action', 'detail', 'name', 'row', 'sibling']);
  return Object.entries(expressions).map(([field, expression]) => `const ${field}Class=(pupil)=>{const sibling=pupil;return ${expression}};`).join('\n');
}

async function build() {
  fs.mkdirSync(output, { recursive: true });
  const contents = `
import React from 'react';import {createRoot} from 'react-dom/client';
import {ThemeProvider} from './src/components/providers/theme-provider';import {ThemeToggle} from './src/components/ui/theme-toggle';
import {getPupilRowTheme} from './src/components/pupils/pupil-row-theme';
${actualRowClasses()}
const pupils=[{gender:'Male',name:'Example pupil A'},{gender:'Female',name:'Example pupil B'}];
function Fixture(){return <ThemeProvider><main className="min-h-screen p-6 bg-background text-foreground"><header className="flex items-center justify-between mb-6"><h1 className="font-bold text-lg">Pupils</h1><ThemeToggle/></header><table className="w-full text-sm rounded-xl overflow-hidden"><thead className="bg-card"><tr><th className="p-4 text-left">Pupil details</th><th>Class</th><th>Codes</th><th>Actions</th></tr></thead><tbody className="bg-white dark:bg-slate-900">{pupils.map(pupil=><tr key={pupil.gender} data-gender={pupil.gender} className={rowClass(pupil)}><td className="p-4"><a href="#" className={nameClass(pupil)}>{pupil.name}</a><p className="text-slate-500 dark:text-slate-400">Active · ${'P.7'}</p></td><td><button className={detailClass(pupil)}>P.7 A</button></td><td className="font-mono text-slate-800 dark:text-slate-200">LIN: SAMPLE001</td><td><button aria-label={'Actions for '+pupil.gender} className={actionClass(pupil)}>⚙</button></td></tr>)}</tbody></table><section className="mt-6 rounded-lg p-4 bg-card"><a className={siblingClass(pupils[0])} href="#">Example sibling</a></section></main></ThemeProvider>}
createRoot(document.getElementById('app')).render(<Fixture/>);`;
  await esbuild.build({ absWorkingDir: root, stdin: { contents, resolveDir: root, loader: 'tsx' }, bundle: true, jsx: 'automatic', platform: 'browser', alias: { '@': path.join(root, 'src') }, define: { 'process.env.NODE_ENV': '"production"' }, outfile: path.join(output, 'fixture.js') });
  const config = ts.transpileModule(fs.readFileSync(path.join(root, 'tailwind.config.ts'), 'utf8'), { compilerOptions: { module: 1 } }).outputText;
  const mod = { exports: {} }; new Function('require', 'module', 'exports', config)(require, mod, mod.exports);
  const css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/^@import[^;]+;/, '') + '\n' + fs.readFileSync(path.join(root, 'src/app/theme.css'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'src/app/brand-theme.css'), 'utf8');
  const result = await require('postcss')([require('tailwindcss')({ ...mod.exports.default, content: [path.join(root, 'src/**/*.{ts,tsx}'), { raw: contents, extension: 'tsx' }] })]).process(css, { from: path.join(root, 'src/app/globals.css') });
  fs.writeFileSync(path.join(output, 'fixture.css'), result.css);
}
function contrast(a, b) {
  const lum = rgb => rgb.slice(0, 3).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
  const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
async function colours(row) {
  return row.evaluate(el => {
    const rgb = value => value.match(/[\d.]+/g).map(Number);
    const bg = rgb(getComputedStyle(el).backgroundColor), base = rgb(getComputedStyle(el.parentElement).backgroundColor);
    const alpha = bg[3] ?? 1, effective = bg.slice(0, 3).map((n, i) => n * alpha + base[i] * (1 - alpha));
    return { background: effective, name: rgb(getComputedStyle(el.querySelector('a')).color), detail: rgb(getComputedStyle(el.querySelector('button')).color), codes: rgb(getComputedStyle(el.children[2]).color), muted: rgb(getComputedStyle(el.querySelector('p')).color) };
  });
}
async function run() {
  await build();
  const server = http.createServer((req, res) => {
    if (req.url === '/fixture.js' || req.url === '/fixture.css') { res.setHeader('Content-Type', req.url.endsWith('js') ? 'text/javascript' : 'text/css'); res.end(fs.readFileSync(path.join(output, req.url.slice(1)))); }
    else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="app"></div><script src="/fixture.js"></script></body></html>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 700 }, colorScheme: 'dark' });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const toggle = page.getByRole('switch', { name: 'Dark theme' });
    await page.waitForFunction(() => !document.querySelector('[role=switch]').disabled);
    assert.equal(await toggle.getAttribute('aria-checked'), 'true', 'Fresh dark device must use dark appearance');
    const readings = {};
    for (const gender of ['Male', 'Female']) {
      const row = page.locator('tr[data-gender="' + gender + '"]');
      const before = await colours(row);
      await row.locator('a').hover(); await page.waitForTimeout(180);
      const hover = await colours(row); assert.notDeepEqual(hover.background, before.background);
      assert.ok(Math.max(...hover.background) < 80, gender + ' hover must remain dark');
      for (const field of ['name', 'detail', 'codes', 'muted']) assert.ok(contrast(hover[field], hover.background) >= 4.5, gender + ' ' + field + ' must remain readable');
      await page.screenshot({ path: path.join(output, 'pupil-' + gender.toLowerCase() + '-hover-dark.png') });
      await page.mouse.move(0, 0); await row.locator('a').focus(); await page.waitForTimeout(180);
      const focus = await colours(row); assert.deepEqual(focus.background, hover.background, 'Keyboard focus uses the same dark row surface');
      await row.locator('button').last().hover(); await page.waitForTimeout(220);
      const action = await row.locator('button').last().evaluate(el => getComputedStyle(el).backgroundColor.match(/[\d.]+/g).map(Number));
      assert.ok(action.slice(0, 3).every(n => n < 150), 'Action highlight must stay dark');
      readings[gender] = { hover, focus };
      await row.locator('a').evaluate(el => el.blur());
    }
    await page.mouse.move(0, 0); await toggle.click();
    await page.waitForFunction(() => !document.documentElement.classList.contains('dark') && !document.documentElement.dataset.themeReveal);
    for (const gender of ['Male', 'Female']) {
      const row = page.locator('tr[data-gender="' + gender + '"]'); await row.hover(); await page.waitForTimeout(180);
      const light = await colours(row); assert.ok(light.background.every(n => n > 230), 'Original pale light hover must remain');
    }
    await page.screenshot({ path: path.join(output, 'pupil-hover-light.png') });
    await page.emulateMedia({ colorScheme: 'dark' });
    assert.equal(await toggle.getAttribute('aria-checked'), 'false', 'Explicit light preference wins over the device setting');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ readings, browserErrors: errors }, null, 2));
    console.log('PUPIL_THEME_BROWSER_OK: actual page styles, male/female hover and keyboard focus, readable names/codes/actions, device default, manual override and original light hover.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(e => { console.error(e); process.exitCode = 1; });
