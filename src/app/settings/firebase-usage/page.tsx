"use client";

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Boxes, Database, FileStack, HardDrive, Loader2, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/contexts/auth-context';
import { auth } from '@/lib/firebase';

type UsageStats = {
  checkedAt: string;
  windowHours: number;
  firestore: {
    collections: Array<{ name: string; documents: number }>;
    totalDocuments: number;
    dataAndIndexBytes: number | null;
    dataAndIndexMeasuredAt: string | null;
  };
  storage: { bytes: number | null; objects: number | null; measuredAt: string | null };
  operations: { reads: number | null; writes: number | null; deletes: number | null; measuredAt: string | null };
  monitoring: { available: boolean; message?: string };
  servedFromCache: boolean;
};

function formatNumber(value: number | null) {
  return value === null ? 'Unavailable' : new Intl.NumberFormat().format(value);
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

export default function FirebaseUsagePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUsage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Wait for Firebase Auth to finish initialising before requesting the token.
      // auth.currentUser can be null for a short window after page load even when
      // the user is already signed in, which causes a false "session not ready" error.
      const token = await new Promise<string | null>((resolve) => {
        const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
          unsubscribe();
          if (!firebaseUser) { resolve(null); return; }
          try { resolve(await firebaseUser.getIdToken()); }
          catch { resolve(null); }
        });
      });
      if (!token) throw new Error('Your Firebase session is not ready. Please refresh and try again.');

      const response = await fetch('/api/firebase/stats', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to load Firebase usage.');
      setStats(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load Firebase usage.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'Admin') loadUsage();
    else setLoading(false);
  }, [loadUsage, user?.role]);

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
        description="Live project resource usage from Google Cloud Monitoring. Firestore operations cover the last 24 hours."
        actions={
          <Button onClick={loadUsage} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh usage
          </Button>
        }
      />

      {error && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="flex gap-3 p-5 text-sm text-amber-950">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Usage data is not connected yet</p>
              <p className="mt-1 text-amber-800">{error}</p>
              <p className="mt-2 text-amber-800">Add the FIREBASE_ADMIN_* variables to the server and grant its service account the Cloud Datastore Viewer and Monitoring Viewer roles. The data is never fetched by the browser directly.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <UsageCard icon={Database} label="Firestore data & indexes" value={formatBytes(stats?.firestore.dataAndIndexBytes ?? null)} detail={stats ? `Measured ${formatDate(stats.firestore.dataAndIndexMeasuredAt)}` : 'Loading latest measurement…'} tone="blue" loading={loading} />
        <UsageCard icon={HardDrive} label="Firebase Storage" value={formatBytes(stats?.storage.bytes ?? null)} detail={stats ? `${formatNumber(stats.storage.objects)} files · measured ${formatDate(stats.storage.measuredAt)}` : 'Loading latest measurement…'} tone="violet" loading={loading} />
        <UsageCard icon={FileStack} label="Top-level Firestore documents" value={formatNumber(stats?.firestore.totalDocuments ?? null)} detail={stats ? `${stats.firestore.collections.length} top-level collections` : 'Counting current documents…'} tone="emerald" loading={loading} />
        <UsageCard icon={Boxes} label="Firestore reads" value={formatNumber(stats?.operations.reads ?? null)} detail={stats ? `Successful reads in the last ${stats.windowHours} hours` : 'Loading the last 24 hours…'} tone="amber" loading={loading} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="border-b bg-slate-50/80">
            <CardTitle className="text-lg">Firestore operations</CardTitle>
            <CardDescription>Successful document operations recorded during the last {stats?.windowHours || 24} hours.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
            <OperationCard icon={TrendingDown} label="Reads" value={stats?.operations.reads ?? null} className="text-blue-700" />
            <OperationCard icon={TrendingUp} label="Writes" value={stats?.operations.writes ?? null} className="text-emerald-700" />
            <OperationCard icon={FileStack} label="Deletes" value={stats?.operations.deletes ?? null} className="text-rose-700" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b bg-slate-50/80">
            <CardTitle className="text-lg">Data source</CardTitle>
            <CardDescription>How current the numbers are.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-5 text-sm">
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Cloud Monitoring</span><Badge variant={stats?.monitoring.available ? 'default' : 'secondary'}>{stats?.monitoring.available ? 'Connected' : 'Not connected'}</Badge></div>
            {stats?.monitoring.message && (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                {stats.monitoring.message}
              </p>
            )}
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Page checked</span><span className="text-right font-medium">{stats ? formatDate(stats.checkedAt) : '—'}</span></div>
            <p className="rounded-md bg-muted p-3 text-xs leading-relaxed text-muted-foreground">Storage is reported by Google Cloud as a daily measurement and may lag. Firestore operation counts are operational metrics; final billed totals can differ slightly due to billing rules such as index-entry reads.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b bg-slate-50/80">
          <CardTitle className="text-lg">Database collections</CardTitle>
          <CardDescription>Current exact document counts, sorted from largest to smallest.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !stats ? <div className="p-6 text-sm text-muted-foreground">Loading collection counts…</div> : (
            <div className="divide-y">
              {stats?.firestore.collections.map(collection => (
                <div key={collection.name} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="font-medium">{collection.name}</span>
                  <span className="font-semibold tabular-nums">{formatNumber(collection.documents)}</span>
                </div>
              ))}
              {!stats?.firestore.collections.length && <div className="p-6 text-sm text-muted-foreground">No Firestore collections were found.</div>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UsageCard({ icon: Icon, label, value, detail, tone, loading }: { icon: typeof Database; label: string; value: string; detail: string; tone: 'blue' | 'violet' | 'emerald' | 'amber'; loading: boolean }) {
  const colors = { blue: 'bg-blue-100 text-blue-700', violet: 'bg-violet-100 text-violet-700', emerald: 'bg-emerald-100 text-emerald-700', amber: 'bg-amber-100 text-amber-700' };
  return <Card><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">{loading && value === 'Unavailable' ? '…' : value}</p></div><div className={`rounded-lg p-2.5 ${colors[tone]}`}><Icon className="h-5 w-5" /></div></div><p className="mt-3 text-xs leading-relaxed text-muted-foreground">{detail}</p></CardContent></Card>;
}

function OperationCard({ icon: Icon, label, value, className }: { icon: typeof Database; label: string; value: number | null; className: string }) {
  return <div className="rounded-lg border bg-card p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className={`h-4 w-4 ${className}`} />{label}</div><p className="mt-2 text-2xl font-bold tabular-nums">{formatNumber(value)}</p></div>;
}
