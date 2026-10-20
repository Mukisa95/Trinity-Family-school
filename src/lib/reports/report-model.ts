import type { AcademicYear, AttendanceRecord, Class, Event, Exam, ExamResult, InventoryItem, PaymentRecord, ProcurementBudget, ProcurementPurchase, Pupil, Staff, Account, UniformTracking, RequirementTracking, TimetableEntry, TimetableProfile, SystemUser, FeeStructure } from '@/types';
import type { PayrollSpendSummary } from '@/lib/payroll/payroll-accounting';
import { canUseSidebarRoute } from '@/components/layout/sidebar-navigation';

export type ReportSectionId = 'enrollment' | 'fees' | 'finance' | 'attendance' | 'academics' | 'staff' | 'payroll' | 'procurement' | 'requirements' | 'uniforms' | 'inventory' | 'banking' | 'events' | 'timetable';
export type ReportSourceId = 'pupils' | 'classes' | 'staff' | 'payments' | 'feeStructures' | 'assessments' | 'cashPayments' | 'attendance' | 'exams' | 'results' | 'purchases' | 'budgets' | 'payroll' | 'requirements' | 'uniforms' | 'inventory' | 'banking' | 'events' | 'timetable';
export type ReportPeriod = { year: AcademicYear; termId: string; start: string; end: string; label: string };
export type ReportValue = string | number;
export type ReportMetric = { label: string; value: ReportValue; format?: 'number' | 'money' | 'percent'; detail?: string };
export type ReportTable = { title: string; columns: string[]; rows: ReportValue[][]; moneyColumns?: number[]; detail?: boolean };
export type ReportSection = { id: ReportSectionId; title: string; description: string; metrics: ReportMetric[]; insights: string[]; notes: string[]; tables: ReportTable[] };
export type ReportData = {
  pupils: Pupil[]; classes: Class[]; staff: Staff[]; payments: PaymentRecord[]; feeStructures: FeeStructure[]; assessments: { rows: { pupilId:string; pupilName:string; admission:string; className:string; termName:string; assessed:number; paid:number; balance:number }[]; missingHistorical:number }; cashPayments: PaymentRecord[]; attendance: AttendanceRecord[];
  exams: Exam[]; results: { exam: Exam; result: ExamResult | null }[]; purchases: ProcurementPurchase[]; budgets: ProcurementBudget[];
  payroll: PayrollSpendSummary; requirements: RequirementTracking[]; uniforms: UniformTracking[]; inventory: InventoryItem[];
  banking: Account[]; events: Event[]; timetable: { profile: TimetableProfile; entries: TimetableEntry[] }[];
};
export type ReportDefinition = { id: ReportSectionId; title: string; description: string; group: 'School' | 'Finance' | 'Operations'; routes: string[]; sources: ReportSourceId[] };
export const REPORT_SECTIONS: ReportDefinition[] = [
  { id:'enrollment', title:'Enrollment & classes', description:'Pupil status, class sizes, boarding and record completeness', group:'School', routes:['/pupils','/classes'], sources:['pupils','classes'] },
  { id:'fees', title:'Fees collection', description:'Receipts, paying pupils, class collections and fee allocation', group:'Finance', routes:['/fees/collection'], sources:['payments','pupils','classes','feeStructures','assessments'] },
  { id:'finance', title:'Income & expenditure', description:'Recorded fee income, procurement costs and salary payments', group:'Finance', routes:['/fees/collection','/procurement/purchases','/payroll'], sources:['cashPayments','purchases','payroll'] },
  { id:'attendance', title:'Attendance', description:'Recorded attendance, trends, class coverage and repeated absence', group:'School', routes:['/attendance'], sources:['attendance'] },
  { id:'academics', title:'Exams & performance', description:'Exam progress, result completeness and subject performance', group:'School', routes:['/exams'], sources:['exams','results'] },
  { id:'staff', title:'Staff', description:'Staff status, departments, roles and contact completeness', group:'School', routes:['/staff'], sources:['staff'] },
  { id:'payroll', title:'Payroll expenditure', description:'Salary payments, payment methods and staff paid', group:'Finance', routes:['/payroll'], sources:['payroll'] },
  { id:'procurement', title:'Procurement & budgets', description:'Purchase categories, suppliers, approvals and budget plans', group:'Finance', routes:['/procurement/purchases','/procurement/budget'], sources:['purchases','budgets'] },
  { id:'requirements', title:'Requirements', description:'Payment and delivery progress in the selected academic period', group:'Operations', routes:['/requirement-tracking'], sources:['requirements'] },
  { id:'uniforms', title:'Uniforms', description:'Orders, amounts due, collections and uncollected items', group:'Operations', routes:['/uniform-tracking'], sources:['uniforms'] },
  { id:'inventory', title:'Inventory & assets', description:'Current stock, asset values, reorder needs and condition', group:'Operations', routes:['/inventory'], sources:['inventory'] },
  { id:'banking', title:'Pupil banking', description:'Current savings balances and account status', group:'Finance', routes:['/banking/list'], sources:['banking'] },
  { id:'events', title:'Events & calendar', description:'Activities, status, cancellations and upcoming commitments', group:'School', routes:['/events'], sources:['events'] },
  { id:'timetable', title:'Timetable coverage', description:'Saved lesson assignments, classes and teaching workload', group:'School', routes:['/timetable'], sources:['timetable'] },
];
export function permittedReportSections(user: SystemUser | null) {
  if (!canUseSidebarRoute(user, '/reports')) return [];
  return REPORT_SECTIONS.filter(section => section.routes.every(route => canUseSidebarRoute(user, route)));
}
export function requiredReportSources(ids: ReportSectionId[]): ReportSourceId[] {
  return [...new Set(REPORT_SECTIONS.filter(section => ids.includes(section.id)).flatMap(section => section.sources))];
}
export function reportPeriod(year: AcademicYear, termId: string): ReportPeriod {
  const term = year.terms.find(item => item.id === termId);
  return { year, termId: term?.id || '', start: (term?.startDate || year.startDate).slice(0,10), end: (term?.endDate || year.endDate).slice(0,10), label: `${year.name}${term ? ` - ${term.name}` : ' - Full year'}` };
}
const schoolDateFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Kampala',year:'numeric',month:'2-digit',day:'2-digit'});
export function reportDate(value: unknown): string {
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return reportDate(new Date(value));
    return '';
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) return schoolDateFormatter.format(value);
  if (value && typeof value === 'object') {
    const data = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof data.toDate === 'function') return reportDate(data.toDate());
    const seconds = data.seconds ?? data._seconds;
    if (typeof seconds === 'number') return reportDate(new Date(seconds * 1000));
  }
  return '';
}
export const inReportPeriod = (value: unknown, period: ReportPeriod) => { const date=reportDate(value); return !!date && date>=period.start && date<=period.end; };
export const reportNumber = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
export function formatReportValue(value: ReportValue, format: ReportMetric['format'] = 'number'): string {
  if (typeof value === 'string') return value;
  return `${format === 'money' ? 'UGX ' : ''}${new Intl.NumberFormat('en-UG',{maximumFractionDigits:format === 'percent' ? 1 : 0}).format(value)}${format === 'percent' ? '%' : ''}`;
}
export type ReportDocument = { title: string; schoolName: string; schoolContact?: string; period: ReportPeriod; generatedAt: string; preparedBy: string; sections: ReportSection[]; includeDetails: boolean; notes?: string[] };
