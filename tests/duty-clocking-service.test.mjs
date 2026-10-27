import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';

test('duty client mutations use authenticated server writes, preserve optional times, batch assignments and reject account changes', async () => {
  const originalFetch=globalThis.fetch;
  globalThis.__dutyAuth={currentUser:{uid:'duty-manager',getIdToken:async()=>'duty-manager-token'}};
  const calls=[];
  globalThis.fetch=async(url,options)=>{calls.push({url,options,body:JSON.parse(options.body)});return{ok:true,json:async()=>({success:true,result:{id:'saved-rota',ids:['assignment-one','assignment-two']}})};};
  try{
    const bundle=await build({stdin:{contents:"export {DutyServiceService} from './src/lib/services/duty-service.service';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'duty-write-boundaries',setup(builder){
      builder.onResolve({filter:/^@\/lib\/(firebase|access\/scoped-firestore)$/},args=>({path:args.path,namespace:'boundary'}));
      builder.onLoad({filter:/.*/,namespace:'boundary'},args=>({contents:args.path.endsWith('firebase')?'export const db={};export const auth=globalThis.__dutyAuth;':`export class Timestamp {} ${['collection','addDoc','getDocs','doc','getDoc','updateDoc','deleteDoc','query','where','orderBy','serverTimestamp','limit','startAfter'].map(name=>`export function ${name}(){throw new Error('Unexpected direct Firestore access: ${name}');}`).join('\n')}`}));
    }}]});
    const target=path.resolve('output/staff-clocking-validation/duty-service-test.cjs');await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bundle.outputFiles[0].contents);const {DutyServiceService:service}=createRequire(import.meta.url)(target);
    const rota={dutyName:'Gate duty',teamsInvolved:['staff'],frequency:'weekly',startDate:'2026-10-26',endDate:'2026-11-01',allowances:{staff:0,prefects:0,pupils:0},academicYearId:'2026',isActive:true,staffArrivalTime:'06:30',staffDepartureTime:'18:00'};
    assert.equal(await service.createDutyRota(rota),'saved-rota');
    assert.equal(calls[0].body.data.staffArrivalTime,'06:30');assert.equal(calls[0].options.headers.Authorization,'Bearer duty-manager-token');assert.equal(calls[0].url,'/api/duty-service/clocking-source');
    await service.updateDutyRota('rota',{staffArrivalTime:'',staffDepartureTime:''});assert.equal(calls.at(-1).body.data.staffArrivalTime,'');
    const assignment={rotaId:'rota',memberId:'staff-one',memberType:'staff',startDate:rota.startDate,endDate:rota.endDate,isSupervisor:false,isActive:true};
    assert.equal(await service.assignMemberToDuty(assignment),'assignment-one');
    await service.updateDutyAssignment('assignment-one',{endDate:'2026-11-02'});assert.equal(calls.at(-1).body.operation,'update_assignment');
    await service.deleteDutyAssignment('assignment-one');assert.equal(calls.at(-1).body.operation,'delete_assignment');
    await service.deleteDutyRota('rota');assert.equal(calls.at(-1).body.operation,'delete_rota');
    service.getDutyRotaById=async()=>({...rota,id:'rota'});service.getDutyTimeline=async()=>({periods:[{periodNumber:1,startDate:rota.startDate,endDate:rota.endDate}]});
    const before=calls.length;assert.deepEqual(await service.createBulkDutyAssignment({rotaId:'rota',periodNumber:1,assignments:[{memberId:'staff-one',memberType:'staff',isSupervisor:false},{memberId:'staff-two',memberType:'staff',isSupervisor:true}]}),['assignment-one','assignment-two']);
    assert.equal(calls.length,before+1,'A whole duty group uses one API write');assert.equal(calls.at(-1).body.assignments.length,2);
    globalThis.fetch=async()=>({ok:false,json:async()=>({success:false,error:'PERMISSION_DENIED'})});await assert.rejects(service.updateDutyRota('rota',{staffArrivalTime:'07:00'}),/PERMISSION_DENIED/);
    globalThis.fetch=async()=>{globalThis.__dutyAuth.currentUser.uid='another-account';return{ok:true,json:async()=>({success:true,result:{id:'secret'}})};};await assert.rejects(service.deleteDutyRota('rota'),/account changed/);
    globalThis.__dutyAuth.currentUser=null;await assert.rejects(service.deleteDutyRota('rota'),/Sign in/);
  }finally{globalThis.fetch=originalFetch;delete globalThis.__dutyAuth;}
});
