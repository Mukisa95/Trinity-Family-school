// Synthetic data: real Pupils page/route chrome, shared pupil observers and stream editor.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const esbuild=require('esbuild'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'output/pupils-single-page-qa');
async function run(){
fs.mkdirSync(output,{recursive:true});
const contents=`
import React,{createContext,useContext,useState} from 'react';import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import PupilsPage from './src/app/pupils/page';import {PupilsPageLoading} from './src/components/pupils/pupils-page-loading';
import StreamsPage from './src/app/classes/[classId]/streams/page';
import {CatalogueDataNotice} from './src/components/common/catalogue-data-notice';
import {usePupils,useSearchPupils,pupilsKeys} from './src/lib/hooks/use-pupils';
import {classesKeys} from './src/lib/hooks/use-classes';import {getClassCacheScope} from './src/lib/cache/class-cache';
import {GranularPermissionService as Permissions} from './src/lib/services/granular-permissions.service';
window.Auth=createContext(null);window.Params=createContext('');window.dbReads=0;window.toolMounts=0;window.navRequests=[];window.savedRequests=[];
window.client=new QueryClient({defaultOptions:{queries:{retry:false}}});
window.seed=Array.from({length:76},(_,i)=>({id:'p'+i,firstName:'Alice',lastName:'Pupil '+String(i).padStart(2,'0'),admissionNumber:'PIN-'+i,classId:i%2?'c2':'c1',className:i%2?'P.2':'P.1',status:'Active',gender:i%2?'Female':'Male',section:'Day',guardians:[],additionalIdentifiers:[]}));
window.publish=data=>window.client.setQueryData(pupilsKeys.lists(),data);window.publish(window.seed);
window.setHydration=value=>window.client.setQueryData(['pupils','hydration'],value);window.setHydration('saved');
const key=classesKeys.list(getClassCacheScope('admin','Admin'));
window.client.setQueryData(key,[{id:'c1',name:'P.1',code:'P.1',order:1,streams:[{id:'angels',name:'Angels',code:'A'},{id:'stars',name:'Stars',code:'S'}],streamConfigurations:[{academicYearId:'2026',enabled:true,version:1,activeStreamIds:['angels','stars']}]},{id:'c2',name:'P.2',code:'P.2',order:2}]);
window.startStreams=()=>{window.publish(window.seed.slice(0,75).map((p,i)=>({...p,classId:'c1',streamId:i<21?'angels':'stars',streamName:i<21?'Angels':'Stars',streamCode:i<21?'A':'S',streamClassId:'c1',streamAcademicYearId:'2026'})));window.setMode('streams');};
window.router={push:href=>window.navRequests.push(href),replace:href=>window.navRequests.push(href),prefetch:()=>{}};
window.fetch=async(url,options)=>{if(!String(url).startsWith('/api/classes/'))throw Error('Unexpected fixture request');window.savedRequests.push(JSON.parse(options.body));return {ok:true,json:async()=>({version:2})};};
function Other(){const list=usePupils(),search=useSearchPupils('Alice');return <aside id='other-consumers' data-total={list.data?.length??'missing'} data-search={search.data.length}/>;}
function App(){const [user,setUser]=useState({id:'admin',role:'Admin'}),[mode,setMode]=useState('pupils'),[params,setParams]=useState(location.search);window.setUser=setUser;window.setMode=setMode;
if(!window.patchedHistory){window.patchedHistory=true;const replace=history.replaceState.bind(history);history.replaceState=(...args)=>{replace(...args);setParams(location.search);};}
const [notice,setNotice]=useState({saved:true,refreshing:false,error:null});window.setNotice=setNotice;
const auth={user,isAuthenticated:!!user,isSignedIdentityReady:false,isLoading:false,canAccessModule:()=>true,canEdit:()=>true,canDelete:()=>true,canAccessPage:(m,p)=>Permissions.canAccessPage(user,m,p),canPerformAction:(m,p,a)=>Permissions.canPerformAction(user,m,p,a)};
return <window.Auth.Provider value={auth}><window.Params.Provider value={params}><QueryClientProvider client={window.client}><Other/>{mode==='streams'?<StreamsPage/>:mode==='notice'?<CatalogueDataNotice {...notice} label='school-day calendar' hasData={true} retry={()=>{}}/>:!Permissions.canAccessPage(user,'pupils','list')?<p>Pupil access is unavailable.</p>:mode==='loading'?<PupilsPageLoading/>:<PupilsPage/>}</QueryClientProvider></window.Params.Provider></window.Auth.Provider>;}
createRoot(document.getElementById('root')).render(<App/>);`;
const mocks={
 'next/navigation':`import{useContext}from'react';export const useSearchParams=()=>new URLSearchParams(useContext(window.Params));export const useRouter=()=>window.router;export const useParams=()=>({classId:'c1'});`,
 'next/link':`import React from'react';export default({href,onClick,children,prefetch,...props})=><a {...props} href={href} onClick={e=>{onClick?.(e);e.preventDefault();}}>{children}</a>;`,
 'next/image':`import React from'react';export default({fill,priority,...props})=><img {...props}/>;`,
 'next/dynamic':`import React,{useEffect}from'react';export default()=>()=>{useEffect(()=>{window.toolMounts++},[]);return null;};`,
 '@/lib/contexts/auth-context':`import{useContext}from'react';export const useAuth=()=>useContext(window.Auth);`,
 '@/lib/contexts/navigation-context':`export const useNavigation=()=>({goBack:href=>window.navRequests.push(href),startNavigation:()=>{},isNavigating:false});`,
 '@/lib/firebase':`export const db={};export const auth={currentUser:{uid:'admin',getIdToken:async()=>'fixture-token'}};`,
 '../services/pupils.service':`export const PupilsService=new Proxy({}, {get:()=>()=>{window.dbReads++;throw Error('Unexpected pupil database call');}});`,
 '../services/classes.service':`export const ClassesService=new Proxy({}, {get:()=>()=>{window.dbReads++;throw Error('Unexpected class database call');}});`,
 './use-digital-signature':`export const useDigitalSignatureHelpers=()=>({});`,
 '@/lib/hooks/use-school-settings':`export const useSchoolSettings=()=>({data:{generalInfo:{name:'Synthetic school'}},isLoading:false});`,
 '@/lib/hooks/use-houses':`export const useHouses=()=>({data:[]});`,
 '@/lib/hooks/use-academic-years':`export const useActiveAcademicYear=()=>({data:{id:'2026',name:'2026'},isLoading:false});export const useAcademicYears=()=>({data:[]});export const useAcademicNow=()=>new Date('2026-10-14');`,
 '@/lib/hooks/use-term-status':`export const useTermStatus=()=>({isRecessMode:false});`,
 '@/components/common/recess-status-banner':`export const RecessStatusBanner=()=>null;`,
 '@/hooks/use-toast':`export const useToast=()=>({toast:()=>{}});export const toast=()=>{};`,
};
const built=await esbuild.build({stdin:{contents,loader:'tsx',resolveDir:root},bundle:true,format:'iife',platform:'browser',jsx:'automatic',write:false,loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID':'"trinity-family-schools"'},plugins:[{name:'boundaries',setup(build){
build.onResolve({filter:/.*/},args=>{const key=Object.hasOwn(mocks,args.path)?args.path:Object.keys(mocks).find(key=>key.startsWith('@')&&key.split('/').pop()===args.path.split('/').pop());return key?{path:key,namespace:'mock'}:undefined;});
build.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'tsx',resolveDir:root}));}}]});
const cssDir=path.join(root,'.next/static/css'),css=fs.readdirSync(cssDir).filter(f=>f.endsWith('.css')).map(f=>fs.readFileSync(path.join(cssDir,f),'utf8')).join('\n');
const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':req.url==='/styles.css'?'text/css':'text/html');res.end(req.url==='/fixture.js'?built.outputFiles[0].text:req.url==='/styles.css'?css:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><main class="p-3 md:p-6"><div id="root"></div></main><script src="/fixture.js"></script>');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];
try{
const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:'+server.address().port+'/pupils');
await page.getByRole('heading',{name:'Select a Class'}).waitFor();assert.equal(await page.locator('[data-cached-pupils-list]').count(),0);assert.equal(await page.locator('tbody tr').count(),0,'No flash of all pupils before selecting a class');assert.equal(await page.evaluate(()=>window.toolMounts),0);
await page.screenshot({path:path.join(output,'select-class-mobile.png')});const initialHeader=await page.locator('.pupils-page-topbar').boundingBox();
await page.getByRole('combobox').filter({visible:true}).first().click();await page.getByRole('option',{name:/P\.1/}).click();
await page.getByRole('link',{name:'Pupil 04 Alice',exact:true}).waitFor();assert.equal(await page.locator('tbody tr:has(a[href^="/pupil-detail"])').count(),38);
await page.evaluate(()=>window.pageNode=document.querySelector('[data-pupils-page]'));
await page.getByRole('textbox',{name:'Search pupils...'}).filter({visible:true}).fill('Pupil 04');assert.equal(await page.locator('tbody tr:has(a[href^="/pupil-detail"])').count(),1);
await page.evaluate(()=>window.publish([{...window.seed[4],lastName:'Changed'}]));await page.getByRole('textbox',{name:'Search pupils...'}).filter({visible:true}).fill('');await page.getByRole('link',{name:'Changed Alice',exact:true}).waitFor();
assert.equal(await page.locator('#other-consumers').getAttribute('data-total'),'1');assert.equal(await page.locator('#other-consumers').getAttribute('data-search'),'1');assert.equal(await page.evaluate(()=>window.dbReads),0);
await page.getByRole('button',{name:'Export Options'}).click();await page.getByRole('menuitem',{name:'Export to Excel'}).click();await page.waitForFunction(()=>window.toolMounts===1);assert.equal(await page.evaluate(()=>window.pageNode===document.querySelector('[data-pupils-page]')),true,'Opening a tool never replaces the pupil page');await page.getByRole('link',{name:'Changed Alice',exact:true}).waitFor();
await page.screenshot({path:path.join(output,'cached-class-mobile.png')});
await page.evaluate(()=>window.setHydration('denied'));await page.getByRole('alert').waitFor();assert.equal(await page.locator('tbody tr:has(a[href^="/pupil-detail"])').count(),0);
await page.evaluate(()=>{window.publish([]);window.setHydration('ready')});await page.getByText('No pupils found for the selected class').waitFor();
await page.evaluate(()=>window.setUser({id:'parent',role:'Parent'}));await page.getByText('Pupil access is unavailable.').waitFor();
await page.evaluate(()=>{window.setUser({id:'admin',role:'Admin'});window.setMode('loading')});await page.getByRole('heading',{name:'Select a Class'}).waitFor();const coldHeader=await page.locator('.pupils-page-topbar').boundingBox();assert.equal(coldHeader.width,initialHeader.width);assert.equal(coldHeader.height,initialHeader.height,'Cold boundary uses the actual header geometry');await page.screenshot({path:path.join(output,'cold-route-mobile.png')});assert.equal(await page.locator('[data-cached-pupils-list]').count(),0);
await page.getByRole('combobox').filter({visible:true}).first().click();await page.getByRole('option',{name:/P\.1/}).click();assert.equal(await page.evaluate(()=>new URLSearchParams(location.search).get('classId')),'c1');
await page.evaluate(()=>window.setMode('pupils'));await page.getByText('No pupils found for the selected class').waitFor();
await page.evaluate(()=>{window.publish(window.seed);document.documentElement.classList.add('dark')});await page.setViewportSize({width:320,height:640});await page.getByRole('link',{name:'Pupil 04 Alice',exact:true}).waitFor();await page.screenshot({path:path.join(output,'cached-class-dark-320.png')});
await page.getByRole('textbox',{name:'Search pupils...'}).filter({visible:true}).focus();await page.screenshot({path:path.join(output,'cached-class-dark-320-focused.png')});await page.getByRole('textbox',{name:'Search pupils...'}).filter({visible:true}).blur();await page.setViewportSize({width:1280,height:800});await page.screenshot({path:path.join(output,'cached-class-desktop-dark.png')});
await page.evaluate(()=>window.startStreams());await page.getByLabel('Disable Angels').waitFor();await page.waitForTimeout(150);
const badge=name=>page.locator('aside label').filter({hasText:name}).locator('[data-slot="badge"],.inline-flex').last();
const counts=()=>page.evaluate(()=>[...document.querySelectorAll('aside label')].map(label=>({name:label.textContent.replace(/\s+/g,' ').trim(),count:label.lastElementChild.textContent})));
let groups=await counts();assert.ok(groups.some(g=>g.name.includes('Angels')&&g.count==='21'),JSON.stringify(groups));assert.ok(groups.some(g=>g.name.includes('Stars')&&g.count==='54'),JSON.stringify(groups));
await page.getByRole('checkbox',{name:'Assign Pupil 00 Alice to Stars'}).click();
await page.evaluate(()=>window.publish(window.client.getQueryData(['pupils','list']).map(p=>p.id==='p70'?{...p,streamId:'angels',streamName:'Angels',streamCode:'A'}:p)));
assert.equal(await page.getByRole('checkbox',{name:'Assign Pupil 00 Alice to Stars'}).getAttribute('aria-checked'),'true','A cache update cannot erase a manual choice');
await page.getByRole('button',{name:'Save stream setup',exact:true}).click();await page.waitForFunction(()=>window.savedRequests.length===1);
const saved=await page.evaluate(()=>window.savedRequests[0]);assert.equal(saved.assignments.length,75);assert.equal(saved.assignments.filter(p=>p.streamId==='angels').length,21);assert.equal(saved.assignments.filter(p=>p.streamId==='stars').length,54);
await page.evaluate(()=>window.setMode('notice'));assert.equal(await page.getByRole('status').count(),0,'A healthy saved calendar is normal');await page.evaluate(()=>window.setNotice({saved:true,refreshing:true,error:null}));await page.getByText('Checking for school-day calendar updates…').waitFor();await page.evaluate(()=>window.setNotice({saved:true,refreshing:false,error:Error('Offline')}));await page.getByText('Showing saved school-day calendar. Updates will retry when connected.').waitFor();
assert.equal(await page.evaluate(()=>window.dbReads),0);assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({singlePageFromFirstPaint:true,canonicalCacheShared:true,zeroDatabaseReads:true,cacheUsableBeforeSignedIdentity:true,toolDoesNotReplacePage:true,accountDenialProtected:true,coldRouteKeepsActualChrome:true,savedStreamsPreserved:true,manualEditsSurviveCacheUpdates:true,healthyCalendarQuiet:true,errors},null,2));
console.log('PUPILS_SINGLE_PAGE_BROWSER_OK: actual cached list and header, no intermediate populated page, stream drafts preserved, healthy saved-calendar notice hidden.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(error=>{console.error(error);process.exitCode=1});
