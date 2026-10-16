import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { schoolPayReceiptSummary } from '../src/lib/utils/schoolpay-excess';
import { createHash } from 'node:crypto';
import type { AcademicYear, FeeStructure, PaymentRecord, Pupil, PupilTermSnapshot, FeesHoliday } from '../src/types';
import { calculateFeeBalancesAfterDiscounts } from '../src/lib/utils/fee-discount-calculation';
import { hasValidFeeAssignment } from '../src/lib/utils/fee-assignment-pipeline';
import { isFeeApplicableInYear } from '../src/lib/utils/fee-applicability';
import { schoolPayHistoricalPupil, schoolPayTermSlots, schoolPayApplicableFees } from '../src/lib/utils/schoolpay-allocation';

const years = [2025, 2026, 2027].map(n => ({ id: `y${n}`, name: String(n), startDate: `${n}-01-01`, endDate: `${n}-12-31`, terms: [1, 2, 3].map(t => ({ id: `${n}-t${t}`, name: `Term ${t}`, startDate: `${n}-${['01','05','09'][t-1]}-01`, endDate: `${n}-${['04-30','08-31','12-31'][t-1]}` })) })) as AcademicYear[];
const pupil = { id: 'p1', firstName: 'Test', lastName: 'Pupil', classId: 'p4', section: 'Day', status: 'Active', registrationDate: '2026-01-20' } as Pupil;
const tuition = { id: 'tuition', name: 'Tuition', amount: 100, status: 'active', isRequired: true } as FeeStructure;
const origin = { year: years[1], term: years[1].terms[1], allAcademicYears: years };
const pay = (termId: string, amount: number, extra = {}) => ({ id: `paid-${termId}`, pupilId: pupil.id, feeStructureId: tuition.id, academicYearId: `y${termId.slice(0,4)}`, termId, amount, ...extra }) as PaymentRecord;

