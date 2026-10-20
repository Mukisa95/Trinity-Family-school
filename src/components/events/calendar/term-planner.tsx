"use client";

import { format, isValid, parseISO } from 'date-fns';
import type { AcademicYear, Event } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { calendarDateLabel, calendarYearSections } from '@/lib/utils/calendar-planning';
import { PlanningEventButton } from '../ui/planning-panel';

function PlannerMonths({ events, startDate, onSelect }: { events: Event[]; startDate: string; onSelect: (event: Event) => void }) {
  const grouped = new Map<string, Event[]>();
  events.forEach(event => {
    const date = parseISO(event.startDate < startDate ? startDate : event.startDate);
    const month = isValid(date) ? format(date, 'MMMM yyyy') : 'Other dates';
    grouped.set(month, [...(grouped.get(month) || []), event]);
  });
  return <>{[...grouped.entries()].map(([month, items]) => <section key={month} className="rounded-xl border p-3">
    <h4 className="border-b px-2 pb-2 text-sm font-semibold">{month}</h4>
    <div className="mt-2 grid gap-x-4 md:grid-cols-2">{items.map(event => <PlanningEventButton key={event.id} event={event} onSelect={onSelect} />)}</div>
  </section>)}</>;
}

export function TermPlanner({ years, yearId, termId, mode = 'term', onYear, onTerm, events, onSelect }: {
  years: AcademicYear[]; yearId: string; termId: string; mode?: 'term' | 'year';
  onYear: (id: string) => void; onTerm: (id: string) => void; events: Event[]; onSelect: (event: Event) => void;
}) {
  const year = years.find(item => item.id === yearId);
  const term = year?.terms.find(item => item.id === termId);
  const sections = year ? calendarYearSections(year, events) : [];
  const selected = sections.find(section => section.id === termId)?.events || [];
  return <section aria-label={mode === 'year' ? 'Year planner' : 'Term planner'} className="space-y-4 p-3 sm:p-4">
    <div className="flex flex-wrap items-center gap-3">
      <Select value={yearId} onValueChange={onYear}><SelectTrigger className="calendar-toolbar-control w-36" aria-label="Planner academic year"><SelectValue placeholder="Choose year" /></SelectTrigger><SelectContent>{years.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
      {mode === 'term' && <Select value={termId} onValueChange={onTerm}><SelectTrigger className="calendar-toolbar-control w-36" aria-label="Planner academic term"><SelectValue placeholder="Choose term" /></SelectTrigger><SelectContent>{year?.terms.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>}
    </div>
    {mode === 'year' && year ? <>
      <h3 className="text-base font-semibold">{year.name} · All terms</h3>
      {sections.map(section => <section key={section.id} aria-label={`${section.name} · ${year.name}`} className="space-y-3 rounded-2xl border p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">{section.name}</h3><p className="mt-1 text-xs text-muted-foreground">{calendarDateLabel(section.startDate, 'd MMM')} – {calendarDateLabel(section.endDate, 'd MMM yyyy')}</p></div><span className="text-xs text-muted-foreground">{section.events.length} activities</span></div>
        {section.events.length ? <PlannerMonths events={section.events} startDate={section.startDate} onSelect={onSelect} /> : <p className="py-3 text-sm text-muted-foreground">No activities match this term and your filters.</p>}
      </section>)}
    </> : mode === 'term' && term ? <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-3"><div><h3 className="text-base font-semibold">{term.name} · {year?.name}</h3><p className="mt-1 text-xs text-muted-foreground">{calendarDateLabel(term.startDate, 'd MMM')} – {calendarDateLabel(term.endDate, 'd MMM yyyy')}</p></div><p className="text-sm"><strong>{selected.length}</strong> activities <span className="mx-1 text-muted-foreground">·</span> <strong>{selected.filter(event => event.isExamEvent).length}</strong> exams</p></div>
      {selected.length ? <PlannerMonths events={selected} startDate={term.startDate} onSelect={onSelect} /> : <p className="py-10 text-center text-sm text-muted-foreground">No activities match this term and your filters.</p>}
    </> : <p className="py-10 text-center text-sm text-muted-foreground">Choose an academic {mode === 'year' ? 'year' : 'year and term'} to plan school activities.</p>}
  </section>;
}
