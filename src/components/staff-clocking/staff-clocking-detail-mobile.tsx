'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CalendarDays, Users, CheckCircle2, Clock3, AlertCircle, FileText, MoreVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { detailStatusLabels, type DetailPeriod, type DetailRange, type StaffClockingDetailProfile, type StaffClockingDetailRow } from '@/lib/staff-clocking/details-contracts';
import { detailTime, detailDates, detailPeriodRange, summarizeStaffDetail } from '@/lib/staff-clocking/details-report';
import { cn } from '@/lib/utils';

export const emptyDetailFilters = { status: 'all', population: 'all', clock: 'all', dayType: 'all', weekday: 'all', correction: 'all', source: 'all', departure: 'all', minutes: '' };
export type DetailFilters = typeof emptyDetailFilters;
const selectClass = 'h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm dark:[color-scheme:dark]';
const dayFormat = (date: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-UG', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));

export function ClockingDetailStatus({ row, compact = false }: { row: StaffClockingDetailRow; compact?: boolean }) {
  const missing = row.record?.status === 'missing_clock_out';
  const working = row.record?.status === 'open' && (row.record?.clockInTime || row.record?.effectiveClockInTime);
  const shortLabels = {on_time:'On time',grace:'Grace',late:'Late',exempt:'Leave',absent:'Absent',unresolved:'Unknown',scheduled:'Expected',off:'Off day',holiday:'Holiday'};
  return <Badge variant="outline" title={missing ? 'Missing clock out' : detailStatusLabels[row.status]} className={cn(compact ? 'max-w-[84px] justify-center px-1.5 py-1 text-[9px] leading-3' : 'text-[11px]', 'whitespace-normal', row.status === 'late' ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300' : row.status === 'grace' || missing ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300' : row.status === 'on_time' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-muted/60')}>
    {compact ? missing ? 'Missing out' : working ? 'Working' : shortLabels[row.status] : missing ? 'Missing clock out' : working ? `${detailStatusLabels[row.status]} · Working` : detailStatusLabels[row.status]}
  </Badge>;
}

export function MobileClockingProfile({ profile, today, loading, onToday }: { profile: StaffClockingDetailProfile; today?: StaffClockingDetailRow; loading: boolean; onToday: () => void }) {
  const person = profile.staff;
  const arrival = today?.record?.effectiveClockInTime || today?.record?.clockInTime;
  const departure = today?.record?.effectiveClockOutTime || today?.record?.clockOutTime;
  const identity = <>{person.photo ? <img src={person.photo} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">{person.name.split(' ').map(word => word[0]).slice(0, 2).join('')}</span>}<div className="min-w-0"><h2 className="truncate text-sm font-bold text-foreground">{person.name}</h2><span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{person.roles.join(', ') || 'Staff member'}</span><span className="mt-1 block truncate text-[10px] text-muted-foreground">{person.groups.join(', ') || 'School default'} · {person.employeeId}</span><span className="sr-only">{person.status} staff</span></div></>;
  return <section aria-label="Employee profile" className="flex items-center gap-2 rounded-[18px] border border-border/70 bg-card/90 p-3 shadow-sm">
    {profile.permissions.profile ? <Link href={`/staff/${encodeURIComponent(person.id)}`} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`View ${person.name}'s staff profile`}>{identity}</Link> : <div className="flex min-w-0 flex-1 items-center gap-2.5">{identity}</div>}
    <button type="button" aria-label="View today's clocking details" disabled={loading || !today} onClick={onToday} className="flex min-h-11 max-w-[84px] shrink-0 flex-col items-end justify-center gap-1 rounded-xl px-1 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-semibold',arrival && !departure ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-primary/5 text-primary')}><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />{loading ? 'Loading…' : departure ? 'Clocked out' : arrival ? 'Clocked in' : today?.status === 'exempt' ? 'On leave' : today?.scheduled ? 'Not arrived' : 'Off day'}</span>
      {(departure || arrival) && <span className="text-[10px] font-semibold text-muted-foreground">{detailTime(departure || arrival)}</span>}
    </button>
  </section>;
}

export function MobileClockingStats({ summary, loading, onFilter }: { summary: ReturnType<typeof summarizeStaffDetail>; loading: boolean; onFilter: (status: string, population?: string) => void }) {
  const stats = [
    {label:'Scheduled',value:summary.scheduled,icon:CalendarDays,tone:'text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300',population:'scheduled'},
    {label:'Attended',value:summary.attended,icon:Users,tone:'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300',population:'attended'},
    {label:'On time',value:summary.onTime,icon:CheckCircle2,tone:'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300',status:'on_time'},
    {label:'Grace',value:summary.grace,icon:Clock3,tone:'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300',status:'grace'},
    {label:'Late',value:summary.late,icon:AlertCircle,tone:'text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300',status:'late'},
    {label:'Leave',value:summary.exempt,icon:FileText,tone:'text-violet-600 bg-violet-50 dark:bg-violet-950/40 dark:text-violet-300',status:'exempt'},
  ];
  return <section aria-label="Attendance summary" className="grid grid-cols-3 gap-2">{stats.map(item => <button key={item.label} type="button" disabled={loading} onClick={() => onFilter(item.status || 'all', item.population)} className="flex min-h-[56px] min-w-0 items-center gap-1.5 rounded-2xl border border-border/70 bg-card/90 px-2 py-2 text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <item.icon className={cn('h-6 w-6 shrink-0 rounded-lg p-1', item.tone)} /><span className="min-w-0"><span className="block text-[9px] leading-3 text-muted-foreground">{item.label}</span><strong className="mt-0.5 block text-lg leading-5">{loading ? '—' : item.value}</strong></span>
  </button>)}</section>;
}

export function MobileAttendanceDate({ row, onSelect }: { row: StaffClockingDetailRow; onSelect: (row: StaffClockingDetailRow) => void }) {
  return <button type="button" aria-label={`Details for ${row.date}`} className="grid min-h-[58px] w-full grid-cols-[44px_minmax(0,1fr)_minmax(0,1fr)_auto_10px] items-center gap-1.5 rounded-2xl border border-border/70 bg-card/95 px-2.5 py-2 text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onSelect(row)}>
    <span><span className="block whitespace-nowrap text-xs font-bold">{dayFormat(row.date,{day:'2-digit',month:'short'})}</span><span className="mt-1 block text-[10px] text-muted-foreground">{dayFormat(row.date,{weekday:'short'})}</span></span>
    <span className="border-l border-border/60 pl-2"><span className="block text-[10px] text-muted-foreground">In</span><span className="mt-1 block whitespace-nowrap text-xs font-semibold tabular-nums">{detailTime(row.record?.effectiveClockInTime || row.record?.clockInTime)}</span></span>
    <span className="border-l border-border/60 pl-2"><span className="block text-[10px] text-muted-foreground">Out</span><span className="mt-1 block whitespace-nowrap text-xs font-semibold tabular-nums">{detailTime(row.record?.effectiveClockOutTime || row.record?.clockOutTime)}</span></span>
    <ClockingDetailStatus row={row} compact /><MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
  </button>;
}

export function MobileTermHistory({ rows, onSelect }: { rows: StaffClockingDetailRow[]; onSelect: (row: StaffClockingDetailRow) => void }) {
  return <div aria-label="Term monthly summaries" className="space-y-3">{[...new Set(rows.map(row => row.date.slice(0, 7)))].map(month => {
    const days = rows.filter(row => row.date.startsWith(month)), totals = summarizeStaffDetail(days);
    return <details key={month} className="rounded-2xl border border-border/70 bg-muted/20"><summary className="cursor-pointer rounded-2xl p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="text-sm font-semibold">{dayFormat(`${month}-01`, {month:'long', year:'numeric'})}</span><span className="mt-2 block text-xs text-muted-foreground">On time {totals.onTime} · Grace {totals.grace} · Late {totals.late}</span><span className="mt-1 block text-[11px] text-muted-foreground">Absent {totals.absent} · Leave {totals.exempt} · {days.length} dates</span></summary><div className="space-y-2 border-t border-border/60 p-2.5">{days.map(row => <MobileAttendanceDate key={row.date} row={row} onSelect={onSelect} />)}</div></details>;
  })}</div>;
}

export function MobileClockingDatePicker({ period, anchor, custom, termKey, terms, today, onApply, onClose }: { period: DetailPeriod; anchor: string; custom: DetailRange; termKey: string; terms: Array<{key:string;label:string;from:string;to:string}>; today:string; onApply: (value:{anchor:string;custom:DetailRange;termKey:string}) => void; onClose: () => void }) {
  const [date,setDate] = useState(anchor),[range,setRange] = useState(custom),[term,setTerm] = useState(termKey);
  const selectedTerm = terms.find(item => item.key === term);
  const valid = detailDates(detailPeriodRange(period,date,selectedTerm,range)).length > 0 && (period !== 'term' || !!selectedTerm);
  return <Sheet open onOpenChange={open => {if(!open) onClose();}}><SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-[24px] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] [&>button:last-child]:right-2 [&>button:last-child]:top-2 [&>button:last-child]:h-11 [&>button:last-child]:w-11">
    <SheetHeader className="mb-4 pr-12 text-left"><SheetTitle>Choose reporting date</SheetTitle><SheetDescription>Update the selected attendance period.</SheetDescription></SheetHeader>
    <form className="space-y-4" onSubmit={event => {event.preventDefault();if(valid){onApply({anchor:period === 'term' ? selectedTerm!.from : period === 'custom' ? range.from : date,custom:range,termKey:term});onClose();}}}>
      {period === 'term' ? <div className="space-y-1.5"><Label htmlFor="mobile-report-term">Academic term</Label><select id="mobile-report-term" className={selectClass} value={term} onChange={event => setTerm(event.target.value)}>{terms.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></div> : period === 'custom' ? <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="mobile-report-from">From</Label><Input id="mobile-report-from" className="h-11 min-w-0" type="date" value={range.from} onChange={event => setRange(old => ({...old,from:event.target.value}))} /></div><div><Label htmlFor="mobile-report-to">To</Label><Input id="mobile-report-to" className="h-11 min-w-0" type="date" value={range.to} onChange={event => setRange(old => ({...old,to:event.target.value}))} /></div></div> : <div className="space-y-1.5"><Label htmlFor="mobile-report-date">{period === 'month' ? 'Month and year' : 'Reporting date'}</Label><Input id="mobile-report-date" className="h-11" type={period === 'month' ? 'month' : 'date'} value={period === 'month' ? date.slice(0,7) : date} onChange={event => setDate(period === 'month' ? `${event.target.value}-01` : event.target.value)} /></div>}
      {!valid && <p role="alert" className="text-xs text-destructive">Choose valid dates covering at most 366 days, or a configured academic term.</p>}
      <div className="flex gap-2">{period !== 'term' && <Button type="button" className="h-11 rounded-xl" variant="outline" onClick={() => {setDate(today);setRange({from:today,to:today});}}>Today</Button>}<Button type="submit" className="h-11 flex-1 rounded-xl" disabled={!valid}>Apply period</Button></div>
    </form>
  </SheetContent></Sheet>;
}

export function DetailFilterFields({ filters, onChange, includeStatus = false }: { filters: DetailFilters; onChange: (key: keyof DetailFilters, value: string) => void; includeStatus?: boolean }) {
  const options: Array<[keyof DetailFilters, string, string[][]]> = [
    ...(includeStatus ? [['status', 'Attendance status', [['all', 'All statuses'], ...Object.entries(detailStatusLabels)]]] as Array<[keyof DetailFilters, string, string[][]]> : []),
    ['population', 'Attendance dates', [['all', 'All dates'], ['scheduled', 'Scheduled dates'], ['attended', 'Attended dates']]],
    ['clock', 'Clocking completion', [['all', 'All records'], ['complete', 'Complete'], ['open', 'Clocked in'], ['missing_in', 'Missing arrival'], ['missing_out', 'Missing clock out']]],
    ['dayType', 'Day type', [['all', 'All days'], ['normal', 'Normal day'], ['special', 'Special day'], ['holiday', 'Holiday'], ['off', 'Off day'], ['unknown', 'Not captured']]],
    ['correction', 'Correction status', [['all', 'Any correction status'], ['none', 'No approved correction'], ['approved', 'Approved correction'], ['pending', 'Pending review'], ['rejected', 'Rejected']]],
    ['weekday', 'Day of week', [['all', 'All weekdays'], ...['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((label,index) => [String(index),label])]],
    ['source', 'Clocking source', [['all', 'All sources'], ['qr', 'Original QR scan'], ['correction', 'Authorized correction']]],
    ['departure', 'Departure status', [['all','Any departure'],['normal','At/after expected departure'],['early','Early departure'],['missing','Missing clock out'],['pending','Departure pending'],['unknown','Expected departure not recorded']]],
  ];
  return <>{options.map(([key,label,values]) => <div key={key} className="space-y-1.5"><Label htmlFor={`detail-filter-${key}`}>{label}</Label><select id={`detail-filter-${key}`} className={selectClass} value={filters[key]} onChange={event => onChange(key,event.target.value)}>{values.map(([value,text]) => <option key={value} value={value}>{text}</option>)}</select></div>)}<div className="space-y-1.5"><Label htmlFor="detail-late-minutes">Minimum late minutes</Label><Input id="detail-late-minutes" className="h-11" type="number" min="0" max="1440" value={filters.minutes} onChange={event => onChange('minutes',event.target.value)} /></div></>;
}

export function MobileClockingFilters({ filters, onApply, onClose, yearId, years }: { filters: DetailFilters; onApply: (value: DetailFilters, year: string) => void; onClose: () => void; yearId: string; years: Array<{id: string; name: string}> }) {
  const [draft,setDraft] = useState(filters);
  const [draftYear,setDraftYear] = useState(yearId);
  return <Sheet open onOpenChange={open => {if(!open) onClose();}}><SheetContent side="bottom" className="flex h-[88dvh] max-h-[88dvh] flex-col gap-0 rounded-t-[24px] p-0 [&>button:last-child]:right-2 [&>button:last-child]:top-2 [&>button:last-child]:flex [&>button:last-child]:h-11 [&>button:last-child]:w-11 [&>button:last-child]:items-center [&>button:last-child]:justify-center">
    <SheetHeader className="shrink-0 border-b border-border px-4 py-4 pr-14 text-left"><SheetTitle>Filter Records</SheetTitle><SheetDescription>Choose filters for this staff member. Changes apply when you tap Apply Filters.</SheetDescription></SheetHeader>
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4"><DetailFilterFields filters={draft} includeStatus onChange={(key,value) => setDraft(old => ({...old,[key]:value}))} /><div className="space-y-1.5"><Label htmlFor="mobile-academic-year">Academic year</Label><select id="mobile-academic-year" className={selectClass} value={draftYear} onChange={event => setDraftYear(event.target.value)}><option value="">All school years</option>{years.map(year => <option key={year.id} value={year.id}>{year.name}</option>)}</select><p className="text-xs text-muted-foreground">Used by the Term selector.</p></div></div>
    <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-border bg-background px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"><Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => {setDraft({...emptyDetailFilters});setDraftYear('');}}>Reset</Button><Button type="button" className="h-11 rounded-xl" onClick={() => {onApply(draft,draftYear);onClose();}}>Apply Filters</Button></div>
  </SheetContent></Sheet>;
}
