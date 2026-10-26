'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useRef, type ReactNode, type ComponentProps } from 'react';
import { CalendarDays, CalendarClock, Clock3, FileClock, ClipboardCheck, MessageSquareText, ShieldCheck, Download, MoreHorizontal, Printer, ChevronLeft, ChevronRight, Filter, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/contexts/auth-context';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useStaffById } from '@/lib/hooks/use-staff';
import { useSchoolSettings } from '@/lib/hooks/use-school-settings';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSchoolDay, requestStaffClocking } from '@/lib/hooks/use-staff-clocking';
import { useStaffClockingDetail, useStaffClockingDetailMonths, useMutateStaffClockingDetail, useCheckStaffClockingDetail } from '@/lib/hooks/use-staff-clocking-details';
import { GlassPageTopBar, GlassActionDock, GlassActionButton } from '@/components/common/glass-page-top-bar';
import { GlassSummaryBar } from '@/components/common/glass-summary-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent as DesktopDialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SheetContent } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { buildStaffDetailRows, summarizeStaffDetail, detailPeriodRange, detailDates, detailTime, detailElapsed, departureStatus, individualCsv } from '@/lib/staff-clocking/details-report';
import { detailStatusLabels, type DetailRange, type DetailTab, type StaffClockingDetailProfile, type StaffClockingDetailPlan, type StaffClockingDetailRow, type StaffClockingDetailRequest, type StaffClockingDetailAuditPage } from '@/lib/staff-clocking/details-contracts';
import type { StaffClockingDailyRecord } from '@/lib/staff-clocking/contracts';
import { cn } from '@/lib/utils';
import { StaffClockingPeriodPicker } from './staff-clocking-period-picker';
import { detailRangeLabel, type DetailView } from '@/lib/staff-clocking/details-period';
import { ClockingDetailStatus as Status, emptyDetailFilters as initialFilters, type DetailFilters as Filters, DetailFilterFields, MobileClockingProfile, MobileClockingStats, MobileAttendanceDate, MobileTermHistory, MobileClockingFilters } from './staff-clocking-detail-mobile';

