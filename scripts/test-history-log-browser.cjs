/* Actual history page with synthetic records and read-only service boundaries. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'output/history-log-qa');
const logs=[
 {id:'payment',a:'create',e:'payment',rid:'pay-a',rl:'Tuition',ts:'2026-10-14T12:00:00Z',un:'Cashier',ur:'Staff',cf:['amount'],m:{pupilId:'a',feeId:'fee-a',amount:5000,notes:'Original payment note remains complete'}},
 {id:'pupil',a:'update',e:'pupil',rid:'a',rl:'Historic pupil name',ts:'2026-10-14T11:00:00Z',un:'Registrar',cf:['classId','section'],m:{classId:'c1',active:true},rp:'/pupils/edit?id=a'},
 {id:'bank',a:'create',e:'bank_loan',rid:'loan-a',rl:'School supplies',ts:'2026-10-14T10:00:00Z',un:'Banker',m:{pupilId:'a',amount:2000}},
 {id:'yesterday',a:'status',e:'pupil',rid:'a',rl:'Historic pupil name',ts:'2026-10-13T12:00:00Z',un:'Registrar',cf:['status'],m:{active:false}},
 {id:'other',a:'update',e:'pupil',rid:'b',rl:'Alpha Alice',ts:'2026-10-14T09:00:00Z',un:'Other user',m:{notes:'Different pupil with the same name'}},
 {id:'security',a:'permission',e:'user',rid:'user-a',rl:'Teacher',ts:'2026-10-14T08:00:00Z',un:'Admin',m:{role:'Staff',sensitive:true}},
 {id:'export',a:'export',e:'export',rid:'export-a',rl:'Pupils export',ts:'2026-10-14T07:00:00Z',un:'Exporter',m:{dataType:'pupils',recordCount:15,sensitive:true}},
 {id:'unknown',a:'update',e:'custom',rid:'custom-a',rl:'Original custom record',un:'System',cf:['customField'],m:{notes:'Complete unknown record content'}},
];
const mocks={
 '@/lib/services/history-log.service':`export const HistoryLogService={subscribeRecent(cb,limit){window.subscriptionLimit=limit;window.publishLogs=cb;cb(window.rows);return()=>{window.unsubscribed++}},getRecent:async()=>window.rows};`,
 '@/lib/services/fee-structures.service':`export const FeeStructuresService={getAllFeeStructures:async()=>[{id:'fee-a',name:'Tuition'}]};`,
 '@/lib/hooks/use-pupils':`const data=[{id:'a',firstName:'Alice',lastName:'Alpha'},{id:'b',firstName:'Alice',lastName:'Alpha'}];export const usePupils=()=>({data});`,
 '@/lib/hooks/use-classes':`const data=[{id:'c1',name:'Primary Seven'}];export const useClasses=()=>({data});`,
 '@/lib/hooks/use-academic-years':`const data=[{id:'year',name:'2026',terms:[{id:'term',name:'Term 3'}]}];export const useAcademicYears=()=>({data});`,
 '@/lib/contexts/navigation-context':`export const useNavigation=()=>({goBack(){},startNavigation(){}});`,
 'next/navigation':`export const usePathname=()=>'/history-log';export const useRouter=()=>({push:href=>window.nav.push(href)});`,
 'next/link':`import React from'react';export default({children,href,prefetch,...props})=><a {...props} href={href} onClick={e=>{e.preventDefault();window.nav.push(href)}}>{children}</a>;`,
};
async function run(){
fs.mkdirSync(output,{recursive:true});
const built=await require('esbuild').build({stdin:{resolveDir:root,loader:'tsx',contents:`import React from'react';import{createRoot}from'react-dom/client';import Page from'./src/app/history-log/page';window.rows=${JSON.stringify(logs)};window.nav=[];window.unsubscribed=0;createRoot(document.getElementById('root')).render(<Page/>);`},bundle:true,format:'iife',platform:'browser',jsx:'automatic',write:false,alias:{'@':path.join(root,'src')},define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'read-fixtures',setup(b){b.onResolve({filter:/.*/},a=>mocks[a.path]?{path:a.path,namespace:'mock'}:undefined);b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:root}));}}]});
const config=require('typescript').transpileModule(fs.readFileSync(path.join(root,'tailwind.config.ts'),'utf8'),{compilerOptions:{module:1}}).outputText;const mod={exports:{}};new Function('require','module','exports',config)(require,mod,mod.exports);
const cssSource=['globals.css','theme.css','brand-theme.css'].map(f=>fs.readFileSync(path.join(root,'src/app',f),'utf8').replace(/^@import[^;]+;/,'')).join('\n');
const css=(await require('postcss')([require('tailwindcss')({...mod.exports.default,content:[path.join(root,'src/**/*.{ts,tsx}') ]})]).process(cssSource,{from:path.join(root,'src/app/globals.css')})).css;
const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':req.url==='/styles.css'?'text/css':'text/html');res.end(req.url==='/fixture.js'?built.outputFiles[0].text:req.url==='/styles.css'?css:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><main class="p-3 md:p-6"><div id="root"></div></main><script src="/fixture.js"></script>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
try{
const errors=[];for(const mobile of [false,true])for(const dark of [false,true]){
 const page=await browser.newPage({viewport:mobile?{width:320,height:760}:{width:1280,height:900},hasTouch:mobile});page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
 await page.getByText('8 actions in 6 cards',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>subscriptionLimit),300);assert.equal(await page.locator('[data-history-stack]').count(),1);assert.equal(await page.locator('[data-history-entry]').count(),5,'Stack starts collapsed');
 await page.screenshot({path:path.join(output,(mobile?'mobile':'desktop')+'-'+(dark?'dark':'light')+'-collapsed.png')});
 const expand=page.getByRole('button',{name:/Expand 3 actions for Alpha Alice/});if(mobile)await expand.tap();else await expand.click();await page.locator('[data-history-entry="payment"]').waitFor();assert.equal(await page.locator('[data-history-entry]').count(),8);
 await page.getByText('Original payment note remains complete',{exact:false}).waitFor();await page.getByText('Historic pupil name',{exact:true}).first().waitFor();assert.match(await page.locator('[data-history-entry="payment"]').innerText(),/Cashier.*Staff/);assert.match(await page.locator('[data-history-entry="payment"]').innerText(),/UGX 5,000/);assert.match(await page.locator('[data-history-entry="pupil"]').innerText(),/Fields: classId, section/);assert.match(await page.locator('[data-history-entry="unknown"]').innerText(),/Complete unknown record content/);
 for(const[id,href]of [['payment','/fees/collect/a'],['pupil','/pupils/edit?id=a'],['bank','/banking/pupil-banking-details?pupilId=a'],['security','/users'],['export','/pupils']]){assert.equal(await page.locator(`[data-history-entry="${id}"]`).evaluate(el=>el.closest('a')?.getAttribute('href')),href);}
 assert.equal(await page.locator('[data-history-entry="unknown"]').evaluate(el=>el.closest('a')),null,'Unknown destination keeps the full card');assert.deepEqual(await page.evaluate(()=>nav),[],'Expansion never navigates');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'No horizontal overflow');
 await page.screenshot({path:path.join(output,(mobile?'mobile':'desktop')+'-'+(dark?'dark':'light')+'-expanded.png')});await page.locator('[data-history-entry="bank"]').click();assert.deepEqual(await page.evaluate(()=>nav),['/banking/pupil-banking-details?pupilId=a']);
 await page.evaluate(()=>{rows=[{...rows[0],id:'latest',a:'update',ts:'2026-10-14T13:00:00Z'},...rows];publishLogs(rows)});await page.getByRole('button',{name:/Collapse 4 actions for Alpha Alice/}).waitFor();assert.equal(await page.locator('[data-history-entry]').count(),9,'Realtime updates retain expanded state and every action');
 const search=page.getByRole('textbox',{name:'Search by item, user, field, amount...'}).filter({visible:true});await search.fill('Complete unknown record content');await page.getByText('1 action in 1 card',{exact:true}).waitFor();assert.equal(await page.locator('[data-history-entry="unknown"]').count(),1);await search.fill('');await page.getByText('9 actions in 6 cards',{exact:true}).waitFor();
 await page.getByRole('combobox').nth(2).click();await page.getByRole('option',{name:'Added',exact:true}).click();await page.getByText('2 actions in 1 card',{exact:true}).waitFor();await page.getByRole('button',{name:/Collapse 2 actions for Alpha Alice/}).waitFor();assert.equal(await page.locator('[data-history-entry]').count(),2);
 await page.getByRole('combobox').nth(2).click();await page.getByRole('option',{name:'All actions',exact:true}).click();await page.getByRole('combobox').nth(1).click();await page.getByRole('option',{name:'Sensitive actions',exact:true}).click();await page.getByText('2 actions in 2 cards',{exact:true}).waitFor();assert.equal(await page.locator('[data-history-stack]').count(),0);
 await page.close();
}assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({samePupilDayStacked:true,allOriginalDetailsPreserved:true,sameNamesDifferentIdsProtected:true,originsLinked:true,unknownDestinationsRetained:true,liveExpansionPreserved:true,searchFiltersPreserved:true,responsiveLightDark:true,errors},null,2));console.log('HISTORY_LOG_BROWSER_OK: compact stacks, complete original entries, action routes, live updates, search/filters and mobile/desktop light/dark.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
}
run().catch(e=>{console.error(e);process.exitCode=1});
