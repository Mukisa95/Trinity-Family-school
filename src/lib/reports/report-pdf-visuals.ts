import type { jsPDF } from 'jspdf';
import type { ReportChart, ReportMetric, ReportTone } from './report-model';
import { formatReportValue } from './report-model';
import { REPORT_PALETTE, REPORT_TONES, reportMetricTone } from './report-visuals';

export const PDF_INK:[number,number,number]=[16,35,60];
export const pdfText=(value:unknown)=>String(value??'').replace(/[\u2010-\u2015]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[\u2022\u00b7]/g,' / ').normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
const room=(doc:jsPDF,y:number,height:number)=>{if(y+height>274){doc.addPage();return 30;}return y;};
function wrap(doc:jsPDF,value:string,width:number,size:number,bold=false):string[]{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);return doc.splitTextToSize(pdfText(value),width);}

export function drawReportCallout(doc:jsPDF,title:string,paragraphs:string[],start:number,tone:ReportTone='blue'):number {
  let y=start,index=0;
  const lines=paragraphs.flatMap((paragraph,i)=>[...wrap(doc,paragraph,160,9.5),...(i<paragraphs.length-1?['']:[])]);
  while(lines.length){
    let capacity=Math.floor((274-y-11)/4.1);
    if(capacity<2){doc.addPage();y=30;capacity=Math.floor((274-y-11)/4.1);}
    let take=Math.min(lines.length,capacity);
    if(take<lines.length){const boundary=lines.slice(0,take).lastIndexOf('');if(boundary>=Math.floor(take/2))take=boundary;}
    const chunk=lines.splice(0,take);while(lines[0]==='')lines.shift();
    while(chunk.at(-1)==='')chunk.pop();
    const height=11+chunk.length*4.1,palette=REPORT_PALETTE[tone];
    doc.setFillColor(...palette.soft);doc.roundedRect(19,y,172,height,2,2,'F');
    doc.setFillColor(...palette.ink);doc.roundedRect(19,y,1.2,height,.5,.5,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(...palette.ink);doc.text(pdfText(index++?`${title} (continued)`:title),24,y+6);
    doc.setFont('helvetica','normal');doc.setFontSize(9.5);doc.setTextColor(...PDF_INK);
    chunk.forEach((line,i)=>doc.text(line,24,y+12+i*4.1));y+=height+5;
  }
  return y;
}

export function drawReportMetrics(doc:jsPDF,metrics:ReportMetric[],start:number):number {
  let y=start;const columns=metrics.length===6?3:Math.min(4,Math.max(1,metrics.length));
  const gap=3,width=(172-gap*(columns-1))/columns;
  for(let first=0;first<metrics.length;first+=columns){
    const row=metrics.slice(first,first+columns);
    const layouts=row.map(metric=>({label:wrap(doc,metric.label,width-10,8.5),detail:metric.detail?wrap(doc,metric.detail,width-10,7.5):[]}));
    const height=Math.max(21,...layouts.map(layout=>18+layout.label.length*3.3+Math.max(0,layout.detail.length-1)*3));
    y=room(doc,y,height);
    row.forEach((metric,index)=>{
      const x=19+index*(width+gap),palette=REPORT_PALETTE[reportMetricTone(metric,first+index)],layout=layouts[index];
      doc.setFillColor(...palette.soft);doc.roundedRect(x,y,width,height,2,2,'F');
      doc.setFillColor(...palette.ink);doc.roundedRect(x+2.5,y+4,1,height-8,.5,.5,'F');
      doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(79,97,121);layout.label.forEach((line,i)=>doc.text(line,x+6,y+6+i*3.3));
      const value=pdfText(formatReportValue(metric.value,metric.format));let size=typeof metric.value==='string'?11:15;
      doc.setFont('helvetica','bold');doc.setFontSize(size);while(doc.getTextWidth(value)>width-11&&size>8){size-=.5;doc.setFontSize(size);}
      const valueY=y+10+layout.label.length*3.3;doc.setTextColor(...palette.ink);doc.text(value,x+6,valueY);
      doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(79,97,121);layout.detail.forEach((line,i)=>doc.text(line,x+6,valueY+4+i*3));
    });
    y+=height+3;
  }
  return y;
}

/** Each chart measures its own content. A short chart never stretches to match
 * a long neighbour, and a single chart uses the full available width. */
export function drawReportCharts(doc:jsPDF,charts:ReportChart[],start:number):number {
  let y=start;const gap=4;
  for(let first=0;first<charts.length;first+=2){
    const row=charts.slice(first,first+2),width=(172-gap*(row.length-1))/row.length;
    const layouts=row.map(chart=>{
      const all=chart.items.filter(item=>Number.isFinite(item.value)&&item.value>=0),items=all.slice(0,8);
      const title=wrap(doc,chart.title,width-10,10,true),description=wrap(doc,chart.description,width-10,8);
      const header=8+title.length*4+description.length*3.3;
      const legendColumns=width>100?Math.min(3,items.length||1):1,legendWidth=(width-47-(legendColumns-1)*5)/legendColumns;
      const entries=items.map(item=>({label:wrap(doc,item.label,legendWidth,8),value:pdfText(formatReportValue(item.value,chart.format))}));
      const bars=items.map(item=>{doc.setFont('helvetica','bold');doc.setFontSize(8);const value=pdfText(formatReportValue(item.value,chart.format)),valueWidth=doc.getTextWidth(value)+3;return {value,label:wrap(doc,item.label,Math.max(14,width-13-valueWidth),8)};});
      const legendRows=Array.from({length:Math.ceil(entries.length/legendColumns)},(_,i)=>Math.max(...entries.slice(i*legendColumns,(i+1)*legendColumns).map(entry=>entry.label.length*3.3+6.5)));
      const body=chart.kind==='donut'?Math.max(31,legendRows.reduce((sum,height)=>sum+height,0)):Math.max(15,bars.reduce((sum,entry)=>sum+entry.label.length*3.3+5,0));
      return {all,items,title,description,header,entries,legendColumns,legendWidth,legendRows,bars,height:header+body+6+(all.length>8?5:0)};
    });
    // Use the remaining space for a short first chart instead of moving both
    // charts to a new page just because its neighbour is taller.
    if(row.length>1&&y+Math.max(...layouts.map(layout=>layout.height))>274&&y+layouts[0].height<=274){
      y=drawReportCharts(doc,[row[0]],y);first-=1;continue;
    }
    y=room(doc,y,Math.max(...layouts.map(layout=>layout.height)));
    row.forEach((chart,index)=>{
      const x=19+index*(width+gap),layout=layouts[index];
      doc.setLineWidth(.2);doc.setDrawColor(221,230,240);doc.setFillColor(251,253,255);doc.roundedRect(x,y,width,layout.height,2,2,'FD');
      doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(...PDF_INK);layout.title.forEach((line,i)=>doc.text(line,x+5,y+6+i*4));
      doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(79,97,121);layout.description.forEach((line,i)=>doc.text(line,x+5,y+7+layout.title.length*4+i*3.3));
      let top=y+layout.header+2;const total=layout.all.reduce((sum,item)=>sum+item.value,0);
      if(chart.kind==='donut'){
        const cx=x+19,cy=top+14,radius=13,inner=9.3;
        doc.setDrawColor(225,232,241);doc.setLineWidth(radius-inner);doc.circle(cx,cy,(radius+inner)/2,'S');let angle=-Math.PI/2;
        if(total>0)layout.all.forEach((item,i)=>{
          const end=angle+item.value/total*Math.PI*2,steps=Math.max(1,Math.ceil((end-angle)/.08));
          if(item.value>0){const points:{op:string;c:number[]}[]=[];
            for(let step=0;step<=steps;step++){const a=angle+(end-angle)*step/steps;points.push({op:step?'l':'m',c:[cx+Math.cos(a)*radius,cy+Math.sin(a)*radius]});}
            for(let step=steps;step>=0;step--){const a=angle+(end-angle)*step/steps;points.push({op:'l',c:[cx+Math.cos(a)*inner,cy+Math.sin(a)*inner]});}
            points.push({op:'h',c:[]});doc.setFillColor(...REPORT_PALETTE[item.tone||REPORT_TONES[i%REPORT_TONES.length]].ink);doc.path(points).fill();
          }angle=end;
        });
        doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(...PDF_INK);doc.text(pdfText(total?chart.centerValue||formatReportValue(total):'0'),cx,cy,{align:'center'});
        doc.setFont('helvetica','normal');doc.setFontSize(6.8);doc.text(pdfText(total?chart.centerLabel||'Total':'No records'),cx,cy+4,{align:'center'});
        layout.entries.forEach((entry,i)=>{const item=layout.items[i],column=i%layout.legendColumns,legendX=x+40+column*(layout.legendWidth+5),legendY=top+layout.legendRows.slice(0,Math.floor(i/layout.legendColumns)).reduce((sum,height)=>sum+height,0);doc.setFillColor(...REPORT_PALETTE[item.tone||REPORT_TONES[i%REPORT_TONES.length]].ink);doc.circle(legendX-3,legendY-1,1,'F');doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...PDF_INK);entry.label.forEach((line,j)=>doc.text(line,legendX,legendY+j*3.3));doc.setFont('helvetica','bold');doc.text(entry.value,legendX,legendY+entry.label.length*3.3+1);});
      }else{
        const max=Math.max(1,...layout.all.map(item=>item.value));
        layout.bars.forEach((entry,i)=>{const item=layout.items[i];doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...PDF_INK);entry.label.forEach((line,j)=>doc.text(line,x+5,top+j*3.3));doc.setFont('helvetica','bold');doc.text(entry.value,x+width-5,top,{align:'right'});const barY=top+entry.label.length*3.3;doc.setFillColor(230,237,245);doc.roundedRect(x+5,barY,width-10,2,1,1,'F');if(item.value>0){doc.setFillColor(...REPORT_PALETTE[item.tone||REPORT_TONES[i%REPORT_TONES.length]].ink);doc.roundedRect(x+5,barY,Math.max(1,(width-10)*item.value/max),2,.5,.5,'F');}top+=entry.label.length*3.3+5;});
        if(!layout.items.length){doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text('No records in the checked data.',x+5,top);}
      }
      if(layout.all.length>8){doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(79,97,121);doc.text('First 8 groups; see the full table.',x+5,y+layout.height-4);}
    });
    y+=Math.max(...layouts.map(layout=>layout.height))+4;
  }
  doc.setLineWidth(.2);return y;
}
