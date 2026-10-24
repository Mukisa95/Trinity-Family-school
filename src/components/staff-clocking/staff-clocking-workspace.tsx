'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { BookOpenCheck, CalendarClock, CheckCircle2, FileClock, History, Loader2, QrCode, ScanLine, Settings2, ShieldCheck, Trash2 } from 'lucide-react';
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
import { useCreateStaffClockingClosure, useCreateStaffClockingRequest, useCreateStaffClockingSchedule, useDeleteStaffClockingSchedule, useExportStaffClockingRecords, useFinalizeStaffClockingDate, useOwnStaffClockingNotifications, useReviewStaffClockingRequest, useStaffClockingBootstrap, useStaffClockingClosures, useStaffClockingDailyRecords, useStaffClockingReviewRequests, useStaffClockingSchedules, useStaffClockingStaffCandidates, useUpdateStaffClockingSchedule, useUpdateStaffClockingSettings } from '@/lib/hooks/use-staff-clocking';
import type { StaffClockingBootstrap, StaffClockingFeatureSettings } from '@/lib/staff-clocking/contracts';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { StaffClockingQrDisplay } from '@/components/staff-clocking/staff-clocking-qr-display';
import { StaffClockingQrScanner } from '@/components/staff-clocking/staff-clocking-qr-scanner';

type StaffClockingSection = 'record' | 'clock' | 'records';

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
            const active = item.id === section;
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
        {section === 'record' && <RecordPanel bootstrap={bootstrap.data} canManage={canManage} canManageCalendar={canManageCalendar} canDisplayQr={canDisplayQr} isSaving={updateSettings.isPending} onSettingsChange={(settings) => {
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
  const notifications = useOwnStaffClockingNotifications(Boolean(bootstrap?.access.canClock));
  const availabilityMessage = isLoading
    ? 'Checking whether Staff Clocking is available for your account.'
    : !bootstrap?.feature.enabled
      ? 'Your school has not enabled Staff Clocking yet.'
      : !bootstrap.access.isEnrolled
        ? 'Your linked staff account has not been enrolled for Staff Clocking yet.'
        : 'Your account is enrolled. A verified school schedule is required before scanning can start.';
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
      <Card className="border-blue-200/70 bg-gradient-to-br from-blue-50/90 via-card to-indigo-50/60 dark:border-blue-900/70 dark:from-blue-950/35 dark:via-card dark:to-indigo-950/20">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl"><ScanLine className="h-5 w-5 text-primary" /> Your clock</CardTitle>
              <CardDescription className="mt-2 max-w-xl">Scan the rotating QR shown by a school manager. The server will resolve your approved schedule and record the result.</CardDescription>
            </div>
            <Badge variant="outline" className="shrink-0">{isLoading ? 'Checking' : isEnabledForStaff ? 'Ready to scan' : 'Unavailable'}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isEnabledForStaff && <div className="rounded-xl border border-dashed border-blue-300/80 bg-background/70 p-5 dark:border-blue-800/80"><p className="text-sm font-semibold">Clocking is not available for this account</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{availabilityMessage}</p></div>}
          <StaffClockingQrScanner available={isEnabledForStaff} />
          {(canRequestExemption || canRequestCorrection) && <StaffClockingRequestDialog canRequestExemption={canRequestExemption} canRequestCorrection={canRequestCorrection} />}
          {notifications.data?.length ? <div className="rounded-xl border border-border bg-background/70 p-4"><p className="text-sm font-semibold">Clocking updates</p><ul className="mt-2 space-y-2">{notifications.data.map((notice) => <li key={notice.id} className="text-sm"><span className="font-medium">{notice.title}</span><span className="block text-muted-foreground">{notice.body}</span></li>)}</ul></div> : null}
        </CardContent>
      </Card>
      <StatusCard icon={CalendarClock} title="Today&apos;s schedule" description="Your schedule will be resolved from approved staff, group, and school rules." />
    </div>
  );
}

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

