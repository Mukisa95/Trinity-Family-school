import test from 'node:test';
import assert from 'node:assert/strict';
import type { AcademicYear,FeeStructure,Pupil } from '@/types';
import { assessReportFees } from '@/lib/reports/report-fee-assessment';
import { reportPeriod } from '@/lib/reports/report-model';
import { PupilSnapshotsService } from '@/lib/services/pupil-snapshots.service';
const year={id:'future',name:'2100',startDate:'2100-01-01',endDate:'2100-12-31',terms:[{id:'term',name:'Term 3',startDate:'2100-09-01',endDate:'2100-12-10'}]} as AcademicYear;
const pupil={id:'p1',firstName:'Amina',lastName:'Example',admissionNumber:'TF/001',classId:'p7',classCode:'P.7',section:'Day',status:'Active',registrationDate:'2099-01-01',guardians:[]} as unknown as Pupil;
const fee={id:'tuition',name:'Tuition',amount:300000,category:'Tuition Fee',academicYearId:'future',termId:'term',isRequired:true,isRecurring:true,frequency:'Termly',status:'active',createdAt:'2099-01-01'} as FeeStructure;
test('fee report assessment uses fee-engine amounts and payment application',async()=>{
 const result=await assessReportFees([pupil],[fee],[{id:'payment',pupilId:'p1',feeStructureId:'tuition',academicYearId:'future',termId:'term',amount:100000,paymentDate:'2100-10-01'} as any],reportPeriod(year,'term'));
 assert.equal(result.rows.length,1);assert.equal(result.rows[0].assessed,300000);assert.equal(result.rows[0].paid,100000);assert.equal(result.rows[0].balance,200000);
});
test('pupils registered after a term are not retrospectively charged',async()=>{
 const result=await assessReportFees([{...pupil,registrationDate:'2101-01-01'}],[fee],[],reportPeriod(year,'term'));assert.equal(result.rows.length,0);
});
test('missing historical snapshots are reported without creating or substituting snapshots',async()=>{
 const original=PupilSnapshotsService.getActiveSnapshotsForTerm;PupilSnapshotsService.getActiveSnapshotsForTerm=async()=>[];
 try{const past={...year,id:'past',name:'2000',startDate:'2000-01-01',endDate:'2000-12-31',terms:[{...year.terms[0],startDate:'2000-09-01',endDate:'2000-12-10'}]};
 const result=await assessReportFees([{...pupil,registrationDate:'1999-01-01'}],[fee],[],reportPeriod(past,'term'));assert.equal(result.missingHistorical,1);assert.deepEqual(result.rows,[]);
 }finally{PupilSnapshotsService.getActiveSnapshotsForTerm=original;}
});

test('historical assessment labels follow the saved class ID instead of current denormalized labels',async()=>{
 const original=PupilSnapshotsService.getActiveSnapshotsForTerm;PupilSnapshotsService.getActiveSnapshotsForTerm=async()=>[{pupilId:'p1',classId:'p6',section:'Boarding',admissionNumber:'TF/001'}] as any;
 try{const past={...year,id:'past',name:'2000',startDate:'2000-01-01',endDate:'2000-12-31',terms:[{...year.terms[0],startDate:'2000-09-01',endDate:'2000-12-10'}]};
 const result=await assessReportFees([{...pupil,registrationDate:'1999-01-01'}],[],[],reportPeriod(past,'term'),[past],[{id:'p6',code:'P.6',name:'Primary Six'}] as any);assert.equal(result.rows[0].className,'P.6');
 }finally{PupilSnapshotsService.getActiveSnapshotsForTerm=original;}
});
