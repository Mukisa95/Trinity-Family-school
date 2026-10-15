"use client";

import { formatPupilDisplayName } from '@/lib/utils/name-formatter';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { HistoryLogRecord, HistoryLogService, HistoryRangePage } from '@/lib/services/history-log.service';
import { FeeStructuresService } from '@/lib/services/fee-structures.service';
import { useClasses } from '@/lib/hooks/use-classes';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { usePupils } from '@/lib/hooks/use-pupils';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ArrowUpRight, CalendarDays, ChevronDown, Layers, RefreshCw } from 'lucide-react';
import { logger } from '@/lib/utils/logger';
import { groupHistoryLogs, historyDate, historyDay, historyDaySections, historyRangeBounds, HISTORY_TIME_ZONE } from '@/lib/utils/history-log-groups';
import { getHistoryLogRoute, getHistoryPupilId, historyMeta, uniquePupilNameLookup } from '@/lib/utils/history-log-navigation';
import { GlassPageTopBar, GlassActionDock, GlassActionButton, GlassPageSearchInput } from "@/components/common/glass-page-top-bar";

// Keep the calendar code out of the page's initial render path.
const HistoryCalendar = lazy(() => import('@/components/ui/calendar').then(module => ({ default: module.Calendar })));
const pickerDate = (day: string) => new Date(`${day}T12:00:00`);
const dayLabel = (day: string) => pickerDate(day).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
function HistoryDatePicker({ day, label, onSelect }: { day: string; label?: string; onSelect: (day: string) => void }) {
  const [open, setOpen] = useState(false);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button variant="outline" size="sm" className={`min-h-10 gap-2 rounded-full text-xs ${label ? 'w-full' : ''}`} aria-label={label || `Choose history date, ${dayLabel(day)}`}>
      <CalendarDays aria-hidden="true" className="h-4 w-4" />{label || dayLabel(day)}
    </Button></PopoverTrigger>
    <PopoverContent className="w-auto max-w-[calc(100vw-16px)] p-2">
      <p className="mb-2 text-xs text-muted-foreground">Choose a school date to view its history.</p>
      {open && <Suspense fallback={<p role="status" className="w-[280px] p-4 text-sm">Loading calendar...</p>}>
        <HistoryCalendar mode="single" selected={pickerDate(day)} defaultMonth={pickerDate(day)} initialFocus
          onSelect={date => { if (!date) return; const selected = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            setOpen(false); onSelect(selected); }} />
      </Suspense>}
    </PopoverContent>
  </Popover>;
}
const actorKey = (log: HistoryLogRecord) => log.uid ? `id:${log.uid}` : `name:${log.un || 'Unknown user'}`;

const actionLabels: Record<string, string> = {
  create: 'Added',
  update: 'Edited',
  delete: 'Deleted',
  revert: 'Reverted',
  status: 'Status Changed',
  approve: 'Approved',
  export: 'Exported',
  login: 'Signed In',
  permission: 'Permission Changed',
  adjust: 'Adjusted',
};

const entityLabels: Record<string, string> = {
  export: 'Sensitive Export',
  payment: 'Payment',
  pupil: 'Pupil',
  user: 'User Account',
  fee_structure: 'Fee Structure',
  requirement: 'Requirement',
  banking: 'Banking',
  bank_account: 'Bank Account',
  bank_loan: 'Bank Loan',
  bank_transaction: 'Bank Transaction',
};

function formatDate(value: HistoryLogRecord['ts']) {
  const date = historyDate(value);
  return date ? date.toLocaleString(undefined, { timeZone: HISTORY_TIME_ZONE }) : 'Pending';
}

function actionVariant(action: string) {
  if (action === 'delete') return 'destructive' as const;
  if (action === 'revert' || action === 'export' || action === 'permission') return 'secondary' as const;
  return 'outline' as const;
}

function entityLabel(entity: string) {
  return entityLabels[entity] || entity;
}

function formatMetaKey(key: string): string {
  const keys: Record<string, string> = {
    pupilId: 'Pupil Name',
    pupilID: 'Pupil Name',
    pupilName: 'Pupil Name',
    feeId: 'Fee Name',
    feeID: 'Fee Name',
    feeName: 'Fee Name',
    classId: 'Class',
    classID: 'Class',
    termId: 'Term',
    termID: 'Term',
    yearId: 'Academic Year',
    yearID: 'Academic Year',
    academicYearId: 'Academic Year',
    amount: 'Amount',
    method: 'Method',
    source: 'Source',
    notes: 'Notes',
    active: 'Status',
    admissionNo: 'Admission No',
    dataType: 'Data Type',
    recordCount: 'Records',
    format: 'Format',
    filters: 'Filters',
    sensitive: 'Sensitive',
    scope: 'Scope',
    reason: 'Reason',
    outcome: 'Outcome',
    module: 'Module',
    role: 'Role',
  };
  return keys[key] || key;
}

