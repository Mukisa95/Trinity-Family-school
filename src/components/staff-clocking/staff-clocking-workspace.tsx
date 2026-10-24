'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlarmClock, ArrowLeft, BookOpenCheck, CalendarClock, CalendarDays, CheckCircle2, ChevronRight, Clock3, Coins, FileClock, History, Loader2, QrCode, ScanLine, Settings2, ShieldCheck, ShieldEllipsis, Trash2, UserCheck, UserRoundCheck, UserRoundX, Users, UsersRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GlassPageTopBar } from '@/components/common/glass-page-top-bar';
import { GlassSummaryBar } from '@/components/common/glass-summary-bar';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useCreateManagedStaffClockingExemption, useCreateStaffClockingClosure, useCreateStaffClockingRequest, useCreateStaffClockingSchedule, useDeleteStaffClockingSchedule, useExportStaffClockingRecords, useFinalizeStaffClockingDate, useOwnStaffClockingDashboard, useOwnStaffClockingNotifications, useReviewStaffClockingRequest, useStaffClockingBootstrap, useStaffClockingClosures, useStaffClockingDailyRecords, useStaffClockingReviewRequests, useStaffClockingSchedules, useStaffClockingStaffCandidates, useUpdateStaffClockingSchedule, useUpdateStaffClockingSettings } from '@/lib/hooks/use-staff-clocking';
import type { StaffClockingBootstrap, StaffClockingFeatureSettings } from '@/lib/staff-clocking/contracts';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { StaffClockingQrDisplay } from '@/components/staff-clocking/staff-clocking-qr-display';
import { StaffClockingQrScanner } from '@/components/staff-clocking/staff-clocking-qr-scanner';

type StaffClockingSection = 'record' | 'manage' | 'clock' | 'records';

const sections: Array<{ id: StaffClockingSection; label: string; href: string; icon: typeof QrCode; page: StaffClockingSection }> = [
  { id: 'record', label: 'Record', href: '/staff-clocking/record', icon: QrCode, page: 'record' },
  { id: 'clock', label: 'Clock', href: '/staff-clocking/clock', icon: ScanLine, page: 'clock' },
  { id: 'records', label: 'Clock Records', href: '/staff-clocking/records', icon: History, page: 'records' },
];

