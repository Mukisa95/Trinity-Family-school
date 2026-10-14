"use client";

import { formatPupilDisplayName } from '@/lib/utils/name-formatter';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { HistoryLogRecord, HistoryLogService } from '@/lib/services/history-log.service';
import { FeeStructuresService } from '@/lib/services/fee-structures.service';
import { useClasses } from '@/lib/hooks/use-classes';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { usePupils } from '@/lib/hooks/use-pupils';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowUpRight, ChevronDown, Download, Layers, RefreshCw, ShieldCheck, Undo2 } from 'lucide-react';
import { logger } from '@/lib/utils/logger';
import { groupHistoryLogs, historyDate, HISTORY_TIME_ZONE } from '@/lib/utils/history-log-groups';
import { getHistoryLogRoute, historyMeta, uniquePupilNameLookup } from '@/lib/utils/history-log-navigation';
import { GlassPageTopBar, GlassActionDock, GlassActionButton, GlassPageSearchInput } from "@/components/common/glass-page-top-bar";

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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());

  // Lookup maps to resolve database IDs to actual display names
  const [feesMap, setFeesMap] = useState<Record<string, string>>({});
  const pupilsMap = useMemo(() => Object.fromEntries(pupils.map(pupil => [pupil.id, formatPupilDisplayName(pupil).trim()])), [pupils]);
  const classesMap = useMemo(() => Object.fromEntries(classes.map(item => [item.id, item.name])), [classes]);
  const yearsMap = useMemo(() => Object.fromEntries(academicYears.map(year => [year.id, year.name])), [academicYears]);
  const termsMap = useMemo(() => Object.fromEntries(academicYears.flatMap(year => (year.terms || []).map(term => [term.id, term.name]))), [academicYears]);
  const pupilNames = useMemo(() => uniquePupilNameLookup(pupilsMap), [pupilsMap]);
  const lookups = { pupils: pupilsMap, fees: feesMap, classes: classesMap, years: yearsMap, terms: termsMap };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await HistoryLogService.getRecent(300);
      setLogs(data);
    } finally {
      setLoading(false);
    }
  };

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
    };
  }, []);

  const entities = useMemo(() => {
    return Array.from(new Set(logs.map(log => log.e).filter(Boolean))).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const searchValue = search.trim().toLowerCase();
    return logs.filter((log) => {
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
  }, [action, category, entity, logs, search, pupilsMap, feesMap, classesMap, yearsMap, termsMap]);

  const groups = useMemo(() => groupHistoryLogs(filteredLogs, pupilNames), [filteredLogs, pupilNames]);

  const logStats = useMemo(() => {
    return {
      total: logs.length,
      sensitive: logs.filter(isSensitiveLog).length,
      exports: logs.filter(log => log.a === 'export').length,
      reversals: logs.filter(log => log.a === 'revert').length,
    };
  }, [logs]);

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
              disabled={loading}
              title="Refresh history logs"
            />
          </GlassActionDock>
        }
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 space-y-3">

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between p-3">
            <div>
              <p className="whitespace-nowrap text-xs text-muted-foreground">Recent entries</p>
              <p className="text-xl font-semibold">{logStats.total}</p>
            </div>
            <RefreshCw className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-3">
            <div>
              <p className="whitespace-nowrap text-xs text-muted-foreground">Sensitive</p>
              <p className="text-xl font-semibold">{logStats.sensitive}</p>
            </div>
            <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-3">
            <div>
              <p className="whitespace-nowrap text-xs text-muted-foreground">Exports</p>
              <p className="text-xl font-semibold">{logStats.exports}</p>
            </div>
            <Download className="h-5 w-5 text-brand-ink-600 dark:text-brand-ink-400" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-3">
            <div>
              <p className="whitespace-nowrap text-xs text-muted-foreground">Reversals</p>
              <p className="text-xl font-semibold">{logStats.reversals}</p>
            </div>
            <Undo2 className="h-5 w-5 text-red-600 dark:text-red-400" />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 items-center bg-white/40 backdrop-blur-md p-3 rounded-2xl border border-gray-150 shadow-sm dark:bg-slate-900/40">
        <Select value={entity} onValueChange={setEntity}>
          <SelectTrigger className="rounded-full bg-white/80 w-full sm:w-[180px] dark:bg-slate-900/80">
            <SelectValue placeholder="All modules" />
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
          <SelectTrigger className="rounded-full bg-white/80 w-full sm:w-[180px] dark:bg-slate-900/80">
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
          <SelectTrigger className="rounded-full bg-white/80 w-full sm:w-[180px] dark:bg-slate-900/80">
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
      </div>

      <p className="text-xs text-muted-foreground" role="status">{loading ? 'Loading history\u2026' : `${filteredLogs.length} action${filteredLogs.length === 1 ? '' : 's'} in ${groups.length} card${groups.length === 1 ? '' : 's'}`}</p>
      <div className="space-y-2">
        {groups.map(group => {
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

        {!loading && filteredLogs.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No history entries match the current filters.
            </CardContent>
          </Card>
        )}
      </div>
      </div>
    </div>
  );
}