function formatMetaValue(
  key: string,
  value: any,
  lookups: {
    pupils: Record<string, string>;
    fees: Record<string, string>;
    classes: Record<string, string>;
    years: Record<string, string>;
    terms: Record<string, string>;
  }
): string {
  if (value === null || value === undefined) return '';
  const strVal = String(value);

  const lowerKey = key.toLowerCase();
  if (lowerKey === 'pupilid' && lookups.pupils[strVal]) {
    return lookups.pupils[strVal];
  }
  if (lowerKey === 'feeid' && lookups.fees[strVal]) {
    return lookups.fees[strVal];
  }
  if (lowerKey === 'classid' && lookups.classes[strVal]) {
    return lookups.classes[strVal];
  }
  if (lowerKey === 'yearid' || lowerKey === 'academicyearid') {
    if (lookups.years[strVal]) return lookups.years[strVal];
  }
  if (lowerKey === 'termid' && lookups.terms[strVal]) {
    return lookups.terms[strVal];
  }

  // Format amount as money if key is 'amount'
  if (lowerKey === 'amount' && !Number.isNaN(Number(strVal))) {
    return `UGX ${Number(strVal).toLocaleString()}`;
  }

  // Format boolean status
  if (lowerKey === 'active') {
    return strVal === 'true' ? 'Active' : 'Inactive';
  }
  if (lowerKey === 'sensitive') {
    return strVal === 'true' ? 'Yes' : 'No';
  }

  return strVal;
}

function isSensitiveLog(log: HistoryLogRecord) {
  return log.a === 'export' || log.a === 'permission' || log.m?.sensitive === true || log.m?.sensitive === 'true';
}

function isSecurityLog(log: HistoryLogRecord) {
  return log.a === 'permission' || log.e === 'user' || log.m?.module === 'security';
}

type HistoryLookups = Parameters<typeof formatMetaValue>[2];

function recordLabel(log: HistoryLogRecord, lookups: HistoryLookups) {
  const label = log.rl || log.rid;
  if (log.e === 'pupil') return lookups.pupils[label] || label;
  if (log.e === 'fee_structure') return lookups.fees[label] || label;
  return label;
}

function HistoryEntryCard({ log, lookups, names }: {
  log: HistoryLogRecord; lookups: HistoryLookups; names: Map<string, string | null>;
}) {
  const href = getHistoryLogRoute(log, names);
  const content = <Card data-history-entry={log.id} className={href ? 'transition-colors hover:border-primary/40 hover:bg-muted/30' : ''}>
    <CardContent className="space-y-1.5 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={actionVariant(log.a)}>{actionLabels[log.a] || log.a}</Badge>
        <Badge variant="outline">{entityLabel(log.e)}</Badge>
        {isSensitiveLog(log) && <Badge variant="secondary">Sensitive</Badge>}
        <span className="min-w-0 break-words text-sm font-medium">{recordLabel(log, lookups)}</span>
        {href && <ArrowUpRight aria-hidden="true" className="ml-auto h-3.5 w-3.5 shrink-0 text-primary" />}
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <p className="min-w-0 break-words">{log.un || 'Unknown user'}{log.ur ? ` | ${log.ur}` : ''} | {formatDate(log.ts)}</p>
        <span className="min-w-0 break-all text-[11px]">Record ID: {log.rid}</span>
      </div>
      {!!log.cf?.length && <p className="break-words text-xs text-muted-foreground">Fields: {log.cf.join(', ')}</p>}
      {log.m && Object.keys(log.m).length > 0 && <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {Object.entries(log.m).map(([key, value]) => <span key={key} className="min-w-0 break-words">
          <span className="font-semibold text-foreground">{formatMetaKey(key)}:</span>{' '}{formatMetaValue(key, value, lookups)}
        </span>)}
      </div>}
    </CardContent>
  </Card>;
  return href ? <Link href={href} prefetch={false} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    aria-label={`Open ${entityLabel(log.e)} action page for ${recordLabel(log, lookups)}`} title="Open action page">{content}</Link> : content;
}

