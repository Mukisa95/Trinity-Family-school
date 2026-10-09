// Synthetic timetable data only; the real PDF generator and app CSS are exercised.
import React from 'react';
const fullClasses=[4,5,6,7].map(n=>({id:'p'+n,name:'Primary '+n,code:'P.'+n,level:'Upper Primary',order:n,classTeacherId:'',subjectAssignments:[],createdAt:'', ...(n===7?{streams:[{id:'a',code:'A',name:'Arts',createdAt:''},{id:'s',code:'S',name:'Science',createdAt:''}],streamConfigurations:[{academicYearId:'2026',activeStreamIds:['a','s'],enabled:true,version:1,configuredAt:''}]}:{})}));
const timeSlots=[['06:30','07:30','lesson'],['07:30','08:30','lesson'],['08:30','09:30','lesson'],['09:30','10:30','lesson'],['10:30','11:00','break'],['11:00','12:00','lesson'],['12:00','13:00','lesson'],['13:00','14:00','lunch'],['14:00','15:00','lesson'],['15:00','16:00','lesson'],['16:00','16:30','break'],['16:30','17:30','lesson'],['17:30','19:00','break'],['19:00','20:30','lesson']];
const subjects=[{id:'eng',code:'ENG',name:'English'},{id:'mtc',code:'MTC',name:'Mathematics'},{id:'sst',code:'SST',name:'Social Studies'},{id:'sci',code:'SCI',name:'Science'},{id:'long',name:'Integrated Science and Health Education'}];
const scenario=new URLSearchParams(location.search).get('case')||'full';
export const classes=scenario==='sparse'?[fullClasses[0]]:scenario==='dense'?Array.from({length:12},(_,i)=>({...fullClasses[0],id:'p'+(i+1),code:'P.'+(i+1),order:i})):fullClasses;
const days=scenario==='sparse'?[1,3,5]:[1,2,3,4,5,6];
export const periods=days.flatMap(dayOfWeek=>timeSlots.map(([startTime,endTime,type],i)=>({id:dayOfWeek+'-'+i,dayOfWeek,periodNumber:i+1,type,startTime,endTime})));
export const profile={streamLayouts:{p7:{defaultMode:'separate'}}};
export const entries=periods.filter(p=>p.type==='lesson').flatMap((period,i)=>classes.flatMap((c,j)=>(c.id==='p7'?['a','s']:['']).map(streamId=>({id:period.id+c.id+streamId,periodId:period.id,classId:c.id,subjectId:scenario==='sparse'&&(i%2)?'long':subjects[(i+j)%4].id,teacherId:'',createdAt:'',...(streamId?{streamId}: {})}))));
if(scenario==='full'){
 for(const day of days){
  for(const id of ['p4','p5','p6']){ const e=entries.find(e=>e.periodId===day+'-0'&&e.classId===id); Object.assign(e!,{entryType:'activity',activityName:day===3?'HLTH ASS':'ASS',linkedClassIds:['p4','p5','p6'].filter(c=>c!==id)}); }
 }
 for(const id of ['p4','p5']){const e=entries.find(e=>e.periodId==='5-5'&&e.classId===id);Object.assign(e!,{entryType:'activity',activityName:'PRAYERS',linkedClassIds:['p4','p5'].filter(c=>c!==id),periodSpan:2});}
}
export const useSchoolSettings=()=>({data:{generalInfo:{name:'Sample School - PDF Layout Preview'}}});
export const usePDFViewer=()=>({runPDFJob:async(options:any,generator:any)=>{const blob=await generator({updateProgress:()=>{}});await fetch('/save-pdf?case='+scenario,{method:'POST',body:blob});
const root=document.querySelector<HTMLElement>('[aria-hidden="true"]')!;const origin=root.getBoundingClientRect();
const labels=[...root.querySelectorAll<HTMLCanvasElement>('canvas')].map(canvas=>{const rect=canvas.getBoundingClientRect();const data=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;let x0=canvas.width,y0=canvas.height,x1=-1,y1=-1;for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){if(data[(y*canvas.width+x)*4+3]>80){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}}return{text:canvas.getAttribute('aria-label'),x:rect.x-origin.x,y:rect.y-origin.y,width:rect.width,height:rect.height,ink:x1<0?null:[x0/canvas.width*rect.width,y0/canvas.height*rect.height,(x1+1)/canvas.width*rect.width,(y1+1)/canvas.height*rect.height]};});await fetch('/save-labels?case='+scenario,{method:'POST',body:JSON.stringify(labels)});
const result=document.createElement('a');result.href=URL.createObjectURL(blob);result.download='timetable-pdf-'+scenario+'.pdf';result.textContent='Download PDF '+scenario+' ('+blob.size+' bytes)';result.setAttribute('aria-label','Download PDF '+scenario);result.style.cssText='position:fixed;top:8px;left:8px;z-index:10001;background:white;padding:8px';document.body.appendChild(result);return blob;}});

