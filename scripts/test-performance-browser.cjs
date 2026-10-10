/* Real navigation/settings components with synthetic data; no authenticated service writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/performance-qa');
fs.mkdirSync(output, { recursive: true });
const mocks = {
  '@/components/common/SmartBackButton': `import React from 'react'; export const SmartBackButton=({children,...props})=><button {...props}>{children}</button>`,
  'next/link': `import React from 'react';export default React.forwardRef(({prefetch,children,...props},ref)=><a ref={ref} {...props}>{children}</a>);`,
  'next/navigation': `export const usePathname=()=>'/';export const useRouter=()=>({push:()=>{},replace:()=>{}});`,
  '@/lib/contexts/auth-context': `export const useAuth=()=>({user:{id:'test',role:'Admin'}});`,
  '@/lib/hooks/use-school-settings': `export const useSchoolSettings=()=>({data:{generalInfo:{name:'Test School'}}});`,
  '@/lib/services/granular-permissions.service': `export const GranularPermissionService={canAccessPage:()=>true,canAccessInventoryWorkspace:()=>true};`,
};
async function build() {
  await esbuild.build({ absWorkingDir: root, stdin: { resolveDir: root, loader: 'tsx', contents: `
import React from 'react';import {createRoot} from 'react-dom/client';
import {PerformanceProvider} from './src/components/providers/performance-provider';
import {ThemeProvider} from './src/components/providers/theme-provider';
import {SidebarProvider,Sidebar,SidebarContent,SidebarInset,SidebarTrigger} from './src/components/ui/sidebar';
import {SidebarNav} from './src/components/layout/sidebar-nav';import {navItems} from './src/config/nav';
import {LookAndFeelSettings} from './src/components/settings/look-and-feel-settings';
function Fixture(){return <PerformanceProvider><ThemeProvider><div className="dashboard-bg-wrapper"><SidebarProvider>
<Sidebar collapsible="icon"><SidebarContent><SidebarNav items={navItems}/></SidebarContent></Sidebar>
<SidebarInset className="min-w-0"><header className="p-4"><SidebarTrigger/></header><main><LookAndFeelSettings/><div data-theme-surface="paper">Report paper</div></main></SidebarInset>
</SidebarProvider></div></ThemeProvider></PerformanceProvider>}
createRoot(document.getElementById('app')).render(<Fixture/>);` }, bundle: true, jsx: 'automatic', platform: 'browser', alias: { '@': path.join(root, 'src') }, outfile: path.join(output, 'fixture.js'), define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'fixture', setup(build) {
    build.onResolve({ filter: /.*/ }, args => Object.hasOwn(mocks, args.path) ? { path: args.path, namespace: 'mock' } : undefined);
    build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'tsx', resolveDir: root }));
  } }] });
  const config = require('typescript').transpileModule(fs.readFileSync(path.join(root, 'tailwind.config.ts'), 'utf8'), { compilerOptions: { module: 1 } }).outputText;
  const mod = { exports: {} }; new Function('require', 'module', 'exports', config)(require, mod, mod.exports);
  const css = ['globals.css', 'theme.css', 'brand-theme.css'].map(name => fs.readFileSync(path.join(root, 'src/app', name), 'utf8').replace(/^@import[^;]+;/, '')).join('\n');
  const built = await require('postcss')([require('tailwindcss')({ ...mod.exports.default, content: [path.join(root, 'src/**/*.{ts,tsx}')] })]).process(css, { from: path.join(root, 'src/app/globals.css') });
  fs.writeFileSync(path.join(output, 'fixture.css'), built.css);
}
async function run() {
  await build();
  const server = http.createServer((req, res) => {
    const name = req.url.split('?')[0];
    if (name === '/fixture.js' || name === '/fixture.css') { res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(fs.readFileSync(path.join(output, name.slice(1)))); }
    else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><link rel="stylesheet" href="/fixture.css"></head><body><div id="app"></div><script src="/fixture.js"></script></body></html>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'msedge' });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole('button', { name: 'Full effects', exact: true }).click();
    await page.waitForFunction(() => document.documentElement.dataset.effects === 'full');
    await page.getByRole('button', { name: 'Pupils', exact: true }).click();
    assert.equal(await page.getByRole('link', { name: 'Pupils Management', exact: true }).isVisible(), true);
    await page.evaluate(() => { window.savedLink = document.querySelector('a[aria-label="Dashboard"]'); window.savedGroup = document.querySelector('button[aria-label="Pupils"]'); });
    await page.getByRole('button', { name: 'Toggle Sidebar', exact: true }).click();
    assert.equal(await page.getByRole('link', { name: 'Pupils Management', exact: true }).isVisible(), false);
    assert.equal(await page.evaluate(() => savedLink === document.querySelector('a[aria-label="Dashboard"]') && savedGroup === document.querySelector('button[aria-label="Pupils"]')), true, 'Collapse preserves links and group triggers');
    await page.getByRole('button', { name: 'Pupils', exact: true }).click();
    assert.equal(await page.getByRole('dialog').getByRole('link', { name: 'Pupils Management', exact: true }).isVisible(), true, 'Collapsed navigation retains access to group pages');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Toggle Sidebar', exact: true }).click();
    assert.equal(await page.evaluate(() => savedLink === document.querySelector('a[aria-label="Dashboard"]')), true, 'Expansion does not remount navigation');
    assert.equal(await page.getByRole('link', { name: 'Pupils Management', exact: true }).isVisible(), true, 'Expanded group state is preserved');
    await page.getByRole('button', { name: 'Reduced effects', exact: true }).click();
    await page.waitForFunction(() => document.documentElement.dataset.effects === 'reduced');
    assert.equal(await page.locator('[data-sidebar="sidebar"]').evaluate(element => getComputedStyle(element).backdropFilter), 'none');
    await page.screenshot({ path: path.join(output, 'desktop-reduced.png'), fullPage: true });
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.effects === 'reduced');
    assert.equal(await page.getByRole('button', { name: 'Reduced effects', exact: true }).getAttribute('aria-pressed'), 'true', 'Manual selection survives restart');
    await page.getByRole('button', { name: 'Full effects', exact: true }).click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.documentElement.dataset.effects === 'reduced');
    await page.setViewportSize({ width: 390, height: 844 });

    await page.screenshot({ path: path.join(output, 'mobile-reduced.png'), fullPage: true });
    const controls = await page.getByRole('group', { name: 'Visual effects', exact: true }).boundingBox();
    assert.ok(controls && controls.x >= 0 && controls.x + controls.width <= 390, 'Effects controls fit a narrow phone');
    assert.deepEqual(errors, []);
    console.log('PERFORMANCE_BROWSER_OK: stable navigation, collapsed popover, restored groups, effects persistence, reduced motion, mobile layout');
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
