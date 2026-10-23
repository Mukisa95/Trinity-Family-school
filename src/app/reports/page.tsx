"use client";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Download, FileText, LayoutGrid, Loader2, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { GlassActionButton, GlassActionDock, GlassPageSearchInput, GlassPageTopBar } from '@/components/common/glass-page-top-bar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ReportSectionCard } from '@/components/reports/center/report-section-card';
import { useAuth } from '@/lib/contexts/auth-context';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { useSchoolSettings } from '@/lib/hooks/use-school-settings';
import { usePDFViewer } from '@/lib/hooks/use-pdf-viewer';
import { createPdfFileName } from '@/lib/printing/document-file-name';
import { useAndroidOfflineStatus } from '@/lib/hooks/use-android-offline-status';
import { getEffectiveTermForDataDisplay } from '@/lib/utils/term-status-utils';
import { buildReportSection } from '@/lib/reports/report-analysis';
import { permittedReportSections, reportPeriod, requiredReportSources, type ReportData, type ReportDefinition, type ReportDocument, type ReportSectionId } from '@/lib/reports/report-model';
import { loadReportSource, reportAccessScope, reportSourceKey } from '@/lib/reports/report-sources';
import './reports.css';
const PDFViewer=lazy(()=>import('@/components/pdf/pdf-viewer').then(module=>({default:module.PDFViewer})));
type ReportGroup='All'|ReportDefinition['group'];
export default function ReportsPage(){
  const {user,canPerformAction}=useAuth(),queryClient=useQueryClient(),pdfViewer=usePDFViewer();
  const {data:years=[]}=useAcademicYears(),{data:school}=useSchoolSettings(),offline=useAndroidOfflineStatus();
  const actor=user?reportAccessScope(user):'',actorRef=useRef(actor),forceCatalogRead=useRef(false);actorRef.current=actor;
  const available=useMemo(()=>permittedReportSections(user),[actor]);
  const [selected,setSelected]=useState<ReportSectionId[]>([]),[yearId,setYearId]=useState(''),[termId,setTermId]=useState('');
  const [group,setGroup]=useState<ReportGroup>('All'),[search,setSearch]=useState(''),[builder,setBuilder]=useState(false),[details,setDetails]=useState(false),[generating,setGenerating]=useState(false),[error,setError]=useState('');
  const canPrint=canPerformAction('reports','reports','print_reports'),canExport=canPerformAction('reports','reports','export_reports');
  const canBuild=canPrint||canExport;
  useEffect(()=>{setSelected(available.map(section=>section.id));setBuilder(false);setError('');setSearch('');setGroup('All');},[actor]);
  useEffect(()=>{if(yearId||!years.length)return;const current=getEffectiveTermForDataDisplay(years);setYearId(current?.academicYear?.id||years.find(year=>year.isActive)?.id||years[0].id);setTermId(current?.term?.id||'');},[years,yearId]);
  const year=years.find(year=>year.id===yearId),period=useMemo(()=>year?reportPeriod(year,termId):null,[year,termId]);
  const chosen=available.filter(section=>selected.includes(section.id)),sources=requiredReportSources(chosen.map(section=>section.id));
  const context=user&&period?{user,period,queryClient,years}:null;
  const queries=useQueries({queries:sources.map(source=>({queryKey:context?reportSourceKey(source,context):['report-center','waiting',source],queryFn:()=>loadReportSource(source,{...context!,forceRefresh:forceCatalogRead.current}),enabled:!!context,staleTime:0,retry:1,refetchOnMount:'always' as const,refetchOnReconnect:'always' as const,refetchOnWindowFocus:false}))});
  const states=new Map(sources.map((source,index)=>[source,queries[index]]));
  const data=Object.fromEntries(sources.map((source,index)=>[source,queries[index].data])) as ReportData;
  const ready=chosen.filter(section=>section.sources.every(source=>states.get(source)?.data!==undefined&&!states.get(source)?.isError));
  const readyKey=ready.map(section=>section.id).join(':');
  const sourceVersion=queries.map(query=>`${query.dataUpdatedAt}:${query.isError}`).join(':');
  const reports=useMemo(()=>period?ready.map(section=>buildReportSection(section.id,data,period)):[],[period,actor,readyKey,sourceVersion]);
  const loading=queries.some(query=>query.isFetching||query.data===undefined&&!query.isError),failed=chosen.filter(section=>section.sources.some(source=>states.get(source)?.isError));
  const readyToBuild=!!period&&chosen.length>0&&ready.length===chosen.length&&!loading&&!generating;
  const visible=chosen.filter(section=>(group==='All'||section.group===group)&&`${section.title} ${section.description}`.toLowerCase().includes(search.toLowerCase()));
  const changeYear=(id:string)=>{setYearId(id);setTermId('');};
  const toggle=(id:ReportSectionId)=>setSelected(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id]);
  const refresh=async()=>{forceCatalogRead.current=!offline;try{await queryClient.invalidateQueries({queryKey:['report-center',actor],refetchType:'none'});await Promise.all(queries.map(query=>query.refetch()));}finally{forceCatalogRead.current=false;}};
  const generate=async()=>{
    if(!user||!period||!canBuild||!readyToBuild)return;
    const expectedActor=actor;setGenerating(true);setError('');
    const document:ReportDocument={title:chosen.length===1?`${chosen[0].title} report`:'School management report',schoolName:school?.generalInfo?.name||'School reports',period,generatedAt:new Date().toISOString(),preparedBy:[user.firstName,user.lastName].filter(Boolean).join(' ')||user.username||'Authorized user',sections:reports,includeDetails:details,notes:offline?['Generated while offline. Saved records may be incomplete; verify transaction coverage when connected.']:[]};
    try{
      setBuilder(false);
      await pdfViewer.runPDFJob({fileName:createPdfFileName(document.title, year?.name, termId ? year?.terms.find(term=>term.id===termId)?.name || 'Term' : 'Full Year'),title:document.title,initialMessage:'Organizing selected report sections…'},async({signal,updateProgress})=>{
        updateProgress(15,'Preparing report layout…');const {generateSchoolReportPdf}=await import('@/lib/reports/report-pdf');
        if(signal.aborted||actorRef.current!==expectedActor)throw new Error('The report session changed. Open Reports again.');
        updateProgress(40,'Building analysis, contents and tables…');await new Promise<void>(resolve=>setTimeout(resolve,0));
        const pdf=generateSchoolReportPdf(document);if(signal.aborted||actorRef.current!==expectedActor)throw new Error('Report generation cancelled.');
        updateProgress(95,'Preparing PDF preview…');return pdf.output('blob');
      });
    }catch(cause){setError(cause instanceof Error?cause.message:'The report PDF could not be generated.');}finally{setGenerating(false);}
  };
  return <div className="reports-page min-h-screen pb-24 sm:pb-6">
    <div className="reports-controls"><GlassPageTopBar title="Reports" backHref="/" backLabel="Dashboard" inlineActions recordDetails={period?.label}
      actionsLeading={available.length?<GlassPageSearchInput className="max-w-full" aria-label="Search reports" placeholder="Search..." value={search} onChange={event=>setSearch(event.target.value)}/>:undefined}
      actions={available.length?<GlassActionDock>
        <GlassActionButton label="Sections" aria-label="Choose report sections" icon={<SlidersHorizontal/>} onClick={()=>setBuilder(true)}/>
        <Popover><PopoverTrigger asChild><GlassActionButton label="Period" icon={<CalendarDays/>}/></PopoverTrigger><PopoverContent align="end" className="w-72 space-y-3 rounded-2xl"><h2 className="text-sm font-semibold">Reporting period</h2><label className="block space-y-1 text-xs">Academic year<select aria-label="Report academic year" className="h-10 w-full rounded-xl border bg-background px-3" value={yearId} onChange={event=>changeYear(event.target.value)}>{years.map(year=><option key={year.id} value={year.id}>{year.name}</option>)}</select></label><label className="block space-y-1 text-xs">Term<select aria-label="Report term" className="h-10 w-full rounded-xl border bg-background px-3" value={termId} onChange={event=>setTermId(event.target.value)}><option value="">Full year</option>{year?.terms.map(term=><option key={term.id} value={term.id}>{term.name}</option>)}</select></label><p className="text-[11px] text-muted-foreground">Financial and activity records use this period. Current snapshots are labelled within their sections.</p></PopoverContent></Popover>
        <DropdownMenu><DropdownMenuTrigger asChild><GlassActionButton label="View" title={`View: ${group}`} icon={<LayoutGrid/>}/></DropdownMenuTrigger><DropdownMenuContent align="center"><DropdownMenuRadioGroup value={group} onValueChange={value=>setGroup(value as ReportGroup)}>{(['All','School','Finance','Operations'] as const).map(value=><DropdownMenuRadioItem value={value} key={value}>{value}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu>
        <GlassActionButton label="Refresh" icon={<RefreshCw/>} disabled={!context||queries.some(query=>query.isFetching)} onClick={()=>void refresh()}/>
        {canBuild&&<GlassActionButton label="PDF" icon={<Download/>} onClick={()=>setBuilder(true)} disabled={generating}/>}</GlassActionDock>:undefined}/></div>
    <div className="reports-content mx-auto max-w-7xl space-y-4 px-1 sm:px-3">
      {!available.length?<Card className="rounded-2xl"><CardContent className="py-14 text-center"><FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground"/><h2 className="font-semibold">No report sections available</h2><p className="mt-2 text-sm text-muted-foreground">Reports requires access to the corresponding school components.</p></CardContent></Card>:<>
        <div className="flex flex-wrap items-end justify-between gap-2 py-1"><div><p className="text-[10px] font-bold uppercase tracking-widest text-brand-ink-600 dark:text-brand-ink-400">{school?.generalInfo?.name||'School reports'}</p><h2 className="mt-1 text-lg font-bold text-brand-alt-ink-900 dark:text-brand-alt-ink-200">School reports</h2></div><p role="status" className="text-xs text-muted-foreground">{ready.length} of {chosen.length} sections ready{loading?' · Loading records…':''}</p></div>
        {error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">{error}</p>}
        {!period&&<p role="status" className="rounded-xl border p-4 text-sm text-muted-foreground">Loading academic periods…</p>}
        {!chosen.length&&<Card className="rounded-2xl"><CardContent className="py-10 text-center"><h3 className="font-semibold">Choose the components to report on</h3><p className="mt-2 text-sm text-muted-foreground">Include only the areas you need for this report.</p><Button className="mt-4 rounded-full" onClick={()=>setBuilder(true)}>Choose sections</Button></CardContent></Card>}
        <div className="report-charts grid grid-cols-1 items-start gap-4 xl:grid-cols-2">{visible.map(section=>{
          const report=reports.find(report=>report.id===section.id);if(report)return <ReportSectionCard key={`${actor}:${period?.label}:${section.id}`} report={report}/>;
          const problem=failed.includes(section);return <Card key={section.id} className="report-panel rounded-2xl border-brand-100/70 bg-white/85 dark:border-slate-700 dark:bg-slate-900/85"><CardContent className="p-5"><h3 className="text-sm font-bold">{section.title}</h3>{problem?<><p className="mt-3 text-xs text-rose-700 dark:text-rose-300">This section could not load completely. It cannot be exported until its sources are available.</p><Button className="mt-3 rounded-full" variant="outline" size="sm" onClick={()=>section.sources.forEach(source=>void states.get(source)?.refetch())}>Retry section</Button></>:<p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>{offline?'Waiting for saved records or a connection…':'Loading report records…'}</p>}</CardContent></Card>;
        })}</div>
        {!!chosen.length&&!visible.length&&<p className="py-10 text-center text-sm text-muted-foreground">No selected sections match this view or search.</p>}
      </>}
    </div>
    <Dialog open={builder} onOpenChange={setBuilder}><DialogContent className="flex max-h-[88dvh] max-w-2xl flex-col overflow-hidden rounded-2xl"><DialogHeader><DialogTitle>Build your report</DialogTitle><DialogDescription>Choose the components to include. The PDF starts with a simple summary, explains the figures and includes clickable sections. Full pupil lists are optional.</DialogDescription></DialogHeader>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-medium">{period?.label||'Choose an academic period'} · {selected.length} selected</p><div className="flex gap-2"><Button size="sm" variant="ghost" className="h-8 rounded-full text-xs" onClick={()=>setSelected(available.map(section=>section.id))}>Select all</Button><Button size="sm" variant="ghost" className="h-8 rounded-full text-xs" onClick={()=>setSelected([])}>Clear</Button></div></div>
        <div className="grid grid-cols-2 gap-3 rounded-xl border p-3"><label className="space-y-1 text-xs font-medium">Academic year<select aria-label="PDF academic year" className="h-10 w-full rounded-xl border bg-background px-2 text-xs" value={yearId} onChange={event=>changeYear(event.target.value)}>{years.map(year=><option key={year.id} value={year.id}>{year.name}</option>)}</select></label><label className="space-y-1 text-xs font-medium">Period<select aria-label="PDF reporting term" className="h-10 w-full rounded-xl border bg-background px-2 text-xs" value={termId} onChange={event=>setTermId(event.target.value)}><option value="">Full year</option>{year?.terms.map(term=><option key={term.id} value={term.id}>{term.name}</option>)}</select></label></div>
        {(['School','Finance','Operations'] as const).map(group=><fieldset key={group} className="space-y-2"><legend className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{group}</legend><div className="grid gap-2 sm:grid-cols-2">{available.filter(section=>section.group===group).map(section=><label key={section.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${selected.includes(section.id)?'border-brand-300 bg-brand-surface-50/70 dark:border-brand-700 dark:bg-brand-surface-950/30':'border-border'}`}><input type="checkbox" aria-label={section.title} checked={selected.includes(section.id)} onChange={()=>toggle(section.id)} className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"/><span><span className="block text-xs font-semibold">{section.title}</span><span className="mt-1 block text-[11px] text-muted-foreground">{section.description}</span></span></label>)}</div></fieldset>)}
        <label className="flex items-start gap-3 rounded-xl border p-3"><input type="checkbox" aria-label="Include supporting registers" className="mt-0.5 h-4 w-4 accent-brand-600" checked={details} onChange={event=>setDetails(event.target.checked)}/><span><span className="block text-xs font-semibold">Include supporting registers</span><span className="mt-1 block text-[11px] text-muted-foreground">Adds full pupil payment lists, unpaid-fee lists, purchases and account balances at the back of the PDF. All summary tables are included either way.</span></span></label>
        {failed.length>0&&<p role="alert" className="text-xs text-rose-700 dark:text-rose-300">Unavailable: {failed.map(section=>section.title).join(', ')}. Retry or deselect these sections to generate a complete selected report.</p>}
      </div>
      <DialogFooter className="border-t pt-3"><Button variant="outline" className="rounded-full" onClick={()=>setBuilder(false)}>Done</Button>{canBuild&&<Button className="rounded-full" onClick={generate} disabled={!readyToBuild}>{generating||loading?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Download className="mr-2 h-4 w-4"/>}Generate PDF</Button>}</DialogFooter>
    </DialogContent></Dialog>
    {pdfViewer.isOpen&&<Suspense fallback={null}><PDFViewer isOpen={pdfViewer.isOpen} onClose={pdfViewer.closePDF} pdfBlob={pdfViewer.pdfBlob} fileName={pdfViewer.fileName} title={pdfViewer.title} showDownload={canExport} showPrint={canPrint}/></Suspense>}
  </div>;
}
