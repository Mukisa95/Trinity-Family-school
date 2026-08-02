"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, ExternalLink, Link2, Loader2, Search, X } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { auth } from '@/lib/firebase';
import {
  getNotificationDestination,
  NOTIFICATION_DESTINATIONS,
  resolveNotificationDestination,
  type NotificationDestinationEntity,
  type NotificationDestinationSelection,
} from '@/lib/notifications/notification-destinations';

type LookupResult = { id: string; label: string; description?: string };

function RecordLookup({
  entity,
  value,
  onSelect,
  label,
  optional = false,
}: {
  entity: NotificationDestinationEntity;
  value?: LookupResult | null;
  onSelect: (result: LookupResult | null) => void;
  label: string;
  optional?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LookupResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        setResults([]);
        setError('Your sign-in session is still loading. Please try again in a moment.');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const token = await firebaseUser.getIdToken();
        const params = new URLSearchParams({ entity, q: query.trim() });
        const response = await fetch(`/api/notifications/link-destinations?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to search records.');
        setResults(Array.isArray(data.results) ? data.results : []);
      } catch (error) {
        if (!controller.signal.aborted) {
          setResults([]);
          setError(error instanceof Error ? error.message : 'Unable to search records.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 260);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [entity, query]);

  if (value) {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-blue-900">{value.label}</p>
            {value.description && <p className="mt-0.5 truncate text-xs text-blue-700">{value.description}</p>}
          </div>
          <button type="button" onClick={() => onSelect(null)} className="rounded-full p-1 text-blue-700 hover:bg-blue-100" aria-label={`Clear ${label.toLowerCase()}`}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-700">{label}{optional ? <span className="font-normal text-slate-400"> (optional)</span> : null}</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder={entity === 'pupil' ? 'Search by pupil name or admission number' : 'Search by class name'}
          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
        />
        {loading && <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-blue-500" />}
      </div>
      {query.trim().length >= 2 && (
        <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {error ? <p className="px-3.5 py-3 text-sm text-red-600">{error}</p> : results.length ? results.map(result => (
            <button
              key={result.id}
              type="button"
              onClick={() => {
                onSelect(result);
                setQuery('');
                setResults([]);
              }}
              className="flex w-full items-center gap-3 border-b border-slate-100 px-3.5 py-3 text-left last:border-0 hover:bg-blue-50"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{result.label.slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-800">{result.label}</span>{result.description && <span className="block truncate text-xs text-slate-500">{result.description}</span>}</span>
            </button>
          )) : !loading ? <p className="px-3.5 py-3 text-sm text-slate-500">No matching records found.</p> : null}
        </div>
      )}
    </div>
  );
}

function LinkFilters({ selection, onChange }: { selection: NotificationDestinationSelection; onChange: (next: NotificationDestinationSelection) => void }) {
  const filters = selection.filters || {};
  const setFilter = (key: string, value: string) => onChange({ ...selection, filters: { ...filters, [key]: value } });
  const destination = getNotificationDestination(selection.id);
  if (!destination?.filterKeys?.length) return null;
  const supportsClassFilter = selection.id === 'pupils' || selection.id === 'fees-collection' || selection.id === 'attendance-report';
  const selectedClass = filters.classId
    ? { id: filters.classId, label: filters.classLabel || 'Selected class' }
    : null;

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
      <div className="flex items-center gap-2"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Link settings</span><span className="text-xs text-slate-400">These filters open already applied.</span></div>
      {selection.id === 'pupils' && <>
        <input value={filters.q || ''} onChange={event => setFilter('q', event.target.value)} placeholder="Search pupils by name or admission number" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <select value={filters.gender || ''} onChange={event => setFilter('gender', event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm"><option value="">All genders</option><option value="Female">Female</option><option value="Male">Male</option></select>
          <select value={filters.status || ''} onChange={event => setFilter('status', event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm"><option value="">All statuses</option><option value="Active">Active</option><option value="Pending">Pending</option><option value="Graduated">Graduated</option></select>
          <select value={filters.section || ''} onChange={event => setFilter('section', event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm"><option value="">All sections</option><option value="Day">Day</option><option value="Boarding">Boarding</option></select>
        </div>
      </>}
      {selection.id === 'fees-collection' && <>
        <input value={filters.q || ''} onChange={event => setFilter('q', event.target.value)} placeholder="Search pupils by name or admission number" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
        <div className="grid grid-cols-2 gap-2">
          <select value={filters.status || ''} onChange={event => setFilter('status', event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm"><option value="">All pupil statuses</option><option value="Active">Active</option><option value="Pending">Pending</option></select>
          <select value={filters.balanceStatus || ''} onChange={event => setFilter('balanceStatus', event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm"><option value="">Any balance</option><option value="with_balance">With balance</option><option value="cleared">Cleared</option></select>
        </div>
      </>}
      {selection.id === 'attendance-report' && <>
        <div className="grid grid-cols-2 gap-2">
          <select value={filters.reportType || 'school'} onChange={event => setFilter('reportType', event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm"><option value="school">School report</option><option value="class">Class report</option><option value="pupil">Pupil report</option></select>
          <select value={filters.trendPeriod || 'daily'} onChange={event => setFilter('trendPeriod', event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="termly">Termly</option></select>
        </div>
        <input type="date" value={filters.date || ''} onChange={event => setFilter('date', event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" />
      </>}
      {supportsClassFilter && <RecordLookup
        entity="class"
        label="Class"
        optional
        value={selectedClass}
        onSelect={result => onChange({
          ...selection,
          displayLabel: result?.label || undefined,
          filters: {
            ...filters,
            classId: result?.id || '',
            classLabel: result?.label || '',
          },
        })}
      />}
    </div>
  );
}

export function NotificationLinkPicker({ value, onChange }: { value: NotificationDestinationSelection | null; onChange: (selection: NotificationDestinationSelection | null) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<ReturnType<typeof getNotificationDestination> | null>(null);
  const destination = value ? getNotificationDestination(value.id) : null;
  const visibleDestinations = useMemo(() => {
    const term = query.trim().toLowerCase();
    return NOTIFICATION_DESTINATIONS.filter(item => !term || `${item.label} ${item.description} ${item.category}`.toLowerCase().includes(term));
  }, [query]);

  const summary = value ? (() => {
    try { return resolveNotificationDestination(value).label; } catch { return destination?.label || 'Application link'; }
  })() : null;

  const selectDestination = (next: NonNullable<ReturnType<typeof getNotificationDestination>>) => {
    if (next.entity) {
      setPending(next);
      return;
    }
    onChange({ id: next.id });
    setOpen(false);
    setQuery('');
  };

  const selectEntity = (result: LookupResult | null) => {
    if (!pending || !result) return;
    onChange({ id: pending.id, entityId: result.id, entityLabel: result.label });
    setPending(null);
    setOpen(false);
    setQuery('');
  };

  return (
    <div>
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">Open when tapped</span>
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-left transition hover:border-blue-300 hover:bg-blue-50/50 focus:outline-none focus:ring-4 focus:ring-blue-100">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700"><Link2 className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{summary || 'Choose an application page'}</span><span className="block truncate text-xs text-slate-500">{summary ? 'Tap to change this destination' : 'Search pages, pupils, classes and filtered reports'}</span></span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
      {value && <div className="mt-2 flex items-center justify-between gap-3"><span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-blue-700"><ExternalLink className="h-3.5 w-3.5" />{summary}</span><button type="button" onClick={() => onChange(null)} className="shrink-0 text-xs font-semibold text-slate-500 hover:text-red-600">Remove link</button></div>}
      {value && <LinkFilters selection={value} onChange={onChange} />}

      <Dialog open={open} onOpenChange={next => { setOpen(next); if (!next) { setPending(null); setQuery(''); } }}>
        <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
          <div className="border-b border-slate-100 px-5 py-5 pr-14">
            <DialogTitle className="text-lg font-bold text-slate-900">{pending ? `Choose ${pending.entity}` : 'Choose application destination'}</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-slate-500">{pending ? `Search for the ${pending.entity} this notification should open.` : 'Recipients will be taken directly to the selected page.'}</DialogDescription>
          </div>
          <div className="max-h-[65dvh] overflow-y-auto p-5">
            {pending ? <RecordLookup entity={pending.entity!} label={`Find ${pending.entity}`} onSelect={selectEntity} /> : <>
              <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search pages, pupils, attendance, fees…" autoFocus className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" /></div>
              <div className="mt-4 space-y-4">{Object.entries(visibleDestinations.reduce<Record<string, typeof NOTIFICATION_DESTINATIONS[number][]>>((groups, item) => { (groups[item.category] ||= []).push(item); return groups; }, {})).map(([category, items]) => <section key={category}><h3 className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">{category}</h3><div className="overflow-hidden rounded-xl border border-slate-200">{items.map(item => <button key={item.id} type="button" onClick={() => selectDestination(item)} className="flex w-full items-center gap-3 border-b border-slate-100 px-3.5 py-3 text-left last:border-0 hover:bg-blue-50"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">{value?.id === item.id ? <Check className="h-4 w-4 text-blue-600" /> : <Link2 className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800">{item.label}</span><span className="block truncate text-xs text-slate-500">{item.description}</span></span><ChevronRight className="h-4 w-4 text-slate-400" /></button>)}</div></section>)}</div>
            </>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
