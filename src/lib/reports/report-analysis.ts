import type { ReportData, ReportSection, ReportSectionId, ReportPeriod, ReportValue, ReportMetric } from './report-model';
import { REPORT_SECTIONS, reportNumber as n, reportDate, inReportPeriod } from './report-model';
import { formatPupilDisplayName } from '@/lib/utils/name-formatter';
import { selectBudgetsForPeriod } from '@/lib/utils/procurement-selectors';
import { buildFeesReport, buildUniformReport } from './financial-report-analysis';
import { buildEnrollmentReport, buildStaffReport } from './school-people-analysis';

const sum=<T,>(items:T[],fn:(item:T)=>unknown)=>items.reduce((total,item)=>total+n(fn(item)),0);
const pct=(value:number,total:number)=>total?Math.round(value/total*1000)/10:0;
function groups<T>(items:T[],key:(item:T)=>string,value:(item:T)=>number=()=>1) {
  const counts=new Map<string,number>();for(const item of items){const label=key(item)||'Not recorded';counts.set(label,(counts.get(label)||0)+value(item));}
  return [...counts].sort((a,b)=>b[1]-a[1]);
}
const metric=(label:string,value:ReportValue,format:ReportMetric['format']='number',detail?:string):ReportMetric=>({label,value,format,detail});
export function validPayments(payments:ReportData['payments']) { return [...new Map(payments.filter(item=>!item.reverted).map(item=>[item.id,item])).values()]; }
export function acceptedPurchases(purchases:ReportData['purchases']) { return purchases.filter(item=>!item.approvalStatus || item.approvalStatus==='Approved'); }
const name=(pupil:ReportData['pupils'][number])=>formatPupilDisplayName(pupil);

