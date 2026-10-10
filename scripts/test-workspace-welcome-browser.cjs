/* Real wizard/controller/provider; the OS credential service is simulated. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const ts = require('typescript'), esbuild = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'output/workspace-welcome-qa');
const palette = require('../tests/fixtures/android-device-palette.json');
async function run() {
  fs.mkdirSync(output, { recursive: true });
  const contents = `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider} from './src/components/providers/theme-provider';
import {WorkspaceWelcomeScreen} from './src/components/common/workspace-welcome-screen';
import {useFirstWorkspaceSetup} from './src/lib/hooks/use-first-workspace-setup';
import {readWorkspaceSetup,reportWorkspaceTask,workspaceSetupScope,workspaceSetupMarker} from './src/lib/startup/workspace-setup';
const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});
function Fixture(){const [user,setUser]=useState({id:'welcome',role:'Admin',enabled:true});
const setup=useFirstWorkspaceSetup({enabled:user.enabled,userId:user.id,role:user.role,awaitPersonalization:true});const scope=workspaceSetupScope(user.id,user.role);
window.fixture={user:setUser,percent:()=>readWorkspaceSetup(client,scope,user.role).percent,report:(id,state)=>reportWorkspaceTask(client,scope,id,state),
readyExcept:(id)=>{client.setQueryData(['schoolSettings','settings'],{});readWorkspaceSetup(client,scope,user.role).tasks.filter(t=>!['settings','page',id].includes(t.id)).forEach(t=>reportWorkspaceTask(client,scope,t.id,'ready'));},
marker:()=>localStorage.getItem(workspaceSetupMarker(scope))};
return setup.required?<WorkspaceWelcomeScreen key={scope} setup={setup} userId={user.id} privacy={{enabled:false,action:'lock-on-close',deviceUnlock:false}} applyPrivacy={choices=>{window.appliedPrivacy=choices;window.appliedCount=(window.appliedCount||0)+1;}}/>:<h1>Workspace available</h1>}
createRoot(document.getElementById('app')).render(<ThemeProvider><QueryClientProvider client={client}><Fixture/></QueryClientProvider></ThemeProvider>);`;
  const service = `export const PasskeyService={supported:async()=>window.passkeySupported!==false,hasLocalUnlock:()=>Boolean(window.enrolled),list:async()=>window.enrolled?[{id:'fixture',name:'This device',createdAt:null}]:[],isPreviouslyRegisteredError:e=>e.code==='ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED',register:async(password)=>{window.registerCalls=(window.registerCalls||0)+1;await new Promise((resolve,reject)=>{window.finishRegistration=()=>{window.enrolled=true;resolve()};window.cancelRegistration=()=>reject(new Error('Device unlock cancelled. You can try again or skip.'))});},remove:async()=>{throw new Error('Removal must not be offered during setup')}};`;
  await esbuild.build({ absWorkingDir: root, stdin: { contents, resolveDir: root, loader: 'tsx' }, bundle: true, jsx: 'automatic', platform: 'browser', alias: { '@': path.join(root, 'src') }, outfile: path.join(output, 'fixture.js'), define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID': 'undefined' }, plugins: [{name:'os-credential-fixture',setup(build){build.onResolve({filter:/passkey\.service$/},()=>({path:'fixture-service',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:service,loader:'js'}));}}] });
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(path.join(root, 'tailwind.config.ts'), 'utf8'), { compilerOptions: { module: 1 } }).outputText)(require, mod, mod.exports);
  const css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/^@import[^;]+;/, '') + '\n' + fs.readFileSync(path.join(root, 'src/app/theme.css'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'src/app/brand-theme.css'), 'utf8');
  const built = await require('postcss')([require('tailwindcss')({ ...mod.exports.default, content: [path.join(root, 'src/components/common/workspace-welcome-screen.tsx'), path.join(root, 'src/components/settings/passkey-settings.tsx'), path.join(root, 'src/components/ui/button.tsx'), { raw: contents, extension: 'tsx' }] })]).process(css, { from: path.join(root, 'src/app/globals.css') });
  fs.writeFileSync(path.join(output, 'fixture.css'), built.css);
  const server = http.createServer((req, res) => {
    if (['/fixture.js', '/fixture.css'].includes(req.url)) { res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8'); res.end(fs.readFileSync(path.join(output, req.url.slice(1)))); }
    else if (req.url === '/logo.png') { res.setHeader('Content-Type', 'image/png'); res.end(fs.readFileSync(path.join(root, 'public/logo.png'))); }
    else { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="app"></div><script src="/fixture.js"></script>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: process.env.THEME_BROWSER_CHANNEL || 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', colorScheme:'dark' });
    const errors = []; page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    await page.addInitScript(p => {
      window.fixtureOnline=true;Object.defineProperty(navigator,'onLine',{get:()=>window.fixtureOnline});
      window.TrinityOffline = { postMessage(raw) { const r = JSON.parse(raw); queueMicrotask(() => window.TrinityOffline.onmessage?.({ data: JSON.stringify({ id: r.id, success: true, ...(r.action === 'deviceColors' ? { palette: p } : {}) }) })); } };
    }, palette);
    const url = 'http://127.0.0.1:' + server.address().port;
    await page.goto(url); const screen = page.getByRole('dialog');
    await page.getByRole('heading',{name:'Make Trinity yours'}).waitFor();
    await page.waitForFunction(()=>document.documentElement.classList.contains('dark'));
    assert.equal(await screen.getByRole('button',{name:'Device',exact:true}).getAttribute('aria-pressed'),'true','Defaults to system appearance');
    await page.evaluate(()=>window.fixture.readyExcept('pupils'));
    await page.waitForFunction(()=>Number(document.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'))===window.fixture.percent());
    const percent=await screen.getByRole('progressbar').getAttribute('aria-valuenow');
    await page.waitForTimeout(1200);assert.equal(await screen.getByRole('progressbar').getAttribute('aria-valuenow'),percent);
    await screen.getByRole('button',{name:/Soft Indigo/}).click();await page.waitForFunction(()=>document.documentElement.dataset.appTheme==='soft-indigo');
    await screen.getByRole('button',{name:/Pixel Terracotta/}).click();await page.waitForFunction(()=>document.documentElement.dataset.appTheme==='pixel-terracotta');
    await screen.getByRole('button',{name:'Light',exact:true}).click();await page.waitForFunction(()=>!document.documentElement.classList.contains('dark'));
    await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Continue')?.disabled);
    await page.screenshot({path:path.join(output,'desktop-light.png')});
    await screen.getByRole('button',{name:'Dark',exact:true}).click();await page.waitForFunction(()=>document.documentElement.classList.contains('dark'));
    await screen.getByRole('button',{name:/^Material You/}).click();await page.waitForFunction(()=>document.documentElement.dataset.deviceColors==='true');
    await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Continue')?.disabled);
    for(const width of [390,320]){await page.setViewportSize({width,height:800});assert.ok(await screen.evaluate(e=>e.scrollWidth<=window.innerWidth),'No phone overflow');await page.screenshot({path:path.join(output,width+'-device-dark.png')});}
    await page.setViewportSize({width:1440,height:900});
    await page.evaluate(()=>window.fixture.report('pupils','ready'));await page.waitForTimeout(1400);
    assert.equal(await page.evaluate(()=>window.fixture.marker()),null,'Data completion cannot dismiss personalisation');
    assert.ok(await page.getByRole('heading',{name:'Make Trinity yours'}).isVisible());
    await screen.getByRole('button',{name:'Continue',exact:true}).click();
    await screen.getByLabel('Current password').fill('test-password-not-stored');
    await screen.getByRole('button',{name:'Enable on this device'}).click();
    await page.waitForFunction(()=>typeof window.cancelRegistration==='function');
    assert.ok(await screen.getByRole('button',{name:'Skip for now'}).isDisabled());
    assert.ok(await screen.getByRole('button',{name:/Use current settings/}).isDisabled());
    await page.evaluate(()=>window.cancelRegistration());
    await screen.getByText('Device unlock cancelled. You can try again or skip.').waitFor();
    assert.equal(await screen.getByLabel('Current password').inputValue(),'');
    assert.ok(!(await page.evaluate(()=>JSON.stringify({...localStorage}))).includes('test-password-not-stored'));
    await screen.getByLabel('Current password').fill('test-again');await screen.getByRole('button',{name:'Enable on this device'}).click();
    await page.evaluate(()=>window.finishRegistration());await screen.getByText('Device unlock is ready for your next sign-in.').waitFor();
    await page.screenshot({path:path.join(output,'device-unlock.png')});
    assert.equal(await screen.getByRole('button',{name:'Remove device unlock'}).count(),0);
    await screen.getByRole('button',{name:'Continue',exact:true}).click();await screen.getByRole('button',{name:'Turn on'}).click();
    await screen.getByRole('button',{name:/When I leave the app/}).click();await screen.getByLabel('Require device unlock after auto-lock').check();
    await page.screenshot({path:path.join(output,'privacy-dark.png')});
    assert.equal(await page.evaluate(()=>window.appliedPrivacy),undefined,'Draft choices cannot auto-lock an enrollment/retry');
    for(let i=0;i<20;i++){await page.keyboard.press('Tab');assert.ok(await screen.evaluate(e=>e.contains(document.activeElement)),'Focus is contained');}
    await page.reload();await page.getByRole('heading',{name:'Choose your privacy'}).waitFor();
    assert.equal(await screen.getByRole('button',{name:'Turn on'}).getAttribute('aria-pressed'),'true');
    assert.ok(await screen.getByLabel('Require device unlock after auto-lock').isChecked(),'Capability recheck preserves chosen requirement');
    await screen.getByRole('button',{name:'Continue',exact:true}).click();
    await page.screenshot({path:path.join(output,'review-dark.png')});
    assert.ok(await screen.getByRole('button',{name:'Waiting for data…'}).isDisabled());
    await page.evaluate(()=>{window.fixtureOnline=false;window.dispatchEvent(new Event('offline'));});
    assert.ok(await screen.getByRole('button',{name:'Retry setup'}).isDisabled());
    await page.evaluate(()=>{window.fixtureOnline=true;window.dispatchEvent(new Event('online'));window.fixture.report('pupils','error');});
    await screen.getByText('Some records need another download attempt.').waitFor();
    assert.ok(await screen.getByRole('button',{name:'Retry setup'}).isEnabled());
    await page.evaluate(()=>window.fixture.readyExcept());
    await screen.getByRole('button',{name:'Open my workspace'}).click();
    await page.evaluate(()=>window.fixture.report('pupils','error'));
    await screen.getByText('Some records need another download attempt.').waitFor();
    assert.ok(await screen.getByRole('button',{name:'Retry setup'}).isEnabled(),'A late download failure can recover even after Finish');
    assert.equal(await page.evaluate(()=>window.fixture.marker()),null);
    await page.evaluate(()=>window.fixture.report('pupils','ready'));
    await page.getByRole('heading',{name:'Workspace available'}).waitFor();
    assert.deepEqual(await page.evaluate(()=>window.appliedPrivacy),{enabled:true,action:'lock-on-leave',deviceUnlock:true});
    assert.equal(await page.evaluate(()=>window.appliedCount),1);assert.equal(await page.evaluate(()=>window.fixture.marker()),'complete');
    await page.reload();await page.getByRole('heading',{name:'Workspace available'}).waitFor();assert.equal(await screen.count(),0);
    await page.evaluate(()=>{window.passkeySupported=false;window.fixture.user({id:'other',role:'Parent',enabled:true});});
    await page.getByRole('heading',{name:'Make Trinity yours'}).waitFor();await screen.getByRole('button',{name:'Continue',exact:true}).click();
    await screen.getByText(/does not offer secure device unlock/).waitFor();await screen.getByRole('button',{name:'Skip for now'}).click();
    await screen.getByRole('button',{name:'Turn on'}).click();await screen.getByRole('button',{name:/Sign out when I close/}).click();
    assert.equal(await screen.getByLabel('Require device unlock after auto-lock').count(),0);
    await screen.getByRole('button',{name:/Use current settings/}).click();
    await screen.getByText('Off',{exact:true}).waitFor();await page.evaluate(()=>window.fixture.readyExcept());
    await screen.getByRole('button',{name:'Open my workspace'}).click();await page.getByRole('heading',{name:'Workspace available'}).waitFor();
    assert.deepEqual(await page.evaluate(()=>window.appliedPrivacy),{enabled:false,action:'lock-on-close',deviceUnlock:false},'Skip preserves existing privacy settings');
    assert.deepEqual(errors,[]);
    console.log('WORKSPACE_WELCOME_BROWSER_OK: live downloads, separate completion gate, preview/persistence, OS enrollment cancellation/success, password hygiene, staged privacy, retry resume, unsupported/skip, parent/account isolation, mobile Material You and focus.');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
