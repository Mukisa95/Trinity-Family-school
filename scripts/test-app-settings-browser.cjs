/* Actual settings controls and shared header; account/server/OS replies are fixtures. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/compact-settings-qa');
const release = require(path.join(root, 'src/lib/android/app-release.json'));
const mocks = {
  '@/lib/hooks/use-users': `export const useUpdateUser=()=>({mutateAsync:async value=>window.fixtureActions.push(value)});`,
  '@/hooks/use-toast': `export const useToast=()=>({toast:()=>{}});`,
  '@/lib/firebase': `export const auth={currentUser:null};`,
  '@/lib/contexts/navigation-context': `export const useNavigation=()=>({goBack:()=>{}});`,
  '@/components/parent/parent-offline-readiness-card': `export const ParentOfflineReadinessCard=()=>null;`,
  'next/link': `import React from 'react';export default React.forwardRef(({children,...props},ref)=><a ref={ref} {...props}>{children}</a>);`,
  'next/navigation': `export const useRouter=()=>({push(){},replace(){},back(){}});export const usePathname=()=>location.pathname;`,
  '@/components/common/SmartBackButton': `import React from 'react';export const SmartBackButton=({children,...props})=><button {...props}>{children}</button>;`,
  '@/components/common/LogoutMessage': `export default ()=>null;`,
  '@/lib/contexts/auth-context': `import React,{createContext,useContext,useState} from 'react';const C=createContext();export const useAuth=()=>useContext(C);export function FixtureAuth({children}){const [enabled,setEnabled]=useState(false),[action,setAction]=useState(null),[unlock,setUnlock]=useState(false);const user={id:'fixture-user',username:'amina',firstName:'Amina',lastName:'Test',role:new URLSearchParams(location.search).get('role')||'Admin'};return <C.Provider value={{user,isLoading:false,refreshUser:async()=>{},autoLockEnabled:enabled,setAutoLockEnabled:setEnabled,autoLockAction:action,setAutoLockAction:setAction,deviceUnlockForAutoLock:unlock,setDeviceUnlockForAutoLock:setUnlock,lockAccount:()=>window.fixtureActions.push('lockAccount'),logout:async()=>{}}}>{children}</C.Provider>}`,
  '@/lib/services/passkey.service': `export const PASSKEYS_CHANGED_EVENT='trinity:passkeys-changed';const changed=()=>window.dispatchEvent(new Event(PASSKEYS_CHANGED_EVENT));export const PasskeyService={localSupported:async()=>true,hasLocalUnlock:()=>localStorage.getItem('enrolled')==='true',hasNativeUnlock:()=>localStorage.getItem('enrolled')==='true',supported:async()=>true,list:async()=>[],enableNativeUnlock:async(password)=>{if(password!=='fixture-password')throw Error('Incorrect password');localStorage.setItem('enrolled','true');changed()},disableNativeUnlock:()=>{localStorage.removeItem('enrolled');changed()},register:async()=>changed(),remove:async()=>{},isPreviouslyRegisteredError:()=>false};`,
  '@/lib/android/device-unlock': `export const hasNativeDeviceUnlock=()=>!!window.TrinityOffline;export const nativeDeviceUnlockAvailable=async()=>true;`,
  '@/lib/native-push-client': `export const connectNativePush=async()=>{window.fixturePush=true;window.dispatchEvent(new Event('trinity-android-notifications-change'))};export const disableNativePush=async()=>{window.fixturePush=false;window.dispatchEvent(new Event('trinity-android-notifications-change'))};export const testNativePush=async()=>window.fixtureActions.push('testNativePush');`,
  '@/lib/push-subscription-client': `export const supportsWebPush=()=>true;export const getConfirmedBrowserPushSubscription=async()=>localStorage.getItem('push')==='true';export const disablePushSubscription=async()=>localStorage.setItem('push','false');export const enablePushSubscription=async()=>{localStorage.setItem('push','true');return {active:true}};`,
  '@/lib/hooks/use-push-subscribe': `export const usePushSubscribe=()=>({isSupported:true,isSubscribed:false,permission:'granted',subscribe:async()=>true});`,
  '@/lib/hooks/use-android-offline-status': `export const useAndroidOfflineStatus=()=>false;`,
  '@/lib/pwa/use-workspace': `export const useHomeScreenWorkspace=()=>({workspace:{session:{expiresAt:Date.now()+86400000},sections:[{path:'/parent',label:'Dashboard',saved:true}]}});`,
  '@/lib/utils/app-diagnostics': `export const createAppDiagnosticReport=()=>JSON.stringify({fixture:true});`,
};

async function build() {
  fs.mkdirSync(output, { recursive: true });
  await esbuild.build({ absWorkingDir: root, stdin: { resolveDir: root, loader: 'tsx', contents: `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {ThemeProvider} from './src/components/providers/theme-provider';import {PerformanceProvider} from './src/components/providers/performance-provider';
import {FixtureAuth} from '@/lib/contexts/auth-context';import {SidebarProvider,useSidebar} from './src/components/ui/sidebar';
import {AppSettings} from './src/components/account/app-settings';import {SidebarUserFooter} from './src/components/layout/sidebar-user-footer';
import {SchoolAppDownloadLink} from './src/components/common/school-app-download';import {useSettingsSidebar} from './src/lib/hooks/use-settings-sidebar';
function CustomSidebar(){const [open,setOpen]=useState(true),[settings,setSettings]=useState(true);useSettingsSidebar(settings,open,setOpen);return <div data-parent-sidebar={open?'expanded':'collapsed'}><button onClick={()=>setSettings(value=>!value)}>Toggle parent settings</button></div>}
function Shell(){const sidebar=useSidebar();const [settings,setSettings]=useState(true);return <><aside data-school-sidebar data-state={sidebar.state} style={{width:sidebar.open?208:48}} className="hidden shrink-0 border-r border-border bg-card md:block"><div className="p-3 text-xs">TF</div></aside><main className="min-w-0 flex-1 bg-background p-3 text-foreground"><div className="mb-3 flex items-center justify-between gap-2"><SchoolAppDownloadLink data-testid="public-get-app">Get the school app</SchoolAppDownloadLink><button className="text-xs" onClick={()=>setSettings(value=>!value)}>Leave settings</button></div>{settings?<AppSettings/>:<p>Workspace</p>}<div className="mt-6 max-w-64"><SidebarUserFooter/></div><CustomSidebar/></main></>}
createRoot(document.getElementById('app')).render(<ThemeProvider><PerformanceProvider><FixtureAuth><SidebarProvider defaultOpen><Shell/></SidebarProvider></FixtureAuth></PerformanceProvider></ThemeProvider>);
` }, bundle: true, jsx: 'automatic', platform: 'browser', alias: { '@': path.join(root, 'src') }, outfile: path.join(output, 'fixture.js'), define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'fixture-services', setup(builder) {
    builder.onResolve({ filter: /.*/ }, args => Object.hasOwn(mocks, args.path) ? { path: args.path, namespace: 'fixture' } : undefined);
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'tsx', resolveDir: root }));
  } }] });
  const config = require('typescript').transpileModule(fs.readFileSync(path.join(root, 'tailwind.config.ts'), 'utf8'), { compilerOptions: { module: 1 } }).outputText;
  const mod = { exports: {} }; new Function('require', 'module', 'exports', config)(require, mod, mod.exports);
  const sourceFiles = ['src/components/account','src/components/settings','src/components/ui','src/components/common','src/components/pwa'];
  const css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace(/^@import[^;]+;/, '') + '\n' + fs.readFileSync(path.join(root, 'src/app/theme.css'), 'utf8');
  const built = await require('postcss')([require('tailwindcss')({ ...mod.exports.default, content: [...sourceFiles.map(dir => path.join(root,dir,'*.tsx').replaceAll('\\','/')), path.join(root,'src/components/layout/sidebar-user-footer.tsx').replaceAll('\\','/'), { raw: fs.readFileSync(__filename, 'utf8'), extension: 'tsx' }] })]).process(css, { from: path.join(root, 'src/app/globals.css') });
  fs.writeFileSync(path.join(output, 'fixture.css'), built.css);
}

