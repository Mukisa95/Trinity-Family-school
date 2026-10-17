/* Actual fees SMS dialog with synthetic pupils and a mocked SMS service. Never sends real SMS. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.codex-tmp/fees-sms-browser');

async function run() {
  fs.mkdirSync(output, { recursive: true });
  await esbuild.build({
    absWorkingDir: root, bundle: true, jsx: 'automatic', format: 'iife', outfile: path.join(output, 'app.js'),
    define: { 'process.env.NODE_ENV': '"development"' },
    stdin: { resolveDir: root, loader: 'tsx', contents: `
      import React,{useState} from 'react'; import{createRoot}from'react-dom/client';
      import{BulkSMSModal}from'./src/components/fees/BulkSMSModal';
      window.requests=[];
      const guardian={id:'g',firstName:'Jane',lastName:'Parent',phone:'0700123456'};
      const pupils=[{id:'alice',firstName:'Alice',lastName:'Test',otherNames:'Grace',classId:'p1',admissionNumber:'001',guardians:[guardian,{...guardian,phone:'+256700123456'}]},
        {id:'ben',firstName:'Ben',lastName:'Test',otherNames:'James',classId:'p1',admissionNumber:'002',guardians:[guardian]},
        {id:'no-phone',firstName:'Chris',lastName:'Test',classId:'p1',admissionNumber:'003',guardians:[]}];
      const fees={alice:{totalFees:120000,totalPaid:60000,balance:60000,applicableFees:[{feeStructureId:'transport',name:'Transport',amount:20000,paid:20000,balance:0}]},
        ben:{totalFees:130000,totalPaid:100000,balance:30000,applicableFees:[{feeStructureId:'transport',name:'Transport',amount:30000,paid:0,balance:30000}]}};
      function App(){const[open,setOpen]=useState(true),[info,setInfo]=useState(fees);
        window.changeFees=()=>setInfo({...fees,alice:{...fees.alice,balance:1000,applicableFees:[{...fees.alice.applicableFees[0],balance:1000}]}});
        return <><button onClick={()=>setOpen(true)}>Open SMS</button><BulkSMSModal isOpen={open} onClose={()=>setOpen(false)} pupils={pupils}
          classes={[{id:'p1',name:'Primary One'}]} pupilFeesInfo={info} selectedFeeId={location.search.includes('all-fees')?'':'transport'}
          feeItemName="Transport" yearName="2026" termName="Term 3" isFeesLoading={location.search.includes('loading')}
          currentUser={{displayName:'Synthetic Staff'}}/></>}
      createRoot(document.getElementById('root')).render(<App/>);
    ` },
    plugins: [{ name: 'mock-sms', setup(build) {
      build.onResolve({ filter: /^@\/lib\/services\/sms.service$/ }, args => ({ path: args.path, namespace: 'mock' }));
      build.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ loader: 'js', contents: `
        export const SMSService={sendBulkSMS:async request=>{window.requests.push(request);await new Promise(r=>setTimeout(r,100));
          if(location.search.includes('failure')&&window.requests.length===1)throw Error('Synthetic lost response');
          return{success:true,recipientCount:1,message:'Accepted',messageId:'mock'};}};
      ` }));
    } }],
  });
  const config = require('tailwindcss/loadConfig')(path.join(root, 'tailwind.config.ts'));
  config.content = [path.join(root, 'src/components/fees/BulkSMSModal.tsx'), path.join(root, 'src/components/BulkSMS/SMSCustomisation.tsx'), path.join(root, 'src/components/ui/*.tsx')];
  const css = await require('postcss')([require('tailwindcss')(config)]).process(
    fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/^@import.*$/gm, ''), { from: undefined },
  );
  fs.writeFileSync(path.join(output, 'app.css'), css.css);
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
      const dialog = page.getByRole('dialog');
      await page.getByRole('heading', { name: 'Fees collection SMS' }).waitFor();
      assert.equal(await page.getByLabel('Pupil name format', { exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Pupil name', exact: true }).count(), 0);
      await page.screenshot({ path: path.join(output, `default-${width}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Customisation', exact: true }).click();
      const input = page.getByRole('textbox', { name: 'Message', exact: false });
      await input.fill('Dear , your balance is ');
      await input.evaluate(element => element.setSelectionRange(5, 5));
      await page.getByRole('button', { name: 'Pupil name', exact: true }).click();
      assert.equal(await input.inputValue(), 'Dear {pupil_name}, your balance is ');
      await input.fill('{unknown}');
      assert.equal(await page.getByRole('button', { name: 'Preview messages' }).isDisabled(), true);
      await page.getByRole('button', { name: 'Use fees reminder example' }).click();
      await page.getByRole('radio', { name: 'Both parents' }).check();
      await page.screenshot({ path: path.join(output, `composer-${width}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Preview messages' }).click();
      await page.getByRole('heading', { name: 'Review personalised SMS' }).waitFor();
      assert.equal(await dialog.locator('article').count(), 2);
      await dialog.locator('article').filter({ hasText: 'Test Alice' }).getByText(/balance of Shs\. 0/).waitFor();
      await dialog.locator('article').filter({ hasText: 'Test Ben' }).getByText(/balance of Shs\. 30,000/).waitFor();
      assert.equal(await page.evaluate(() => window.requests.length), 0);
      assert.equal(await dialog.getByRole('button', { name: 'Send messages (2)' }).count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: path.join(output, `preview-${width}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Send messages (2)' }).click();
      await page.getByRole('status').filter({ hasText: '2 accepted' }).waitFor();
      assert.equal(await page.evaluate(() => window.requests.length), 2);
      assert.deepEqual(await page.evaluate(() => window.requests.map(item => item.recipients)), [['+256700123456'], ['+256700123456']]);
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      await page.getByRole('button', { name: 'Open SMS', exact: true }).click();
      await page.getByRole('button', { name: 'Customisation', exact: true }).click();
      await page.getByLabel('Skip balances below (Shs.)').fill('10000');
      await page.getByLabel('Pupil name format', { exact: true }).selectOption('first');
      await page.getByLabel('Pupil name case', { exact: true }).selectOption('upper');
      await input.fill('Dear {pupil_name},Balance: {balance}.');
      await input.evaluate(element => { const point = element.value.indexOf('Balance:'); element.setSelectionRange(point, point); });
      await page.getByRole('button', { name: 'New line', exact: true }).click();
      assert.equal(await input.inputValue(), 'Dear {pupil_name},\nBalance: {balance}.');
      await page.screenshot({ path: path.join(output, `controls-${width}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Preview messages' }).click();
      assert.equal(await dialog.locator('article').count(), 1);
      await dialog.locator('article').getByText('Dear BEN,\nBalance: Shs. 30,000.', { exact: true }).waitFor();
      await page.getByText('1 pupil excluded by the balance threshold', { exact: true }).waitFor();
      await page.screenshot({ path: path.join(output, `excluded-preview-${width}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
      const sendBounds = await page.getByRole('button', { name: 'Send messages (1)' }).boundingBox();
      assert.ok(sendBounds.y >= 0 && sendBounds.y + sendBounds.height <= 900, 'send action remains visible');
      await page.getByRole('button', { name: 'Send messages (1)' }).click();
      await page.getByRole('status').filter({ hasText: '1 accepted' }).waitFor();
      assert.equal(await page.evaluate(() => window.requests[2].message), 'Dear BEN,\nBalance: Shs. 30,000.');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      await page.close();
    }
    for (const scenario of ['failure', 'loading', 'stale', 'all-fees', 'case-options']) {
      const page = await browser.newPage();
      await page.goto(`${url}/?${scenario}`);
      await page.getByRole('button', { name: 'Customisation', exact: true }).click();
      await page.getByRole('button', { name: 'Use fees reminder example' }).click();
      if (scenario === 'loading') {
        await page.getByRole('alert').filter({ hasText: 'Wait for fee calculations' }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Preview messages' }).isDisabled(), true);
      } else {
        await page.getByRole('button', { name: 'Preview messages' }).click();
        if (scenario === 'stale') {
          await page.evaluate(() => window.changeFees());
          await page.getByRole('alert').filter({ hasText: 'details or fees changed' }).waitFor();
          assert.equal(await page.getByRole('button', { name: 'Send messages (2)' }).isDisabled(), true);
        } else if (scenario === 'failure') {
          await page.getByRole('button', { name: 'Send messages (2)' }).click();
          await page.getByRole('status').filter({ hasText: '1 need checking' }).waitFor();
          assert.equal(await page.evaluate(() => window.requests.length), 1);
          await page.getByRole('button', { name: 'Send remaining (1)' }).click();
          await page.getByRole('status').filter({ hasText: '1 accepted' }).waitFor();
          assert.equal(await page.evaluate(() => window.requests.length), 2);
          assert.match(await page.evaluate(() => window.requests[1].message), /Test Ben/);
        } else if (scenario === 'case-options') {
          for (const [format, expected] of [['surname', 'Test'], ['first', 'Alice'], ['both', 'Test Alice'], ['all', 'Test Alice Grace']]) {
            await page.getByRole('button', { name: 'Edit message', exact: true }).click();
            await page.getByRole('button', { name: 'Customisation', exact: true }).click();
            await page.getByRole('textbox', { name: 'Message', exact: false }).fill('Dear {pupil_name}.');
            await page.getByLabel('Pupil name format', { exact: true }).selectOption(format);
            await page.getByRole('button', { name: 'Preview messages' }).click();
            await page.locator('article').filter({ hasText: 'Test Alice Grace' }).getByText('Dear ' + expected + '.', { exact: true }).waitFor();
          }
          for (const [mode, expected] of [['upper', 'HELLO TEST ALICE GRACE. PLEASE PAY.'], ['lower', 'hello test alice grace. please pay.'], ['sentence', 'Hello test alice grace. Please pay.'], ['title', 'Hello Test Alice Grace. Please Pay.']]) {
            await page.getByRole('button', { name: 'Edit message', exact: true }).click();
            await page.getByRole('button', { name: 'Customisation', exact: true }).click();
            await page.getByRole('textbox', { name: 'Message', exact: false }).fill('hello {pupil_name}. PLEASE PAY.');
            await page.getByLabel('Whole message case', { exact: true }).selectOption(mode);
            await page.getByRole('button', { name: 'Preview messages' }).click();
            await page.locator('article').filter({ hasText: 'Test Alice Grace' }).getByText(expected, { exact: true }).waitFor();
          }
          assert.equal(await page.evaluate(() => window.requests.length), 0);
        } else await page.locator('article').filter({ hasText: 'Test Alice' }).getByText(/balance of Shs\. 60,000/).waitFor();
      }
      await page.close();
    }
    console.log('PASS: actual dialog, balance exclusions, all name/case options, new lines, exact simulated sends, preview, fee/all-fee amounts, shared parents, missing phones, stale data, loading, failure/continue, mobile/desktop, light/dark. No real SMS sent.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
