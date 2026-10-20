import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ReportDocument, ReportTable } from './report-model';
import { formatReportValue, reportDate } from './report-model';
import { drawReportCallout,drawReportCharts,drawReportMetrics,PDF_INK,pdfText } from './report-pdf-visuals';
import { preparePdfReportTable } from './report-pdf-table';

const ink=PDF_INK,blue:[number,number,number]=[16,35,60];
const text=pdfText;
/** Loaded only when a user requests a PDF. No report dependencies enter the shared shell. */
export function generateSchoolReportPdf(report:ReportDocument):jsPDF {
  if(!report.sections.length)throw new Error('Choose at least one report section.');
  const doc=new jsPDF({unit:'mm',format:'a4',compress:true});
  doc.setProperties({title:text(report.title),subject:text(report.period.label),author:text(report.preparedBy),creator:'Trinity Live Reports'});
  let y=32;
  const ensure=(height:number)=>{if(y+height>274){doc.addPage();y=29;}};
  const line=(value:string,size=9.5,bold=false)=>{
    doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(...ink);
    const lines=doc.splitTextToSize(text(value),172) as string[];
    const height=size*.42,block=lines.length*height;
    // Keep ordinary paragraphs together; only paragraphs taller than a page split.
    ensure(bold?block+12:Math.min(block,240));
    for(const row of lines){ensure(height);doc.text(row,19,y);y+=height;}
    y+=2;
  };
  const table=(input:ReportTable)=>{
    if(input.detail&&!input.rows.length)return;
    const item=preparePdfReportTable(input);
    doc.setFont('helvetica','normal');doc.setFontSize(9);
    const introHeight=item.description?doc.splitTextToSize(text(item.description),172).length*3.8+2:0;
    // Reserve just the introduction, header and first row, then let rows flow.
    // Keeping an entire short table together caused half-empty preceding pages.
    ensure(introHeight+27);
    line(item.title,11,true);
    if(item.description)line(item.description,9);
    const money=new Set(item.moneyColumns||[]),percent=new Set(item.percentColumns||[]);
    const cells=(row:(string|number)[])=>row.map((cell,index)=>text(typeof cell==='number'?formatReportValue(cell,money.has(index)?'money':percent.has(index)||item.columns[index]?.includes('%')?'percent':'number'):cell));
    const rows=item.rows.length?item.rows.map(cells):[item.columns.map((_,index)=>index===0?'No entries in the checked records.':'-')];
    const firstPage=doc.getNumberOfPages();
    const columnStyles:Record<number,{halign?:'right';cellWidth?:number}>={};
    for(const index of [...money,...percent])columnStyles[index]={halign:'right'};
    for(const [index,width] of Object.entries(item.columnWidths||{}))columnStyles[Number(index)]={...columnStyles[Number(index)],cellWidth:width};
    autoTable(doc,{startY:y,head:[item.columns.map(text)],body:rows,foot:item.total?[cells(item.total)]:undefined,showFoot:'lastPage',theme:'striped',margin:{left:19,right:19,top:36,bottom:22},
      styles:{font:'helvetica',fontSize:9,cellPadding:1.7,overflow:'linebreak',textColor:ink,lineColor:[226,232,240],lineWidth:0},
      headStyles:{fillColor:blue,textColor:[255,255,255],fontStyle:'bold',fontSize:8.5},alternateRowStyles:{fillColor:[242,247,252]},
      footStyles:{fillColor:[226,244,238],textColor:ink,fontStyle:'bold'},
      columnStyles,pageBreak:'auto',rowPageBreak:'avoid',showHead:'everyPage',
      didDrawPage:()=>{if(doc.getNumberOfPages()>firstPage){doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...ink);doc.text(text(`${item.title} (continued)`).slice(0,105),19,29);}},
    });
    y=(doc as jsPDF & {lastAutoTable?:{finalY:number}}).lastAutoTable!.finalY+5;
  };
  const asOf=reportDate(report.generatedAt);
  doc.setFillColor(...blue);doc.rect(0,0,210,26,'F');doc.setFillColor(5,150,145);doc.roundedRect(19,7,12,12,3,3,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(255,255,255);doc.text(report.schoolName.split(/\s+/).slice(0,2).map(word=>word[0]).join(''),25,15,{align:'center'});
  doc.setFontSize(12);doc.text(doc.splitTextToSize(text(report.schoolName),149),37,12);
  doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(193,211,230);doc.text(text(report.schoolContact||'SCHOOL REPORTS / CURRENT RECORDS & CLEAR NEXT STEPS'),37,22);
  y=36;line(report.title,18,true);line(`${report.period.label} / ${report.period.start} to ${report.period.end}`,10);
  line(`Checked ${new Date(report.generatedAt).toLocaleString('en-GB',{timeZone:'Africa/Kampala'})} EAT / Prepared by ${report.preparedBy}`,8.5);
  const status=asOf<report.period.start?'not yet started':asOf<=report.period.end?'still in progress':'ended';
  line(`Selected period: ${status}. Full supporting lists: ${report.includeDetails?'included after the summaries':'not selected'}.`,8.5);
  line('UGX means Ugandan shillings. Missing records are not zero. Current saved figures do not recreate an account on a past day; each section explains its dates and sources.',8.5);
  for(const note of report.notes||[])line(note,8.5);

  // Fill page destinations after rendering, so flowing sections cannot invalidate the contents.
  const entries=report.sections.map(section=>({key:`${section.id}:summary`,title:section.title,page:0}));
  if(report.includeDetails)for(const section of report.sections)if(section.tables.some(item=>item.detail&&item.rows.length))entries.push({key:`${section.id}:details`,title:`${section.title} - full lists`,page:0});
  line('Sections',10,true);
  const positions:{entry:typeof entries[number];page:number;x:number;y:number;lines:string[];height:number}[]=[];
  for(let index=0;index<entries.length;index+=2){
    doc.setFont('helvetica','normal');doc.setFontSize(8.5);
    const row=entries.slice(index,index+2).map(entry=>({entry,lines:doc.splitTextToSize(text(entry.title),70) as string[]}));
    const height=Math.max(...row.map(item=>item.lines.length))*3.8+3;
    ensure(height);
    row.forEach((item,column)=>positions.push({...item,page:doc.getNumberOfPages(),x:19+column*88,y,height}));y+=height;
  }
  y+=5;
  const beginSection=(key:string,title:string,description?:string)=>{
    doc.setFont('helvetica','normal');doc.setFontSize(9.5);
    ensure(35+(description?doc.splitTextToSize(text(description),172).length*4:0));
    const page=doc.getNumberOfPages();entries.find(entry=>entry.key===key)!.page=page;
    if(doc.outline)doc.outline.add(null,text(title),{pageNumber:page});
    y+=3;doc.setDrawColor(5,150,145);doc.setLineWidth(.6);doc.line(19,y-8,191,y-8);doc.setLineWidth(.2);
    line(title,17,true);if(description)line(description,9.5);
  };
  for(const section of report.sections){
    beginSection(`${section.id}:summary`,section.title,section.description);
    if(section.summary)y=drawReportCallout(doc,'Quick summary',[section.summary],y,'blue');
    y=drawReportMetrics(doc,section.metrics,y);
    if(section.charts?.length)y=drawReportCharts(doc,section.charts,y);
    for(const item of section.tables.filter(item=>!item.detail))table(item);
    if(section.insights.length)y=drawReportCallout(doc,'What these figures tell us',section.insights,y,'blue');
    if(section.actions?.length)y=drawReportCallout(doc,'What to do next',section.actions.map((action,index)=>`${index+1}. ${action}`),y,'green');
    if(section.sources?.length){line('Where the figures came from',10,true);for(const source of section.sources)line(source,9);}
    if(section.notes.length){line('What these figures include',10,true);for(const note of section.notes)line(note,9);}
    y+=5;
  }
  if(report.includeDetails)for(const section of report.sections){
    const lists=section.tables.filter(item=>item.detail&&item.rows.length);if(!lists.length)continue;
    beginSection(`${section.id}:details`,`${section.title} - full lists`);for(const list of lists)table(list);y+=5;
  }
  for(const position of positions){
    doc.setPage(position.page);doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(...blue);
    position.lines.forEach((value,index)=>doc.text(value,position.x,position.y+index*3.8));
    doc.setFont('helvetica','bold');doc.text(String(position.entry.page),position.x+80,position.y,{align:'right'});
    doc.setDrawColor(226,232,240);doc.line(position.x,position.y+position.height-2,position.x+80,position.y+position.height-2);
    doc.link(position.x,position.y-3,80,position.height,{pageNumber:position.entry.page});
  }
  const count=doc.getNumberOfPages();
  for(let page=1;page<=count;page++){
    doc.setPage(page);doc.setLineWidth(.2);doc.setDrawColor(226,232,240);doc.line(19,281,191,281);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(100,116,139);
    doc.text(text(report.schoolName).slice(0,65),19,287);doc.setFont('helvetica','bold');doc.text(`${page} / ${count}`,191,287,{align:'right'});
    if(page>1){doc.setFontSize(7.5);doc.setTextColor(5,120,123);doc.text('SCHOOL INSIGHTS',19,15);doc.setTextColor(100,116,139);doc.text(text(`${report.period.label} | Checked ${asOf}`),191,15,{align:'right'});doc.line(19,21,191,21);}
  }
  return doc;
}
