// Exercises the actual dialogs with synthetic data and controlled saves; no Firebase writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const loadConfig = require('tailwindcss/loadConfig');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(os.tmpdir(), 'trinity-payment-drafts-browser');
fs.mkdirSync(output, { recursive: true });
const components = [
  'src/app/fees/collect/[id]/components/PaymentModal.tsx',
  'src/app/fees/collect/[id]/components/CarryForwardPaymentModal.tsx',
  'src/app/fees/collect/[id]/components/MultiFeePaymentModal.tsx',
  'src/app/fees/family/[...slug]/components/FamilyPaymentModal.tsx',
  'src/components/common/unsaved-payment-dialog.tsx',
  'src/components/ui/dialog.tsx', 'src/components/ui/alert-dialog.tsx', 'src/components/ui/button.tsx',
];
const fixture = `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {PaymentModal} from './${components[0]}';
import {CarryForwardPaymentModal} from './${components[1]}';
import {MultiFeePaymentModal} from './${components[2]}';
import {FamilyPaymentModal} from './${components[3]}';
window.calls=[]; window.fail=false; window.hold=false;
const fee={feeId:'tuition',amount:100000,name:'Tuition',balance:100000,amountPaid:0};
const items=[{name:'Tuition',amount:50000,paid:0,balance:50000,term:'Term 1',year:'2026'},
 {name:'Transport',amount:50000,paid:0,balance:50000,term:'Term 2',year:'2026'}];
function App(){
 const [kind,setKind]=useState('');
 const close=()=>setKind('');
 const save=async(data)=>{
  window.calls.push(data);
  if(window.hold) await new Promise(resolve=>{window.release=resolve;});
  if(window.fail) throw new Error('Payment confirmation failed. Entries kept.');
  close();
 };
 return <><h1>Payment draft browser verification</h1>
 {['single','carry','multi','family'].map(k=><button key={k} onClick={()=>setKind(k)}>Open {k}</button>)}
 {kind==='single' && <PaymentModal isOpen onClose={close} onSubmit={save} fee={fee}/>}
 {kind==='carry' && <CarryForwardPaymentModal isOpen onClose={close} onSubmit={save} fee={{...fee,feeBreakdown:items}}/>}
 <MultiFeePaymentModal isOpen={kind==='multi'} onClose={close} onPaymentSubmit={save}
  pupilName="GRACE NAKIYINGI" fees={[{id:'tuition',name:'Tuition',balance:100000}]}/>
 <FamilyPaymentModal isOpen={kind==='family'} onClose={close} onPaymentSubmit={save}
  familyPupils={[{id:'pupil-1',firstName:'Grace',lastName:'Nakiyingi'}]}
  feesInfo={{'pupil-1':{totalFees:100000,totalPaid:0,balance:100000,applicableFees:[
  {feeStructureId:'tuition',name:'Tuition',amount:100000,paid:0,balance:100000,
  termId:'t1',academicYearId:'2026',isCurrentTerm:true,isCarryForward:false}]}}}/>
 </>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
`;

