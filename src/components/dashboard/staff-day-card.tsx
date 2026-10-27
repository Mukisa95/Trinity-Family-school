'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Briefcase, ChevronDown, Clock, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDashboardStaffDay } from '@/lib/hooks/use-dashboard-staff-day';
import { useSchoolDate } from '@/lib/hooks/use-school-date';
import type { DashboardArrival, DashboardDuty } from '@/lib/dashboard/staff-day-contracts';

function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  // Same surface, accent, shadow and type hierarchy as the existing dashboard charts.
  return <Card className="relative min-w-0 overflow-hidden rounded-xl" style={{ boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05), inset 0 -3px 0 rgba(0,0,0,0.1)' }}>
    <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-green-500 opacity-60" />
    <CardHeader className="relative flex-row items-center justify-between gap-2 space-y-0 px-3 pb-2 pt-3"><CardTitle className="flex min-w-0 items-center gap-1.5 text-base font-bold text-blue-600 dark:text-blue-300">{title.includes('duty') ? <Briefcase className="h-4 w-4 shrink-0" /> : <Clock className="h-4 w-4 shrink-0" />}{title}</CardTitle>{action}</CardHeader>
    <CardContent className="px-3 pb-3 pt-0">{children}</CardContent>
  </Card>;
}

function status(item: DashboardArrival) {
  if (item.record?.reviewStatus === 'exempted') return 'Exempted';
  if (!item.enrolled) return 'Not enrolled';
  if (item.record?.effectiveClockInTime || item.record?.clockInTime) {
    if (item.record.effectiveClockOutTime || item.record.clockOutTime) return 'Departed';
    return item.record.arrivalStatus === 'late' ? 'Late' : item.record.arrivalStatus === 'grace' ? 'Within grace' : 'On time';
  }
  if (item.schedule.kind === 'conflict') return 'Schedule conflict';
  if (item.schedule.kind === 'non_working_day') return 'Not scheduled';
  return 'Not clocked in';
}

function Times({ arrival }: { arrival: DashboardArrival }) {
  const label = status(arrival);
  return <>
    <dl className="grid grid-cols-3 gap-2 text-xs">
      <div><dt className="text-muted-foreground">Arrival due</dt><dd className="mt-0.5 font-semibold tabular-nums">{arrival.enrolled ? arrival.schedule.clockInBy?.slice(0, 5) || '—' : '—'}</dd></div>
      <div><dt className="text-muted-foreground">Arrived</dt><dd className="mt-0.5 font-semibold tabular-nums">{(arrival.record?.effectiveClockInTime || arrival.record?.clockInTime)?.slice(0, 5) || '—'}</dd></div>
      <div><dt className="text-muted-foreground">Departed</dt><dd className="mt-0.5 font-semibold tabular-nums">{(arrival.record?.effectiveClockOutTime || arrival.record?.clockOutTime)?.slice(0, 5) || '—'}</dd></div>
    </dl>
    <p className={`mt-1 text-xs font-medium ${label === 'Late' || label === 'Schedule conflict' ? 'text-amber-700 dark:text-amber-300' : label === 'On time' || label === 'Departed' ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}`}>{label}{arrival.record?.reviewStatus === 'corrected' ? ' · Corrected' : ''}</p>
  </>;
}

