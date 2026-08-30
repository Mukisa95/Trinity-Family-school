"use client";

import { useEffect, useMemo, useState } from 'react';
import { HistoryLogRecord, HistoryLogService } from '@/lib/services/history-log.service';
import { FeeStructuresService } from '@/lib/services/fee-structures.service';
import { useClasses } from '@/lib/hooks/use-classes';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { usePupils } from '@/lib/hooks/use-pupils';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, ShieldCheck, Undo2 } from 'lucide-react';
import { logger } from '@/lib/utils/logger';
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
};

function formatDate(value: HistoryLogRecord['ts']) {
  if (!value) return 'Pending';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Pending';
  return date.toLocaleString();
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

  // Lookup maps to resolve database IDs to actual display names
  const [pupilsMap, setPupilsMap] = useState<Record<string, string>>({});
  const [feesMap, setFeesMap] = useState<Record<string, string>>({});
  const [classesMap, setClassesMap] = useState<Record<string, string>>({});
  const [yearsMap, setYearsMap] = useState<Record<string, string>>({});
  const [termsMap, setTermsMap] = useState<Record<string, string>>({});

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

  useEffect(() => {
    setPupilsMap(Object.fromEntries(
      pupils.map(pupil => [pupil.id, `${pupil.firstName} ${pupil.lastName}`.trim()]),
    ));
  }, [pupils]);

  useEffect(() => {
    setClassesMap(Object.fromEntries(classes.map(classItem => [classItem.id, classItem.name])));
  }, [classes]);

  useEffect(() => {
    const years: Record<string, string> = {};
    const terms: Record<string, string> = {};
    academicYears.forEach(year => {
      years[year.id] = year.name;
      year.terms?.forEach(term => {
        terms[term.id] = term.name;
      });
    });
    setYearsMap(years);
    setTermsMap(terms);
  }, [academicYears]);

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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Recent entries</p>
              <p className="text-2xl font-semibold">{logStats.total}</p>
            </div>
            <RefreshCw className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Sensitive</p>
              <p className="text-2xl font-semibold">{logStats.sensitive}</p>
            </div>
            <ShieldCheck className="h-5 w-5 text-amber-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Exports</p>
              <p className="text-2xl font-semibold">{logStats.exports}</p>
            </div>
            <Download className="h-5 w-5 text-blue-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-muted-foreground">Reversals</p>
              <p className="text-2xl font-semibold">{logStats.reversals}</p>
            </div>
            <Undo2 className="h-5 w-5 text-red-600" />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3 items-center bg-white/40 backdrop-blur-md p-4 rounded-2xl border border-gray-150 shadow-sm">
        <Select value={entity} onValueChange={setEntity}>
          <SelectTrigger className="rounded-full bg-white/80 w-full sm:w-[200px]">
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
          <SelectTrigger className="rounded-full bg-white/80 w-full sm:w-[200px]">
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
          <SelectTrigger className="rounded-full bg-white/80 w-full sm:w-[200px]">
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

      <div className="grid gap-3">
        {filteredLogs.map((log) => (
          <Card key={log.id}>
            <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={actionVariant(log.a)}>{actionLabels[log.a] || log.a}</Badge>
                  <Badge variant="outline">{entityLabel(log.e)}</Badge>
                  {isSensitiveLog(log) && <Badge variant="secondary">Sensitive</Badge>}
                  <span className="text-sm font-medium">
                    {(() => {
                      const lowerEntity = log.e?.toLowerCase() || '';
                      if (lowerEntity === 'pupil' && pupilsMap[log.rl || '']) {
                        return pupilsMap[log.rl || ''];
                      }
                      if (lowerEntity === 'fee_structure' && feesMap[log.rl || '']) {
                        return feesMap[log.rl || ''];
                      }
                      return log.rl || log.rid;
                    })()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {log.un || 'Unknown user'}{log.ur ? ` | ${log.ur}` : ''} | {formatDate(log.ts)}
                </p>
                {log.cf && log.cf.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Fields: {log.cf.join(', ')}
                  </p>
                )}
                {log.m && Object.keys(log.m).length > 0 && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                    {Object.entries(log.m).map(([key, value]) => {
                      const displayKey = formatMetaKey(key);
                      const displayValue = formatMetaValue(key, value, {
                        pupils: pupilsMap,
                        fees: feesMap,
                        classes: classesMap,
                        years: yearsMap,
                        terms: termsMap,
                      });
                      
                      return (
                        <span key={key} className="inline-flex items-center gap-1">
                          <span className="font-semibold text-foreground">{displayKey}:</span>
                          <span>{displayValue}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Record ID: {log.rid}
              </div>
            </CardContent>
          </Card>
        ))}

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
