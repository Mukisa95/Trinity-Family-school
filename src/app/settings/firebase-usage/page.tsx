"use client";

import { useCallback, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CalendarRange,
  Coins,
  Database,
  FileStack,
  HardDrive,
  Info,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/contexts/auth-context';
import { auth } from '@/lib/firebase';

type UsageRangePreset = '24h' | '7d' | '30d' | '90d' | 'custom';
type RefreshSection = 'collections' | 'operations' | 'storage' | 'billing';

type UsageStats = {
  checkedAt: string;
  refreshed: RefreshSection[];
  range: { preset: UsageRangePreset; startTime: string; endTime: string; bucketSeconds: number };
  firestore: {
    collections: Array<{
      name: string;
      documents: number;
      estimatedDocumentBytes: number | null;
      sampledDocuments: number;
    }>;
    totalDocuments: number;
    collectionStatsMeasuredAt: string;
    collectionCountReads: number;
    collectionSampleReads: number;
    collectionStatsServedFromCache: boolean;
    dataAndIndexBytes: number | null;
    dataAndIndexMeasuredAt: string | null;
    freeStorageAllowanceBytes: number;
    freeStorageRemainingBytes: number | null;
    freeStorageOverageBytes: number | null;
  };
  storage: { bytes: number | null; objects: number | null; measuredAt: string | null };
  operations: {
    reads: number | null;
    writes: number | null;
    deletes: number | null;
    measuredAt: string | null;
    trend: Array<{ timestamp: string; reads: number; writes: number; deletes: number }>;
  };
  billing: {
    configured: boolean;
    available: boolean;
    currency: string | null;
    grossCost: number | null;
    credits: number | null;
    netCost: number | null;
    bytesProcessed: number | null;
    cacheHit: boolean;
    daily: Array<{ date: string; cost: number }>;
    services: Array<{ name: string; cost: number }>;
    message?: string;
  };
  monitoring: { ran: boolean; available: boolean; message?: string };
  servedFromCache: boolean;
};

const RANGE_LABELS: Record<UsageRangePreset, string> = {
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  custom: 'Custom dates',
};

const REFRESH_CHOICES: Array<{
  id: RefreshSection;
  title: string;
  description: string;
  cost: string;
}> = [
  {
    id: 'collections',
    title: 'Collection counts & sizes',
    description: 'Counts every top-level collection and samples documents to estimate its data size.',
    cost: '1 admin read + aggregate count reads + up to 250 sample reads when the 6-hour cache is cold · 0 writes',
  },
  {
    id: 'operations',
    title: 'Reads, writes & deletes',
    description: 'Loads operation totals and the trend chart for the selected date range.',
    cost: 'Cloud Monitoring only · 0 additional Firestore reads or writes',
  },
  {
    id: 'storage',
    title: 'Storage totals',
    description: 'Loads Firestore data plus indexes, remaining included space, and Firebase Storage usage.',
    cost: 'Cloud Monitoring only · 0 additional Firestore reads or writes',
  },
  {
    id: 'billing',
    title: 'Exact expenditure',
    description: 'Loads gross cost, credits, net expenditure, and the highest-cost services.',
    cost: 'BigQuery only · maximum 100 MiB scanned · 0 additional Firestore reads or writes',
  },
];

function mergeUsageStats(current: UsageStats | null, incoming: UsageStats) {
  if (!current) return incoming;
  const refreshed = new Set(incoming.refreshed);
  return {
    ...current,
    checkedAt: incoming.checkedAt,
    range: incoming.range,
    refreshed: incoming.refreshed,
    servedFromCache: incoming.servedFromCache,
    monitoring: incoming.monitoring,
    firestore: {
      ...current.firestore,
      ...(refreshed.has('collections') ? {
        collections: incoming.firestore.collections,
        totalDocuments: incoming.firestore.totalDocuments,
        collectionStatsMeasuredAt: incoming.firestore.collectionStatsMeasuredAt,
        collectionCountReads: incoming.firestore.collectionCountReads,
        collectionSampleReads: incoming.firestore.collectionSampleReads,
        collectionStatsServedFromCache: incoming.firestore.collectionStatsServedFromCache,
      } : {}),
      ...(refreshed.has('storage') ? {
        dataAndIndexBytes: incoming.firestore.dataAndIndexBytes,
        dataAndIndexMeasuredAt: incoming.firestore.dataAndIndexMeasuredAt,
        freeStorageAllowanceBytes: incoming.firestore.freeStorageAllowanceBytes,
        freeStorageRemainingBytes: incoming.firestore.freeStorageRemainingBytes,
        freeStorageOverageBytes: incoming.firestore.freeStorageOverageBytes,
      } : {}),
    },
    storage: refreshed.has('storage') ? incoming.storage : current.storage,
    operations: refreshed.has('operations') ? incoming.operations : current.operations,
    billing: refreshed.has('billing') ? incoming.billing : current.billing,
  };
}

function formatNumber(value: number | null) {
  return value === null ? 'Unavailable' : new Intl.NumberFormat().format(Math.round(value));
}

function formatBytes(value: number | null) {
  if (value === null) return 'Unavailable';
  if (value === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

function formatDate(value: string | null) {
  if (!value) return 'No measurement yet';
  return new Date(value).toLocaleString();
}

function formatCurrency(value: number | null, currency: string | null) {
  if (value === null || !currency) return 'Unavailable';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: Math.abs(value) < 1 ? 4 : 2,
    maximumFractionDigits: Math.abs(value) < 1 ? 4 : 2,
  }).format(value);
}

function toDateInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export default function FirebaseUsagePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rangePreset, setRangePreset] = useState<UsageRangePreset>('24h');
  const [customStart, setCustomStart] = useState(() => toDateInputValue(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
  const [customEnd, setCustomEnd] = useState(() => toDateInputValue(new Date()));
  const [loadedFilterKeys, setLoadedFilterKeys] = useState<Partial<Record<'operations' | 'billing', string>>>({});
  const [refreshSelection, setRefreshSelection] = useState<Record<RefreshSection, boolean>>({
    collections: false,
    operations: true,
    storage: true,
    billing: true,
  });
  const [loadedSections, setLoadedSections] = useState<Set<RefreshSection>>(() => new Set());

  const filterKey = `${rangePreset}:${customStart}:${customEnd}`;
  const operationsCurrent = loadedSections.has('operations') && loadedFilterKeys.operations === filterKey;
  const billingCurrent = loadedSections.has('billing') && loadedFilterKeys.billing === filterKey;
  const filtersChanged = Boolean(
    stats && (
      (loadedSections.has('operations') && !operationsCurrent)
      || (loadedSections.has('billing') && !billingCurrent)
    ),
  );
  const selectedSections = REFRESH_CHOICES.filter(choice => refreshSelection[choice.id]).map(choice => choice.id);

  const loadUsage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const firebaseUser = auth.currentUser;
      const token = firebaseUser ? await firebaseUser.getIdToken() : null;
      if (!token) throw new Error('Your Firebase session is not ready. Please sign in again and retry.');

      const search = new URLSearchParams({ range: rangePreset });
      if (!selectedSections.length) throw new Error('Select at least one item to refresh.');
      search.set('include', selectedSections.join(','));
      if (rangePreset === 'custom') {
        if (!customStart || !customEnd) throw new Error('Choose both custom dates before refreshing.');
        const start = new Date(`${customStart}T00:00:00`);
        const end = new Date(`${customEnd}T23:59:59.999`);
        if (start >= end) throw new Error('The custom end date must be after the start date.');
        search.set('start', start.toISOString());
        search.set('end', end.toISOString());
      }

      const response = await fetch(`/api/firebase/stats?${search}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to load Firebase usage.');
      setStats(current => mergeUsageStats(current, payload as UsageStats));
      setLoadedSections(current => new Set([...current, ...selectedSections]));
      setLoadedFilterKeys(current => ({
        ...current,
        ...(selectedSections.includes('operations') ? { operations: filterKey } : {}),
        ...(selectedSections.includes('billing') ? { billing: filterKey } : {}),
      }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load Firebase usage.');
    } finally {
      setLoading(false);
    }
  }, [customEnd, customStart, filterKey, rangePreset, selectedSections]);

  const toggleRefreshSection = (section: RefreshSection, checked: boolean) => {
    setRefreshSelection(current => ({ ...current, [section]: checked }));
  };

  const storagePercent = useMemo(() => {
    if (!stats || stats.firestore.dataAndIndexBytes === null) return 0;
    return Math.min(100, (stats.firestore.dataAndIndexBytes / stats.firestore.freeStorageAllowanceBytes) * 100);
  }, [stats]);

  const rangeDescription = stats
    ? `${formatDate(stats.range.startTime)} – ${formatDate(stats.range.endTime)}`
    : RANGE_LABELS[rangePreset];
  const firestoreReadsThisRefresh = stats
    ? 1 + (
      stats.refreshed.includes('collections')
      && !stats.servedFromCache
      && !stats.firestore.collectionStatsServedFromCache
        ? stats.firestore.collectionCountReads + stats.firestore.collectionSampleReads
        : 0
    )
    : 0;

  if (user && user.role !== 'Admin') {
    return (
      <div className="mx-auto max-w-3xl py-8">
        <PageHeader title="Firebase Usage" description="Resource usage is restricted to system administrators." />
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="flex gap-3 p-6 text-amber-900">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>You do not have permission to view project resource usage.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Firebase Usage"
        description="Manual, administrator-only usage and expenditure reporting. Nothing refreshes in the background."
      />

      <Card className="border-blue-100 bg-gradient-to-r from-blue-50/80 to-white">
        <CardContent className="p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                <span className="flex items-center gap-2"><CalendarRange className="h-4 w-4 text-blue-700" />Date range</span>
                <Select value={rangePreset} onValueChange={value => setRangePreset(value as UsageRangePreset)}>
                  <SelectTrigger className="h-11 bg-white" aria-label="Usage date range"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24h">Last 24 hours</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                    <SelectItem value="custom">Custom dates</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              {rangePreset === 'custom' && (
                <>
                  <label className="space-y-1.5 text-sm font-medium text-slate-700">
                    <span>Start date</span>
                    <Input type="date" value={customStart} max={customEnd} onChange={event => setCustomStart(event.target.value)} className="h-11 bg-white" />
                  </label>
                  <label className="space-y-1.5 text-sm font-medium text-slate-700">
                    <span>End date</span>
                    <Input type="date" value={customEnd} min={customStart} max={toDateInputValue(new Date())} onChange={event => setCustomEnd(event.target.value)} className="h-11 bg-white" />
                  </label>
                </>
              )}
            </div>
            <div className="space-y-2">
              <Button onClick={loadUsage} disabled={loading || selectedSections.length === 0} className="h-11 w-full gap-2 px-5 lg:w-auto">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {stats ? `Refresh selected (${selectedSections.length})` : `Load selected (${selectedSections.length})`}
              </Button>
              <p className="text-center text-xs text-slate-500 lg:text-right">Every request includes 1 admin-check read · 0 writes</p>
            </div>
          </div>
          <fieldset className="mt-5 border-t border-blue-100 pt-4">
            <legend className="px-1 text-sm font-semibold text-slate-800">Choose exactly what to refresh</legend>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {REFRESH_CHOICES.map(choice => {
                const checked = refreshSelection[choice.id];
                return (
                  <label key={choice.id} className={`flex cursor-pointer gap-3 rounded-lg border p-3.5 transition-colors ${checked ? 'border-blue-300 bg-white shadow-sm' : 'border-slate-200 bg-slate-50/70'}`}>
                    <Checkbox
                      checked={checked}
                      onCheckedChange={value => toggleRefreshSection(choice.id, value === true)}
                      aria-label={`Refresh ${choice.title}`}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-900">{choice.title}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-slate-600">{choice.description}</span>
                      <span className={`mt-2 block text-[11px] font-medium leading-relaxed ${choice.id === 'collections' ? 'text-amber-700' : 'text-emerald-700'}`}>{choice.cost}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {!selectedSections.length && <p className="mt-3 text-xs font-medium text-rose-700">Select at least one item before loading.</p>}
          </fieldset>
          {filtersChanged && (
            <p className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
              Filters changed. Press <strong>Refresh usage</strong> to apply them; the displayed data has not changed yet.
            </p>
          )}
        </CardContent>
      </Card>

      {error && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="flex gap-3 p-5 text-sm text-amber-950">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div><p className="font-semibold">Usage data could not be refreshed</p><p className="mt-1 text-amber-800">{error}</p></div>
          </CardContent>
        </Card>
      )}

      {!stats && !loading && !error && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center px-6 py-12 text-center">
            <BarChart3 className="h-10 w-10 text-blue-700" />
            <h2 className="mt-4 text-lg font-semibold">Choose a range, then load usage</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              This page never fetches usage automatically. Loading data requires one deliberate press of the button above.
            </p>
          </CardContent>
        </Card>
      )}

      {stats && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{rangeDescription}</Badge>
            <span>Checked {formatDate(stats.checkedAt)}</span>
            {stats.servedFromCache && <Badge variant="secondary">Server cache</Badge>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <UsageCard icon={Database} label="Firestore data & indexes" value={loadedSections.has('storage') ? formatBytes(stats.firestore.dataAndIndexBytes) : 'Not loaded'} detail={loadedSections.has('storage') ? `Measured ${formatDate(stats.firestore.dataAndIndexMeasuredAt)}` : 'Select Storage totals to load'} tone="blue" />
            <UsageCard icon={HardDrive} label="Free storage remaining" value={loadedSections.has('storage') ? formatBytes(stats.firestore.freeStorageRemainingBytes) : 'Not loaded'} detail={loadedSections.has('storage') ? `${storagePercent.toFixed(1)}% of the included 1 GiB used` : 'Select Storage totals to load'} tone={stats.firestore.freeStorageOverageBytes ? 'rose' : 'emerald'} progress={loadedSections.has('storage') ? storagePercent : undefined} />
            <UsageCard icon={Coins} label="Exact expenditure" value={billingCurrent ? formatCurrency(stats.billing.netCost, stats.billing.currency) : 'Not loaded'} detail={billingCurrent ? (stats.billing.available ? `${formatBytes(stats.billing.bytesProcessed)} queried${stats.billing.cacheHit ? ' · BigQuery cache' : ''}` : 'Cloud Billing export not connected') : loadedSections.has('billing') ? 'Refresh Exact expenditure for this date range' : 'Select Exact expenditure to load'} tone="amber" />
            <UsageCard icon={FileStack} label="Firestore documents" value={loadedSections.has('collections') ? formatNumber(stats.firestore.totalDocuments) : 'Not loaded'} detail={loadedSections.has('collections') ? `${stats.firestore.collections.length} top-level collections` : 'Select Collection counts & sizes to load'} tone="emerald" />
            <UsageCard icon={HardDrive} label="Firebase Storage" value={loadedSections.has('storage') ? formatBytes(stats.storage.bytes) : 'Not loaded'} detail={loadedSections.has('storage') ? `${formatNumber(stats.storage.objects)} files` : 'Select Storage totals to load'} tone="violet" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.75fr)]">
            <Card>
              <CardHeader className="border-b bg-slate-50/80">
                <CardTitle className="text-lg">Firestore operations</CardTitle>
                <CardDescription>Reads, writes, and deletes for the selected range.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 p-4 sm:p-5">
                {!operationsCurrent ? (
                  <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{loadedSections.has('operations') ? 'Refresh Reads, writes & deletes for this date range.' : 'Select Reads, writes & deletes and press refresh to load this section.'}</p>
                ) : <><div className="grid gap-3 sm:grid-cols-3">
                  <OperationCard icon={TrendingDown} label="Reads" value={stats.operations.reads} className="text-blue-700" />
                  <OperationCard icon={TrendingUp} label="Writes" value={stats.operations.writes} className="text-emerald-700" />
                  <OperationCard icon={FileStack} label="Deletes" value={stats.operations.deletes} className="text-rose-700" />
                </div>
                {stats.operations.trend.length > 0 ? (
                  <div className="h-72 w-full" aria-label="Firestore operations trend chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.operations.trend} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="timestamp" tickFormatter={value => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} minTickGap={28} tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={value => new Intl.NumberFormat(undefined, { notation: 'compact' }).format(value)} tick={{ fontSize: 11 }} />
                        <Tooltip labelFormatter={value => formatDate(String(value))} formatter={(value, name) => [formatNumber(Number(value)), String(name)]} />
                        <Legend />
                        <Line type="monotone" dataKey="reads" name="Reads" stroke="#2563eb" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="writes" name="Writes" stroke="#059669" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="deletes" name="Deletes" stroke="#e11d48" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="rounded-md bg-muted p-4 text-sm text-muted-foreground">No operation points were reported for this range.</p>}</>}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader className="border-b bg-slate-50/80"><CardTitle className="text-lg">Expenditure</CardTitle><CardDescription>Actual Cloud Billing export values after credits.</CardDescription></CardHeader>
                <CardContent className="space-y-3 p-5 text-sm">
                  {!billingCurrent ? (
                    <div className="rounded-md border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">{loadedSections.has('billing') ? 'Refresh Exact expenditure for this date range.' : 'Select Exact expenditure and press refresh to load this section.'}</div>
                  ) : stats.billing.available ? (
                    <>
                      <MetricRow label="Gross cost" value={formatCurrency(stats.billing.grossCost, stats.billing.currency)} />
                      <MetricRow label="Credits" value={formatCurrency(stats.billing.credits, stats.billing.currency)} />
                      <MetricRow label="Net expenditure" value={formatCurrency(stats.billing.netCost, stats.billing.currency)} strong />
                      {stats.billing.services.slice(0, 5).map(service => <MetricRow key={service.name} label={service.name} value={formatCurrency(service.cost, stats.billing.currency)} />)}
                    </>
                  ) : (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">{stats.billing.message}</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b bg-slate-50/80"><CardTitle className="text-lg">Data safeguards</CardTitle><CardDescription>How this refresh stayed controlled.</CardDescription></CardHeader>
                <CardContent className="space-y-3 p-5 text-sm">
                  <MetricRow label="Cloud Monitoring" value={!stats.monitoring.ran ? 'Not run' : stats.monitoring.available ? 'Connected' : 'Partial'} />
                  <MetricRow label="Selected this refresh" value={stats.refreshed.join(', ') || 'None'} />
                  <MetricRow label="Firestore reads this refresh" value={formatNumber(firestoreReadsThisRefresh)} />
                  <MetricRow label="Count-query reads if cold" value={stats.refreshed.includes('collections') ? formatNumber(stats.firestore.collectionCountReads) : 'Not run'} />
                  <MetricRow label="Sample reads if cold" value={stats.refreshed.includes('collections') ? formatNumber(stats.firestore.collectionSampleReads) : 'Not run'} />
                  <MetricRow label="Collection cache" value={stats.refreshed.includes('collections') ? (stats.firestore.collectionStatsServedFromCache || stats.servedFromCache ? 'Reused' : 'Refreshed') : 'Not run'} />
                  <MetricRow label="BigQuery scan" value={loadedSections.has('billing') && stats.billing.available ? formatBytes(stats.billing.bytesProcessed) : 'Not run'} />
                  {stats.monitoring.message && <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">{stats.monitoring.message}</p>}
                </CardContent>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader className="border-b bg-slate-50/80">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div><CardTitle className="text-lg">Database collections</CardTitle><CardDescription>Exact document counts with sampled document-data size estimates. Index bytes remain included only in the database total above.</CardDescription></div>
                <Badge variant="outline" className="w-fit">Maximum 250 sample reads</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="hidden grid-cols-[minmax(0,1fr)_120px_150px_120px] gap-4 border-b bg-slate-50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid">
                <span>Collection</span><span className="text-right">Documents</span><span className="text-right">Estimated data</span><span className="text-right">Sampled</span>
              </div>
              <div className="divide-y">
                {!loadedSections.has('collections') ? (
                  <div className="p-6 text-sm text-muted-foreground">Select Collection counts & sizes and press refresh to load this table.</div>
                ) : stats.firestore.collections.map(collection => (
                  <div key={collection.name} className="grid gap-2 px-5 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_120px_150px_120px] sm:items-center sm:gap-4">
                    <span className="break-all font-medium">{collection.name}</span>
                    <div className="flex justify-between gap-3 sm:block sm:text-right"><span className="text-muted-foreground sm:hidden">Documents</span><span className="font-semibold tabular-nums">{formatNumber(collection.documents)}</span></div>
                    <div className="flex justify-between gap-3 sm:block sm:text-right"><span className="text-muted-foreground sm:hidden">Estimated data</span><span className="font-semibold tabular-nums">{formatBytes(collection.estimatedDocumentBytes)}</span></div>
                    <div className="flex justify-between gap-3 sm:block sm:text-right"><span className="text-muted-foreground sm:hidden">Sampled</span><span className="tabular-nums text-muted-foreground">{collection.sampledDocuments} docs</span></div>
                  </div>
                ))}
                {loadedSections.has('collections') && !stats.firestore.collections.length && <div className="p-6 text-sm text-muted-foreground">No Firestore collections were found.</div>}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2 rounded-lg border bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
            <p>Collection sizes are estimates derived from at most five sampled documents per collection and exclude index entries. Expenditure comes from Cloud Billing export and can lag behind current activity. Nothing on this page refreshes until you press the button.</p>
          </div>
        </>
      )}
    </div>
  );
}

function UsageCard({ icon: Icon, label, value, detail, tone, progress }: {
  icon: typeof Database;
  label: string;
  value: string;
  detail: string;
  tone: 'blue' | 'violet' | 'emerald' | 'amber' | 'rose';
  progress?: number;
}) {
  const colors = {
    blue: 'bg-blue-100 text-blue-700',
    violet: 'bg-violet-100 text-violet-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    rose: 'bg-rose-100 text-rose-700',
  };
  return (
    <Card><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium text-muted-foreground">{label}</p><p className="mt-2 truncate text-2xl font-bold tracking-tight tabular-nums">{value}</p></div><div className={`shrink-0 rounded-lg p-2.5 ${colors[tone]}`}><Icon className="h-5 w-5" /></div></div>{progress !== undefined && <Progress value={progress} className="mt-3 h-2" />}<p className="mt-3 text-xs leading-relaxed text-muted-foreground">{detail}</p></CardContent></Card>
  );
}

function OperationCard({ icon: Icon, label, value, className }: { icon: typeof Database; label: string; value: number | null; className: string }) {
  return <div className="rounded-lg border bg-card p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className={`h-4 w-4 ${className}`} />{label}</div><p className="mt-2 text-2xl font-bold tabular-nums">{formatNumber(value)}</p></div>;
}

function MetricRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="flex items-start justify-between gap-4 border-b pb-2 last:border-0 last:pb-0"><span className="text-muted-foreground">{label}</span><span className={`text-right tabular-nums ${strong ? 'font-bold text-foreground' : 'font-medium'}`}>{value}</span></div>;
}
