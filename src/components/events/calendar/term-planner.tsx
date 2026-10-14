'use client';

import { format, isValid, parseISO } from 'date-fns';
import type { AcademicYear, Event } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { calendarDateLabel } from '@/lib/utils/calendar-planning';
import { PlanningEventButton } from '../ui/planning-panel';

export function TermPlanner({ years, yearId, termId, onYear, onTerm, events, onSelect }: {
  years: AcademicYear[]; yearId: string; termId: string;
  onYear: (id: string) => void; onTerm: (id: string) => void; events: Event[]; onSelect: (event: Event) => void;
}) {
  const year = years.find(item => item.id === yearId);
  const term = year?.terms.find(item => item.id === termId);
  const selected = term ? events.filter(event => event.startDate <= term.endDate.slice(0, 10) && (event.endDate || event.startDate) >= term.startDate.slice(0, 10))
    .sort((a, b) => `${a.startDate}${a.startTime || ''}`.localeCompare(`${b.startDate}${b.startTime || ''}`)) : [];
  const grouped = new Map<string, Event[]>();
  selected.forEach(event => {
    const date = parseISO(event.startDate < (term?.startDate || '') ? term!.startDate : event.startDate);
    const month = isValid(date) ? format(date, 'MMMM yyyy') : 'Other dates';
    grouped.set(month, [...(grouped.get(month) || []), event]);
  });
  return <section aria-label="Term planner" className="space-y-4 p-4">
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1.5 text-xs font-semibold">Academic year<Select value={yearId} onValueChange={onYear}><SelectTrigger aria-label="Term planner academic year"><SelectValue placeholder="Choose year" /></SelectTrigger><SelectContent>{years.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></label>
      <label className="space-y-1.5 text-xs font-semibold">Academic term<Select value={termId} onValueChange={onTerm}><SelectTrigger aria-label="Term planner academic term"><SelectValue placeholder="Choose term" /></SelectTrigger><SelectContent>{year?.terms.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></label>
    </div>
    {term ? <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-4"><div><h3 className="text-base font-semibold">{term.name} · {year?.name}</h3><p className="mt-1 text-xs text-muted-foreground">{calendarDateLabel(term.startDate, 'd MMM')} – {calendarDateLabel(term.endDate, 'd MMM yyyy')}</p></div><p className="text-sm"><strong>{selected.length}</strong> activities <span className="mx-1 text-muted-foreground">·</span> <strong>{selected.filter(event => event.isExamEvent).length}</strong> exams</p></div>
      {selected.length ? [...grouped.entries()].map(([month, items]) => <section key={month} className="rounded-xl border p-3"><h4 className="border-b px-2 pb-2 text-sm font-semibold">{month}</h4><div className="mt-2 grid gap-x-4 md:grid-cols-2">{items.map(event => <PlanningEventButton key={event.id} event={event} onSelect={onSelect} />)}</div></section>) : <p className="py-10 text-center text-sm text-muted-foreground">No activities match this term and your filters.</p>}
    </> : <p className="py-10 text-center text-sm text-muted-foreground">Choose an academic year and term to plan school activities.</p>}
  </section>;
}
