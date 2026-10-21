/* Actual grouping helper and calendar detail components with a six-class batch. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/exam-calendar-qa');
fs.mkdirSync(output, { recursive: true });
const fixture = `
import React from 'react';import {createRoot} from 'react-dom/client';
import {groupExamCalendarEvents} from '@/lib/utils/exam-calendar-events';
import {PlanningEventButton,EventPlanningDetails} from '@/components/events/ui/planning-panel';
const exams=Array.from({length:6},(_,i)=>({id:'mid-p'+(i+1),classId:'p'+(i+1),batchId:'mid',name:'MID TERM',baseName:'MID TERM',examTypeId:'et_mid',academicYearId:'2026',termId:'t3'}));
const projected=exams.map((exam,i)=>({id:'exam-'+exam.id,title:exam.name,isExamEvent:true,type:'Academic',priority:'High',status:'Scheduled',startDate:'2026-10-19',endDate:'2026-10-21',startTime:i?'10:00':'09:00',endTime:'12:00',isAllDay:false,location:'Room '+(i+1),targetAudience:['Primary '+(i+1)],classIds:[exam.classId],subjectIds:[],reminders:[],notificationsSent:[],sendReminders:false,requiresApproval:false,createdBy:'system',createdByName:'System',isPublic:true,tags:[],customFields:{originalExamId:exam.id,classDetails:[{id:exam.classId,name:'Primary '+(i+1)}]}}));
const events=groupExamCalendarEvents(projected,exams);
function Fixture(){const [selected,setSelected]=React.useState(null);return <main className="mx-auto min-h-screen max-w-5xl space-y-4 bg-background p-3 text-foreground sm:p-6"><div aria-label="Calendar entries" className="rounded-2xl border bg-card">{events.map(event=><PlanningEventButton key={event.id} event={event} onSelect={setSelected}/>)}</div>{selected&&<EventPlanningDetails event={selected} events={events} canEdit={false} canCreate={false} canDelete={false} canViewAttendance={false} onClose={()=>setSelected(null)} onEdit={()=>{}} onDuplicate={()=>{}} onStatus={()=>{}} onDelete={()=>{}} busy={false}/>}</main>};createRoot(document.getElementById('app')).render(<Fixture/>);`;
async function main() {
  await require('esbuild').build({ absWorkingDir: root, stdin: { contents: fixture, loader: 'tsx', resolveDir: root }, bundle: true, jsx: 'automatic', platform: 'browser', outfile: path.join(output, 'fixture.js'), alias: { '@': path.join(root, 'src') }, define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'next-link-fixture', setup(build) { build.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' })); build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}`, loader: 'jsx', resolveDir: root })); } }] });
  const config = ts.transpileModule(fs.readFileSync(path.join(root, 'tailwind.config.ts'), 'utf8'), { compilerOptions: { module: 1 } }).outputText;
  const mod = { exports: {} };new Function('require', 'module', 'exports', config)(require, mod, mod.exports);
  const css = ['globals.css', 'theme.css', 'brand-theme.css'].map(file => fs.readFileSync(path.join(root, 'src/app', file), 'utf8').replace(/^@import[^;]+;/, '')).join('\n');
  const built = await require('postcss')([require('tailwindcss')({ ...mod.exports.default, content: [path.join(root, 'src/components/events/ui/planning-panel.tsx'), path.join(root, 'src/components/ui/{button,badge}.tsx'), { raw: fixture, extension: 'tsx' }] })]).process(css, { from: path.join(root, 'src/app/globals.css') });
  fs.writeFileSync(path.join(output, 'fixture.css'), built.css);
  const server = http.createServer((req, res) => {
    if (['/fixture.js', '/fixture.css'].includes(req.url)) { res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : 'text/css');res.end(fs.readFileSync(path.join(output, req.url.slice(1)))); }
    else { res.setHeader('Content-Type', 'text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="app"></div><script src="/fixture.js"></script></body></html>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'msedge' });
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const width of [320, 375, 768, 1366]) for (const dark of [false, true]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('http://127.0.0.1:' + server.address().port);
      await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark);
      const entries = page.getByLabel('Calendar entries');
      assert.equal(await entries.getByRole('button').count(), 1);
      assert.ok((await entries.textContent()).includes('6 classes'));
      await entries.getByRole('button').click();
      const details = page.getByRole('region', { name: 'Event details' });
      await details.getByRole('heading', { name: 'Classes involved (6)' }).waitFor();
      for (let index = 1; index <= 6; index++) {
        const link = details.getByRole('link', { name: 'Primary ' + index, exact: true });
        assert.equal(await link.getAttribute('href'), '/exams/mid-p' + index + '/view-results?classId=p' + index);
        assert.ok((await link.locator('..').textContent()).includes('Room ' + index));
      }
      assert.ok((await details.textContent()).includes('See each class schedule below'));
      assert.equal(await details.getByRole('link').count(), 6);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'No page overflow at ' + width);
      await page.screenshot({ path: path.join(output, `${width}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
      await details.getByRole('button', { name: 'Close event details' }).click();
      assert.equal(await page.getByRole('region', { name: 'Event details' }).count(), 0);
    }
    assert.deepEqual(errors, []);
    console.log('PASS: one batch event, six class schedules and links, 4 widths x light/dark.');
  } finally { await browser?.close();await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error);process.exitCode = 1; });