function DutyList({ duties, personal }: { duties: DashboardDuty[]; personal: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? duties : duties.slice(0, 3);
  return duties.length ? <>
    <ul className="divide-y divide-border/60">{visible.map(duty => <li key={duty.id} className="py-1.5 first:pt-0 last:pb-0">
      <p className="text-xs font-semibold">{personal ? `On duty · ${duty.name}` : duty.staffName}{duty.supervisor && <span className="ml-1 font-normal text-indigo-600 dark:text-indigo-300">· Supervisor</span>}</p>
      {(!personal || duty.service && duty.service !== duty.name) && <p className="break-words text-xs text-muted-foreground">{personal ? duty.service : [...new Set([duty.name, duty.service].filter(Boolean))].join(' · ')}</p>}
      {personal && <p className="text-xs text-muted-foreground">{duty.startDate} – {duty.endDate}</p>}
    </li>)}</ul>
    {duties.length > 3 && <Button variant="ghost" className="mt-1 h-11 w-full text-xs" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show less' : `Show all ${duties.length} duties`}<ChevronDown className="ml-1 h-3.5 w-3.5" /></Button>}
  </> : <p className="text-xs text-muted-foreground">{personal ? 'No duty assigned today.' : 'No teachers assigned to duty today.'}</p>;
}

export function DashboardStaffPanels({ schoolWide, staffId }: { schoolWide: boolean; staffId?: string }) {
  const date = useSchoolDate();
  const day = useDashboardStaffDay(date, schoolWide ? 'school' : 'personal');
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');
  const clockingEnabled = day.data?.clockingEnabled === true;
  const refresh = <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label={clockingEnabled ? 'Refresh arrival and duty information' : 'Refresh duty information'} disabled={day.isFetching} onClick={() => void day.refetch()}><RotateCcw className={`h-3.5 w-3.5 ${day.isFetching ? 'animate-spin' : ''}`} /></Button>;
  if (!day.data) return <Panel title={schoolWide ? 'Teachers on duty today' : 'My duty today'} action={refresh}><p role={day.isError ? 'alert' : 'status'} className="text-xs text-muted-foreground">{day.isError ? 'Staff information could not load. Try refreshing.' : 'Loading staff information…'}</p></Panel>;
  // A stale client-side role never turns a personal server response into a school roster.
  const oversight = schoolWide && day.data.schoolWide;
  const arrivals = oversight ? day.data.arrivals : day.data.arrivals.filter(item => item.staffId === staffId);
  const duties = oversight ? day.data.duties : day.data.duties.filter(item => item.staffId === staffId);
  const own = arrivals[0];
  const filtered = arrivals.filter(item => item.staffName.toLowerCase().includes(search.toLowerCase()));
  const visible = expanded ? filtered : filtered.slice(0, 4);
  return <div className="flex min-w-0 flex-col gap-3" data-dashboard-staff-panels>
    <Panel title={oversight ? 'Teachers on duty today' : clockingEnabled ? 'My arrival & duty' : 'My duty today'} action={refresh}>
      {day.isError && <p role="alert" className="mb-2 text-xs text-amber-700 dark:text-amber-300">Could not refresh. Showing the last loaded information.</p>}
      {day.data.date !== date && <p role="alert" className="mb-2 text-xs text-amber-700 dark:text-amber-300">This information is from {day.data.date}. Refresh for today.</p>}
      {!oversight && !staffId && <p className="mb-2 text-xs text-muted-foreground">Your account needs to be linked to a staff record.</p>}
      {!oversight && staffId && clockingEnabled && <div className="mb-2 border-b border-border/60 pb-2">{own ? <Times arrival={own} /> : <p className="text-xs text-muted-foreground">No clocking information is available.</p>}</div>}
      <DutyList duties={duties} personal={!oversight} />
      {!oversight && clockingEnabled && own?.enrolled && <Link href="/staff-clocking/clock" className="mt-1 inline-flex min-h-11 items-center text-xs font-semibold text-indigo-600 dark:text-indigo-300">Open my clock</Link>}
    </Panel>
    {oversight && clockingEnabled && <Panel title="Teachers’ arrival & departure">
      <p className="mb-2 text-xs text-muted-foreground">{day.data.date} · All teaching staff</p>
      <>
        <label className="sr-only" htmlFor="dashboard-teacher-search">Find teacher</label><input id="dashboard-teacher-search" value={search} onChange={event => { setSearch(event.target.value); setExpanded(true); }} placeholder="Find teacher…" className="mb-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm" />
        <ul className="divide-y divide-border/60">{visible.map(item => <li key={item.staffId} className="py-2 first:pt-0"><p className="mb-1 text-xs font-semibold">{item.staffName}</p><Times arrival={item} /></li>)}</ul>
        {!filtered.length && <p className="text-xs text-muted-foreground">{search ? 'No matching teachers.' : 'No active teaching staff found.'}</p>}
        {filtered.length > 4 && <Button variant="ghost" className="mt-1 h-11 w-full text-xs" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show less' : `View all ${filtered.length} teachers`}</Button>}
      </>
    </Panel>}
  </div>;
}
