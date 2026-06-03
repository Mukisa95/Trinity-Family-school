"use client";

import { useEffect, useMemo, useState } from 'react';
import { HistoryLogRecord, HistoryLogService } from '@/lib/services/history-log.service';
import { PupilsService } from '@/lib/services/pupils.service';
import { FeeStructuresService } from '@/lib/services/fee-structures.service';
import { ClassesService } from '@/lib/services/classes.service';
import { AcademicYearsService } from '@/lib/services/academic-years.service';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

const actionLabels: Record<string, string> = {
  create: 'Added',
  update: 'Edited',
  delete: 'Deleted',
  revert: 'Reverted',
  status: 'Status Changed',
};

function formatDate(value: HistoryLogRecord['ts']) {
  if (!value) return 'Pending';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Pending';
  return date.toLocaleString();
}

function actionVariant(action: string) {
  if (action === 'delete') return 'destructive' as const;
  if (action === 'revert') return 'secondary' as const;
  return 'outline' as const;
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

  return strVal;
}

export default function HistoryLogPage() {
  const [logs, setLogs] = useState<HistoryLogRecord[]>([]);
  const [search, setSearch] = useState('');
  const [entity, setEntity] = useState('all');
  const [action, setAction] = useState('all');
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

    // Fetch lookup data in parallel to build resolution maps
    const fetchLookupData = async () => {
      try {
        const [allPupils, allFees, allClasses, allYears] = await Promise.all([
          PupilsService.getAllPupils().catch(() => []),
          FeeStructuresService.getAllFeeStructures().catch(() => []),
          ClassesService.getAll().catch(() => []),
          AcademicYearsService.getAllAcademicYears().catch(() => []),
        ]);

        const pMap: Record<string, string> = {};
        allPupils.forEach((p) => {
          pMap[p.id] = `${p.firstName} ${p.lastName}`;
        });

        const fMap: Record<string, string> = {};
        allFees.forEach((f) => {
          fMap[f.id] = f.name;
        });

        const cMap: Record<string, string> = {};
        allClasses.forEach((c) => {
          cMap[c.id] = c.name;
        });

        const yMap: Record<string, string> = {};
        const tMap: Record<string, string> = {};
        allYears.forEach((y) => {
          yMap[y.id] = y.name;
          if (y.terms) {
            y.terms.forEach((t: any) => {
              tMap[t.id] = t.name;
            });
          }
        });

        setPupilsMap(pMap);
        setFeesMap(fMap);
        setClassesMap(cMap);
        setYearsMap(yMap);
        setTermsMap(tMap);
      } catch (error) {
        console.error('Error fetching lookup data for history logs:', error);
      }
    };

    fetchLookupData();

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
  }, [action, entity, logs, search, pupilsMap, feesMap, classesMap, yearsMap, termsMap]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">History Log</h1>
        <Button
          onClick={loadLogs}
          variant="outline"
          size="icon"
          disabled={loading}
          className="h-10 w-10 rounded-full"
          aria-label="Refresh history"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by item, user, field, amount..."
          className="rounded-full md:flex-1"
        />
        <Select value={entity} onValueChange={setEntity}>
          <SelectTrigger className="rounded-full md:w-[200px]">
            <SelectValue placeholder="All modules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            {entities.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="rounded-full md:w-[200px]">
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
                  <Badge variant="outline">{log.e}</Badge>
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
  );
}