async function run() {
  const bundled = await esbuild.build({
    absWorkingDir: root, stdin: { contents: fixture, resolveDir: root, loader: 'tsx' },
    bundle: true, platform: 'browser', alias: { '@': path.join(root, 'src') }, write: false,
  });
  const config = loadConfig(path.join(root, 'tailwind.config.ts'));
  config.content = components.map(file => ({raw: fs.readFileSync(path.join(root, file), 'utf8'), extension: 'tsx'}));
  const css = (await postcss([tailwind(config)]).process(
    fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/^@import.*$/gm, ''),
    { from: path.join(root, 'src/app/globals.css') },
  )).css;
  const server = http.createServer((request, response) => {
    if (request.url === '/fixture.js') {
      response.setHeader('Content-Type', 'text/javascript'); response.end(bundled.outputFiles[0].text);
    } else if (request.url === '/fixture.css') {
      response.setHeader('Content-Type', 'text/css'); response.end(css);
    } else {
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment drafts</title><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script src="/fixture.js"></script>');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  const checks = [];
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error('BROWSER_ERROR', error.message); });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const warning = page.getByRole('alertdialog');
    const open = async kind => {
      await page.getByRole('button', { name: `Open ${kind}`, exact: true }).click();
      await page.getByRole('dialog').waitFor();
    };
    const close = () => page.getByRole('button', {name: 'Close', exact: true}).click();
    const absent = async locator => assert.equal(await locator.count(), 0);
    const discard = async () => {
      await warning.getByRole('button', {name:'Discard', exact:true}).click();
      await page.getByRole('dialog').waitFor({state:'hidden'});
    };
    const input = kind => kind === 'single' ? page.locator('#paymentAmount') :
      kind === 'carry' ? page.locator('#carryPaymentAmount') : page.getByPlaceholder('Enter total amount');

    for (const kind of ['single','carry','multi','family']) {
      console.log('Checking', kind);
      await open(kind); await close();
      await page.getByRole('dialog').waitFor({state:'hidden'});
      await absent(warning);
      checks.push(`${kind}: untouched close`);
      await open(kind);
      await input(kind).fill('12500');
      if (kind === 'multi' || kind === 'family') {
        // Fee cards use a visual selection control, not a checkbox.
        await page.getByText('Tuition', {exact:true}).first().click();
      }
      await close(); await warning.waitFor();
      assert.match(await warning.innerText(), /12,500/);
      if (kind === 'multi') assert.match(await warning.innerText(), /GRACE NAKIYINGI/);
      if (kind === 'family') assert.match(await warning.innerText(), /GRACE|Grace/i);
      assert.equal(await warning.getByRole('button', {name:'Continue editing'}).evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Escape');
      await warning.waitFor({state:'hidden'});
      assert.equal(await input(kind).inputValue(), '12,500');
      await page.getByRole('button', {name:'Cancel',exact:true}).click();
      await warning.waitFor();
      await warning.getByRole('button', {name:'Continue editing'}).click();
      assert.equal(await input(kind).inputValue(), '12,500');
      checks.push(`${kind}: close/Escape/Cancel preserve draft and review actual entries`);
      await page.evaluate(()=>{window.fail=true;});
      await close();
      const before = await page.evaluate(()=>window.calls.length);
      await warning.getByRole('button', {name:'Save payment'}).click();
      await page.getByRole('alert').filter({hasText:'Payment confirmation failed'}).first().waitFor();
      assert.equal(await input(kind).inputValue(), '12,500');
      assert.equal(await page.evaluate(()=>window.calls.length), before+1);
      checks.push(`${kind}: failed save preserves entries`);
      await page.evaluate(()=>{window.fail=false;});
      await close();
      if(kind==='single') {
        await page.screenshot({path:path.join(output,'warning-desktop-light.png')});
        await page.setViewportSize({width:390,height:844});
        await page.evaluate(()=>document.documentElement.classList.add('dark'));
        await page.screenshot({path:path.join(output,'warning-mobile-dark.png')});
        const boxes=await warning.getByRole('button').evaluateAll(nodes=>nodes.map(n=>{
          const r=n.getBoundingClientRect(); return {left:r.left,right:r.right,height:r.height,bottom:r.bottom};
        }));
        assert.ok(boxes.every(box=>box.left>=0 && box.right<=390 && box.height>=44 && box.bottom<=844));
        await page.setViewportSize({width:1280,height:900});
        await page.evaluate(()=>document.documentElement.classList.remove('dark'));
      }
      await warning.getByRole('button', {name:'Save payment'}).click();
      await page.getByRole('dialog').waitFor({state:'hidden'});
      assert.equal(await page.evaluate(()=>window.calls.length), before+2);
      checks.push(`${kind}: save from warning completes once`);
      await open(kind); await input(kind).fill('5000');
      await page.keyboard.press('Escape'); await warning.waitFor();
      await discard();
      await open(kind); assert.equal(await input(kind).inputValue(), '');
      await close();
      checks.push(`${kind}: discard resets next entry`);
    }
    await open('single'); await input('single').fill('100001');
    await close(); const beforeInvalid=await page.evaluate(()=>window.calls.length);
    await warning.getByRole('button',{name:'Save payment'}).click();
    await page.getByText(/Amount cannot exceed balance/).first().waitFor();
    assert.equal(await page.evaluate(()=>window.calls.length),beforeInvalid);
    assert.equal(await input('single').inputValue(),'100,001');
    checks.push('invalid save returns to validation without losing draft');
    await close(); await discard();
    await open('carry');
    await page.getByRole('button',{name:'Item Specific',exact:true}).click();
    await page.getByRole('button').filter({hasText:'Transport'}).click();
    await input('carry').fill('7500'); await close();
    assert.match(await warning.innerText(),/Transport \(Term 2 - 2026\)/);
    await discard();
    checks.push('carry-forward warning identifies selected item and academic period');
    await open('single'); await input('single').fill('5000');
    await page.mouse.click(5,5); await warning.waitFor(); await discard();
    checks.push('outside click opens review');
    await open('single'); await input('single').fill('5000');
    await page.evaluate(()=>{window.hold=true;});
    await page.getByRole('button',{name:'Record Payment',exact:true}).click();
    await page.getByText('Processing...', {exact:true}).waitFor();
    await close(); await absent(warning);
    assert.equal(await page.getByRole('dialog').count(),1);
    await page.evaluate(()=>{window.hold=false;window.release();});
    await page.getByRole('dialog').waitFor({state:'hidden'});
    checks.push('in-flight save cannot be dismissed or repeated');
    await open('single'); await input('single').fill('5000');
    const unload = page.waitForEvent('dialog');
    const reload = page.reload().catch(()=>{});
    const nativePrompt=await unload; assert.equal(nativePrompt.type(),'beforeunload');
    await nativePrompt.dismiss(); await reload;
    assert.equal(await input('single').inputValue(),'5,000');
    await close(); await discard();
    checks.push('reload triggers browser protection and cancelled reload keeps draft');
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({environment:'Desktop Edge; synthetic data; no database writes',checks},null,2));
    console.log('PAYMENT_DRAFTS_BROWSER_OK',JSON.stringify({checks:checks.length,output}));
  } catch (error) {
    const page = browser?.contexts()[0]?.pages()[0];
    if (page) {
      console.error('VISIBLE_UI', await page.locator('body').innerText());
      await page.screenshot({path:path.join(output,'failure.png')});
    }
    throw error;
  } finally {
    if(browser) await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
