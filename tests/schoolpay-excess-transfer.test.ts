import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import {schoolPayReceiptSummary,schoolPaySiblingShares} from '../src/lib/utils/schoolpay-excess';
import * as allocation from '../src/lib/utils/schoolpay-allocation';
import {calculateFeeBalancesAfterDiscounts} from '../src/lib/utils/fee-discount-calculation';
import * as circumference from '../src/lib/access/circumference';
import {GranularPermissionService} from '../src/lib/services/granular-permissions.service';
import {formatPupilDisplayName} from '../src/lib/utils/name-formatter';

function harness(extraSibling = false) {
  const documents = new Map<string,any>();
  const now = new Date('2026-10-16T08:00:00Z');
  class Clock extends Date { constructor(value?: any){super(value===undefined?now:value);} static now(){return now.getTime();} }
  const years = [2026,2027].map(n=>({id:'y'+n,name:String(n),isLocked:false,startDate:n+'-01-01',endDate:n+'-12-31',terms:[1,2,3].map(t=>({id:n+'-t'+t,name:'Term '+t,startDate:n+'-'+['01','05','09'][t-1]+'-01',endDate:n+'-'+['04-30','08-31','12-31'][t-1]}))}));
  years.forEach(y=>documents.set('academicYears/'+y.id,y));
  const source={firstName:'Babra',lastName:'Test',classId:'p4',section:'Day',status:'Active',registrationDate:'2026-05-01',familyId:'family'};
  documents.set('schoolPayPaymentMappings/receipt',{pupilId:'babra',localPaymentIds:['prior','current','future']});
  documents.set('pupils/babra',source);
  documents.set('pupils/brother',{...source,firstName:'Brother',classId:'p2'});
  if(extraSibling)documents.set('pupils/sister',{...source,firstName:'Sister',classId:'p3'});
  for(const [name,amount,cls] of [['main',300000,'p4'],['brother',150000,'p2'],['sister',100000,'p3']] as const){
    documents.set('feeStructures/'+name,{name:'Tuition',amount,status:'active',classFeeType:'specific',classIds:[cls]});
  }
  const base={pupilId:'babra',feeStructureId:'main',academicYearId:'y2026',paymentDate:'2026-10-16T08:00:00Z',source:'schoolpay',schoolPayReceiptNumber:'receipt',schoolPayReceivedAmount:700000,schoolPayOriginalPupilId:'babra',paidBy:{id:'payer',name:'Parent',role:'Parent/Guardian'}};
  documents.set('payments/prior',{...base,termId:'2026-t2',amount:100000,schoolPayOriginTermId:'2026-t3',schoolPayOriginYearId:'y2026'});
  documents.set('payments/current',{...base,termId:'2026-t3',amount:300000});
  documents.set('payments/future',{...base,termId:'2027-t1',academicYearId:'y2027',amount:300000,schoolPayOriginTermId:'2026-t3',schoolPayOriginYearId:'y2026'});
  documents.set('payments/old-paid',{...base,source:'manual',schoolPayReceiptNumber:'older',termId:'2026-t2',amount:200000});
  documents.set('payments/brother-paid',{...base,source:'manual',schoolPayReceiptNumber:'older-brother',pupilId:'brother',feeStructureId:'brother',termId:'2026-t2',amount:100000});
  if(extraSibling)documents.set('payments/sister-paid',{...base,source:'manual',schoolPayReceiptNumber:'older-sister',pupilId:'sister',feeStructureId:'sister',termId:'2026-t2',amount:80000});
  let generated=0, failCommit=false;
  const ref=(path:string):any=>({path,id:path.split('/').at(-1),collection:(name:string)=>collection(path+'/'+name)});
  const collection=(path:string,filters:any[]=[]):any=>({path,filters,doc:(id?:string)=>ref(path+'/'+(id||'generated-'+(++generated))),where:(field:string,operator:string,value:any)=>collection(path,[...filters,{field,operator,value}])});
  const snap=(path:string,data:any)=>({id:path.split('/').at(-1),ref:ref(path),exists:data!==undefined,data:()=>data===undefined?undefined:structuredClone(data)});
  let queue=Promise.resolve();
  const db={collection,runTransaction:(callback:Function)=>{
    const execute=async()=>{
      const staged=new Map<string,any>();let wrote=false;
      const result=await callback({get:async(query:any)=>{
        assert.equal(wrote,false,'Firestore reads must happen before writes');
        if(query.filters)return{docs:[...documents].filter(([path,data])=>path.startsWith(query.path+'/')&&!path.slice(query.path.length+1).includes('/')&&query.filters.every((f:any)=>f.operator==='in'?f.value.includes(data[f.field]):data[f.field]===f.value)).sort(([a],[b])=>a.localeCompare(b)).map(([path,data])=>snap(path,data))};
        return snap(query.path,documents.get(query.path));
      },set:(r:any,data:any)=>{wrote=true;staged.set(r.path,data)},update:(r:any,data:any)=>{wrote=true;assert.ok(documents.has(r.path));staged.set(r.path,{...documents.get(r.path),...data})}});
      if(failCommit)throw Error('Synthetic commit failure');
      staged.forEach((data,path)=>documents.set(path,data));return result;
    };
    const result=queue.then(execute);queue=result.catch(()=>{});return result;
  }};
  const module={exports:{} as any};
  const output=ts.transpileModule(fs.readFileSync('src/lib/services/schoolpay-excess.server.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(output,{module,exports:module.exports,Date:Clock,console,require:(name:string)=>{
    if(name==='node:crypto')return{createHash};
    if(name==='firebase-admin/firestore')return{getFirestore:()=>db,Timestamp:{now:()=>now.toISOString()}};
    if(name.endsWith('/access/circumference'))return circumference;
    if(name.endsWith('/granular-permissions.service'))return{GranularPermissionService};
    if(name.endsWith('/firebase-admin'))return{getFirebaseAdminApp:()=>({})};
    if(name.endsWith('/name-formatter'))return{formatPupilDisplayName};
    if(name.endsWith('/fee-discount-calculation'))return{calculateFeeBalancesAfterDiscounts};
    if(name.endsWith('/schoolpay-allocation'))return allocation;
    if(name.endsWith('/schoolpay-excess'))return{schoolPayReceiptSummary,schoolPaySiblingShares};
    throw Error('Unexpected import '+name);
  }});
  const originalPreview=module.exports.previewSchoolPayExcess;
  module.exports.previewSchoolPayExcess=(id:string,receipt:string,viewer:any={id:'cashier',role:'Admin'})=>originalPreview(id,receipt,viewer);
  return {documents,years,service:module.exports,failCommit:()=>{failCommit=true},
    activeReceipt:()=>[...documents].filter(([path,p])=>path.startsWith('payments/')&&p.schoolPayReceiptNumber==='receipt'&&!p.reverted).map(([path,p])=>({id:path.split('/')[1],...p})),
    transfer:async(target:string,preview:any,operationId='operation-test-0001')=>module.exports.transferSchoolPayExcess({pupilId:'babra',receipt:'receipt',target,version:preview.version,operationId},{id:'cashier',name:'Cashier',role:'Admin'},{id:'cashier',role:'Admin'})};
}

