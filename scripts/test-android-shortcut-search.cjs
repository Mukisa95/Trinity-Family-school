/* Render the real header with synthetic school data; verify launcher search in a browser. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/android-shortcut-search');
const mocks = {
  'next/navigation': `export const usePathname=()=>location.pathname;export const useRouter=()=>({push:href=>(window.routerRequests??=[]).push(href),replace:()=>{}});`,
  'next/image': `import React from 'react';export default ({fill,priority,...props})=><img {...props}/>;`,
  '@/lib/contexts/auth-context': `const user={id:'fixture',role:'Staff'};export const useAuth=()=>({user:window.parentFixture?{...user,role:'Parent'}:user});`,
  '@/lib/hooks/use-school-settings': `const data={generalInfo:{name:'Example School',motto:'Learn together'}};export const useSchoolSettings=()=>({data});`,
  '@/lib/hooks/use-pupils': `const data=[{id:'ada',firstName:'Ada',lastName:'Example',classId:'p4',status:'Active',gender:'Female'}];export const usePupils=()=>({data});`,
  '@/lib/hooks/use-classes': `const data=[{id:'p4',name:'Primary Four'}];export const useClasses=()=>({data});`,
  '@/components/ui/sidebar': `import React from 'react';export const SidebarContext=React.createContext(null);export const useSidebar=()=>({});export const SidebarTrigger=()=>null;`,
  '@/lib/hooks/use-academic-years': `export const useAcademicYears=()=>({data:[]});`,
  '@/lib/utils/term-status-utils': `export const getEffectiveTermForDataDisplay=()=>null;`,
  '@/lib/hooks/use-schoolpay-badge': `export const useSchoolPayBadge=()=>0;`,
  '@/lib/services/granular-permissions.service': `export const GranularPermissionService={canAccessPage:()=>true};`,
  '@/components/ui/theme-toggle': `export const HeaderThemeToggle=()=>null;`,
  './network-strength-indicator': `export const NetworkStrengthIndicator=()=>null;`,
};
async function run() {
  fs.mkdirSync(output, { recursive: true });
  await esbuild.build({absWorkingDir:root,stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Header from './src/components/layout/enhanced-header';import {AndroidShortcutNavigator} from './src/components/common/android-shortcut-navigator';createRoot(document.getElementById('app')).render(<React.StrictMode><AndroidShortcutNavigator/><Header onMenuClick={()=>{}} showMenuButton={true}/></React.StrictMode>);`,resolveDir:root,loader:'tsx'},bundle:true,jsx:'automatic',platform:'browser',alias:{'@':path.join(root,'src')},define:{'process.env.NODE_ENV':'"production"'},outfile:path.join(output,'fixture.js'),plugins:[{name:'synthetic-school',setup(build){build.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:undefined);build.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'tsx',resolveDir:root}));}}]});
  const config = {exports:{}};
  new Function('require','module','exports',ts.transpileModule(fs.readFileSync(path.join(root,'tailwind.config.ts'),'utf8'),{compilerOptions:{module:1}}).outputText)(require,config,config.exports);
  const css = ['globals.css','theme.css','brand-theme.css'].map(file=>fs.readFileSync(path.join(root,'src/app',file),'utf8')).join('\n').replace(/^@import[^;]+;/,'');
  const built = await require('postcss')([require('tailwindcss')({...config.exports.default,content:[path.join(root,'src/components/layout/enhanced-header.tsx')]})]).process(css,{from:path.join(root,'src/app/globals.css')});
  fs.writeFileSync(path.join(output,'fixture.css'),built.css);
  const server = http.createServer((request,response)=>{
    const file = request.url.split('?')[0];
    if (['/fixture.js','/fixture.css'].includes(file)) { response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/css');response.end(fs.readFileSync(path.join(output,file.slice(1)))); }
    else { response.setHeader('Content-Type','text/html');response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="app"></div><script src="/fixture.js"></script></body></html>'); }
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser = await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || 'msedge'});
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const width of [375,768,844,1280]) for (const dark of [false,true]) {
      const context = await browser.newContext({viewport:{width,height:width===844?390:850},colorScheme:dark?'dark':'light',reducedMotion:width===844?'reduce':'no-preference'});
      const page = await context.newPage(); const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.addInitScript(({dark,width})=>document.addEventListener('DOMContentLoaded',()=>{if(dark)document.documentElement.classList.add('dark');if(width===375&&dark)document.documentElement.style.fontSize='150%';}),{dark,width});
      await page.addInitScript(()=>{window.documentMarker='kept';window.shortcutMessages=[];window.TrinityOffline={postMessage(raw){const data=JSON.parse(raw);window.shortcutMessages.push({...data,editorFocused:document.activeElement?.getAttribute('data-trinity-search')==='true'});queueMicrotask(()=>window.TrinityOffline.onmessage?.({data:JSON.stringify({id:data.id,success:true})}));}};});
      await page.goto(origin+'/?keep=1&openSearch=1#dashboard');
      const search=page.getByRole('textbox',{name:'Search pupils',exact:true}).filter({visible:true});
      await search.waitFor();
      await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Search pupils');
      assert.equal(page.url(),origin+'/?keep=1#dashboard');
      await search.fill('Ada');
      await page.getByText('Example Ada',{exact:true}).first().waitFor();
      await page.waitForTimeout(2700);
      assert.equal(await search.inputValue(),'Ada');
      assert.equal(await search.evaluate(element=>document.activeElement===element),true);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await page.screenshot({path:path.join(output,`${width}-${dark?'dark':'light'}.png`),fullPage:true});
      await page.waitForFunction(()=>window.shortcutMessages.some(message=>message.action==='shortcutSearchEditorReady')).catch(async error=>{console.log(JSON.stringify({errors,messages:await page.evaluate(()=>window.shortcutMessages),crypto:await page.evaluate(()=>typeof crypto.randomUUID)}));throw error;});
      const before=await page.evaluate(()=>window.shortcutMessages.filter(message=>message.action==='shortcutSearchEditorReady').length);
      await search.evaluate(element=>element.blur());
      await page.evaluate(()=>window.dispatchEvent(new CustomEvent('trinity-android-shortcut',{detail:'search'})));
      await page.waitForFunction(before=>window.shortcutMessages.filter(message=>message.action==='shortcutSearchEditorReady').length>before,before);
      assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-trinity-search')),'true');
      assert.equal(await search.inputValue(),'Ada');assert.equal(await page.evaluate(()=>window.documentMarker),'kept');
      assert.equal(page.url(),origin+'/?keep=1#dashboard');
      if(width<768){
        await page.getByRole('button',{name:'Close search',exact:true}).click();
        const closed=await page.evaluate(()=>window.shortcutMessages.filter(message=>message.action==='shortcutSearchEditorReady').length);
        await page.evaluate(()=>window.dispatchEvent(new CustomEvent('trinity-android-shortcut',{detail:'search'})));
        await page.waitForFunction(count=>window.shortcutMessages.filter(message=>message.action==='shortcutSearchEditorReady').length>count,closed);
        assert.equal(await search.inputValue(),''); // Closing search deliberately clears its query.
      }
      assert.equal(await page.evaluate(()=>window.shortcutMessages.filter(message=>message.action==='shortcutSearchEditorReady').every(message=>message.editorFocused)),true);
      await page.evaluate(()=>{for(const id of ['timetable','events','pupils','exams','__proto__','https://outside.example'])window.dispatchEvent(new CustomEvent('trinity-android-shortcut',{detail:id}));});
      assert.deepEqual(await page.evaluate(()=>window.routerRequests),['/timetable','/events','/pupils','/exams']);
      assert.deepEqual(errors,[]);
      await context.close();
      console.log(`SHORTCUT_SEARCH_OK width=${width} mode=${dark?'dark':'light'}`);
    }
    const page=await browser.newPage({viewport:{width:375,height:850}});
    await page.goto(origin+'/');
    await page.getByRole('button',{name:'Open search',exact:true}).waitFor();
    assert.equal(await page.getByRole('textbox',{name:'Search pupils',exact:true}).filter({visible:true}).count(),0);
    await page.addInitScript(()=>{window.parentFixture=true;});
    await page.goto(origin+'/?openSearch=1');
    await page.waitForTimeout(250);
    assert.equal(await page.getByRole('textbox',{name:'Search pupils',exact:true}).count(),0);
    console.log('NORMAL_DASHBOARD_AND_PARENT_SEARCH_BOUNDARIES_OK');
  } finally { if(browser)await browser.close();await new Promise(resolve=>server.close(resolve)); }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
