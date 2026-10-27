import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Read/write adapter with staged atomic commits. No live Firebase project is used.
class Database {
  data = new Map(); sequence = 0; commits = []; failNextCommit = false;
  doc(path) { const [name,id]=path.split("/"); return this.collection(name).doc(id); }
  collection(name) {
    const database = this;
    const query = filters => ({
      name,
      doc(id = `generated-${++database.sequence}`) {
        const ref = { id, path: `${name}/${id}`, async get() { return database.snapshot(ref); },
          async set(data, options) { await database.batch().set(ref, data, options).commit(); },
          async create(data) { await database.batch().create(ref, data).commit(); } };
        return ref;
      },
      where(field, operator, value) { assert.equal(operator, '=='); return query([...filters, [field, value]]); },
      async get() { const docs = [...database.data].filter(([key, value]) => key.startsWith(name+'/') && filters.every(([field, expected]) => value[field] === expected)).map(([key]) => database.snapshot(query([]).doc(key.slice(name.length+1)))); return { docs, size: docs.length, empty: !docs.length }; },
    });
    return query([]);
  }
  snapshot(ref) { return { id:ref.id,ref,exists:this.data.has(ref.path),data:()=>this.data.get(ref.path) }; }
  batch() {
    const database=this; const operations=[];
    const batch={ get:target=>target.get(), getAll:async(...refs)=>Promise.all(refs.map(ref=>ref.get())),
      set(ref,data,options){operations.push({type:'set',ref,data,options});return batch;},
      update(ref,data){operations.push({type:'update',ref,data});return batch;},
      create(ref,data){operations.push({type:'create',ref,data});return batch;},
      delete(ref){operations.push({type:'delete',ref});return batch;},
      async commit(){
        if(database.failNextCommit){database.failNextCommit=false;throw new Error('FIXTURE_COMMIT_FAILED');}
        const next=new Map(database.data);
        const merge=(old,value)=>{
          if(value && typeof value.isEqual==='function' && value.isEqual(FieldValue.increment(1)))return Number(old||0)+1;
          if(value instanceof Timestamp)return value;
          if(Array.isArray(value))return value;
          if(value && typeof value==='object')return Object.fromEntries([...new Set([...Object.keys(old||{}),...Object.keys(value)])].map(key=>[key,Object.hasOwn(value,key)?merge(old?.[key],value[key]):old[key]]));
          return value;
        };
        for(const operation of operations){const key=operation.ref.path;
          if(operation.type==='create'&&next.has(key))throw new Error('ALREADY_EXISTS');
          if(operation.type==='update'&&!next.has(key))throw new Error('NOT_FOUND');
          if(operation.type==='delete')next.delete(key);
          else next.set(key,merge(operation.type==='update'||operation.options?.merge?next.get(key):undefined,operation.data));
        }
        database.data=next;database.commits.push(operations);
      },
    };return batch;
  }
  async runTransaction(callback){const transaction=this.batch();const result=await callback(transaction);await transaction.commit();return result;}
  revision(){return this.data.get('settings/data-revisions-operational')||{};}
}

let engine; let duties;
before(async()=>{
  process.env.STAFF_CLOCKING_QR_SECRET='read-only-fixture-signing-secret-with-32-characters';
  const bundle=async entry=>{
    const result=await build({entryPoints:[entry],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'server-marker',setup(builder){
      builder.onResolve({filter:/^server-only$/},()=>({path:'marker',namespace:'fixture'}));
      builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:''}));
    }}]});
    const output=path.resolve('output/dashboard-cache-validation',entry.includes('duty-management')?'duty-writes.cjs':'clock-writes.cjs');await mkdir(path.dirname(output),{recursive:true});await writeFile(output,result.outputFiles[0].contents);return createRequire(import.meta.url)(output);
  };
  engine=await bundle('src/lib/server/staff-clocking/index.ts');
  duties=(await bundle('src/lib/server/staff-clocking/duty-management.ts')).manageClockingDutySource;
});
const admin={user:{id:'admin',role:'Admin',isActive:true,username:'admin'}};
const staff={user:{id:'staff-user',staffId:'sarah',role:'Staff',isActive:true,username:'sarah'}};
function clockDatabase(){const db=new Database();db.data.set('staffClockingSettings/default',{enabled:true,revision:1,accessMode:'all_active_linked_staff',enrolledStaffIds:[]});db.data.set('staff/sarah',{firstName:'Sarah',lastName:'Namuli',role:['TEACHER'],department:['Teaching'],status:'active'});db.data.set('system_users/staff-user',staff.user);db.data.set('staffClockingSchedules/school',{scope:'school',kind:'recurring',weekdays:[0,1,2,3,4,5,6],clockInBy:'07:30',graceMinutes:5,isActive:true});return db;}

