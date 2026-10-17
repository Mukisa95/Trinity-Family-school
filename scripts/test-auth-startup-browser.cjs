// Exercise the real AuthProvider with delayed identity, token and staff-scope
// boundaries. Synthetic profiles only; no school accounts or records are used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const esbuild = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const mocks = new Map([
  ['@/lib/firebase', 'export const auth=window.fixtureAuth,db={};'],
  ['firebase/auth', `export const onIdTokenChanged=(auth,next)=>{let live=true;window.fixtureIdentityListener=next;auth.authStateReady().then(()=>{if(live)next(auth.currentUser)});return()=>{live=false}};export const signOut=async auth=>{window.fixtureSignOuts++;auth.currentUser=null;await window.fixtureIdentityListener(null)};`],
  ['@/lib/access/scoped-firestore', `export const doc=()=>({}),onSnapshot=(_ref,_options,next)=>{let live=true;const emit=()=>{if(live)next({id:'fixture-user',exists:()=>true,data:()=>window.fixtureServerProfile(),metadata:{fromCache:false}})};window.fixtureProfileListeners.add(emit);setTimeout(emit,0);return()=>{live=false;window.fixtureProfileListeners.delete(emit)}};`],
  ['@/lib/services/users.service', 'export class UsersService {}'],
  ['@/lib/services/secure-auth.service', 'export class SecureAuthError extends Error {} export class SecureAuthService {}'],
  ['@/lib/services/granular-permissions.service', 'export class GranularPermissionService {}'],
  ['@/lib/services/pupils.service', 'export const PupilsService={clearSharedPupils:()=>{}};'],
  ['@/lib/services/classes.service', 'export const ClassesService={clearSharedClasses:()=>{}};'],
  ['@/lib/services/exams.service', 'export const ExamsService={clearSharedExams:()=>{}};'],
  ['@/lib/push-subscription-client', 'export const detachPushSubscriptionForLogout=async()=>{};'],
  ['@/lib/parent-offline/repository', 'export const removeParentOfflineAccount=async()=>{};'],
  ['@/lib/offline/android-bridge', 'export const clearAndroidOfflineAccess=async()=>{};'],
  ['@/lib/cache/persistent-collection-cache', 'export const deletePersistentCollection=async()=>{},persistentCollectionCacheKey=(...x)=>x.join(":");'],
  ['@/lib/services/passkey.service', 'export class PasskeyService {}'],
]);

