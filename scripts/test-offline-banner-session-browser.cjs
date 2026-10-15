// Local fixtures exercise the real banner hook and AuthProvider. No accounts or
// school records are read/written; only Firebase/storage service boundaries vary.
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const esbuild = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const mocks = new Map([
  ['@/lib/firebase', 'export const auth=window.fixtureFirebaseAuth,db={};'],
  ['firebase/auth', `export const onIdTokenChanged=(auth,next)=>{window.fixtureIdentityListener=next;let live=true;auth.authStateReady().then(()=>{if(live)next(auth.currentUser)});return()=>{live=false}};export const signOut=async auth=>{window.fixtureSignOuts++;auth.currentUser=null;await window.fixtureIdentityListener(null)};`],
  ['firebase/firestore', 'export const doc=()=>({}),onSnapshot=()=>()=>{};'],
  ['@/lib/services/users.service', 'export class UsersService {}'],
  ['@/lib/services/secure-auth.service', 'export class SecureAuthError extends Error {} export class SecureAuthService {}'],
  ['@/lib/services/granular-permissions.service', 'export class GranularPermissionService {}'],
  ['@/lib/push-subscription-client', 'export const detachPushSubscriptionForLogout=async()=>{};'],
  ['@/lib/parent-offline/repository', 'export const removeParentOfflineAccount=async()=>{};'],
  ['@/lib/offline/android-bridge', 'export const clearAndroidOfflineAccess=async()=>{window.fixturePrivateClears++};'],
  ['@/lib/cache/persistent-collection-cache', 'export const deletePersistentCollection=async()=>{},persistentCollectionCacheKey=(...x)=>x.join(":");'],
  ['@/lib/services/pupils.service', 'export const PupilsService={clearSharedPupils:()=>{window.fixturePrivateClears++}};'],
  ['@/lib/services/passkey.service', 'export class PasskeyService {}'],
]);
const plugin = { name: 'fixture-service-boundaries', setup(builder) {
  builder.onResolve({ filter: /.*/ }, args => mocks.has(args.path) ? { path: args.path, namespace: 'fixture' } : undefined);
  builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks.get(args.path), loader: 'js' }));
} };
async function bundle(contents) {
  return (await esbuild.build({ stdin: { contents, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false,
    jsx: 'automatic', format: 'iife', platform: 'browser', plugins: [plugin], alias: { '@': path.join(process.cwd(), 'src') },
    define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_LOG_LEVEL': '"error"',
      'process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID': '"trinity-family-schools"' } })).outputFiles[0].text;
}
(async () => {
  const banner = await bundle(`import React from 'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{WorkspacePreparationStatus}from'./src/components/common/workspace-preparation-status';import{readWorkspaceSetup,reportWorkspaceTask,registerWorkspaceRecovery}from'./src/lib/startup/workspace-setup';
    const client=new QueryClient({defaultOptions:{queries:{retry:false}}}),scope='fixture';window.fixtureRetries=0;client.setQueryData(['schoolSettings','settings'],{});reportWorkspaceTask(client,scope,'classes','error');
    registerWorkspaceRecovery(client,scope,'classes',()=>{window.fixtureRetries++;reportWorkspaceTask(client,scope,'classes','ready')});
    window.fixture={state:()=>readWorkspaceSetup(client,scope,'Admin'),fail:()=>reportWorkspaceTask(client,scope,'classes','error'),finish:()=>readWorkspaceSetup(client,scope,'Admin').tasks.forEach(t=>reportWorkspaceTask(client,scope,t.id,'ready'))};
    createRoot(document.getElementById('app')).render(<QueryClientProvider client={client}><main><h1>Saved workspace</h1><p>Saved fixture records remain visible</p><WorkspacePreparationStatus scope={scope} role="Admin"/></main></QueryClientProvider>);`);
  const auth = await bundle(`import React from'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{AuthProvider,useAuth}from'./src/lib/contexts/auth-context';
    const client=new QueryClient({defaultOptions:{queries:{retry:false}}});function Probe(){const session=useAuth();window.fixtureSession=()=>({user:session.user?.id,status:session.sessionStatus,loading:session.isLoading});window.fixtureResume=session.resumeSession;return <main><h1>Session fixture</h1><p>{session.user?.id||'signed-out'}</p><p>{session.sessionStatus}</p></main>}
    createRoot(document.getElementById('app')).render(<QueryClientProvider client={client}><AuthProvider><Probe/></AuthProvider></QueryClientProvider>);`);
  const server = http.createServer((req, res) => {
    if (req.url.endsWith('.js')) { res.setHeader('Content-Type', 'text/javascript'); res.end(req.url === '/auth.js' ? auth : banner); return; }
    res.setHeader('Content-Type', 'text/html'); res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="app"></div><script src="${req.url === '/auth' ? '/auth.js' : '/banner.js'}"></script>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 760 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') console.error('Fixture console:', message.text()); });
    await page.clock.install();
    await page.addInitScript(() => {
      window.fixtureOnline=false;window.trinityAndroidConnected=false;
      Object.defineProperty(navigator,'onLine',{get:()=>window.fixtureOnline});
      window.fixtureSignOuts=0;window.fixturePrivateClears=0;
      let restore;const ready=new Promise(resolve=>{restore=resolve});
      window.fixtureFirebaseAuth={currentUser:null,authStateReady:()=>ready};
      window.fixtureRestore=()=>{window.fixtureFirebaseAuth.currentUser={uid:'fixture-user',isAnonymous:false,getIdTokenResult:async()=>({claims:{appUser:true,isActive:true,role:'Admin'}})};restore()};
      localStorage.setItem('trinity_user',JSON.stringify({user:{id:'fixture-user',username:'Fixture',role:'Admin',isActive:true},cachedAt:Date.now()}));
    });
    const origin=`http://127.0.0.1:${server.address().port}`;
    await page.goto(origin+'/banner');await page.waitForFunction(()=>window.fixture);
    const downloads=page.getByText(/Background downloads:/);
    assert.equal(await downloads.count(),0);
    await page.clock.fastForward(6000);assert.equal(await page.evaluate(()=>window.fixtureRetries),0);
    await page.evaluate(()=>{window.fixtureOnline=true;window.dispatchEvent(new Event('online'))});
    assert.equal(await downloads.count(),0); // Native connection still absent.
    await page.evaluate(()=>{window.trinityAndroidConnected=true;window.dispatchEvent(new Event('trinity-android-connectivity'))});
    await downloads.waitFor();await page.waitForFunction(()=>window.fixtureRetries===1);
    const saved=await page.evaluate(()=>JSON.stringify(window.fixture.state().tasks));
    await page.evaluate(()=>{window.trinityAndroidConnected=false;window.dispatchEvent(new Event('trinity-android-connectivity'))});
    await downloads.waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>JSON.stringify(window.fixture.state().tasks)),saved);
    await page.evaluate(()=>window.fixture.fail());await page.clock.fastForward(6000);
    assert.equal(await page.evaluate(()=>window.fixtureRetries),1);
    assert.ok(await page.getByText('Saved fixture records remain visible').isVisible());
    await page.evaluate(()=>{window.trinityAndroidConnected=true;window.dispatchEvent(new Event('trinity-android-connectivity'))});
    await downloads.waitFor();await page.waitForFunction(()=>window.fixtureRetries===2);
    await page.evaluate(()=>window.fixture.finish());await page.clock.fastForward(150);await downloads.waitFor({state:'hidden'});

    await page.goto(origin+'/auth');
    await page.waitForFunction(()=>window.fixtureSession?.().user==='fixture-user').catch(async error => {
      console.error('Auth fixture state:', await page.evaluate(()=>({session:window.fixtureSession?.(),body:document.body.textContent,cache:localStorage.getItem('trinity_user')})),errors);
      throw error;
    });
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.clock.fastForward(3000);
    assert.equal(await page.evaluate(()=>window.fixtureSession().status),'checking');
    assert.equal(await page.evaluate(()=>window.fixtureSignOuts),0);
    assert.equal(await page.evaluate(()=>window.fixturePrivateClears),0);
    await page.evaluate(()=>window.fixtureResume());
    await page.evaluate(()=>window.fixtureRestore());await page.waitForFunction(()=>window.fixtureSession().status==='fresh');
    assert.equal(await page.evaluate(()=>window.fixtureSession().user),'fixture-user');
    assert.equal(await page.evaluate(()=>window.fixtureSignOuts),0);
    assert.equal(await page.evaluate(()=>window.fixturePrivateClears),0);
    // Confirm revocation protection still runs once restoration has completed.
    await page.evaluate(()=>{window.fixtureFirebaseAuth.currentUser.getIdTokenResult=async()=>{throw{code:'auth/user-disabled'}}});
    await page.clock.fastForward(16*60*1000);await page.waitForFunction(()=>window.fixtureSignOuts===1);
    await page.clock.fastForward(2000);
    assert.equal(await page.evaluate(()=>window.fixtureSession().user),undefined);
    assert.ok(await page.evaluate(()=>localStorage.getItem('trinity_reliability_v1').includes('auth_validation_reason/auth/user-disabled')));
    assert.deepEqual(errors,[]);
    console.log('OFFLINE_BANNER_SESSION_BROWSER_OK: both connection signals, no offline retries, retained saved tasks, reconnect/complete visibility, cold-start focus/resume, and confirmed revocation.');
    await page.close();
  } finally { if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1});
