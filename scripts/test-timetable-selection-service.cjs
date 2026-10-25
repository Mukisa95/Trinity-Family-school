/* Exercise the real save service against a transaction-recording Firestore adapter. */
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const firestore = `
const f=globalThis.fixture;
export const collection=(_db,...parts)=>({path:parts.join('/')});
export function doc(base,...parts){const p=base.path?[base.path,...parts]:parts; if(!parts.length)p.push('new'+(++f.nextId));const path=p.join('/');return {path,id:path.split('/').pop()};}
const reorder=value=>Array.isArray(value)?value.map(reorder):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([key,item])=>[key,reorder(item)])):value;
const snap=(ref,transaction=false)=>{let value=f.docs[ref.path];
 if(value!==undefined && !transaction && f.scopedRecordIds && (ref.path.startsWith('classes/')||ref.path==='academicYears/year/terms/term/timetables/main')){
  value={...value,id:ref.id};
  if(value.classIds)value={...value,classIds:value.classIds.filter(id=>id!=='hidden'),streamLayouts:Object.fromEntries(Object.entries(value.streamLayouts||{}).filter(([id])=>id!=='hidden'))};
 }
 if(value!==undefined && transaction && f.reorderedSnapshots)value=reorder(value);
 return {ref,id:ref.id,exists:()=>value!==undefined,data:()=>value};};
export const getDocFromServer=async ref=>snap(ref);
export const getDoc=getDocFromServer;
export const getDocsFromServer=async ref=>({docs:Object.keys(f.docs).filter(p=>p.startsWith(ref.path+'/')&&!p.slice(ref.path.length+1).includes('/')).map(p=>snap({path:p,id:p.split('/').pop()}))});
export const getDocs=getDocsFromServer;
export const query=(ref)=>ref,where=()=>null,orderBy=()=>null,deleteField=()=>null,addDoc=()=>null;
export const Timestamp={now:()=> 'timestamp'},FieldPath=class{};
export const writeBatch=()=>{throw Error('Bulk edit must use a transaction')};
export async function runTransaction(_db,callback){
 if(f.concurrentChange)f.docs['settings/revision']={timetable:{year__term:2}};
 if(f.unrelatedRevision)f.docs['settings/revision']={timetable:{year__term:1,other__term:2},updatedAt:'later'};
 if(f.concurrentTeacherChange)f.docs['classes/p1']={...f.docs['classes/p1'],subjectAssignments:[{subjectId:'math',teacherIds:['t2']}]};
 if(f.unrelatedClassMetadata)f.docs['classes/p1']={...f.docs['classes/p1'],updatedAt:'later',classTeacherName:'Updated class teacher'};
 if(f.concurrentProfileChange)f.docs['academicYears/year/terms/term/timetables/main']={classIds:['p2']};
 const operations=[];const transaction={get:async ref=>snap(ref,true),set:(ref,value)=>operations.push(['set',ref.path,value]),delete:ref=>operations.push(['delete',ref.path])};
 const result=await callback(transaction);if(f.failCommit)throw Error('Commit failed');
 f.commits.push(operations);for(const [kind,p,value]of operations){if(kind==='delete')delete f.docs[p];else f.docs[p]=value;}return result;
}`;
async function run() {
  const mocks = {
    '@/lib/access/scoped-firestore': firestore,
    '../firebase': 'export const db={};',
    './dashboard-cache-revisions.service': `export const dashboardRevisionKeys={timetable:(year,term)=>encodeURIComponent(year)+'__'+encodeURIComponent(term)};export function bumpTimetableRevisionInBatch(t){t.set({path:'settings/revision'}, {timetable:{year__term:2}});t.set({path:'settings/legacy'},{});}`,
    './dashboard-revision-documents': `export const dashboardRevisionDocumentRef=()=>({path:'settings/revision',id:'revision'});`,
  };
  const bundle = await require('esbuild').build({
    stdin: { resolveDir:root, contents:`export {TimetableService} from './src/lib/services/timetable.service';export {planTimetableSelectionEdit,timetableSelectionFingerprint} from './src/lib/utils/timetable-selection';`, loader:'ts' },
    bundle:true,write:false,platform:'node',format:'cjs',alias:{'@':path.join(root,'src')},
    plugins:[{name:'firestore-adapter',setup(build){
      build.onResolve({filter:/.*/},args=>mocks[args.path]?{path:args.path,namespace:'mock'}:undefined);
      build.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'ts'}));
    }}],
  });
  const prefix='academicYears/year/terms/term/timetables/main';
  function fixture() {
    const classes=[1,2].map(n=>({id:'p'+n,name:'Primary '+n,subjectAssignments:[{subjectId:'math',teacherIds:['t'+n]}]}));
    const staff=[1,2].map(n=>({id:'t'+n,firstName:'Teacher',lastName:String(n)}));
    const periods=[1,2].map(n=>({id:'day'+n,dayOfWeek:n,periodNumber:1,startTime:'08:00',endTime:'09:00',type:'lesson'}));
    const profile={id:'main',classIds:['p1','p2']};
    const entries=[{id:'old',classId:'p1',periodId:'day1',entryType:'activity',activityName:'Games',subjectId:'ACTIVITY',teacherId:'UNASSIGNED',createdAt:'now'}];
    // Real Firestore records need not store their document ID as a field.
    const withoutId=({id,...value})=>value;
    const docs=Object.fromEntries([...classes.map(c=>['classes/'+c.id,withoutId(c)]),...staff.map(t=>['staff/'+t.id,withoutId(t)]),...periods.map(p=>[prefix+'/periods/'+p.id,withoutId(p)]),...entries.map(e=>[prefix+'/entries/'+e.id,withoutId(e)]),[prefix,withoutId(profile)],['settings/revision',{timetable:{year__term:1}}]]);
    const f={docs,commits:[],nextId:0};
    const context={fixture:f,module:{exports:{}},console};
    vm.runInNewContext(bundle.outputFiles[0].text,context);
    const api=context.module.exports;
    const edit={kind:'subject',subjectId:'math',cells:[{classId:'p1',periodId:'day1'},{classId:'p2',periodId:'day2'}]};
    const fingerprint=api.timetableSelectionFingerprint(api.planTimetableSelectionEdit(edit,{yearId:'year',classes,staff,periods,profile,entries}));
    return {f,api,edit,fingerprint};
  }
  for(const flag of ['reorderedSnapshots','scopedRecordIds','unrelatedRevision','unrelatedClassMetadata']) {
    const {f,api,edit,fingerprint}=fixture();f[flag]=true;
    if(flag==='scopedRecordIds')f.docs[prefix]={...f.docs[prefix],classIds:['p1','p2','hidden'],streamLayouts:{hidden:{defaultMode:'separate'}}};
    const result=await api.TimetableService.editSelectedCells('year','term','main',edit,fingerprint);
    assert.equal(f.commits.length,1,flag+' must not prevent a valid save');
    assert.deepEqual(JSON.parse(JSON.stringify(result.map(e=>[e.classId,e.teacherId]))),[['p1','t1'],['p2','t2']]);
  }
  {
    const {f,api,edit,fingerprint}=fixture();
    const result=await api.TimetableService.editSelectedCells('year','term','main',edit,fingerprint);
    assert.equal(f.commits.length,1);
    assert.equal(f.docs[prefix+'/entries/old'],undefined);
    assert.deepEqual(JSON.parse(JSON.stringify(result.map(e=>[e.classId,e.teacherId]))),[['p1','t1'],['p2','t2']]);
    assert(result.every(e=>e.entryType==='subject'&&!e.activityName),'Replacement drops stale activity fields');
    assert.equal(f.commits[0].length,5,'One deletion, two replacement records and two revision writes commit together');
  }
  {
    const {f,api,edit,fingerprint}=fixture();f.docs['classes/p1']={...f.docs['classes/p1'],subjectAssignments:[{subjectId:'math',teacherIds:['t2']}]};
    await assert.rejects(api.TimetableService.editSelectedCells('year','term','main',edit,fingerprint),/changed/);
    assert.equal(f.commits.length,0);assert(f.docs[prefix+'/entries/old']);
  }
  for(const flag of ['concurrentChange','concurrentTeacherChange','concurrentProfileChange','failCommit']) {
    const {f,api,edit,fingerprint}=fixture();f[flag]=true;
    await assert.rejects(api.TimetableService.editSelectedCells('year','term','main',edit,fingerprint));
    assert.equal(f.commits.length,0);assert(f.docs[prefix+'/entries/old']);
  }
  console.log('TIMETABLE_SELECTION_SERVICE_OK: equivalent/scoped snapshots, unrelated revisions, class teacher matching, atomic replacement, stale preview, concurrent timetable/teacher changes and failed commit.');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