export default function HistoryLogPage() {
  const { data: classes = [] } = useClasses();
  const { data: academicYears = [] } = useAcademicYears();
  const { data: pupils = [] } = usePupils();
  const [logs, setLogs] = useState<HistoryLogRecord[]>([]);
  const [search, setSearch] = useState('');
  const [entity, setEntity] = useState('all');
  const [action, setAction] = useState('all');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [pupilFilter, setPupilFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [range, setRange] = useState<{ from: string; to: string }>();
  const [rangePage, setRangePage] = useState<HistoryRangePage>();
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeError, setRangeError] = useState('');
  const rangeRequest = useRef(0);
  const [jumpDay, setJumpDay] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());

  // Lookup maps to resolve database IDs to actual display names
  const [feesMap, setFeesMap] = useState<Record<string, string>>({});
  const pupilsMap = useMemo(() => Object.fromEntries(pupils.map(pupil => [pupil.id, formatPupilDisplayName(pupil).trim()])), [pupils]);
  const classesMap = useMemo(() => Object.fromEntries(classes.map(item => [item.id, item.name])), [classes]);
  const yearsMap = useMemo(() => Object.fromEntries(academicYears.map(year => [year.id, year.name])), [academicYears]);
  const termsMap = useMemo(() => Object.fromEntries(academicYears.flatMap(year => (year.terms || []).map(term => [term.id, term.name]))), [academicYears]);
  const pupilNames = useMemo(() => uniquePupilNameLookup(pupilsMap), [pupilsMap]);
  const lookups = { pupils: pupilsMap, fees: feesMap, classes: classesMap, years: yearsMap, terms: termsMap };

  const loadRange = async (from: string, to: string, more = false) => {
    const request = ++rangeRequest.current;
    setRangeError('');
    try { historyRangeBounds(from, to); } catch (error) {
      setRangeLoading(false); setRangeError(error instanceof Error ? error.message : 'Choose a valid date range.'); return;
    }
    setRangeLoading(true);
    try {
      const page = await HistoryLogService.getRangePage(from, to, more ? rangePage?.cursor : undefined);
      if (request !== rangeRequest.current) return;
      setRangePage(current => ({ ...page, logs: more ? [...(current?.logs || []), ...page.logs].filter((log, index, all) => all.findIndex(item => item.id === log.id) === index) : page.logs }));
      setRange({ from, to }); setFromDate(from); setToDate(to);
      if (!more) setJumpDay(from);
    } catch (error) {
      if (request === rangeRequest.current) {
        logger.error('Error fetching selected history dates', error);
        setRangeError('Could not load the selected dates. Your current entries are still shown. Try again when connected.');
      }
    } finally { if (request === rangeRequest.current) setRangeLoading(false); }
  };
  const showRecent = () => {
    ++rangeRequest.current; setRange(undefined); setRangePage(undefined); setRangeError('');
    setRangeLoading(false); setFromDate(''); setToDate(''); setJumpDay('');
  };
  const loadLogs = async () => {
    if (range) { await loadRange(range.from, range.to); return; }
    setLoading(true); setRangeError('');
    try { setLogs(await HistoryLogService.getRecent(300)); }
    catch (error) { logger.error('Error refreshing history', error); setRangeError('Could not refresh history. Your current entries are still shown.'); }
    finally { setLoading(false); }
  };
  const selectDay = (day: string) => { void loadRange(day, day); };

  useEffect(() => {
    const unsubscribe = HistoryLogService.subscribeRecent((data) => {
      setLogs(data);
      setLoading(false);
    }, 300);

    const fetchFeeLookupData = async () => {
      try {
        const allFees = await FeeStructuresService.getAllFeeStructures().catch(() => []);

        const fMap: Record<string, string> = {};
        allFees.forEach((f) => {
          fMap[f.id] = f.name;
        });

        setFeesMap(fMap);
      } catch (error) {
        logger.error('Error fetching lookup data for history logs', error);
      }
    };

    void fetchFeeLookupData();

    return () => {
      unsubscribe();
      ++rangeRequest.current;
    };
  }, []);

  // Recent records remain live; historical reads occur only after an explicit date request.
  const visibleLogs = useMemo(() => {
    if (!range || !rangePage) return logs;
    const records = new Map(rangePage.logs.map(log => [log.id, log]));
    logs.forEach(log => { const day = historyDay(log.ts); if (day && day >= range.from && day <= range.to) records.set(log.id, log); });
    return [...records.values()].sort((a, b) => (historyDate(b.ts)?.getTime() || 0) - (historyDate(a.ts)?.getTime() || 0));
  }, [logs, range, rangePage]);
  const optionLogs = useMemo(() => [...logs, ...(rangePage?.logs || [])], [logs, rangePage]);
  const users = useMemo(() => [...new Map(optionLogs.map(log => [actorKey(log), log.un || log.uid || 'Unknown user'])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [optionLogs]);
  const roles = useMemo(() => [...new Set(optionLogs.map(log => log.ur).filter((role): role is string => !!role))].sort(), [optionLogs]);
  const pupilClasses = useMemo(() => Object.fromEntries(pupils.map(pupil => [pupil.id, pupil.classId])), [pupils]);
  const filterPupils = useMemo(() => [...new Set(optionLogs.map(log => getHistoryPupilId(log, pupilNames)).filter((id): id is string => !!id))].sort((a, b) => (pupilsMap[a] || a).localeCompare(pupilsMap[b] || b)), [optionLogs, pupilNames, pupilsMap]);
  const entities = useMemo(() => {
    return Array.from(new Set(optionLogs.map(log => log.e).filter(Boolean))).sort();
  }, [optionLogs]);

  const filteredLogs = useMemo(() => {
    const searchValue = search.trim().toLowerCase();
    return visibleLogs.filter((log) => {
      const pupilId = getHistoryPupilId(log, pupilNames);
      if (pupilFilter !== 'all' && pupilId !== pupilFilter) return false;
      if (userFilter !== 'all' && actorKey(log) !== userFilter) return false;
      if (roleFilter !== 'all' && log.ur !== roleFilter) return false;
      // A recorded class wins; legacy records fall back to the pupil's current class.
      if (classFilter !== 'all' && (historyMeta(log, 'classId') || (pupilId ? pupilClasses[pupilId] : undefined) || (log.e === 'class' ? log.rid : undefined)) !== classFilter) return false;
      if (entity !== 'all' && log.e !== entity) return false;
      if (action !== 'all' && log.a !== action) return false;
      if (category === 'sensitive' && !isSensitiveLog(log)) return false;
      if (category === 'security' && !isSecurityLog(log)) return false;
      if (category === 'exports' && log.a !== 'export') return false;
      if (category === 'reversals' && log.a !== 'revert') return false;
      if (!searchValue) return true;

      // Translate record label if it's an ID
      const lowerEntity = log.e?.toLowerCase() || '';
      let resolvedLabel = log.rl || '';
      if (lowerEntity === 'pupil' && pupilsMap[resolvedLabel]) {
        resolvedLabel = pupilsMap[resolvedLabel];
      } else if (lowerEntity === 'fee_structure' && feesMap[resolvedLabel]) {
        resolvedLabel = feesMap[resolvedLabel];
      }

      // Resolve metadata values
      const resolvedMetaValues = Object.entries(log.m || {}).map(([key, value]) => {
        return formatMetaValue(key, value, {
          pupils: pupilsMap,
          fees: feesMap,
          classes: classesMap,
          years: yearsMap,
          terms: termsMap,
        });
      });

      const haystack = [
        resolvedLabel,
        log.e,
        log.a,
        log.rid,
        log.un,
        ...(log.cf || []),
        ...resolvedMetaValues,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(searchValue);
    });
  }, [action, category, entity, visibleLogs, search, pupilFilter, userFilter, classFilter, roleFilter, pupilNames, pupilClasses, pupilsMap, feesMap, classesMap, yearsMap, termsMap]);

  const groups = useMemo(() => groupHistoryLogs(filteredLogs, pupilNames), [filteredLogs, pupilNames]);

  const sections = useMemo(() => historyDaySections(groups), [groups]);
  useEffect(() => {
    if (!jumpDay) return;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(`history-day-${jumpDay}`);
      if (target) {
        target.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        target.focus({ preventScroll: true });
      }
      setJumpDay('');
    });
    return () => cancelAnimationFrame(frame);
  }, [jumpDay, sections]);

  return (
    <div className="min-h-screen pb-12">
      <GlassPageTopBar
        title="History Log"
        subtitle="Central activity trail for edits, reversals, approvals, permission changes, and sensitive exports."
        backHref="/dashboard"
        backLabel="Dashboard"
        actionsLeading={
          <div className="flex items-center gap-2">
            <GlassPageSearchInput
              placeholder="Search by item, user, field, amount..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              containerClassName="w-[180px] sm:w-[240px] lg:w-[320px]"
            />
          </div>
        }
        actions={
          <GlassActionDock>
            <GlassActionButton
              label="Refresh"
              icon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
              tone="slate"
              onClick={loadLogs}
              disabled={loading || rangeLoading}
              title="Refresh history logs"
            />
          </GlassActionDock>
        }
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 space-y-3">

      <div className="grid grid-cols-2 gap-2 items-center md:grid-cols-3 lg:grid-cols-4 bg-white/40 backdrop-blur-md p-3 rounded-2xl border border-gray-150 shadow-sm dark:bg-slate-900/40">
        <Select value={entity} onValueChange={setEntity}>
          <SelectTrigger aria-label="Module" className="text-xs rounded-full bg-white/80 min-w-0 w-full dark:bg-slate-900/80">
            <SelectValue>{entity === 'all' ? 'All modules' : entityLabel(entity)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            {entities.map((item) => (
              <SelectItem key={item} value={item}>
                {entityLabel(item)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger aria-label="Category" className="text-xs rounded-full bg-white/80 min-w-0 w-full dark:bg-slate-900/80">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="sensitive">Sensitive actions</SelectItem>
            <SelectItem value="security">Security/users</SelectItem>
            <SelectItem value="exports">Exports only</SelectItem>
            <SelectItem value="reversals">Reversals only</SelectItem>
          </SelectContent>
        </Select>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger aria-label="Action" className="text-xs rounded-full bg-white/80 min-w-0 w-full dark:bg-slate-900/80">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {Object.entries(actionLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
          <HistoryDatePicker day={range?.from || sections.find(section => section.day !== 'pending')?.day || historyDay(new Date())!} label="Jump to date" onSelect={selectDay} />
        <details className="col-span-full rounded-xl border bg-background/40 px-3">
          <summary className="flex min-h-10 cursor-pointer items-center gap-2 text-xs font-medium">More filters <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />{[pupilFilter, userFilter, classFilter, roleFilter].filter(value => value !== 'all').length > 0 && <Badge variant="secondary">{[pupilFilter, userFilter, classFilter, roleFilter].filter(value => value !== 'all').length} applied</Badge>}</summary>
          <div className="grid grid-cols-2 gap-2 pb-3 md:grid-cols-3 lg:grid-cols-4">
        <Select value={pupilFilter} onValueChange={setPupilFilter}>
          <SelectTrigger aria-label="Pupil" className="text-xs min-w-0 w-full rounded-full"><SelectValue>{pupilFilter === 'all' ? 'All pupils' : pupilsMap[pupilFilter] || 'Selected pupil'}</SelectValue></SelectTrigger>
          <SelectContent><SelectItem value="all">All pupils</SelectItem>{filterPupils.map(id => <SelectItem key={id} value={id}>{pupilsMap[id] || id}{classesMap[pupilClasses[id]] ? ` | ${classesMap[pupilClasses[id]]}` : ''}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger aria-label="User" className="text-xs min-w-0 w-full rounded-full"><SelectValue>{userFilter === 'all' ? 'All users' : users.find(([id]) => id === userFilter)?.[1] || 'Selected user'}</SelectValue></SelectTrigger>
          <SelectContent><SelectItem value="all">All users</SelectItem>{users.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger aria-label="Class" className="text-xs min-w-0 w-full rounded-full"><SelectValue placeholder="All classes" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All classes</SelectItem>{classes.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger aria-label="User role" className="text-xs min-w-0 w-full rounded-full"><SelectValue>{roleFilter === 'all' ? 'All roles' : roleFilter}</SelectValue></SelectTrigger>
          <SelectContent><SelectItem value="all">All roles</SelectItem>{roles.map(role => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent>
        </Select>
            <div className="col-span-full flex flex-wrap items-end gap-2 border-t pt-2">
          <label className="min-w-0 text-xs text-muted-foreground">From date<input aria-label="From date" type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} className="mt-1 block h-10 max-w-full rounded-lg border bg-background px-2 text-sm text-foreground" /></label>
          <label className="min-w-0 text-xs text-muted-foreground">To date<input aria-label="To date" type="date" value={toDate} onChange={event => setToDate(event.target.value)} className="mt-1 block h-10 max-w-full rounded-lg border bg-background px-2 text-sm text-foreground" /></label>
          <Button variant="outline" size="sm" className="min-h-10" disabled={rangeLoading || !fromDate || !toDate} onClick={() => void loadRange(fromDate, toDate)}>Apply dates</Button>
            </div>
          </div>
        </details>
        <div className="col-span-full flex flex-wrap gap-2">
          {range && <Button variant="ghost" size="sm" className="min-h-10" onClick={showRecent}>Latest 300</Button>}
          <Button variant="ghost" size="sm" className="min-h-10" onClick={() => { setSearch(''); setEntity('all'); setAction('all'); setCategory('all'); setPupilFilter('all'); setUserFilter('all'); setClassFilter('all'); setRoleFilter('all'); showRecent(); }}>Clear filters</Button>
        </div>
        <p className="col-span-full w-full text-xs text-muted-foreground">{range ? `${dayLabel(range.from)}${range.from === range.to ? '' : ` to ${dayLabel(range.to)}`} (school time)` : 'Latest 300 entries. Past dates load only when requested.'} Class filters use the recorded class when available; older entries may use the pupil's current class.</p>
      </div>

      <p className="text-xs text-muted-foreground" role="status">{rangeLoading ? 'Loading selected dates...' : loading ? 'Loading history\u2026' : `${filteredLogs.length} action${filteredLogs.length === 1 ? '' : 's'} in ${groups.length} card${groups.length === 1 ? '' : 's'}`}</p>
      {rangeError && <p role="alert" className="text-sm text-destructive">{rangeError}</p>}
      <div className="space-y-4">
        {sections.map(section => <section key={section.day} data-history-day={section.day} aria-labelledby={`history-day-${section.day}`} className="space-y-2">
          <h2 id={`history-day-${section.day}`} tabIndex={-1} className="flex scroll-mt-36 items-center gap-3 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span aria-hidden="true" className="h-px min-w-2 flex-1 bg-border" />
            {section.day === 'pending' ? <span className="text-xs font-semibold text-muted-foreground">Pending date</span> : <HistoryDatePicker day={section.day} onSelect={selectDay} />}
            <span aria-hidden="true" className="h-px min-w-2 flex-1 bg-border" />
          </h2>
        {section.groups.map(group => {
          if (group.logs.length === 1) return <HistoryEntryCard key={group.key} log={group.logs[0]} lookups={lookups} names={pupilNames} />;
          const expanded = expandedGroups.has(group.key);
          const controlsId = `history-stack-${encodeURIComponent(group.key)}`;
          const first = group.logs[0];
          const pupilName = pupilsMap[group.pupilId || ''] || group.logs.map(log => historyMeta(log, 'pupilName')
            || (log.e === 'pupil' ? log.rl : undefined)).find(Boolean) || group.pupilId || 'Pupil';
          const day = historyDate(first.ts)?.toLocaleDateString(undefined, { timeZone: HISTORY_TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric' }) || 'Pending';
          return <Card key={group.key} data-history-stack={group.key} className="overflow-hidden">
            <button type="button" aria-expanded={expanded} aria-controls={controlsId}
              aria-label={`${expanded ? 'Collapse' : 'Expand'} ${group.logs.length} actions for ${pupilName} on ${day}`}
              onClick={() => setExpandedGroups(current => {
                const next = new Set(current);
                if (next.has(group.key)) next.delete(group.key); else next.add(group.key);
                return next;
              })}
              className="flex min-h-11 w-full items-center gap-2.5 p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
              <Layers aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm font-semibold">{pupilName}</span>
                <span className="block break-words text-xs text-muted-foreground">{day}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <Badge variant="secondary">{group.logs.length} actions</Badge>
                {group.logs.some(isSensitiveLog) && <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400">Sensitive</span>}
              </span>
              <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} />
            </button>
            {expanded && <div id={controlsId} role="group" aria-label={`${pupilName} activities on ${day}`}
              className="space-y-2 border-t bg-muted/20 p-2 sm:p-3">
              {group.logs.map(log => <HistoryEntryCard key={log.id} log={log} lookups={lookups} names={pupilNames} />)}
            </div>}
          </Card>;
        })}
        </section>)}
        {rangePage?.fromCache && range && <p role="status" className="text-xs text-muted-foreground">Showing saved history for these dates. Connect and refresh to check the complete history.</p>}
        {rangePage?.hasMore && range && <Button variant="outline" disabled={rangeLoading} onClick={() => void loadRange(range.from, range.to, true)}>Load more for these dates</Button>}

        {!loading && !rangeLoading && filteredLogs.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              {range ? 'No loaded entries match these dates and filters.' : 'No history entries match the current filters.'}
            </CardContent>
          </Card>
        )}
      </div>
      </div>
    </div>
  );
}
