'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AlarmClock, ArrowLeft, BookOpenCheck, CalendarClock, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Coins, Download, Loader2, QrCode, ScanLine, ShieldCheck, ShieldEllipsis, Trash2, Users, UsersRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GlassActionButton, GlassActionDock, GlassPageTopBar } from '@/components/common/glass-page-top-bar';
import { GlassSummaryBar } from '@/components/common/glass-summary-bar';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { useCreateManagedStaffClockingExemption, useCreateStaffClockingClosure, useCreateStaffClockingRequest, useCreateStaffClockingSchedule, useDeleteStaffClockingSchedule, useExportStaffClockingRecords, useFinalizeStaffClockingDate, useOwnStaffClockingDashboard, useOwnStaffClockingNotifications, useReviewStaffClockingRequest, useStaffClockingBootstrap, useStaffClockingClosures, useStaffClockingDailyRecords, useStaffClockingReviewRequests, useStaffClockingSchedules, useStaffClockingStaffCandidates, useUpdateStaffClockingSchedule, useUpdateStaffClockingSettings } from '@/lib/hooks/use-staff-clocking';
import type { StaffClockingBootstrap, StaffClockingDailyRecord, StaffClockingFeatureSettings } from '@/lib/staff-clocking/contracts';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { StaffClockingQrDisplay } from '@/components/staff-clocking/staff-clocking-qr-display';
import { StaffClockingQrScanner } from '@/components/staff-clocking/staff-clocking-qr-scanner';

type StaffClockingSection = 'record' | 'manage' | 'clock' | 'records';

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
  const { canPerformAction } = usePermissions();
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
  const dateLabel = useMemo(todayInSchoolTime, []);
  const pageHeader = section === 'record'
    ? { title: 'Record', details: 'Staff clocking management' }
    : section === 'manage'
      ? { title: 'Manage Clocking', details: 'Schedules, staff and clocking rules' }
      : section === 'clock'
        ? { title: 'My Clock', details: 'Staff attendance and time tracking' }
        : { title: 'Clock Records', details: 'Authorised attendance review and corrections' };
  const recordActions = (
    <GlassActionDock>
      {canManage && <GlassActionButton label="Manage" href="/staff-clocking/manage" tone="blue" icon={<CalendarClock className="h-4 w-4" />} />}
      {canManageCalendar && <ManagerExemptionDialog presentation="action" />}
    </GlassActionDock>
  );

  return (
    <div className="min-h-full">
      <GlassPageTopBar
        eyebrow="Staff Clocking"
        title={pageHeader.title}
        recordDetails={pageHeader.details}
        badges={
          <Badge variant="outline" className={cn(
            'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300',
            bootstrap.data?.feature.enabled && 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
          )}>
            {bootstrap.isPending ? 'Checking setup' : bootstrap.data?.feature.enabled ? 'Enabled' : 'Not enabled'}
          </Badge>
        }
        actions={section === 'record' ? recordActions : undefined}
      />

      <main className="mx-auto max-w-7xl space-y-4 px-4 pb-28 sm:px-6 sm:pb-8 lg:px-8">
        {section !== 'record' && <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card/80 px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-semibold text-foreground">{dateLabel}</p><p className="text-xs text-muted-foreground">All official times use the school&apos;s East Africa time.</p></div><div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200"><ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Server validation will confirm each clock event.</div>
        </div>}

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
  return <section className="space-y-4" aria-label="My Clock">{data?.staff && <div className="flex justify-end"><div className="flex items-center gap-3 rounded-xl border border-border/80 bg-card/80 px-3 py-2"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{data.staff.name.split(' ').map(part => part[0]).join('').slice(0, 2)}</div><div><p className="text-sm font-semibold">{data.staff.name}</p><p className="text-xs text-muted-foreground">{data.staff.group || 'Assigned staff schedule'}</p></div></div></div>}
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
  const summary = records.data?.summary;

  return (
    <section className="space-y-4" aria-label="Staff clocking record dashboard">
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

      <GlassSummaryBar
        left={<div className="flex items-center gap-2"><Users className="h-4 w-4 text-brand-alt-ink-500 dark:text-brand-alt-ink-400" /><span className="text-xs font-black uppercase tracking-wider text-brand-alt-ink-900 sm:text-sm dark:text-brand-alt-ink-200">Today&apos;s Clocking</span>{canReviewRecords && <Link href={`/staff-clocking/records?from=${today}&to=${today}`} className="text-xs font-semibold text-primary hover:underline sm:text-sm">View report</Link>}</div>}
        right={!canReviewRecords ? <span className="text-xs text-muted-foreground">Totals are visible to authorised record reviewers.</span> : records.isPending ? <span className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Updating totals…</span> : records.isError ? <span role="alert" className="text-xs text-destructive">{records.error.message}</span> : <><ClockingSummaryStat label="Clocked" value={summary?.total || 0} tone="blue" /><ClockingSummaryStat label="Complete" value={summary?.complete || 0} tone="green" /><ClockingSummaryStat label="Open" value={summary?.open || 0} tone="amber" /><ClockingSummaryStat label="Late" value={summary?.late || 0} tone="red" /><ClockingSummaryStat label="Exempt" value={summary?.exempted || 0} tone="violet" /></>}
      />
    </section>
  );
}

function ScheduleRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div>; }

function ClockingSummaryStat({ label, value, tone }: { label: string; value: number; tone: 'blue' | 'green' | 'amber' | 'red' | 'violet' }) {
  const styles = { blue: 'border-blue-100 bg-blue-50/80 text-blue-700 dark:border-blue-900/30 dark:bg-blue-950/20 dark:text-blue-300', green: 'border-emerald-100 bg-emerald-50/80 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300', amber: 'border-amber-100 bg-amber-50/80 text-amber-700 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300', red: 'border-rose-100 bg-rose-50/80 text-rose-700 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300', violet: 'border-violet-100 bg-violet-50/80 text-violet-700 dark:border-violet-900/30 dark:bg-violet-950/20 dark:text-violet-300' };
  return <div className={cn('flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] sm:text-xs', styles[tone])}><span className="font-bold">{value}</span><span className="font-medium">{label}</span></div>;
}

function ManagerExemptionDialog({ presentation = 'card' }: { presentation?: 'card' | 'action' }) {
  const [open, setOpen] = useState(false); const [staffId, setStaffId] = useState(''); const [localDate, setLocalDate] = useState(() => schoolDateKey()); const [reason, setReason] = useState('');
  const staff = useStaffClockingStaffCandidates(true); const createExemption = useCreateManagedStaffClockingExemption();
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); createExemption.mutate({ staffId, localDate, reason }, { onSuccess: () => { setReason(''); setOpen(false); } }); };
  const trigger = presentation === 'action'
    ? <GlassActionButton label="Exempt" tone="violet" icon={<BookOpenCheck className="h-4 w-4" />} />
    : <button type="button" className="group w-full rounded-2xl border border-violet-200/80 bg-gradient-to-r from-violet-50 to-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-violet-900/70 dark:from-violet-950/25"><span className="flex items-center gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm"><BookOpenCheck className="h-6 w-6" /></span><span className="min-w-0 flex-1"><span className="block font-semibold">Exempt</span><span className="block text-sm text-muted-foreground">Leave &amp; absence</span></span><ChevronRight className="h-5 w-5 text-violet-600 transition-transform group-hover:translate-x-1" /></span></button>;
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild>{trigger}</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Record exemption</DialogTitle><DialogDescription>Apply an authorised full-day exemption. Existing clock events remain untouched and the action is written to the audit history.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={submit}><div className="space-y-2"><Label htmlFor="manager-exemption-staff">Staff member</Label><select id="manager-exemption-staff" value={staffId} onChange={(event) => setStaffId(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" required><option value="">Choose staff</option>{staff.data?.map(member => <option value={member.id} key={member.id}>{member.name}</option>)}</select></div><div className="space-y-2"><Label htmlFor="manager-exemption-date">Work date</Label><Input id="manager-exemption-date" type="date" value={localDate} onChange={(event) => setLocalDate(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="manager-exemption-reason">Reason</Label><Input id="manager-exemption-reason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={8} placeholder="e.g. Approved medical leave" required /></div>{createExemption.error && <p role="alert" className="text-sm text-destructive">{createExemption.error.message}</p>}<DialogFooter><Button type="submit" disabled={createExemption.isPending || staff.isPending}>{createExemption.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Record exemption</Button></DialogFooter></form></DialogContent></Dialog>;
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
  const activePanelRef = useRef<HTMLDivElement>(null);
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
  useEffect(() => { if (activePanel) activePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [activePanel]);
  return (
    <section className="space-y-5" aria-label="Manage staff clocking">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ManageDashboardCard icon={CalendarDays} tone="blue" title="School Days" description="Regular working days and expected arrival times." onClick={() => setActivePanel('school-days')} />
        <ManageDashboardCard icon={CalendarClock} tone="violet" title="Special Days" description="Date-specific working arrangements." onClick={() => setActivePanel('special-days')} />
        <ManageDashboardCard icon={BookOpenCheck} tone="rose" title="Public Holidays" description="Calendar decisions and school closures." onClick={() => setActivePanel('holidays')} />
        <ManageDashboardCard icon={AlarmClock} tone="amber" title="Grace Period" description="Allowed minutes before an arrival is late." onClick={() => setActivePanel('grace')} />
        <ManageDashboardCard icon={Coins} tone="amber" title="Penalty Rules" description="Review-only proposed lateness policy." onClick={() => setActivePanel('penalties')} />
        <ManageDashboardCard icon={UsersRound} tone="violet" title="Staff Groups & Assignments" description="Department, role and individual schedules." onClick={() => setActivePanel('staff-groups')} />
        <ManageDashboardCard icon={ShieldEllipsis} tone="blue" title="Advanced Settings" description="QR security, staff access and configuration revision." className="md:col-span-2 xl:col-span-3" onClick={() => setActivePanel('advanced')} />
      </div>

      {activePanel && <div ref={activePanelRef} tabIndex={-1} className="scroll-mt-4 focus:outline-none"><Card className="border-primary/20 shadow-md"><CardHeader className="border-b border-border/70 bg-muted/20"><div className="flex flex-wrap items-start justify-between gap-3"><div><Button type="button" variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => setActivePanel(null)}><ArrowLeft className="h-4 w-4" />Manage Clocking</Button><CardTitle className="text-xl">{panelTitle[activePanel]}</CardTitle><CardDescription className="mt-1">{panelDescription[activePanel]}</CardDescription></div><Badge variant="secondary">Changes affect future scans only</Badge></div></CardHeader><CardContent className="space-y-4 p-4 sm:p-6">
        {!canManage && activePanel !== 'holidays' ? <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-sm"><p className="font-semibold">Schedule-management permission is required</p><p className="mt-1 text-muted-foreground">Ask an administrator to grant Manage schedules before changing clocking rules.</p></div> : <>
          {activePanel === 'school-days' && <ScheduleManager schedules={normalSchedules} isLoading={schedules.isPending} staff={staff.data || []} createPending={createSchedule.isPending} updatePending={updateSchedule.isPending} deletePending={deleteSchedule.isPending} createError={createSchedule.error?.message} onCreate={(schedule) => createSchedule.mutate(schedule)} onUpdate={(id, schedule) => updateSchedule.mutate({ id, schedule })} onDelete={(id) => deleteSchedule.mutate(id)} />}
          {activePanel === 'special-days' && <SpecialDaysPanel schedules={specialSchedules} isLoading={schedules.isPending} staff={staff.data || []} createPending={createSchedule.isPending} updatePending={updateSchedule.isPending} deletePending={deleteSchedule.isPending} createError={createSchedule.error?.message} onCreate={(schedule) => createSchedule.mutate(schedule)} onUpdate={(id, schedule) => updateSchedule.mutate({ id, schedule })} onDelete={(id) => deleteSchedule.mutate(id)} />}
          {activePanel === 'holidays' && (canManageCalendar ? <ClosurePanel closures={closures.data || []} isLoading={closures.isPending} error={closures.error?.message} creating={createClosure.isPending} onCreate={(closure) => createClosure.mutate(closure)} /> : <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-sm"><p className="font-semibold">Calendar-management permission is required</p><p className="mt-1 text-muted-foreground">Holiday data stays in the existing Events &amp; Calendar module. Grant calendar permission to make an attendance decision.</p></div>)}
          {activePanel === 'grace' && <GracePanel schedules={normalSchedules} updatePending={updateSchedule.isPending} onUpdate={(id, schedule) => updateSchedule.mutate({ id, schedule })} />}
          {activePanel === 'penalties' && <PenaltyBoundary />}
          {activePanel === 'staff-groups' && <div className="space-y-4">{feature && <EnrollmentPanel feature={feature} staff={staff.data || []} saving={isSaving} onSave={(accessMode, enrolledStaffIds) => onSettingsChange({ enabled: feature.enabled, accessMode, enrolledStaffIds })} />}<ScheduleManager schedules={normalSchedules.filter((schedule) => schedule.scope !== 'school')} isLoading={schedules.isPending} staff={staff.data || []} createPending={createSchedule.isPending} updatePending={updateSchedule.isPending} deletePending={deleteSchedule.isPending} createError={createSchedule.error?.message} onCreate={(schedule) => createSchedule.mutate(schedule)} onUpdate={(id, schedule) => updateSchedule.mutate({ id, schedule })} onDelete={(id) => deleteSchedule.mutate(id)} groupOnly /></div>}
          {activePanel === 'advanced' && <div className="space-y-4">{!canDisplayQr && <div className="rounded-xl border border-dashed border-border bg-muted/35 p-5 text-sm"><p className="font-semibold">QR display permission is not assigned</p><p className="mt-1 text-muted-foreground">An authorised timekeeper can display the secure school QR from Record.</p></div>}{feature && <div className="rounded-xl border border-border/80 bg-background/70 p-4"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold">Enable Staff Clocking</p><p className="mt-1 text-sm text-muted-foreground">Publishing is revision-controlled. Scanning remains unavailable until an active schedule exists.</p></div><Switch checked={feature.enabled} onCheckedChange={(enabled) => onSettingsChange({ enabled, accessMode: feature.accessMode, enrolledStaffIds: feature.enrolledStaffIds })} disabled={isSaving} aria-label="Enable Staff Clocking" /></div>{isSaving && <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving feature setting…</p>}</div>}<StatusCard icon={ShieldEllipsis} title="Security and audit boundary" description="QR signing keys and token validation remain server-controlled. Every schedule, closure, exemption and review action is recorded in the audit history." /></div>}
        </>}
      </CardContent></Card></div>}

      <ManageOverview defaultSchedule={defaultSchedule} specialSchedules={specialSchedules} closures={closures.data || []} />
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

function RecordsPanel({ canReviewRecords, canReviewExemptions, canReviewCorrections, canFinalize: canFinalizePermission }: { canReviewRecords: boolean; canReviewExemptions: boolean; canReviewCorrections: boolean; canFinalize: boolean }) {
  const [view, setView] = useState<RecordsView>('daily');
  const [anchorDate, setAnchorDate] = useState(() => schoolDateKey());
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [selectedTermKey, setSelectedTermKey] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<StaffClockingDailyRecord | null>(null);
  const academicYears = useAcademicYears();
  const termOptions = useMemo(() => (academicYears.data || [])
    .flatMap((year) => year.terms.map((term) => ({ key: `${year.id}:${term.id}`, label: `${year.name} · ${term.name}`, from: term.startDate.slice(0, 10), to: term.endDate.slice(0, 10), isCurrent: term.isCurrent })))
    .sort((first, second) => second.from.localeCompare(first.from)), [academicYears.data]);
  const selectedTerm = termOptions.find((term) => term.key === selectedTermKey) || termOptions.find((term) => term.from <= anchorDate && term.to >= anchorDate) || termOptions.find((term) => term.isCurrent) || termOptions[0];
  useEffect(() => { if (view === 'termly' && selectedTerm && selectedTerm.key !== selectedTermKey) setSelectedTermKey(selectedTerm.key); }, [selectedTerm, selectedTermKey, view]);
  const nonTermView = view === 'termly' ? 'monthly' : view;
  const range = useMemo(() => view === 'termly' && selectedTerm ? { from: selectedTerm.from, to: selectedTerm.to } : reportRange(nonTermView, anchorDate), [anchorDate, nonTermView, selectedTerm, view]);
  const filters = { from: range.from, to: range.to, query };
  const records = useStaffClockingDailyRecords(filters, canReviewRecords);
  const exporter = useExportStaffClockingRecords();
  const finalize = useFinalizeStaffClockingDate();
  const visible = (records.data?.records || []).filter((record) => matchesRecordStatus(record, status as RecordStatusFilter));
  const summary = records.data?.summary;
  const canFinalize = canFinalizePermission && view === 'daily';
  const periodLabel = view === 'termly' && selectedTerm ? selectedTerm.label : reportLabel(nonTermView, range);
  return <section className="space-y-4" aria-label="Clock records"><div className="flex flex-wrap items-center justify-between gap-3"><div className="inline-flex rounded-xl border border-border bg-card/80 p-1"><RecordsViewButton active={view === 'daily'} onClick={() => setView('daily')}>Day</RecordsViewButton><RecordsViewButton active={view === 'weekly'} onClick={() => setView('weekly')}>Week</RecordsViewButton><RecordsViewButton active={view === 'monthly'} onClick={() => setView('monthly')}>Month</RecordsViewButton><RecordsViewButton active={view === 'termly'} onClick={() => setView('termly')}>Term</RecordsViewButton></div><Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"><span className="mr-2 h-2 w-2 rounded-full bg-emerald-500" />Records synced</Badge></div><ClockRecordDetailsDialog record={selectedRecord} onOpenChange={(open) => { if (!open) setSelectedRecord(null); }} />
    {view === 'termly' && <Card><CardContent className="grid gap-3 p-4 sm:grid-cols-[minmax(16rem,1fr)_auto]"><div><Label htmlFor="clock-records-term">Academic term</Label><select id="clock-records-term" className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={selectedTermKey} onChange={(event) => setSelectedTermKey(event.target.value)} disabled={!termOptions.length}><option value="">{termOptions.length ? 'Choose a term' : 'No cached academic terms available'}</option>{termOptions.map((term) => <option key={term.key} value={term.key}>{term.label}</option>)}</select></div><p className="self-end text-sm text-muted-foreground">{selectedTerm ? `${selectedTerm.from} to ${selectedTerm.to}` : 'Term reporting uses the school calendar that is already cached for this account.'}</p></CardContent></Card>}
    {!canReviewRecords ? <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6"><p className="font-semibold">Clock-record access is required</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Ask an administrator to grant Staff Clock Records access.</p></div> : <><div className="grid grid-cols-2 gap-3 md:grid-cols-5"><RecordsMetric label="Clocked records" value={summary?.total || 0} tone="blue" /><RecordsMetric label="Complete" value={summary?.complete || 0} tone="green" /><RecordsMetric label="Open shifts" value={summary?.open || 0} tone="blue" /><RecordsMetric label="Late" value={summary?.late || 0} tone="red" /><RecordsMetric label="Exempt" value={summary?.exempted || 0} tone="violet" /></div><Card><CardContent className="grid gap-3 p-4 lg:grid-cols-[auto_minmax(14rem,1fr)_auto_auto]"><div className="flex items-center gap-1"><Button type="button" variant="outline" size="icon" aria-label="Previous reporting period" onClick={() => setAnchorDate(moveReportDate(view, anchorDate, -1))}><ChevronLeft className="h-4 w-4" /></Button><Input type="date" aria-label="Reporting period" value={anchorDate} onChange={(event) => setAnchorDate(event.target.value)} className="w-[10.5rem]" /><Button type="button" variant="outline" size="icon" aria-label="Next reporting period" onClick={() => setAnchorDate(moveReportDate(view, anchorDate, 1))}><ChevronRight className="h-4 w-4" /></Button><Button type="button" variant="outline" onClick={() => setAnchorDate(schoolDateKey())}>Today</Button></div><Input aria-label="Search staff records" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search staff by name or ID" /><select aria-label="Attendance status" className="flex h-10 rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="on_time">On time</option><option value="grace">Grace</option><option value="late">Late</option><option value="exempt">Exempt</option><option value="complete">Complete</option><option value="open">Still working</option></select><Button type="button" variant="outline" disabled={exporter.isPending} onClick={() => exporter.mutate(filters)}>{exporter.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Export</Button></CardContent></Card>
      <Card><CardHeader className="pb-3"><CardTitle className="text-base">{view === 'daily' ? 'Daily Attendance Records' : view === 'weekly' ? 'Weekly Attendance Register' : view === 'monthly' ? 'Monthly Punctuality Summary' : 'Term Attendance Summary'}</CardTitle><CardDescription>{periodLabel} · Verified server-maintained attendance projection.</CardDescription></CardHeader><CardContent>{records.isPending ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading clock records…</p> : records.isError ? <p role="alert" className="text-sm text-destructive">{records.error.message}</p> : view === 'termly' && !selectedTerm ? <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6"><p className="font-semibold">Choose an academic term</p><p className="mt-1 text-sm text-muted-foreground">Term reporting becomes available after the school calendar is cached for this account.</p></div> : !visible.length ? <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6"><p className="font-semibold">No matching clocking records</p><p className="mt-1 text-sm text-muted-foreground">Try another reporting period or adjust the filters.</p></div> : view === 'daily' ? <DailyRecordsTable records={visible} onSelect={setSelectedRecord} /> : view === 'weekly' ? <WeeklyAttendanceMatrix records={visible} from={range.from} onSelect={setSelectedRecord} /> : <PunctualitySummary records={visible} />}</CardContent></Card>
      <div className="grid gap-4 xl:grid-cols-2">{canFinalize && <Card><CardHeader className="pb-3"><CardTitle className="text-base">Finalize a work day</CardTitle><CardDescription>Open records become “missing out”. This does not create absences for staff who never scanned.</CardDescription></CardHeader><CardContent><Button type="button" variant="outline" disabled={finalize.isPending} onClick={() => finalize.mutate(anchorDate)}>{finalize.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Finalize selected date</Button>{finalize.error && <p className="mt-2 text-sm text-destructive">{finalize.error.message}</p>}</CardContent></Card>}<div className="space-y-4"><ReviewQueue kind="exemption" enabled={canReviewExemptions} /><ReviewQueue kind="correction" enabled={canReviewCorrections} /></div></div></>}</section>;
}

function RecordsViewButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) { return <Button type="button" size="sm" variant={active ? 'default' : 'ghost'} onClick={onClick}>{children}</Button>; }
function RecordsMetric({ label, value, tone }: { label: string; value: number; tone: 'blue' | 'green' | 'red' | 'violet' }) { const styles = { blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300', green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300', red: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300', violet: 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300' }; return <div className={cn('rounded-xl p-4', styles[tone])}><p className="text-xs font-medium opacity-80">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>; }
function DailyRecordsTable({ records, onSelect }: { records: StaffClockingDailyRecord[]; onSelect: (record: StaffClockingDailyRecord) => void }) {
  return <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[46rem] text-left text-sm"><thead className="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th className="px-4 py-3">Staff</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Clock in</th><th className="px-4 py-3">Clock out</th><th className="px-4 py-3">Status / reason</th><th className="px-4 py-3"><span className="sr-only">Details</span></th></tr></thead><tbody>{records.map((record) => <tr key={record.id} className="border-b last:border-0"><td className="px-4 py-3 font-medium">{record.staffName || record.staffId}</td><td className="px-4 py-3">{record.localDate}</td><td className="px-4 py-3">{formatScheduleTime(record.effectiveClockInTime || record.clockInTime)}</td><td className="px-4 py-3">{formatScheduleTime(record.effectiveClockOutTime || record.clockOutTime)}</td><td className="px-4 py-3"><RecordStatusBadge record={record} /></td><td className="px-4 py-3"><Button type="button" variant="ghost" size="sm" onClick={() => onSelect(record)}>Details</Button></td></tr>)}</tbody></table></div>;
}

function PunctualitySummary({ records }: { records: StaffClockingDailyRecord[] }) {
  const rows = buildPunctualityRows(records);
  return <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[42rem] text-left text-sm"><thead className="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th className="px-4 py-3">Staff name</th><th className="px-4 py-3">On time</th><th className="px-4 py-3">Grace</th><th className="px-4 py-3">Late</th><th className="px-4 py-3">Exempt</th><th className="px-4 py-3">Complete shifts</th></tr></thead><tbody>{rows.map((row) => <tr key={row.staffId} className="border-b last:border-0"><td className="px-4 py-3 font-medium">{row.name}</td><td className="px-4 py-3"><Badge variant="secondary">{row.onTime}</Badge></td><td className="px-4 py-3"><Badge variant="outline">{row.grace}</Badge></td><td className="px-4 py-3"><Badge variant={row.late ? 'destructive' : 'outline'}>{row.late}</Badge></td><td className="px-4 py-3">{row.exempt}</td><td className="px-4 py-3">{row.complete}</td></tr>)}</tbody></table></div>;
}

type RecordsView = 'daily' | 'weekly' | 'monthly' | 'termly';
type RecordStatusFilter = 'all' | 'on_time' | 'grace' | 'late' | 'exempt' | 'complete' | 'open';
type PunctualityRow = { staffId: string; name: string; onTime: number; grace: number; late: number; exempt: number; complete: number };

function matchesRecordStatus(record: StaffClockingDailyRecord, status: RecordStatusFilter) {
  if (status === 'all') return true;
  if (status === 'exempt') return record.reviewStatus === 'exempted';
  if (status === 'complete') return record.status === 'complete';
  if (status === 'open') return record.status === 'open';
  return record.arrivalStatus === status;
}

function buildPunctualityRows(records: StaffClockingDailyRecord[]): PunctualityRow[] {
  return Object.values(records.reduce<Record<string, PunctualityRow>>((result, record) => {
    const row = result[record.staffId] ||= { staffId: record.staffId, name: record.staffName || record.staffId, onTime: 0, grace: 0, late: 0, exempt: 0, complete: 0 };
    if (record.reviewStatus === 'exempted') row.exempt += 1;
    else if (record.arrivalStatus === 'on_time') row.onTime += 1;
    else if (record.arrivalStatus === 'grace') row.grace += 1;
    else if (record.arrivalStatus === 'late') row.late += 1;
    if (record.status === 'complete') row.complete += 1;
    return result;
  }, {})).sort((first, second) => first.name.localeCompare(second.name));
}

function RecordStatusBadge({ record }: { record: StaffClockingDailyRecord }) {
  const label = record.reviewStatus === 'exempted' ? 'Exempt' : record.status === 'open' ? 'Still working' : humanArrival(record.arrivalStatus);
  const variant = record.reviewStatus === 'exempted' ? 'secondary' : record.arrivalStatus === 'late' ? 'destructive' : 'outline';
  return <Badge variant={variant}>{label}</Badge>;
}

function WeeklyAttendanceMatrix({ records, from, onSelect }: { records: StaffClockingDailyRecord[]; from: string; onSelect: (record: StaffClockingDailyRecord) => void }) {
  const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(`${from}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + index); return date.toISOString().slice(0, 10); });
  const byStaff = records.reduce<Record<string, { name: string; records: Record<string, StaffClockingDailyRecord> }>>((result, record) => {
    const row = result[record.staffId] ||= { name: record.staffName || record.staffId, records: {} };
    row.records[record.localDate] = record;
    return result;
  }, {});
  const staffRows = Object.entries(byStaff).sort(([, first], [, second]) => first.name.localeCompare(second.name));
  return <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[62rem] text-left text-sm"><thead className="border-b bg-muted/50 text-xs text-muted-foreground"><tr><th className="px-4 py-3">Staff</th><th className="px-3 py-3">Clock</th>{days.map((day) => <th key={day} className="min-w-28 px-3 py-3 text-center">{new Intl.DateTimeFormat('en-UG', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`))}</th>)}</tr></thead><tbody>{staffRows.flatMap(([staffId, row]) => [<tr key={`${staffId}-in`} className="border-b"><td rowSpan={2} className="px-4 py-3 align-middle font-medium">{row.name}</td><td className="px-3 py-2 text-xs font-medium text-muted-foreground">In</td>{days.map((day) => <WeeklyRecordCell key={day} record={row.records[day]} kind="in" onSelect={onSelect} />)}</tr>, <tr key={`${staffId}-out`} className="border-b last:border-0"><td className="px-3 py-2 text-xs font-medium text-muted-foreground">Out</td>{days.map((day) => <WeeklyRecordCell key={day} record={row.records[day]} kind="out" onSelect={onSelect} />)}</tr>])}</tbody></table></div>;
}

function WeeklyRecordCell({ record, kind, onSelect }: { record?: StaffClockingDailyRecord; kind: 'in' | 'out'; onSelect: (record: StaffClockingDailyRecord) => void }) {
  if (!record) return <td className="px-3 py-2 text-center text-muted-foreground">—</td>;
  const time = kind === 'in' ? formatScheduleTime(record.effectiveClockInTime || record.clockInTime) : formatScheduleTime(record.effectiveClockOutTime || record.clockOutTime);
  return <td className="px-3 py-2 text-center"><Button type="button" variant="ghost" size="sm" className={cn('h-auto px-2 py-1 text-xs', kind === 'in' && record.arrivalStatus === 'late' && 'text-destructive', kind === 'in' && record.arrivalStatus === 'grace' && 'text-amber-700 dark:text-amber-400')} onClick={() => onSelect(record)}>{time}</Button></td>;
}

function ClockRecordDetailsDialog({ record, onOpenChange }: { record: StaffClockingDailyRecord | null; onOpenChange: (open: boolean) => void }) {
  return <Dialog open={Boolean(record)} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Clocking details</DialogTitle><DialogDescription>{record?.staffName || record?.staffId} · {record?.localDate}</DialogDescription></DialogHeader>{record && <div className="grid gap-3 text-sm sm:grid-cols-2"><RecordDetail label="Clock in" value={formatScheduleTime(record.effectiveClockInTime || record.clockInTime)} /><RecordDetail label="Clock out" value={formatScheduleTime(record.effectiveClockOutTime || record.clockOutTime)} /><RecordDetail label="Arrival status" value={record.reviewStatus === 'exempted' ? 'Exempt' : humanArrival(record.arrivalStatus)} /><RecordDetail label="Shift status" value={record.status === 'open' ? 'Still working' : record.status === 'missing_clock_out' ? 'Missing clock out' : 'Complete'} />{record.secondsLate !== undefined && <RecordDetail label="Late by" value={`${Math.max(0, Math.round(record.secondsLate / 60))} minutes`} />}{record.graceMinutes !== undefined && <RecordDetail label="Grace period" value={`${record.graceMinutes} minutes`} />}{record.clockInBy && <RecordDetail label="Clock-in source" value={record.clockInBy} />}</div>}</DialogContent></Dialog>;
}

function RecordDetail({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-medium">{value}</p></div>; }
function reportRange(view: RecordsView, anchor: string) { const date = new Date(`${anchor}T12:00:00Z`); if (view === 'daily') return { from: anchor, to: anchor }; if (view === 'weekly') { const mondayOffset = (date.getUTCDay() + 6) % 7; const from = new Date(date); from.setUTCDate(date.getUTCDate() - mondayOffset); const to = new Date(from); to.setUTCDate(from.getUTCDate() + 6); return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }; } const from = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)); const to = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)); return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }; }
function moveReportDate(view: RecordsView, anchor: string, direction: number) { const date = new Date(`${anchor}T12:00:00Z`); if (view === 'daily') date.setUTCDate(date.getUTCDate() + direction); else if (view === 'weekly') date.setUTCDate(date.getUTCDate() + direction * 7); else date.setUTCMonth(date.getUTCMonth() + direction); return date.toISOString().slice(0, 10); }
function reportLabel(view: RecordsView, range: { from: string; to: string }) { return view === 'daily' ? range.from : view === 'weekly' ? `${range.from} – ${range.to}` : new Intl.DateTimeFormat('en-UG', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${range.from}T12:00:00Z`)); }

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
