'use client';

import { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { detailDates, detailPeriodRange } from '@/lib/staff-clocking/details-report';
import { detailRangeLabel, detailWeeks, type DetailView } from '@/lib/staff-clocking/details-period';
import type { DetailRange } from '@/lib/staff-clocking/details-contracts';

export function StaffClockingPeriodPicker({ period, anchor, custom, termKey, terms, today, onApply, onClose }: {
  period: DetailView; anchor: string; custom: DetailRange; termKey: string;
  terms: Array<{ key: string; label: string; from: string; to: string }>; today: string;
  onApply: (value: { anchor: string; custom: DetailRange; termKey: string }) => void; onClose: () => void;
}) {
  const mobile = useIsMobile();
  const [date, setDate] = useState(anchor), [range, setRange] = useState(custom), [term, setTerm] = useState(termKey);
  const [year, setYear] = useState(anchor.slice(0, 4));
  const selectedTerm = terms.find(item => item.key === term);
  const selectedRange = detailPeriodRange(period, date, selectedTerm, range);
  const weeks = detailWeeks(Number(year));
  const valid = detailDates(selectedRange).length > 0 && (period !== 'term' || !!selectedTerm) && (period !== 'week' || weeks.some(week => week.from === selectedRange.from));
  const selectClass = 'h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:[color-scheme:dark]';
  const form = <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (valid) { onApply({ anchor: period === 'term' ? selectedTerm!.from : period === 'custom' ? range.from : date, custom: range, termKey: term }); onClose(); } }}>
    {period === 'week' ? <div className="space-y-3"><div className="space-y-1.5"><Label htmlFor="report-year">Calendar year</Label><Input id="report-year" type="number" min={1900} max={2100} value={year} onChange={event => { const next = event.target.value; setYear(next); const first = detailWeeks(Number(next))[0]; if (first) setDate(first.from); }} /></div><div className="space-y-1.5"><Label htmlFor="report-week">Week date range</Label><select id="report-week" className={selectClass} value={selectedRange.from} onChange={event => setDate(event.target.value)}>{weeks.map(week => <option key={week.from} value={week.from}>{detailRangeLabel(week)}</option>)}</select></div></div>
      : period === 'term' ? <div className="space-y-1.5"><Label htmlFor="report-term">Academic term</Label><select id="report-term" className={selectClass} value={term} onChange={event => setTerm(event.target.value)}>{terms.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></div>
      : period === 'custom' ? <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="report-from">From</Label><Input id="report-from" type="date" value={range.from} onChange={event => setRange(old => ({ ...old, from: event.target.value }))} /></div><div><Label htmlFor="report-to">To</Label><Input id="report-to" type="date" value={range.to} onChange={event => setRange(old => ({ ...old, to: event.target.value }))} /></div></div>
      : <div className="space-y-1.5"><Label htmlFor="report-month">Month and year</Label><Input id="report-month" type="month" value={date.slice(0, 7)} onChange={event => setDate(`${event.target.value}-01`)} /></div>}
    {!valid && <p role="alert" className="text-xs text-destructive">Choose valid dates covering at most 366 days, or a configured academic term.</p>}
    <div className="flex gap-2"><Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => { setDate(today); setYear(today.slice(0, 4)); setRange({ from: today, to: today }); const current = terms.find(item => item.from <= today && item.to >= today); if (current) setTerm(current.key); }}>Today</Button><Button type="submit" className="h-11 flex-1 rounded-xl" disabled={!valid}>Apply period</Button></div>
  </form>;
  return mobile ? <Sheet open onOpenChange={open => { if (!open) onClose(); }}><SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-[24px] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"><SheetHeader className="mb-4 pr-10 text-left"><SheetTitle>Choose reporting period</SheetTitle><SheetDescription>Select a {period === 'custom' ? 'date range' : period} for attendance records.</SheetDescription></SheetHeader>{form}</SheetContent></Sheet>
    : <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent><DialogHeader><DialogTitle>Choose reporting period</DialogTitle><DialogDescription>Select a {period === 'custom' ? 'date range' : period} for attendance records.</DialogDescription></DialogHeader>{form}</DialogContent></Dialog>;
}