const tabNames: Record<DetailTab, string> = { history: 'Attendance History', schedule: 'Work Schedule', exemptions: 'Exemptions & Leave', requests: 'Requests & Reviews', audit: 'Audit History' };
const mobileTabNames: Record<DetailTab, string> = { history: 'History', schedule: 'Schedule', exemptions: 'Leave', requests: 'Reviews', audit: 'Audit' };
const tabIcons = {history:FileClock,schedule:CalendarClock,exemptions:ClipboardCheck,requests:MessageSquareText,audit:ShieldCheck};
const tabTones = {history:'blue',schedule:'violet',exemptions:'emerald',requests:'orange',audit:'slate'} as const;
const summaryTones = {
  blue: 'border-blue-100 bg-blue-50/80 text-blue-700 dark:border-blue-900/30 dark:bg-blue-950/20 dark:text-blue-300',
  green: 'border-emerald-100 bg-emerald-50/80 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300',
  amber: 'border-amber-100 bg-amber-50/80 text-amber-700 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300',
  red: 'border-rose-100 bg-rose-50/80 text-rose-700 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300',
  violet: 'border-violet-100 bg-violet-50/80 text-violet-700 dark:border-violet-900/30 dark:bg-violet-950/20 dark:text-violet-300',
};
const selectClass = 'h-10 w-full min-w-0 rounded-full border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:[color-scheme:dark]';
const prettyDate = (date: string) => new Intl.DateTimeFormat('en-UG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
function includesRow(row: StaffClockingDetailRow, filters: Filters, requests: StaffClockingDetailRequest[] = []) {
  const record = row.record, arrival = record?.effectiveClockInTime || record?.clockInTime, out = record?.effectiveClockOutTime || record?.clockOutTime;
  if (filters.population === 'attended' && !arrival || filters.population === 'scheduled' && !row.scheduled) return false;
  if (filters.status !== 'all' && row.status !== filters.status) return false;
  if (filters.clock === 'complete' && record?.status !== 'complete' || filters.clock === 'open' && (!arrival || out) || filters.clock === 'missing_in' && arrival || filters.clock === 'missing_out' && record?.status !== 'missing_clock_out') return false;
  if (filters.dayType !== 'all' && row.dayType !== filters.dayType) return false;
  if (filters.weekday !== 'all' && new Date(`${row.date}T12:00:00Z`).getUTCDay() !== Number(filters.weekday)) return false;
  if (filters.correction === 'approved' && record?.reviewStatus !== 'corrected' || filters.correction === 'none' && record?.reviewStatus === 'corrected') return false;
  if (['pending', 'rejected'].includes(filters.correction) && !requests.some(request => request.kind === 'correction' && request.localDate === row.date && request.status === filters.correction)) return false;
  if (filters.source === 'qr' && !record?.clockInAt || filters.source === 'correction' && record?.reviewStatus !== 'corrected') return false;
  if (filters.departure !== 'all' && departureStatus(row) !== filters.departure) return false;
  return !filters.minutes || (record?.secondsLate || 0) >= Number(filters.minutes) * 60;
}
const detailErrors: Record<string, string> = {
  PERMISSION_DENIED: 'You do not have permission to view or change these staff clocking details.',
  CLOCKING_EXPLANATION_ALREADY_SUBMITTED: 'An explanation for this arrival is already awaiting review or has been approved.',
  CLOCKING_SELF_REVIEW_NOT_ALLOWED: 'Another authorized person must review this request.',
  CLOCKING_REQUEST_ALREADY_REVIEWED: 'This request has already been reviewed. The latest decision will appear when synchronized.',
  CLOCKING_CORRECTION_INVALID_TIME_ORDER: 'Departure must be later than arrival.',
  CLOCKING_FUTURE_CORRECTION_NOT_ALLOWED: 'Choose today or an earlier work date for a correction.',
  CLOCKING_ACTIVE_STAFF_ACCOUNT_REQUIRED: 'This staff member needs an active linked login before a correction can be requested.',
  CLOCKING_STAFF_NOT_FOUND: 'This staff member could not be found.',
  CLOCKING_LATE_RECORD_REQUIRED: 'An explanation can only be submitted for a recorded late arrival.',
};
function ReadError({ error }: { error: Error | null | undefined }) { return error ? <p role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive dark:text-red-300">{detailErrors[error.message] || error.message}</p> : null; }
function Field({ label, value }: { label: string; value?: string | number }) { return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-semibold">{value || '—'}</dd></div>; }

export function StaffClockingStaffDetails({ staffId }: { staffId: string }) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { canPerformAction } = usePermissions();
  const own = user?.staffId === staffId;
  const permitted = own || canPerformAction('staff_clocking', 'records', 'view_records');
  const staffCache = useStaffById(staffId, { enabled: permitted });
  const today = useSchoolDay(true);
  const [period, setPeriod] = useState<DetailView>('week');
  const [navigationReady, setNavigationReady] = useState(false);
  const [anchor, setAnchor] = useState(today);
  const [custom, setCustom] = useState<DetailRange>({ from: today, to: today });
  const [termKey, setTermKey] = useState('');
  const [yearId, setYearId] = useState('');
  const [tab, setTab] = useState<DetailTab>('history');
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [advanced, setAdvanced] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [calendar, setCalendar] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<StaffClockingDetailRow | null>(null);
  const [form, setForm] = useState<{ action: 'request' | 'exempt' | 'explain'; kind?: 'exemption' | 'correction'; date: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<Error | null>(null);
  const [presetMessage, setPresetMessage] = useState('');
  const [peers, setPeers] = useState<string[]>([]);
  const years = useAcademicYears();
  const schoolSettings = useSchoolSettings();
  const [offline, setOffline] = useState(false);
  const terms = useMemo(() => (years.data || []).flatMap(year => year.terms.map(term => ({ key: `${year.id}:${term.id}`, yearId: year.id, label: `${year.name} · ${term.name}`, from: term.startDate.slice(0, 10), to: term.endDate.slice(0, 10), current: term.isCurrent }))), [years.data]);
  const eligibleTerms = terms.filter(item => !yearId || item.yearId === yearId);
  const term = eligibleTerms.find(item => item.key === termKey) || eligibleTerms.find(item => item.from <= anchor && item.to >= anchor) || eligibleTerms.find(item => item.current) || eligibleTerms[0];
  const range = detailPeriodRange(period, anchor, term, custom);
  const periodLabel = period === 'term' ? term?.label || 'Select term' : period === 'month' && detailDates(range).length ? new Intl.DateTimeFormat('en-UG', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${range.from}T12:00:00Z`)) : detailDates(range).length ? detailRangeLabel(range, isMobile) : 'Select period';
  const validRange = detailDates(range).length > 0 && (period !== 'term' || !!term);
  const profile = useStaffClockingDetail<StaffClockingDetailProfile>(staffId, 'profile', permitted);
  const access = profile.data?.permissions;
  const enabled = permitted && !!profile.data && navigationReady;
  const plan = useStaffClockingDetail<StaffClockingDetailPlan>(staffId, 'plan', enabled);
  const current = useStaffClockingDetail<{ localDate: string; record?: StaffClockingDailyRecord }>(staffId, 'today', enabled);
  const history = useStaffClockingDetailMonths(staffId, range, enabled && validRange);
  const requests = useStaffClockingDetail<{requests: StaffClockingDetailRequest[]}>(staffId, tab === 'exemptions' ? 'exemptions' : 'requests', enabled && validRange && (['exemptions', 'requests'].includes(tab) || ['pending', 'rejected'].includes(filters.correction)), range);
  const mutation = useMutateStaffClockingDetail(staffId);
  const checkUpdates = useCheckStaffClockingDetail(staffId);
  const rows = useMemo(() => plan.data && validRange ? buildStaffDetailRows(range, history.records, plan.data, today) : [], [plan.data, range.from, range.to, history.records, today, validRange]);
  const visible = rows.filter(row => includesRow(row, filters, requests.data?.requests));
  const summary = summarizeStaffDetail(visible);
  const loading = profile.isPending || plan.isPending || history.isPending;
  const person = profile.data?.staff;
  const cachedName = permitted ? [staffCache.data?.firstName, staffCache.data?.otherNames, staffCache.data?.lastName].filter(Boolean).join(' ') : '';
  const todayRow = plan.data ? buildStaffDetailRows({ from: today, to: today }, current.data?.record ? [current.data.record] : [], plan.data, today)[0] : undefined;
  const peerIndex = peers.indexOf(staffId);
  const presetKey = `staff-clocking-filter:${user?.id}:${staffId}`;
  useEffect(() => { setPage(0); }, [staffId, range.from, range.to, JSON.stringify(filters), pageSize]);
  useEffect(() => {setCalendar(false);}, [period]);
  useEffect(() => { const changed = () => setOffline(!navigator.onLine); changed(); window.addEventListener('online', changed); window.addEventListener('offline', changed); return () => { window.removeEventListener('online', changed); window.removeEventListener('offline', changed); }; }, []);
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search), date = params.get('date');
      if (date && detailDates({ from: date, to: date }).length) setAnchor(date);
      const from = params.get('from'), to = params.get('to');
      if (from && to && detailDates({ from, to }).length) { const requested = params.get('period'); setAnchor(from); setPeriod(requested === 'day' ? 'week' : ['week', 'month', 'term'].includes(requested || '') ? requested as DetailView : 'custom'); setCustom({ from, to }); }
      const saved = JSON.parse(sessionStorage.getItem(`staff-clocking-peers:${user?.id}`) || '[]');
      if (Array.isArray(saved)) setPeers(saved.filter((id): id is string => typeof id === 'string').slice(0, 500));
    } catch { /* Navigation and presets remain usable without web storage. */ }
    setNavigationReady(true);
  }, [staffId, user?.id]);
  const move = (direction: number) => {
    if (period === 'term') { const index = eligibleTerms.findIndex(item => item.key === term?.key); const next = eligibleTerms[index + direction]; if (next) { setTermKey(next.key); setAnchor(next.from); } return; }
    const date = new Date(`${anchor}T12:00:00Z`);
    if (!Number.isFinite(date.getTime())) { setAnchor(today); return; }
    if (period === 'week') date.setUTCDate(date.getUTCDate() + 7 * direction);
    else { date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + direction); }
    setAnchor(date.toISOString().slice(0, 10));
  };
  const setFilter = (key: keyof Filters, value: string) => setFilters(current => ({ ...current, [key]: value }));
  const filterCount = Object.values(filters).filter(value => value !== 'all' && value !== '').length;
  const savePreset = () => { try { localStorage.setItem(presetKey, JSON.stringify(filters)); setPresetMessage('Filter preset saved.'); } catch { setPresetMessage('This device could not save the preset.'); } };
  const loadPreset = () => { try { const saved = JSON.parse(localStorage.getItem(presetKey) || 'null'); if (saved && Object.keys(initialFilters).every(key => typeof saved[key] === 'string')) {setFilters(saved);setPresetMessage('Filter preset restored.');} else setPresetMessage('No saved preset for this staff profile.'); } catch {setPresetMessage('Preset could not be restored.');} };
  const exportReport = async (format: 'csv' | 'pdf' | 'print') => {
    if (!access?.export) return;
    const printWindow = format === 'print' ? window.open('', '_blank') : null;
    setExporting(true); setExportError(null);
    try {
      const data = await requestStaffClocking<{ profile: StaffClockingDetailProfile; rows: StaffClockingDetailRow[]; generatedAt: string }>(`/api/staff-clocking/staff/${encodeURIComponent(staffId)}?${new URLSearchParams({ part: 'export', ...range })}`);
      const reportRows = data.rows.filter(row => includesRow(row, filters, requests.data?.requests));
      if (format === 'csv') {
        const url = URL.createObjectURL(new Blob(['\ufeff' + individualCsv(data.profile.staff.name, data.profile.staff.employeeId, reportRows)], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = `staff-attendance-${staffId}-${range.from}-${range.to}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        const table = reportRows.map(row => [row.date, row.expectedIn || '—', row.record?.effectiveClockInTime || row.record?.clockInTime || '—', row.expectedOut || '—', row.record?.effectiveClockOutTime || row.record?.clockOutTime || '—', detailStatusLabels[row.status]]);
        const headings = ['Date', 'Expected in', 'Actual in', 'Expected out', 'Actual out', 'Status'];
        const title = `${data.profile.staff.name} · ${data.profile.staff.employeeId}`;
        const school = schoolSettings.data?.generalInfo?.name || 'Trinity Family School';
        if (format === 'pdf') {
          const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
          const pdf = new jsPDF(); pdf.setFontSize(15); pdf.text(school, 14, 18); pdf.setFontSize(11); pdf.text(title, 14, 27); pdf.text(`${range.from} – ${range.to} · Africa/Kampala`, 14, 35);
          autoTable(pdf, { startY: 42, head: [headings], body: table, styles: { fontSize: 8 }, didDrawPage: () => { pdf.setFontSize(8); pdf.text(`Generated ${data.generatedAt} · Elapsed time is not verified payable work.`, 14, pdf.internal.pageSize.height - 10); } });
          pdf.save(`staff-attendance-${staffId}-${range.from}.pdf`);
        } else {
          if (!printWindow) throw new Error('Allow pop-ups to print this report.');
          const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
          printWindow.document.write(`<html><head><title>Individual Attendance Report</title><style>body{font:12px Arial;margin:28px}table{width:100%;border-collapse:collapse}td,th{padding:7px;border:1px solid #ccc;text-align:left}thead{display:table-header-group}</style></head><body><h1>${escape(school)}</h1><h2>${escape(title)}</h2><p>${range.from} – ${range.to} · Africa/Kampala</p><table><thead><tr>${headings.map(value => `<th>${escape(value)}</th>`).join('')}</tr></thead><tbody>${table.map(row => `<tr>${row.map(value => `<td>${escape(value)}</td>`).join('')}</tr>`).join('')}</tbody></table><p>Generated ${escape(data.generatedAt)}. Elapsed time is not verified payable work.</p></body></html>`);
          printWindow.document.close(); printWindow.focus(); printWindow.print();
        }
      }
      setExportOpen(false);
    } catch (error) { printWindow?.close(); setExportError(error instanceof Error ? error : new Error('Export failed.')); }
    finally { setExporting(false); }
  };
  const menuItems = <>
      <DropdownMenuItem onSelect={() => {setPeriod('custom');setDatePickerOpen(true);}}>Custom date range</DropdownMenuItem>
      {isMobile && <><DropdownMenuItem disabled={period === 'custom'} onSelect={() => move(-1)}>Previous period</DropdownMenuItem><DropdownMenuItem disabled={period === 'custom'} onSelect={() => move(1)}>Next period</DropdownMenuItem>{tab === 'history' && <DropdownMenuItem onSelect={() => setCalendar(!calendar)}>{calendar ? 'List view' : 'Calendar view'}</DropdownMenuItem>}</>}
      {access?.export && <><DropdownMenuItem onSelect={() => setExportOpen(true)}>Export attendance</DropdownMenuItem><DropdownMenuItem onSelect={() => void exportReport('print')}>Print report</DropdownMenuItem></>}
      {access?.profile && <DropdownMenuItem asChild><Link href={`/staff/${encodeURIComponent(staffId)}`}>View staff profile</Link></DropdownMenuItem>}
      <DropdownMenuItem onSelect={() => setTab('schedule')}>View work schedule</DropdownMenuItem>
      <DropdownMenuItem disabled={checkUpdates.isPending} onSelect={() => checkUpdates.mutate(undefined, {onSuccess: () => setPresetMessage('Change counters checked. Your view is up to date.')})}>Check for updates</DropdownMenuItem>
      {access?.request && <DropdownMenuItem onSelect={() => setForm({ action: 'request', kind: 'correction', date: selected?.date || anchor })}>Request correction</DropdownMenuItem>}
      {access?.exempt && <DropdownMenuItem onSelect={() => setForm({ action: 'exempt', date: selected?.date || anchor })}>Record exemption</DropdownMenuItem>}
      {access?.audit && <DropdownMenuItem onSelect={() => setTab('audit')}>View audit history</DropdownMenuItem>}
      {isMobile && <><DropdownMenuItem onSelect={savePreset}>Save filter preset</DropdownMenuItem><DropdownMenuItem onSelect={loadPreset}>Load filter preset</DropdownMenuItem></>}
  </>;
  const moreMenu = (mobile: boolean) => <DropdownMenu><DropdownMenuTrigger asChild>{mobile ? <Button type="button" variant="ghost" size="icon" className="h-11 w-11 rounded-full" aria-label="More"><MoreHorizontal className="h-5 w-5" /></Button> : <GlassActionButton label="More" icon={<MoreHorizontal className="h-4 w-4" />} />}</DropdownMenuTrigger><DropdownMenuContent align="end">{menuItems}</DropdownMenuContent></DropdownMenu>;
  const detailsTabs = <div role="tablist" aria-label="Staff clocking details" className="flex flex-1 items-center" onKeyDown={event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const currentIndex = tabs.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault(); tabs[next]?.focus(); tabs[next]?.click();
  }}>{Object.entries(tabNames).filter(([key]) => key !== 'audit' || access?.audit).map(([key,name]) => {
    const section = key as DetailTab, Icon = tabIcons[section];
    return <GlassActionButton key={key} label={mobileTabNames[section]} icon={<Icon className="h-4 w-4" />} tone={tabTones[section]} active={tab === section} role="tab" aria-label={name} tabIndex={tab === section ? 0 : -1} id={`detail-tab-${key}`} aria-controls={`detail-panel-${key}`} aria-selected={tab === section} onClick={() => setTab(section)} />;
  })}</div>;
  const actions = <GlassActionDock>{detailsTabs}</GlassActionDock>;
  if (!permitted) return <div className="p-6"><ReadError error={new Error('PERMISSION_DENIED')} /></div>;
  return <div className="min-h-full print:bg-white">
    <GlassPageTopBar title={isMobile ? 'Staff Clock Details' : person?.name || cachedName || 'Staff Clock Details'} eyebrow={isMobile ? undefined : 'Staff Clocking'} backHref={own ? '/staff-clocking/clock' : '/staff-clocking/records'} backLabel={own ? 'My Clock' : 'Clock Records'}
      recordDetails={isMobile ? undefined : person ? `${person.employeeId} · ${person.roles.join(', ')} · ${person.groups.join(', ')}` : 'Individual attendance profile'} badges={<>{!isMobile && person && <Badge variant="outline" className="capitalize">{person.status} staff</Badge>}{offline && <Badge variant="outline">Offline · cached view</Badge>}</>} actions={actions}
      titleControls={!isMobile && peerIndex >= 0 && <div className="flex gap-1">{[[-1, 'Previous staff'], [1, 'Next staff']].map(([offset, label]) => { const target = peers[peerIndex + Number(offset)]; return <Button key={label} type="button" variant="outline" size="icon" disabled={!target} aria-label={String(label)} asChild={!!target}>{target ? <Link href={`/staff-clocking/staff/${encodeURIComponent(target)}?${new URLSearchParams({ ...range, period })}`}>{offset === -1 ? <ChevronLeft /> : <ChevronRight />}</Link> : offset === -1 ? <ChevronLeft /> : <ChevronRight />}</Button>; })}</div>}
      actionsLeading={<div className="flex items-center gap-1">{access?.export && (isMobile ? <Button type="button" variant="ghost" size="icon" className="h-11 w-11 rounded-full" aria-label="Export attendance" onClick={() => setExportOpen(true)}><Download className="h-5 w-5" /></Button> : <GlassActionButton label="Export" icon={<Download className="h-4 w-4" />} onClick={() => setExportOpen(true)} />)}{moreMenu(isMobile)}</div>} />
    <main className="mx-auto max-w-[1440px] space-y-2 px-1 pb-24 md:space-y-4 md:px-6 lg:px-8">
      {!isMobile && <>
      <GlassSummaryBar left={<span className="text-xs font-black tracking-wider uppercase">Attendance summary · {range.from} – {range.to}{Object.values(filters).some(value => value !== 'all' && value !== '') ? ' · Filtered totals' : ''}</span>} right={<>{([
        ['Scheduled', summary.scheduled, 'all', 'blue'], ['Attended', summary.attended, 'all', 'green'], ['On time', summary.onTime, 'on_time', 'green'], ['Grace', summary.grace, 'grace', 'amber'], ['Late', summary.late, 'late', 'red'], ['Approved leave', summary.exempt, 'exempt', 'violet'], ['Absent', summary.absent, 'absent', 'red'],
      ] as const).map(([label, value, status, tone]) => <button key={label} type="button" disabled={loading} className={cn('flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] sm:text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', summaryTones[tone])} onClick={() => setFilters(old => ({ ...old, status, population: label === 'Attended' ? 'attended' : label === 'Scheduled' ? 'scheduled' : 'all' }))}><strong className="font-bold">{loading ? '—' : value}</strong><span className="font-medium">{label}</span></button>)}</>} />
      </>}
      <ReadError error={profile.error || profile.synchronizationError || plan.error || history.error || current.error || checkUpdates.error || (!exportOpen ? exportError : null)} />
      {profile.isPending && <p role="status" className="text-sm text-muted-foreground">Loading verified staff details…</p>}
      {profile.data && <>
      {isMobile && <MobileClockingProfile profile={profile.data} today={todayRow} loading={current.isPending} onToday={() => {if(todayRow) setSelected(todayRow);}} />}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="flex min-w-0 flex-col gap-2 md:block md:space-y-4">
          <div className="hidden md:block xl:hidden">{!isMobile && todayRow && <CurrentStatus row={todayRow} loading={current.isPending} />}</div>
          <div className="order-2 md:order-1">
          {isMobile ? <section aria-label="Reporting period" className="space-y-1 dark:[color-scheme:dark]">
            <div className="flex items-center gap-2"><div role="group" aria-label="Attendance period" className="grid min-w-0 flex-1 grid-cols-3 rounded-xl bg-muted/60 p-1">{(['week','month','term'] as const).map(value => <button key={value} type="button" aria-label={value[0].toUpperCase()+value.slice(1)} aria-pressed={period === value} onClick={() => setPeriod(value)} className={cn('min-h-10 rounded-lg px-1 text-xs font-semibold capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',period === value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground')}>{value}</button>)}</div><Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-xl" aria-label={`Filter records${filterCount ? `, ${filterCount} active` : ''}`} aria-expanded={filterOpen} onClick={() => setFilterOpen(true)}><Filter className="h-5 w-5" />{filterCount > 0 && <span className="sr-only">{filterCount} active filters</span>}</Button></div>
            {!validRange && <p role="alert" className="text-xs text-destructive">Choose a configured term or valid dates covering no more than 366 days.</p>}
            {filterCount > 0 && <div className="flex items-center justify-between gap-2 text-[11px]"><span className="text-muted-foreground">{filterCount} active {filterCount === 1 ? 'filter' : 'filters'}</span><button type="button" className="min-h-9 px-2 font-semibold text-primary" onClick={() => setFilters(initialFilters)}>Clear filters</button></div>}
          </section> : <>
          <Card><CardContent className="space-y-4 p-4"><div role="group" aria-label="Attendance period" className="grid max-w-sm grid-cols-3 rounded-full bg-muted/60 p-1">{(['week','month','term'] as const).map(value => <Button key={value} type="button" variant="ghost" className={cn('rounded-full capitalize',period === value && 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground')} aria-pressed={period === value} onClick={() => setPeriod(value)}>{value[0].toUpperCase()+value.slice(1)}</Button>)}</div><div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,1fr)]"><div className="flex min-w-0 items-center gap-1"><Button type="button" size="icon" variant="outline" disabled={period === 'custom'} aria-label="Previous period" onClick={() => move(-1)}><ChevronLeft className="h-4 w-4" /></Button><Button type="button" variant="outline" className="h-auto min-h-10 min-w-0 flex-1 gap-2 rounded-full px-3 py-2" aria-label="Select reporting period" aria-haspopup="dialog" onClick={() => setDatePickerOpen(true)}><CalendarDays className="h-4 w-4 shrink-0" /><span className="min-w-0 truncate">{range.from <= today && range.to >= today && <span className="mr-2 font-semibold">Today ·</span>}{periodLabel}</span><ChevronRight className="h-3 w-3 shrink-0 rotate-90" /></Button><Button type="button" size="icon" variant="outline" disabled={period === 'custom'} aria-label="Next period" onClick={() => move(1)}><ChevronRight className="h-4 w-4" /></Button></div>
            <div><Label htmlFor="detail-attendance-status">Attendance status</Label><select id="detail-attendance-status" className={selectClass} value={filters.status} onChange={event => setFilter('status', event.target.value)}><option value="all">All statuses</option>{Object.entries(detailStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div>
            {!validRange && <p role="alert" className="text-sm text-destructive dark:text-red-300">Choose valid dates covering no more than 366 days{period === 'term' ? ', and select a configured academic term' : ''}.</p>}
            <div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}><Filter className="h-4 w-4" />More filters</Button><Button type="button" variant="ghost" size="sm" onClick={() => setFilters(initialFilters)}>Clear filters</Button><Button type="button" variant="ghost" size="sm" onClick={() => { try { localStorage.setItem(presetKey, JSON.stringify(filters)); setPresetMessage('Filter preset saved.'); } catch { setPresetMessage('This device could not save the preset.'); } }}>Save preset</Button><Button type="button" variant="ghost" size="sm" onClick={() => { try { const saved = JSON.parse(localStorage.getItem(presetKey) || 'null'); if (saved && Object.keys(initialFilters).every(key => typeof saved[key] === 'string')) { setFilters(saved); setPresetMessage('Filter preset restored.'); } else setPresetMessage('No saved preset for this staff profile.'); } catch { setPresetMessage('Preset could not be restored.'); } }}>Load preset</Button></div><p role="status" className="text-xs text-muted-foreground">{presetMessage}</p>
            {advanced && <div className="grid gap-3 rounded-xl bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailFilterFields filters={filters} onChange={setFilter} />
              <div><Label htmlFor="detail-academic-year">Academic year</Label><select id="detail-academic-year" className={selectClass} value={yearId} onChange={event => { setYearId(event.target.value); setTermKey(''); }}><option value="">All school years</option>{years.data?.map(year => <option key={year.id} value={year.id}>{year.name}</option>)}</select><p className="mt-1 text-xs text-muted-foreground">Used by the Term selector.</p></div>
            </div>}
            <div className="flex flex-wrap gap-2">{Object.entries(filters).filter(([, value]) => value !== 'all' && value !== '').map(([key, value]) => <Button key={key} type="button" variant="secondary" size="sm" aria-label={`Remove ${key} filter`} onClick={() => setFilter(key as keyof Filters, initialFilters[key as keyof Filters])}>{key}: {value} ×</Button>)}</div>
          </CardContent></Card>
          </>}
          </div>
          {isMobile && <div className="order-3"><MobileClockingStats summary={summary} loading={loading} onFilter={(status,population = 'all') => {setFilters(old => ({...old,status,population}));setTab('history');setCalendar(false);}} /></div>}
          <Card role="tabpanel" className={cn('order-4 rounded-[20px]',isMobile && 'border-0 bg-transparent shadow-none')} id={`detail-panel-${tab}`} aria-labelledby={`detail-tab-${tab}`}><CardHeader className="p-0 pb-2 md:p-6"><div className="flex min-w-0 items-center justify-between gap-2"><div className="min-w-0"><CardTitle className="truncate text-sm md:text-base">{isMobile ? tab === 'history' ? 'Attendance Records' : mobileTabNames[tab] : tabNames[tab]}</CardTitle>{!isMobile && <CardDescription>{range.from} – {range.to} · EAT</CardDescription>}</div>{isMobile ? <Button type="button" variant="ghost" className="h-10 min-w-0 max-w-[46%] shrink-0 gap-1 rounded-xl px-1.5 text-[11px]" aria-label="Select reporting period" onClick={() => setDatePickerOpen(true)}><CalendarDays className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{periodLabel}</span></Button> : tab === 'history' && <Button type="button" variant="outline" size="sm" className="min-h-10 rounded-xl" onClick={() => setCalendar(!calendar)}><CalendarDays className="h-4 w-4" />{calendar ? 'List view' : 'Calendar view'}</Button>}</div></CardHeader><CardContent className="space-y-2 p-0 md:space-y-4 md:p-6 md:pt-0">
            {tab === 'history' && (loading ? <Loading /> : history.error ? <ReadError error={history.error} /> : !visible.length ? <p className="text-sm text-muted-foreground">No dates match these filters.</p> : <>
              {!isMobile && period === 'term' && <MonthlyBreakdown rows={visible} onSelect={month => { setAnchor(`${month}-01`); setPeriod('month'); }} />}
              {isMobile && period === 'term' && !calendar ? <MobileTermHistory rows={visible} onSelect={setSelected} /> : calendar ? <AttendanceCalendar rows={visible} onSelect={setSelected} /> : <>
                <div className="space-y-2 md:hidden">{visible.slice(page * pageSize, (page + 1) * pageSize).map(row => <MobileAttendanceDate key={row.date} row={row} onSelect={setSelected} />)}</div>
                <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-xs"><thead className="bg-muted/60 text-muted-foreground"><tr>{['Date', 'Day type', 'Expected in', 'Actual in', 'Expected out', 'Actual out', 'Status', ''].map(label => <th key={label} className="px-2 py-3 font-semibold">{label || 'Details'}</th>)}</tr></thead><tbody>{visible.slice(page * pageSize, (page + 1) * pageSize).map(row => <tr key={row.date} className="border-b border-border/60"><td className="px-2 py-3 font-semibold">{row.date}</td><td className="px-2 py-3 capitalize">{row.dayType}</td><td className="px-2 py-3">{detailTime(row.expectedIn)}</td><td className="px-2 py-3"><button type="button" className="font-semibold text-primary underline-offset-2 hover:underline" onClick={() => setSelected(row)}>{detailTime(row.record?.effectiveClockInTime || row.record?.clockInTime)}</button></td><td className="px-2 py-3">{detailTime(row.expectedOut)}</td><td className="px-2 py-3">{detailTime(row.record?.effectiveClockOutTime || row.record?.clockOutTime)}</td><td className="px-2 py-3"><Status row={row} /></td><td className="px-2 py-3"><Button type="button" size="sm" variant="ghost" onClick={() => setSelected(row)} aria-label={`Details for ${row.date}`}>Details</Button></td></tr>)}</tbody></table></div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{visible.length} dates · Page {page + 1} of {Math.max(1, Math.ceil(visible.length / pageSize))}</span><div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={!page} onClick={() => setPage(page - 1)}>Previous</Button><Button type="button" variant="outline" size="sm" disabled={(page + 1) * pageSize >= visible.length} onClick={() => setPage(page + 1)}>Next</Button><select aria-label="Dates per page" className="rounded-lg border bg-background px-2" value={pageSize} onChange={event => setPageSize(Number(event.target.value))}>{[10, 20, 50].map(size => <option key={size} value={size}>{size} per page</option>)}</select></div></div>
              </>}
              <p className="text-[11px] leading-5 text-muted-foreground md:text-xs">{summary.unresolved} unresolved dates · {summary.missingOut} missing departures.{!isMobile && ' Historical fields that were never captured remain unknown. On-time percentages use attended dates; elapsed time is not verified payable work.'}</p>
            </>)}
            {tab === 'schedule' && (plan.isPending ? <Loading /> : <><p className="text-sm text-muted-foreground">Current assignments and effective dates. Older daily details use their saved schedule, not this current configuration.</p>{plan.data && <WeeklySchedule plan={plan.data} today={today} />}<div className="space-y-3">{plan.data?.schedules.map(rule => <div key={rule.id} className="rounded-xl border border-border p-4"><div className="flex justify-between gap-3"><strong className="text-sm capitalize">{rule.kind === 'date_override' ? `Special day · ${rule.workDate}` : `${rule.scope} schedule`}</strong><Badge variant="outline">{rule.isActive ? 'Active' : 'Inactive'}</Badge></div><p className="mt-2 text-sm">{rule.weekdays?.map(day => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]).join(', ')} · {detailTime(rule.clockInBy)} – {detailTime(rule.clockOutBy)} · Grace {rule.graceMinutes} min</p><p className="mt-1 text-xs text-muted-foreground">{rule.subjectId || 'School default'} · {rule.startsOn || 'No start restriction'} to {rule.endsOn || 'Indefinite'}</p></div>)}</div>{!plan.data?.schedules.length && <p className="text-sm text-muted-foreground">No current schedule assignment.</p>}{access?.manage && <Button asChild variant="outline"><Link href="/staff-clocking/manage">Edit assigned schedule</Link></Button>}</>)}
            {['exemptions', 'requests'].includes(tab) && <>
              {tab === 'exemptions' && <div className="flex flex-wrap gap-2">{access?.exempt && <Button type="button" onClick={() => setForm({ action: 'exempt', date: anchor })}>Record exemption</Button>}{access?.own && <Button type="button" variant="outline" onClick={() => setForm({ action: 'request', kind: 'exemption', date: anchor })}>Request exemption</Button>}</div>}
              {requests.isPending ? <Loading /> : requests.error ? <ReadError error={requests.error} /> : !requests.data?.requests.length ? <p className="text-sm text-muted-foreground">No {tab === 'exemptions' ? 'exemptions' : 'requests or reviews'} for this reporting period.</p> : <RequestCards requests={requests.data.requests} actorId={user?.id || ''} profile={profile.data} saving={mutation.isPending} onReview={(request, approved) => mutation.mutate({ action: request.kind === 'explanation' ? 'review_explanation' : 'review', requestId: request.id, kind: request.kind === 'explanation' ? undefined : request.kind, approved })} onCancel={(request, reason) => mutation.mutateAsync({ action: 'cancel_exemption', requestId: request.id, reason })} />}
              {tab === 'requests' && <div className="rounded-xl bg-muted/50 p-4 text-sm"><strong>Proposed penalty reviews</strong><p className="mt-1 text-muted-foreground">No monetary penalty policy is configured in Staff Clocking. This page does not propose amounts or deduct pay. Approved lateness explanations remain separate from actual scan times.</p></div>}
              <ReadError error={mutation.error} />
            </>}
            {tab === 'audit' && access?.audit && <AuditHistory staffId={staffId} range={range} />}
          </CardContent></Card>
        </div>
        {!isMobile && <div className="contents">
        <aside className="space-y-4"><div className="hidden xl:block">{todayRow && <CurrentStatus row={todayRow} loading={current.isPending} />}</div><Card><CardHeader><CardTitle className="text-base">Arrival punctuality</CardTitle><CardDescription>Based on attended dates in this filtered period.</CardDescription></CardHeader><CardContent className="space-y-3">{(['onTime', 'grace', 'late'] as const).map(key => <div key={key}><div className="flex justify-between text-xs"><span>{key === 'onTime' ? 'On time' : key === 'grace' ? 'Within grace' : 'Late'}</span><span>{loading ? '—' : `${summary[key]} · ${summary.attended ? (summary[key] * 100 / summary.attended).toFixed(1) : '0.0'}%`}</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full', key === 'onTime' ? 'bg-emerald-500' : key === 'grace' ? 'bg-amber-500' : 'bg-rose-500')} style={{ width: `${summary.attended ? summary[key] * 100 / summary.attended : 0}%` }} /></div></div>)}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">Today&apos;s assigned schedule</CardTitle></CardHeader><CardContent>{todayRow ? <dl className="grid grid-cols-2 gap-4"><Field label="Expected arrival" value={detailTime(todayRow.expectedIn)} /><Field label="Expected departure" value={detailTime(todayRow.expectedOut)} /><Field label="Grace" value={`${todayRow.graceMinutes ?? '—'} min`} /><Field label="Rule source" value={todayRow.source} /></dl> : <Loading />}</CardContent></Card><p className="text-xs text-muted-foreground">{history.updatedAt ? `Last verified ${new Date(history.updatedAt).toLocaleString('en-UG', { timeZone: 'Africa/Kampala' })} · EAT` : 'Waiting for verified records.'}</p></aside>
        </div>}
      </div>
      {isMobile && <p className="text-[11px] text-muted-foreground">{history.updatedAt ? `Last synced ${new Date(history.updatedAt).toLocaleString('en-UG', {timeZone:'Africa/Kampala'})} · EAT` : 'Waiting for verified records.'}</p>}
      </>}
      {isMobile && <p role="status" className="text-xs text-muted-foreground">{presetMessage}</p>}
    </main>
    {selected && <DailyDetails staffId={staffId} row={rows.find(row => row.date === selected.date) || selected} profile={profile.data} onClose={() => setSelected(null)} onAction={(action, kind) => setForm({ action, kind, date: selected.date })} />}
    <ResponsiveClockingDialog open={exportOpen} onOpenChange={setExportOpen}><DialogHeader><DialogTitle>Export individual attendance</DialogTitle><DialogDescription>{person?.name} · {range.from} – {range.to}. Exports use the selected filters and exclude private review notes.</DialogDescription></DialogHeader><div className="flex flex-wrap gap-2"><Button type="button" className="min-h-11 rounded-xl" disabled={exporting} onClick={() => void exportReport('csv')}><Download className="h-4 w-4" />CSV (opens in Excel)</Button><Button type="button" className="min-h-11 rounded-xl" variant="outline" disabled={exporting} onClick={() => void exportReport('pdf')}>PDF</Button><Button type="button" className="min-h-11 rounded-xl" variant="outline" disabled={exporting} onClick={() => void exportReport('print')}><Printer className="h-4 w-4" />Print</Button></div>{exporting && <Loading />}<ReadError error={exportError} /></ResponsiveClockingDialog>
    {filterOpen && <MobileClockingFilters filters={filters} yearId={yearId} years={years.data || []} onApply={(value,year) => {setFilters(value);setTab('history');if(year !== yearId){setYearId(year);setTermKey('');}}} onClose={() => setFilterOpen(false)} />}
    {datePickerOpen && <StaffClockingPeriodPicker period={period} anchor={anchor} custom={custom} termKey={term?.key || ''} terms={eligibleTerms} today={today} onApply={value => {setAnchor(value.anchor);setCustom(value.custom);setTermKey(value.termKey);}} onClose={() => setDatePickerOpen(false)} />}
    {form && <ClockingDetailForm staffId={staffId} state={form} records={history.records} onClose={() => setForm(null)} />}
  </div>;
}

function Loading() { return <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading verified information…</p>; }
function DialogContent({ children, className, onOpenAutoFocus, ...props }: ComponentProps<typeof DesktopDialogContent>) {
  const mobile = useIsMobile();
  const sheet = useRef<HTMLDivElement>(null);
  return mobile ? <SheetContent {...props} ref={sheet} side="bottom" onOpenAutoFocus={event => {onOpenAutoFocus?.(event);if(!event.defaultPrevented){event.preventDefault();sheet.current?.focus({preventScroll:true});}}} className={cn('flex max-h-[88dvh] flex-col gap-4 overflow-y-auto overscroll-contain rounded-t-[24px] px-4 pt-5 pb-[max(1rem,env(safe-area-inset-bottom))] [&>div:first-child]:pr-12 [&>button:last-child]:right-2 [&>button:last-child]:top-2 [&>button:last-child]:flex [&>button:last-child]:h-11 [&>button:last-child]:w-11 [&>button:last-child]:items-center [&>button:last-child]:justify-center',className)}>{children}</SheetContent> : <DesktopDialogContent className={className} onOpenAutoFocus={onOpenAutoFocus} {...props}>{children}</DesktopDialogContent>;
}
function ResponsiveClockingDialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>{children}</DialogContent></Dialog>;
}
function WeeklySchedule({ plan, today }: { plan: StaffClockingDetailPlan; today: string }) {
  const week = buildStaffDetailRows(detailPeriodRange('week', today), [], plan, today);
  return <div className="space-y-2" aria-label="This week's effective schedule"><p className="text-sm font-semibold">This week&apos;s effective schedule</p>{week.map(row => <div key={row.date} className="flex flex-wrap justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs"><span>{prettyDate(row.date)}</span><span>{row.scheduled ? `${detailTime(row.expectedIn)} – ${detailTime(row.expectedOut)} · Grace ${row.graceMinutes ?? '—'} min` : detailStatusLabels[row.status]}</span></div>)}</div>;
}
function AttendanceCalendar({ rows, onSelect }: { rows: StaffClockingDetailRow[]; onSelect: (row: StaffClockingDetailRow) => void }) {
  return <div className="space-y-4" aria-label="Attendance calendar">{[...new Set(rows.map(row => row.date.slice(0, 7)))].map(month => {
    const dates = detailDates(detailPeriodRange('month', `${month}-01`));
    const padding = (new Date(`${month}-01T12:00:00Z`).getUTCDay() + 6) % 7;
    return <div key={month}><p className="mb-2 text-sm font-semibold">{month}</p><div className="grid grid-cols-7 gap-1">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day} className="py-1 text-center text-[10px] text-muted-foreground">{day}</span>)}{Array.from({length: padding}, (_, index) => <span key={`padding-${index}`} />)}{dates.map(date => {
      const row = rows.find(item => item.date === date);
      return row ? <button key={date} type="button" aria-label={`${prettyDate(date)} · ${detailStatusLabels[row.status]}`} onClick={() => onSelect(row)} className="min-h-20 min-w-0 rounded-lg border border-border p-1 text-left focus-visible:ring-2 focus-visible:ring-ring"><span className="block text-xs font-semibold">{date.slice(8)}</span><span className={cn('mt-2 block break-words text-[10px]', row.status === 'late' ? 'text-rose-600 dark:text-rose-300' : row.status === 'on_time' ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground')}>{detailStatusLabels[row.status]}</span></button> : <span key={date} className="min-h-20 p-1 text-xs text-muted-foreground/40">{date.slice(8)}</span>;
    })}</div></div>;
  })}</div>;
}
function CurrentStatus({ row, loading }: { row: StaffClockingDetailRow; loading: boolean }) {
  const [now, setNow] = useState(() => new Date());
  const arrival = row.record?.effectiveClockInTime || row.record?.clockInTime;
  const departure = row.record?.effectiveClockOutTime || row.record?.clockOutTime;
  useEffect(() => {
    if (!arrival || departure) return;
    // Advance elapsed display locally; this does not query the clocking service.
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, [arrival, departure]);
  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock3 className="h-5 w-5 text-primary" />Today&apos;s status</CardTitle></CardHeader><CardContent className="space-y-4">{loading ? <Loading /> : <><p className="text-sm font-semibold">{departure ? 'Clocked out' : arrival ? 'Clocked in' : row.status === 'exempt' ? 'Approved leave' : row.scheduled ? 'Not yet arrived' : 'Attendance not required'}</p><Status row={row} /><dl className="grid grid-cols-2 gap-4"><Field label="Clock in" value={detailTime(arrival)} /><Field label="Clock out" value={detailTime(departure)} /><Field label="Time between original scans" value={detailElapsed(row.record, now)} /><Field label="Work date" value={row.date} /></dl></>}</CardContent></Card>;
}
function MonthlyBreakdown({ rows, onSelect }: { rows: StaffClockingDetailRow[]; onSelect: (month: string) => void }) {
  const months = [...new Set(rows.map(row => row.date.slice(0, 7)))];
  return <div className="grid gap-2 sm:grid-cols-2">{months.map(month => { const totals = summarizeStaffDetail(rows.filter(row => row.date.startsWith(month))); return <button key={month} type="button" className="rounded-xl border border-border p-3 text-left focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onSelect(month)}><strong className="text-sm">{month}</strong><p className="mt-1 text-xs text-muted-foreground">On time {totals.onTime} · Grace {totals.grace} · Late {totals.late} · Exempt {totals.exempt}</p></button>; })}</div>;
}
function RequestCards({ requests, profile, actorId, saving, onReview, onCancel }: { requests: StaffClockingDetailRequest[]; profile: StaffClockingDetailProfile; actorId: string; saving: boolean; onReview: (request: StaffClockingDetailRequest, approved: boolean) => void; onCancel: (request: StaffClockingDetailRequest, reason: string) => Promise<unknown> }) {
  const [status, setStatus] = useState('all');
  const [kind, setKind] = useState('all');
  const mobile = useIsMobile();
  const [selected, setSelected] = useState<StaffClockingDetailRequest | null>(null);
  const focused = requests.find(request => request.id === selected?.id && request.kind === selected?.kind);
  const [cancel, setCancel] = useState<StaffClockingDetailRequest | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const content = (request: StaffClockingDetailRequest) => <><p className="text-sm leading-6 text-muted-foreground">{request.reason || 'Attendance exception. Detailed reasons require review permission.'}</p>{request.kind === 'exemption' && <p className="text-xs text-muted-foreground">Full-day exemption · {request.localDate}{request.endDate ? ` to ${request.endDate}` : ' · Single day'}</p>}{request.proposedClockInTime && <p className="text-xs">Proposed arrival {detailTime(request.proposedClockInTime)} · departure {detailTime(request.proposedClockOutTime)}</p>}{request.reviewedBy && <p className="text-xs text-muted-foreground">Reviewed by {request.reviewedBy.name} · {request.reviewedAt}</p>}{request.reviewNote && <p className="text-xs text-muted-foreground">{request.reviewNote}</p>}</>;
  const controls = (request: StaffClockingDetailRequest) => {
    const review = request.kind === 'exemption' ? profile.permissions.reviewExemptions : request.kind === 'correction' ? profile.permissions.reviewCorrections : profile.permissions.reviewExplanations;
    return <div className="flex flex-wrap gap-2">{review && !profile.permissions.own && request.createdBy?.id !== actorId && request.status === 'pending' && <><Button type="button" className="min-h-11 rounded-xl" disabled={saving} onClick={() => onReview(request,true)}>Approve</Button><Button type="button" className="min-h-11 rounded-xl" variant="outline" disabled={saving} onClick={() => onReview(request,false)}>Reject</Button></>}{profile.permissions.exempt && request.kind === 'exemption' && request.status === 'approved' && <Button type="button" className="min-h-11 rounded-xl" variant="outline" disabled={saving} onClick={() => {setCancel(request);setReason('');setError(null);}}>Cancel exemption</Button>}</div>;
  };
  const filtered = requests.filter(request => (status === 'all' || request.status === status) && (kind === 'all' || request.kind === kind));
  return <div className="space-y-3"><div className="grid grid-cols-2 gap-2"><select aria-label="Request approval status" className={selectClass} value={status} onChange={event => setStatus(event.target.value)}>{['all','pending','approved','rejected','cancelled'].map(value => <option key={value} value={value}>{value === 'all' ? 'All approval statuses' : value}</option>)}</select><select aria-label="Request type" className={selectClass} value={kind} onChange={event => setKind(event.target.value)}>{['all','exemption','correction','explanation'].map(value => <option key={value} value={value}>{value === 'all' ? 'All request types' : value}</option>)}</select></div>
    {!filtered.length && <p className="text-sm text-muted-foreground">No requests match these filters.</p>}
    {filtered.map(request => <article key={`${request.kind}-${request.id}`} className="space-y-3 rounded-2xl border border-border p-3.5">{mobile ? <button type="button" className="flex min-h-11 w-full items-center justify-between gap-2 text-left focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setSelected(request)}><span><span className="block text-sm font-semibold capitalize">{request.kind === 'explanation' ? 'Lateness explanation' : request.kind}</span><span className="mt-1 block text-xs text-muted-foreground">{request.localDate} · View details</span></span><Badge variant="outline" className="capitalize">{request.status}</Badge></button> : <><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-semibold capitalize">{request.kind === 'explanation' ? 'Lateness explanation' : request.kind} · {request.localDate}</p><Badge variant="outline" className="capitalize">{request.status}</Badge></div>{content(request)}{controls(request)}</>}</article>)}
    {focused && <ResponsiveClockingDialog open onOpenChange={open => {if(!open) setSelected(null);}}><DialogHeader><DialogTitle className="capitalize">{focused.kind === 'explanation' ? 'Lateness explanation' : focused.kind} details</DialogTitle><DialogDescription>{focused.localDate} · {focused.status}</DialogDescription></DialogHeader>{content(focused)}{controls(focused)}</ResponsiveClockingDialog>}
    {cancel && <ResponsiveClockingDialog open onOpenChange={open => {if(!open && !saving) setCancel(null);}}><DialogHeader><DialogTitle>Cancel exemption</DialogTitle><DialogDescription>{cancel.localDate}. Original clocking events will remain intact.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={async event => {
      event.preventDefault();
      try {await onCancel(cancel,reason);setCancel(null);setSelected(null);}
      catch(error) {setError(error instanceof Error ? error : new Error('Unable to cancel this exemption.'));}
    }}><div><Label htmlFor="cancel-exemption-reason">Reason for cancellation</Label><textarea id="cancel-exemption-reason" className="min-h-24 w-full rounded-xl border border-input bg-background p-3 text-base focus-visible:ring-2 focus-visible:ring-ring" minLength={8} maxLength={1000} required value={reason} onChange={event => setReason(event.target.value)} /></div><ReadError error={error} /><Button type="submit" disabled={saving} className="min-h-11 w-full rounded-xl">Confirm cancellation</Button></form></ResponsiveClockingDialog>}
  </div>;
}
function AuditHistory({ staffId, range }: { staffId: string; range: DetailRange }) {
  const [cursor, setCursor] = useState<string>();
  const [previous, setPrevious] = useState<StaffClockingDetailAuditPage['events']>([]);
  const audit = useStaffClockingDetail<StaffClockingDetailAuditPage>(staffId, 'audit', true, range, cursor);
  useEffect(() => { setCursor(undefined); setPrevious([]); }, [staffId, range.from, range.to, audit.revision]);
  const entries = [...previous, ...(audit.data?.events || [])];
  return <div className="space-y-3"><p className="text-xs text-muted-foreground">Immutable original scans and authorized changes. Sensitive details require audit permission.</p><ReadError error={audit.error} />{audit.isPending ? <Loading /> : !entries.length ? <p className="text-sm text-muted-foreground">No audit events in this period.</p> : entries.map(event => <article key={event.id} className="rounded-xl border border-border p-4"><p className="text-sm font-semibold">{event.type.replaceAll('_', ' ')}</p><p className="mt-1 text-xs text-muted-foreground">{event.occurredAt} · {event.actor || 'Verified staff scan'} · {event.id}</p>{event.localTime && <p className="mt-2 text-sm">Recorded time: {detailTime(event.localTime)}</p>}{event.original && <p className="mt-2 break-words text-xs">Original: {event.original}</p>}{event.effective && <p className="text-xs">Effective: {event.effective}</p>}{event.reason && <p className="mt-2 text-sm text-muted-foreground">{event.reason}</p>}</article>)}{audit.data?.nextCursor && <Button type="button" variant="outline" disabled={audit.isFetching} onClick={() => { setPrevious(entries); setCursor(audit.data?.nextCursor); }}>Load more audit events</Button>}</div>;
}
function DailyDetails({ staffId, row, profile, onClose, onAction }: { staffId: string; row: StaffClockingDetailRow; profile?: StaffClockingDetailProfile; onClose: () => void; onAction: (action: 'request' | 'exempt' | 'explain', kind?: 'exemption' | 'correction') => void }) {
  const record = row.record;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl max-sm:bottom-0 max-sm:left-0 max-sm:top-auto max-sm:w-full max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none"><DialogHeader><DialogTitle>{prettyDate(row.date)}</DialogTitle><DialogDescription>Assigned work-session date · Saved rules and verified scan times.</DialogDescription></DialogHeader><Status row={row} /><dl className="grid grid-cols-2 gap-4"><Field label="Expected arrival" value={detailTime(row.expectedIn)} /><Field label="Expected departure" value={detailTime(row.expectedOut)} /><Field label="Original arrival" value={detailTime(record?.clockInTime)} /><Field label="Original departure" value={detailTime(record?.clockOutTime)} /><Field label="Effective arrival" value={detailTime(record?.effectiveClockInTime || record?.clockInTime)} /><Field label="Effective departure" value={detailTime(record?.effectiveClockOutTime || record?.clockOutTime)} /><Field label="Saved staff group" value={row.recordedGroup || 'Not recorded'} /><Field label="Grace period" value={row.graceMinutes === undefined ? 'Not recorded' : `${row.graceMinutes} min`} /><Field label="Arrival after ETA" value={record?.secondsLate === undefined ? undefined : `${Math.floor(record.secondsLate / 60)}m ${record.secondsLate % 60}s`} /><Field label="Elapsed between scans" value={detailElapsed(record)} /></dl>{row.warning && <p className="text-xs text-muted-foreground">{row.warning}</p>}{record?.latenessExcused && <p className="text-sm">An approved explanation excuses this arrival. The recorded time is unchanged.</p>}<div className="flex flex-wrap gap-2">{profile?.permissions.request && <Button type="button" variant="outline" onClick={() => onAction('request', 'correction')}>Request correction</Button>}{profile?.permissions.exempt && <Button type="button" variant="outline" onClick={() => onAction('exempt')}>Record exemption</Button>}{profile?.permissions.explain && row.status === 'late' && <Button type="button" variant="outline" onClick={() => onAction('explain')}>Explain lateness</Button>}</div>{profile?.permissions.audit && record && <AuditHistory staffId={staffId} range={{ from: row.date, to: row.date }} />}</DialogContent></Dialog>;
}
function ClockingDetailForm({ staffId, state, records, onClose }: { staffId: string; state: { action: 'request' | 'exempt' | 'explain'; kind?: 'exemption' | 'correction'; date: string }; records: StaffClockingDailyRecord[]; onClose: () => void }) {
  const [date, setDate] = useState(state.date), [reason, setReason] = useState('');
  const original = records.find(record => record.localDate === date);
  const [arrival, setArrival] = useState(original?.effectiveClockInTime?.slice(0, 5) || original?.clockInTime?.slice(0, 5) || '');
  const [departure, setDeparture] = useState(original?.effectiveClockOutTime?.slice(0, 5) || original?.clockOutTime?.slice(0, 5) || '');
  const save = useMutateStaffClockingDetail(staffId);
  const correction = state.action === 'request' && state.kind === 'correction';
  return <Dialog open onOpenChange={open => { if (!open && !save.isPending) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{state.action === 'exempt' ? 'Record exemption' : state.action === 'explain' ? 'Explain lateness' : correction ? 'Request correction' : 'Request exemption'}</DialogTitle><DialogDescription>{correction ? 'The verified record stays unchanged until another authorized person reviews this request.' : state.action === 'explain' ? 'Submitting a reason does not change your arrival time.' : 'Single-day full-day attendance exemption. Original scan events remain intact.'}</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={event => { event.preventDefault(); save.mutate({ action: state.action, kind: state.kind, localDate: date, reason, ...(correction ? { proposedClockInTime: arrival, ...(departure ? { proposedClockOutTime: departure } : {}) } : {}) }, { onSuccess: onClose }); }}><div><Label htmlFor="individual-request-date">Work date</Label><Input id="individual-request-date" type="date" value={date} onChange={event => setDate(event.target.value)} required /></div>{correction && <><p className="text-xs text-muted-foreground">Original arrival {detailTime(original?.clockInTime)} · departure {detailTime(original?.clockOutTime)}</p><div className="grid grid-cols-2 gap-3"><div><Label htmlFor="individual-request-in">Proposed arrival</Label><Input id="individual-request-in" type="time" value={arrival} onChange={event => setArrival(event.target.value)} required /></div><div><Label htmlFor="individual-request-out">Proposed departure</Label><Input id="individual-request-out" type="time" value={departure} onChange={event => setDeparture(event.target.value)} /></div></div></>}<div><Label htmlFor="individual-request-reason">Reason</Label><textarea id="individual-request-reason" className="min-h-24 w-full rounded-xl border border-input bg-background p-3 text-sm focus-visible:ring-2 focus-visible:ring-ring" value={reason} onChange={event => setReason(event.target.value)} minLength={8} maxLength={1000} required /></div><ReadError error={save.error} /><Button type="submit" disabled={save.isPending}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Save {state.action === 'request' || state.action === 'explain' ? 'request' : 'exemption'}</Button></form></DialogContent></Dialog>;
}
