import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ReportDocument, ReportTable } from './report-model';
import { formatReportValue } from './report-model';

const ink:[number,number,number]=[30,41,59], blue:[number,number,number]=[67,56,202];
const text=(value:unknown)=>String(value??'').replace(/[\u2010-\u2015]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/\u2022/g,'-').normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
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
    for(const row of lines){if(y+height>274){doc.addPage();y=29;}doc.text(row,19,y);y+=height;}
    y+=2;
  };
  const table=(table:ReportTable)=>{
    if(table.detail&&!table.rows.length)return;
    // Keep room for the title, column headings and one standard row.
    if(y>254){doc.addPage();y=29;}
    line(table.title,11,true);
    const money=new Set(table.moneyColumns||[]);
    const rows=table.rows.length?table.rows.map(row=>row.map((cell,index)=>text(typeof cell==='number'&&money.has(index)?formatReportValue(cell,'money'):cell))):[table.columns.map((_,index)=>index===0?'No records in this section.':'-')];
    autoTable(doc,{startY:y,head:[table.columns.map(text)],body:rows,theme:'grid',margin:{left:19,right:19,top:28,bottom:22},
      styles:{font:'helvetica',fontSize:8.5,cellPadding:1.8,overflow:'linebreak',textColor:ink,lineColor:[226,232,240],lineWidth:.15},
      headStyles:{fillColor:blue,textColor:[255,255,255],fontStyle:'bold',fontSize:8.5},alternateRowStyles:{fillColor:[248,250,252]},
      columnStyles:Object.fromEntries([...money].map(index=>[index,{halign:'right' as const}])),rowPageBreak:'avoid',showHead:'everyPage',
    });
    y=(doc as jsPDF & {lastAutoTable?:{finalY:number}}).lastAutoTable!.finalY+6;
  };
  // Cover.
  doc.setFillColor(...blue);doc.rect(0,0,210,8,'F');y=39;
  line(report.schoolName,20,true);if(report.schoolContact)line(report.schoolContact,10);
  y+=14;line(report.title,25,true);line(report.period.label,15);y+=10;
  table({title:'Report scope',columns:['Item','Details'],rows:[['Reporting dates',`${report.period.start} to ${report.period.end}`],['Generated',`${new Date(report.generatedAt).toLocaleString('en-GB',{timeZone:'Africa/Kampala'})} EAT`],['Prepared by',report.preparedBy],['Included sections',report.sections.length],['Detail level',report.includeDetails?'Summary and supporting registers':'Summary and analysis']]});
  line('How to read this report',12,true);
  line('Transaction sections use the selected academic period or dates as stated in each section. Enrollment, staff, stock and savings are current snapshots, not reconstructed historical balances.');
  line('Read the coverage notes beside each analysis. A missing or failed data source is not interpreted as zero. All monetary amounts are in Ugandan shillings (UGX).');
  for(const note of report.notes||[])line(note);
  // Reserve a contents page. One line per selected component, with actual page numbers filled later.
  doc.addPage();const contentsPage=doc.getNumberOfPages();
  const entries:{title:string;page:number}[]=[];
  for(const section of report.sections){
    doc.addPage();y=32;const page=doc.getNumberOfPages();entries.push({title:section.title,page});
    if(doc.outline)doc.outline.add(null,text(section.title),{pageNumber:page});
    line(section.title,18,true);line(section.description,10);
    const hasContext=section.metrics.some(metric=>metric.detail);
    table({title:'Key figures',columns:hasContext?['Measure','Value','Context']:['Measure','Value'],rows:section.metrics.map(metric=>hasContext?[metric.label,formatReportValue(metric.value,metric.format),metric.detail||'']:[metric.label,formatReportValue(metric.value,metric.format)])});
    if(section.insights.length){line('Analysis and attention points',12,true);for(const insight of section.insights)line(`- ${insight}`);}
    if(section.notes.length){line('Coverage and calculation notes',11,true);for(const note of section.notes)line(note,9);}
    for(const item of section.tables.filter(table=>!table.detail||report.includeDetails))table(item);
  }
  doc.setPage(contentsPage);y=34;line('Table of contents',20,true);line('Select a section below to jump to its report.',10);y+=6;
  for(const entry of entries){
    doc.setFont('helvetica','normal');doc.setFontSize(11);doc.setTextColor(...blue);doc.text(text(entry.title),19,y);doc.text(String(entry.page),190,y,{align:'right'});
    doc.setDrawColor(226,232,240);doc.line(19,y+3,191,y+3);doc.link(19,y-5,172,10,{pageNumber:entry.page});y+=12;
  }
  y+=5;line('Only the sections selected in the report builder are included.',9);
  const count=doc.getNumberOfPages();
  for(let page=1;page<=count;page++){
    doc.setPage(page);doc.setDrawColor(226,232,240);doc.line(19,281,191,281);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(100,116,139);
    doc.text(text(report.schoolName).slice(0,85),19,287);doc.text(`${page} / ${count}`,191,287,{align:'right'});
    if(page>2){doc.setFontSize(8);doc.text(text(report.period.label),19,17);doc.text('School management report',191,17,{align:'right'});doc.line(19,21,191,21);}
  }
  return doc;
}