test('Babra retains the 700000 receipt; preview shows only 300000 excess and brother balance of 200000',async()=>{
  const h=harness();const preview=await h.service.previewSchoolPayExcess('babra','receipt');
  assert.equal(preview.receivedAmount,700000);assert.equal(preview.excessAmount,300000);assert.equal(preview.canTransfer,true);
  assert.deepEqual(JSON.parse(JSON.stringify(preview.siblings)),[{pupilId:'brother',name:'Test Brother',previousBalance:50000,termBalance:150000,balance:200000}]);
  assert.equal(h.activeReceipt().reduce((s,p)=>s+p.amount,0),700000);assert.equal(h.documents.get('payments/future').reverted,undefined);
});
test('Here transfers only 200000 excess, clears sibling arrears first, and leaves Babra current payments intact',async()=>{
  const h=harness();const preview=await h.service.previewSchoolPayExcess('babra','receipt');const result=await h.transfer('brother',preview);
  assert.equal(result.transferAmount,200000);assert.equal(result.remainingExcess,100000);
  const active=h.activeReceipt();assert.equal(active.reduce((s,p)=>s+p.amount,0),700000);
  assert.deepEqual(active.filter(p=>p.pupilId==='brother').map(p=>[p.termId,p.amount]),[['2026-t2',50000],['2026-t3',150000]]);
  assert.equal(active.find(p=>p.pupilId==='babra'&&p.termId==='2027-t1')?.amount,100000);
  assert.equal(h.documents.get('payments/prior').amount,100000);assert.equal(h.documents.get('payments/prior').reverted,undefined);
  assert.equal(h.documents.get('schoolPayPaymentMappings/receipt').localPaymentIds.length,5);
  assert.equal(h.documents.get('schoolPayPaymentMappings/receipt').localPaymentIds.includes('future'),false);
  assert.equal(h.documents.get('payments/current').amount,300000);assert.equal(h.documents.get('payments/current').reverted,undefined);
  const summary=schoolPayReceiptSummary(active.filter(p=>p.pupilId==='babra'),h.years)!;
  assert.equal(summary.receivedAmount,700000);assert.equal(summary.transferredAmount,200000);assert.equal(summary.excessAmount,100000);
});
test('All shares limited excess proportionally and never exceeds any sibling balance',async()=>{
  const h=harness(true),preview=await h.service.previewSchoolPayExcess('babra','receipt');const result=await h.transfer('all',preview);
  assert.equal(result.transferAmount,300000);assert.equal(result.remainingExcess,0);
  const active=h.activeReceipt();assert.equal(active.reduce((s,p)=>s+p.amount,0),700000);
  assert.equal(active.filter(p=>p.pupilId==='brother').reduce((s,p)=>s+p.amount,0),187500);
  assert.equal(active.filter(p=>p.pupilId==='sister').reduce((s,p)=>s+p.amount,0),112500);
});
test('repeated or concurrent confirmation commits the transfer once',async()=>{
  const h=harness(),preview=await h.service.previewSchoolPayExcess('babra','receipt');
  const [a,b]=await Promise.all([h.transfer('brother',preview),h.transfer('brother',preview)]);
  assert.equal(a.wasReplay,false);assert.equal(b.wasReplay,true);
  assert.equal(h.activeReceipt().filter(p=>p.pupilId==='brother').reduce((s,p)=>s+p.amount,0),200000);
});
test('changed source payments, sibling balances and family membership invalidate the reviewed preview',async()=>{
  for(const kind of ['source','balance','family']){
    const h=harness(),preview=await h.service.previewSchoolPayExcess('babra','receipt');
    if(kind==='source')h.documents.get('payments/future').reverted=true;
    if(kind==='balance')h.documents.set('payments/new-brother-payment',{...h.documents.get('payments/brother-paid'),termId:'2026-t3',amount:150000});
    if(kind==='family')h.documents.get('pupils/brother').familyId='other-family';
    await assert.rejects(h.transfer('brother',preview),/Balances changed/);
    assert.equal(h.documents.get('payments/current').reverted,undefined);
  }
});
test('unrelated pupils, reused request IDs and source pupils still owing current fees cannot transfer',async()=>{
  const h=harness(),preview=await h.service.previewSchoolPayExcess('babra','receipt');
  await assert.rejects(h.transfer('outsider',preview),/linked sibling/);
  await h.transfer('brother',preview);
  await assert.rejects(h.transfer('all',preview),/already been used/);
  const blocked=harness();blocked.documents.get('payments/current').amount=250000;
  const blockedPreview=await blocked.service.previewSchoolPayExcess('babra','receipt');assert.equal(blockedPreview.canTransfer,false);
  await assert.rejects(blocked.transfer('brother',blockedPreview),/Only excess/);
});
test('a failed atomic commit leaves every original payment in place',async()=>{
  const h=harness(),preview=await h.service.previewSchoolPayExcess('babra','receipt');h.failCommit();
  await assert.rejects(h.transfer('brother',preview),/commit failure/);
  assert.equal(h.activeReceipt().reduce((s,p)=>s+p.amount,0),700000);
  assert.equal(h.documents.get('payments/future').reverted,undefined);
  assert.equal(h.activeReceipt().filter(p=>p.pupilId==='brother').length,0);
});
test('whole UGX proportional splitting preserves the total without allocating beyond balances',()=>{
  for(const excess of [1,2,3,100,501]){
    const siblings=[1,2,3].map((n)=>({pupilId:String(n),name:String(n),previousBalance:0,termBalance:n*50,balance:n*50}));
    const shares=schoolPaySiblingShares(excess,siblings);
    assert.equal(shares.reduce((s,p)=>s+p.amount,0),Math.min(excess,300));
    shares.forEach((share,i)=>assert.ok(share.amount<=siblings[i].balance));
  }
});


