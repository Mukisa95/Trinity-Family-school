'use client';

import { useEffect, useState } from 'react';
import { Bookmark, Check, Trash2 } from 'lucide-react';
import type { AcademicYear, Class, EventFilters, Subject } from '@/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { activeCalendarFilterCount } from '@/lib/utils/calendar-planning';

function FilterChoices({ label, options, selected = [], onChange, searchable = false }: {
  label: string; options: { id: string; name: string }[]; selected?: string[];
  onChange: (ids: string[]) => void; searchable?: boolean;
}) {
  const [query, setQuery] = useState('');
  const matches = options.filter(option => option.name.toLowerCase().includes(query.toLowerCase()));
  return <fieldset className="space-y-2">
    <legend className="mb-2 text-xs font-semibold text-foreground">{label}{selected.length > 0 && ` (${selected.length})`}</legend>
    {searchable && <Input aria-label={`Search ${label.toLowerCase()}`} placeholder={`Search ${label.toLowerCase()}...`} value={query} onChange={event => setQuery(event.target.value)} className="h-9 text-xs" />}
    <div className="max-h-40 space-y-0.5 overflow-y-auto">
      {matches.map(option => <label key={option.id} className="flex min-h-11 cursor-pointer sm:min-h-9 items-center gap-2 rounded-md px-1 text-[0.8125rem] hover:bg-muted">
        <Checkbox checked={selected.includes(option.id)} onCheckedChange={checked => onChange(checked ? [...selected, option.id] : selected.filter(id => id !== option.id))} />
        <span>{option.name}</span>
      </label>)}
      {!matches.length && <p className="py-2 text-xs text-muted-foreground">No matches</p>}
    </div>
  </fieldset>;
}

type SavedView = { name: string; filters: EventFilters };
export function PlanningFilters({ filters, onChange, years, classes, subjects, accountId }: {
  filters: EventFilters; onChange: (filters: EventFilters) => void; years: AcademicYear[];
  classes: Class[]; subjects: Subject[]; accountId: string;
}) {
  const [saved, setSaved] = useState<SavedView[]>([]);
  const [name, setName] = useState('');
  const [storageKey, setStorageKey] = useState('');
  const [message, setMessage] = useState('');
  const key = `trinity:calendar-views:${accountId}`;
  useEffect(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key) || '[]');
      setSaved(Array.isArray(value) ? value.filter(view => typeof view?.name === 'string' && view.filters && typeof view.filters === 'object').slice(0, 8) : []);
    } catch { setSaved([]); }
    setStorageKey(key);
    setMessage('');
  }, [key]);
  const persist = (next: SavedView[]) => {
    if (storageKey !== key) return;
    try { localStorage.setItem(key, JSON.stringify(next)); setSaved(next); setMessage('View saved on this device.'); }
    catch { setMessage('This browser could not save the view.'); }
  };
  const change = (field: keyof EventFilters, value: unknown) => onChange({ ...filters, [field]: value });
  const terms = years.filter(year => !filters.academicYearIds?.length || filters.academicYearIds.includes(year.id))
    .flatMap(year => year.terms.map(term => ({ ...term, name: `${year.name} · ${term.name}` })));
  return <div className="space-y-5 p-4">
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold">Filters <span className="text-muted-foreground">({activeCalendarFilterCount(filters)})</span></h2>
      <Button type="button" variant="ghost" size="sm" onClick={() => onChange({})}>Reset all</Button>
    </div>
    <FilterChoices label="Event type" selected={filters.types} options={['Academic', 'Co-curricular', 'Administrative', 'Holiday'].map(id => ({ id, name: id }))} onChange={ids => change('types', ids)} />
    <label className="flex min-h-11 cursor-pointer sm:min-h-9 items-center gap-2 text-[0.8125rem]"><Checkbox checked={filters.isExamEvent === true} onCheckedChange={checked => change('isExamEvent', checked ? true : undefined)} />Examinations only</label>
    <FilterChoices label="Classes" searchable options={classes.map(cls=>({...cls,name:cls.code||cls.id}))} selected={filters.classIds} onChange={ids => change('classIds', ids)} />
    <FilterChoices label="Academic year" options={years} selected={filters.academicYearIds} onChange={ids => onChange({ ...filters, academicYearIds: ids, termIds: [] })} />
    <FilterChoices label="Academic term" options={terms} selected={filters.termIds} onChange={ids => change('termIds', ids)} />
    <details><summary className="cursor-pointer py-2 text-xs font-semibold">Status, subject & dates</summary>
      <div className="mt-3 space-y-5">
        <FilterChoices label="Status" options={['Scheduled', 'Ongoing', 'Completed', 'Draft', 'Cancelled'].map(id => ({ id, name: id }))} selected={filters.statuses} onChange={ids => change('statuses', ids)} />
        <FilterChoices label="Subjects" searchable options={subjects.map(subject=>({...subject,name:subject.code||subject.id}))} selected={filters.subjectIds} onChange={ids => change('subjectIds', ids)} />
        <div className="space-y-2"><label className="block text-xs font-semibold">From date<Input type="date" aria-label="Filter from date" className="mt-2" value={filters.dateRange?.startDate || ''} onChange={event => change('dateRange', { ...filters.dateRange, startDate: event.target.value })} /></label>
          <label className="block text-xs font-semibold">To date<Input type="date" aria-label="Filter to date" className="mt-2" value={filters.dateRange?.endDate || ''} onChange={event => change('dateRange', { ...filters.dateRange, endDate: event.target.value })} /></label></div>
      </div>
    </details>
    <div className="space-y-2 border-t pt-4">
      <h3 className="flex items-center gap-2 text-xs font-semibold"><Bookmark className="h-3.5 w-3.5" />Personal views</h3>
      {saved.map(view => <div key={view.name} className="flex items-center gap-1">
        <Button type="button" variant="outline" size="sm" className="min-w-0 flex-1 justify-start truncate" onClick={() => onChange(view.filters)}>{view.name}</Button>
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label={`Delete saved view ${view.name}`} onClick={() => persist(saved.filter(item => item.name !== view.name))}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>)}
      <Input aria-label="Personal view name" placeholder="Name this filter combination" maxLength={40} value={name} onChange={event => setName(event.target.value)} />
      <Button type="button" size="sm" variant="secondary" disabled={!name.trim()} className="w-full" onClick={() => {
        persist([...saved.filter(view => view.name !== name.trim()), { name: name.trim(), filters }].slice(-8)); setName('');
      }}><Check className="mr-1.5 h-3.5 w-3.5" />Save current view</Button>
      {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
    </div>
  </div>;
}
