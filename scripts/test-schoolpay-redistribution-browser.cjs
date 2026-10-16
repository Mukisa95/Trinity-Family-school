/* Exercise the actual SchoolPay modal with synthetic records and mocked persistence. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname,'..');
const output = path.join(root,'.codex-tmp/schoolpay-terms/browser');
fs.mkdirSync(output,{recursive:true});
const mocks = {
  'firebase/firestore': `export const collection=(...args)=>args; export const where=(...args)=>args; export const query=(...args)=>args; export const getDocs=async()=>{await new Promise(r=>setTimeout(r,30)); if(location.search.includes('load-error'))throw Error('offline'); return {docs:[{id:'sibling-paid',data:()=>({pupilId:'sibling',feeStructureId:'tuition',academicYearId:'y2026',termId:'2026-t3',amount:20000})}]};};`,
  '@/lib/firebase': `export const db={};`,
  '@/lib/services/payments.service': `export const PaymentsService={revertPayment:async(id)=>{window.reverted.push(id)}};`,
  '@/lib/services/history-log.service': `export const HistoryLogService={log:async()=>{}};`,
  '@/lib/services/pupil-snapshots.service': `export class PupilSnapshotsService {}`,
  '@/lib/services/uniform-fees-integration.service': `export class UniformFeesIntegrationService {}`,
  '@/lib/services/fees-holiday.service': `export class FeesHolidayService {}`,
};
mocks['@/lib/access/scoped-firestore']=mocks['firebase/firestore'];
mocks['@/lib/access/authorized-fetch']=`export const authorizedFetch=(...args)=>window.fetch(...args);`;
async function main(){
  await esbuild.build({absWorkingDir:root,stdin:{resolveDir:root,loader:'tsx',contents:`
import React from 'react'; import {createRoot} from 'react-dom/client';
import {SchoolPayRedistributeModal} from './src/app/fees/collect/[id]/components/SchoolPayRedistributeModal';
window.saved=[];window.reverted=[];
window.fetch=async(url,options)=>{const body=JSON.parse(options.body);window.saved.push(body);return {ok:!location.search.includes('save-error'),json:async()=>location.search.includes('save-error')?{error:'Synthetic save failure'}:{paymentId:'created-'+window.saved.length}};};
const years=[2026,2027].map(n=>({id:'y'+n,name:String(n),startDate:n+'-01-01',endDate:n+'-12-31',terms:[1,2,3].map(t=>({id:n+'-t'+t,name:'Term '+t,startDate:n+'-'+['01','05','09'][t-1]+'-01',endDate:n+'-'+['04-30','08-31','12-31'][t-1]}))}));
const pupil={id:'main',firstName:'Alex',lastName:'Test',classId:'p4',section:'Day',status:'Active',registrationDate:'2026-01-01'};
const siblings=[{...pupil,id:'sibling',firstName:'Grace'}];
const payment={id:'source',pupilId:'main',academicYearId:'y2026',termId:'2026-t3',feeStructureId:'schoolpay-general',amount:350000};
const transaction={key:'synthetic-receipt',txRef:'synthetic-tx',payerName:'Synthetic Parent',paymentDate:'2026-10-16T08:00:00Z',paymentMethod:'SchoolPay',totalAmount:350000,payments:[payment]};
const fees=[{id:'tuition',name:'Tuition',amount:100000,status:'active',isRequired:true}];
createRoot(document.getElementById('app')).render(<SchoolPayRedistributeModal transaction={transaction} feeStructures={fees} allAcademicYears={years} pupil={pupil} siblings={siblings} selectedTermId="2026-t3" selectedAcademicYear={years[0]} allPayments={[payment]} onDone={()=>{window.done=true}} onClose={()=>{window.closedModal=true}}/>);
`},outfile:path.join(output,'fixture.js'),bundle:true,platform:'browser',jsx:'automatic',alias:{'@':path.join(root,'src')},define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'mock-persistence',setup(b){b.onResolve({filter:/.*/},a=>{const candidate=a.path.replaceAll('\\','/');const key=Object.keys(mocks).find(k=>k===candidate || (k.startsWith('@/') && candidate.endsWith(k.slice(2)))); return key?{path:key,namespace:'mock'}:undefined;});b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'tsx',resolveDir:root}));}}]});
  const css=await require('postcss')([require('tailwindcss')({content:[{raw:fs.readFileSync(path.join(root,'src/app/fees/collect/[id]/components/SchoolPayRedistributeModal.tsx'),'utf8'),extension:'tsx'}],darkMode:'class',theme:{extend:{}}})]).process('@tailwind base; @tailwind components; @tailwind utilities;',{from:undefined});
  fs.writeFileSync(path.join(output,'fixture.css'),css.css);
  const server=http.createServer((req,res)=>{const file=req.url.split('?')[0];if(file==='/fixture.js'||file==='/fixture.css'){res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':'text/css');res.end(fs.readFileSync(path.join(output,file.slice(1))));}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="app"></div><script src="/fixture.js"></script></body></html>');}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  const url='http://127.0.0.1:'+server.address().port;
  try {
    for(const mobile of [false,true])for(const dark of [false,true]){
      const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:900}});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(url);if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
      await page.getByRole('button',{name:'Family (2)',exact:true}).click();
      await page.getByText('Test Grace',{exact:true}).waitFor();
      await page.getByLabel('Add redistribution term').selectOption('2027-t1');
      assert.equal(await page.getByText('Term 1 2027',{exact:true}).count(),3);
      await page.getByRole('button',{name:'⚡ Smart Distribute',exact:true}).click();
      assert.deepEqual(await page.locator('input[type=number]').evaluateAll(xs=>xs.map(x=>x.value)),['100000','80000','100000','70000']);
      await page.getByRole('button',{name:'Remove Term 1 2027',exact:true}).click();
      assert.deepEqual(await page.locator('input[type=number]').evaluateAll(xs=>xs.map(x=>x.value)),['100000','80000']);
      await page.getByLabel('Add redistribution term').selectOption('2027-t1');
      await page.getByRole('button',{name:'⚡ Smart Distribute',exact:true}).click();
      await page.locator('input[type=number]').first().fill('400000');
      assert.equal(await page.getByRole('button',{name:'Confirm Redistribution',exact:true}).isDisabled(),true);
      await page.getByRole('button',{name:'⚡ Smart Distribute',exact:true}).click();
      await page.screenshot({path:path.join(output,(mobile?'mobile':'desktop')+'-'+(dark?'dark':'light')+'.png'),fullPage:true});
      await page.getByText('Advance / Excess',{exact:true}).scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(output,(mobile?'mobile':'desktop')+'-'+(dark?'dark':'light')+'-future.png'),fullPage:true});
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
      assert.equal(overflow,false);
      await page.getByRole('button',{name:'Confirm Redistribution',exact:true}).click();
      await page.waitForFunction(()=>window.done===true);
      const saved=await page.evaluate(()=>window.saved);
      assert.deepEqual(saved.map(p=>[p.pupilId,p.academicYearId,p.termId,p.amount]),[['main','y2026','2026-t3',100000],['main','y2027','2027-t1',100000],['sibling','y2026','2026-t3',80000],['sibling','y2027','2027-t1',70000]]);
      assert.equal(saved.filter(p=>p.academicYearId==='y2027').every(p=>p.schoolPayOriginTermId==='2026-t3'&&p.schoolPayOriginYearId==='y2026'),true);
      assert.deepEqual(errors,[]);await page.close();
    }
    for(const kind of ['load-error','save-error']){
      const page=await browser.newPage();await page.goto(url+'?'+kind);
      await page.getByRole('button',{name:'Family (2)',exact:true}).click();
      if(kind==='load-error'){
        await page.getByRole('alert').waitFor();
        assert.equal(await page.getByRole('button',{name:'Confirm Redistribution'}).isDisabled(),true);
        assert.deepEqual(await page.evaluate(()=>window.reverted),[]);
      }else{
        await page.getByText('Test Grace',{exact:true}).waitFor();
        await page.getByRole('button',{name:'⚡ Smart Distribute',exact:true}).click();
        await page.getByRole('button',{name:'Confirm Redistribution'}).click();
        await page.getByText('Synthetic save failure',{exact:true}).waitFor();
        assert.equal(await page.evaluate(()=>!!window.done),false);
      }
      await page.close();
    }
    console.log('PASS: family cross-year selection, removal, Smart Distribute, over-allocation guard, saved year/origin, load/save failures, desktop/mobile, light/dark.');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1});
