// Exercises the real preloader, all reference owners and identity gate.
// Only external storage/Firestore/service boundaries are simulated.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const esbuild = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'output/workspace-recovery-qa');
const ownerNames = ['class', 'academic-year', 'staff', 'subject', 'house', 'access-level', 'exam'];
const ownerFiles = ownerNames.map(name => `src/lib/hooks/use-${name}-cache-bootstrap.ts`);
const ownerSources = [...ownerFiles, 'src/components/providers/global-data-preloader.tsx'].map(file => fs.readFileSync(path.join(root, file), 'utf8'));
const mockImports = new Map();
for (const source of ownerSources) {
  for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const spec = match[2], key = spec.startsWith('@/') ? 'src/' + spec.slice(2) : spec.startsWith('./') ? 'src/lib/hooks/' + spec.slice(2) : spec;
    if (!(key.includes('/cache/') || /^src\/lib\/hooks\/use-(classes|academic-years|staff|subjects|houses|access-levels|exams|pupils|fees|school-settings)$/.test(key))) continue;
    const names = (mockImports.get(key) || new Set());
    match[1].split(',').map(name => name.trim()).filter(name => name && !name.startsWith('type ')).forEach(name => names.add(name));
    mockImports.set(key, names);
  }
}
const mocks = new Map();
for (const [key, names] of mockImports) {
  let code = '';
  for (const name of names) {
    if (name === 'useDashboardDataRevisions') code += `export const ${name}=()=>({data:{}});`;
    else if (name === 'FEES_QUERY_KEYS') code += `export const ${name}={structures:()=>['fees','structures']};`;
    else if (/Keys$|QUERY_KEYS$/.test(name)) code += `export const ${name}={lists:()=>['${key}'],list:scope=>['${key}',scope]};`;
    else if (/^get.*Scope$/.test(name)) code += `export const ${name}=(id,role)=>id&&role?['trinity-family-schools',id,role].map(encodeURIComponent).join(':'):'';`;
    else if (/^normalise/.test(name)) code += `export const ${name}=data=>data;`;
    else if (name === 'readPupilCache' || name === 'readPersistentCollection' || name === 'readPersistentCollectionWithMetadata') code += `export const ${name}=async()=>null;`;
    else if (name === 'writePersistentCollection') code += `export const ${name}=()=>{window.cacheWrites++;return new Promise(()=>{});};`;
    else if (/^read.*Cache$/.test(name)) code += `export const ${name}=scope=>window.mockCaches['${key}:'+scope]||null;`;
    else if (/^write.*Cache$/.test(name)) code += `export const ${name}=(scope,revision,data)=>{window.mockCaches['${key}:'+scope]={revision,data};};`;
    else if (name === 'clearPupilSessionQueries') code += `export const ${name}=client=>client.removeQueries({queryKey:['pupils']});`;
    else if (name === 'isParentPupilSnapshotOwnedByAccount') code += `export const ${name}=(id,pupils)=>pupils.every(p=>p.parentAccountId===id&&p.parentAccountActive);`;
    else if (name === 'persistentCollectionCacheKey') code += `export const ${name}=(...args)=>args.join(':');`;
    else code += `export const ${name}=()=>{};`;
  }
  mocks.set(key, code);
}
mocks.delete('src/lib/hooks/use-school-settings');
mocks.set('src/lib/cache/school-settings-cache', 'export const readSchoolSettingsCache=()=>new Promise(()=>{});export const writeSchoolSettingsCache=()=>new Promise(()=>{});');
mocks.set('src/lib/services/dashboard-revision-documents', `export const dashboardRevisionDocumentIds={reference:'reference',operational:'operational',timetable:'timetable',examResults:'examResults'};export const dashboardRevisionDocumentRef=name=>({name:'revision-'+name});export const schoolSettingsDocumentRef=()=>({name:'school-profile'});export const schoolSettingsMetaDocumentRef=()=>({name:'school-meta'});`);
mocks.set('src/lib/services/school-settings.service', `export const SchoolSettingsService={getSchoolSettingsFromServer:async()=>{window.reads.settings=(window.reads.settings||0)+1;if(window.failReads.settings)throw new Error('Unavailable');return {id:'settings',schoolName:'Trinity'};}};`);
mocks.set('src/lib/contexts/auth-context', `import {useContext} from 'react';export const useAuth=()=>useContext(window.UserContext);`);
mocks.set('src/lib/firebase', `export const auth=window.mockAuth;export const db={};`);
const services = [['classes','ClassesService','classes'],['academic-years','AcademicYearsService','academicYears'],['staff','StaffService','staff'],['subjects','SubjectsService','subjects'],['houses','HousesService','houses'],['access-levels','AccessLevelsService','accessLevels'],['exams','ExamsService','exams'],['fees','FeesService','fees'],['uniforms','UniformsService','uniforms'],['pupils','PupilsService','pupils']];
for (const [file,name,id] of services) mocks.set(`src/lib/services/${file}.service`, `export const ${name}=new Proxy({}, {get:(_,method)=>method.startsWith('refreshShared')?read=>read():method.startsWith('getAllFromFirestoreCache')?async()=>[]:method.startsWith('get')?async()=>{window.reads['${id}']=(window.reads['${id}']||0)+1;if(window.failReads['${id}'])throw new Error('Transient download failure');return [];}:()=>{}});`);
mocks.set('firebase/firestore', `export const doc=()=>({});export const collection=(_,name)=>({name});export const where=(field,op,value)=>({field,op,value});export const query=(base,...filters)=>({...base,filters});export const getDocs=async q=>{window.reads[q.name]=(window.reads[q.name]||0)+1;if(window.failReads[q.name])throw new Error('Transient download failure');return {docs:[]};};export const onSnapshot=(query,options,next,error)=>{const listener={query,next,error,active:true};window.listeners.push(listener);queueMicrotask(()=>{if(listener.active)next({metadata:{fromCache:true},docs:[],empty:true,exists:()=>false,data:()=>({}),docChanges:()=>[]});});return()=>{listener.active=false;};};`);
mocks.set('src/lib/cache/school-catalogue-cache', 'export const restoreCatalogue=async()=>{};');
mocks.set('src/lib/cache/school-catalogue-queries', 'export const schoolCatalogueOptions=(_,name)=>({queryKey:[name],queryFn:async()=>{window.reads[name]=(window.reads[name]||0)+1;if(window.failReads[name])throw new Error("Transient download failure");return [];},staleTime:Infinity});');
async function run() {
  fs.mkdirSync(output, {recursive:true});
  const contents = `import React,{createContext,useState} from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {GlobalDataPreloader} from './src/components/providers/global-data-preloader';import {retryWorkspaceTasks,readWorkspaceSetup,workspaceSetupScope} from './src/lib/startup/workspace-setup';import {useSchoolSettings} from './src/lib/hooks/use-school-settings';import {withWorkspaceIdentity} from './src/lib/startup/workspace-auth';
window.UserContext=createContext(null);const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});function SettingsOwner(){useSchoolSettings();return null;}
function Fixture(){const [user,setUser]=useState({id:'first',role:'Admin'});const scope=workspaceSetupScope(user.id,user.role);window.fixture={state:()=>readWorkspaceSetup(client,scope,user.role),retry:()=>retryWorkspaceTasks(client,scope,user.role),switchUser:role=>{window.mockAuth.currentUser={uid:'parent',isAnonymous:false};setUser({id:'parent',role});},read:key=>client.getQueryData(key),guard:id=>withWorkspaceIdentity(id,async()=>{window.guardReads++;})};return <QueryClientProvider client={client}><window.UserContext.Provider value={{user,isAuthenticated:true}}><SettingsOwner/><GlobalDataPreloader/><h1>Signed workspace</h1></window.UserContext.Provider></QueryClientProvider>;}createRoot(document.getElementById('app')).render(<Fixture/>);`;
  await esbuild.build({absWorkingDir:root,stdin:{contents,resolveDir:root,loader:'tsx'},bundle:true,jsx:'automatic',platform:'browser',outfile:path.join(output,'fixture.js'),alias:{'@':path.join(root,'src')},define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID':'undefined'},plugins:[{name:'network-boundaries',setup(build){build.onResolve({filter:/.*/},args=>{let key=args.path.startsWith('@/')?'src/'+args.path.slice(2):args.path.startsWith('.')?path.relative(root,path.resolve(path.dirname(args.importer),args.path)).replaceAll('\\','/'):args.path;if(mocks.has(key))return {path:key,namespace:'boundary'};});build.onLoad({filter:/.*/,namespace:'boundary'},args=>({contents:mocks.get(args.path),resolveDir:root,loader:'js'}));}}]});
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?fs.readFileSync(path.join(output,'fixture.js')):'<!doctype html><div id="app"></div><script src="/fixture.js"></script>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({channel:process.env.THEME_BROWSER_CHANNEL||'chrome',headless:true});
  try {
    const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{window.listeners=[];window.reads={};window.failReads={classes:true,fees:true,requirements:true,settings:true};window.mockCaches={};window.cacheWrites=0;window.guardReads=0;const restored=new Promise(resolve=>window.restoreAuth=()=>{window.mockAuth.currentUser={uid:'first',isAnonymous:false};resolve();});window.mockAuth={currentUser:null,authStateReady:()=>restored};window.emit=(name,pupils=[],fieldValue)=>{window.listeners.filter(l=>l.active&&l.query.name===name&&(fieldValue===undefined||l.query.filters?.some(f=>f.value===fieldValue))).forEach(l=>l.next({metadata:{fromCache:false},docs:pupils.map(p=>({id:p.id,data:()=>p})),empty:pupils.length===0,exists:()=>name==='school-meta',data:()=>({revision:1}),docChanges:()=>[]}));};});
    await page.goto('http://127.0.0.1:'+server.address().port);await page.getByRole('heading').waitFor();await page.waitForTimeout(300);
    assert.deepEqual(await page.evaluate(()=>window.reads),{},'Protected downloads wait for Firebase restoration');assert.equal(await page.evaluate(()=>window.listeners.filter(l=>['pupils','payments'].includes(l.query.name)).length),0);
    await page.evaluate(()=>{window.restoreAuth();window.emit('school-meta');});
    await page.waitForFunction(()=>['classes','fees','requirements','settings'].every(id=>window.fixture.state().tasks.find(t=>t.id===id)?.state==='error'));
    assert.ok(!await page.evaluate(()=>window.fixture.state().ready));
    await page.evaluate(()=>{const l=window.listeners.find(l=>l.active&&l.query.name==='pupils');window.oldPupils=l;l.active=false;l.error(new Error('Disconnected'));window.failReads={};window.healthyReads={...window.reads};});
    await page.evaluate(()=>window.fixture.retry());
    await page.waitForFunction(()=>window.listeners.some(l=>l.active&&l.query.name==='pupils'));
    await page.evaluate(()=>{window.emit('school-meta');window.emit('pupils',[{id:'one'}]);});
    await page.waitForFunction(()=>window.fixture.state().ready);
    for(const id of ['academicYears','staff','subjects','houses','accessLevels','exams','uniforms'])assert.equal(await page.evaluate(id=>window.reads[id],id),await page.evaluate(id=>window.healthyReads[id],id),'Healthy '+id+' reader stays intact');
    await page.waitForFunction(()=>window.cacheWrites>0);assert.ok(await page.evaluate(()=>window.fixture.state().ready),'Blocked optional IndexedDB write does not block downloaded records');
    await page.evaluate(()=>window.oldPupils.next({metadata:{fromCache:false},docs:[{id:'stale',data:()=>({})}],empty:false,docChanges:()=>[]}));assert.equal(await page.evaluate(()=>window.fixture.read(['pupils','list'])[0].id),'one','Retired listener cannot publish stale records');
    await page.evaluate(async()=>{for(const user of [null,{uid:'wrong',isAnonymous:false},{uid:'first',isAnonymous:true}]){window.mockAuth.currentUser=user;try{await window.fixture.guard('first');throw new Error('Identity must reject');}catch(e){if(e.code!=='auth/workspace-identity')throw e;}}window.mockAuth.currentUser={uid:'first',isAnonymous:false};});assert.equal(await page.evaluate(()=>window.guardReads),0);
    await page.evaluate(()=>window.fixture.switchUser('Parent'));
    await page.waitForFunction(()=>window.listeners.some(l=>l.active&&l.query.name==='pupils'&&l.query.filters.some(f=>f.value==='parent')));
    await page.evaluate(()=>window.emit('pupils',[{id:'child-a',parentAccountId:'parent',parentAccountActive:true},{id:'child-b',parentAccountId:'parent',parentAccountActive:true}]));
    await page.waitForFunction(()=>window.listeners.filter(l=>l.active&&l.query.name==='payments').length===2);
    assert.ok(!await page.evaluate(()=>window.fixture.state().ready),'Empty local payment snapshot is not confirmed');
    await page.evaluate(()=>{window.emit('payments',[],'child-a');window.emit('payments',[],'child-b');window.healthyPayment=window.listeners.find(l=>l.active&&l.query.name==='payments'&&l.query.filters.some(f=>f.value==='child-b'));const l=window.listeners.find(l=>l.active&&l.query.name==='payments'&&l.query.filters.some(f=>f.value==='child-a'));l.active=false;l.error(new Error('Payment connection lost'));});
    assert.ok(await page.evaluate(()=>window.fixture.state().failed));
    await page.evaluate(()=>window.fixture.retry());assert.ok(await page.evaluate(()=>window.healthyPayment.active),'Healthy child listener is retained');
    assert.equal(await page.evaluate(()=>window.listeners.filter(l=>l.active&&l.query.name==='payments').length),2,'Exactly one active listener per child');
    assert.equal(await page.evaluate(()=>window.listeners.filter(l=>l.active&&l.query.name==='pupils').length),1,'Exactly one active scoped pupil listener');
    await page.evaluate(()=>window.emit('payments',[],'child-a'));await page.waitForFunction(()=>window.fixture.state().ready);
    assert.deepEqual(errors,[]);console.log('WORKSPACE_RECOVERY_BROWSER_OK: restored identity gate, failed reference/catalogue recovery, healthy read preservation, blocked optional profile/pupil storage, settings recovery, retired listener protection, scoped parent payments and no duplicate listeners.');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
