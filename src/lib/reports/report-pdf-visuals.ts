import type { jsPDF } from 'jspdf';
import type { ReportChart, ReportMetric, ReportTone } from './report-model';
import { formatReportValue } from './report-model';
import { REPORT_PALETTE, REPORT_TONES, reportMetricTone } from './report-visuals';

export const PDF_INK:[number,number,number]=[16,35,60];
export const pdfText=(value:unknown)=>String(value??'').replace(/[\u2010-\u2015]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/\u2022/g,'-').normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
const room=(doc:jsPDF,y:number,height:number)=>{if(y+height>274){doc.addPage();return 30;}return y;};
function wrap(doc:jsPDF,value:string,width:number,size:number,bold=false):string[]{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);return doc.splitTextToSize(pdfText(value),width);}

export function drawReportCallout(doc:jsPDF,title:string,paragraphs:string[],start:number,tone:ReportTone='blue'):number {
  let y=start;
  const combined=paragraphs.join('\n\n'),combinedLines=wrap(doc,combined,155,9.5);
  // Keep ordinary notes together; exceptionally long notes break by paragraph.
  const blocks=combinedLines.length*4.1+21<=235?[combined]:paragraphs;
  for(let index=0;index<blocks.length;index++){
    const lines=wrap(doc,blocks[index],155,9.5),height=lines.length*4.1+21;
    y=room(doc,y,height);const palette=REPORT_PALETTE[tone];
    doc.setFillColor(...palette.soft);doc.setDrawColor(...palette.soft);doc.roundedRect(19,y,172,height,3,3,'F');
    doc.setFillColor(...palette.ink);doc.roundedRect(19,y,1.3,height,0.6,0.6,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(...palette.ink);doc.text(pdfText(index===0?title:`${title} (continued)`),24,y+8);
    doc.setFont('helvetica','normal');doc.setFontSize(9.5);doc.setTextColor(...PDF_INK);
    lines.forEach((line,index)=>doc.text(line,24,y+15+index*4.1));y+=height+5;
  }
  return y;
}

export function drawReportMetrics(doc:jsPDF,metrics:ReportMetric[],start:number):number {
  let y=start;const columns=metrics.length===6?3:metrics.length===1?1:metrics.length===2?2:4;
  const gap=4,width=(172-gap*(columns-1))/columns;
  for(let startIndex=0;startIndex<metrics.length;startIndex+=columns){
    const row=metrics.slice(startIndex,startIndex+columns);
    const layouts=row.map(metric=>({label:wrap(doc,metric.label,width-10,8.5),detail:metric.detail?wrap(doc,metric.detail,width-10,7.5):[]}));
    const height=Math.max(31,...layouts.map(layout=>18+layout.label.length*3.5+layout.detail.length*3.2));
    y=room(doc,y,height);
    row.forEach((metric,index)=>{
      const x=19+index*(width+gap),palette=REPORT_PALETTE[reportMetricTone(metric,startIndex+index)],layout=layouts[index];
      doc.setFillColor(...palette.soft);doc.setDrawColor(...palette.soft);doc.roundedRect(x,y,width,height,3,3,'F');
      doc.setFillColor(...palette.ink);doc.roundedRect(x+3,y+5,1.2,height-10,0.5,0.5,'F');
      doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(79,97,121);
      layout.label.forEach((line,i)=>doc.text(line,x+7,y+7+i*3.5));
      const value=pdfText(formatReportValue(metric.value,metric.format));let size=typeof metric.value==='string'?12:18;
      doc.setFont('helvetica','bold');doc.setFontSize(size);
      while(doc.getTextWidth(value)>width-12&&size>8){size-=.5;doc.setFontSize(size);}
      const valueY=y+12+layout.label.length*3.5;doc.setTextColor(...palette.ink);doc.text(value,x+7,valueY);
      doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(79,97,121);
      layout.detail.forEach((line,i)=>doc.text(line,x+7,valueY+5+i*3.2));
    });
    y+=height+5;
  }
  return y;
}

export function drawReportCharts(doc:jsPDF,charts:ReportChart[],start:number):number {
  let y=start;const gap=5,width=(172-gap)/2;
  for(let startIndex=0;startIndex<charts.length;startIndex+=2){
    const row=charts.slice(startIndex,startIndex+2);
    const layouts=row.map(chart=>{
      const items=chart.items.filter(item=>Number.isFinite(item.value)&&item.value>=0);
      return {items:items.slice(0,8),all:items,title:wrap(doc,chart.title,width-10,10,true),description:wrap(doc,chart.description,width-10,8)};
    });
    const height=Math.max(...row.map((chart,index)=>{const l=layouts[index];return 16+l.title.length*4+l.description.length*3.4+(chart.kind==='donut'?43+l.items.length*11:Math.max(25,l.items.length*12))+(l.all.length>8?8:0);}));
    y=room(doc,y,height);
    row.forEach((chart,index)=>{
      const x=19+index*(width+gap),layout=layouts[index];
      doc.setLineWidth(.2);doc.setDrawColor(221,230,240);doc.setFillColor(251,253,255);doc.roundedRect(x,y,width,height,3,3,'FD');
      doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(...PDF_INK);
      layout.title.forEach((line,i)=>doc.text(line,x+5,y+7+i*4));
      let top=y+11+layout.title.length*4;
      doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(79,97,121);
      layout.description.forEach((line,i)=>doc.text(line,x+5,top+i*3.4));top+=layout.description.length*3.4+4;
      const total=layout.all.reduce((sum,item)=>sum+item.value,0);
      if(chart.kind==='donut'){
        const cx=x+width/2,cy=top+18,radius=16,inner=11;
        doc.setDrawColor(225,232,241);doc.setLineWidth(radius-inner);doc.circle(cx,cy,(radius+inner)/2,'S');let startAngle=-Math.PI/2;
        if(total>0)layout.all.forEach((item,i)=>{
          const end=startAngle+item.value/total*Math.PI*2,steps=Math.max(1,Math.ceil((end-startAngle)/.08));
          if(item.value>0){
            const points:{op:string;c:number[]}[]=[];
            for(let step=0;step<=steps;step++){const angle=startAngle+(end-startAngle)*step/steps;points.push({op:step?'l':'m',c:[cx+Math.cos(angle)*radius,cy+Math.sin(angle)*radius]});}
            for(let step=steps;step>=0;step--){const angle=startAngle+(end-startAngle)*step/steps;points.push({op:'l',c:[cx+Math.cos(angle)*inner,cy+Math.sin(angle)*inner]});}
            points.push({op:'h',c:[]});doc.setFillColor(...REPORT_PALETTE[item.tone||REPORT_TONES[i%REPORT_TONES.length]].ink);doc.path(points).fill();
          }startAngle=end;
        });
        doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(...PDF_INK);doc.text(pdfText(total?chart.centerValue||formatReportValue(total):'0'),cx,cy+1,{align:'center'});
        doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.text(pdfText(total?chart.centerLabel||'Total':'No records'),cx,cy+6,{align:'center'});top+=40;
        layout.items.forEach((item,i)=>{
          const palette=REPORT_PALETTE[item.tone||REPORT_TONES[i%REPORT_TONES.length]];doc.setFillColor(...palette.ink);doc.circle(x+6,top-1,1.2,'F');
          doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...PDF_INK);
          const label=wrap(doc,item.label,width-16,8)[0];doc.text(label,x+10,top);
          doc.setFont('helvetica','bold');doc.text(pdfText(formatReportValue(item.value,chart.format)),x+10,top+4);top+=11;
        });
      }else{
        const max=Math.max(1,...layout.all.map(item=>item.value));
        layout.items.forEach((item,i)=>{
          doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...PDF_INK);
          const label=wrap(doc,item.label,width-35,8)[0];doc.text(label,x+5,top);
          doc.setFont('helvetica','bold');doc.text(pdfText(formatReportValue(item.value,chart.format)),x+width-5,top,{align:'right'});
          doc.setFillColor(230,237,245);doc.roundedRect(x+5,top+3,width-10,2.5,1,1,'F');
          if(item.value>0){doc.setFillColor(...REPORT_PALETTE[item.tone||REPORT_TONES[i%REPORT_TONES.length]].ink);doc.roundedRect(x+5,top+3,Math.max(1,(width-10)*item.value/max),2.5,.6,.6,'F');}top+=12;
        });
        if(!layout.items.length){doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text('No records in the checked data.',x+5,top);}
      }
      if(layout.all.length>8){doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.setTextColor(79,97,121);doc.text('First 8 groups shown; see the full table.',x+5,y+height-5);}
    });
    y+=height+6;
  }
  doc.setLineWidth(.2);return y;
}
