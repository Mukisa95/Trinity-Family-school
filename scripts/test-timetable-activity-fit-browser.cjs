/* Render the actual day/week components with synthetic grouped activity records. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(os.tmpdir(), 'trinity-activity-fit');
const mocks = {
    '@/lib/hooks/use-timetable': `
        export const useTimetableProfiles=()=>({data:[window.profile]});
        export const useTimetablePeriods=()=>({data:window.periods});
        export const useTimetableEntries=()=>({data:window.entries});
        const mutation=()=>({mutateAsync:async()=>{throw Error('Unexpected mutation')}});
        export const useEditTimetableSelection=mutation,useSaveTimetableEntries=mutation,useDeleteTimetableEntry=mutation,useSaveTimetablePeriods=mutation,useSetTimetableClassStreamMode=mutation,useSetTimetableClassStreamOrder=mutation;`,
    '@/lib/hooks/use-classes': 'export const useClasses=()=>({data:window.classes});',
    '@/lib/hooks/use-subjects': 'export const useSubjects=()=>({data:[]});',
    '@/lib/hooks/use-staff': 'export const useStaff=()=>({data:[]});',
    '@/lib/hooks/use-timetable-density': 'export const useTimetableDensity=()=>false;',
    '@/components/common/glass-page-top-bar': 'export const GlassActionButton=()=>null;',
    '@/hooks/use-toast': 'export const useToast=()=>({toast:()=>{}});',
    '@/lib/hooks/use-school-settings': 'export const useSchoolSettings=()=>({data:{generalInfo:{name:"Synthetic School"}}});',
    '@/lib/hooks/use-pdf-viewer': 'export const usePDFViewer=()=>({});',
    '@/lib/offline/android-bridge': 'export const hasAndroidOfflineBridge=()=>false;',
};

async function run() {
    console.log('Building timetable fixture');
    const built = await require('esbuild').build({
        stdin: { resolveDir: root, loader: 'tsx', contents: `
            import React,{useState}from'react';import{createRoot}from'react-dom/client';
            import{TimetableGrid}from'./src/components/timetable/TimetableGrid';
            import{TimetableViewPanel}from'./src/components/timetable/TimetableViewPanel';
            window.classes=[1,2,3].map(n=>({id:'p'+n,name:'Primary '+n,code:'P.'+n,order:n,subjectAssignments:[]}));
            window.profile={id:'main',classIds:['p1','p2','p3']};
            window.periods=[1,2,3].map(n=>({id:'mon'+n,dayOfWeek:1,periodNumber:n,startTime:String(6+n).padStart(2,'0')+':00',endTime:String(7+n).padStart(2,'0')+':00',type:'lesson'}));
            window.entries=window.classes.map(c=>({id:c.id,classId:c.id,periodId:'mon1',periodIds:['mon1','mon2','mon3'],mergePeriods:true,entryType:'activity',activityName:'WEEKLY TEST',linkedClassIds:window.classes.filter(o=>o.id!==c.id).map(o=>o.id),subjectId:'ACTIVITY',teacherId:'UNASSIGNED'}));
            function App(){const[tick,setTick]=useState(0),[panel,setPanel]=useState(false),[zoom,setZoom]=useState(1);window.refresh=()=>setTick(x=>x+1);window.setPanel=setPanel;window.setZoom=setZoom;
                return panel?<TimetableViewPanel yearId="2026" termId="term3" profileId="main" externalZoom={zoom}/>:<TimetableGrid yearId="2026" termId="term3" profileId="main" initialDay={1} hideToolbar externalZoom={zoom}/>}
            createRoot(document.getElementById('root')).render(<App/>);
        ` },
        bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false,
        nodePaths: (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean),
        alias: { '@': path.join(root, 'src') }, define: { 'process.env.NODE_ENV': '"production"' },
        plugins: [{ name: 'synthetic-data', setup(build) {
            build.onResolve({ filter: /.*/ }, args => mocks[args.path] ? { path: args.path, namespace: 'mock' } : undefined);
            build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'tsx', resolveDir: root }));
        } }],
    });
    console.log('Building timetable styles');
    const configSource = require('typescript').transpileModule(fs.readFileSync(path.join(root, 'tailwind.config.ts'), 'utf8'), { compilerOptions: { module: 1 } }).outputText;
    const config = { exports: {} }; new Function('module', 'exports', 'require', configSource)(config, config.exports, require);
    const css = await require('postcss')([require('tailwindcss')({ ...config.exports.default, content: [path.join(root, 'src/components/timetable/*.tsx'), path.join(root, 'src/components/ui/*.tsx')] })]).process('@tailwind base;@tailwind components;@tailwind utilities; :root{--background:0 0% 100%;--foreground:222 47% 11%;--border:214 32% 91%;--muted-foreground:215 16% 47%} #root{height:600px}', { from: undefined });
    const server = http.createServer((req, res) => {
        res.setHeader('Content-Type', req.url === '/app.js' ? 'text/javascript' : req.url === '/app.css' ? 'text/css' : 'text/html');
        res.end(req.url === '/app.js' ? built.outputFiles[0].text : req.url === '/app.css' ? css.css : '<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script>');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    console.log('Launching browser');
    const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
    fs.mkdirSync(output, { recursive: true });
    const results = [], errors = [];
    try {
        const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://127.0.0.1:' + server.address().port);
        for (const week of [false, true]) {
            if (week) {
                await page.setViewportSize({ width: 1100, height: 800 });
                await page.evaluate(() => window.setPanel(true));
                await page.getByRole('button', { name: 'Week', exact: true }).click();
            }
            for (const width of [1100, 390]) {
                await page.setViewportSize({ width, height: 800 });
                for (const text of ['WEEKLY TEST', 'FELLOWSHIP', 'MDD', 'MORNING WORK']) {
                    await page.evaluate(text => { window.entries=window.entries.map(e=>({...e,activityName:text}));window.refresh(); }, text);
                    const cell = page.locator('td[rowspan="3"][colspan="3"]').first();
                    await cell.waitFor();
                    // Allow font loading and ResizeObserver-driven updates to settle.
                    await page.evaluate(() => document.fonts.ready);
                    await page.waitForTimeout(200);
                    const metrics = await cell.evaluate(td => {
                        const card = td.firstElementChild;
                        const label = card.firstElementChild;
                        const line = label.firstElementChild;
                        const style = getComputedStyle(line);
                        return { cellWidth:td.clientWidth, cellHeight:td.clientHeight, labelWidth:label.clientWidth,labelHeight:label.clientHeight,fontSize:parseFloat(style.fontSize),lines:[...label.children].map(el=>({text:el.textContent,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,scrollWidth:el.scrollWidth})),cardHeight:card.clientHeight };
                    });
                    results.push({ week, width, text, ...metrics });
                    console.log(JSON.stringify(results.at(-1)));
                    assert.equal(metrics.lines.map(line=>line.text).join(' '),text,'Rendered label matches the chosen activity');
                    assert(metrics.labelWidth >= metrics.cellWidth * 0.8, 'Label measurement must use the cell width');
                    assert(metrics.fontSize >= 22, 'Three-class merged labels must remain prominent');
                    assert(metrics.cardHeight >= metrics.cellHeight - 12, 'Card fills all merged rows');
                    assert(metrics.lines.every(line => line.scrollWidth <= metrics.labelWidth + 1), 'No clipped line');
                    assert(metrics.lines.reduce((sum,line)=>sum+line.height,0) <= metrics.labelHeight + 1, 'Lines fit vertically');
                    if (!text.includes(' ')) assert.equal(metrics.lines.length,1,'Single words never split');
                    if (text==='MDD') await page.screenshot({ path:path.join(output,`${week?'week':'day'}-${width}.png`) });
                }
            }
            await page.setViewportSize({ width:1100,height:800 });
            const sizes = [];
            for (const zoom of [0.5,1,2]) {
                await page.evaluate(zoom => {
                    window.entries=window.entries.map(e=>({...e,activityName:'WEEKLY TEST'}));
                    window.setZoom(zoom);window.refresh();
                },zoom);
                await page.waitForTimeout(200);
                sizes.push(await page.locator('[data-timetable-activity-label]').first().evaluate(el=>({
                    width:el.clientWidth,font:parseFloat(getComputedStyle(el.firstElementChild).fontSize),
                })));
            }
            assert(sizes[0].width < sizes[1].width && sizes[1].width < sizes[2].width,'Measurement follows timetable column resizing');
            assert(sizes[0].font < sizes[1].font && sizes[1].font < sizes[2].font,'Larger merged cells produce larger text');
            await page.screenshot({path:path.join(output,`${week?'week':'day'}-weekly-test-large.png`)});
            console.log(JSON.stringify({week,resize:sizes}));
            await page.evaluate(()=>window.setZoom(1));
        }
        assert.deepEqual(errors, []);
        console.log('ACTIVITY_FIT_BROWSER_OK: '+results.length+' real day/week label cases. Screenshots: '+output);
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
}
run().catch(error => { console.error(error); process.exitCode=1; });
