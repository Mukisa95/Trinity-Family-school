'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Download, FileWarning, Gauge, MessageSquarePlus, RefreshCw, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { GlassActionButton, GlassActionDock, GlassPageTopBar } from '@/components/common/glass-page-top-bar';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/contexts/auth-context';
import {
  OperationalAuditService,
  type OperationalAuditKind,
  type OperationalAuditRecord,
  type OperationalAuditSeverity,
} from '@/lib/services/operational-audit.service';
import { HistoryLogService } from '@/lib/services/history-log.service';
import {
  buildOperationalAuditMarkdown,
  flattenOperationalRecords,
} from '@/lib/operational-audit/core';

function localDateInputValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function displayTimestamp(date: Date) {
  return date.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit',
  });
}

function durationLabel(totalMs?: number, count?: number, maxMs?: number) {
  if (typeof maxMs !== 'number') return '—';
  const average = totalMs && count ? Math.round(totalMs / count) : Math.round(maxMs);
  return `${average.toLocaleString()} ms avg · ${Math.round(maxMs).toLocaleString()} ms max`;
}

function severityVariant(severity: OperationalAuditSeverity) {
  if (severity === 'error') return 'destructive' as const;
  if (severity === 'warning') return 'secondary' as const;
  return 'outline' as const;
}

const kindLabels: Record<OperationalAuditKind, string> = {
  performance: 'Performance',
  error: 'Error',
  network: 'Network',
  coordination: 'Coordination',
  activity: 'Usage',
};