test('settings and schedule edits commit their policy revision atomically',async()=>{
  const db=clockDatabase();
  await engine.updateStaffClockingSettings(db,admin,{enabled:false,accessMode:'all_active_linked_staff',enrolledStaffIds:[]});
  assert.equal(db.revision().staffClockingPolicy,1);assert.equal(db.revision().staffClockingEnabled,false);
  const schedule=await engine.createStaffClockingSchedule(db,admin,{scope:'school',kind:'recurring',weekdays:[2],clockInBy:'08:00',graceMinutes:0,isActive:true});
  await engine.updateStaffClockingSchedule(db,admin,schedule.id,{scope:'school',kind:'recurring',weekdays:[2],clockInBy:'08:30',graceMinutes:0,isActive:true});
  await engine.deleteStaffClockingSchedule(db,admin,schedule.id);assert.equal(db.revision().staffClockingPolicy,4);
  assert.ok(db.commits.every(commit=>commit.some(operation=>operation.ref.path==='settings/data-revisions-operational')));
  db.failNextCommit=true;
  await assert.rejects(engine.createStaffClockingSchedule(db,admin,{scope:'school',kind:'recurring',weekdays:[2],clockInBy:'09:00',graceMinutes:0,isActive:true}),/FIXTURE_COMMIT_FAILED/);
  assert.equal(db.revision().staffClockingPolicy,4);
});
test('accepted clock scans publish exactly once; duplicate and rejected scans do not invalidate dashboards',async()=>{
  const db=clockDatabase();const session=await engine.issueStaffClockingQrSession(db,admin);
  assert.equal(db.revision().dashboardStaffClockingRecords,undefined,'QR display is not a daily data change');
  const input={token:session.token,operationId:'cache_revision_operation_001'};
  await engine.recordStaffClockingScan(db,staff,input);assert.equal(db.revision().dashboardStaffClockingRecords,1);assert.deepEqual(db.revision().staffClockingStaff,{sarah:1});
  assert.equal((await engine.recordStaffClockingScan(db,staff,input)).duplicate,true);assert.equal(db.revision().dashboardStaffClockingRecords,1);
  await assert.rejects(engine.recordStaffClockingScan(db,staff,{token:'invalid-token-which-is-at-least-long-enough',operationId:'rejected_operation_002'}));assert.equal(db.revision().dashboardStaffClockingRecords,1);
});
test('approved corrections invalidate only affected staff; rejected requests do not',async()=>{
  const db=clockDatabase();const session=await engine.issueStaffClockingQrSession(db,admin);await engine.recordStaffClockingScan(db,staff,{token:session.token,operationId:'cache_correction_seed_001'});
  const date=[...db.data.values()].find(value=>value.localDate)?.localDate;
  db.data.set('staffClockingCorrections/change',{accountId:'staff-user',staffId:'sarah',localDate:date,status:'pending',proposedClockInTime:'07:00'});
  await engine.reviewStaffClockingSelfServiceRequest(db,admin,'correction','change',true);assert.equal(db.revision().staffClockingStaff.sarah,2);
  db.data.set('staffClockingCorrections/reject',{accountId:'staff-user',staffId:'sarah',localDate:date,status:'pending',proposedClockInTime:'07:00'});
  await engine.reviewStaffClockingSelfServiceRequest(db,admin,'correction','reject',false);assert.equal(db.revision().dashboardStaffClockingRecords,2);
  db.data.set('staffClockingExemptions/approve',{accountId:'staff-user',staffId:'sarah',localDate:date,status:'pending'});
  await engine.reviewStaffClockingSelfServiceRequest(db,admin,'exemption','approve',true);assert.equal(db.revision().staffClockingStaff.sarah,3);
  const historic='2000-01-01';const historicKey=createHash('sha256').update('sarah:'+historic).digest('base64url');
  db.data.set('staffClockingDailyRecords/'+historicKey,{staffId:'sarah',localDate:historic,clockInBy:'07:30',graceMinutes:5,status:'open'});
  db.data.set('staffClockingCorrections/historic',{accountId:'staff-user',staffId:'sarah',localDate:historic,status:'pending',proposedClockInTime:'07:00'});
  await engine.reviewStaffClockingSelfServiceRequest(db,admin,'correction','historic',true);assert.equal(db.revision().dashboardStaffClockingRecords,3,'historical edits do not refetch today');
});
test('school closures publish both schedule and calendar invalidation with the event',async()=>{
  const db=clockDatabase();await engine.createStaffClockingClosure(db,admin,{title:'School closed',startDate:'2026-10-27'});
  assert.equal(db.revision().staffClockingPolicy,1);assert.equal(db.revision().events,1);
  assert.equal(db.commits.length,1);assert.ok(db.commits[0].some(operation=>operation.ref.path.startsWith('events/')));
});

