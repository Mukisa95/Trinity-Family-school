import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReportSection } from '@/lib/reports/report-analysis';
import { reportPeriod, formatReportValue, type ReportData } from '@/lib/reports/report-model';
import { reportFixture, reportYear } from './fixtures/report-center';

const period=reportPeriod(reportYear,'three'),now=new Date('2026-10-20T12:00:00Z');
const build=(id:'fees'|'uniforms',data=reportFixture)=>buildReportSection(id,data,period,now);
const table=(report:ReturnType<typeof build>,title:string)=>report.tables.find(item=>item.title===title)!;

test('fee summary uses checked live amounts and explains the percentage in everyday words',()=>{
 const data={...reportFixture,assessments:{rows:[{...reportFixture.assessments.rows[0],assessed:221850000,paid:58626000,balance:163224000}],missingHistorical:0}};
 const report=build('fees',data);
 assert.match(report.summary!,/221,850,000.*58,626,000.*163,224,000/);
 assert.match(report.summary!,/26 out of every 100 shillings/);
 assert.equal(report.metrics.find(item=>item.label==='How much has been paid')?.value,26.43);
 assert.equal(formatReportValue(26.43,'percent'),'26.43%');
 assert.match(report.insights.join(' '),/Unpaid does not always mean late/);
 assert.ok(report.actions?.some(action=>action.startsWith('Bursar:')));
 assert.doesNotMatch(JSON.stringify(report),/Allocated collections|Assessed positive balances|receivables|concessions/);
});

test('payment differences subtract only records confirmed outside the main fee list',()=>{
 const payment=reportFixture.payments[0];
 const data={...reportFixture,payments:[payment,{...payment,id:'old',feeStructureId:'previous-balance',amount:5000},{...payment,id:'uni',feeStructureId:'uniform-order1',amount:3000},{...payment,id:'other',feeStructureId:'schoolpay-general',amount:2000}]};
 const report=build('fees',data),difference=table(report,'Why do the payment totals differ?');
 assert.equal(difference.rows.at(-1)?.[1],2000);
 assert.equal(table(report,'What was the money paid for?').rows.find(row=>row[0]==='Uniforms')?.[1],3000);
 assert.match(difference.description!,/not proof of missing money/);
 assert.equal(table(report,'Full pupil payment list').rows.length,4);
 assert.deepEqual(table(report,'Full pupil payment list').total,['','Total','','','','',110000]);
 // A known old-fee payment already used by the fee engine must not be subtracted again.
 data.assessments={rows:[{...data.assessments.rows[0],paid:105000,paymentIds:['pay1','old']}],missingHistorical:0};
 assert.equal(table(build('fees',data),'Why do the payment totals differ?').rows.at(-1)?.[1],2000);
});

test('unlinked or incomplete fee records leave the difference unchecked, not a guessed adjustment',()=>{
 const row={...reportFixture.assessments.rows[0],paymentIds:undefined};
 assert.equal(table(build('fees',{...reportFixture,assessments:{rows:[row],missingHistorical:0}}),'Why do the payment totals differ?').rows.at(-1)?.[1],'Not yet checked');
 const report=build('fees',{...reportFixture,assessments:{rows:[row],missingHistorical:1}});
 assert.equal(report.metrics[0].value,'Not complete');assert.match(report.summary!,/not complete/);
 assert.match(table(report,'Full list of fees still unpaid').description!,/not a complete school list/);
});

test('unpaid bands and totals use every pupil-term entry without offsetting extra payments',()=>{
 const first=reportFixture.assessments.rows[0];
 const balances=[50000,50001,200000,200001,400000,400001];
 const rows=balances.map((balance,i)=>({...first,pupilId:'p'+i,balance,extra:i===0?10000:0}));
 const report=build('fees',{...reportFixture,assessments:{rows,missingHistorical:0}}),bands=table(report,'How large are the unpaid amounts?');
 assert.deepEqual(bands.rows.map(row=>row[1]),[1,2,2,1]);
 assert.equal(bands.total?.[2],1300003);assert.equal(table(report,'Full list of fees still unpaid').rows.length,6);
 assert.equal(report.metrics.find(item=>item.label==='Extra money on fee items')?.value,10000);
});