function loadService(fees = [tuition], snapshots: PupilTermSnapshot[] = [], holidays: FeesHoliday[] = []) {
  let saved: any[] = [];
  const pushes: any[] = [];
  let operationId = '';
  let snapshotReads = 0;
  const output = ts.transpileModule(fs.readFileSync('src/lib/services/schoolpay-integration.service.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} as any };
  vm.runInNewContext(output, { module: mod, exports: mod.exports, console, require(name: string) {
    if (name.endsWith('/push-notifications')) return { getFeesAccessUserIdsAdmin: async () => ['staff'], getServerPushSubscriptionsForUsers: async () => [{}], sendServerWebPush: async (_subscriptions: any, payload: any) => { pushes.push(payload); return { accepted: 1 }; } };
    if (name.endsWith('/notification-automation')) return { getNotificationAutomationSettings: async () => ({}) };
    if (name.endsWith('/automation-settings')) return { isNotificationAutomationEnabled: () => true, resolveAutomatedNotificationRecipientIds: () => ['staff'] };
    if (name === 'crypto') return { createHash };
    if (name === 'firebase-admin/firestore') return { getFirestore: () => ({ collection: () => ({ where: () => ({ get: async () => { snapshotReads++; return { docs: snapshots.map(s => ({id:s.id,data:()=>s})) }; } }) }) }) };
    if (name.endsWith('/firebase-admin')) return { getFirebaseAdminApp: () => ({}) };
    if (name.endsWith('/schoolpay-excess')) return { schoolPayReceiptSummary };
    if (name.endsWith('/schoolpay-allocation')) return { schoolPayHistoricalPupil, schoolPayTermSlots, schoolPayApplicableFees };
    if (name.endsWith('/fee-applicability')) return { isFeeApplicableInYear };
    if (name.endsWith('/fee-discount-calculation')) return { calculateFeeBalancesAfterDiscounts };
    if (name.endsWith('/fee-assignment-pipeline')) return { hasValidFeeAssignment };
    if (name.endsWith('/name-formatter')) return { formatPupilDisplayName: () => 'Test Pupil' };
    if (name.endsWith('/fee-structures.service')) return { FeeStructuresService: { getAllFeeStructures: async () => fees } };
    if (name.endsWith('/fees-holiday.service')) return { FeesHolidayService: { getActiveFeesHolidaysByPupil: async () => holidays } };
    if (name.endsWith('/payments.service')) return { PaymentsService: { createPaymentOperation: async (id: string, allocations: any[]) => { operationId=id; saved=allocations.map(a=>a.paymentData); return {paymentIds:saved.map((_,i)=>`new-${i}`)}; } } };
    return {};
  }});
  return { pushes, notify: (options: any) => mod.exports.SchoolPayIntegrationService.sendSchoolPayPushNotification(options), async allocate(amount: number, payments: PaymentRecord[] = [], person = pupil, slot = origin) {
    const result = await mod.exports.SchoolPayIntegrationService.recordSchoolFeesPayment({amount,schoolpayReceiptNumber:'receipt-1',paymentDateAndTime:'2026-06-01T10:00:00Z'},person,slot,payments);
    assert.equal(saved.reduce((sum,p)=>sum+p.amount,0),amount);
    assert.match(operationId,/^schoolpay-[a-f0-9]{64}$/);
    return { saved, result, snapshotReads };
  }};
}

test('automatic SchoolPay allocation clears oldest arrears, then current, then future terms', async () => {
  const {saved} = await loadService().allocate(250,[pay('2026-t1',40)]);
  assert.deepEqual(Array.from(saved,p=>[p.termId,p.amount]),[['2026-t1',60],['2026-t2',100],['2026-t3',90]]);
  assert.equal(saved[0].schoolPayOriginTermId,'2026-t2');
});
test('older years are visited chronologically when the pupil was enrolled', async () => {
  const {saved} = await loadService().allocate(120,[],{...pupil,registrationDate:'2025-10-01'});
  assert.deepEqual(Array.from(saved,p=>[p.academicYearId,p.termId,p.amount]),[['y2025','2025-t3',100],['y2026','2026-t1',20]]);
});
test('settled current term does not prevent paying arrears or later terms', async () => {
  const {saved} = await loadService().allocate(150,[pay('2026-t2',100)]);
  assert.deepEqual(Array.from(saved,p=>[p.termId,p.amount]),[['2026-t1',100],['2026-t3',50]]);
});
test('no fees in current term still permits future-year allocation and records remaining excess', async () => {
  const {saved} = await loadService([{...tuition,effectiveYears:['y2027']}]).allocate(350);
  assert.deepEqual(Array.from(saved,p=>[p.academicYearId,p.termId,p.amount]),[['y2027','2027-t1',100],['y2027','2027-t2',100],['y2027','2027-t3',100],['y2026','2026-t2',50]]);
  assert.equal(saved[3].feeStructureId,'schoolpay-general');
});
test('discounts, holidays, reverted payments and existing future payments affect automatic balances', async () => {
  const discount = {...tuition,id:'discount',category:'Discount',amount:-25,linkedFeeIds:[tuition.id]} as FeeStructure;
  const person = {...pupil,assignedFees:[{id:'discount-assignment',feeStructureId:'discount',assignedAt:'2026-01-01',status:'active',validityType:'indefinite',startAcademicYearId:'y2026',termApplicability:'all_terms'}]} as Pupil;
  const {saved} = await loadService([tuition,discount]).allocate(170,[pay('2026-t1',75),pay('2026-t2',100,{reverted:true}),pay('2026-t3',55)],person);
  assert.deepEqual(Array.from(saved,p=>[p.termId,p.amount]),[['2026-t2',75],['2026-t3',20],['2027-t1',75]]);
  const holiday = {id:'holiday',pupilId:pupil.id,isActive:true,categories:['required'],discountType:'full',createdAt:'2026-01-01',academicYearId:'y2026',termId:'2026-t1'} as FeesHoliday;
  const result = await loadService([tuition],[],[holiday]).allocate(50);
  assert.equal(result.saved[0].termId,'2026-t2');
});
test('previous-term class and section use authoritative saved snapshots', async () => {
  const previousFee = {...tuition,id:'p3-boarding',amount:80,classFeeType:'specific',classIds:['p3'],sectionFeeType:'specific',section:'Boarding'} as FeeStructure;
  const snapshot = {id:'snap',pupilId:pupil.id,academicYearId:'y2026',termId:'2026-t1',classId:'p3',section:'Boarding'} as PupilTermSnapshot;
  const {saved,snapshotReads} = await loadService([previousFee, {...tuition,classFeeType:'specific',classIds:['p4']} as FeeStructure],[snapshot]).allocate(100);
  assert.deepEqual(Array.from(saved,p=>[p.feeStructureId,p.termId,p.amount]),[['p3-boarding','2026-t1',80],['tuition','2026-t2',20]]);
  assert.equal(snapshotReads,1);
});
test('inactive and pre-registration terms cannot become arrears', async () => {
  const person = {...pupil,registrationDate:'2026-01-20',statusChangeHistory:[{date:'2026-04-01',fromStatus:'Inactive',toStatus:'Active'}]} as Pupil;
  const {saved} = await loadService().allocate(50,[],person);
  // Activated before term end, so term one is eligible.
  assert.equal(saved[0].termId,'2026-t1');
  const later = await loadService().allocate(50,[],{...person,statusChangeHistory:[{date:'2026-05-01',fromStatus:'Inactive',toStatus:'Active'}]});
  assert.equal(later.saved[0].termId,'2026-t2');
});
test('historical class can be recovered from promotion history when a snapshot is absent', () => {
  const person = {...pupil,promotionHistory:[{date:'2026-05-01',fromClassId:'p3',toClassId:'p4'}]} as Pupil;
  assert.equal(schoolPayHistoricalPupil(person,years[1],years[1].terms[0],[]).classId,'p3');
  assert.equal(schoolPayHistoricalPupil(person,years[1],years[1].terms[1],[]).classId,'p3');
  assert.equal(schoolPayHistoricalPupil(person,years[1],years[1].terms[2],[]).classId,'p4');
});


test('excess push explains the future allocation and opens the receiving pupil fees page', async () => {
  const service = loadService();
  await service.notify({ receiptNumber: 'receipt 1', pupilId: 'babra', pupilName: 'Babra', amount: 700000, breakdown: [], source: 'webhook',
    excessSummary: { appliedThroughOrigin: 400000, excessAmount: 300000, futureAmount: 300000, advanceAmount: 0, futureTerms: ['Term 1 2027'] } });
  assert.equal(service.pushes.length, 1);
  const payload = service.pushes[0];
  assert.match(payload.title, /Exceeds Current Balance/);
  for (const expected of ['700,000', '400,000', '300,000', 'pushed to Term 1 2027', 'Take a look']) assert.ok(payload.body.includes(expected));
  assert.equal(payload.url, '/fees/collect/babra?schoolpay=receipt%201');
  assert.equal(payload.tag, 'schoolpay-receipt-receipt 1');
});
test('normal matched push opens pupil fees, unmatched push opens mapping feed, backfills stay silent', async () => {
  const service = loadService();
  const base = { receiptNumber: 'receipt', pupilId: 'babra', pupilName: 'Babra', amount: 300000, breakdown: [], source: 'webhook' };
  await service.notify(base);
  assert.equal(service.pushes[0].url, '/fees/collect/babra?schoolpay=receipt');
  await service.notify({ ...base, mappingRequired: true, paymentCode: 'code' });
  assert.equal(service.pushes[1].url, '/accounts/schoolpay-feed');
  await service.notify({ ...base, source: 'sync' });
  assert.equal(service.pushes.length, 2);
});