export default function SystemAuditPage() {
  const { user, canPerformAction } = useAuth();
  const { toast } = useToast();
  const [day, setDay] = useState(localDateInputValue);
  const [records, setRecords] = useState<OperationalAuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [limitReached, setLimitReached] = useState(false);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<'all' | OperationalAuditKind>('all');
  const [severity, setSeverity] = useState<'all' | OperationalAuditSeverity>('all');
  const [observationCategory, setObservationCategory] = useState('coordination');
  const [observationSeverity, setObservationSeverity] = useState<OperationalAuditSeverity>('warning');
  const [observation, setObservation] = useState('');
  const [savingObservation, setSavingObservation] = useState(false);

  const canExport = user?.role === 'Admin' || canPerformAction('account', 'history_log', 'export_history');
  const canRecordObservation = user?.role === 'Admin';

  const loadAudit = useCallback(async () => {
    setLoading(true);
    try {
      const result = await OperationalAuditService.getForDay(day);
      setRecords(result.records);
      setLimitReached(result.limitReached);
    } catch (error) {
      toast({
        title: 'Could not load the system audit',
        description: error instanceof Error ? error.message : 'Try again when the connection is stable.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [day, toast]);

  useEffect(() => { void loadAudit(); }, [loadAudit]);

  const events = useMemo(() => flattenOperationalRecords(records), [records]);
  const filteredEvents = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return events.filter(event => {
      if (kind !== 'all' && event.kind !== kind) return false;
      if (severity !== 'all' && event.severity !== severity) return false;
      if (!needle) return true;
      return [event.name, event.route, event.source, event.message, event.code, event.actorName, event.actorRole]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [events, kind, search, severity]);

  const stats = useMemo(() => {
    const occurrenceCount = events.reduce((sum, event) => sum + Math.max(1, event.count), 0);
    return {
      occurrences: occurrenceCount,
      errors: events.filter(event => event.severity === 'error').reduce((sum, event) => sum + event.count, 0),
      slow: events.filter(event => (event.maxMs || 0) >= 2000).reduce((sum, event) => sum + event.count, 0),
      users: new Set(events.map(event => `${event.actorName}|${event.actorRole}`)).size,
    };
  }, [events]);

  const downloadMarkdown = async () => {
    if (!canExport) return;
    const markdown = buildOperationalAuditMarkdown(records, day, limitReached);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `trinity-operational-audit-${day}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    void HistoryLogService.logExport({
      dataType: 'operational_audit',
      label: `Operational audit for ${day}`,
      recordCount: events.length,
      format: 'md',
      scope: day,
      sensitive: true,
    });
  };

  const saveObservation = async () => {
    const message = observation.trim();
    if (!canRecordObservation || message.length < 5) return;
    setSavingObservation(true);
    try {
      await OperationalAuditService.recordObservation({
        actor: {
          id: user?.id,
          username: user?.username || `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
          role: user?.role,
        },
        category: observationCategory,
        severity: observationSeverity,
        message,
      });
      setObservation('');
      toast({ title: 'Observation recorded', description: 'It is now included in the selected day’s operational audit.' });
      if (day === localDateInputValue()) await loadAudit();
    } catch (error) {
      toast({
        title: 'Observation was not recorded',
        description: error instanceof Error ? error.message : 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingObservation(false);
    }
  };

  return (
    <div className="min-h-screen pb-12">
      <GlassPageTopBar
        title="System Audit"
        subtitle="Runtime performance, failures, connectivity and coordination observations."
        backHref="/history-log"
        backLabel="History Log"
        actions={
          <GlassActionDock>
            <GlassActionButton
              label="Refresh"
              icon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
              tone="slate"
              onClick={() => void loadAudit()}
              disabled={loading}
            />
            <GlassActionButton
              label="Download MD"
              icon={<Download className="h-4 w-4" />}
              tone="blue"
              onClick={() => void downloadMarkdown()}
              disabled={!canExport || loading}
              title={canExport ? 'Download the selected day as Markdown' : 'You do not have export permission'}
            />
          </GlassActionDock>
        }
      />

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <Card className="border-blue-100 bg-blue-50/60">
          <CardContent className="p-4 text-sm text-blue-950">
            Automated entries show where to investigate. They do not prove misconduct or identify a root cause by themselves. The collector does not read or attach form values, pupil records, credentials, query values or stack traces, and it masks dynamic route segments.
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Occurrences', value: stats.occurrences, icon: Activity, color: 'text-blue-600' },
            { label: 'Errors', value: stats.errors, icon: FileWarning, color: 'text-red-600' },
            { label: 'Slow operations', value: stats.slow, icon: Gauge, color: 'text-amber-600' },
            { label: 'Observed users', value: stats.users, icon: Users, color: 'text-violet-600' },
          ].map(item => (
            <Card key={item.label}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="text-2xl font-semibold">{item.value.toLocaleString()}</p>
                </div>
                <item.icon className={`h-5 w-5 ${item.color}`} />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-[180px_180px_180px_1fr]">
            <Input type="date" value={day} max={localDateInputValue()} onChange={event => setDay(event.target.value)} />
            <Select value={kind} onValueChange={value => setKind(value as typeof kind)}>
              <SelectTrigger><SelectValue placeholder="All signal types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All signal types</SelectItem>
                {Object.entries(kindLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={severity} onValueChange={value => setSeverity(value as typeof severity)}>
              <SelectTrigger><SelectValue placeholder="All severities" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                <SelectItem value="error">Errors</SelectItem>
                <SelectItem value="warning">Warnings</SelectItem>
                <SelectItem value="info">Information</SelectItem>
              </SelectContent>
            </Select>
            <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search signal, page, source or user…" />
          </CardContent>
        </Card>

        {limitReached && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="flex gap-2 p-4 text-sm text-amber-950">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              The 2,000-summary safety limit was reached. The download identifies this limit so the report is not mistaken for a complete day.
            </CardContent>
          </Card>
        )}

        {canRecordObservation && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquarePlus className="h-4 w-4" /> Record an observation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Use factual wording: what happened, where, approximate time, and the effect. This is stored as your observation.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select value={observationCategory} onValueChange={setObservationCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coordination">Coordination/workflow</SelectItem>
                    <SelectItem value="performance">Performance</SelectItem>
                    <SelectItem value="conduct">Conduct concern</SelectItem>
                    <SelectItem value="other">Other observation</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={observationSeverity} onValueChange={value => setObservationSeverity(value as OperationalAuditSeverity)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Information</SelectItem>
                    <SelectItem value="warning">Needs attention</SelectItem>
                    <SelectItem value="error">Serious incident</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Textarea value={observation} onChange={event => setObservation(event.target.value)} maxLength={500} placeholder="Example: Two staff members attempted to update the same register at about 10:15; one saw older information until refresh." />
              <div className="flex justify-end">
                <Button className="rounded-full" onClick={() => void saveObservation()} disabled={savingObservation || observation.trim().length < 5}>
                  {savingObservation ? 'Recording…' : 'Record observation'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {filteredEvents.map((event, index) => (
            <Card key={`${event.documentId}-${event.name}-${event.route}-${index}`}>
              <CardContent className="grid gap-3 p-4 lg:grid-cols-[1fr_auto]">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={severityVariant(event.severity)}>{event.severity}</Badge>
                    <Badge variant="outline">{kindLabels[event.kind] || event.kind}</Badge>
                    <span className="break-all font-medium">{event.name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {event.route} · {event.source} · {event.actorName}{event.actorRole ? ` (${event.actorRole})` : ''}
                  </p>
                  {event.message && <p className="text-sm">{event.message}</p>}
                  <p className="text-xs text-muted-foreground">
                    {durationLabel(event.totalMs, event.count, event.maxMs)} · {event.count.toLocaleString()} occurrence{event.count === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground lg:text-right">
                  {displayTimestamp(event.recordedAt)}
                </div>
              </CardContent>
            </Card>
          ))}

          {!loading && filteredEvents.length === 0 && (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No operational signals match this date and filter.</CardContent></Card>
          )}
        </div>
      </main>
    </div>
  );
}