test('term class records and current classes are labelled separately; matching admission numbers do not merge pupils',()=>{
 const p1=reportFixture.pupils[0],p2={...reportFixture.pupils[1],admissionNumber:p1.admissionNumber};
 const report=build('fees',{...reportFixture,pupils:[p1,p2]});
 assert.equal(table(report,'Pupil details to check').rows.length,1);
 assert.match(report.insights.join(' '),/not proof of duplicate payment/);
 assert.equal(table(report,'Payments listed by current class').rows[0][1],2);
 assert.equal(report.tables[0].columns[0],'Class in fee list');
});

test('cancelled and out-of-date entries show counts and amounts; incomplete months are clearly named',()=>{
 const report=build('fees'),checks=table(report,'Payment entries to check');
 assert.deepEqual(checks.rows[0].slice(1),[1,50000]);
 assert.deepEqual(checks.rows[2].slice(1),[1,20000]);
 const monthly=table(report,'When were the payments made?');
 assert.match(String(monthly.rows[0][0]),/October 2026 - month still in progress/);
 assert.match(String(monthly.rows[1][0]),/dated after this report/);
 assert.equal(monthly.total?.[1],120000);
});

test('whole-year class tables remain separated by term with no invented annual bill',()=>{
 const report=buildReportSection('fees',reportFixture,reportPeriod(reportYear,''),now);
 assert.equal(report.metrics[0].value,'See each term below');
 assert.equal(report.tables.filter(table=>table.title.startsWith('Which classes')).length,2);
});

test('uniform money keeps family debts separate from extra payments and exposes the arithmetic',()=>{
 const base=reportFixture.uniforms[0];
 const data={...reportFixture,uniforms:[{...base,id:'over',finalAmount:90000,paidAmount:100000,paymentStatus:'paid' as const},{...base,id:'under',finalAmount:100000,paidAmount:20000}]};
 const report=build('uniforms',data),money=table(report,'Uniform money: what has been paid?');
 assert.equal(report.metrics.find(item=>item.label==='Still unpaid')?.value,80000);
 assert.equal(report.metrics.find(item=>item.label==='Extra money paid')?.value,10000);
 assert.equal(money.rows[2][1],70000);assert.equal(money.rows.at(-1)?.[1],0);
});

test('paid pickup list uses saved names, sizes and quantities and never guesses a pickup deadline',()=>{
 const base=reportFixture.uniforms[0],order={...base,id:'paid',finalAmount:60000,paidAmount:60000,paymentStatus:'paid' as const,collectionStatus:'partial' as const,selectedSizes:{shirt:'M'},selectedQuantities:{shirt:3},collectedQuantities:{shirt:1},paymentDate:'2026-10-01'};
 const report=build('uniforms',{...reportFixture,uniforms:[order]}),list=table(report,'Fully paid orders still to check for pickup');
 assert.equal(report.metrics.at(-1)?.value,1);
 assert.deepEqual(list.rows[0].slice(2,7),['School shirt','M',3,1,2]);
 assert.equal(list.rows[0].at(-1),'Not shown');assert.match(report.insights[0],/Confirm what was handed over/);
});

test('missing uniform amounts and pickup quantities stay unknown instead of becoming zero',()=>{
 const order={...reportFixture.uniforms[0],finalAmount:undefined} as unknown as ReportData['uniforms'][number];
 assert.equal(build('uniforms',{...reportFixture,uniforms:[order]}).metrics[1].value,'Not complete');
 assert.equal(table(build('uniforms',{...reportFixture,uniforms:[order]}),'Uniform money: what has been paid?').rows[0][1],'Not available');
 const paid={...reportFixture.uniforms[0],paidAmount:60000,paymentStatus:'paid' as const};
 const report=build('uniforms',{...reportFixture,uniforms:[paid]});
 assert.equal(table(report,'Fully paid orders still to check for pickup').rows[0][5],'Not shown');
});

test('uniform fee comparison is shown only when selected fee data is available; lists are never added',()=>{
 const noFees={...reportFixture,payments:undefined} as unknown as ReportData;
 const report=build('uniforms',noFees);
 assert.equal(report.tables.some(table=>table.title==='Do the two uniform payment lists agree?'),false);
 assert.match(report.notes.join(' '),/not included/);
 assert.equal(table(build('uniforms'),'Do the two uniform payment lists agree?').rows.at(-1)?.[1],20000);
});
