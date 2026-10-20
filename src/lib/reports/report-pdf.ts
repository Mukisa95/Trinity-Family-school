import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ReportDocument, ReportTable } from './report-model';
import { formatReportValue, reportDate } from './report-model';
import { drawReportCallout,drawReportCharts,drawReportMetrics,PDF_INK,pdfText } from './report-pdf-visuals';

const ink=PDF_INK,blue:[number,number,number]=[16,35,60];
const text=pdfText;
/** Loaded only when a user requests a PDF. No report dependencies enter the shared shell. */
export function generateSchoolReportPdf(report:ReportDocument):jsPDF {
  if(!report.sections.length)throw new Error('Choose at least one report section.');
  const doc=new jsPDF({unit:'mm',format:'a4',compress:true});
  doc.setProperties({title:text(report.title),subject:text(report.period.label),author:text(report.preparedBy),creator:'Trinity Live Reports'});
  let y=32;
  const line=(value:string,size=10,bold=false)=>{
    doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(...ink);
    const lines=doc.splitTextToSize(text(value),172) as string[];
    const height=size*.42;
    if(bold&&y+height+12>274){doc.addPage();y=29;}
    for(const row of lines){if(y+height>274){doc.addPage();y=29;}doc.text(row,19,y);y+=height;}
    y+=2;
  };
  const table=(table:ReportTable)=>{
    if(table.detail&&!table.rows.length)return;
    // Keep the introduction, column headings and first row together.
    doc.setFont('helvetica','normal');doc.setFontSize(9);
    const introHeight=table.description?doc.splitTextToSize(text(table.description),172).length*3.8+2:0;
    const cellWidth=172/table.columns.length-4.4;
    const rowHeight=(row:(string|number)[])=>Math.max(...row.map(cell=>doc.splitTextToSize(text(cell),cellWidth).length))*3.7+4.4;
    const smallHeight=table.rows.length<=12?table.rows.reduce((total,row)=>total+rowHeight(row),0)+rowHeight(table.columns)+(table.total?rowHeight(table.total):0)+10:23;
    if(y+introHeight+smallHeight>275){doc.addPage();y=29;}
    line(table.title,11,true);
    if(table.description)line(table.description,9);
    const money=new Set(table.moneyColumns||[]);
    const percent=new Set(table.percentColumns||[]);
    const cells=(row:(string|number)[])=>row.map((cell,index)=>text(typeof cell==='number'?formatReportValue(cell,money.has(index)?'money':percent.has(index)||table.columns[index]?.includes('%')?'percent':'number'):cell));
    const rows=table.rows.length?table.rows.map(cells):[table.columns.map((_,index)=>index===0?'No entries in the checked records.':'-')];
    const firstPage=doc.getNumberOfPages();
    autoTable(doc,{startY:y,head:[table.columns.map(text)],body:rows,foot:table.total?[cells(table.total)]:undefined,showFoot:'lastPage',theme:'striped',margin:{left:19,right:19,top:36,bottom:22},
      styles:{font:'helvetica',fontSize:9,cellPadding:2.2,overflow:'linebreak',textColor:ink,lineColor:[226,232,240],lineWidth:0},
      headStyles:{fillColor:blue,textColor:[255,255,255],fontStyle:'bold',fontSize:8.5},alternateRowStyles:{fillColor:[242,247,252]},
      footStyles:{fillColor:[226,244,238],textColor:ink,fontStyle:'bold'},
      columnStyles:Object.fromEntries([...money,...percent].map(index=>[index,{halign:'right' as const}])),pageBreak:table.rows.length<=12?'avoid':'auto',rowPageBreak:'avoid',showHead:'everyPage',
      didDrawPage:()=>{if(doc.getNumberOfPages()>firstPage){doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...ink);doc.text(text(`${table.title} (continued)`).slice(0,105),19,29);}},
    });
    y=(doc as jsPDF & {lastAutoTable?:{finalY:number}}).lastAutoTable!.finalY+6;
  };
  // Put the useful fee summary before the contents and long lists.
  const feeSection=report.sections.find(section=>section.id==='fees'),uniformSection=report.sections.find(section=>section.id==='uniforms'),enrollment=report.sections.find(section=>section.id==='enrollment'),staff=report.sections.find(section=>section.id==='staff');
  const asOf=reportDate(report.generatedAt);
  doc.setFillColor(...blue);doc.rect(0,0,210,39,'F');doc.setFillColor(5,150,145);doc.roundedRect(19,11,13,13,3,3,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(255,255,255);doc.text(report.schoolName.split(/\s+/).slice(0,2).map(word=>word[0]).join(''),25.5,19.5,{align:'center'});
  doc.setFontSize(13);const schoolLines=doc.splitTextToSize(text(report.schoolName),149);doc.text(schoolLines,38,17);
  doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(193,211,230);doc.text('SCHOOL REPORTS  /  CURRENT RECORDS & CLEAR NEXT STEPS',38,31);
  if(report.schoolContact){doc.setFontSize(7);doc.text(text(report.schoolContact),38,36);}
  y=53;line(report.title,24,true);line(report.period.label,13);line(`Records checked on ${asOf} (East Africa time)`,10);y+=3;
  const opening=feeSection||enrollment||staff||uniformSection||report.sections[0];
  if(opening){
    y=drawReportCallout(doc,'Quick summary',[opening.summary||opening.description],y,'blue');
    y=drawReportMetrics(doc,opening.metrics.slice(0,4),y);
    if(enrollment&&staff&&opening===enrollment){const active=staff.metrics.find(metric=>metric.label==='Marked active');if(active)line(`Staff currently marked active: ${formatReportValue(active.value)}. See Staff for roles, contracts and the checks needed before comparing teacher numbers.`,10);}
    if(feeSection&&uniformSection){const waiting=uniformSection.metrics.find(metric=>metric.label==='Fully paid, not fully collected');if(waiting)line(`Uniforms: ${formatReportValue(waiting.value)} fully paid orders are not marked as fully collected. Check the pickup list in the Uniforms section.`,10);}
    if(opening.insights[0])y=drawReportCallout(doc,'What these figures tell us',[opening.insights[0]],y,'green');
  }else{line('Quick summary',12,true);line(`This report includes ${report.sections.length} selected school sections. Each section explains its figures and which records were used.`,10);}
  for(const note of report.notes||[])line(note);
  // The date guide and compact contents share a page for short reports.
  doc.addPage();const contentsPage=doc.getNumberOfPages();
  y=32;line('How to read this report',18,true);
  table({title:'Dates and records',columns:['Question','Answer'],rows:[['Which period is selected?',`${report.period.label}: ${report.period.start} to ${report.period.end}`],['When were the records checked?',`${new Date(report.generatedAt).toLocaleString('en-GB',{timeZone:'Africa/Kampala'})} EAT`],['Had the selected period ended?',asOf<report.period.start?'It had not started.':asOf<=report.period.end?'It was still in progress.':'It had ended.'],['Who prepared this report?',report.preparedBy],['Are full lists included?',report.includeDetails?'Yes. Full lists follow all the summaries.':'No. Select supporting registers in the report builder to include them.']]});
  line('UGX means Ugandan shillings. A missing record is not treated as zero. Current saved figures do not recreate an account on a past day. Each section explains whether it uses term payments, payment dates or current records.',9);
  const contentsY=y+3;
  const entries:{title:string;page:number}[]=[];
  for(const section of report.sections){
    doc.addPage();y=32;const page=doc.getNumberOfPages();entries.push({title:section.title,page});
    if(doc.outline)doc.outline.add(null,text(section.title),{pageNumber:page});
    line(section.title,20,true);line(section.description,10);
    if(section.summary)y=drawReportCallout(doc,'Quick summary',[section.summary],y,'blue');
    y=drawReportMetrics(doc,section.metrics,y);
    if(section.charts?.length)y=drawReportCharts(doc,section.charts,y);
    for(const item of section.tables.filter(table=>!table.detail))table(item);
    if(section.insights.length)y=drawReportCallout(doc,'What these figures tell us',section.insights,y,'blue');
    if(section.actions?.length)y=drawReportCallout(doc,'What to do next',section.actions.map((action,index)=>`${index+1}. ${action}`),y,'green');
    if(section.sources?.length){line('Where the figures came from',11,true);for(const source of section.sources)line(source,9);}
    if(section.notes.length){line('What these figures include',11,true);for(const note of section.notes)line(note,9);}
  }
  if(report.includeDetails){for(const section of report.sections){const lists=section.tables.filter(table=>table.detail&&table.rows.length);if(!lists.length)continue;doc.addPage();y=32;const title=`${section.title} - full lists`,page=doc.getNumberOfPages();entries.push({title,page});if(doc.outline)doc.outline.add(null,text(title),{pageNumber:page});line(title,18,true);for(const list of lists)table(list);}}
  // More than 14 sections plus full lists can need another contents page. Reserve
  // it at the end rather than shifting already numbered report pages.
  doc.setPage(contentsPage);y=contentsY;line('Find a section',14,true);line('Select a section to jump to its pages.',9);y+=2;
  for(const entry of entries){
    if(y>266){doc.addPage();y=32;line('Find a section (continued)',14,true);}
    doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(...blue);doc.text(text(entry.title),19,y);doc.text(String(entry.page),190,y,{align:'right'});
    doc.setDrawColor(226,232,240);doc.line(19,y+3,191,y+3);doc.link(19,y-4,172,9,{pageNumber:entry.page});y+=9;
  }
  const count=doc.getNumberOfPages();
  for(let page=1;page<=count;page++){
    doc.setPage(page);doc.setLineWidth(.2);doc.setDrawColor(226,232,240);doc.line(19,281,191,281);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(100,116,139);
    doc.text(text(report.schoolName).slice(0,65),19,287);doc.setFont('helvetica','bold');doc.text(`${page} / ${count}`,191,287,{align:'right'});
    if(page>1){doc.setFontSize(7.5);doc.setTextColor(5,120,123);doc.text('SCHOOL INSIGHTS',19,15);doc.setTextColor(100,116,139);doc.text(text(`${report.period.label} | Checked ${asOf}`),191,15,{align:'right'});doc.line(19,21,191,21);}
  }
  return doc;
}