test('manager exemptions refresh today but historical exemptions leave the dashboard cache valid',async()=>{
  const db=clockDatabase();const date=engine.kampalaClock().localDate;
  await engine.createManagedStaffClockingExemption(db,admin,{staffId:'sarah',localDate:date,reason:'Approved school assignment'});
  assert.equal(db.revision().dashboardStaffClockingRecords,1);
  assert.equal(db.revision().staffClockingStaff.sarah,1);
  await engine.createManagedStaffClockingExemption(db,admin,{staffId:'sarah',localDate:'2000-01-01',reason:'Historical approved absence'});
  assert.equal(db.revision().dashboardStaffClockingRecords,1);
  assert.equal(db.revision().staffClockingStaff.sarah,1);
  assert.equal(db.revision().staffClockingRecords,2,'Existing records UI still refreshes historical records');
});
const rotaData={dutyName:'Supervision',teamsInvolved:['staff'],frequency:'weekly',startDate:'2026-10-26',endDate:'2026-11-09',academicYearId:'year',allowances:{staff:0,prefects:0,pupils:0},isActive:true};
const assignmentData=rotaId=>({rotaId,memberId:'sarah',memberType:'staff',startDate:'2026-10-26',endDate:'2026-10-30',isSupervisor:false,isActive:true});
test('authenticated duty create/update/delete atomically publishes even label-only changes',async()=>{
  const db=clockDatabase();const rota=(await duties(db,admin,{operation:'create_rota',data:rotaData})).id;
  await duties(db,admin,{operation:'update_rota',id:rota,data:{dutyName:'Morning supervision'}});
  const assignment=(await duties(db,admin,{operation:'create_assignments',assignments:[assignmentData(rota)]})).ids[0];
  await duties(db,admin,{operation:'update_assignment',id:assignment,data:{service:'Morning'}});
  await duties(db,admin,{operation:'delete_assignment',id:assignment});await duties(db,admin,{operation:'delete_rota',id:rota});
  assert.equal(db.revision().dutyService,6);assert.equal(db.commits.length,6);
  assert.ok(db.commits.every(commit=>commit.some(operation=>operation.ref.path==='settings/data-revisions-operational')));
  db.failNextCommit=true;await assert.rejects(duties(db,admin,{operation:'create_rota',data:rotaData}),/FIXTURE_COMMIT_FAILED/);assert.equal(db.revision().dutyService,6);
});
test('bulk duty assignment publishes once for the group',async()=>{
  const db=clockDatabase();const rota=(await duties(db,admin,{operation:'create_rota',data:rotaData})).id;
  for(const memberId of ['peter','grace'])db.data.set('staff/'+memberId,{status:'active'});
  const result=await duties(db,admin,{operation:'create_assignments',assignments:['sarah','peter','grace'].map(memberId=>({...assignmentData(rota),memberId}))});
  assert.equal(result.ids.length,3);assert.equal(db.revision().dutyService,2);assert.equal(db.commits.length,2);
});
