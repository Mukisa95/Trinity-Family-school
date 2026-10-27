'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Briefcase, ChevronDown, Clock, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useDashboardStaffDay } from '@/lib/hooks/use-dashboard-staff-day';
import { useDashboardDataRevisions } from '@/lib/hooks/use-school-settings';
import { useAuth } from '@/lib/contexts/auth-context';
import { useSchoolDate } from '@/lib/hooks/use-school-date';
import type { DashboardArrival, DashboardDuty, DashboardStaffDay } from '@/lib/dashboard/staff-day-contracts';
import { getDutyEndMessage } from '@/lib/dashboard/duty-message';
import { getStaffAttendanceSummary } from '@/lib/dashboard/staff-attendance';

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

function DutyList({ duties, personal, date }: { duties: DashboardDuty[]; personal: boolean; date: string }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? duties : duties.slice(0, 3);
  return duties.length ? <>
    {personal && <p className="mb-1 text-xs font-semibold">You are on duty today.</p>}
    <ul className="divide-y divide-border/60">{visible.map(duty => <li key={duty.id} className="py-1.5 first:pt-0 last:pb-0">
      <p className="text-xs font-semibold">{personal ? duty.name : duty.staffName}{duty.supervisor && <span className="ml-1 font-normal text-indigo-600 dark:text-indigo-300">· Supervisor</span>}</p>
      {(!personal || duty.service && duty.service !== duty.name) && <p className="break-words text-xs text-muted-foreground">{personal ? duty.service : [...new Set([duty.name, duty.service].filter(Boolean))].join(' · ')}</p>}
      {personal && <p className="text-xs text-muted-foreground">{getDutyEndMessage(duty.endDate, date)}</p>}
    </li>)}</ul>
    {duties.length > 3 && <Button variant="ghost" className="mt-1 h-11 w-full text-xs" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show less' : `Show all ${duties.length} duties`}<ChevronDown className="ml-1 h-3.5 w-3.5" /></Button>}
  </> : <p className="text-xs text-muted-foreground">{personal ? 'No duty assigned today.' : 'No teachers assigned to duty today.'}</p>;
}

function ArrivalRoster({ arrivals, showAll = false }: { arrivals: DashboardArrival[]; showAll?: boolean }) {
  const [expanded, setExpanded] = useState(showAll);
  const [search, setSearch] = useState('');
  const searchId = useId();
  const filtered = arrivals.filter(item => item.staffName.toLowerCase().includes(search.toLowerCase()));
  const visible = expanded ? filtered : filtered.slice(0, 4);
  return <div className="min-h-0">
    <label className="sr-only" htmlFor={searchId}>Find teacher</label><input id={searchId} value={search} onChange={event => { setSearch(event.target.value); setExpanded(true); }} placeholder="Find teacher…" className="mb-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm" />
    <ul className={`divide-y divide-border/60 ${showAll ? 'max-h-[55dvh] overflow-y-auto overscroll-contain' : ''}`}>{visible.map(item => <li key={item.staffId} className="py-2 first:pt-0"><p className="mb-1 text-xs font-semibold">{item.staffName}</p><Times arrival={item} /></li>)}</ul>
    {!filtered.length && <p className="text-xs text-muted-foreground">{search ? 'No matching teachers.' : 'No active teaching staff found.'}</p>}
    {!showAll && filtered.length > 4 && <Button variant="ghost" className="mt-1 h-11 w-full text-xs" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show less' : `View all ${filtered.length} teachers`}</Button>}
  </div>;
}

type StaffAttendanceStatProps = {
  desktop: boolean;
  children: (options: { value?: string; onClick?: () => void }) => ReactNode;
};

/** The stat and sidebar share the existing school-wide revision-owned query. */
function StaffAttendanceStatData({ children }: Pick<StaffAttendanceStatProps, 'children'>) {
  const date = useSchoolDate();
  const { user } = useAuth();
  const revisions = useDashboardDataRevisions();
  const day = useDashboardStaffDay(date, 'school');
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  const owner = JSON.stringify([user?.id, user?.role, user?.staffId, date]);
  const retained = useRef<{ owner: string; data: DashboardStaffDay } | null>(null);
  if (day.data) retained.current = { owner, data: day.data };
  // Keep the open roster stable while a new revision restores/reconciles its cache.
  const data = day.data ?? (retained.current?.owner === owner ? retained.current.data : undefined);
  const available = !!user?.isActive && data?.clockingEnabled && data.schoolWide && revisions.data?.staffClockingEnabled !== false;
  useEffect(() => {
    if (!available) setOpen(false);
  }, [available]);
  if (!available || !data) return children({});
  const summary = getStaffAttendanceSummary(data.arrivals);
  return <Dialog open={open} onOpenChange={setOpen}>
    {children({ value: `${summary.present}/${summary.total}`, onClick: () => { trigger.current = document.activeElement as HTMLElement | null; setOpen(true); } })}
    <DialogContent className="max-w-xl" onCloseAutoFocus={event => { if (trigger.current?.isConnected) { event.preventDefault(); trigger.current.focus(); } }}>
      <DialogTitle className="pr-7">Teachers’ arrival & departure</DialogTitle>
      <DialogDescription>{date} · All teaching staff · {summary.present} of {summary.total} have arrived today</DialogDescription>
      {day.isError && <p role="alert" className="text-xs text-amber-700 dark:text-amber-300">Could not refresh. Showing the last loaded information.</p>}
      <ArrivalRoster arrivals={data.arrivals} showAll />
    </DialogContent>
  </Dialog>;
}

export function DashboardStaffAttendanceStat({ desktop, children }: StaffAttendanceStatProps) {
  return desktop ? <StaffAttendanceStatData>{children}</StaffAttendanceStatData> : children({});
}

export function DashboardStaffPanels({ schoolWide, staffId, showSchoolArrivals = true, showSchoolDuties = true }: { schoolWide: boolean; staffId?: string; showSchoolArrivals?: boolean; showSchoolDuties?: boolean }) {
  const date = useSchoolDate();
  const day = useDashboardStaffDay(date, schoolWide ? 'school' : 'personal');
  const clockingEnabled = day.data?.clockingEnabled === true;
  const refresh = <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label={clockingEnabled ? 'Refresh arrival and duty information' : 'Refresh duty information'} disabled={day.isFetching} onClick={() => void day.refetch()}><RotateCcw className={`h-3.5 w-3.5 ${day.isFetching ? 'animate-spin' : ''}`} /></Button>;
  if (schoolWide && !showSchoolDuties && !showSchoolArrivals) return null;
  if (!day.data) return <Panel title={schoolWide ? showSchoolDuties ? 'Teachers on duty today' : 'Staff information' : 'My duty today'} action={refresh}><p role={day.isError ? 'alert' : 'status'} className="text-xs text-muted-foreground">{day.isError ? 'Staff information could not load. Try refreshing.' : 'Loading staff information…'}</p></Panel>;
  // A stale client-side role never turns a personal server response into a school roster.
  const oversight = schoolWide && day.data.schoolWide;
  const arrivals = oversight ? day.data.arrivals : day.data.arrivals.filter(item => item.staffId === staffId);
  const duties = oversight ? day.data.duties : day.data.duties.filter(item => item.staffId === staffId);
  const own = arrivals[0];
  const hasDuties = duties.length > 0 && (!oversight || showSchoolDuties);
  const hasPersonalArrival = !oversight && clockingEnabled && !!own;
  if (!hasDuties && !hasPersonalArrival && !(oversight && clockingEnabled && showSchoolArrivals)) return null;
  return <div className="flex min-w-0 flex-col gap-3" data-dashboard-staff-panels>
    {(hasDuties || hasPersonalArrival) && <Panel title={oversight ? 'Teachers on duty today' : hasPersonalArrival ? hasDuties ? 'My arrival & duty' : 'My arrival today' : 'My duty today'} action={refresh}>
      {day.isError && <p role="alert" className="mb-2 text-xs text-amber-700 dark:text-amber-300">Could not refresh. Showing the last loaded information.</p>}
      {day.data.date !== date && <p role="alert" className="mb-2 text-xs text-amber-700 dark:text-amber-300">This information is from {day.data.date}. Refresh for today.</p>}
      {!oversight && !staffId && <p className="mb-2 text-xs text-muted-foreground">Your account needs to be linked to a staff record.</p>}
      {hasPersonalArrival && <div className={hasDuties ? 'mb-2 border-b border-border/60 pb-2' : undefined}><Times arrival={own} /></div>}
      {hasDuties && <DutyList duties={duties} personal={!oversight} date={date} />}
      {!oversight && clockingEnabled && own?.enrolled && <Link href="/staff-clocking/clock" className="mt-1 inline-flex min-h-11 items-center text-xs font-semibold text-indigo-600 dark:text-indigo-300">Open my clock</Link>}
    </Panel>}
    {oversight && clockingEnabled && showSchoolArrivals && <Panel title="Teachers’ arrival & departure">
      <p className="mb-2 text-xs text-muted-foreground">{day.data.date} · All teaching staff</p>
      <ArrivalRoster arrivals={arrivals} />
    </Panel>}
  </div>;
}
