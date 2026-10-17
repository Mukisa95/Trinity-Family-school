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
      const pupils=[{id:'alice',firstName:'Alice',lastName:'Test',otherNames:'Grace',classId:'p1',admissionNumber:'001',payCode:'001234',guardians:[guardian,{...guardian,phone:'+256700123456'}]},
        {id:'ben',firstName:'Ben',lastName:'Test',otherNames:'James',classId:'p1',admissionNumber:'002',payCode:'009876',guardians:[guardian]},
        {id:'no-phone',firstName:'Chris',lastName:'Test',classId:'p1',admissionNumber:'003',guardians:[]}];
      const fees={alice:{totalFees:120000,totalPaid:60000,balance:60000,applicableFees:[{feeStructureId:'transport',name:'Transport',amount:20000,paid:20000,balance:0}]},
        ben:{totalFees:130000,totalPaid:100000,balance:30000,applicableFees:[{feeStructureId:'transport',name:'Transport',amount:30000,paid:0,balance:30000}]}};
      function App(){const[open,setOpen]=useState(true),[info,setInfo]=useState(fees);
        window.changeFees=()=>setInfo({...fees,alice:{...fees.alice,balance:1000,applicableFees:[{...fees.alice.applicableFees[0],balance:1000}]}});
        return <><button onClick={()=>setOpen(true)}>Open SMS</button><BulkSMSModal isOpen={open} onClose={()=>setOpen(false)} pupils={pupils}
          classes={[{id:'p1',name:'Primary One',code:'P.1'}]} pupilFeesInfo={info} selectedFeeId={location.search.includes('all-fees')?'':'transport'}
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
  config.content = [path.join(root, 'src/components/fees/BulkSMSModal.tsx'), path.join(root, 'src/components/BulkSMS/*.tsx'), path.join(root, 'src/components/ui/*.tsx')];
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
    const cursor = async (input, search, end = false) => input.evaluate((element, { search, end }) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node; while ((node = walker.nextNode())) {
        if (node.parentElement.closest('[data-sms-control]')) continue;
        const index = node.textContent.indexOf(search); if (index < 0) continue;
        const range = document.createRange(); range.setStart(node, index + (end ? search.length : 0)); range.collapse(true);
        element.focus(); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
        element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); return;
      } throw Error('Text not found: ' + search);
    }, { search, end });
    for (const width of (process.env.SMS_BROWSER_EDITOR_ONLY ? [] : [320, 390, 1280])) for (const dark of [false, true]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.setDefaultTimeout(12000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(url);
      if (dark) await page.evaluate(() => document.documentElement.classList.add('dark'));
      await page.getByRole('heading', { name: 'Fees collection SMS' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Pupil name', exact: true }).count(), 0);
      await page.screenshot({ path: path.join(output, `default-${width}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
      const input = page.getByRole('textbox', { name: 'Message', exact: true });
      await input.fill('Dear , welcome.');
      await cursor(input, ',');
      await page.getByRole('button', { name: 'Customisation', exact: true }).click();
      await page.getByRole('button', { name: 'Pupil name', exact: true }).click();
      assert.equal(await input.getByRole('button', { name: 'Format Pupil name', exact: true }).count(), 1);
      assert.ok(!(await input.innerText()).includes('{pupil_name}'));
      assert.equal(await input.locator('[data-sms-field]').getAttribute('contenteditable'), 'false');
      await input.getByRole('button', { name: 'Format Pupil name', exact: true }).click();
      await page.getByLabel('Name format', { exact: true }).selectOption('first');
      await page.getByLabel('Text case', { exact: true }).selectOption('upper');
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      await page.getByRole('button', { name: 'Preview messages', exact: true }).click();
      await page.locator('article').getByText('Dear ALICE, welcome.', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Edit message', exact: true }).click();
      // A new field in the same message has independent formatting.
      await cursor(input, 'welcome.');
      await page.getByRole('button', { name: 'Customisation', exact: true }).click();
      await page.getByRole('button', { name: 'Pupil name', exact: true }).click();
      await input.getByRole('button', { name: 'Format Pupil name', exact: true }).nth(1).click();
      await page.getByLabel('Name format', { exact: true }).selectOption('surname');
      await page.getByLabel('Text case', { exact: true }).selectOption('title');
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      await page.getByRole('button', { name: 'Preview messages', exact: true }).click();
      await page.locator('article').getByText('Dear ALICE, Testwelcome.', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Edit message', exact: true }).click();
      await page.getByRole('button', { name: 'Customisation', exact: true }).click();
      await input.fill('Dear .\nPlease pay .\nSchool opens Monday.');
      await cursor(input, '.');
      await page.getByRole('button', { name: 'Pupil name', exact: true }).click();
      await input.getByRole('button', { name: 'Format Pupil name', exact: true }).click();
      await page.getByLabel('Name format', { exact: true }).selectOption('first');
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      await cursor(input, 'Please pay ', true);
      await page.getByRole('button', { name: 'Balance', exact: true }).click();
      // Highlight a section containing normal text and a protected amount field.
      await input.evaluate(element => {
        const nodes = []; const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT); let node;
        while ((node = walker.nextNode())) if (!node.parentElement.closest('[data-sms-control]')) nodes.push(node);
        const first = nodes.find(node => node.textContent.includes('Please pay '));
        const last = nodes.find(node => node.textContent.includes('School opens Monday.'));
        const range = document.createRange(); range.setStart(first, first.textContent.indexOf('Please pay '));
        range.setEnd(last, last.textContent.indexOf('School opens Monday.'));
        element.focus(); getSelection().removeAllRanges(); getSelection().addRange(range);
        element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      });
      await page.getByRole('button', { name: 'Exclude selected text when there is no balance', exact: true }).click();
      assert.equal(await input.locator('[data-sms-balance]').count(), 1);
      await page.screenshot({ path: path.join(output, `condition-${width}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Preview messages', exact: true }).click();
      assert.equal(await page.locator('article').count(), 2);
      await page.locator('article').getByText('Dear Alice.\nSchool opens Monday.', { exact: true }).waitFor();
      await page.locator('article').getByText('Dear Ben.\nPlease pay Shs. 30,000.\nSchool opens Monday.', { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => window.requests.length), 0);
      await page.getByRole('button', { name: 'Send messages (2)' }).click();
      await page.getByRole('status').filter({ hasText: '2 accepted' }).waitFor();
      assert.equal(await page.evaluate(() => window.requests.some(item => /trinity-sms-v1|\{balance\}|Only with a balance/.test(item.message))), false);
      await page.screenshot({ path: path.join(output, `preview-${width}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      await page.close();
    }
    {
      const page = await browser.newPage(); page.setDefaultTimeout(12000); await page.goto(url);
      await page.getByRole('button', { name: 'Customisation', exact: true }).click();
      const input = page.getByRole('textbox', { name: 'Message', exact: true });
      await input.fill('Hi '); await input.press('End');
      await page.getByRole('button', { name: 'Pupil name', exact: true }).click();
      await input.getByRole('button', { name: 'Format Pupil name', exact: true }).click();
      await page.getByLabel('Name format', { exact: true }).selectOption('first');
      await page.getByLabel('Text case', { exact: true }).selectOption('upper');
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      const chip = input.getByRole('button', { name: 'Format Pupil name', exact: true });
      const label = await chip.innerText();
      await chip.focus(); await chip.press('q');
      assert.equal(await chip.innerText(), label, 'typing cannot change a chip');
      await input.press('Control+End'); await input.press('Backspace');
      assert.equal(await input.locator('[data-sms-field]').count(), 0, 'backspace deletes the entire chip');
      await input.press('Control+z');
      assert.equal(await input.locator('[data-sms-field]').count(), 1, 'undo restores the chip');
      assert.equal(await input.locator('[data-sms-field]').getAttribute('data-sms-format'), '{"name":"first","textCase":"upper"}');
      await input.evaluate(element => {
        const range = document.createRange(); range.selectNodeContents(element);
        getSelection().removeAllRanges(); getSelection().addRange(range);
        const data = new DataTransfer(); element.dispatchEvent(new ClipboardEvent('copy', { bubbles: true, clipboardData: data }));
        window.testClipboard = { plain: data.getData('text/plain'), rich: data.getData('application/x-trinity-sms') };
      });
      assert.equal(await page.evaluate(() => window.testClipboard.plain), 'Hi Pupil name');
      await input.press('Control+End');
      await input.evaluate(element => {
        const data = new DataTransfer(); data.setData('text/plain', window.testClipboard.plain); data.setData('application/x-trinity-sms', window.testClipboard.rich);
        element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData: data }));
      });
      assert.equal(await input.locator('[data-sms-field]').count(), 2);
      assert.equal(await input.locator('[data-sms-field]').evaluateAll(nodes => new Set(nodes.map(node => node.dataset.smsId)).size), 2, 'pasted fields receive fresh identifiers');
      await input.evaluate(element => {
        const data = new DataTransfer(); data.setData('text/plain', ' Safe.'); data.setData('text/html', '<img src=x onerror="window.injected=true">');
        element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData: data }));
      });
      assert.equal(await input.locator('img,script').count(), 0, 'clipboard HTML is ignored');
      await page.getByRole('button', { name: 'Preview messages' }).click();
      await page.locator('article').getByText('Hi ALICEHi ALICE Safe.', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Edit message', exact: true }).click();
      await page.getByRole('button', { name: 'Customisation', exact: true }).click();
      await input.fill('Hello. Pay now. See you.');
      await input.evaluate(element => {
        const range = document.createRange(); range.setStart(element.firstChild, 7); range.setEnd(element.firstChild, 15);
        element.focus(); getSelection().removeAllRanges(); getSelection().addRange(range);
        element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      });
      await page.getByRole('button', { name: 'Exclude selected text when there is no balance', exact: true }).click();
      assert.equal(await input.locator('[data-sms-balance]').count(), 1);
      await input.evaluate(element => {
        const section = element.querySelector('[data-sms-balance]');
        const range = document.createRange(); range.setStartAfter(section.firstChild); range.collapse(true);
        element.focus(); getSelection().removeAllRanges(); getSelection().addRange(range);
        element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      });
      await input.press('Backspace');
      assert.equal(await input.locator('[data-sms-balance]').count(), 0, 'deleting the badge removes its rule');
      assert.equal(await input.innerText(), 'Hello. Pay now. See you.', 'removing the rule keeps its text');
      await input.press('Control+z');
      assert.equal(await input.locator('[data-sms-balance]').count(), 1);
      await input.getByRole('button', { name: 'Edit balance condition', exact: true }).click();
      await page.getByRole('button', { name: 'Remove condition, keep text', exact: true }).click();
      assert.equal(await input.locator('[data-sms-balance]').count(), 0);
      assert.equal(await input.innerText(), 'Hello. Pay now. See you.');
      await page.close();
    }
    for (const scenario of (process.env.SMS_BROWSER_EDITOR_ONLY ? [] : ['failure', 'loading', 'stale', 'all-fees', 'codes-and-formats'])) {
      const page = await browser.newPage(); page.setDefaultTimeout(12000);
      await page.goto(`${url}/?${scenario}`);
      await page.getByRole('button', { name: 'Customisation', exact: true }).click();
      await page.getByRole('button', { name: 'Use fees reminder example' }).click();
      const input = page.getByRole('textbox', { name: 'Message', exact: true });
      assert.equal(await input.locator('[data-sms-field]').count(), 7, 'legacy sample becomes protected fields');
      if (scenario === 'loading') {
        await page.getByRole('alert').filter({ hasText: 'Wait for fee calculations' }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Preview messages' }).isDisabled(), true);
      } else if (scenario === 'codes-and-formats') {
        await input.fill('Code: '); await cursor(input, 'Code: ', true);
        await page.getByRole('button', { name: 'SchoolPay code', exact: true }).click();
        await page.getByRole('button', { name: 'New line', exact: true }).click();
        await page.getByRole('button', { name: 'Class', exact: true }).click();
        await input.getByRole('button', { name: 'Format Class', exact: true }).click();
        await page.getByLabel('Class format', { exact: true }).selectOption('code');
        await page.getByRole('button', { name: 'Done', exact: true }).click();
        await page.getByRole('button', { name: 'New line', exact: true }).click();
        await page.getByRole('button', { name: 'Term', exact: true }).click();
        await input.getByRole('button', { name: 'Format Term', exact: true }).click();
        await page.getByLabel('Term format', { exact: true }).selectOption('short');
        await page.getByLabel('Text case', { exact: true }).selectOption('upper');
        await page.screenshot({ path: path.join(output, 'field-options.png'), fullPage: true });
        await page.getByRole('button', { name: 'Done', exact: true }).click();
        await page.getByRole('button', { name: 'Preview messages' }).click();
        assert.deepEqual(await page.locator('article p.whitespace-pre-wrap').allTextContents(), ['Code: 001234\nP.1\nT 3', 'Code: 009876\nP.1\nT 3']);
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
        } else await page.locator('article').filter({ hasText: 'Test Alice' }).getByText(/balance of Shs\. 60,000/).waitFor();
      }
      await page.close();
    }
    console.log('PASS: protected chips, per-occurrence formats, selected conditional text, SchoolPay, class/term formats, exact simulated sends, stale data, loading, failure/continue, mobile/desktop light/dark. No real SMS sent.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
