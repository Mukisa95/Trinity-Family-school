"use client";
import { useState } from 'react';
import { BarChart3, ChevronDown, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatReportValue, type ReportSection, type ReportTable } from '@/lib/reports/report-model';

function AnalysisTable({table}:{table:ReportTable}) {
  const [expanded,setExpanded]=useState(false),rows=expanded?table.rows:table.rows.slice(0,8);
  return <div className="space-y-2">
    <h4 className="text-xs font-semibold">{table.title}</h4>
    <div className="overflow-x-auto rounded-xl border border-border/70">
      <table className="w-full text-left text-xs"><caption className="sr-only">{table.title}</caption><thead className="bg-muted/60"><tr>{table.columns.map((column,index)=><th key={index} scope="col" className="whitespace-nowrap px-3 py-2 font-medium text-muted-foreground">{column}</th>)}</tr></thead>
        <tbody className="divide-y divide-border/60">{rows.length?rows.map((row,index)=><tr key={index}>{row.map((cell,col)=><td key={col} className="max-w-[260px] px-3 py-2 tabular-nums">{formatReportValue(cell,table.moneyColumns?.includes(col)?'money':table.columns[col].includes('%')?'percent':'number')}</td>)}</tr>):<tr><td colSpan={table.columns.length} className="px-3 py-4 text-muted-foreground">No records in this section.</td></tr>}</tbody>
      </table>
    </div>
    {table.rows.length>8&&<Button variant="ghost" size="sm" className="h-8 rounded-full text-xs" onClick={()=>setExpanded(value=>!value)}>{expanded?'Show fewer rows':`Show all ${table.rows.length} rows`}</Button>}
  </div>;
}
const trendTables:Record<ReportSection['id'],[string,number]>={enrollment:['Class enrollment',1],fees:['Collections by month',1],finance:['Income and expenditure statement',1],attendance:['Attendance by status',1],academics:['Subject performance',2],staff:['Staff by role',1],payroll:['Salary spend by method',2],procurement:['Spend by category',1],requirements:['Payment status',1],uniforms:['Collection status',1],inventory:['Inventory by category',1],banking:['Account status',2],events:['Activities by type',1],timetable:['Teacher assignment load',1]};
function ReportTrend({report}:{report:ReportSection}){
  const [title,column]=trendTables[report.id],table=report.tables.find(table=>table.title===title);
  const rows=table?.rows.filter(row=>typeof row[column]==='number').slice(0,6)||[];
  if(!rows.length)return null;
  const max=Math.max(1,...rows.map(row=>Math.abs(Number(row[column]))));
  return <div className="rounded-xl border border-border/70 p-3"><h4 className="mb-3 text-[11px] font-semibold">{title}</h4><ul className="space-y-2" aria-label={title}>{rows.map((row,index)=><li key={index} className="space-y-1"><div className="flex justify-between gap-3 text-[10px]"><span className="min-w-0 truncate text-muted-foreground">{String(row[0])}</span><span className="shrink-0 font-semibold tabular-nums">{formatReportValue(row[column],table?.moneyColumns?.includes(column)?'money':table?.columns[column].includes('%')?'percent':'number')}</span></div><div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={Number(row[column])<0?'h-full rounded-full bg-rose-500':'h-full rounded-full bg-brand-surface-500'} style={{width:`${Math.abs(Number(row[column]))/max*100}%`}}/></div></li>)}</ul>{(table?.rows.length||0)>6&&<p className="mt-2 text-[10px] text-muted-foreground">First 6 groups shown; the supporting table contains every row.</p>}</div>;
}
export function ReportSectionCard({report}:{report:ReportSection}) {
  return <Card className="report-panel min-w-0 self-start rounded-2xl border-brand-100/70 bg-white/85 shadow-sm backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/85">
    <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-3"><CardTitle role="heading" aria-level={3} className="flex items-center gap-2 text-sm font-bold text-brand-alt-ink-900 dark:text-brand-alt-ink-200"><BarChart3 className="h-4 w-4 shrink-0 text-brand-ink-500"/>{report.title}</CardTitle><p className="text-xs text-muted-foreground">{report.description}</p></CardHeader>
    <CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
      <dl className="grid grid-cols-2 gap-3">{report.metrics.map(item=><div key={item.label} className="min-w-0 rounded-xl bg-brand-surface-50/70 p-3 dark:bg-brand-surface-950/30"><dt className="text-[10px] font-medium text-muted-foreground">{item.label}</dt><dd className="mt-1 break-words text-lg font-bold tabular-nums text-brand-alt-ink-900 dark:text-brand-alt-ink-100">{formatReportValue(item.value,item.format)}</dd>{item.detail&&<p className="mt-1 text-[10px] text-muted-foreground">{item.detail}</p>}</div>)}</dl>
      <ReportTrend report={report}/>
      {report.insights.length>0&&<ul className="space-y-1.5 rounded-xl border border-amber-200/60 bg-amber-50/50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">{report.insights.map((insight,index)=><li key={index}>{insight}</li>)}</ul>}
      <details className="group rounded-xl border border-border/70 p-3"><summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold"><FileText className="h-3.5 w-3.5"/>Analysis & supporting tables<span className="ml-auto text-[10px] text-muted-foreground">{report.tables.length}</span><ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180"/></summary><div className="mt-4 space-y-5">{report.tables.map((table,index)=><AnalysisTable key={index} table={table}/>)}</div></details>
      <details className="text-xs text-muted-foreground"><summary className="cursor-pointer text-[11px] font-medium">What these figures include</summary><div className="mt-2 space-y-2 leading-relaxed">{report.notes.map((note,index)=><p key={index}>{note}</p>)}</div></details>
    </CardContent>
  </Card>;
}