function todayInSchoolTime(): string {
  return new Intl.DateTimeFormat('en-UG', {
    timeZone: 'Africa/Kampala',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

export function StaffClockingWorkspace({ section }: { section: StaffClockingSection }) {
  const { canAccessPage, canPerformAction } = usePermissions();
  const bootstrap = useStaffClockingBootstrap();
  const updateSettings = useUpdateStaffClockingSettings();
  const canManage = canPerformAction('staff_clocking', 'record', 'manage_schedules');
  const canDisplayQr = canPerformAction('staff_clocking', 'record', 'display_qr');
  const canManageCalendar = canPerformAction('staff_clocking', 'record', 'manage_calendar');
  const canFinalize = canPerformAction('staff_clocking', 'record', 'manual_clock');
  const canReviewRecords = canPerformAction('staff_clocking', 'records', 'view_records');
  const canReviewExemptions = canPerformAction('staff_clocking', 'records', 'review_exemptions');
  const canReviewCorrections = canPerformAction('staff_clocking', 'records', 'review_corrections');
  const canRequestExemption = canPerformAction('staff_clocking', 'clock', 'request_exemption');
  const canRequestCorrection = canPerformAction('staff_clocking', 'clock', 'request_correction');
  const visibleSections = useMemo(
    () => sections.filter((item) => canAccessPage('staff_clocking', item.page)),
    [canAccessPage],
  );
  const dateLabel = useMemo(todayInSchoolTime, []);

  return (
    <div className="min-h-full">
      <GlassPageTopBar
        eyebrow="Operations"
        title="Staff Clocking"
        recordDetails="A secure school-time record for staff arrival and review."
        badges={
          <Badge variant="outline" className={cn(
            'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300',
            bootstrap.data?.feature.enabled && 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
          )}>
            {bootstrap.isPending ? 'Checking setup' : bootstrap.data?.feature.enabled ? 'Enabled' : 'Not enabled'}
          </Badge>
        }
      />

      <main className="mx-auto max-w-7xl space-y-4 px-4 pb-28 sm:px-6 sm:pb-8 lg:px-8">
        <GlassSummaryBar
          left={
            <>
              <p className="text-sm font-semibold text-foreground">{dateLabel}</p>
              <p className="text-xs text-muted-foreground">All official times use the school&apos;s East Africa time.</p>
            </>
          }
          right={<div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200"><ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Server validation will confirm each clock event.</div>}
        />

        <nav aria-label="Staff clocking sections" className="grid grid-cols-3 gap-2 rounded-xl border border-border/70 bg-card/80 p-2 shadow-sm">
          {visibleSections.map((item) => {
            const Icon = item.icon;
            const active = item.id === section || (section === 'manage' && item.id === 'record');
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {bootstrap.isError && (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {bootstrap.error.message}
          </div>
        )}

        {section === 'clock' && <ClockPanel bootstrap={bootstrap.data} isLoading={bootstrap.isPending} canRequestExemption={canRequestExemption} canRequestCorrection={canRequestCorrection} />}
        {section === 'record' && <RecordDashboard bootstrap={bootstrap.data} canManage={canManage} canManageCalendar={canManageCalendar} canDisplayQr={canDisplayQr} canReviewRecords={canReviewRecords} />}
        {section === 'manage' && <ManagePanel bootstrap={bootstrap.data} canManage={canManage} canManageCalendar={canManageCalendar} canDisplayQr={canDisplayQr} isSaving={updateSettings.isPending} onSettingsChange={(settings) => {
          const feature = bootstrap.data?.feature;
          if (!feature) return;
          updateSettings.mutate({ ...feature, ...settings });
        }} />}
        {section === 'records' && <RecordsPanel canReviewRecords={canReviewRecords} canReviewExemptions={canReviewExemptions} canReviewCorrections={canReviewCorrections} canFinalize={canFinalize} />}
      </main>
    </div>
  );
}

function ClockPanel({ bootstrap, isLoading, canRequestExemption, canRequestCorrection }: { bootstrap?: StaffClockingBootstrap; isLoading: boolean; canRequestExemption: boolean; canRequestCorrection: boolean }) {
  const isEnabledForStaff = Boolean(bootstrap?.feature.enabled && bootstrap.access.isEnrolled);
  const dashboard = useOwnStaffClockingDashboard(Boolean(bootstrap?.access.canClock));
  const notifications = useOwnStaffClockingNotifications(Boolean(bootstrap?.access.canClock));
  const availabilityMessage = isLoading
    ? 'Checking whether Staff Clocking is available for your account.'
    : !bootstrap?.feature.enabled
      ? 'Your school has not enabled Staff Clocking yet.'
      : !bootstrap.access.isEnrolled
        ? 'Your linked staff account has not been enrolled for Staff Clocking yet.'
        : 'Your account is enrolled. A verified school schedule is required before scanning can start.';
  const data = dashboard.data; const record = data?.record; const clockIn = record?.effectiveClockInTime || record?.clockInTime; const clockOut = record?.effectiveClockOutTime || record?.clockOutTime; const exempt = record?.reviewStatus === 'exempted';
  const status = exempt ? { title: 'Approved exemption', description: 'Your approved exemption is recorded for today.', next: 'No scan required', tone: 'violet' as const } : clockOut ? { title: 'Clocking completed', description: 'Your arrival and departure have both been recorded.', next: 'No further clocking required', tone: 'green' as const } : clockIn ? { title: 'Currently clocked in', description: `Your arrival was recorded at ${formatScheduleTime(clockIn)}.`, next: 'Next action: scan to clock out', tone: record?.arrivalStatus === 'late' ? 'red' as const : record?.arrivalStatus === 'grace' ? 'amber' as const : 'green' as const } : { title: 'Not clocked in', description: 'You have not recorded your arrival today.', next: 'Next action: scan to clock in', tone: 'blue' as const };
  const scanAvailable = isEnabledForStaff && !exempt && data?.schedule.kind === 'scheduled';
  return <section className="space-y-4" aria-label="My Clock"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-bold tracking-tight">My Clock</h2><p className="mt-1 text-sm text-muted-foreground">Staff attendance and time tracking</p></div>{data?.staff && <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-card/80 px-3 py-2"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{data.staff.name.split(' ').map(part => part[0]).join('').slice(0, 2)}</div><div><p className="text-sm font-semibold">{data.staff.name}</p><p className="text-xs text-muted-foreground">{data.staff.group || 'Assigned staff schedule'}</p></div></div>}</div>
    <ClockingStatusCard title={status.title} description={status.description} next={status.next} tone={status.tone} isLoading={dashboard.isPending} />
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(19rem,.75fr)]"><Card className="overflow-hidden border-blue-200/70 bg-gradient-to-br from-blue-50/80 via-card to-indigo-50/60 dark:border-blue-900/70 dark:from-blue-950/30 dark:via-card dark:to-indigo-950/20"><CardHeader><CardTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5 text-primary" />QR Clock Scanner</CardTitle><CardDescription>{clockIn && !clockOut ? 'Scan the school QR when you are ready to clock out.' : 'Scan the school QR displayed by your authorised timekeeper.'}</CardDescription></CardHeader><CardContent className="space-y-4">{!isEnabledForStaff ? <div className="rounded-xl border border-dashed border-blue-300/80 bg-background/70 p-5"><p className="text-sm font-semibold">Clocking is not available for this account</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{availabilityMessage}</p></div> : data?.schedule.kind !== 'scheduled' ? <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5"><p className="font-semibold">No clocking is expected right now</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{data?.calendar?.label || data?.schedule.reason || 'Your current school calendar and staff schedule do not require a clocking scan today.'}</p></div> : <StaffClockingQrScanner available={scanAvailable} />}{(canRequestExemption || canRequestCorrection) && <StaffClockingRequestDialog canRequestExemption={canRequestExemption} canRequestCorrection={canRequestCorrection} />}</CardContent></Card>
      <div className="space-y-4"><Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-5 w-5 text-primary" />Today&apos;s Schedule</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">{data?.schedule.kind === 'scheduled' ? <><ScheduleRow label="Day type" value={data.calendar?.isClosed ? 'Approved special schedule' : 'Working day'} /><ScheduleRow label="Expected arrival" value={formatScheduleTime(data.schedule.clockInBy)} /><ScheduleRow label="Expected departure" value={formatScheduleTime(data.schedule.clockOutBy)} /><ScheduleRow label="Grace period" value={`${data.schedule.graceMinutes || 0} minutes`} /></> : <p className="leading-6 text-muted-foreground">{data?.calendar?.label || data?.schedule.reason || 'Your schedule is being checked.'}</p>}</CardContent></Card><div className="grid grid-cols-2 gap-4"><ClockTimeCard label="Clock In" value={clockIn ? formatScheduleTime(clockIn) : '—'} detail={clockIn ? humanArrival(record?.arrivalStatus) : 'Not yet'} tone={record?.arrivalStatus === 'late' ? 'red' : record?.arrivalStatus === 'grace' ? 'amber' : 'green'} /><ClockTimeCard label="Clock Out" value={clockOut ? formatScheduleTime(clockOut) : '—'} detail={clockOut ? 'Recorded' : 'Not yet'} tone={clockOut ? 'green' : 'neutral'} /></div></div></div>
    <Card><CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><div><CardTitle className="text-base">Recent Clocking Activity</CardTitle><CardDescription>Only your own verified clocking records.</CardDescription></div><Badge variant="outline">Last 5 days</Badge></div></CardHeader><CardContent>{dashboard.isPending ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading your records…</p> : dashboard.isError ? <p role="alert" className="text-sm text-destructive">{dashboard.error.message}</p> : data?.history.length ? <div className="overflow-x-auto"><table className="w-full min-w-[34rem] text-left text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Clock in</th><th className="px-3 py-2 font-medium">Clock out</th><th className="px-3 py-2 font-medium">Status</th></tr></thead><tbody>{data.history.map(item => <tr key={item.id} className="border-b last:border-0"><td className="px-3 py-3 font-medium">{item.localDate}</td><td className="px-3 py-3">{formatScheduleTime(item.effectiveClockInTime || item.clockInTime)}</td><td className="px-3 py-3">{formatScheduleTime(item.effectiveClockOutTime || item.clockOutTime)}</td><td className="px-3 py-3"><Badge variant={item.arrivalStatus === 'late' ? 'destructive' : 'secondary'}>{humanArrival(item.arrivalStatus)}</Badge></td></tr>)}</tbody></table></div> : <p className="text-sm text-muted-foreground">No earlier clocking records are available yet.</p>}</CardContent></Card>
    {notifications.data?.length ? <div className="rounded-xl border border-border bg-background/70 p-4"><p className="text-sm font-semibold">Clocking updates</p><ul className="mt-2 space-y-2">{notifications.data.map((notice) => <li key={notice.id} className="text-sm"><span className="font-medium">{notice.title}</span><span className="block text-muted-foreground">{notice.body}</span></li>)}</ul></div> : null}
  </section>;
}

function ClockingStatusCard({ title, description, next, tone, isLoading }: { title: string; description: string; next: string; tone: 'blue' | 'green' | 'amber' | 'red' | 'violet'; isLoading: boolean }) { const styles = { blue: 'border-blue-200 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/25', green: 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/25', amber: 'border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/25', red: 'border-rose-200 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/25', violet: 'border-violet-200 bg-violet-50/70 dark:border-violet-900 dark:bg-violet-950/25' }; return <Card className={styles[tone]}><CardContent className="flex items-center gap-4 p-5"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-background/70 text-primary"><CheckCircle2 className="h-6 w-6" /></div><div><p className="font-semibold">{isLoading ? 'Checking your confirmed clocking status…' : title}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p><p className="mt-2 text-sm font-medium">{next}</p></div></CardContent></Card>; }
function ClockTimeCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'green' | 'amber' | 'red' | 'neutral' }) { const styles = { green: 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20', amber: 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20', red: 'border-rose-200 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/20', neutral: 'border-border bg-muted/30' }; return <Card className={styles[tone]}><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent></Card>; }
function humanArrival(status?: string) { return status === 'on_time' ? 'On time' : status === 'grace' ? 'Within grace' : status === 'late' ? 'Late' : 'Not yet'; }

function StaffClockingRequestDialog({ canRequestExemption, canRequestCorrection }: { canRequestExemption: boolean; canRequestCorrection: boolean }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'exemption' | 'correction'>(canRequestExemption ? 'exemption' : 'correction');
  const [localDate, setLocalDate] = useState(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
  const [reason, setReason] = useState('');
  const [clockInTime, setClockInTime] = useState('08:00');
  const request = useCreateStaffClockingRequest(kind);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    request.mutate({ localDate, reason, ...(kind === 'correction' ? { proposedClockInTime: clockInTime } : {}) }, { onSuccess: () => { setReason(''); setOpen(false); } });
  };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button type="button" variant="outline" className="min-h-11">Request an exemption or correction</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Clocking request</DialogTitle><DialogDescription>Requests are reviewed by another authorised staff member. You cannot approve your own request.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={submit}><div className="flex gap-2">{canRequestExemption && <Button type="button" variant={kind === 'exemption' ? 'default' : 'outline'} onClick={() => setKind('exemption')}>Exemption</Button>}{canRequestCorrection && <Button type="button" variant={kind === 'correction' ? 'default' : 'outline'} onClick={() => setKind('correction')}>Correction</Button>}</div><div className="space-y-2"><Label htmlFor="clock-request-date">Work date</Label><Input id="clock-request-date" type="date" value={localDate} onChange={(event) => setLocalDate(event.target.value)} required /></div>{kind === 'correction' && <div className="space-y-2"><Label htmlFor="clock-request-time">Proposed clock-in time</Label><Input id="clock-request-time" type="time" value={clockInTime} onChange={(event) => setClockInTime(event.target.value)} required /></div>}<div className="space-y-2"><Label htmlFor="clock-request-reason">Reason</Label><Input id="clock-request-reason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={8} required /></div>{request.error && <p role="alert" className="text-sm text-destructive">{request.error.message}</p>}<DialogFooter><Button type="submit" disabled={request.isPending}>{request.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Send request</Button></DialogFooter></form></DialogContent></Dialog>;
}

function schoolDateKey(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatSchoolTime(now: Date) {
  return new Intl.DateTimeFormat('en-UG', { timeZone: 'Africa/Kampala', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(now);
}

function formatScheduleTime(value?: string) {
  if (!value) return 'Not configured';
  const [hour, minute] = value.split(':').map(Number);
  const date = new Date(Date.UTC(2020, 0, 1, hour, minute || 0));
  return new Intl.DateTimeFormat('en-UG', { timeZone: 'UTC', hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
}

function RecordDashboard({ bootstrap, canManage, canManageCalendar, canDisplayQr, canReviewRecords }: {
  bootstrap?: StaffClockingBootstrap;
  canManage: boolean;
  canManageCalendar: boolean;
  canDisplayQr: boolean;
  canReviewRecords: boolean;
}) {
  const [now, setNow] = useState(() => new Date());
  const today = schoolDateKey(now);
  const schedules = useStaffClockingSchedules(canManage);
  const closures = useStaffClockingClosures(canManageCalendar);
  const records = useStaffClockingDailyRecords({ from: today, to: today }, canReviewRecords);
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1_000); return () => window.clearInterval(timer); }, []);

  const activeSchedule = useMemo(() => {
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
    return schedules.data?.filter((schedule) => schedule.isActive && schedule.scope === 'school')
      .filter((schedule) => schedule.kind === 'date_override' ? schedule.workDate === today : schedule.weekdays?.includes(weekday) && (!schedule.startsOn || schedule.startsOn <= today) && (!schedule.endsOn || schedule.endsOn >= today))
      .sort((left, right) => (right.priority || 0) - (left.priority || 0))[0];
  }, [schedules.data, today]);
  const closure = useMemo(() => closures.data?.find((item) => {
    const start = String(item.startDate || ''); const end = String(item.endDate || start);
    return start <= today && end >= today;
  }), [closures.data, today]);
  const status = !bootstrap?.feature.enabled ? 'Clocking not enabled' : closure ? 'Special school day' : bootstrap.hasActiveSchedule ? 'Clocking active' : 'Schedule setup needed';
  const statusClass = bootstrap?.feature.enabled && bootstrap.hasActiveSchedule && !closure ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300';
  const summary = records.data?.summary;

  return (
    <section className="space-y-4" aria-label="Staff clocking record dashboard">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-2xl font-bold tracking-tight">Record</h2><p className="text-sm text-muted-foreground">Staff clocking management</p></div>
        <Badge variant="outline" className={cn('min-h-9 rounded-full px-3 text-sm', statusClass)}><span className="mr-2 h-2.5 w-2.5 rounded-full bg-current" />{status}</Badge>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden border-blue-200/70 bg-gradient-to-br from-blue-50/80 via-card to-indigo-50/60 dark:border-blue-900/70 dark:from-blue-950/30 dark:via-card dark:to-indigo-950/20">
          <CardHeader className="pb-3"><div className="flex items-start justify-between gap-4"><div><CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5 text-primary" />School Clocking QR</CardTitle><CardDescription className="mt-1">Staff should scan this code using their Clock page.</CardDescription></div>{canDisplayQr && <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">Connected</Badge>}</div></CardHeader>
          <CardContent>{canDisplayQr ? <StaffClockingQrDisplay available={Boolean(bootstrap?.feature.enabled && bootstrap.hasActiveSchedule)} showFullscreen /> : <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center"><QrCode className="h-12 w-12 text-muted-foreground" /><p className="mt-3 font-semibold">QR display permission is required</p><p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">An authorised timekeeper can open the secure school QR from this page.</p></div>}</CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="overflow-hidden border-blue-200/70 bg-gradient-to-br from-card via-card to-blue-50/70 dark:border-blue-900/70 dark:to-blue-950/20"><CardContent className="flex min-h-52 items-center gap-4 p-6"><div className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-100 text-primary sm:flex dark:bg-blue-950"><Clock3 className="h-8 w-8" /></div><div><p className="font-semibold">Official School Time</p><time className="mt-1 block text-4xl font-bold tracking-tight text-primary sm:text-5xl" dateTime={now.toISOString()}>{formatSchoolTime(now)}</time><p className="mt-2 text-sm font-medium">{todayInSchoolTime()}</p><p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-emerald-500" />Clocking events are validated by the server · EAT</p></div></CardContent></Card>
          <Card><CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-5 w-5 text-primary" />Today&apos;s attendance schedule</CardTitle><Badge variant="secondary">{closure ? 'Special day' : activeSchedule ? 'Normal day' : 'Not configured'}</Badge></div></CardHeader><CardContent className="space-y-3 text-sm"><ScheduleRow label="Day type" value={closure ? String(closure.title || 'School closure') : activeSchedule ? 'Normal school day' : 'No school schedule'} /><ScheduleRow label="Default arrival" value={formatScheduleTime(activeSchedule?.clockInBy)} /><ScheduleRow label="Default departure" value={formatScheduleTime(activeSchedule?.clockOutBy)} /><ScheduleRow label="Grace period" value={activeSchedule ? `${activeSchedule.graceMinutes} minutes` : '—'} /><p className="border-t pt-3 text-xs leading-5 text-muted-foreground">Individual staff and group schedules may differ. Their applicable schedule is resolved securely when they scan.</p></CardContent></Card>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/staff-clocking/manage" className="group rounded-2xl border border-blue-200/80 bg-gradient-to-r from-blue-50 to-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-blue-900/70 dark:from-blue-950/25"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"><CalendarClock className="h-6 w-6" /></div><div className="min-w-0 flex-1"><p className="font-semibold">Manage</p><p className="text-sm text-muted-foreground">Schedules, rules &amp; staff access</p></div><ChevronRight className="h-5 w-5 text-primary transition-transform group-hover:translate-x-1" /></div></Link>
        {canManageCalendar ? <ManagerExemptionDialog /> : <Link href="/staff-clocking/records" className="group rounded-2xl border border-violet-200/80 bg-gradient-to-r from-violet-50 to-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-violet-900/70 dark:from-violet-950/25"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm"><BookOpenCheck className="h-6 w-6" /></div><div className="min-w-0 flex-1"><p className="font-semibold">Exempt</p><p className="text-sm text-muted-foreground">Review leave &amp; absence requests</p></div><ChevronRight className="h-5 w-5 text-violet-600 transition-transform group-hover:translate-x-1" /></div></Link>}
      </div>

      <Card><CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><CardTitle className="flex items-center gap-2 text-base"><Users className="h-5 w-5 text-primary" />Today&apos;s clocking overview</CardTitle>{canReviewRecords && <Link href={`/staff-clocking/records?from=${today}&to=${today}`} className="text-sm font-semibold text-primary hover:underline">View detailed report</Link>}</div></CardHeader><CardContent>{!canReviewRecords ? <p className="text-sm text-muted-foreground">Clock-record totals are only visible to authorised record reviewers.</p> : records.isPending ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Updating today&apos;s totals…</p> : records.isError ? <p role="alert" className="text-sm text-destructive">{records.error.message}</p> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-5"><OverviewMetric label="Clocked" value={summary?.total || 0} icon={Users} tone="blue" /><OverviewMetric label="Complete" value={summary?.complete || 0} icon={UserCheck} tone="green" /><OverviewMetric label="Open" value={summary?.open || 0} icon={Clock3} tone="amber" /><OverviewMetric label="Late" value={summary?.late || 0} icon={UserRoundX} tone="red" /><OverviewMetric label="Exempt" value={summary?.exempted || 0} icon={UserRoundCheck} tone="violet" /></div>}</CardContent></Card>
    </section>
  );
}

function ScheduleRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div>; }

function OverviewMetric({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Users; tone: 'blue' | 'green' | 'amber' | 'red' | 'violet' }) {
  const styles = { blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/35 dark:text-blue-300', green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300', amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/35 dark:text-amber-300', red: 'bg-rose-50 text-rose-700 dark:bg-rose-950/35 dark:text-rose-300', violet: 'bg-violet-50 text-violet-700 dark:bg-violet-950/35 dark:text-violet-300' };
  return <div className={cn('rounded-xl p-3', styles[tone])}><Icon className="h-4 w-4" /><p className="mt-2 text-xs font-medium opacity-80">{label}</p><p className="text-2xl font-bold">{value}</p></div>;
}

function ManagerExemptionDialog() {
  const [open, setOpen] = useState(false); const [staffId, setStaffId] = useState(''); const [localDate, setLocalDate] = useState(() => schoolDateKey()); const [reason, setReason] = useState('');
  const staff = useStaffClockingStaffCandidates(true); const createExemption = useCreateManagedStaffClockingExemption();
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); createExemption.mutate({ staffId, localDate, reason }, { onSuccess: () => { setReason(''); setOpen(false); } }); };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><button type="button" className="group w-full rounded-2xl border border-violet-200/80 bg-gradient-to-r from-violet-50 to-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-violet-900/70 dark:from-violet-950/25"><span className="flex items-center gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm"><BookOpenCheck className="h-6 w-6" /></span><span className="min-w-0 flex-1"><span className="block font-semibold">Exempt</span><span className="block text-sm text-muted-foreground">Leave &amp; absence</span></span><ChevronRight className="h-5 w-5 text-violet-600 transition-transform group-hover:translate-x-1" /></span></button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Record exemption</DialogTitle><DialogDescription>Apply an authorised full-day exemption. Existing clock events remain untouched and the action is written to the audit history.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={submit}><div className="space-y-2"><Label htmlFor="manager-exemption-staff">Staff member</Label><select id="manager-exemption-staff" value={staffId} onChange={(event) => setStaffId(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" required><option value="">Choose staff</option>{staff.data?.map(member => <option value={member.id} key={member.id}>{member.name}</option>)}</select></div><div className="space-y-2"><Label htmlFor="manager-exemption-date">Work date</Label><Input id="manager-exemption-date" type="date" value={localDate} onChange={(event) => setLocalDate(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="manager-exemption-reason">Reason</Label><Input id="manager-exemption-reason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={8} placeholder="e.g. Approved medical leave" required /></div>{createExemption.error && <p role="alert" className="text-sm text-destructive">{createExemption.error.message}</p>}<DialogFooter><Button type="submit" disabled={createExemption.isPending || staff.isPending}>{createExemption.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Record exemption</Button></DialogFooter></form></DialogContent></Dialog>;
}

function ManagePanel({ bootstrap, canManage, canManageCalendar, canDisplayQr, isSaving, onSettingsChange }: {
  bootstrap?: StaffClockingBootstrap;
  canManage: boolean;
  canManageCalendar: boolean;
  canDisplayQr: boolean;
  isSaving: boolean;
  onSettingsChange: (settings: Pick<StaffClockingFeatureSettings, 'enabled' | 'accessMode' | 'enrolledStaffIds'>) => void;
}) {
  const schedules = useStaffClockingSchedules(canManage);
  const createSchedule = useCreateStaffClockingSchedule();
  const updateSchedule = useUpdateStaffClockingSchedule();
  const deleteSchedule = useDeleteStaffClockingSchedule();
  const staff = useStaffClockingStaffCandidates(canManage);
  const closures = useStaffClockingClosures(canManageCalendar);
  const createClosure = useCreateStaffClockingClosure();
  const [activePanel, setActivePanel] = useState<'school-days' | 'special-days' | 'holidays' | 'grace' | 'penalties' | 'staff-groups' | 'advanced' | null>(null);
  const feature = bootstrap?.feature;
  const normalSchedules = schedules.data?.filter((schedule) => schedule.kind === 'recurring') || [];
  const specialSchedules = schedules.data?.filter((schedule) => schedule.kind === 'date_override') || [];
  const defaultSchedule = normalSchedules.find((schedule) => schedule.scope === 'school' && schedule.isActive);
  const panelTitle = {
    'school-days': 'School days', 'special-days': 'Special days', holidays: 'Public holidays', grace: 'Grace period', penalties: 'Penalty rules', 'staff-groups': 'Staff groups & assignments', advanced: 'Advanced settings',
  } as const;
  const panelDescription = {
    'school-days': 'Regular working days, expected arrival times and effective schedules.',
    'special-days': 'Date-specific working arrangements that leave the normal schedule unchanged.',
    holidays: 'Calendar-linked non-working days and approved school closures.',
    grace: 'The minutes after an expected arrival that are accepted before an employee is late.',
    penalties: 'Review-only policy information. Clocking does not deduct salary automatically.',
    'staff-groups': 'Use existing staff departments, roles and individual schedules instead of duplicate group records.',
    advanced: 'Feature access, QR display permissions, and the revision-controlled clocking configuration.',
  } as const;
  return (
    <section className="space-y-5" aria-label="Manage staff clocking">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4"><Link href="/staff-clocking/record" className="mt-1 inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-medium text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><ArrowLeft className="h-4 w-4" />Back to Record</Link><div><h2 className="text-2xl font-bold tracking-tight">Manage Clocking</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Configure working schedules, special days, holidays, grace periods, staff assignments and secure clocking controls.</p></div></div>
        <Card className="min-w-[18rem] border-blue-200/80 bg-blue-50/70 dark:border-blue-900/70 dark:bg-blue-950/20"><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">Current configuration</p><p className="mt-1 text-sm text-muted-foreground">{defaultSchedule ? `${defaultSchedule.weekdays?.length || 0} working days · ETA ${formatScheduleTime(defaultSchedule.clockInBy)}${defaultSchedule.clockOutBy ? ` · ETD ${formatScheduleTime(defaultSchedule.clockOutBy)}` : ''}` : 'No school schedule yet'}</p><p className="mt-1 text-xs text-muted-foreground">Grace: {defaultSchedule ? `${defaultSchedule.graceMinutes} minutes` : '—'} · Revision {feature?.revision ?? '—'}</p></div><Badge variant="outline" className={feature?.enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-amber-200 bg-amber-50 text-amber-800'}>{feature?.enabled ? 'Active' : 'Inactive'}</Badge></div></CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ManageDashboardCard icon={CalendarDays} tone="blue" title="School Days" description="Regular working days and expected arrival times." onClick={() => setActivePanel('school-days')} />
        <ManageDashboardCard icon={CalendarClock} tone="violet" title="Special Days" description="Date-specific working arrangements." onClick={() => setActivePanel('special-days')} />
        <ManageDashboardCard icon={BookOpenCheck} tone="rose" title="Public Holidays" description="Calendar decisions and school closures." onClick={() => setActivePanel('holidays')} />
        <ManageDashboardCard icon={AlarmClock} tone="amber" title="Grace Period" description="Allowed minutes before an arrival is late." onClick={() => setActivePanel('grace')} />
        <ManageDashboardCard icon={Coins} tone="amber" title="Penalty Rules" description="Review-only proposed lateness policy." onClick={() => setActivePanel('penalties')} />
        <ManageDashboardCard icon={UsersRound} tone="violet" title="Staff Groups & Assignments" description="Department, role and individual schedules." onClick={() => setActivePanel('staff-groups')} />
        <ManageDashboardCard icon={ShieldEllipsis} tone="blue" title="Advanced Settings" description="QR security, staff access and configuration revision." className="md:col-span-2 xl:col-span-3" onClick={() => setActivePanel('advanced')} />
      </div>

      <ManageOverview defaultSchedule={defaultSchedule} specialSchedules={specialSchedules} closures={closures.data || []} />

      {activePanel && <Card className="border-primary/20 shadow-md"><CardHeader className="border-b border-border/70 bg-muted/20"><div className="flex flex-wrap items-start justify-between gap-3"><div><Button type="button" variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => setActivePanel(null)}><ArrowLeft className="h-4 w-4" />Manage Clocking</Button><CardTitle className="text-xl">{panelTitle[activePanel]}</CardTitle><CardDescription className="mt-1">{panelDescription[activePanel]}</CardDescription></div><Badge variant="secondary">Changes affect future scans only</Badge></div></CardHeader><CardContent className="space-y-4 p-4 sm:p-6">
        {!canManage && activePanel !== 'holidays' ? <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-sm"><p className="font-semibold">Schedule-management permission is required</p><p className="mt-1 text-muted-foreground">Ask an administrator to grant Manage schedules before changing clocking rules.</p></div> : <>
          {activePanel === 'school-days' && <ScheduleManager schedules={normalSchedules} isLoading={schedules.isPending} staff={staff.data || []} createPending={createSchedule.isPending} updatePending={updateSchedule.isPending} deletePending={deleteSchedule.isPending} createError={createSchedule.error?.message} onCreate={(schedule) => createSchedule.mutate(schedule)} onUpdate={(id, schedule) => updateSchedule.mutate({ id, schedule })} onDelete={(id) => deleteSchedule.mutate(id)} />}
          {activePanel === 'special-days' && <SpecialDaysPanel schedules={specialSchedules} isLoading={schedules.isPending} staff={staff.data || []} createPending={createSchedule.isPending} updatePending={updateSchedule.isPending} deletePending={deleteSchedule.isPending} createError={createSchedule.error?.message} onCreate={(schedule) => createSchedule.mutate(schedule)} onUpdate={(id, schedule) => updateSchedule.mutate({ id, schedule })} onDelete={(id) => deleteSchedule.mutate(id)} />}
          {activePanel === 'holidays' && (canManageCalendar ? <ClosurePanel closures={closures.data || []} isLoading={closures.isPending} error={closures.error?.message} creating={createClosure.isPending} onCreate={(closure) => createClosure.mutate(closure)} /> : <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-sm"><p className="font-semibold">Calendar-management permission is required</p><p className="mt-1 text-muted-foreground">Holiday data stays in the existing Events &amp; Calendar module. Grant calendar permission to make an attendance decision.</p></div>)}
          {activePanel === 'grace' && <GracePanel schedules={normalSchedules} updatePending={updateSchedule.isPending} onUpdate={(id, schedule) => updateSchedule.mutate({ id, schedule })} />}
          {activePanel === 'penalties' && <PenaltyBoundary />}
          {activePanel === 'staff-groups' && <div className="space-y-4">{feature && <EnrollmentPanel feature={feature} staff={staff.data || []} saving={isSaving} onSave={(accessMode, enrolledStaffIds) => onSettingsChange({ enabled: feature.enabled, accessMode, enrolledStaffIds })} />}<ScheduleManager schedules={normalSchedules.filter((schedule) => schedule.scope !== 'school')} isLoading={schedules.isPending} staff={staff.data || []} createPending={createSchedule.isPending} updatePending={updateSchedule.isPending} deletePending={deleteSchedule.isPending} createError={createSchedule.error?.message} onCreate={(schedule) => createSchedule.mutate(schedule)} onUpdate={(id, schedule) => updateSchedule.mutate({ id, schedule })} onDelete={(id) => deleteSchedule.mutate(id)} groupOnly /></div>}
          {activePanel === 'advanced' && <div className="space-y-4">{!canDisplayQr && <div className="rounded-xl border border-dashed border-border bg-muted/35 p-5 text-sm"><p className="font-semibold">QR display permission is not assigned</p><p className="mt-1 text-muted-foreground">An authorised timekeeper can display the secure school QR from Record.</p></div>}{feature && <div className="rounded-xl border border-border/80 bg-background/70 p-4"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold">Enable Staff Clocking</p><p className="mt-1 text-sm text-muted-foreground">Publishing is revision-controlled. Scanning remains unavailable until an active schedule exists.</p></div><Switch checked={feature.enabled} onCheckedChange={(enabled) => onSettingsChange({ enabled, accessMode: feature.accessMode, enrolledStaffIds: feature.enrolledStaffIds })} disabled={isSaving} aria-label="Enable Staff Clocking" /></div>{isSaving && <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving feature setting…</p>}</div>}<StatusCard icon={ShieldEllipsis} title="Security and audit boundary" description="QR signing keys and token validation remain server-controlled. Every schedule, closure, exemption and review action is recorded in the audit history." /></div>}
        </>}
      </CardContent></Card>}
    </section>
  );
}

function ManageDashboardCard({ icon: Icon, tone, title, description, onClick, className }: { icon: typeof CalendarDays; tone: 'blue' | 'violet' | 'rose' | 'amber'; title: string; description: string; onClick: () => void; className?: string }) {
  const tones = { blue: 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300', violet: 'bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300', rose: 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300', amber: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300' };
  return <button type="button" onClick={onClick} className={cn('group flex min-h-28 items-center gap-4 rounded-2xl border border-border/80 bg-card/85 p-5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', className)}><span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', tones[tone])}><Icon className="h-6 w-6" /></span><span className="min-w-0 flex-1"><span className="block font-semibold">{title}</span><span className="mt-1 block text-sm leading-5 text-muted-foreground">{description}</span></span><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-primary group-hover:bg-primary/10"><ChevronRight className="h-4 w-4" /></span></button>;
}

function ManageOverview({ defaultSchedule, specialSchedules, closures }: { defaultSchedule?: import('@/lib/staff-clocking/contracts').StaffClockingSchedule; specialSchedules: import('@/lib/staff-clocking/contracts').StaffClockingSchedule[]; closures: Array<Record<string, unknown>> }) {
  const upcoming = [...specialSchedules.map((schedule) => ({ id: schedule.id, date: schedule.workDate || '', title: `Special ${schedule.scope} schedule`, detail: `ETA ${formatScheduleTime(schedule.clockInBy)}${schedule.clockOutBy ? ` · ETD ${formatScheduleTime(schedule.clockOutBy)}` : ''}`, tone: 'blue' })), ...closures.map((closure) => ({ id: String(closure.id), date: String(closure.startDate || ''), title: String(closure.title || 'School closure'), detail: 'Non-working unless a staff date override applies', tone: 'rose' }))].filter((item) => item.date).sort((left, right) => left.date.localeCompare(right.date)).slice(0, 5);
  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,.9fr)]"><Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-5 w-5 text-primary" />Calendar overview</CardTitle><CardDescription>Upcoming special schedules and calendar-linked school closures.</CardDescription></CardHeader><CardContent>{upcoming.length ? <ul className="space-y-3">{upcoming.map((item) => <li key={item.id} className="flex items-center gap-3 rounded-xl border border-border/80 bg-background/70 p-3"><div className={cn('rounded-lg px-3 py-2 text-center text-xs font-bold', item.tone === 'rose' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300')}><span className="block">{item.date}</span></div><div><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.detail}</p></div></li>)}</ul> : <div className="rounded-xl border border-dashed border-border bg-muted/25 p-5 text-sm text-muted-foreground">No special days or staff-clock closures are scheduled.</div>}</CardContent></Card><Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Users className="h-5 w-5 text-primary" />Quick stats</CardTitle><CardDescription>Current configuration summary.</CardDescription></CardHeader><CardContent className="grid grid-cols-2 gap-3"><ManageStat label="Working days" value={defaultSchedule?.weekdays?.length || 0} detail={defaultSchedule?.weekdays?.map(day => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]).join('–') || 'Not configured'} tone="green" /><ManageStat label="Special days" value={specialSchedules.length} detail="Configured overrides" tone="violet" /><ManageStat label="Grace period" value={defaultSchedule?.graceMinutes || 0} detail="School default minutes" tone="amber" /><ManageStat label="Expected departure" value={defaultSchedule?.clockOutBy ? formatScheduleTime(defaultSchedule.clockOutBy) : '—'} detail="Does not end an open shift" tone="blue" /></CardContent></Card></div>;
}

function ManageStat({ label, value, detail, tone }: { label: string; value: string | number; detail: string; tone: 'green' | 'violet' | 'amber' | 'blue' }) { const styles = { green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300', violet: 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300', amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300', blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300' }; return <div className={cn('rounded-xl p-3', styles[tone])}><p className="text-xs font-medium opacity-80">{label}</p><p className="mt-1 text-xl font-bold">{value}</p><p className="mt-1 text-xs opacity-80">{detail}</p></div>; }

type EditableSchedule = Omit<import('@/lib/staff-clocking/contracts').StaffClockingSchedule, 'id'>;
type ScheduleManagerProps = { schedules: import('@/lib/staff-clocking/contracts').StaffClockingSchedule[]; isLoading: boolean; staff: import('@/lib/staff-clocking/contracts').StaffClockingStaffCandidate[]; createPending: boolean; updatePending: boolean; deletePending: boolean; createError?: string; onCreate: (schedule: EditableSchedule) => void; onUpdate: (id: string, schedule: EditableSchedule) => void; onDelete: (id: string) => void; groupOnly?: boolean; };

function ScheduleManager({ schedules, isLoading, staff, createPending, updatePending, deletePending, createError, onCreate, onUpdate, onDelete, groupOnly = false }: ScheduleManagerProps) {
  return <div className="space-y-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{groupOnly ? 'Group and individual assignments' : 'Regular working schedules'}</p><p className="mt-1 text-sm text-muted-foreground">{groupOnly ? 'Staff and group rules take precedence over the school default for the fields they define.' : 'Each saved schedule applies prospectively. Existing daily records retain their original saved values.'}</p></div><SchoolScheduleDialog staff={staff} disabled={createPending} error={createError} onCreate={onCreate} /></div>{isLoading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading schedules…</p> : schedules.length ? <ul className="space-y-3">{schedules.map((schedule) => <li key={schedule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/70 p-4"><div><p className="font-medium capitalize">{schedule.scope === 'school' ? 'School default' : `${schedule.scope} rule${schedule.subjectId ? ` · ${schedule.subjectId}` : ''}`}</p><p className="mt-1 text-sm text-muted-foreground">{schedule.weekdays?.map(day => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]).join(', ')} · ETA {formatScheduleTime(schedule.clockInBy)}{schedule.clockOutBy ? ` · ETD ${formatScheduleTime(schedule.clockOutBy)}` : ''} · Grace {schedule.graceMinutes} min</p></div><div className="flex items-center gap-2"><Badge variant={schedule.isActive ? 'secondary' : 'outline'}>{schedule.isActive ? 'Active' : 'Inactive'}</Badge><ScheduleEditDialog schedule={schedule} saving={updatePending} onSave={(next) => onUpdate(schedule.id, next)} /><Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label={`Delete ${schedule.scope} schedule`} disabled={deletePending} onClick={() => { if (window.confirm('Delete this staff clocking schedule?')) onDelete(schedule.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></li>)}</ul> : <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-sm"><p className="font-semibold">No {groupOnly ? 'group or individual' : 'regular'} schedules yet</p><p className="mt-1 text-muted-foreground">Create a rule before presenting the QR to staff who should clock in.</p></div>}</div>;
}

function SpecialDaysPanel({ schedules, isLoading, staff, createPending, updatePending, deletePending, createError, onCreate, onUpdate, onDelete }: Omit<ScheduleManagerProps, 'groupOnly'>) {
  return <div className="space-y-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">Date-specific schedules</p><p className="mt-1 text-sm text-muted-foreground">A special day overrides the usual schedule only for its chosen date and scope.</p></div><SpecialScheduleDialog staff={staff} disabled={createPending} error={createError} onCreate={onCreate} /></div>{isLoading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading special days…</p> : schedules.length ? <ul className="space-y-3">{schedules.map((schedule) => <li key={schedule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/70 p-4"><div><p className="font-medium">{schedule.workDate || 'Special date'} · <span className="capitalize">{schedule.scope}</span>{schedule.subjectId ? ` · ${schedule.subjectId}` : ''}</p><p className="mt-1 text-sm text-muted-foreground">ETA {formatScheduleTime(schedule.clockInBy)} · Grace {schedule.graceMinutes} min · priority {schedule.priority || 0}</p></div><div className="flex items-center gap-2"><Badge variant={schedule.isActive ? 'secondary' : 'outline'}>{schedule.isActive ? 'Active' : 'Inactive'}</Badge><ScheduleEditDialog schedule={schedule} saving={updatePending} onSave={(next) => onUpdate(schedule.id, next)} /><Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label="Delete special day" disabled={deletePending} onClick={() => { if (window.confirm('Delete this special-day schedule?')) onDelete(schedule.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></li>)}</ul> : <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-sm"><p className="font-semibold">No upcoming special schedules</p><p className="mt-1 text-muted-foreground">Add an exception for a staff meeting, training, Saturday activity or other one-off working day.</p></div>}</div>;
}

function GracePanel({ schedules, updatePending, onUpdate }: { schedules: import('@/lib/staff-clocking/contracts').StaffClockingSchedule[]; updatePending: boolean; onUpdate: (id: string, schedule: EditableSchedule) => void }) {
  const defaultSchedule = schedules.find((schedule) => schedule.scope === 'school' && schedule.isActive);
  return <div className="space-y-4"><div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-900 dark:bg-amber-950/20"><p className="font-semibold">School default grace period</p><p className="mt-1 text-sm text-muted-foreground">{defaultSchedule ? `For an ETA of ${formatScheduleTime(defaultSchedule.clockInBy)}, arrivals through ${formatScheduleTime(addMinutes(defaultSchedule.clockInBy, defaultSchedule.graceMinutes))} are within grace.` : 'Create a school schedule first to define the default grace period.'}</p></div>{defaultSchedule ? <ScheduleEditDialog schedule={defaultSchedule} saving={updatePending} onSave={(next) => onUpdate(defaultSchedule.id, next)} /> : null}<p className="text-sm leading-6 text-muted-foreground">Individual and group schedules can each set their own grace period. Approved exemptions remain distinct from an employee&apos;s actual arrival time.</p></div>;
}

function PenaltyBoundary() { return <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-900 dark:bg-amber-950/20"><div className="flex items-start gap-3"><Coins className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" /><div><p className="font-semibold">Review-only boundary</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Clocking currently classifies on-time, grace and late arrivals, but it does not calculate or deduct money. A salary-deduction policy needs a separately approved payroll and legal-compliance workflow; it must not be activated from attendance configuration alone.</p></div></div></div>; }

function addMinutes(time: string, minutes: number) { const [hour, minute] = time.split(':').map(Number); const total = ((hour * 60 + minute + minutes) % (24 * 60) + 24 * 60) % (24 * 60); return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`; }

function EnrollmentPanel({ feature, staff, saving, onSave }: { feature: StaffClockingFeatureSettings; staff: import('@/lib/staff-clocking/contracts').StaffClockingStaffCandidate[]; saving: boolean; onSave: (accessMode: StaffClockingFeatureSettings['accessMode'], staffIds: string[]) => void }) {
  const [selected, setSelected] = useState(feature.enrolledStaffIds);
  const [mode, setMode] = useState<StaffClockingFeatureSettings['accessMode']>(feature.accessMode);
  return <div className="rounded-xl border border-border/80 bg-background/70 p-4"><p className="text-sm font-semibold">Staff access</p><p className="mt-1 text-sm text-muted-foreground">Choose all active linked staff or a selected pilot group.</p><div className="mt-3 flex gap-2"><Button type="button" size="sm" variant={mode === 'all_active_linked_staff' ? 'default' : 'outline'} onClick={() => setMode('all_active_linked_staff')}>All active staff</Button><Button type="button" size="sm" variant={mode === 'selected_staff' ? 'default' : 'outline'} onClick={() => setMode('selected_staff')}>Selected staff</Button></div>{mode === 'selected_staff' && <div className="mt-3 max-h-44 space-y-2 overflow-auto rounded-lg border p-3">{staff.map((member) => <label key={member.id} className="flex items-center gap-2 text-sm"><Checkbox checked={selected.includes(member.id)} onCheckedChange={(checked) => setSelected(current => checked ? [...new Set([...current, member.id])] : current.filter(id => id !== member.id))} />{member.name}</label>)}</div>}<Button type="button" variant="outline" className="mt-3 min-h-10" disabled={saving || (mode === 'selected_staff' && selected.length === 0)} onClick={() => onSave(mode, selected)}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Save access</Button></div>;
}

function ClosurePanel({ closures, isLoading, error, creating, onCreate }: { closures: Array<Record<string, unknown>>; isLoading: boolean; error?: string; creating: boolean; onCreate: (closure: { title: string; startDate: string; endDate?: string; description?: string }) => void }) {
  const [title, setTitle] = useState(''); const [startDate, setStartDate] = useState(''); const [endDate, setEndDate] = useState('');
  return <div className="rounded-xl border border-border/80 bg-background/70 p-4"><p className="text-sm font-semibold">School closures</p><p className="mt-1 text-sm text-muted-foreground">Approved closures stop recurring schedules unless a staff date override applies.</p><form className="mt-3 grid gap-2 sm:grid-cols-4" onSubmit={(event) => { event.preventDefault(); onCreate({ title, startDate, endDate: endDate || undefined }); setTitle(''); setStartDate(''); setEndDate(''); }}><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Closure title" minLength={3} required /><Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /><Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /><Button type="submit" disabled={creating}>{creating && <Loader2 className="h-4 w-4 animate-spin" />}Add closure</Button></form>{error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}<ul className="mt-3 space-y-1 text-sm text-muted-foreground">{isLoading ? <li>Loading closures…</li> : closures.length ? closures.slice(0, 5).map((closure) => <li key={String(closure.id)}>{String(closure.title)} · {String(closure.startDate)}{closure.endDate && closure.endDate !== closure.startDate ? `–${String(closure.endDate)}` : ''}</li>) : <li>No custom closures.</li>}</ul></div>;
}

function ScheduleEditDialog({ schedule, saving, onSave }: { schedule: import('@/lib/staff-clocking/contracts').StaffClockingSchedule; saving: boolean; onSave: (schedule: Omit<import('@/lib/staff-clocking/contracts').StaffClockingSchedule, 'id'>) => void }) {
  const [open, setOpen] = useState(false); const [clockInBy, setClockInBy] = useState(schedule.clockInBy); const [clockOutBy, setClockOutBy] = useState(schedule.clockOutBy || ''); const [graceMinutes, setGraceMinutes] = useState(String(schedule.graceMinutes)); const [startsOn, setStartsOn] = useState(schedule.startsOn || ''); const [endsOn, setEndsOn] = useState(schedule.endsOn || ''); const [active, setActive] = useState(schedule.isActive);
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button type="button" variant="ghost" size="sm">Edit</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Edit schedule</DialogTitle><DialogDescription>Changes affect future scans. Existing daily records retain their saved values.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSave({ scope: schedule.scope, subjectId: schedule.subjectId, kind: schedule.kind, workDate: schedule.workDate, weekdays: schedule.weekdays, startsOn: startsOn || undefined, endsOn: endsOn || undefined, clockInBy, clockOutBy: clockOutBy || undefined, graceMinutes: Number(graceMinutes), priority: schedule.priority, isActive: active }); setOpen(false); }}><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor={`edit-time-${schedule.id}`}>Expected arrival</Label><Input id={`edit-time-${schedule.id}`} type="time" value={clockInBy} onChange={(event) => setClockInBy(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor={`edit-out-${schedule.id}`}>Expected departure</Label><Input id={`edit-out-${schedule.id}`} type="time" value={clockOutBy} onChange={(event) => setClockOutBy(event.target.value)} /></div><div className="space-y-2"><Label htmlFor={`edit-grace-${schedule.id}`}>Grace minutes</Label><Input id={`edit-grace-${schedule.id}`} type="number" min="0" max="180" value={graceMinutes} onChange={(event) => setGraceMinutes(event.target.value)} required /></div></div>{schedule.kind === 'recurring' && <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor={`edit-start-${schedule.id}`}>Effective from</Label><Input id={`edit-start-${schedule.id}`} type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} /></div><div className="space-y-2"><Label htmlFor={`edit-end-${schedule.id}`}>Effective until</Label><Input id={`edit-end-${schedule.id}`} type="date" min={startsOn || undefined} value={endsOn} onChange={(event) => setEndsOn(event.target.value)} /></div></div>}<label className="flex items-center gap-2 text-sm"><Checkbox checked={active} onCheckedChange={(checked) => setActive(checked === true)} />Active schedule</label><DialogFooter><Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Save changes</Button></DialogFooter></form></DialogContent></Dialog>;
}

function SpecialScheduleDialog({ staff, disabled, error, onCreate }: { staff: import('@/lib/staff-clocking/contracts').StaffClockingStaffCandidate[]; disabled: boolean; error?: string; onCreate: (schedule: EditableSchedule) => void }) {
  const [open, setOpen] = useState(false); const [workDate, setWorkDate] = useState(''); const [clockInBy, setClockInBy] = useState('08:00'); const [clockOutBy, setClockOutBy] = useState('17:00'); const [graceMinutes, setGraceMinutes] = useState('10'); const [scope, setScope] = useState<'school' | 'group' | 'staff'>('school'); const [subjectId, setSubjectId] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!workDate || (scope !== 'school' && !subjectId)) return; onCreate({ scope, subjectId: scope === 'school' ? undefined : subjectId, kind: 'date_override', workDate, clockInBy, clockOutBy: clockOutBy || undefined, graceMinutes: Number(graceMinutes), priority: scope === 'staff' ? 20 : scope === 'group' ? 10 : 0, isActive: true }); setOpen(false); };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button type="button" className="min-h-11" disabled={disabled}><CalendarClock className="h-4 w-4" />Add special day</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Add special day</DialogTitle><DialogDescription>Create a one-date schedule that takes priority over ordinary weekly rules for the selected staff scope.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={submit}><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="special-work-date">Date</Label><Input id="special-work-date" type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="special-scope">Applies to</Label><select id="special-scope" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={scope} onChange={(event) => { setScope(event.target.value as typeof scope); setSubjectId(''); }}><option value="school">All scheduled staff</option><option value="group">Department or role label</option><option value="staff">One staff member</option></select></div></div>{scope !== 'school' && <div className="space-y-2"><Label htmlFor="special-subject">{scope === 'staff' ? 'Staff member' : 'Department or role label'}</Label>{scope === 'staff' ? <select id="special-subject" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={subjectId} onChange={(event) => setSubjectId(event.target.value)} required><option value="">Choose staff</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select> : <Input id="special-subject" value={subjectId} onChange={(event) => setSubjectId(event.target.value)} placeholder="e.g. Teaching" required />}</div>}<div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label htmlFor="special-clock-in">Special ETA</Label><Input id="special-clock-in" type="time" value={clockInBy} onChange={(event) => setClockInBy(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="special-clock-out">Special ETD</Label><Input id="special-clock-out" type="time" value={clockOutBy} onChange={(event) => setClockOutBy(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="special-grace">Grace minutes</Label><Input id="special-grace" type="number" min="0" max="180" value={graceMinutes} onChange={(event) => setGraceMinutes(event.target.value)} required /></div></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><Button type="submit" disabled={disabled || !workDate || (scope !== 'school' && !subjectId)}>{disabled && <Loader2 className="h-4 w-4 animate-spin" />}Save special day</Button></DialogFooter></form></DialogContent></Dialog>;
}

function SchoolScheduleDialog({ staff, disabled, error, onCreate }: {
  staff: import('@/lib/staff-clocking/contracts').StaffClockingStaffCandidate[];
  disabled: boolean;
  error?: string;
  onCreate: (schedule: Omit<import('@/lib/staff-clocking/contracts').StaffClockingSchedule, 'id'>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [clockInBy, setClockInBy] = useState('08:00');
  const [clockOutBy, setClockOutBy] = useState('17:00');
  const [graceMinutes, setGraceMinutes] = useState('10');
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [scope, setScope] = useState<'school' | 'group' | 'staff'>('school');
  const [subjectId, setSubjectId] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const days = [
    { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' }, { value: 0, label: 'Sun' },
  ];

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!weekdays.length) return;
    if (scope !== 'school' && !subjectId) return;
    onCreate({ scope, subjectId: scope === 'school' ? undefined : subjectId, kind: 'recurring', weekdays, startsOn: startsOn || undefined, endsOn: endsOn || undefined, clockInBy, clockOutBy: clockOutBy || undefined, graceMinutes: Number(graceMinutes), priority: 0, isActive: true });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button type="button" variant="outline" className="mt-4 min-h-11" disabled={disabled}>Add school schedule</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add school schedule</DialogTitle>
          <DialogDescription>Set an effective weekday rule for the whole school, a department/role label, or one staff member.</DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="schedule-scope">Applies to</Label><select id="schedule-scope" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={scope} onChange={(event) => { setScope(event.target.value as typeof scope); setSubjectId(''); }}><option value="school">Whole school</option><option value="group">Department or role label</option><option value="staff">One staff member</option></select></div>{scope !== 'school' && <div className="space-y-2"><Label htmlFor="schedule-subject">{scope === 'staff' ? 'Staff member' : 'Department or role label'}</Label>{scope === 'staff' ? <select id="schedule-subject" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={subjectId} onChange={(event) => setSubjectId(event.target.value)} required><option value="">Choose staff</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select> : <Input id="schedule-subject" value={subjectId} onChange={(event) => setSubjectId(event.target.value)} placeholder="e.g. Teaching" required />}</div>}</div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2"><Label htmlFor="clock-in-by">Clock in by</Label><Input id="clock-in-by" type="time" value={clockInBy} onChange={(event) => setClockInBy(event.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="clock-out-by">Expected departure</Label><Input id="clock-out-by" type="time" value={clockOutBy} onChange={(event) => setClockOutBy(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="grace-minutes">Grace minutes</Label><Input id="grace-minutes" type="number" min="0" max="180" value={graceMinutes} onChange={(event) => setGraceMinutes(event.target.value)} required /></div>
          </div>
          <fieldset className="space-y-2"><legend className="text-sm font-medium">Working days</legend><div className="flex flex-wrap gap-3">
            {days.map((day) => <label key={day.value} className="flex min-h-11 items-center gap-2 text-sm"><Checkbox checked={weekdays.includes(day.value)} onCheckedChange={(checked) => setWeekdays(current => checked ? [...new Set([...current, day.value])].sort() : current.filter(value => value !== day.value))} />{day.label}</label>)}
          </div>{weekdays.length === 0 && <p role="alert" className="text-sm text-destructive">Choose at least one working day.</p>}</fieldset>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="schedule-start">Effective from</Label><Input id="schedule-start" type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="schedule-end">Effective until</Label><Input id="schedule-end" type="date" min={startsOn || undefined} value={endsOn} onChange={(event) => setEndsOn(event.target.value)} /></div></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter><Button type="submit" disabled={disabled || weekdays.length === 0 || (scope !== 'school' && !subjectId)}>{disabled && <Loader2 className="h-4 w-4 animate-spin" />}Save schedule</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecordsPanel({ canReviewRecords, canReviewExemptions, canReviewCorrections, canFinalize }: { canReviewRecords: boolean; canReviewExemptions: boolean; canReviewCorrections: boolean; canFinalize: boolean }) {
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [query, setQuery] = useState('');
  const filters = { from, to, query };
  const records = useStaffClockingDailyRecords(filters, canReviewRecords);
  const exporter = useExportStaffClockingRecords();
  const finalize = useFinalizeStaffClockingDate();
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl"><FileClock className="h-5 w-5 text-primary" /> Clock records</CardTitle>
          <CardDescription>Daily records come from the server-maintained attendance projection. Use a date range to review or export a period.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canReviewRecords && <div className="grid gap-2 sm:grid-cols-4"><Input type="date" aria-label="From date" value={from} onChange={(event) => setFrom(event.target.value)} /><Input type="date" aria-label="To date" value={to} onChange={(event) => setTo(event.target.value)} /><Input aria-label="Search staff records" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search staff" /><Button type="button" variant="outline" disabled={exporter.isPending} onClick={() => exporter.mutate(filters)}>Export CSV</Button></div>}
          {canReviewRecords && records.data?.summary && <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3"><div className="rounded-lg bg-muted p-3"><span className="block text-xs text-muted-foreground">Records</span>{records.data.summary.total}</div><div className="rounded-lg bg-muted p-3"><span className="block text-xs text-muted-foreground">Late</span>{records.data.summary.late}</div><div className="rounded-lg bg-muted p-3"><span className="block text-xs text-muted-foreground">Exempted</span>{records.data.summary.exempted}</div></div>}
          {!canReviewRecords ? <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6"><p className="font-semibold">Clock-record access is required</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Ask an administrator to grant Staff Clock Records access.</p></div>
            : records.isPending ? <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading clock records…</div>
              : records.isError ? <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{records.error.message}</div>
                : records.data?.records.length ? <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[42rem] text-left text-sm"><thead className="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Staff</th><th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Clock in</th><th className="px-4 py-3 font-medium">Clock out</th><th className="px-4 py-3 font-medium">Status</th></tr></thead><tbody>{records.data.records.map((record) => <tr key={record.id} className="border-b last:border-0"><td className="px-4 py-3 font-medium">{record.staffName || record.staffId}</td><td className="px-4 py-3">{record.localDate}</td><td className="px-4 py-3">{record.effectiveClockInTime || record.clockInTime || '—'}{record.reviewStatus === 'corrected' && <span className="ml-2 text-xs text-emerald-700 dark:text-emerald-400">corrected</span>}{record.arrivalStatus && <span className="ml-2 text-xs text-muted-foreground">{record.arrivalStatus.replace('_', ' ')}</span>}</td><td className="px-4 py-3">{record.effectiveClockOutTime || record.clockOutTime || '—'}</td><td className="px-4 py-3">{record.reviewStatus === 'exempted' ? <Badge variant="secondary">Exempted</Badge> : <Badge variant={record.status === 'complete' ? 'secondary' : 'outline'}>{record.status === 'complete' ? 'Complete' : record.status === 'missing_clock_out' ? 'Missing out' : 'Open'}</Badge>}</td></tr>)}</tbody></table></div>
                  : <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6"><p className="font-semibold">No verified clock events yet</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Records will appear after a staff member scans a valid school QR.</p></div>}
        </CardContent>
      </Card>
      <div className="space-y-4">{canFinalize && <Card><CardHeader className="pb-3"><CardTitle className="text-base">Finalize a work day</CardTitle><CardDescription>Open records become “missing out”. This does not create absences for staff who never scanned.</CardDescription></CardHeader><CardContent><Button type="button" variant="outline" disabled={finalize.isPending || !to} onClick={() => finalize.mutate(to)}>{finalize.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Finalize selected end date</Button>{finalize.error && <p className="mt-2 text-sm text-destructive">{finalize.error.message}</p>}</CardContent></Card>}<ReviewQueue kind="exemption" enabled={canReviewExemptions} /><ReviewQueue kind="correction" enabled={canReviewCorrections} /><StatusCard icon={BookOpenCheck} title="Review boundary" description="Managers can review authorised staff records. A reviewer will never approve their own exception or correction." /></div>
    </div>
  );
}

function ReviewQueue({ kind, enabled }: { kind: 'exemption' | 'correction'; enabled: boolean }) {
  const requests = useStaffClockingReviewRequests(kind, enabled);
  const review = useReviewStaffClockingRequest(kind);
  const title = kind === 'exemption' ? 'Exemption requests' : 'Correction requests';
  if (!enabled) return null;
  return <Card><CardHeader className="pb-3"><CardTitle className="text-base">{title}</CardTitle><CardDescription>Pending requests only. Each decision is written to the audit log.</CardDescription></CardHeader><CardContent>{requests.isPending ? <p className="text-sm text-muted-foreground">Loading requests…</p> : requests.isError ? <p role="alert" className="text-sm text-destructive">{requests.error.message}</p> : requests.data?.length ? <ul className="space-y-3">{requests.data.map((request) => <li key={request.id} className="rounded-lg border border-border p-3"><p className="text-sm font-semibold">{request.localDate} · {request.createdBy?.name || request.staffId}</p><p className="mt-1 text-sm text-muted-foreground">{request.reason}</p>{request.proposedClockInTime && <p className="mt-1 text-xs text-muted-foreground">Proposed clock-in: {request.proposedClockInTime}</p>}<div className="mt-3 flex gap-2"><Button type="button" size="sm" onClick={() => review.mutate({ id: request.id, approved: true })} disabled={review.isPending}>Approve</Button><Button type="button" size="sm" variant="outline" onClick={() => review.mutate({ id: request.id, approved: false })} disabled={review.isPending}>Reject</Button></div></li>)}</ul> : <p className="text-sm text-muted-foreground">No pending requests.</p>}{review.error && <p role="alert" className="mt-3 text-sm text-destructive">{review.error.message}</p>}</CardContent></Card>;
}

function StatusCard({ icon: Icon, title, description }: { icon: typeof CalendarClock; title: string; description: string }) {
  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent><p className="text-sm leading-6 text-muted-foreground">{description}</p></CardContent>
    </Card>
  );
}
