"use client";

import { lazy,Suspense,useEffect,useRef,useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2,Printer } from 'lucide-react';
import { GlassActionButton } from '@/components/common/glass-page-top-bar';
import { Button } from '@/components/ui/button';
import { Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/lib/contexts/auth-context';
import { useSchoolSettings } from '@/lib/hooks/use-school-settings';
import { usePDFViewer } from '@/lib/hooks/use-pdf-viewer';
import { useAndroidOfflineStatus } from '@/lib/hooks/use-android-offline-status';
import { canPrintFeesCollectionReport,reportPeriod } from '@/lib/reports/report-model';
import { reportAccessScope } from '@/lib/reports/report-sources';
import { createPdfFileName } from '@/lib/printing/document-file-name';
import type { AcademicYear } from '@/types';

const PDFViewer=lazy(()=>import('@/components/pdf/pdf-viewer').then(module=>({default:module.PDFViewer})));

export function FeesCollectionPrintButton({year,termId,years}:{year?:AcademicYear;termId:string;years:AcademicYear[]}) {
  const {user}=useAuth(),queryClient=useQueryClient(),viewer=usePDFViewer();
  const {data:school,isLoading:schoolLoading}=useSchoolSettings(),offline=useAndroidOfflineStatus();
  const [generating,setGenerating]=useState(false),[error,setError]=useState('');
  const busy=useRef(false),mounted=useRef(true);
  const allowed=canPrintFeesCollectionReport(user);
  const period=year&&termId&&year.terms.some(term=>term.id===termId)?reportPeriod(year,termId):null;
  const scope=allowed&&user&&period?`${reportAccessScope(user)}:${period.year.id}:${period.termId}:${period.start}:${period.end}`:'';
  const currentScope=useRef(scope);currentScope.current=scope;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;currentScope.current='';};},[]);
  useEffect(()=>{setError('');},[scope]);

  const generate=async()=>{
    if(!allowed||!user||!period||busy.current||schoolLoading)return;
    const expectedScope=scope,context={user,period,queryClient,years,forceRefresh:!offline};
    const assertCurrent=()=>{if(!mounted.current||currentScope.current!==expectedScope)throw new DOMException('The reporting period or account changed. Print the selected period again.','AbortError');};
    busy.current=true;setGenerating(true);setError('');
    try{
      await viewer.runPDFJob({fileName:createPdfFileName('Fees Collection Report', period.year.name, year?.terms.find(term=>term.id===termId)?.name || 'Term'),title:`Fees collection report / ${period.label}`,initialMessage:'Fetching fee collection records…'},async({signal,updateProgress})=>{
        assertCurrent();
        const {loadFeesCollectionReport}=await import('@/lib/reports/fees-collection-report');
        const report=await loadFeesCollectionReport(context,{schoolName:school?.generalInfo?.name||'School reports',offline,signal,assertCurrent,onProgress:updateProgress});
        assertCurrent();updateProgress(75,'Building the fees collection analysis…');
        const {generateSchoolReportPdf}=await import('@/lib/reports/report-pdf');
        if(signal.aborted)throw new DOMException('Report generation cancelled.','AbortError');
        assertCurrent();await new Promise<void>(resolve=>setTimeout(resolve,0));assertCurrent();
        const pdf=generateSchoolReportPdf(report);
        if(signal.aborted)throw new DOMException('Report generation cancelled.','AbortError');
        assertCurrent();updateProgress(95,'Opening the report for printing…');return pdf.output('blob');
      });
    }catch(cause){
      if(mounted.current&&currentScope.current===expectedScope&&!(cause instanceof DOMException&&cause.name==='AbortError')){
        setError(cause instanceof Error?cause.message:'The fees collection report could not be prepared. Try again.');
      }
    }finally{busy.current=false;if(mounted.current)setGenerating(false);}
  };

  if(!allowed)return null;
  return <>
    <GlassActionButton label="Print" aria-label="Print fees collection report" aria-busy={generating} title={period?`Print fees collection report for ${period.label}`:'Choose an academic year and term to print'} icon={generating?<Loader2 className="h-4 w-4 animate-spin"/>:<Printer className="h-4 w-4"/>} onClick={()=>void generate()} disabled={!period||generating||schoolLoading}/>
    <Dialog open={!!error} onOpenChange={open=>{if(!open)setError('');}}><DialogContent className="rounded-2xl"><DialogHeader><DialogTitle>Report could not be prepared</DialogTitle><DialogDescription>{error} Check your connection and try printing again.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" className="rounded-full" onClick={()=>setError('')}>Close</Button><Button className="rounded-full" onClick={()=>void generate()} disabled={generating||!period}>Try again</Button></DialogFooter></DialogContent></Dialog>
    {viewer.isOpen&&<Suspense fallback={null}><PDFViewer isOpen={viewer.isOpen} onClose={viewer.closePDF} pdfBlob={viewer.pdfBlob} fileName={viewer.fileName} title={viewer.title} showPrint={allowed} showDownload={allowed}/></Suspense>}
  </>;
}
