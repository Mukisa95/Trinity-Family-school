// Real sidebar menu, shared page permission check, and signed-in profile page.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),esbuild=require('esbuild');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'output/profile-navigation-qa');
async function run(){
 fs.mkdirSync(output,{recursive:true});
 const mocks=new Map([
  ['next/link',`import React from 'react';export default React.forwardRef(({href,onClick,children,...props},ref)=><a ref={ref} href={href} {...props} onClick={event=>{onClick?.(event);if(!event.defaultPrevented){event.preventDefault();window.profileRouter.push(href);}}}>{children}</a>);`],
  ['next/navigation',`export const useRouter=()=>window.profileRouter;`],
  ['@/lib/contexts/auth-context',`export const useAuth=()=>({user:window.profileUser,logout:async()=>{}});`],
  ['@/components/ui/sidebar',`export const useSidebar=()=>window.sidebarState;`],
  ['@/components/ui/theme-toggle',`export const ThemeToggle=()=>null;export const ThemePreferenceMenu=()=>null;`],
  ['@/components/common/LogoutMessage',`export default ()=>null;`],
  ['@/components/common/glass-page-top-bar',`import React from 'react';export const GlassPageTopBar=({title})=><header><h1>{title}</h1></header>;`],
 ]);
 const contents=`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {SidebarUserFooter} from './src/components/layout/sidebar-user-footer';import ProfilePage from './src/app/profile/page';import {GranularPermissionService} from './src/lib/services/granular-permissions.service';import {getRoutePagePermission} from './src/types/permissions';
window.profileUser={id:'staff-1',username:'teacher.one',firstName:'Teacher',lastName:'One',role:'Staff',isActive:true,createdAt:'2026-01-01',granularPermissions:GranularPermissionService.getDefaultPermissions('Staff')};window.sidebarState={state:'expanded',isMobile:false,toggleSidebar:()=>{}};window.closeCount=0;
function Fixture(){const [route,setRoute]=useState('/dashboard');const [,refresh]=useState(0);const navigate=target=>{const permission=getRoutePagePermission(target);const allowed=target==='/login'||permission===undefined||GranularPermissionService.canAccessPage(window.profileUser,permission.moduleId,permission.pageId);const next=allowed?target:'/pupils';history.pushState({},'',next);setRoute(next);};window.profileRouter={push:navigate,replace:navigate};window.fixture={reset:(collapsed,mobile)=>{window.sidebarState={state:collapsed?'collapsed':'expanded',isMobile:mobile,toggleSidebar:()=>{}};navigate('/dashboard');refresh(v=>v+1);}};return <><aside><SidebarUserFooter onCloseSidebar={window.sidebarState.isMobile?()=>window.closeCount++:undefined}/></aside>{route==='/profile'?<ProfilePage/>:<h1>{route==='/pupils'?'Pupils list':'Dashboard'}</h1>}</>;}createRoot(document.getElementById('app')).render(<Fixture/>);`;
 await esbuild.build({absWorkingDir:root,stdin:{contents,resolveDir:root,loader:'tsx'},bundle:true,jsx:'automatic',platform:'browser',outfile:path.join(output,'fixture.js'),alias:{'@':path.join(root,'src')},define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'profile-boundaries',setup(build){build.onResolve({filter:/.*/},args=>mocks.has(args.path)?{path:args.path,namespace:'boundary'}:undefined);build.onLoad({filter:/.*/,namespace:'boundary'},args=>({contents:mocks.get(args.path),resolveDir:root,loader:'tsx'}));}}]});
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?fs.readFileSync(path.join(output,'fixture.js')):'<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><div id="app"></div><script src="/fixture.js"></script>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({channel:process.env.THEME_BROWSER_CHANNEL||'chrome',headless:true});
 try{
  const page=await browser.newPage({hasTouch:true});const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:'+server.address().port);
  for(const state of [{name:'expanded',width:1440,collapsed:false,mobile:false},{name:'collapsed',width:1440,collapsed:true,mobile:false},{name:'mobile',width:390,collapsed:false,mobile:true}]){
   await page.setViewportSize({width:state.width,height:900});await page.evaluate(s=>window.fixture.reset(s.collapsed,s.mobile),state);await page.getByRole('heading',{name:'Dashboard',exact:true}).waitFor();
   const trigger=page.locator('aside button[aria-haspopup="menu"]');if(state.mobile)await trigger.tap();else await trigger.click();
   const profile=page.getByRole('menuitem',{name:'My Profile',exact:true});await profile.waitFor();assert.equal(await profile.getAttribute('href'),'/profile');await profile.click();
   await page.getByRole('heading',{name:'My Profile',exact:true}).waitFor();assert.ok(page.url().endsWith('/profile'));assert.equal(await page.getByRole('heading',{name:'Pupils list',exact:true}).count(),0);
   assert.ok(await page.getByRole('heading',{name:'Teacher One',exact:true}).isVisible());await page.waitForTimeout(1200);assert.ok(page.url().endsWith('/profile'),'Profile must not redirect after route checks settle');
   if(state.mobile)assert.equal(await page.evaluate(()=>window.closeCount),1,'Profile click closes mobile sidebar');
  }
  assert.deepEqual(errors,[]);console.log('PROFILE_NAVIGATION_BROWSER_OK: staff with default pupil-only permissions open their own profile from expanded, collapsed and mobile sidebar menus without a redirect.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