test('legacy receipts without origin metadata still identify future excess by payment date',async()=>{
  const h=harness();
  for(const id of ['prior','current','future']){
    const payment=h.documents.get('payments/'+id);
    delete payment.schoolPayOriginTermId;delete payment.schoolPayOriginYearId;
    delete payment.schoolPayReceivedAmount;delete payment.schoolPayOriginalPupilId;
  }
  const preview=await h.service.previewSchoolPayExcess('babra','receipt');
  assert.equal(preview.excessAmount,300000);assert.equal(preview.receivedAmount,700000);
  const result=await h.transfer('brother',preview);assert.equal(result.transferAmount,200000);
});
test('fully waived sibling fees cannot consume excess, and a sibling cannot transfer Babra’s receipt onward',async()=>{
  const h=harness();
  h.documents.set('feesHolidays/holiday',{pupilId:'brother',isActive:true,categories:['non-required'],discountType:'full',createdAt:'2026-01-01'});
  const preview=await h.service.previewSchoolPayExcess('babra','receipt');
  assert.equal(preview.siblings[0].balance,0);
  await assert.rejects(h.transfer('brother',preview),/no outstanding/);
  const normal=harness(),initial=await normal.service.previewSchoolPayExcess('babra','receipt');
  await normal.transfer('brother',initial);
  const siblingPreview=await normal.service.previewSchoolPayExcess('brother','receipt');
  assert.equal(siblingPreview.canTransfer,false);
});


test('staff previews and transfers respect current pupil Circumference and revoked permissions',async()=>{
  const h=harness();
  const viewer={id:'limited',role:'Staff',isActive:true,modulePermissions:[{module:'fees',permission:'full_access'}],circumference:{classIds:['p4'],sections:null,genders:null}};
  h.documents.set('system_users/limited',viewer);
  const preview=await h.service.previewSchoolPayExcess('babra','receipt',viewer);
  assert.equal(preview.siblings.length,0);
  await assert.rejects(h.service.previewSchoolPayExcess('brother','receipt',viewer),/outside your Circumference/);
  h.documents.set('system_users/limited',{...viewer,circumference:{...viewer.circumference,classIds:null}});
  const all=await h.service.previewSchoolPayExcess('babra','receipt',viewer);
  assert.equal(all.siblings.length,1);
  h.documents.set('system_users/limited',{...viewer,isActive:false});
  await assert.rejects(h.service.transferSchoolPayExcess({pupilId:'babra',receipt:'receipt',target:'brother',version:all.version,operationId:'limited-user-test'}, {id:'limited',name:'Limited',role:'Staff'}, viewer),/access has changed/);
  assert.equal(h.documents.get('payments/future').reverted,undefined);
});
