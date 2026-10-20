import type { QueryClient } from '@tanstack/react-query';
import type { SystemUser, Exam, Event, AcademicYear, UniformTracking, RequirementTracking, PaymentRecord } from '@/types';
import { collection, getDocs, query, where, Timestamp } from '@/lib/access/scoped-firestore';
import { db } from '@/lib/firebase';
import { authorizedFetch } from '@/lib/access/authorized-fetch';
import type { ReportData, ReportPeriod, ReportSourceId } from './report-model';
import { reportDate, inReportPeriod } from './report-model';
import { circumferenceCacheSuffix } from '@/lib/access/circumference-session';

export type ReportLoadContext = { user: SystemUser; period: ReportPeriod; queryClient: QueryClient; years?: AcademicYear[]; forceRefresh?: boolean; networkMode?: 'online' | 'always' };
/** Includes access changes so a narrowed session cannot reuse a wider report snapshot. */
export function reportAccessScope(user: SystemUser) {
  return `${user.id}:${user.role}:${JSON.stringify([user.granularPermissions || [],(user as SystemUser & {permissions?:unknown}).permissions || []])}${circumferenceCacheSuffix(user.id)}`;
}
export function reportSourceKey(source: ReportSourceId, context: ReportLoadContext) {
  return ['report-center', reportAccessScope(context.user), context.period.year.id, context.period.termId, context.period.start, context.period.end, source] as const;
}
async function academicRecords<T>(name: string, period: ReportPeriod): Promise<T[]> {
  const constraints = [where('academicYearId','==',period.year.id)];
  if (period.termId) constraints.push(where('termId','==',period.termId));
  const snapshot = await getDocs(query(collection(db,name),...constraints));
  return snapshot.docs.map(doc => ({...doc.data(),id:doc.id}) as T);
}
/** Legacy date fields can contain ISO strings or Firestore timestamps. Read both bounded ranges. */
async function dateRecords<T>(name: string, field: string, period: ReportPeriod): Promise<T[]> {
  const reads = await Promise.all([
    getDocs(query(collection(db,name),where(field,'>=',reportDate(new Date(new Date(`${period.start}T00:00:00+03:00`).getTime()-86400000))),where(field,'<=',`${reportDate(new Date(new Date(`${period.end}T00:00:00+03:00`).getTime()+86400000))}T23:59:59.999Z`))),
    getDocs(query(collection(db,name),where(field,'>=',Timestamp.fromDate(new Date(`${period.start}T00:00:00+03:00`))),where(field,'<=',Timestamp.fromDate(new Date(`${period.end}T23:59:59.999+03:00`))))),
  ]);
  return [...new Map(reads.flatMap(result=>result.docs).map(doc=>[doc.id,{...doc.data(),id:doc.id} as T])).values()].filter(record=>inReportPeriod((record as Record<string,unknown>)[field],period));
}
export async function loadReportSource<S extends ReportSourceId>(source:S, context:ReportLoadContext):Promise<ReportData[S]> {
  const {user,period,queryClient}=context;
  const dependency = <K extends ReportSourceId>(id:K) => queryClient.fetchQuery({queryKey:reportSourceKey(id,context),queryFn:()=>loadReportSource(id,context),staleTime:0,networkMode:context.networkMode});
  let result: ReportData[ReportSourceId];
  switch(source) {
    case 'pupils': {
      const {getPupilCacheScope,readPupilCache}=await import('@/lib/cache/pupil-cache');
      const cached=await readPupilCache(getPupilCacheScope(user.id,user.role));
      result=(!context.forceRefresh?cached?.data:undefined) ?? await (await import('@/lib/services/pupils.service')).PupilsService.getAllForCache();break;
    }
    case 'classes': {
      const {getClassCacheScope,readClassCache}=await import('@/lib/cache/class-cache');
      result=(!context.forceRefresh?readClassCache(getClassCacheScope(user.id,user.role))?.data:undefined) ?? await (await import('@/lib/services/classes.service')).ClassesService.getAllForCache();break;
    }
    case 'staff': {
      const {getStaffCacheScope,readStaffCache}=await import('@/lib/cache/staff-cache');
      result=(!context.forceRefresh?readStaffCache(getStaffCacheScope(user.id,user.role))?.data:undefined) ?? await (await import('@/lib/services/staff.service')).StaffService.getAllForCache();break;
    }
    case 'payments': result=await academicRecords<PaymentRecord>('payments',period);break;
    case 'feeStructures': result=await (await import('@/lib/services/fee-structures.service')).FeeStructuresService.getAllFeeStructures();break;
    case 'assessments': {
      const [pupils,fees,payments,classes]=await Promise.all([dependency('pupils'),dependency('feeStructures'),dependency('payments'),dependency('classes')]);
      const {assessReportFees}=await import('./report-fee-assessment');result=await assessReportFees(pupils,fees,payments,period,context.years,classes);break;
    }
    case 'cashPayments': result=await dateRecords<PaymentRecord>('payments','paymentDate',period);break;
    case 'attendance': result=await (await import('@/lib/services/attendance.service')).AttendanceService.getAttendanceByDateRange(period.start,period.end);break;
    case 'purchases': result=await dateRecords<ReportData['purchases'][number]>('procurementPurchases','purchaseDate',period);break;
    case 'budgets': result=await (await import('@/lib/services/procurement.service')).ProcurementService.getBudgets();break;
    case 'payroll': {
      const response=await authorizedFetch(`/api/payroll/accounting?${new URLSearchParams({startDate:period.start,endDate:period.end})}`);
      const body=await response.json();if(!response.ok || !body.success)throw new Error(body.error || 'Salary payments could not be loaded.');result=body.result;break;
    }
    case 'requirements': result=await academicRecords<RequirementTracking>('requirement-tracking',period);break;
    case 'uniforms': result=await academicRecords<UniformTracking>('uniformTracking',period);break;
    case 'uniformItems': { const snapshot=await getDocs(collection(db,'uniforms'));result=snapshot.docs.map(doc=>({...doc.data(),id:doc.id}) as ReportData['uniformItems'][number]);break; }
    case 'inventory': { const snapshot=await getDocs(collection(db,'inventoryItems'));result=snapshot.docs.map(doc=>({...doc.data(),id:doc.id}) as ReportData['inventory'][number]);break; }
    case 'banking': result=await (await import('@/lib/services/banking.service')).BankingService.getAllAccounts();break;
    case 'exams': {
      result=await (await import('@/lib/services/exams.service')).ExamsService.getExamsByAcademicYearAndTerm(period.year.id,period.termId || undefined);break;
    }
    case 'results': {
      const exams=await dependency('exams');
      const {ExamsService}=await import('@/lib/services/exams.service');
      const records: ReportData['results']=[];
      // Keep reads bounded in flight. A missing result is distinct from a failed read.
      for(let start=0;start<exams.length;start+=3)records.push(...await Promise.all(exams.slice(start,start+3).filter(exam=>exam.status!=='Cancelled').map(async exam=>({exam,result:await ExamsService.getExamResultByExamId(exam.id)}))));
      result=records;break;
    }
    case 'events': {
      // Overlapping activities can begin before the selected term. Bound by the year end,
      // then keep only intervals intersecting this period; do not scan future calendars.
      const snapshot=await getDocs(query(collection(db,'events'),where('startDate','<=',`${period.end}T23:59:59.999Z`)));
      result=snapshot.docs.map(doc=>({...doc.data(),id:doc.id}) as Event).filter(event=>reportDate(event.endDate || event.startDate)>=period.start);break;
    }
    case 'timetable': {
      const {TimetableService}=await import('@/lib/services/timetable.service');
      const terms=period.termId?period.year.terms.filter(term=>term.id===period.termId):period.year.terms;
      const profiles: ReportData['timetable']=[];
      for(const term of terms){const list=await TimetableService.getTimetables(period.year.id,term.id);for(const profile of list)profiles.push({profile,entries:await TimetableService.getEntries(period.year.id,term.id,profile.id)});}
      result=profiles;break;
    }
    default: throw new Error(`Unsupported report source: ${source}`);
  }
  return result as ReportData[S];
}
