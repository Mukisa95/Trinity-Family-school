/* Render the actual day/week components with synthetic grouped activity records. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(os.tmpdir(), 'trinity-selection-editor');
const mocks = {
    '@/lib/hooks/use-timetable': `
        export const useTimetableProfiles=()=>({data:[window.profile]});
        export const useTimetablePeriods=()=>({data:window.periods});
        export const useTimetableEntries=()=>({data:window.entries});
        const mutation=()=>({mutateAsync:async()=>{throw Error('Unexpected mutation')}});
        export const useEditTimetableSelection=()=>({isPending:false,mutateAsync:async args=>{
            if(window.failSave)throw Error('Synthetic connection failure');const plan=window.planEdit(args.edit);window.lastSave={args,plan};
            window.entries=[...window.entries.filter(e=>!plan.removals.includes(e.id)),...plan.writes.map((e,i)=>({...e,id:'new'+i,createdAt:'now'}))];window.refresh();
        }});
        export const useSaveTimetableEntries=mutation,useDeleteTimetableEntry=mutation,useSaveTimetablePeriods=mutation,useSetTimetableClassStreamMode=mutation,useSetTimetableClassStreamOrder=mutation;`,
    '@/lib/hooks/use-classes': 'export const useClasses=()=>({data:window.classes});',
    '@/lib/hooks/use-subjects': 'export const useSubjects=()=>({data:window.subjects});',
    '@/lib/hooks/use-staff': 'export const useStaff=()=>({data:window.staff});',
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
            import {planTimetableSelectionEdit} from './src/lib/utils/timetable-selection';
            window.classes=[1,2,3].map(n=>({id:'p'+n,name:'Primary '+n,code:'P.'+n,order:n,subjectAssignments:[{subjectId:'math',teacherIds:['t'+n]},{subjectId:'eng',teacherIds:['t'+n]}]}));
            window.staff=[1,2,3].map(n=>({id:'t'+n,firstName:'Teacher',lastName:String(n)}));
            window.subjects=[{id:'math',name:'Mathematics',code:'MTC'},{id:'eng',name:'English',code:'ENG'}];
            window.profile={id:'main',classIds:['p1','p2','p3']};
            window.periods=[1,2,3,4,5].flatMap(d=>[1,2,3].map(n=>({id:'d'+d+'p'+n,dayOfWeek:d,periodNumber:n,startTime:String(6+n).padStart(2,'0')+':00',endTime:String(7+n).padStart(2,'0')+':00',type:'lesson'})));
            window.entries=[];
            window.planEdit=edit=>planTimetableSelectionEdit(edit,{yearId:'2026',profile:window.profile,classes:window.classes,staff:window.staff,periods:window.periods,entries:window.entries});
            function App(){const[tick,setTick]=useState(0);window.refresh=()=>setTick(x=>x+1);
                return <TimetableViewPanel yearId="2026" termId="term3" profileId="main"/>}
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
    const css = await require('postcss')([require('tailwindcss')({ ...config.exports.default, content: [path.join(root, 'src/components/timetable/*.tsx'), path.join(root, 'src/components/ui/*.tsx')] })]).process('@tailwind base;@tailwind components;@tailwind utilities; :root{--background:0 0% 100%;--foreground:222 47% 11%;--border:214 32% 91%;--muted-foreground:215 16% 47%;--popover:0 0% 100%;--popover-foreground:222 47% 11%;--input:214 32% 91%;--primary:220 70% 45%;--primary-foreground:0 0% 100%;--muted:210 40% 96%;--accent:210 40% 96%;--accent-foreground:222 47% 11%;--secondary:210 40% 96%;--secondary-foreground:222 47% 11%;--destructive:0 84% 60%} #root{height:600px}', { from: undefined });
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
        const cell = (cls,period) => page.locator('[data-edit-cell="'+cls+':'+period+'"] [data-state]').first();
        await page.getByRole('button',{name:'Edit timetable',exact:true}).click();
        await page.getByLabel('Editing view',{exact:true}).selectOption('week');
        assert.equal(await page.locator('[data-week-editor] section').count(),5,'All five days editable');
        await page.getByRole('button',{name:'Mark periods',exact:true}).click();
        await cell('p1','d1p1').click();
        await cell('p2','d2p2').click();
        await page.getByRole('button',{name:'Edit 2 marked',exact:true}).click();
        await page.getByLabel('Subject for selected periods',{exact:true}).selectOption('math');
        assert((await page.locator('[data-teacher-preview="p1"]').innerText()).includes('Teacher 1'));
        assert((await page.locator('[data-teacher-preview="p2"]').innerText()).includes('Teacher 2'));
        await page.getByRole('button',{name:'Apply to selected periods',exact:true}).click();
        const saved=await page.evaluate(()=>window.lastSave.plan.writes.map(e=>[e.classId,e.periodId,e.teacherId]));
        assert.deepEqual(saved,[['p1','d1p1','t1'],['p2','d2p2','t2']]);
        assert.equal(await page.getByRole('button',{name:'Clear selection',exact:true}).count(),0,'Save clears marks');
        await page.getByLabel('Edit class',{exact:true}).selectOption('p1');
        assert.equal(await page.locator('[data-edit-cell^="p2:"]').count(),0,'Class filter hides other classes');
        await page.getByRole('button',{name:'Select week',exact:true}).click();
        await page.getByRole('button',{name:'Edit 15 marked',exact:true}).click();
        await page.getByRole('button',{name:'Back to marks',exact:true}).click();
        await cell('p1','d1p1').click();
        await page.getByRole('button',{name:'Edit 14 marked',exact:true}).click();
        await page.keyboard.press('Escape');
        assert.equal(await page.getByRole('button',{name:'Clear selection',exact:true}).count(),0,'Escape clears selection');
        await cell('p1','d1p1').click();
        await page.getByRole('button',{name:/Mark.*Choose several lessons/}).click();
        await page.getByLabel('Edit class',{exact:true}).selectOption('p2');
        await cell('p2','d2p1').click();
        await page.getByRole('button',{name:'Edit 2 marked',exact:true}).click();
        await page.getByRole('button',{name:'Cancel and clear',exact:true}).click();
        await page.getByLabel('Edit class',{exact:true}).selectOption('');
        await page.getByRole('button',{name:'Select week',exact:true}).click();
        await page.getByRole('button',{name:'Edit 45 marked',exact:true}).click();
        await page.getByLabel('Subject for selected periods',{exact:true}).selectOption('eng');
        // The dialog must remain usable with a small viewport and many preview rows.
        await page.setViewportSize({width:390,height:640});
        const apply=page.getByRole('button',{name:'Apply to selected periods',exact:true});
        await apply.scrollIntoViewIfNeeded();
        const bounds=await apply.boundingBox();
        assert(bounds.y>=0 && bounds.y+bounds.height<=640,'Save controls fit the viewport');
        const lastTeacher=page.getByLabel('Teacher for Primary 3',{exact:true});
        await lastTeacher.scrollIntoViewIfNeeded();
        const teacherBounds=await lastTeacher.boundingBox();
        const footerBounds=await page.getByRole('button',{name:'Back to marks',exact:true}).boundingBox();
        assert(teacherBounds.y+teacherBounds.height<=footerBounds.y,'Last teacher choice stays above fixed footer');
        await page.screenshot({path:path.join(output,'mobile-dialog.png')});
        await page.getByRole('button',{name:'Cancel and clear',exact:true}).click();
        await page.getByLabel('Edit class',{exact:true}).selectOption('p2');
        await page.getByLabel('Editing view',{exact:true}).selectOption('day');
        await page.getByRole('button',{name:'Show Tuesday',exact:true}).click();
        await page.getByRole('button',{name:'Select day',exact:true}).click();
        await page.getByLabel('Editing view',{exact:true}).selectOption('week');
        await page.getByRole('button',{name:'Edit 3 marked',exact:true}).click();
        await page.getByRole('button',{name:'Cancel and clear',exact:true}).click();
        await page.getByRole('dialog').waitFor({state:'hidden'});
        await page.screenshot({path:path.join(output,'mobile-week.png')});
        await page.setViewportSize({width:1100,height:800});
        await page.screenshot({path:path.join(output,'desktop-week.png')});
        await page.getByRole('button',{name:'Select Monday',exact:true}).click();
        await page.getByRole('button',{name:'Edit 3 marked',exact:true}).click();
        await page.getByLabel('Subject for selected periods',{exact:true}).selectOption('math');
        await page.evaluate(()=>window.failSave=true);
        await page.getByRole('button',{name:'Apply to selected periods',exact:true}).click();
        assert((await page.getByRole('alert').innerText()).includes('Synthetic connection failure'));
        assert.equal(await page.getByRole('dialog').count(),1,'Failed saves keep the dialog and marks');
        await page.getByRole('button',{name:'Back to marks',exact:true}).click();
        await page.getByRole('button',{name:'Clear selection',exact:true}).click();
        assert.deepEqual(errors,[],'No browser exceptions');
        console.log('TIMETABLE_SELECTION_BROWSER_OK: multi-class multi-day save, class/week scopes, deselection, filters, dialog dismiss, mobile viewport and view switching. Screenshots: '+output);
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
}
run().catch(error => { console.error(error); process.exitCode=1; });
