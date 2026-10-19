/* Real startup/access components, with delayed synthetic native access replies. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),output=path.join(root,'output/startup-handoff-qa');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const esbuild=require('esbuild');
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 esbuild.buildSync({absWorkingDir:root,stdin:{contents:`export {StartupBootstrap} from './src/components/common/premium-splash-loader';`,resolveDir:root,loader:'tsx'},bundle:true,platform:'node',format:'cjs',jsx:'automatic',packages:'external',alias:{'@':path.join(root,'src')},outfile:path.join(output,'bootstrap.cjs')});
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const bootstrap=renderToStaticMarkup(React.createElement(require(path.join(output,'bootstrap.cjs')).StartupBootstrap));
 await esbuild.build({absWorkingDir:root,stdin:{contents:`
import React,{useEffect,useState} from 'react';import{createRoot}from'react-dom/client';
import{AndroidOfflineBoundary}from'./src/components/common/android-offline-boundary';
import{StartupHandoff}from'./src/components/common/startup-handoff';
function Content(){useEffect(()=>{window.contentMounts++},[]);return <main id="workspace">Saved workspace</main>}
function Fixture(){const[revision,setRevision]=useState(0);window.changeAccount=id=>{window.fixtureUser={id,role:'Admin'};setRevision(x=>x+1)};return <><StartupHandoff pathname="/" authLoading={false} isAuthenticated={true}/><AndroidOfflineBoundary><Content/></AndroidOfflineBoundary><aside id="background"/></>}
createRoot(document.getElementById('app')).render(<Fixture/>);`,resolveDir:root,loader:'tsx'},bundle:true,platform:'browser',jsx:'automatic',alias:{'@':path.join(root,'src')},outfile:path.join(output,'fixture.js'),plugins:[{name:'auth-and-router',setup(build){build.onResolve({filter:/^@\/lib\/contexts\/auth-context$/},()=>({path:'auth',namespace:'fixture'}));build.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:path==='auth'?'export const useAuth=()=>({user:window.fixtureUser});':'export const usePathname=()=>"/";',loader:'js'}));}}]});
 const session={schema:1,accountId:'fixture',role:'Admin',expiresAt:new Date(Date.now()+3600000).toISOString(),grants:{dashboard:true,pupils:true,timetable:true,events:true}};
 const html=`<!doctype html><html><body style="margin:0">${bootstrap}<div id="app"></div><script>window.contentMounts=0;window.fixtureUser={id:'fixture',role:'Admin'};window.trinityAndroidConnected=false;window.pendingAccess=[];window.TrinityOffline={postMessage(raw){const request=JSON.parse(raw);if(request.action==='status')window.pendingAccess.push(request.id)}};window.releaseAccess=session=>{for(const id of window.pendingAccess.splice(0))window.TrinityOffline.onmessage?.({data:JSON.stringify({id,success:true,session})})};</script><script src="/fixture.js"></script></body></html>`;
 fs.writeFileSync(path.join(output,'fixture.html'),html);
 const server=http.createServer((req,res)=>{if(req.url==='/fixture.js'){res.setHeader('Content-Type','application/javascript');res.end(fs.readFileSync(path.join(output,'fixture.js')));}else if(req.url==='/trinity-logo-192.png'){res.setHeader('Content-Type','image/png');res.end(fs.readFileSync(path.join(root,'public/trinity-logo-192.png')));}else{res.setHeader('Content-Type','text/html');res.end(html);}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
 try{
  for(const reducedMotion of ['no-preference','reduce']){
   const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion});
   const page=await context.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
   await page.waitForFunction(()=>window.pendingAccess.length>0);
   await page.waitForTimeout(600);
   assert.equal(await page.locator('#workspace').count(),0,'Protected content must wait for saved access');
   assert.equal(await page.evaluate(()=>window.contentMounts),0);
   assert.equal(await page.locator('#trinity-startup-screen').isVisible(),true,'The original loading surface stays visible');
   assert.equal(await page.getByText('Checking saved access…',{exact:true}).count(),0);
   assert.equal(await page.locator('.startup-screen').first().evaluate(x=>getComputedStyle(x).backgroundColor),'rgb(17, 24, 39)');
   if(reducedMotion==='reduce')assert.equal(await page.locator('.startup-screen').first().evaluate(x=>getComputedStyle(x).transitionDuration),'0s');
   await page.evaluate(()=>{window.backgroundUpdates=setInterval(()=>{const node=document.createElement('i');document.getElementById('background').replaceChildren(node)},5)});
   const started=Date.now();await page.evaluate(session=>window.releaseAccess(session),session);
   await page.waitForFunction(()=>document.getElementById('trinity-startup-screen').hidden,undefined,{timeout:900});
   assert.ok(Date.now()-started<900,'No fixed one-second wait or background-data wait');
   assert.equal(await page.locator('#workspace').isVisible(),true);
   assert.equal(await page.evaluate(()=>window.contentMounts),1);
   await page.evaluate(()=>{clearInterval(window.backgroundUpdates);window.changeAccount('other-account')});
   await page.waitForFunction(()=>window.pendingAccess.length>0);
   assert.equal(await page.locator('#workspace').count(),0,'An account switch cannot expose the previous workspace');
   await page.evaluate(()=>window.releaseAccess(null));
   await page.getByText('Connect to renew your secure session.',{exact:true}).waitFor();
   assert.equal(await page.locator('#workspace').count(),0);
   await context.close();
  }
  console.log('STARTUP_HANDOFF_PASS: no saved-access banner, continuous branded loading, protected content held until verified, no artificial/data wait, reduced motion, account isolation and denied access.');
 }finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1});