async function run() {
  await build();
  const server = http.createServer((req,res) => {
    const url = req.url.split('?')[0];
    if (url === '/api/android/release') { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(release)); }
    else if (url === '/fixture.js' || url === '/fixture.css') { res.setHeader('Content-Type', url.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(fs.readFileSync(path.join(output,url.slice(1)))); }
    else res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="app"></div><script src="/fixture.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const browser = process.env.SETTINGS_BROWSER === 'webkit' ? await webkit.launch({headless:true}) : await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  async function pageFor({ native = false, old = false, width = 390, ios = false, standalone = false, role = 'Admin', hash = '' } = {}) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce', userAgent: ios ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' : native ? 'Mozilla/5.0 (Linux; Android 15; Pixel 7) Mobile Safari/537.36' : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0 Safari/537.36' });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(({native,old,standalone}) => {
      window.fixtureActions=[];window.fixturePush=false;window.addEventListener('trinity-pwa-prepare',()=>window.fixtureActions.push('prepareOffline'));
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedText=text}}});
      if(standalone){const original=window.matchMedia;window.matchMedia=query=>query==='(display-mode: standalone)'?{matches:true,addEventListener(){},removeEventListener(){}}:original.call(window,query);}
      if(!native)return;
      const bridge={postMessage(raw){const req=JSON.parse(raw);window.fixtureActions.push(req.action);let payload={};
        if(req.action==='status'&&window.failStorage)payload={success:false,error:'Unavailable'};
        if(req.action==='selectTimetable'){if(window.failToggle)payload={success:false,error:'Could not update this preference.'};else for(const key of ['notificationCard','events','eventReminders'])if(key in req)localStorage.setItem(key,String(req[key]));}
        if(req.action==='notificationStatus')payload={appName:'Installed Fixture School',appVersion:'1.2',appBuild:3,notificationPermission:'granted',pushEnabled:true,remotePush:window.fixturePush,pushAccountId:'fixture-user',...(old?{}:{notificationCard:localStorage.getItem('notificationCard')!=='false',liveEvents:localStorage.getItem('events')==='true',eventReminders:localStorage.getItem('eventReminders')==='true'})};
        setTimeout(()=>bridge.onmessage?.({data:JSON.stringify({id:req.id,success:true,...payload})}),5);
      }};window.TrinityOffline=bridge;
    },{native,old,standalone});
    await page.goto(url + '/settings/app?role=' + role + hash);
    await page.getByRole('heading',{name:'App Settings',exact:true}).waitFor();
    await page.getByRole('combobox',{name:'Appearance',exact:true}).waitFor({state:hash?'hidden':'visible'});
    return page;
  }
  const tab = (page,name) => page.getByRole('tab',{name,exact:true});
  const search = page => page.getByRole('textbox',{name:'Search settings',exact:true});
  async function noOverflow(page) {
    const fits=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
    if(!fits){console.log(await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,nodes:[...document.querySelectorAll('*')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>({tag:el.tagName,cls:el.className,right:el.getBoundingClientRect().right,text:el.textContent?.slice(0,60)})).slice(-12)})));await page.screenshot({path:path.join(output,`overflow-${page.viewportSize().width}.png`),fullPage:true});}
    assert.ok(fits,'page overflow');
  }
  try {
    const desktop = await pageFor({width:1440});
    assert.equal(await desktop.locator('[data-school-sidebar]').getAttribute('data-state'),'collapsed');
    assert.equal(await desktop.locator('[data-parent-sidebar]').getAttribute('data-parent-sidebar'),'collapsed');
    assert.equal(await desktop.getByText('All settings',{exact:true}).count(),0);
    for(const nativeTab of ['Live tracking','Lesson reminders','Widgets'])assert.equal(await tab(desktop,nativeTab).count(),0);
    assert.equal(await desktop.getByRole('tabpanel').count(),1);
    assert.equal(await desktop.getByRole('link',{name:'Customise look and feel'}).count(),0);
    assert.equal(await desktop.getByRole('combobox',{name:'Appearance',exact:true}).count(),1);
    await desktop.getByRole('combobox',{name:'Appearance',exact:true}).selectOption('dark');await desktop.waitForFunction(()=>document.documentElement.classList.contains('dark'));
    await desktop.getByRole('combobox',{name:'Colour theme',exact:true}).selectOption('soft-indigo');await desktop.waitForFunction(()=>document.documentElement.dataset.appTheme==='soft-indigo');
    await desktop.getByRole('combobox',{name:'Visual effects',exact:true}).selectOption('reduced');await desktop.waitForFunction(()=>localStorage.getItem('trinity-effects-preference')==='reduced');
    await desktop.getByRole('combobox',{name:'Background',exact:true}).selectOption('plain');await desktop.getByRole('slider',{name:'Night brightness'}).waitFor({state:'hidden'});
    await desktop.getByRole('combobox',{name:'Background',exact:true}).selectOption('illustration');await desktop.getByRole('slider',{name:'Night brightness'}).waitFor();
    await desktop.locator('[data-app-settings]').screenshot({path:path.join(output,'desktop-dark.png')});
    await tab(desktop,'Look and feel').focus();await desktop.keyboard.press('ArrowDown');assert.equal(await tab(desktop,'My account').getAttribute('aria-selected'),'true');
    await desktop.keyboard.press('End');assert.equal(await tab(desktop,'About app').getAttribute('aria-selected'),'true');await desktop.keyboard.press('Home');
    await desktop.getByRole('button',{name:'Leave settings',exact:true}).click();await desktop.waitForFunction(()=>document.querySelector('[data-school-sidebar]').dataset.state==='expanded');
    await desktop.getByRole('button',{name:'Toggle parent settings',exact:true}).click();await desktop.waitForFunction(()=>document.querySelector('[data-parent-sidebar]').dataset.parentSidebar==='expanded');
    await desktop.getByRole('button',{name:'Leave settings',exact:true}).click();await tab(desktop,'Look and feel').waitFor();
    await search(desktop).fill('fingerprint');await desktop.getByRole('button',{name:/Biometrics and device unlock/}).click();assert.equal(await tab(desktop,'Security').getAttribute('aria-selected'),'true');await desktop.getByLabel('Current password',{exact:true}).waitFor();
    await tab(desktop,'Push notifications').click();const webPush=desktop.getByRole('switch',{name:'School alerts',exact:true});await webPush.click();await desktop.waitForFunction(()=>localStorage.getItem('push')==='true');await webPush.click();await desktop.waitForFunction(()=>localStorage.getItem('push')==='false');
    const mobile = await pageFor({native:true,width:375});
    assert.equal(await mobile.getByTestId('public-get-app').count(),0);
    assert.equal(await mobile.locator('[data-school-sidebar]').getAttribute('data-state'),'expanded');
    await tab(mobile,'Live tracking').click();const live=mobile.getByRole('switch',{name:'Timetable notification',exact:true});await live.click();await mobile.waitForFunction(()=>localStorage.getItem('notificationCard')==='false');assert.equal(await live.getAttribute('aria-checked'),'false');
    await mobile.getByRole('switch',{name:'Calendar events in the card',exact:true}).click();await mobile.waitForFunction(()=>localStorage.getItem('events')==='true');assert.equal(await mobile.getByRole('switch',{name:'Event reminder alerts',exact:true}).getAttribute('aria-checked'),'false');
    await mobile.locator('[data-app-settings]').screenshot({path:path.join(output,'android-tracking-light.png')});
    assert.equal(await mobile.getByRole('button',{name:/Turn (off|on) timetable notification/}).count(),0);
    await mobile.evaluate(()=>window.failToggle=true);await live.click();await mobile.getByRole('alert').waitFor();assert.equal(await live.getAttribute('aria-checked'),'false');
    await mobile.reload();await tab(mobile,'Live tracking').waitFor();assert.equal(await live.getAttribute('aria-checked'),'false');
    await tab(mobile,'Security').click();await mobile.getByRole('switch',{name:'Auto lock',exact:true}).click();await mobile.getByRole('combobox',{name:'When to lock',exact:true}).selectOption('lock-on-leave');
    await mobile.getByText('Biometrics and passkeys',{exact:true}).click();await mobile.getByLabel('Current password',{exact:true}).fill('fixture-password');await mobile.getByRole('switch',{name:'Android privacy unlock',exact:true}).click();await mobile.waitForFunction(()=>localStorage.getItem('enrolled')==='true');await mobile.getByRole('switch',{name:'Require device unlock',exact:true}).click();assert.equal(await mobile.getByRole('switch',{name:'Require device unlock',exact:true}).getAttribute('aria-checked'),'true');
    await tab(mobile,'Lesson reminders').click();await mobile.getByRole('button',{name:'Manage lesson reminders',exact:true}).click();assert.ok((await mobile.evaluate(()=>window.fixtureActions)).includes('openLessonReminderSettings'));
    await tab(mobile,'Widgets').click();await mobile.getByRole('button',{name:'Manage home screen widgets',exact:true}).click();assert.ok((await mobile.evaluate(()=>window.fixtureActions)).includes('openWidgetSettings'));
    await tab(mobile,'Push notifications').click();const nativePush=mobile.getByRole('switch',{name:'School alerts',exact:true});await nativePush.click();await mobile.getByRole('button',{name:'Send test',exact:true}).waitFor();await nativePush.click();await mobile.getByRole('button',{name:'Send test',exact:true}).waitFor({state:'hidden'});
    const old=await pageFor({native:true,old:true});await tab(old,'Live tracking').click();const unknown=old.getByRole('checkbox',{name:'Timetable notification',exact:true});assert.equal(await unknown.isDisabled(),true);assert.equal(await unknown.getAttribute('aria-checked'),'mixed');assert.equal(await old.getByRole('button',{name:/Turn (off|on) timetable notification/}).count(),0);await old.getByRole('button',{name:'Configure timetable card',exact:true}).click();assert.ok((await old.evaluate(()=>window.fixtureActions)).includes('openTimetableSettings'));
    await tab(mobile,'Look and feel').click();
    for(const width of [320,375,390,768,1440]){
      await mobile.setViewportSize({width,height:900});await noOverflow(mobile);
      const visibleSearch=search(mobile);if(width<640)assert.equal(await visibleSearch.getAttribute('placeholder'),'');await visibleSearch.focus();await visibleSearch.fill('night mode');await noOverflow(mobile);await mobile.getByRole('button',{name:/Look and feel/}).click();assert.equal(await tab(mobile,'Look and feel').getAttribute('aria-selected'),'true');
      await mobile.getByRole('combobox',{name:'Appearance',exact:true}).selectOption('light');await mobile.waitForFunction(()=>!document.documentElement.classList.contains('dark'));await mobile.locator('[data-app-settings]').screenshot({path:path.join(output,`settings-${width}-light.png`)});
      await mobile.getByRole('combobox',{name:'Appearance',exact:true}).selectOption('dark');await mobile.waitForFunction(()=>document.documentElement.classList.contains('dark'));await mobile.locator('[data-app-settings]').screenshot({path:path.join(output,`settings-${width}-dark.png`)});
    }
    await mobile.setViewportSize({width:844,height:390});await noOverflow(mobile);
    await mobile.setViewportSize({width:375,height:844});await mobile.evaluate(()=>document.documentElement.style.fontSize='20px');await noOverflow(mobile);await mobile.evaluate(()=>document.documentElement.style.fontSize='');
    await search(mobile).fill('not-a-setting');await mobile.getByText('No settings found.',{exact:true}).waitFor();await mobile.getByRole('button',{name:'Clear search',exact:true}).click();
    await tab(mobile,'About app').click();await mobile.getByText('1.2 (build 3)',{exact:true}).waitFor();const aboutQR=mobile.locator('[data-app-download-qr]');assert.equal(await aboutQR.getAttribute('data-app-download-qr'),url+'/download');await mobile.getByRole('button',{name:'Copy link',exact:true}).click();assert.equal(await mobile.evaluate(()=>window.copiedText),url+'/download');await noOverflow(mobile);await mobile.evaluate(()=>window.scrollTo(0,0));await mobile.locator('[data-app-settings]').screenshot({path:path.join(output,'android-about.png')});
    // Internal settings controls must keep the document, auth and sidebar alive.
    for (const config of [{width:1440}, {native:true}, {ios:true,standalone:true}, {role:'Parent'}]) {
      const accountPage=await pageFor(config);let navigations=0;accountPage.on('request',request=>{if(request.isNavigationRequest()&&request.frame()===accountPage.mainFrame())navigations++});
      await accountPage.evaluate(()=>window.settingsDocumentToken='still-alive');
      await tab(accountPage,'My account').click();const settingsURL=accountPage.url();
      await accountPage.getByRole('button',{name:'View my profile',exact:true}).click();
      await accountPage.getByRole('heading',{name:'Basic information',exact:true}).waitFor();
      assert.equal(await tab(accountPage,'My account').getAttribute('aria-selected'),'true');
      await accountPage.locator('[data-app-settings]').screenshot({path:require('node:path').join(output,'profile-'+(config.role||config.native&&'android'||config.ios&&'ios'||'desktop')+'.png')});
      await accountPage.getByRole('button',{name:'Back to my account',exact:true}).click();
      await accountPage.getByRole('button',{name:'Open account settings',exact:true}).click();
      if(config.role==='Parent') {
        await accountPage.getByRole('button',{name:/Change Password/}).click();
        await accountPage.getByPlaceholder('Enter current password',{exact:true}).fill('test-password');
        assert.equal(await accountPage.getByRole('button',{name:'Update Password',exact:true}).count(),1);
      } else {
        await accountPage.getByRole('textbox',{name:'Username',exact:true}).waitFor();
        await accountPage.getByRole('textbox',{name:'Username',exact:true}).fill('changed-test-name');
        await accountPage.getByRole('button',{name:'Update Username',exact:true}).click();
        assert.ok((await accountPage.evaluate(()=>window.fixtureActions)).some(action=>action?.updates?.username==='changed-test-name'));
      }
      assert.equal(accountPage.url(),settingsURL);assert.equal(navigations,0);assert.equal(await accountPage.evaluate(()=>window.settingsDocumentToken),'still-alive');
      await tab(accountPage,'Storage').click();await accountPage.getByText('Site storage',{exact:true}).waitFor();
      assert.equal(await accountPage.getByRole('link',{name:'Manage offline access',exact:true}).count(),0);
      await accountPage.getByRole('button',{name:'Refresh',exact:true}).click();
      await accountPage.waitForFunction(()=>!document.querySelector('[data-app-settings]').textContent.includes('Checking…'));
      if(config.native||config.standalone) {
        await accountPage.getByRole('button',{name:'Prepare',exact:true}).click();
        assert.ok((await accountPage.evaluate(()=>window.fixtureActions)).includes('prepareOffline'));
      }
      if(config.native) {
        await accountPage.evaluate(()=>window.failStorage=true);
        await accountPage.getByRole('button',{name:'Refresh',exact:true}).click();await accountPage.getByRole('alert').getByText('Could not check saved access. Try again.',{exact:true}).waitFor();
        await accountPage.evaluate(()=>window.failStorage=false);
        await accountPage.getByRole('button',{name:'Refresh',exact:true}).click();await accountPage.getByRole('alert').waitFor({state:'hidden'});
      }
      await accountPage.evaluate(()=>Object.defineProperty(navigator,'storage',{configurable:true,value:{estimate(){throw new Error('Storage blocked')}}}));
      await accountPage.getByRole('button',{name:'Refresh',exact:true}).click();await accountPage.getByText('Managed by this device',{exact:true}).waitFor();
      await accountPage.locator('[data-app-settings]').screenshot({path:path.join(output,'storage-'+(config.role||config.native&&'android'||config.ios&&'ios'||'desktop')+'.png')});
      assert.equal(navigations,0);await accountPage.close();
    }
    const iphone=await pageFor({ios:true,standalone:true});await tab(iphone,'Storage').click();await iphone.getByRole('button',{name:'Prepare',exact:true}).waitFor();assert.equal(await iphone.getByRole('switch',{name:'School alerts',exact:true}).count(),0);assert.equal(await iphone.getByTestId('public-get-app').count(),0);
    const dialog=desktop.getByRole('dialog',{name:'Get the school app',exact:true});await desktop.getByTestId('public-get-app').click();await dialog.waitFor();assert.equal(await dialog.locator('[data-app-download-qr]').getAttribute('data-app-download-qr'),url+'/download');await desktop.keyboard.press('Escape');
    assert.deepEqual(errors,[]);
    console.log('APP_SETTINGS_BROWSER_OK: in-place profile/account controls without document navigation, populated storage on desktop/Android/iOS/parent, single section tabs, inline appearance, glass search, desktop/parent sidebar restoration, native/web toggles, old-app fallback, privacy controls, Android gating, sharing, 320/375/390/768/1440px light/dark, landscape and larger text.');
  } finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
}
run().catch(error=>{console.error(error);process.exitCode=1});