async function run() {
  const bundle = await esbuild.build({
    stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
      import React,{useEffect} from 'react';
      import {createRoot} from 'react-dom/client';
      import {QueryClient,QueryClientProvider,useQuery} from '@tanstack/react-query';
      import {AuthProvider,useAuth} from './src/lib/contexts/auth-context';
      function Dashboard(){
        useEffect(()=>{window.fixtureDashboardMounts++},[]);
        const records=useQuery({queryKey:['dashboard-fixture'],queryFn:async()=>{window.fixtureDashboardReads++;return ['synthetic-pupil']},staleTime:Infinity});
        return <main data-surface="workspace" data-records={records.data?.length||0}/>;
      }
      function Probe(){
        const auth=useAuth();
        const state={loading:auth.isLoading,authenticated:auth.isAuthenticated,user:auth.user?.id||null,
          role:auth.user?.role||null,status:auth.sessionStatus,scope:auth.user?.circumference||null,
          family:auth.user?.familyId||null,pupil:auth.user?.pupilId||null,
          signed:auth.isSignedIdentityReady};
        window.fixtureSession=state;
        useEffect(()=>{window.fixtureStates.push(state)},[auth.isLoading,auth.user,auth.sessionStatus]);
        return auth.isLoading?<main data-surface="startup"/>:auth.user?<Dashboard/>:<main data-surface="sign-in"/>;
      }
      const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
      window.fixtureCacheClears=0;const clear=client.clear.bind(client);client.clear=()=>{window.fixtureCacheClears++;clear()};
      createRoot(document.getElementById('app')).render(<React.StrictMode><QueryClientProvider client={client}>
        <AuthProvider><Probe/></AuthProvider></QueryClientProvider></React.StrictMode>);
    ` },
    bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    alias: { '@': path.join(process.cwd(), 'src') },
    plugins: [{ name: 'auth-service-fixtures', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => mocks.has(args.path) ? { path: args.path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks.get(args.path), loader: 'js' }));
    } }],
    define: { 'process.env.NODE_ENV': '"development"', 'process.env.NEXT_PUBLIC_LOG_LEVEL': '"silent"',
      'process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID': '"demo-auth-startup"' },
  });
  const server = http.createServer((req, res) => {
    if (req.url === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle.outputFiles[0].text); }
    else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><div id="app"></div><script src="/fixture.js"></script>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  const reports = [];
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
    for (const scenario of [
      { name: 'slow-admin', role: 'Admin' },
      { name: 'slow-parent', role: 'Parent' },
      { name: 'slow-staff-scope', role: 'Staff' },
      { name: 'staff-empty-legacy-links', role: 'Staff', emptyLinks: true },
      { name: 'staff-permission-map-order', role: 'Staff', reorder: true },
      { name: 'staff-access-change', role: 'Staff', accessChange: true },
      { name: 'staff-disabled-live', role: 'Staff', disableLive: true },
      { name: 'staff-signout-during-verification', role: 'Staff', signoutDuring: true },
      { name: 'parent-family-detached', role: 'Parent', detachFamily: true },
      { name: 'legacy-cache', role: 'Admin', legacy: true },
      { name: 'missing-identity', role: 'Admin', missing: true },
      { name: 'anonymous-identity', role: 'Admin', anonymous: true },
      { name: 'disabled-account', role: 'Admin', disabled: true },
      { name: 'transient-token-failure', role: 'Admin', transient: true },
      { name: 'no-saved-session', role: 'Admin', noCache: true, missing: true },
    ]) {
      const page = await browser.newPage({ viewport: { width: scenario.role === 'Parent' ? 390 : 1440, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      // The fixture must never call a real Firebase or application endpoint.
      await page.route(/https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
      await page.clock.install();
      await page.addInitScript(options => {
        localStorage.clear();
        window.fixtureStates = []; window.fixtureSignOuts = 0; window.fixtureScopeRequests = 0;
        window.fixtureTokenRefreshes = 0; window.fixtureProfileListeners = new Set();
        window.fixtureDashboardReads = 0; window.fixtureDashboardMounts = 0;
        const profile = { id: 'fixture-user', username: 'Fixture', role: options.role, isActive: true,
          ...(options.emptyLinks?{familyId:'',pupilId:''}:{}),
          ...(options.role==='Parent'?{familyId:'family-one',pupilId:'child-one'}:{}),
          granularPermissions:[{moduleId:'reports',pages:[{pageId:'dashboard',canAccess:true,actions:[]}]}],
          modulePermissions:[{module:'reports',permission:'full_access'}],
          ...(options.role==='Staff'?{circumference:{classIds:['P4'],sections:null,genders:null}}:{}),
        };
        const reverseKeys=value=>Array.isArray(value)?value.map(reverseKeys):value&&typeof value==='object'
          ?Object.fromEntries(Object.entries(value).reverse().map(([key,item])=>[key,reverseKeys(item)])):value;
        window.fixtureServerProfile = () => options.reorder ? reverseKeys(profile) : profile;
        window.fixtureChangeAccess = () => { profile.circumference={classIds:['P5'],sections:null,genders:null};window.fixtureProfileListeners.forEach(emit=>emit()) };
        window.fixtureDisableAccount = () => { profile.isActive=false;window.fixtureProfileListeners.forEach(emit=>emit()) };
        window.fixtureDetachFamily = () => { delete profile.familyId;delete profile.pupilId;window.fixtureProfileListeners.forEach(emit=>emit()) };
        if (!options.noCache) localStorage.setItem('trinity_user', JSON.stringify(options.legacy ? profile : { user: profile, cachedAt: Date.now() }));
        let identityReady, tokenReady, scopeReady;
        const identity = new Promise(resolve => { identityReady = resolve; });
        const token = new Promise(resolve => { tokenReady = resolve; });
        const scope = new Promise(resolve => { scopeReady = resolve; });
        window.fixtureAuth = { currentUser: null, authStateReady: () => identity };
        window.fixtureRestoreIdentity = () => {
          window.fixtureAuth.currentUser = options.missing ? null : {
            uid: 'fixture-user', isAnonymous: !!options.anonymous, getIdToken: async force => {
              if(force){window.fixtureTokenRefreshes++;if(window.fixtureTokenRefreshes<=6)setTimeout(async()=>{
                await window.fixtureIdentityListener(window.fixtureAuth.currentUser);
                window.fixtureProfileListeners.forEach(emit=>emit());
              },30)}
              return 'fixture-token';
            },
            getIdTokenResult: async () => {
              await token;
              if (options.transient) throw { code: 'auth/network-request-failed' };
              return { claims: { appUser: true, isActive: !options.disabled, role: options.role } };
            },
          };
          identityReady();
        };
        window.fixtureVerifyToken = () => tokenReady();
        window.fixtureVerifyScope = () => scopeReady();
        window.fetch = async url => {
          if (url !== '/api/auth/session') throw new Error('Unexpected fixture request: ' + url);
          window.fixtureScopeRequests++;
          await scope;
          return { ok: true, json: async () => ({ user: profile }) };
        };
      }, scenario);
      try {
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.waitForFunction(() => window.fixtureIdentityListener && window.fixtureSession);
        const assertPending = async stage => {
          const state = await page.evaluate(() => window.fixtureSession);
          assert.equal(state.loading, true, scenario.name + ': keep loading during ' + stage);
          assert.equal(state.user, null, 'Do not expose the cached profile before verification');
          assert.equal(await page.locator('main').getAttribute('data-surface'), 'startup');
          assert.equal(await page.evaluate(() => window.fixtureStates.some(state => !state.loading && !state.authenticated)), false,
            'Returning users must not look signed out while restoration is pending');
        };
        await page.clock.fastForward(5000);
        await assertPending('identity restoration');
        await page.evaluate(() => window.fixtureRestoreIdentity());
        if (!scenario.missing && !scenario.anonymous) {
          await page.clock.fastForward(5000);
          await assertPending('token verification');
          await page.evaluate(() => window.fixtureVerifyToken());
          if (scenario.role === 'Staff') {
            await page.waitForFunction(() => window.fixtureScopeRequests === 1);
            await page.clock.fastForward(5000);
            await assertPending('current staff scope verification');
            if (scenario.signoutDuring) await page.evaluate(async()=>{window.fixtureAuth.currentUser=null;await window.fixtureIdentityListener(null)});
            await page.evaluate(() => window.fixtureVerifyScope());
          }
        }
        await page.waitForFunction(() => window.fixtureSession.loading === false);
        const state = await page.evaluate(() => window.fixtureSession);
        const signedOut = !!(scenario.missing || scenario.anonymous || scenario.disabled || scenario.signoutDuring);
        assert.equal(state.authenticated, !signedOut);
        assert.equal(state.user, signedOut ? null : 'fixture-user');
        assert.equal(await page.locator('main').getAttribute('data-surface'), signedOut ? 'sign-in' : 'workspace');
        if (!signedOut) {
          assert.equal(await page.evaluate(() => window.fixtureStates.some(state => !state.loading && !state.authenticated)), false);
          assert.equal(state.status, scenario.transient ? 'degraded' : 'fresh');
          assert.equal(await page.evaluate(() => window.fixtureSignOuts), 0);
          if (scenario.role === 'Staff') assert.deepEqual(state.scope.classIds, ['P4']);
          if (scenario.role === 'Staff' || scenario.detachFamily) {
            await page.clock.runFor(1000);
            assert.equal(await page.evaluate(()=>window.fixtureTokenRefreshes),0,
              'Equivalent server profile snapshots must not create a token-refresh loop');
            await page.waitForFunction(()=>window.fixtureDashboardReads===1);
            assert.equal(await page.evaluate(()=>window.fixtureDashboardReads),1,
              'Equivalent profile snapshots must not clear and refetch dashboard data');
            const stable = await page.evaluate(()=>({clears:window.fixtureCacheClears,mounts:window.fixtureDashboardMounts}));
            await page.evaluate(async()=>{
              for(let repeat=0;repeat<5;repeat++){
                await window.fixtureIdentityListener(window.fixtureAuth.currentUser);
                window.fixtureProfileListeners.forEach(emit=>emit());
              }
            });
            await page.clock.runFor(1000);
            assert.equal(await page.evaluate(()=>window.fixtureDashboardReads),1,'Token renewals preserve loaded dashboard records');
            assert.equal(await page.evaluate(()=>window.fixtureCacheClears),stable.clears,'No cache reset for equivalent identity/profile');
            assert.equal(await page.evaluate(()=>window.fixtureDashboardMounts),stable.mounts,'The dashboard remains mounted');
            if (scenario.accessChange) {
              await page.evaluate(()=>window.fixtureChangeAccess());
              await page.clock.runFor(1000);
              await page.waitForFunction(()=>window.fixtureSession.scope.classIds[0]==='P5'&&window.fixtureSession.status==='fresh');
              assert.equal(await page.evaluate(()=>window.fixtureTokenRefreshes),1,'A genuine scope change refreshes the token once');
              assert.equal(await page.evaluate(()=>window.fixtureCacheClears),stable.clears+1,'A genuine scope change clears old private data once');
              await page.waitForFunction(()=>window.fixtureDashboardReads===2);
            }
            if (scenario.disableLive) {
              await page.evaluate(()=>window.fixtureDisableAccount());
              await page.waitForFunction(()=>!window.fixtureSession.authenticated);
              assert.equal(await page.evaluate(()=>window.fixtureSignOuts),1,'Disabled accounts still lose access immediately');
            }
            if (scenario.detachFamily) {
              await page.evaluate(()=>window.fixtureDetachFamily());
              await page.clock.runFor(1000);
              assert.equal(await page.evaluate(()=>window.fixtureSession.family),null,'Removed Firestore links clear the old family');
              assert.equal(await page.evaluate(()=>window.fixtureSession.pupil),null,'Removed Firestore links clear the old pupil');
              assert.equal(await page.evaluate(()=>window.fixtureCacheClears),stable.clears+1,'Family detachment clears private data once');
              assert.equal(await page.evaluate(()=>window.fixtureTokenRefreshes),1,'Family detachment refreshes the token once');
            }
          }
        }
        if (scenario.signoutDuring) {
          await page.clock.runFor(500);
          assert.equal(await page.evaluate(()=>window.fixtureSession.user),null,'A late verified profile must not restore a signed-out account');
        }
        assert.deepEqual(errors, []);
        reports.push({ scenario: scenario.name, state, errors });
        console.log('PASS ' + scenario.name);
      } finally { await page.close(); }
    }
    const output = path.resolve('output/auth-startup-qa'); fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify(reports, null, 2));
    console.log('AUTH_STARTUP_BROWSER_OK: '+reports.length+' real-provider scenarios, delayed identity/token/scope, stable dashboard reads, Strict Mode, and signed-out outcomes.');
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
