"use client";
import { ArrowUpRight } from 'lucide-react';
import type { ReportChart as Chart } from '@/lib/reports/report-model';
import { formatReportValue } from '@/lib/reports/report-model';
import { REPORT_PALETTE,REPORT_TONES } from '@/lib/reports/report-visuals';

export function ReportChart({chart,onOpen}:{chart:Chart;onOpen?:(title:string)=>void}) {
  const items=chart.items.filter(item=>Number.isFinite(item.value)&&item.value>=0),total=items.reduce((sum,item)=>sum+item.value,0);
  const visible=items.slice(0,8),max=Math.max(1,...items.map(item=>item.value));let offset=0;
  return <section className="report-chart-panel min-w-0 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-950/30">
    <div className="mb-2 flex items-start justify-between gap-2"><h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{chart.title}</h4>{chart.tableTitle&&onOpen&&<button type="button" className="-mr-2 -mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 dark:text-blue-300 dark:hover:bg-slate-800" aria-label={`View records: ${chart.title}`} onClick={()=>onOpen(chart.tableTitle!)}><ArrowUpRight className="h-4 w-4"/></button>}</div>
    <p className="mb-4 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{chart.description}</p>
    {chart.kind==='donut'?<div className="flex flex-col items-center gap-4 sm:flex-row"><svg className="h-36 w-36 shrink-0" viewBox="0 0 140 140" role="img" aria-label={`${chart.title}: ${items.map(item=>`${item.label} ${formatReportValue(item.value,chart.format)}`).join(', ')}`}>
      <circle cx="70" cy="70" r="52" fill="none" stroke="currentColor" strokeWidth="14" className="text-slate-200 dark:text-slate-700"/>
      {total>0&&items.map((item,index)=>{const length=item.value/total*100,start=offset;offset+=length;return <circle key={index} cx="70" cy="70" r="52" pathLength="100" fill="none" stroke={REPORT_PALETTE[item.tone||REPORT_TONES[index%REPORT_TONES.length]].hex} strokeWidth="14" strokeDasharray={`${length} ${100-length}`} strokeDashoffset={-start} transform="rotate(-90 70 70)"/>;})}
      <text x="70" y="69" textAnchor="middle" className="fill-slate-900 text-[19px] font-bold dark:fill-slate-100">{total>0?chart.centerValue||formatReportValue(total):'0'}</text><text x="70" y="88" textAnchor="middle" className="fill-slate-600 text-[10px] dark:fill-slate-400">{total>0?chart.centerLabel||'Total':'No records'}</text>
    </svg><ul className="w-full min-w-0 space-y-3">{items.map((item,index)=><li key={index} className="flex items-start gap-2 text-xs"><span aria-hidden className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{background:REPORT_PALETTE[item.tone||REPORT_TONES[index%REPORT_TONES.length]].hex}}/><span className="min-w-0 flex-1 text-slate-600 dark:text-slate-300">{item.label}</span><strong className="shrink-0 tabular-nums">{formatReportValue(item.value,chart.format)}</strong></li>)}</ul></div>:<ul className="space-y-3">{visible.map((item,index)=><li key={index}><div className="mb-1 flex justify-between gap-3 text-xs"><span className="min-w-0 text-slate-600 dark:text-slate-300">{item.label}</span><strong className="shrink-0 tabular-nums">{formatReportValue(item.value,chart.format)}</strong></div><div aria-hidden className="h-2 rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-2 rounded-full" style={{width:`${item.value/max*100}%`,background:REPORT_PALETTE[item.tone||REPORT_TONES[index%REPORT_TONES.length]].hex}}/></div></li>)}</ul>}
    {chart.kind==='bar'&&items.length>8&&<p className="mt-3 text-xs text-slate-500 dark:text-slate-400">First 8 groups shown. View records for the full table.</p>}
  </section>;
}
