/* Real dashboard term/calendar cards and scoped class-label component. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http'), ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'output/dashboard-exam-classes-qa');
fs.mkdirSync(output, { recursive: true });
const fixture = `import React from 'react';import {createRoot} from 'react-dom/client';
import {TermScheduleCard} from '@/components/dashboard/TermScheduleCard';import {MonthCalendarCard} from '@/components/dashboard/MonthCalendarCard';
const term={id:'t3',name:'Term 3',startDate:'2026-09-01',endDate:'2026-12-01'},year={id:'2026',terms:[term]};
window.examFixture={term,year,classes:Array.from({length:6},(_,i)=>({id:'p'+(i+1),name:'Primary '+(i+1),code:'P.'+(i+1)})),events:[{id:'batch',title:'MID TERM',isExamEvent:true,classIds:['p1','p2','p3','p4','p5','p6'],startDate:'2026-10-19',endDate:'2026-10-21',isAllDay:true},{id:'single',title:'P7 EXAM',isExamEvent:true,classIds:['p6'],classNames:['Primary 6'],startDate:'2026-10-20',endDate:'2026-10-20',isAllDay:true},{id:'sports',title:'Sports day',isExamEvent:false,startDate:'2026-10-20',endDate:'2026-10-20',isAllDay:true}]};
function Fixture(){return <main className="mx-auto max-w-4xl bg-background p-3 text-foreground"><section aria-label="Term schedule"><TermScheduleCard/></section><section aria-label="Month calendar" className="mt-4"><MonthCalendarCard/></section></main>}createRoot(document.getElementById('app')).render(<Fixture/>);`;
const mocks = {
  'next/navigation': `export const useRouter=()=>({push(){}});`,
  '@/lib/hooks/use-classes': `export const useClasses=()=>({data:window.examFixture.classes});`,
  '@/lib/hooks/use-academic-years': `export const useActiveAcademicYear=()=>({data:window.examFixture.year});`,
  '@/lib/hooks/use-events-fixed': `export const useEvents=()=>({data:window.examFixture.events,isLoading:false});export const useExamsAsEvents=()=>({data:[],isLoading:false});export const useAcademicYearsForEvents=()=>({data:[window.examFixture.year],isLoading:false});export const useCurrentTerm=()=>({term:window.examFixture.term});`,
  '@/lib/hooks/use-uganda-holidays': `export const useUgandaHolidays=()=>({data:[]});`,
  '@fullcalendar/react': `import React from 'react';export default function Calendar(props){return <button onClick={e=>props.dateClick({date:new Date('2026-10-20T12:00:00'),jsEvent:e})}>Select exam day</button>}`,
};
async function main() {
  await require('esbuild').build({ absWorkingDir: root, stdin: { contents: fixture, loader: 'tsx', resolveDir: root }, bundle: true, jsx: 'automatic', platform: 'browser', outfile: path.join(output, 'fixture.js'), alias: { '@': path.join(root, 'src') }, define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'dashboard-fixture', setup(build) { build.onResolve({ filter: /.*/ }, args => mocks[args.path] ? { path: args.path, namespace: 'fixture' } : undefined);build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'tsx', resolveDir: root })); } }] });
  const mod = { exports: {} };new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(root, 'tailwind.config.ts'), 'utf8'), { compilerOptions: { module: 1 } }).outputText)(require, mod, mod.exports);
  const css = ['globals.css', 'theme.css', 'brand-theme.css'].map(file => fs.readFileSync(path.join(root, 'src/app', file), 'utf8')).join('\n').replace(/^@import[^;]+;/, '');
  const styled = await require('postcss')([require('tailwindcss')({ ...mod.exports.default, content: [path.join(root, 'src/components/dashboard/{TermScheduleCard,MonthCalendarCard}.tsx'), path.join(root, 'src/components/events/ui/exam-event-classes.tsx'), path.join(root, 'src/components/ui/{card,button,popover}.tsx'), { raw: fixture, extension: 'tsx' }] })]).process(css, { from: path.join(root, 'src/app/globals.css') });
  fs.writeFileSync(path.join(output, 'fixture.css'), styled.css);
  const server = http.createServer((req, res) => {
    if (['/fixture.js', '/fixture.css'].includes(req.url)) { res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : 'text/css');res.end(fs.readFileSync(path.join(output, req.url.slice(1)))); }
    else { res.setHeader('Content-Type', 'text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="app"></div><script src="/fixture.js"></script></body></html>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'msedge' });const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const width of [320, 375, 768, 1366]) for (const dark of [false, true]) {
      await page.setViewportSize({ width, height: 900 });await page.goto('http://127.0.0.1:' + server.address().port);
      await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark);
      const term = page.getByRole('region', { name: 'Term schedule' });await term.locator('[data-exam-classes]').first().waitFor();
      assert.deepEqual(await term.locator('[data-exam-classes]').allTextContents(), ['Classes: P.1, P.2, P.3, P.4, P.5, P.6', 'Classes: P.6']);
      await page.getByRole('button', { name: 'Select exam day' }).click();const popup = page.locator('[data-radix-popper-content-wrapper]');await popup.locator('[data-exam-classes]').first().waitFor();
      assert.deepEqual(await popup.locator('[data-exam-classes]').allTextContents(), ['Classes: P.1, P.2, P.3, P.4, P.5, P.6', 'Classes: P.6']);
      for (const label of await page.locator('[data-exam-classes]:visible').all()) {
        assert.equal(await label.evaluate(el => el.scrollWidth <= el.clientWidth && !['hidden', 'clip'].includes(getComputedStyle(el).overflowY)), true, 'All class labels wrap without clipping');
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: path.join(output, `${width}-${dark ? 'dark' : 'light'}.png`), fullPage: true });await page.keyboard.press('Escape');
    }
    assert.deepEqual(errors, []);console.log('DASHBOARD_EXAM_CLASSES_OK: six-class batch, single class and non-exam, term and calendar popup, 4 widths x light/dark.');
  } finally { await browser?.close();await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error);process.exitCode = 1; });
