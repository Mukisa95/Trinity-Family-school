import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildReportSection,validPayments } from '@/lib/reports/report-analysis';
import { REPORT_SECTIONS,reportPeriod,reportDate,requiredReportSources,permittedReportSections,canPrintFeesCollectionReport,type ReportData } from '@/lib/reports/report-model';
import { generateSchoolReportPdf } from '@/lib/reports/report-pdf';
import { reportFixture as data,reportYear } from './fixtures/report-center';
import type { SystemUser } from '@/types';
const period=reportPeriod(reportYear,'three');
const figure=(id:Parameters<typeof buildReportSection>[0],label:string,input=data)=>buildReportSection(id,input,period,new Date('2026-10-20')).metrics.find(item=>item.label===label)?.value;
test('cash statement excludes reversed, duplicate and out-of-range receipts; savings and tracking are not income',()=>{
 assert.equal(figure('finance','Recorded fee receipts'),300000);assert.equal(figure('finance','Recorded expenditure'),110000);assert.equal(figure('finance','Receipts less expenditure'),190000);
 assert.equal(figure('banking','Recorded pupil savings'),1000000);
});
test('fee collections retain academic allocations paid outside term dates without double counting IDs',()=>{
 assert.equal(figure('fees','Payments listed for the term'),120000);assert.equal(figure('fees','Fees still unpaid'),200000);assert.equal(validPayments(data.payments).length,2);
 assert.equal(buildReportSection('fees',data,period).tables.find(table=>table.title==='What was the money paid for?')?.rows[0][0],'Tuition');
});
test('missing historical assessments are marked incomplete instead of showing fabricated school totals',()=>{
 const input={...data,assessments:{...data.assessments,missingHistorical:1}};assert.equal(figure('fees','Fees pupils are expected to pay',input),'Not complete');assert.match(buildReportSection('fees',input,period).summary||'',/saved details for an earlier term are missing/);
});
test('full-year assessments stay separated by term instead of inventing one annual invoice',()=>{assert.equal(buildReportSection('fees',data,reportPeriod(reportYear,'')).metrics.find(metric=>metric.label==='Fees pupils are expected to pay')?.value,'See each term below');});
test('attendance denominator uses marked pupil-days and includes late attendance',()=>{assert.equal(figure('attendance','Recorded attendance rate'),50);assert.equal(figure('attendance','Attendance records'),4);});
test('academic averages normalize valid scores and preserve zero while excluding missed scores',()=>{
 assert.equal(figure('academics','Recorded subject scores'),2);assert.equal(figure('academics','Subject-score pass rate'),50);
 assert.equal(buildReportSection('academics',data,period).tables.find(table=>table.title==='Subject performance')?.rows[0][2],37.5);
});
test('pending/rejected purchases and annual plans do not distort term procurement totals',()=>{assert.equal(figure('procurement','Recorded purchasing cost'),80000);assert.equal(figure('procurement','Active budget plans'),100000);});
test('stock metrics count affected items without summing unlike stock units',()=>{assert.equal(figure('inventory','At / below reorder'),1);assert.equal(figure('inventory','Active stock items'),2);});
test('school-day boundaries use Kampala time for timestamps and preserve date-only values',()=>{
 assert.equal(reportDate('2026-10-19T22:00:00Z'),'2026-10-20');assert.equal(reportDate('2026-10-20'),'2026-10-20');assert.equal(reportDate({_seconds:Date.parse('2026-10-19T22:00:00Z')/1000}),'2026-10-20');assert.equal(reportDate('invalid'),'');
});
test('report sections require their own component permissions, not just Reports access',()=>{
 const user={id:'staff',role:'Staff',isActive:true,granularPermissions:[{moduleId:'reports',pages:[{pageId:'reports',canAccess:true,actions:[]}]}]} as SystemUser;
 assert.deepEqual(permittedReportSections(user),[]);assert.equal(permittedReportSections({...user,role:'Admin'}).length,14);assert.deepEqual(permittedReportSections({...user,role:'Parent'}),[]);
 assert.deepEqual(requiredReportSources(['payroll']),['payroll']);assert.equal(new Set(requiredReportSources(['finance','payroll'])).size,3);
});
test('collection printing requires analytics access plus a collection or existing Reports print grant',()=>{
 const staff={id:'staff',role:'Staff',isActive:true,granularPermissions:[{moduleId:'fees',pages:[{pageId:'analytics',canAccess:true,actions:[]}]}]} as SystemUser;
 assert.equal(canPrintFeesCollectionReport(staff),false);
 const collectionGrant=structuredClone(staff);collectionGrant.granularPermissions![0].pages[0].actions.push({actionId:'print_reports',allowed:true});assert.equal(canPrintFeesCollectionReport(collectionGrant),true);
 const reportGrant=structuredClone(staff);reportGrant.granularPermissions!.push({moduleId:'reports',pages:[{pageId:'reports',canAccess:true,actions:[{actionId:'print_reports',allowed:true}]}]});assert.equal(canPrintFeesCollectionReport(reportGrant),true);
 reportGrant.granularPermissions![0].pages[0].canAccess=false;assert.equal(canPrintFeesCollectionReport(reportGrant),false);
 assert.equal(canPrintFeesCollectionReport({...collectionGrant,role:'Parent'}),false);assert.equal(canPrintFeesCollectionReport(null),false);
});
test('every component produces finite figures, source notes and supporting tables',()=>{
 for(const definition of REPORT_SECTIONS){const report=buildReportSection(definition.id,data,period);assert.ok(report.tables.length);assert.ok(report.notes.length);for(const item of report.metrics)assert.ok(typeof item.value==='string'||Number.isFinite(item.value));}
});
test('empty successful sources produce valid zero reports, with no NaN or Infinity',()=>{
 const empty=Object.fromEntries(Object.keys(data).map(key=>[key,Array.isArray(data[key as keyof ReportData])?[]:key==='assessments'?{rows:[],missingHistorical:0}:{totalAmount:0,paymentCount:0,staffPaidCount:0,paymentMethods:[],byStaff:[]}])) as ReportData;
 for(const definition of REPORT_SECTIONS)assert.doesNotMatch(JSON.stringify(buildReportSection(definition.id,empty,period)),/NaN|Infinity/);
});
test('PDF contains actual component pages and clickable contents, including tables spanning pages',()=>{
 const sections=REPORT_SECTIONS.map(section=>buildReportSection(section.id,data,period));
 sections.find(section=>section.id==='procurement')!.tables.push({title:'Long audit register',columns:['Reference','Description','Amount'],rows:Array.from({length:160},(_,index)=>[`REF-${index+1}`,`Verified sample line ${index+1} with a longer description for pagination`,(index+1)*100]),moneyColumns:[2],detail:true});
 const pdf=generateSchoolReportPdf({title:'School management report',schoolName:'Trinity Family School',period,generatedAt:'2026-10-20T12:00:00Z',preparedBy:'QA sample - synthetic records',sections,includeDetails:true});
 const commands=String(pdf.internal.pages);assert.ok(commands.includes('REF-160'));assert.ok(commands.includes('Long audit register'));assert.ok(pdf.getNumberOfPages()>1);fs.mkdirSync('output/pdf',{recursive:true});fs.writeFileSync('output/pdf/school-management-report-sample.pdf',Buffer.from(pdf.output('arraybuffer')));
 const subset=generateSchoolReportPdf({title:'Financial report',schoolName:'Trinity Family School',period,generatedAt:'2026-10-20T12:00:00Z',preparedBy:'QA sample',sections:sections.filter(section=>section.id==='finance'),includeDetails:false});assert.ok(String(subset.internal.pages).includes('Income & expenditure'));assert.equal(subset.internal.getPageInfo(1).pageContext.annotations.filter((entry:{type:string})=>entry.type==='link').length,1);fs.writeFileSync('output/pdf/selected-financial-report-sample.pdf',Buffer.from(subset.output('arraybuffer')));
 assert.throws(()=>generateSchoolReportPdf({title:'Empty',schoolName:'School',period,generatedAt:'2026-10-20',preparedBy:'Test',sections:[],includeDetails:false}),/Choose/);
});