function RecordPanel({ bootstrap, canManage, canManageCalendar, canDisplayQr, isSaving, onSettingsChange }: {
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
  const feature = bootstrap?.feature;
  const hasActiveSchedule = bootstrap?.hasActiveSchedule === true;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl"><QrCode className="h-5 w-5 text-primary" /> Record staff arrival</CardTitle>
          <CardDescription>Present a rotating school QR only after the feature configuration and trusted server session are active.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canDisplayQr ? <StaffClockingQrDisplay available={Boolean(feature?.enabled && hasActiveSchedule)} /> : (
            <div className="rounded-xl border border-dashed border-border bg-muted/35 p-6 text-center"><QrCode className="mx-auto h-12 w-12 text-muted-foreground" /><p className="mt-3 font-semibold">QR display permission is required</p><p className="mt-1 text-sm leading-6 text-muted-foreground">A manager can configure schedules without being permitted to open the public clocking display.</p></div>
          )}
          {canManage && (
            <div className="rounded-xl border border-border/80 bg-background/70 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">Enable Staff Clocking</p>
                  <p className="mt-1 text-sm text-muted-foreground">This publishes the feature state through the protected server API. Scanning remains unavailable until an approved schedule exists.</p>
                </div>
                {feature ? (
                  <Switch
                    checked={feature.enabled}
                    onCheckedChange={(enabled) => onSettingsChange({ enabled, accessMode: feature.accessMode, enrolledStaffIds: feature.enrolledStaffIds })}
                    disabled={isSaving}
                    aria-label="Enable Staff Clocking"
                  />
                ) : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading clocking settings" />}
              </div>
              {isSaving && <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving feature setting…</p>}
            </div>
          )}
          {canManage && feature && <EnrollmentPanel feature={feature} staff={staff.data || []} saving={isSaving} onSave={(accessMode, enrolledStaffIds) => onSettingsChange({ enabled: feature.enabled, accessMode, enrolledStaffIds })} />}
          {canManage && (
            <div className="rounded-xl border border-border/80 bg-background/70 p-4">
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /><p className="text-sm font-semibold">Approved schedules</p></div>
              {schedules.isPending ? <p className="mt-2 text-sm text-muted-foreground">Loading schedules…</p> : schedules.data?.length ? (
                <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                  {schedules.data.map(schedule => <li key={schedule.id} className="flex items-center justify-between gap-3"><span className="capitalize">{schedule.scope} {schedule.kind === 'date_override' ? 'override' : 'schedule'}</span><div className="flex items-center gap-2"><span className="font-mono text-xs">{schedule.clockInBy}</span><ScheduleEditDialog schedule={schedule} saving={updateSchedule.isPending} onSave={(next) => updateSchedule.mutate({ id: schedule.id, schedule: next })} /><Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={`Delete ${schedule.scope} schedule`} disabled={deleteSchedule.isPending} onClick={() => { if (window.confirm('Delete this staff clocking schedule?')) deleteSchedule.mutate(schedule.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></li>)}
                </ul>
              ) : <p className="mt-2 text-sm text-muted-foreground">No approved schedules have been created yet.</p>}
              <SchoolScheduleDialog staff={staff.data || []}
                disabled={createSchedule.isPending}
                error={createSchedule.error?.message}
                onCreate={(schedule) => createSchedule.mutate(schedule)}
              />
            </div>
          )}
          {canManageCalendar && <ClosurePanel closures={closures.data || []} isLoading={closures.isPending} error={closures.error?.message} creating={createClosure.isPending} onCreate={(closure) => createClosure.mutate(closure)} />}
        </CardContent>
      </Card>
      <StatusCard icon={Settings2} title="Manager setup" description="Schedules, closures, enrolment, and review permissions must be configured before recording starts." />
    </div>
  );
}

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
  const [open, setOpen] = useState(false); const [clockInBy, setClockInBy] = useState(schedule.clockInBy); const [graceMinutes, setGraceMinutes] = useState(String(schedule.graceMinutes)); const [active, setActive] = useState(schedule.isActive);
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button type="button" variant="ghost" size="sm">Edit</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Edit schedule</DialogTitle><DialogDescription>Changes affect future scans. Existing daily records retain their saved values.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSave({ scope: schedule.scope, subjectId: schedule.subjectId, kind: schedule.kind, workDate: schedule.workDate, weekdays: schedule.weekdays, startsOn: schedule.startsOn, endsOn: schedule.endsOn, clockInBy, graceMinutes: Number(graceMinutes), priority: schedule.priority, isActive: active }); setOpen(false); }}><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor={`edit-time-${schedule.id}`}>Clock in by</Label><Input id={`edit-time-${schedule.id}`} type="time" value={clockInBy} onChange={(event) => setClockInBy(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor={`edit-grace-${schedule.id}`}>Grace minutes</Label><Input id={`edit-grace-${schedule.id}`} type="number" min="0" max="180" value={graceMinutes} onChange={(event) => setGraceMinutes(event.target.value)} required /></div></div><label className="flex items-center gap-2 text-sm"><Checkbox checked={active} onCheckedChange={(checked) => setActive(checked === true)} />Active schedule</label><DialogFooter><Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Save changes</Button></DialogFooter></form></DialogContent></Dialog>;
}

function SchoolScheduleDialog({ staff, disabled, error, onCreate }: {
  staff: import('@/lib/staff-clocking/contracts').StaffClockingStaffCandidate[];
  disabled: boolean;
  error?: string;
  onCreate: (schedule: Omit<import('@/lib/staff-clocking/contracts').StaffClockingSchedule, 'id'>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [clockInBy, setClockInBy] = useState('08:00');
  const [graceMinutes, setGraceMinutes] = useState('10');
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [scope, setScope] = useState<'school' | 'group' | 'staff'>('school');
  const [subjectId, setSubjectId] = useState('');
  const days = [
    { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' }, { value: 0, label: 'Sun' },
  ];

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!weekdays.length) return;
    if (scope !== 'school' && !subjectId) return;
    onCreate({ scope, subjectId: scope === 'school' ? undefined : subjectId, kind: 'recurring', weekdays, clockInBy, graceMinutes: Number(graceMinutes), priority: 0, isActive: true });
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="clock-in-by">Clock in by</Label><Input id="clock-in-by" type="time" value={clockInBy} onChange={(event) => setClockInBy(event.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="grace-minutes">Grace minutes</Label><Input id="grace-minutes" type="number" min="0" max="180" value={graceMinutes} onChange={(event) => setGraceMinutes(event.target.value)} required /></div>
          </div>
          <fieldset className="space-y-2"><legend className="text-sm font-medium">Working days</legend><div className="flex flex-wrap gap-3">
            {days.map((day) => <label key={day.value} className="flex min-h-11 items-center gap-2 text-sm"><Checkbox checked={weekdays.includes(day.value)} onCheckedChange={(checked) => setWeekdays(current => checked ? [...new Set([...current, day.value])].sort() : current.filter(value => value !== day.value))} />{day.label}</label>)}
          </div>{weekdays.length === 0 && <p role="alert" className="text-sm text-destructive">Choose at least one working day.</p>}</fieldset>
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
