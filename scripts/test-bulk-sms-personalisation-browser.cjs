/* Real Bulk SMS page; all account, fee, Firestore and sending operations are synthetic. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.codex-tmp/bulk-sms-personalisation-browser');
const fixture = `
  const primary={id:'mother',firstName:'Jane',lastName:'Parent',relationship:'Mother',phone:'0700123456',additionalPhones:['0700111222']};
  const secondary={id:'other',firstName:'John',lastName:'Other',relationship:'Uncle',phone:'0700333444'};
  export const pupils=[{id:'alice',firstName:'Alice',lastName:'Test',otherNames:'Grace',admissionNumber:'001',payCode:'001234',classId:'p1',status:'Active',section:'Day',gender:'Female',guardians:[secondary,primary]},
    {id:'ben',firstName:'Ben',lastName:'Test',admissionNumber:'002',payCode:'009876',classId:'p1',status:'Active',section:'Boarding',gender:'Male',guardians:[primary]}];
  export const classes=[{id:'p1',name:'Primary One',code:'P1'}];
  export const years=[{id:'year',name:'2026',terms:[{id:'term',name:'Term 3',startDate:'2026-09-01',endDate:'2026-12-01'},{id:'other',name:'Term 2',startDate:'2026-05-01',endDate:'2026-08-01'}]}];
  export const fees={alice:{totalFees:120000,totalPaid:60000,balance:60000,applicableFees:[{feeStructureId:'transport',name:'Transport',amount:20000,paid:20000,balance:0}]},
    ben:{totalFees:130000,totalPaid:100000,balance:30000,applicableFees:[{feeStructureId:'transport',name:'Transport',amount:30000,paid:0,balance:30000}]}};
`;
const mocks = {
  'fixture': fixture,
  'next/navigation': `export const useRouter=()=>({push(){}});`,
  '@/lib/hooks/use-pupils': `import{pupils}from'fixture';export const usePupils=()=>({data:pupils});`,
  '@/lib/hooks/use-classes': `import{classes}from'fixture';export const useClasses=()=>({data:classes});`,
  '@/lib/hooks/use-sms-templates': `const data=[];export const useSMSTemplates=()=>({data});`,
  '@/lib/hooks/use-term-status': `import{years}from'fixture';export const useTermStatus=()=>({academicYears:years,effectiveTerm:{academicYear:years[0],term:years[0].terms[0]}});`,
  '@/lib/hooks/use-progressive-fees': `import React from'react';import{fees}from'fixture';export function useProgressiveFees(options){
    const[ready,setReady]=React.useState(false);React.useEffect(()=>{window.feeLoads++;const timer=setTimeout(()=>setReady(true),150);return()=>clearTimeout(timer)},[]);
    return{pupilFeesInfo:ready?fees:{},isProcessing:!ready,isLoading:false,error:null};}`,
  '@/lib/contexts/auth-context': `const user={id:'staff'};export const useAuth=()=>({user});`,
  '@/lib/hooks/use-wiza-sms-account': `export const useWizaSMSAccount=()=>({invalidateAccountData(){},forceRefreshAccountData:async()=>{},triggerActivityRefresh(){}});`,
  '@/lib/hooks/use-unified-account-balance': `export const useUnifiedAccountBalance=()=>({provider:'Wiza SMS'});`,
  '@/lib/firebase': `export const db={};`,
  'firebase/firestore': `export const collection=(...a)=>a,query=(...a)=>a,where=(...a)=>a;export const onSnapshot=(q,callback)=>{callback({forEach(){}});return()=>{}};`,
  '@/lib/services/sms.service': `export const SMSService={sendBulkSMS:async request=>{window.requests.push(request);await new Promise(r=>setTimeout(r,30));
    if(location.search.includes('failure')&&window.requests.length===1)throw Error('Synthetic lost response');
    return{success:true,recipientCount:request.recipients.length,message:'Accepted',messageId:'mock'};}};`,
  '@/components/common/glass-page-top-bar': `import React from'react';export const GlassPageTopBar=({title,center,actions})=><header><h1>{title}</h1>{center}{actions}</header>;export const GlassActionDock=({children})=><div>{children}</div>;export const GlassActionButton=React.forwardRef(({label,onClick,...props},ref)=><button ref={ref} onClick={onClick}>{label}</button>);`,
  '@/components/BulkSMS/AccountBalance': `export const AccountBalance=()=>null;`,
  '@/components/BulkSMS/SMSSettingsModal': `export default()=>null;`,
  '@/components/BulkSMS/WizaSMSDashboard': `export const WizaSMSDashboard=()=>null;`,
  '@/components/BulkSMS/WizaRechargeDialog': `export default()=>null;`,
  '@/components/BulkSMS/SMSScheduleDialog': `export const SMSScheduleDialog=({open})=>open?'Standard schedule opened':null;`,
  '@/components/BulkSMS/SMSScheduleListDialog': `export const SMSScheduleListDialog=()=>null;`,
  '@/components/BulkSMS/SMSResultDialog': `export default()=>null;`,
};
mocks['@/lib/access/scoped-firestore'] = mocks['firebase/firestore'];

async function run() {
  fs.mkdirSync(output, { recursive: true });
  await esbuild.build({ absWorkingDir: root, bundle: true, jsx: 'automatic', format: 'iife', outfile: path.join(output, 'app.js'), define: { 'process.env.NODE_ENV': '"development"' },
    stdin: { resolveDir: root, loader: 'tsx', contents: `import React from'react';import{createRoot}from'react-dom/client';import BulkSMS from'./src/app/bulk-sms/page';window.requests=[];window.feeLoads=0;window.fetch=async()=>({json:async()=>({success:true,balance:'100000'})});createRoot(document.getElementById('root')).render(<BulkSMS/>);` },
    plugins: [{ name: 'synthetic-services', setup(build) {
      build.onResolve({ filter: /.*/ }, args => mocks[args.path] ? ({ path: args.path, namespace: 'mock' }) : undefined);
      build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'tsx', resolveDir: root }));
    } }],
  });
  const config = require('tailwindcss/loadConfig')(path.join(root, 'tailwind.config.ts'));
  config.content = [path.join(root, 'src/app/bulk-sms/page.tsx'), path.join(root, 'src/components/fees/BulkSMSModal.tsx'), path.join(root, 'src/components/BulkSMS/*.tsx'), path.join(root, 'src/components/ui/*.tsx')];
  const css = await require('postcss')([require('tailwindcss')(config)]).process(fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/^@import.*$/gm, ''), { from: undefined });
  const server = http.createServer((request, response) => {
    if (request.url.startsWith('/app.js')) { response.setHeader('Content-Type', 'application/javascript'); response.end(fs.readFileSync(path.join(output, 'app.js'))); }
    else if (request.url.startsWith('/app.css')) { response.setHeader('Content-Type', 'text/css'); response.end(css.css); }
    else response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
    const url = `http://127.0.0.1:${server.address().port}`;
    for (const width of [390, 1280]) for (const dark of [false, true]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url);
      if (dark) await page.evaluate(() => document.documentElement.classList.add('dark'));
      await page.getByRole('button', { name: 'Customisation', exact: true }).waitFor();
      assert.equal(await page.getByLabel('Pupil name format').count(), 0);
      await page.getByText('P1', { exact: true }).click();
      await page.getByText('Primary', { exact: true }).click();
      const input = page.getByRole('textbox', { name: 'Message', exact: true });
      await input.fill('School opens tomorrow.');
      assert.equal(await page.evaluate(() => window.feeLoads), 0);
      await page.getByRole('button', { name: 'Send', exact: true }).click();
      await page.getByRole('heading', { name: 'Confirm SMS Sending' }).waitFor();
      assert.equal(await page.evaluate(() => window.requests.length), 0);
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: 'Schedule SMS', exact: true }).click();
      assert.equal(await page.getByRole('menuitem', { name: 'Schedule SMS', exact: true }).isDisabled(), false);
      await page.keyboard.press('Escape');
      await page.screenshot({ path: path.join(output, `default-${width}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Customisation', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Balance', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Fee item', exact: true }).count(), 0);
      assert.equal(await page.getByLabel('Skip balances below (Shs.)').count(), 0);
      assert.equal(await page.getByRole('button', { name: /Exclude selected text/ }).count(), 0);
      await input.fill('Dear ');
      await input.press('End');
      await page.getByRole('button', { name: 'Pupil name', exact: true }).click();
      await input.getByRole('button', { name: 'Format Pupil name', exact: true }).click();
      await page.getByLabel('Name format', { exact: true }).selectOption('first');
      await page.getByLabel('Text case', { exact: true }).selectOption('upper');
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      await page.getByRole('button', { name: 'New line', exact: true }).click();
      await page.getByRole('button', { name: 'SchoolPay code', exact: true }).click();
      await input.getByRole('button', { name: 'Format SchoolPay code', exact: true }).click();
      await page.getByText('Include field label', { exact: true }).click();
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      assert.ok(!(await input.innerText()).includes('{pupil_name}'));
      assert.equal(await page.evaluate(() => window.feeLoads), 0, 'no fee hooks mount on Bulk SMS');
      await page.screenshot({ path: path.join(output, `chips-${width}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Customisation', exact: true }).click();
      await page.getByRole('button', { name: 'Schedule SMS', exact: true }).click();
      assert.equal(await page.getByRole('menuitem', { name: 'Schedule SMS', exact: true }).isDisabled(), true);
      await page.keyboard.press('Escape');
      assert.equal(await page.getByLabel('Pupil name format').count(), 0);
      await page.getByPlaceholder('Add phone...').fill('0700555666');
      await page.getByPlaceholder('Add phone...').press('Enter');
      await page.getByRole('button', { name: 'Preview messages', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await page.getByRole('heading', { name: 'Review personalised SMS' }).waitFor().catch(async error => {
        await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
        console.log(await page.locator('body').innerText());
        console.log('Browser errors:', errors);
        throw error;
      });
      assert.equal(await dialog.locator('article').count(), 4, 'both pupils and their selected primary/additional numbers remain');
      assert.deepEqual(await dialog.locator('article p.whitespace-pre-wrap').allTextContents(), ['Dear ALICE\nSchoolPay code: 001234', 'Dear ALICE\nSchoolPay code: 001234', 'Dear BEN\nSchoolPay code: 009876', 'Dear BEN\nSchoolPay code: 009876']);
      assert.equal(await dialog.getByText('Dear BEN\nSchoolPay code: 009876', { exact: true }).count(), 2);
      await dialog.getByText('1 manual number excluded', { exact: true }).waitFor();
      await page.screenshot({ path: path.join(output, `preview-${width}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Send messages (4)' }).click();
      await page.getByRole('status').filter({ hasText: '4 accepted' }).waitFor();
      assert.deepEqual(await page.evaluate(() => window.requests.map(item => item.recipients[0])), ['+256700123456', '+256700111222', '+256700123456', '+256700111222']);
      assert.equal(await page.evaluate(() => window.requests.some(item => /trinity-sms-v1|\{pupil_name\}/.test(item.message))), false);
      assert.equal(await page.evaluate(() => window.feeLoads), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      await page.close();
    }
    const page = await browser.newPage();
    await page.goto(`${url}/?failure`);
    await page.getByText('P1', { exact: true }).click();
    await page.getByText('Primary', { exact: true }).click();
    await page.getByRole('textbox', { name: 'Message', exact: true }).evaluate(element => {
      element.focus(); const data = new DataTransfer(); data.setData('text/plain', 'Dear {pupil_name}.');
      element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData: data }));
    });
    assert.equal(await page.locator('[data-sms-field]').count(), 1);
    await page.getByRole('button', { name: 'Preview messages', exact: true }).click();
    await page.getByRole('button', { name: 'Send messages (4)' }).click();
    await page.getByRole('status').filter({ hasText: '1 need checking' }).waitFor();
    await page.getByRole('button', { name: 'Close', exact: true }).first().click();
    await page.getByRole('button', { name: 'Preview messages', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '1 need checking' }).waitFor();
    assert.equal(await page.evaluate(() => window.requests.length), 1, 'reopening preserves attempted delivery status');
    await page.getByRole('button', { name: 'Send remaining (3)' }).click();
    await page.getByRole('status').filter({ hasText: '3 accepted' }).waitFor();
    assert.equal(await page.evaluate(() => window.requests.length), 4, 'only untouched messages continue');
    assert.equal(await page.evaluate(() => window.feeLoads), 0);
    await page.close();
    console.log('PASS: real Bulk SMS page; collapsed controls, standard confirmation/scheduling, protected field formats, SchoolPay, no fee options or reads, primary/additional guardian numbers, shared parent context, manual exclusions, exact simulated sends, mobile/desktop light/dark. No real SMS sent.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
