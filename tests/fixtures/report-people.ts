import type { ReportData } from '@/lib/reports/report-model';
import { reportFixture } from './report-center';

/** Synthetic identities matching the supplied example's aggregate composition. */
export function peopleReportFixture():ReportData {
  const specs=[['Baby',65,43,64,'Nursery'],['Middle',62,29,59,'Nursery'],['Top',67,40,65,'Nursery'],['P.1',79,37,75,'Lower Primary'],['P.2',89,43,79,'Lower Primary'],['P.3',54,24,50,'Lower Primary'],['P.4',79,36,69,'Upper Primary'],['P.5',93,42,76,'Upper Primary'],['P.6',70,32,49,'Upper Primary'],['P.7',77,31,55,'Upper Primary']] as const;
  const classes=specs.map(([code,,,,level],index)=>({id:`class-${index}`,name:code,code,level,order:index}));
  let index=0;
  const pupils=specs.flatMap(([,total,boys,day],classIndex)=>Array.from({length:total},(_,localIndex)=>{
    const id=++index;const age=id<=145?5:id<=353?8:id<=556?11:id<=725?14:16;
    return {id:`sample-pupil-${id}`,firstName:'Sample',lastName:`Pupil ${id}`,admissionNumber:`DEMO/${id}`,classId:classes[classIndex].id,gender:localIndex<boys?'Male':'Female',section:localIndex<day?'Day':'Boarding',status:'Active',dateOfBirth:`${2026-age}-01-01`,registrationDate:id<=22?'2026-10-01':'2025-01-01',guardians:[{phone:'SAMPLE CONTACT'}]};
  }));
  const historical=[...Array.from({length:196},(_,i)=>({id:`inactive-${i}`,status:'Inactive'})),...Array.from({length:78},(_,i)=>({id:`graduate-${i}`,status:'Graduated'}))];
  const staff=Array.from({length:20},(_,index)=>({id:`sample-staff-${index+1}`,firstName:'Sample',lastName:`Staff ${index+1}`,status:index<17?'active':'inactive',role:[...(index===16?[]:['Teacher']),...(index===0?['IT support','Head teacher']:[]),...(index===1?['Teaching assistant']:[]),...(index===16?['Principal']:[])],department:['Teaching',...(index<2?['Administration']:[]),...(index===0?['Support']:[])],contractType:index<18?'permanent':index===18?'contract':'temporary',contactNumber:'SAMPLE CONTACT'}));
  return {...reportFixture,pupils:[...pupils,...historical],classes,staff} as unknown as ReportData;
}
