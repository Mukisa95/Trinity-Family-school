/* Actual timetable editor, popover, row helpers and PDF renderer; synthetic school records. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(os.tmpdir(), 'trinity-timetable-stream-order');
const mocks = {
    '@/lib/hooks/use-timetable': `
        export const useTimetableProfiles=()=>({data:[window.profile]});
        export const useTimetablePeriods=()=>({data:window.periods});
        export const useTimetableEntries=()=>({data:window.entries});
        const forbidden=()=>({mutateAsync:async()=>{throw Error('Lesson mutation must not be called')}});
        export const useSaveTimetableEntries=forbidden,useDeleteTimetableEntry=forbidden,useSaveTimetablePeriods=forbidden,useSetTimetableClassStreamMode=forbidden;
        export const useSetTimetableClassStreamOrder=()=>({isPending:false,mutateAsync:async(args)=>{
            if(window.failSave)throw Error('Synthetic save failure');
            window.saves.push(args);window.profile={...window.profile,streamLayouts:{...window.profile.streamLayouts,p7:{...window.profile.streamLayouts.p7,streamOrder:args.streamIds}}};
            localStorage.setItem('profile',JSON.stringify(window.profile));window.rerender();return args.streamIds;
        }});`,
    '@/lib/hooks/use-classes': 'export const useClasses=()=>({data:window.classes});',
    '@/lib/hooks/use-subjects': 'export const useSubjects=()=>({data:window.subjects});',
    '@/lib/hooks/use-staff': 'export const useStaff=()=>({data:[]});',
    '@/components/common/glass-page-top-bar': 'export const GlassActionButton=()=>null;',
    '@/hooks/use-toast': 'export const useToast=()=>({toast:()=>{}});',
    '@/lib/hooks/use-school-settings': 'export const useSchoolSettings=()=>({data:{generalInfo:{name:"Trinity School - synthetic test"}}});',
    '@/lib/hooks/use-pdf-viewer': `export const usePDFViewer=()=>({runPDFJob:async(_options,generate)=>{window.pdfBlob=await generate({updateProgress(){}})}});`,
};

async function run() {
    fs.mkdirSync(output, { recursive: true });
    const built = await require('esbuild').build({
        stdin: { resolveDir: root, loader: 'tsx', contents: `
            import React,{useState}from'react';import{createRoot}from'react-dom/client';
            import{TimetableGrid}from'./src/components/timetable/TimetableGrid';
            import{TimetableViewPanel}from'./src/components/timetable/TimetableViewPanel';
            import{PrintableTimetable}from'./src/components/timetable/PrintableTimetable';
            window.classes=[{id:'p7',name:'Primary Seven',code:'P.7',order:7,subjectAssignments:[],streams:[{id:'angels',name:'Angels',code:'A'},{id:'stars',name:'Stars',code:'S'}],streamConfigurations:[{academicYearId:'2026',enabled:true,activeStreamIds:['angels','stars']}]}];
            window.profile=JSON.parse(localStorage.getItem('profile')||'null')||{id:'main',classIds:['p7'],streamLayouts:{p7:{defaultMode:'separate'}}};
            window.subjects=[{id:'math',name:'Mathematics',code:'MATH'},{id:'eng',name:'English',code:'ENG'}];
            window.periods=[{id:'mon1',dayOfWeek:1,periodNumber:1,startTime:'08:00',endTime:'09:00',type:'lesson'}];
            window.entries=[{id:'angels-lesson',classId:'p7',periodId:'mon1',streamId:'angels',subjectId:'math',teacherId:''},{id:'stars-lesson',classId:'p7',periodId:'mon1',streamId:'stars',subjectId:'eng',teacherId:''}];
            window.saves=[];
            function App(){const[tick,setTick]=useState(0),[print,setPrint]=useState(false),[editing,setEditing]=useState(true),[panel,setPanel]=useState(false);window.rerender=()=>setTick(x=>x+1);window.setPrint=setPrint;window.setEditing=setEditing;window.setPanel=setPanel;
                return <>{panel?<TimetableViewPanel yearId="2026" termId="term3" profileId="main"/>:<TimetableGrid yearId="2026" termId="term3" profileId="main" initialDay={1} externalIsEditing={editing} hideToolbar/>}
                {print&&<PrintableTimetable entries={window.entries} periods={window.periods} classes={window.classes} subjects={window.subjects} staffList={[]} academicYearId="2026" profile={window.profile} onClose={()=>{}}/>}</>}
            createRoot(document.getElementById('root')).render(<App/>);
        ` },
        bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false,
        alias: { '@': path.join(root, 'src') }, define: { 'process.env.NODE_ENV': '"production"' },
        plugins: [{ name: 'boundaries', setup(build) {
            build.onResolve({ filter: /.*/ }, args => mocks[args.path] ? { path: args.path, namespace: 'mock' } : undefined);
            build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'tsx', resolveDir: root }));
        } }],
    });
    const configSource = require('typescript').transpileModule(fs.readFileSync(path.join(root, 'tailwind.config.ts'), 'utf8'), { compilerOptions: { module: 1 } }).outputText;
    const config = { exports: {} }; new Function('module', 'exports', 'require', configSource)(config, config.exports, require);
    const css = await require('postcss')([require('tailwindcss')({ ...config.exports.default, content: [path.join(root, 'src/components/timetable/*.tsx'), path.join(root, 'src/components/ui/{button,popover}.tsx')] })]).process('@tailwind base;@tailwind components;@tailwind utilities; :root{--background:0 0% 100%;--foreground:222 47% 11%;--popover:0 0% 100%;--popover-foreground:222 47% 11%;--border:214 32% 91%;--muted-foreground:215 16% 47%;--primary:243 75% 59%;--primary-foreground:0 0% 100%}', { from: undefined });
    const server = http.createServer((req, res) => {
        res.setHeader('Content-Type', req.url === '/app.js' ? 'text/javascript' : req.url === '/app.css' ? 'text/css' : 'text/html');
        res.end(req.url === '/app.js' ? built.outputFiles[0].text : req.url === '/app.css' ? css.css : '<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script>');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = process.env.TIMETABLE_BROWSER === 'webkit'
        ? await webkit.launch({ headless: true })
        : await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1366, height: 900 } }), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://127.0.0.1:' + server.address().port);
        const rows = () => page.locator('tbody tr');
        assert.match(await rows().nth(0).innerText(), /MATH/);
        assert.match(await rows().nth(1).innerText(), /ENG/);
        const before = await page.evaluate(() => JSON.stringify(entries));
        const open = async () => {
            await page.getByRole('button', { name: 'Manage stream layout for Primary Seven' }).click();
            await page.getByRole('button', { name: 'Arrange streams', exact: true }).click();
        };
        await open();
        await page.getByRole('button', { name: 'Move Stars up' }).click();
        assert.match(await page.getByRole('list', { name: 'Stream order' }).locator('li').first().innerText(), /Stars/);
        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        assert.equal(await page.evaluate(() => saves.length), 0);
        await page.getByRole('button', { name: 'Arrange streams', exact: true }).click();
        await page.getByRole('button', { name: 'Move Stars up' }).focus();
        await page.keyboard.press('Enter');
        await page.evaluate(() => { failSave = true; });
        await page.getByRole('button', { name: 'Save order', exact: true }).click();
        await page.getByRole('alert').getByText('Synthetic save failure').waitFor();
        assert.match(await page.getByRole('list', { name: 'Stream order' }).locator('li').first().innerText(), /Stars/);
        await page.evaluate(() => { failSave = false; });
        await page.getByRole('button', { name: 'Save order', exact: true }).click();
        await page.waitForFunction(() => saves.length === 1);
        await page.keyboard.press('Escape');
        assert.match(await rows().nth(0).innerText(), /ENG/);
        assert.match(await rows().nth(1).innerText(), /MATH/);
        assert.equal(await page.evaluate(() => JSON.stringify(entries)), before);
        assert.deepEqual(await page.evaluate(() => saves[0]), { yearId: '2026', termId: 'term3', timetableId: 'main', classId: 'p7', streamIds: ['stars', 'angels'] });
        await page.reload();
        await page.getByText('ENG', { exact: true }).first().waitFor();
        assert.match(await rows().nth(0).innerText(), /ENG/);

        await page.setViewportSize({ width: 390, height: 844 });
        await open();
        const panel = page.getByRole('list', { name: 'Stream order' });
        const box = await panel.boundingBox(); assert(box.x >= 0 && box.x + box.width <= 390, 'Arrangement controls fit on mobile');
        await page.screenshot({ path: path.join(output, 'arrange-mobile.png') });
        await page.keyboard.press('Escape');
        await page.evaluate(() => setEditing(false));
        await page.getByRole('button', { name: 'Manage stream layout for Primary Seven' }).waitFor({ state: 'detached' });
        await page.setViewportSize({ width: 1366, height: 900 });
        await page.evaluate(() => setPrint(true));
        const labels = page.locator('[data-printable-stream-label] canvas');
        await labels.first().waitFor();
        assert.deepEqual(await labels.evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label'))), ['S', 'A', 'S', 'A'], 'Preview and PDF capture use the same order');
        const printRows = page.locator('tr[data-printable-row-divider]');
        assert.match((await printRows.nth(0).locator('canvas').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')))).join(' '), /ENG/);
        assert.match((await printRows.nth(1).locator('canvas').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')))).join(' '), /MATH/);
        await page.waitForFunction(() => !!window.pdfBlob, { timeout: 30000 });
        fs.writeFileSync(path.join(output, 'arranged-timetable.pdf'), Buffer.from(await page.evaluate(async () => Array.from(new Uint8Array(await pdfBlob.arrayBuffer())))));
        await page.screenshot({ path: path.join(output, 'arranged-print.png') });
        await page.evaluate(() => {
            setPrint(false);
            // A full school day must scroll horizontally past the frozen labels.
            periods = Array.from({ length: 8 }, (_, i) => ({ ...periods[0], id: i ? 'lesson' + i : 'mon1', startTime: String(8 + i).padStart(2, '0') + ':00', endTime: String(9 + i).padStart(2, '0') + ':00' }));
            classes[0].code = 'P.7A';
            rerender();
        });
        const checkWidth = async (week, streamed) => {
            const header = page.getByRole('columnheader', { name: 'CLASS', exact: true });
            const width = (await header.boundingBox()).width;
            assert(Math.abs(width - (streamed ? 64 : 40)) < 2, `Class column is compact: ${width}px`);
            const cell = page.locator('tbody tr').first().locator('td').nth(week ? 1 : 0);
            const code = cell.getByText('P.7A', { exact: true });
            assert(await code.evaluate(el => el.scrollWidth <= el.clientWidth), 'Four-character class code stays readable');
            const box = await cell.boundingBox();
            const after = await cell.evaluate(el => {
                const scroller = el.closest('table').parentElement;
                scroller.scrollLeft = 180;
                return new Promise(resolve => requestAnimationFrame(() => resolve({ left: el.getBoundingClientRect().left, scrollLeft: scroller.scrollLeft, maxScroll: scroller.scrollWidth - scroller.clientWidth })));
            });
            if (after.maxScroll > 0) assert(after.scrollLeft > 0, 'Lesson columns scroll horizontally');
            assert(Math.abs(after.left - box.x) < 2, 'Compact class column stays frozen during horizontal scroll');
            await cell.evaluate(el => { el.closest('table').parentElement.scrollLeft = 0; });
        };
        for (const week of [false, true]) {
            await page.setViewportSize({ width: 1366, height: 900 });
            if (week) {
                await page.evaluate(() => setPanel(true));
                await page.getByRole('button', { name: 'Week', exact: true }).click();
            }
            for (const streamed of [true, false]) {
                await page.evaluate(value => { profile = { ...profile, streamLayouts: { ...profile.streamLayouts, p7: { ...profile.streamLayouts.p7, defaultMode: value ? 'separate' : 'consolidated' } } }; rerender(); }, streamed);
                for (const width of [320, 390, 768, 1366]) {
                    await page.setViewportSize({ width, height: 844 });
                    await checkWidth(week, streamed);
                    if (width === 390) await page.screenshot({ path: path.join(output, `compact-${week ? 'week' : 'day'}-${streamed ? 'streams' : 'class'}.png`) });
                }
            }
        }
        assert.deepEqual(errors, []);
        console.log('TIMETABLE_STREAM_ORDER_BROWSER_OK: stream controls, unchanged lessons, reload, PDF/print parity, compact day/week class columns at 320/390/768/1366px and frozen labels while scrolling passed. Artifacts: ' + output);
    } finally {
        await browser.close(); await new Promise(resolve => server.close(resolve));
    }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
