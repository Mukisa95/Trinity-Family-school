const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { build } = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

async function main() {
  const output = path.resolve('output/staff-clocking-validation');
  fs.mkdirSync(output, { recursive: true });
  const cssPath = path.join(output, 'timekeeper-browser.css');
  const css = spawnSync(process.execPath, [require.resolve('tailwindcss/lib/cli.js'), '-i', 'src/app/globals.css', '-o', cssPath, '--content', 'src/components/staff-clocking/staff-clocking-timekeepers.tsx,src/components/ui/*.tsx,src/components/users/granular-permissions-editor.tsx', '--minify'], { encoding: 'utf8' });
  if (css.status) throw new Error(css.stderr);
  const fixture = `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {StaffClockingTimekeepers} from './src/components/staff-clocking/staff-clocking-timekeepers';import {GranularPermissionsEditor} from './src/components/users/granular-permissions-editor';const client=new QueryClient({defaultOptions:{queries:{retry:false}}});window.__revision=n=>client.setQueryData(['timekeeper-revisions'],{staffClockingConfig:0,staffClockingTimekeepers:n,staff:0});function App(){const[editor,setEditor]=useState(false);const[permissions,setPermissions]=useState([{moduleId:'staff_clocking',pages:[{pageId:'record',canAccess:true,actions:[]}]}]);window.__permissions=permissions;return <main style={{maxWidth:950,margin:'auto',padding:16}}><button onClick={()=>setEditor(!editor)}>{editor?'Return to timekeepers':'Edit user permissions'}</button>{editor?<GranularPermissionsEditor modules={['staff_clocking']} permissions={permissions} onChange={setPermissions}/>:<StaffClockingTimekeepers/>}</main>}createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><App/></QueryClientProvider>);`;
  const legacyFixture = fixture.replace('actions:[]', 'actions:[{actionId:"manage_schedules",allowed:true}]');
  const result = await build({ stdin: { contents: legacyFixture, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"', 'process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID': '"timekeeper-test"' }, plugins: [{name:'timekeeper-fixtures',setup(builder){
    builder.onResolve({filter:/^(?:@\/lib\/firebase|@\/lib\/contexts\/auth-context|\.\/use-school-settings|\.\/use-staff-clocking-personal-revisions)$/},args=>({path:args.path,namespace:'fixture'}));
    builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({resolveDir:process.cwd(),contents:args.path.endsWith('auth-context')?'export const useAuth=()=>({isAuthenticated:true,user:{id:"manager",role:"Admin"}});':args.path.endsWith('firebase')?'export const auth={currentUser:{uid:"manager",getIdToken:async()=>"fixture"}};':args.path.endsWith('personal-revisions')?'export const useStaffClockingPersonalRevisions=()=>({data:{},error:null});':`import{useQuery}from'@tanstack/react-query';export const useDashboardDataRevisions=()=>useQuery({queryKey:['timekeeper-revisions'],enabled:false,initialData:{staffClockingConfig:0,staffClockingTimekeepers:0,staff:0}});`}));
  }}] });
  const server=http.createServer((req,res)=>{if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(result.outputFiles[0].contents);}else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(fs.readFileSync(cssPath));}else{res.setHeader('Content-Type','text/html');res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>:root{--background:0 0% 100%;--foreground:222 47% 11%;--card:0 0% 100%;--card-foreground:222 47% 11%;--primary:221 83% 53%;--primary-foreground:0 0% 100%;--border:214 32% 91%;--input:214 32% 91%;--muted:210 40% 96%;--muted-foreground:215 16% 47%;--ring:221 83% 53%}.dark{--background:222 47% 11%;--foreground:210 40% 98%;--card:222 47% 11%;--card-foreground:210 40% 98%;--border:217 33% 25%;--input:217 33% 25%;--muted:217 33% 17%;--muted-foreground:215 20% 70%}body{background:hsl(var(--background));color:hsl(var(--foreground))}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    let person={accountId:'ada-account',staffId:'staff-ada',name:'Ada Staff',username:'ada',allowed:false,revision:0};
    let revision=0;const changes=[];
    await page.route('**/api/staff-clocking/timekeepers',async route=>{if(route.request().method()==='PUT'){const input=route.request().postDataJSON();changes.push(input);if(input.revision!==person.revision){await route.fulfill({status:409,json:{success:false,error:'CLOCKING_ACCESS_CHANGED_REVIEW_AND_RETRY'}});return;}person={...person,allowed:input.allowed,revision:person.revision+1};await route.fulfill({json:{success:true,result:person}});await page.evaluate(n=>window.__revision(n),++revision);}else{await route.fulfill({json:{success:true,result:[person]}});}});
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const access=page.getByRole('switch',{name:'Record Station access for Ada Staff'});
    await access.waitFor();await access.focus();await page.keyboard.press('Space');
    await page.getByRole('status').filter({hasText:'access granted'}).waitFor();
    await page.waitForFunction(()=>document.querySelector('[role=switch]').getAttribute('aria-checked')==='true');
    assert.deepEqual(changes[0],{accountId:'ada-account',allowed:true,revision:0});
    await page.screenshot({path:path.join(output,'timekeepers-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.classList.add('dark'));
    await page.getByRole('textbox',{name:'Find staff'}).fill('nobody');await page.getByText('No matching staff accounts.').waitFor();
    await page.getByRole('textbox',{name:'Find staff'}).fill('ada');await access.click();
    await page.getByRole('status').filter({hasText:'access removed'}).waitFor();
    await page.waitForFunction(()=>document.querySelector('[role=switch]').getAttribute('aria-checked')==='false');
    person.revision++;await access.click();await page.getByRole('alert').filter({hasText:'Another manager changed'}).waitFor();
    assert.equal(await access.getAttribute('aria-checked'),'false');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    await page.screenshot({path:path.join(output,'timekeepers-mobile-dark.png'),fullPage:true});
    await page.getByRole('button',{name:'Edit user permissions',exact:true}).click();
    await page.getByRole('button',{name:/Academics/}).click();await page.getByRole('button',{name:/Staff Clocking/}).click();
    assert.equal(await page.getByRole('checkbox',{name:/Open Manage Clocking/}).getAttribute('aria-checked'),'true','Existing managers must see their actual effective Manage permission');
    await page.getByRole('checkbox',{name:/Open Manage Clocking/}).uncheck();
    assert.ok(await page.evaluate(()=>window.__permissions[0].pages[0].actions.some(item=>item.actionId==='access_manage'&&!item.allowed)));
    await page.getByRole('checkbox',{name:/Open Manage Clocking/}).check();
    await page.getByRole('checkbox',{name:/Manage timekeeper access/}).check();
    const permissions=await page.evaluate(()=>window.__permissions);
    assert.ok(permissions[0].pages[0].actions.some(item=>item.actionId==='access_manage'&&item.allowed));
    assert.ok(permissions[0].pages[0].actions.some(item=>item.actionId==='manage_timekeepers'&&item.allowed));
    assert.deepEqual(errors,[]);
    console.log('PASS timekeeper grant/revoke, keyboard control, cached directory update, search, conflict recovery, mobile/dark layout and user permission switches');
  } finally { await browser?.close();await new Promise(resolve=>server.close(resolve)); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
