"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/common/page-header";

interface SyncLogEntry {
  id: string;
  type: string;
  status: string;
  source?: string;
  paymentType?: string;
  receiptNumber?: string;
  pupilId?: string;
  studentPaymentCode?: string;
  sourceChannelTransactionId?: string;
  errorMessage?: string;
  timestamp: string;
}

interface SyncResponse {
  success: boolean;
  syncedDates?: string[];
  totals?: {
    processed: number;
    duplicates: number;
    skipped: number;
    failed: number;
  };
  error?: string;
}

function formatTimestamp(ts: string) {
  try {
    return new Date(ts).toLocaleString("en-UG", {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: "Africa/Kampala",
    });
  } catch {
    return ts;
  }
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function LogRow({ entry }: { entry: SyncLogEntry }) {
  const isSuccess = entry.status === "success" || entry.status === "duplicate";

  return (
    <div
      className={`border rounded-xl px-4 py-3 flex items-start gap-3 ${
        isSuccess ? "border-emerald-200 bg-emerald-50/50" : "border-red-200 bg-red-50/50"
      }`}
    >
      <div className={isSuccess ? "text-emerald-600" : "text-red-600"}>
        {isSuccess ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-gray-900">
            {entry.receiptNumber || "No receipt"}
          </span>
          {entry.paymentType && (
            <Badge variant="outline" className="text-xs">
              {entry.paymentType}
            </Badge>
          )}
          {entry.source && (
            <Badge variant="secondary" className="text-xs">
              {entry.source}
            </Badge>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {entry.studentPaymentCode || entry.pupilId || "No pupil reference"}
          {entry.sourceChannelTransactionId ? ` · ${entry.sourceChannelTransactionId}` : ""}
        </p>
        {entry.errorMessage && (
          <p className="text-xs text-red-700 mt-1 break-words">{entry.errorMessage}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-gray-500">{timeAgo(entry.timestamp)}</p>
        <p className="text-xs text-gray-400 hidden sm:block">{formatTimestamp(entry.timestamp)}</p>
      </div>
    </div>
  );
}

export default function SchoolPayMonitorPage() {
  const router = useRouter();
  const { toast } = useToast();

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [syncDate, setSyncDate] = useState(today);
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [runningSync, setRunningSync] = useState(false);
  const [lastSync, setLastSync] = useState<SyncResponse | null>(null);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const response = await fetch("/api/schoolpay/logs?limit=50");
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Failed to load logs");
      setLogs(data.logs || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not load SchoolPay logs",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoadingLogs(false);
    }
  }, [toast]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleRunSync = async () => {
    setRunningSync(true);
    setLastSync(null);
    try {
      const response = await fetch(`/api/cron/schoolpay-sync?date=${syncDate}`);
      const data = (await response.json()) as SyncResponse;
      setLastSync(data);

      if (!response.ok || !data.success) {
        throw new Error(data.error || "SchoolPay sync failed");
      }

      toast({
        title: "SchoolPay sync complete",
        description: `Processed ${data.totals?.processed || 0} payment(s) for ${syncDate}.`,
      });
      loadLogs();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "SchoolPay sync failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setRunningSync(false);
    }
  };

  const stats = {
    total: logs.length,
    success: logs.filter((entry) => entry.status === "success").length,
    failed: logs.filter((entry) => entry.status === "failed").length,
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="rounded-full flex items-center gap-2">
          <ArrowLeft size={16} />
          Back
        </Button>
        <PageHeader
          title="SchoolPay Monitor"
          description="Run manual reconciliation and review SchoolPay processing logs"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-6 text-center"><p className="text-xs text-gray-500">Total Logs</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-xs text-emerald-600">Successful</p><p className="text-2xl font-bold text-emerald-700">{stats.success}</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-xs text-red-600">Failed</p><p className="text-2xl font-bold text-red-700">{stats.failed}</p></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px,1fr]">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-violet-600" />
              Manual Sync
            </CardTitle>
            <CardDescription>
              Calls the SchoolPay Sync API through <code className="text-xs bg-black/10 px-1 rounded">/api/cron/schoolpay-sync</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="syncDate">Sync date</Label>
              <Input id="syncDate" type="date" value={syncDate} onChange={(e) => setSyncDate(e.target.value)} />
            </div>

            <Button
              onClick={handleRunSync}
              disabled={runningSync}
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
            >
              {runningSync ? <><Loader2 size={16} className="animate-spin mr-2" />Running…</> : "Run SchoolPay Sync"}
            </Button>

            {lastSync && (
              <div className={`rounded-xl border p-3 text-sm ${lastSync.success ? "border-emerald-200 bg-emerald-50/60" : "border-red-200 bg-red-50/60"}`}>
                <p className="font-semibold mb-2">{lastSync.success ? "Last sync succeeded" : "Last sync failed"}</p>
                {lastSync.totals && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span>Processed: {lastSync.totals.processed}</span>
                    <span>Duplicates: {lastSync.totals.duplicates}</span>
                    <span>Skipped: {lastSync.totals.skipped}</span>
                    <span>Failed: {lastSync.totals.failed}</span>
                  </div>
                )}
                {lastSync.error && <p className="text-red-700 text-xs mt-2">{lastSync.error}</p>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Processing Logs</CardTitle>
              <CardDescription>Newest SchoolPay events first</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadLogs} disabled={loadingLogs}>
              {loadingLogs ? <Loader2 size={14} className="animate-spin mr-2" /> : <RefreshCw size={14} className="mr-2" />}
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {logs.length === 0 && !loadingLogs ? (
              <div className="text-center py-12 text-sm text-gray-500">No SchoolPay logs recorded yet.</div>
            ) : (
              logs.map((entry) => <LogRow key={entry.id} entry={entry} />)
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
