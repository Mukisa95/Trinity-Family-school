import { buildReportSection } from './report-analysis';
import { canPrintFeesCollectionReport,requiredReportSources,type ReportData,type ReportDocument } from './report-model';
import { loadReportSource,reportSourceKey,type ReportLoadContext } from './report-sources';

/** The same fees analysis and sources as Reports, fetched only on request. */
export async function loadFeesCollectionReport(context:ReportLoadContext,options:{
  schoolName:string;
  offline:boolean;
  signal?:AbortSignal;
  assertCurrent?:()=>void;
  onProgress?:(progress:number,message:string)=>void;
}):Promise<ReportDocument> {
  if(!canPrintFeesCollectionReport(context.user))throw new Error('You do not have permission to print collection reports.');
  if(!context.period.termId||!context.period.year.terms.some(term=>term.id===context.period.termId))throw new Error('Choose an academic year and term before printing.');
  const check=()=>{
    if(options.signal?.aborted)throw new DOMException('Report generation cancelled.','AbortError');
    options.assertCurrent?.();
  };
  check();
  // Firestore can read its saved records in airplane mode. Let both the
  // requested sources and assessment dependencies run instead of pausing
  // indefinitely in the query client's default online-only mode.
  const sourceContext:ReportLoadContext={...context,networkMode:options.offline?'always':'online'};
  const sources=requiredReportSources(['fees']);let completed=0;
  const entries=await Promise.all(sources.map(async source=>{
    const result=await context.queryClient.fetchQuery({queryKey:reportSourceKey(source,sourceContext),queryFn:()=>loadReportSource(source,sourceContext),staleTime:0,retry:false,networkMode:sourceContext.networkMode});
    check();options.onProgress?.(10+(++completed/sources.length)*55,'Checking fee records…');
    return [source,result] as const;
  }));
  check();
  const now=new Date(),data=Object.fromEntries(entries) as ReportData;
  return {title:'Fees collection report',schoolName:options.schoolName,period:context.period,generatedAt:now.toISOString(),
    preparedBy:[context.user.firstName,context.user.lastName].filter(Boolean).join(' ')||context.user.username||'Authorized user',
    sections:[buildReportSection('fees',data,context.period,now)],includeDetails:false,
    notes:options.offline?['Generated while offline. Saved records may be incomplete; verify transaction coverage when connected.']:[]};
}
