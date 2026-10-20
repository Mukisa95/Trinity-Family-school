import test from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import { preparePdfReportTable } from '@/lib/reports/report-pdf-table';
import { generateSchoolReportPdf } from '@/lib/reports/report-pdf';
import { drawReportCallout,drawReportCharts } from '@/lib/reports/report-pdf-visuals';
import type { ReportTable } from '@/lib/reports/report-model';
import { reportPdfLayoutFixture } from './fixtures/report-pdf-layout';

const pickup=(rows:ReportTable['rows']):ReportTable=>({title:'Fully paid orders still to check for pickup',columns:['Pupil','Reference','Uniform','Size','Ordered','Collected','Needed','Paid date','Pickup date'],rows});
test('pickup grouping keeps every item, raw reference and zero quantity without confusing missing values with zero',()=>{
  const reference='FULL-UNTRUNCATED-ORDER-REFERENCE-123456789';
  const input=pickup([['Pupil A',reference,'Shirt','M',2,0,2,'2026-10-01','Not shown'],['Pupil A',reference,'Shirt','M',2,0,2,'2026-10-01','Not shown'],['Pupil A',reference,'Shorts','Not shown','Not shown','Not shown','Not shown','2026-10-01','Not shown'],['Pupil B',reference,'Dress','L',1,0,1,'Not shown','Not shown']]);
  const original=structuredClone(input),result=preparePdfReportTable(input);
  assert.equal(result.rows.length,2);assert.equal(result.rows[0][1],reference);assert.equal(String(result.rows[0][2]).split('\n').length,3);
  assert.match(String(result.rows[0][2]),/collected: 0/);assert.match(String(result.rows[0][2]),/Shorts; size: not shown; ordered: not shown; collected: not shown/);
  assert.deepEqual(input,original);assert.ok(!result.columns.includes('Expected pickup'));assert.match(result.description!,/expected pickup dates/);
});
test('empty pickup fields become one explicit note, while unknown order IDs never merge records',()=>{
  const result=preparePdfReportTable(pickup([['A','Not shown','Shirt',...Array(6).fill('Not shown')],['A','Not shown','Shorts',...Array(6).fill('Not shown')]]));
  assert.equal(result.columns.length,3);assert.equal(result.rows.length,2);assert.match(result.description!,/ordered quantities/);assert.match(result.description!,/collected quantities/);assert.doesNotMatch(result.rows[0][2] as string,/0/);
});
test('school-sized PDF flows compactly and keeps every order, item, final table row and clickable section destination',()=>{
  const pdf=generateSchoolReportPdf(reportPdfLayoutFixture());
  assert.ok(pdf.getNumberOfPages()<=10,`Expected a compact school report, received ${pdf.getNumberOfPages()} pages`);
  const pages=Array.from({length:pdf.getNumberOfPages()},(_,i)=>String(pdf.internal.pages[i+1]));
  const commands=pages.join('\n');
  const written=[...commands.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map(match=>match[1]).join('');
  for(let order=1;order<=19;order++)assert.ok(written.includes(`ORDER-REFERENCE-${String(order).padStart(5,'0')}`));
  assert.equal((commands.match(/School shirt/g)||[]).length,19);assert.equal((commands.match(/School shorts/g)||[]).length,19);
  assert.ok(commands.includes('Payment purpose 17'));assert.ok(commands.includes('Payment checks'));
  const links=pdf.internal.getPageInfo(1).pageContext.annotations.filter((item:{type:string})=>item.type==='link');
  assert.equal(links.length,2);
  for(const link of links){const page=link.options.pageNumber;assert.ok(page>=1&&page<=pages.length);}
  assert.ok(pages[links[1].options.pageNumber-1].includes('(Uniforms)'));
});
test('a lone donut uses a shallow full-width card and long commentary remains complete across pages',()=>{
  const pdf=new jsPDF({unit:'mm'});
  const end=drawReportCharts(pdf,[{kind:'donut',title:'Pickup progress',description:'Saved status',items:[{label:'Waiting',value:19},{label:'Collected',value:3}]}],30);
  assert.ok(end-30<65);assert.equal(pdf.getNumberOfPages(),1);
  const paragraphs=Array.from({length:30},(_,i)=>`Paragraph ${i+1}: Check these recorded totals and the supporting school records before following up.`);
  drawReportCallout(pdf,'Checks',paragraphs,240);
  const commands=String(pdf.internal.pages);assert.ok(commands.includes('Paragraph 1:'));assert.ok(commands.includes('Paragraph 30:'));assert.ok(pdf.getNumberOfPages()>1);
});
test('a short chart uses remaining page space when its taller neighbour must continue on the next page',()=>{
  const pdf=new jsPDF({unit:'mm'});
  drawReportCharts(pdf,[{kind:'donut',title:'Short chart',description:'Two groups',items:[{label:'Paid',value:27},{label:'Unpaid',value:73}]},{kind:'bar',title:'Long chart',description:'All listed groups',items:Array.from({length:8},(_,i)=>({label:`Group ${i+1}`,value:i+1}))}],200);
  assert.ok(String(pdf.internal.pages[1]).includes('Short chart'));assert.ok(String(pdf.internal.pages[2]).includes('Long chart'));assert.ok(String(pdf.internal.pages[2]).includes('Group 8'));
});