/** Both the page and PDF consume this model, so figures and coverage notes stay identical. */
export function buildReportSection(id:ReportSectionId,data:ReportData,period:ReportPeriod,now=new Date()):ReportSection {
  const definition=REPORT_SECTIONS.find(item=>item.id===id)!;
  const report:ReportSection={id,title:definition.title,description:definition.description,metrics:[],insights:[],notes:[],tables:[]};
  const table=(title:string,columns:string[],rows:ReportValue[][],moneyColumns?:number[],detail=false)=>report.tables.push({title,columns,rows,moneyColumns,detail});
  switch(id){
    case 'enrollment': return buildEnrollmentReport(data,period,now);
    case 'fees': return buildFeesReport(data,period,now);
    case 'finance': {
      const payments=validPayments(data.cashPayments).filter(p=>inReportPeriod(p.paymentDate,period)), purchases=acceptedPurchases(data.purchases), income=sum(payments,p=>p.amount),spend=sum(purchases,p=>p.totalCost),salaries=n(data.payroll.totalAmount),expenditure=spend+salaries;
      report.metrics=[metric('Recorded fee receipts',income,'money'),metric('Recorded expenditure',expenditure,'money'),metric('Receipts less expenditure',income-expenditure,'money'),metric('Salary payments',salaries,'money')];
      table('Income and expenditure statement',['Line','Amount (UGX)'],[['Fee receipts received in date range',income],['Procurement recorded cost',spend],['Salary payments',salaries],['Total recorded expenditure',expenditure],['Recorded difference',income-expenditure]],[1]);
      const months=new Map<string,{income:number;cost:number}>();const bucket=(date:string)=>{if(!months.has(date))months.set(date,{income:0,cost:0});return months.get(date)!;};
      payments.forEach(p=>bucket(reportDate(p.paymentDate).slice(0,7)).income+=n(p.amount));purchases.forEach(p=>bucket(reportDate(p.purchaseDate).slice(0,7)).cost+=n(p.totalCost));
      table('Monthly receipts and purchasing',['Month','Fee receipts (UGX)','Purchases (UGX)'],[...months].sort(([a],[b])=>a.localeCompare(b)).map(([month,values])=>[month||'Date unavailable',values.income,values.cost]),[1,2]);
      report.insights=[income>=expenditure?'Recorded receipts cover the listed expenditure in this date range.':'Listed expenditure exceeds the recorded fee receipts in this date range.',`${data.purchases.filter(p=>p.approvalStatus==='Pending').length} pending and ${data.purchases.filter(p=>p.approvalStatus==='Rejected').length} rejected purchases are excluded.`];
      report.notes=['Date-based statement: fee payment dates, procurement purchase dates and payroll payment dates use the same selected range. Receipts can be allocated to another academic term.','Procurement cost is recorded expenditure; the purchase records do not establish settlement or cash paid. This difference is not audited profit, a bank balance, or a complete cash-flow statement.','Pupil savings, loans, fees assessed but unpaid, and unrecorded donations/other income are excluded. Uniform/requirement tracking payments are not added again because they may already appear in the fee ledger. Salary payments are not included in the monthly purchasing table.'];break;
    }
    case 'attendance': {
      const records=[...new Map(data.attendance.filter(r=>inReportPeriod(r.date,period)).map(r=>[`${reportDate(r.date)}:${r.pupilId}`,r])).values()];
      const marked=records.filter(r=>r.status),present=marked.filter(r=>['Present','Late','Delayed'].includes(r.status)).length,absent=marked.filter(r=>r.status==='Absent');
      report.metrics=[metric('Attendance records',marked.length),metric('Recorded attendance rate',pct(present,marked.length),'percent'),metric('Absent records',absent.length),metric('Days with records',new Set(marked.map(r=>reportDate(r.date))).size)];
      table('Attendance by status',['Status','Pupil-days'],groups(marked,r=>r.status));
      table('Class attendance',['Class','Marked pupil-days','Present / late','Absent'],groups(marked,r=>r.classCode||r.className||r.classId).map(([cls,count])=>{const rows=marked.filter(r=>(r.classCode||r.className||r.classId)===cls);return [cls,count,rows.filter(r=>['Present','Late','Delayed'].includes(r.status)).length,rows.filter(r=>r.status==='Absent').length];}));
      table('Daily attendance',['Date','Marked pupil-days','Present / late','Absent'],[...new Set(marked.map(r=>reportDate(r.date)))].sort().map(date=>{const rows=marked.filter(r=>reportDate(r.date)===date);return [date,rows.length,rows.filter(r=>['Present','Late','Delayed'].includes(r.status)).length,rows.filter(r=>r.status==='Absent').length];}));
      table('Repeated absence',['Pupil ID','Absent days'],groups(absent,r=>r.pupilId).filter(([,count])=>count>=3),undefined,true);
      report.insights=[`${records.filter(r=>!r.status).length} unmarked records are excluded from the attendance-rate denominator.`,`${groups(absent,r=>r.pupilId).filter(([,count])=>count>=3).length} pupils have at least three recorded absences.`];
      report.notes=['Rate = Present + Late + Delayed, divided by all marked pupil-day records (including Excused). Missing registers and unrecorded school days are not treated as absences; this is recorded-data coverage, not a whole-school attendance claim.'];break;
    }
    case 'academics': {
      let marked=0,passed=0,missed=0;const subjectRows=new Map<string,{marks:number;count:number;passed:number;missed:number}>();
      const examRows:ReportValue[][]=[];
      for(const {exam,result} of data.results){let count=0,percentTotal=0;for(const results of Object.values(result?.results||{}))for(const [subjectId,cell] of Object.entries(results)){
        const subject=result?.subjectSnapshots?.find(s=>s.subjectId===subjectId || s.code===subjectId);const label=subject?.name||subject?.code||subjectId;
        const value=subjectRows.get(label)||{marks:0,count:0,passed:0,missed:0};
        if(cell.status==='missed'){missed++;value.missed++;}else if((result?.assessmentMode||exam.assessmentMode)!=='nursery_commentary' && typeof cell.marks==='number' && Number.isFinite(cell.marks)){
          const max=n(subject?.maxMarks)||n(exam.maxMarks);if(max>0 && cell.marks>=0 && cell.marks<=max){const percent=cell.marks/max*100;marked++;count++;value.count++;value.marks+=percent;percentTotal+=percent;const pass=cell.marks>=(subject?.passingMarks ?? n(exam.passingMarks));if(pass){passed++;value.passed++;}}
        }subjectRows.set(label,value);
      }examRows.push([exam.name,result?.classSnapshot?.code||result?.classSnapshot?.name||data.classes?.find(cls=>cls.id===exam.classId)?.code||exam.classId,exam.status,result?'Available':'Not recorded',count,count?`${(percentTotal/count).toFixed(1)}%`:'-']);}
      report.metrics=[metric('Exams',data.exams.length),metric('Results available',data.results.filter(r=>r.result).length),metric('Recorded subject scores',marked),metric('Subject-score pass rate',pct(passed,marked),'percent')];
      table('Exam results overview',['Exam','Class','Status','Result record','Subject scores','Average score'],examRows);
      table('Subject performance',['Subject','Scores','Average (%)','Pass rate (%)','Missed'],[...subjectRows].map(([label,value])=>[label,value.count,value.count?Number((value.marks/value.count).toFixed(1)):'-',value.count?pct(value.passed,value.count):'-',value.missed]));
      table('Exam workflow',['Status','Exams'],groups(data.exams,e=>e.status));
      report.insights=[`${data.exams.filter(e=>e.status==='Completed' && !data.results.find(row=>row.exam.id===e.id)?.result).length} completed exams have no result record.`,`${missed} subject entries are marked missed and are excluded from score averages.`];
      report.notes=['Subject averages use valid numeric scores normalized to each subject/exam maximum. Pass rates count subject scores, not pupils; different exams can include the same pupil. Commentary-only nursery assessments are not converted into numeric scores.'];break;
    }
    case 'staff': return buildStaffReport(data,period,now);
    case 'payroll': {
      const payroll=data.payroll;report.metrics=[metric('Salary payments',n(payroll.totalAmount),'money'),metric('Payments',n(payroll.paymentCount)),metric('Staff paid',n(payroll.staffPaidCount)),metric('Average payment',payroll.paymentCount?payroll.totalAmount/payroll.paymentCount:0,'money')];
      table('Salary spend by method',['Method','Payments','Amount (UGX)'],(payroll.paymentMethods||[]).map(row=>[row.method,row.paymentCount,row.amount]),[2]);
      table('Salary spend by staff',['Staff','Payments','Paid (UGX)','Latest payment'],(payroll.byStaff||[]).map(row=>[row.staffName,row.paymentCount,row.amount,reportDate(row.lastPaymentDate)]),[2]);
      report.notes=['Salary payments use actual payment dates. Salary entitlements, accrued unpaid wages and employer deductions are not inferred from payments.'];break;
    }
    case 'procurement': {
      const purchases=acceptedPurchases(data.purchases),cost=sum(purchases,p=>p.totalCost),budgets=selectBudgetsForPeriod(data.budgets,{academicYear:period.year,termId:period.termId,viewPeriod:period.termId?'Term':'Year'}),approvedBudgets=budgets.filter(b=>b.status==='Active');
      report.metrics=[metric('Recorded purchasing cost',cost,'money'),metric('Accepted purchases',purchases.length),metric('Suppliers',new Set(purchases.map(p=>p.supplierName).filter(Boolean)).size),metric('Active budget plans',sum(approvedBudgets,b=>b.totalEstimatedCost),'money')];
      table('Spend by category',['Category','Cost (UGX)'],groups(purchases,p=>p.itemCategory||'Other',p=>n(p.totalCost)),[1]);table('Spend by supplier',['Supplier','Cost (UGX)'],groups(purchases,p=>p.supplierName||'Not recorded',p=>n(p.totalCost)),[1]);
      table('Purchase approvals',['Status','Records','Cost (UGX)'],groups(data.purchases,p=>p.approvalStatus||'Legacy / no workflow').map(([status,count])=>[status,count,sum(data.purchases.filter(p=>(p.approvalStatus||'Legacy / no workflow')===status),p=>p.totalCost)]),[2]);
      table('Budget plans',['Plan','Status','Scope','Estimate (UGX)'],budgets.map(b=>[b.name,b.status,b.termName||b.periodType,b.totalEstimatedCost]),[3]);
      table('Purchase register',['Date','Item','Supplier','Quantity','Cost (UGX)'],purchases.map(p=>[reportDate(p.purchaseDate),p.itemName||p.itemId,p.supplierName||'-',n(p.quantity),n(p.totalCost)]),[4],true);
      report.insights=[`${data.purchases.filter(p=>p.approvalStatus==='Pending').length} purchases await approval.`,`${purchases.filter(p=>!p.receiptNumber && !p.invoiceNumber).length} accepted purchases have no recorded invoice or receipt number.`];
      report.notes=['Purchasing cost includes approved purchases and legacy purchases without an approval status; pending/rejected purchases are excluded. Budgets are separate plans and can overlap; their sum is not a deduplicated spending ceiling. Annual budgets are excluded from term-only comparisons.'];break;
    }
    case 'requirements': {
      const rows=data.requirements;report.metrics=[metric('Requirement records',rows.length),metric('Paid amount on records',sum(rows,r=>r.paidAmount),'money'),metric('Pending release',rows.filter(r=>r.releaseStatus!=='released').length),metric('Pending / partial payment',rows.filter(r=>r.paymentStatus!=='paid').length)];
      table('Payment status',['Status','Records'],groups(rows,r=>r.paymentStatus));table('Release status',['Status','Records'],groups(rows,r=>r.releaseStatus));
      table('Coverage method',['Coverage','Records'],groups(rows,r=>r.coverageMode));
      report.insights=[`${rows.filter(r=>r.paymentStatus==='paid' && r.releaseStatus!=='released').length} paid requirement records have not been released.`];
      report.notes=['Academic-period tracking snapshot. Paid amounts are cumulative values on tracking records, not cash received within the date range. In-kind quantities use different items/units and are not added together. These amounts are not added to the income statement.'];break;
    }
    case 'uniforms': return buildUniformReport(data,period,now);
    case 'inventory': {
      const rows=data.inventory.filter(item=>item.isActive),low=rows.filter(item=>item.reorderLevel!==undefined && n(item.quantity)<=n(item.reorderLevel));
      report.metrics=[metric('Active stock items',rows.length),metric('Recorded asset value',sum(rows,item=>item.totalValue),'money'),metric('At / below reorder',low.length),metric('Out of stock',rows.filter(item=>n(item.quantity)<=0).length)];
      table('Inventory by category',['Category','Stock items','Recorded value (UGX)'],groups(rows,item=>item.category).map(([category,count])=>[category,count,sum(rows.filter(item=>item.category===category),item=>item.totalValue)]),[2]);
      table('Stock needing attention',['Item','Location','Available','Unit','Reorder level'],low.map(item=>[item.name,item.location,n(item.quantity),item.unit,n(item.reorderLevel)]));table('Asset condition',['Condition','Items'],groups(rows,item=>item.condition));
      report.insights=[`${rows.filter(item=>item.totalValue===undefined).length} active stock items have no saved valuation.`];report.notes=['Current stock snapshot, regardless of selected historical period. Stock quantities are shown with their units; quantities of unlike items are not combined. Asset values are saved book values, not a market valuation or expense.'];break;
    }
    case 'banking': {
      const rows=data.banking;report.metrics=[metric('Savings accounts',rows.length),metric('Recorded pupil savings',sum(rows,r=>r.balance),'money'),metric('Active accounts',rows.filter(r=>r.isActive!==false).length),metric('Negative balances',rows.filter(r=>n(r.balance)<0).length)];
      table('Account status',['Status','Accounts','Balance (UGX)'],['Active','Inactive'].map(status=>{const selected=rows.filter(r=>(r.isActive!==false)===(status==='Active'));return [status,selected.length,sum(selected,r=>r.balance)];}),[2]);
      table('Pupil account balances',['Account','Account name','Balance (UGX)'],rows.map(r=>[r.accountNumber,r.accountName,n(r.balance)]),[2],true);
      report.notes=['Current pupil-account balances, not historical balances as of the selected term. Savings held for pupils are not school income. Loan exposure and bank reconciliation are outside this account snapshot.'];break;
    }
    case 'events': {
      const rows=data.events,scheduled=rows.filter(r=>!['Cancelled','Draft'].includes(r.status));report.metrics=[metric('Activities in period',rows.length),metric('Scheduled / completed',scheduled.length),metric('Cancelled',rows.filter(r=>r.status==='Cancelled').length),metric('Upcoming',scheduled.filter(r=>reportDate(r.startDate)>=reportDate(now)).length)];
      table('Activities by type',['Type','Activities'],groups(rows,r=>r.type));table('Activity status',['Status','Activities'],groups(rows,r=>r.status));table('Activity schedule',['Start','End','Activity','Type','Status'],rows.slice().sort((a,b)=>a.startDate.localeCompare(b.startDate)).map(r=>[reportDate(r.startDate),reportDate(r.endDate||r.startDate),r.title,r.type,r.status]));report.notes=['Saved calendar activities overlapping the chosen date range; auto-generated public holidays and exam-derived calendar duplicates are not added to this source. Recurrence rules are not expanded into individual occurrences.'];break;
    }
    case 'timetable': {
      const entries=data.timetable.flatMap(row=>row.entries),lessons=entries.filter(r=>r.entryType!=='activity'),unassigned=lessons.filter(r=>!r.teacherId || !r.subjectId);
      report.metrics=[metric('Timetable profiles',data.timetable.length),metric('Lesson assignments',lessons.length),metric('Classes scheduled',new Set(entries.map(r=>r.classId)).size),metric('Unassigned lessons',unassigned.length)];
      table('Timetable profiles',['Profile','Classes in scope','Assignments'],data.timetable.map(row=>[row.profile.name,row.profile.classIds?.length||0,row.entries.length]));
      table('Teacher assignment load',['Teacher','Lesson slots'],groups(lessons.flatMap(row=>[...new Set([row.teacherId,row.coTeacherId,row.optionalTeacherId,row.coOptionalTeacherId].filter(Boolean))].map(teacherId=>({teacherId})).concat(!row.teacherId&&!row.coTeacherId&&!row.optionalTeacherId&&!row.coOptionalTeacherId?[{teacherId:'Unassigned'}]:[])),row=>{const member=data.staff?.find(member=>member.id===row.teacherId);return member?`${member.firstName} ${member.lastName}`:row.teacherId||'Unassigned';}));
      report.notes=['Saved assignments in the selected academic term(s), not lessons actually taught. Teacher load includes main, co-teacher and optional-subject assignments, once per teacher per slot. Counts across multiple profiles/terms can repeat a class or teacher. This report does not infer attendance, taught hours or timetable conflicts.'];break;
    }
  }
  return report;
}
