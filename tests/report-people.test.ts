import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReportSection } from '@/lib/reports/report-analysis';
import { reportPeriod } from '@/lib/reports/report-model';
import { reportYear } from './fixtures/report-center';
import { peopleReportFixture } from './fixtures/report-people';
const now=new Date('2026-10-20T12:00:00Z'),period=reportPeriod(reportYear,'three');
const metric=(report:ReturnType<typeof buildReportSection>,label:string)=>report.metrics.find(item=>item.label===label)?.value;
test('current pupil cards, class totals, composition and age groups agree with the example counts',()=>{
 const data=peopleReportFixture(),report=buildReportSection('enrollment',data,period,now);
 assert.equal(metric(report,'Current active pupils'),735);assert.equal(metric(report,'Classes'),10);assert.equal(metric(report,'Boarding pupils'),94);assert.equal(metric(report,'Registrations in selected dates'),22);
 const table=report.tables.find(table=>table.title==='Pupils by class')!;
 assert.deepEqual(table.total,['Total',735,357,378,641,94]);assert.equal(table.rows.reduce((sum,row)=>sum+Number(row[1]),0),735);
 const levels=report.tables.find(table=>table.title==='Pupils by school level')!;assert.deepEqual(levels.rows.map(row=>row.slice(0,2)),[['Nursery',194],['Primary',541]]);
 assert.deepEqual(report.tables.find(table=>table.title==='Age groups')!.rows.map(row=>row[1]),[145,208,203,169,10,0]);
 assert.match(report.insights.join(' '),/P.5 has the most pupils \(93\)/);assert.match(report.insights.join(' '),/P.3 has the fewest.*\(54\)/);
 assert.equal(report.charts?.[0].centerValue,'12.79%');
});
test('registration dates are not first admissions or growth, and future registrations are excluded',()=>{
 const data=peopleReportFixture();data.pupils[0].registrationDate='2026-12-01';data.pupils[1].registrationDate='2026-10-19T22:00:00Z';
 const report=buildReportSection('enrollment',data,period,now);
 assert.equal(metric(report,'Registrations in selected dates'),21);assert.match(report.summary!,/registration is not proof/);
 const register=report.tables.find(table=>table.title==='Registrations in selected dates')!;assert.equal(register.rows.length,21);
 assert.match(register.description!,/registration date, not first attendance or approval/);
 const history=report.tables.find(table=>table.title==='What can we say about growth?')!;assert.ok(history.rows.every(row=>row[1]==='Not available'));
 assert.match(report.insights.join(' '),/do not tell us how many pupils left or graduated/);
});
test('duplicate pupil IDs do not add pupils, and missing classes and demographics still reconcile',()=>{
 const data=peopleReportFixture();data.pupils.push(data.pupils[0]);data.pupils[1]={...data.pupils[1],classId:'missing',gender:undefined,section:''} as any;
 const report=buildReportSection('enrollment',data,period,now),table=report.tables.find(table=>table.title==='Pupils by class')!;
 assert.equal(metric(report,'Current active pupils'),735);assert.equal(table.rows.reduce((sum,row)=>sum+Number(row[1]),0),735);assert.ok(table.rows.some(row=>row[0]==='Class not found'&&row[1]===1));
 assert.ok(report.tables.find(table=>table.title==='Pupil record checks')!.rows.some(row=>row[0]==='Repeated pupil record IDs'&&row[1]===1));
 assert.ok(report.tables.find(table=>table.title==='Pupils by school level')!.rows.some(row=>row[0]==='Level not shown'&&row[1]===1));
});
test('a future period is not presented as a completed zero-admissions period',()=>{
 const year={...reportYear,terms:[{...reportYear.terms[0],startDate:'2100-01-01',endDate:'2100-04-30'}]};
 const report=buildReportSection('enrollment',peopleReportFixture(),reportPeriod(year,year.terms[0].id),now);
 assert.equal(metric(report,'Registrations in selected dates'),'Period not started');assert.match(report.summary!,/has not started/);
});
test('future and impossible birth dates are not valid ages; school day controls birthday boundaries',()=>{
 const data=peopleReportFixture();data.pupils[0].dateOfBirth='2026-10-21';data.pupils[1].dateOfBirth='2014-02-30';data.pupils[2].dateOfBirth='2014-10-20';
 const report=buildReportSection('enrollment',data,period,new Date('2026-10-19T22:00:00Z'));
 assert.equal(report.tables.find(table=>table.title==='Age groups')!.rows.at(-1)?.[1],2);assert.equal(report.asOf,'2026-10-20');
});
test('staff headcount is distinct and role assignments never become a teacher ratio',()=>{
 const data=peopleReportFixture(),report=buildReportSection('staff',data,period,now);
 assert.equal(metric(report,'Staff records'),20);assert.equal(metric(report,'Marked active'),17);assert.equal(metric(report,'Marked inactive'),3);assert.equal(metric(report,'On leave'),0);
 const roles=report.tables.find(table=>table.title==='How staff are assigned')!;assert.deepEqual(roles.rows.find(row=>row[0]==='Teacher'),['Teacher',19,16]);
 assert.equal(report.tables.find(table=>table.title==='Departments')!.rows.find(row=>row[0]==='Teaching')?.[1],20);
 assert.deepEqual(report.tables.find(table=>table.title==='Employment arrangements')!.rows.map(row=>row[1]),[18,1,1]);
 assert.ok(report.tables.find(table=>table.title==='What can we say about staffing changes?')!.rows.every(row=>row[1]==='Not available'));
});
test('staff with duplicate roles or identities, on leave or unknown status are kept distinct',()=>{
 const data=peopleReportFixture();data.staff[0].role.push('Teacher',' Teacher ');data.staff.push(data.staff[0]);data.staff[1].status='onLeave';data.staff[2].status=undefined;
 const report=buildReportSection('staff',data,period,now);assert.equal(metric(report,'Staff records'),20);assert.equal(metric(report,'Marked active'),15);assert.equal(metric(report,'On leave'),1);
 assert.equal(report.tables.find(table=>table.title==='How staff are assigned')!.rows.find(row=>row[0]==='Teacher')?.[1],19);
 assert.match(report.insights.join(' '),/Missing status is shown as unknown/);
});
test('optional pupil and staff lists expose no phone, birth date, national ID or medical detail',()=>{
 const data=peopleReportFixture();data.staff[0].nationalId='PRIVATE ID';data.staff[0].medicalConditions=['PRIVATE MEDICAL'];
 for(const id of ['enrollment','staff'] as const){const report=buildReportSection(id,data,period,now),details=JSON.stringify(report.tables.filter(table=>table.detail));assert.doesNotMatch(details,/SAMPLE CONTACT|PRIVATE ID|PRIVATE MEDICAL|2021-01-01/);}
});
