import type { AcademicYear, Class, FeeStructure, PaymentRecord, Pupil } from '@/types';
import type { ReportData, ReportPeriod } from './report-model';
import { filterApplicableFees, isPupilValidForTerm, processPupilFees } from '@/app/fees/collect/[id]/utils/feeProcessing';
import { isTermEnded } from '@/lib/utils/academic-year-utils';
import { PupilSnapshotsService } from '@/lib/services/pupil-snapshots.service';
import { formatPupilDisplayName } from '@/lib/utils/name-formatter';
import { reportDate } from './report-model';

/** Reuse fee assessment and discount rules; never invent historical class or boarding data. */
export async function assessReportFees(pupils:Pupil[],fees:FeeStructure[],payments:PaymentRecord[],period:ReportPeriod,years:AcademicYear[]=[period.year],classes:Class[]=[]):Promise<ReportData['assessments']> {
  const result:ReportData['assessments']={rows:[],missingHistorical:0};
  const terms=period.termId?period.year.terms.filter(term=>term.id===period.termId):period.year.terms;
  const paidByPupil=new Map<string,PaymentRecord[]>();for(const payment of payments){const rows=paidByPupil.get(payment.pupilId)||[];rows.push(payment);paidByPupil.set(payment.pupilId,rows);}
  for(const term of terms){
    const ended=isTermEnded(term);
    const snapshots=ended?await PupilSnapshotsService.getActiveSnapshotsForTerm(period.year.id,term.id):[];
    const historical=new Map(snapshots.map(snapshot=>[snapshot.pupilId,snapshot]));
    for(let index=0;index<pupils.length;index++){
      const pupil=pupils[index];if(!isPupilValidForTerm(pupil,term,period.year))continue;
      if(ended&&!historical.has(pupil.id)){result.missingHistorical++;continue;}
      const saved=historical.get(pupil.id);
      const assessedPupil=ended?{...PupilSnapshotsService.createVirtualPupilFromSnapshot(pupil,saved!),streamId:saved?.streamId,streamName:saved?.streamName}:pupil;
      const applicable=filterApplicableFees(fees,assessedPupil,term.id,period.year,years);
      const processed=processPupilFees(applicable,(paidByPupil.get(pupil.id)||[]).filter(payment=>payment.termId===term.id&&!payment.reverted),fees,assessedPupil,term.id,period.year,years);
      const assessed=processed.reduce((sum,fee)=>sum+fee.amount,0),paid=processed.reduce((sum,fee)=>sum+fee.paid,0);
      const appliedPayments=processed.flatMap(fee=>fee.payments||[]);
      const classLabel=classes.find(cls=>cls.id===assessedPupil.classId)?.code||classes.find(cls=>cls.id===assessedPupil.classId)?.name||(ended?assessedPupil.classId:assessedPupil.classCode||assessedPupil.className||assessedPupil.classId);
      result.rows.push({pupilId:pupil.id,pupilName:formatPupilDisplayName(assessedPupil),admission:assessedPupil.admissionNumber,classId:assessedPupil.classId,className:[classLabel,assessedPupil.streamName].filter(Boolean).join(' · '),termId:term.id,termName:term.name,assessed,paid,balance:processed.reduce((total,fee)=>total+Math.max(0,fee.amount-fee.paid),0),extra:processed.reduce((total,fee)=>total+Math.max(0,fee.paid-fee.amount),0),paymentIds:[...new Set(appliedPayments.map(payment=>payment.id))],lastPaymentDate:appliedPayments.map(payment=>reportDate(payment.paymentDate)).filter(Boolean).sort().at(-1)});
      if(index%40===39)await new Promise<void>(resolve=>setTimeout(resolve,0));
    }
  }
  return result;
}
