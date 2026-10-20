"use client";
import { useState } from 'react';
import type { Class, Staff } from '@/types';
import type { EventPlanning, EventRecipient } from '@/lib/events/event-planning';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export function EventAudienceFields({ plan, onChange, classes, staff, recipients, loading, error, retry }: {
    plan: EventPlanning;
    onChange: (plan: EventPlanning) => void;
    classes: Class[];
    staff: Staff[];
    recipients: EventRecipient[];
    loading: boolean;
    error: string;
    retry: () => void;
}) {
    const [search, setSearch] = useState('');
    const audience = plan.audience;
    const change = (patch: Partial<typeof audience>) => onChange({ ...plan, audience: { ...audience, ...patch, excludedKeys: patch.excludedKeys || [] } });
    const toggle = (field: 'staffIds' | 'classIds' | 'levels' | 'sections' | 'genders' | 'streamIds', value: string) => { const selected = audience[field].includes(value) ? audience[field].filter(id => id !== value) : [...audience[field], value]; change({ [field]: selected, ...(field === 'levels' ? { classIds: audience.classIds.filter(id => !selected.length || classes.some(cls => cls.id === id && selected.includes(cls.level))), streamIds: [] } : field === 'classIds' ? { streamIds: [] } : {}) }); };
    const choice = (label: string, checked: boolean, apply: () => void) => <label key={label} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm"><input type="checkbox" checked={checked} onChange={apply} className="h-4 w-4 accent-brand-600"/>{label}</label>;
    const filtered = recipients.filter(person => `${person.name} ${person.context}`.toLowerCase().includes(search.toLowerCase()));
    return <section className="space-y-4" aria-label="Event audience">
    <div><h3 className="font-semibold">{plan.kind === 'staff' ? 'Staff attending' : plan.kind === 'parent' ? 'Parents attending' : 'Parents of the selected classes'}</h3><p className="text-xs text-muted-foreground">Choose who is involved, then review their account and contact details.</p></div>
    {plan.kind === 'staff' ? <>
      <Input aria-label="Search staff" placeholder="Search staff…" value={search} onChange={event => setSearch(event.target.value)}/>
      <div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => change({ staffIds: staff.filter(person => person.status !== 'inactive' && person.status !== 'suspended').map(person => person.id) })}>Select all staff</Button><Button type="button" variant="ghost" size="sm" onClick={() => change({ staffIds: [] })}>Clear</Button></div>
      <div className="grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2">{staff.filter(person => person.status !== 'inactive' && person.status !== 'suspended' && `${person.firstName} ${person.lastName}`.toLowerCase().includes(search.toLowerCase())).map(person => choice(`${person.lastName} ${person.firstName}`, audience.staffIds.includes(person.id), () => toggle('staffIds', person.id)))}</div>
    </> : <>
      {plan.kind === 'parent' && <fieldset className="flex flex-wrap gap-2"><legend className="mb-2 text-sm font-medium">Audience</legend>{(['school', 'filtered'] as const).map(value => <label key={value} className="flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm"><input type="radio" name="event-parent-scope" checked={audience.scope === value} onChange={() => change({ scope: value, classIds: [], levels: [], sections: [], genders: [], streamIds: [] })}/>{value === 'school' ? 'Entire school' : 'Choose groups'}</label>)}</fieldset>}
      {(audience.scope === 'filtered' || plan.kind === 'academic') && <div className="space-y-3">
        {plan.kind === 'parent' && <><fieldset><legend className="mb-2 text-xs font-semibold">School levels</legend><div className="flex flex-wrap gap-2">{[...new Set(classes.map(cls => cls.level).filter(Boolean))].map(level => choice(level, audience.levels.includes(level), () => toggle('levels', level)))}</div></fieldset><fieldset><legend className="mb-2 text-xs font-semibold">Sections</legend><div className="flex flex-wrap gap-2">{['Day', 'Boarding'].map(section => choice(section, audience.sections.includes(section), () => toggle('sections', section)))}</div></fieldset>
        <fieldset><legend className="mb-2 text-xs font-semibold">Classes</legend><div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{classes.filter(cls => !audience.levels.length || audience.levels.includes(cls.level)).map(cls => choice(cls.code || cls.id, audience.classIds.includes(cls.id), () => toggle('classIds', cls.id)))}</div></fieldset></>}
        <fieldset><legend className="mb-2 text-xs font-semibold">Pupil gender (optional)</legend><div className="flex flex-wrap gap-2">{['Male', 'Female'].map(gender => choice(gender, audience.genders.includes(gender), () => toggle('genders', gender)))}</div></fieldset>
        {!!classes.some(cls => cls.streams?.length) && <fieldset><legend className="mb-2 text-xs font-semibold">Streams (optional)</legend><div className="flex flex-wrap gap-2">{classes.filter(cls => !audience.classIds.length || audience.classIds.includes(cls.id)).flatMap(cls => (cls.streams || []).map(stream => choice(`${cls.code || cls.id} / ${stream.code || stream.id}`, audience.streamIds.includes(stream.id), () => toggle('streamIds', stream.id))))}</div></fieldset>}
      </div>}
      <label className="block space-y-1 text-sm">Parent / guardian contacts<select aria-label="Parent contacts" className="h-11 w-full rounded-xl border bg-background px-3" value={audience.guardians} onChange={event => change({ guardians: event.target.value as typeof audience.guardians })}><option value="both">All listed guardians</option><option value="first">First guardian</option><option value="second">Second guardian</option></select></label>
      <Input aria-label="Search selected parents" placeholder="Search parents or pupils…" value={search} onChange={event => setSearch(event.target.value)}/>
    </>}
    {loading ? <p role="status" className="text-sm text-muted-foreground">Checking selected recipients…</p> : error ? <div role="alert" className="rounded-xl border border-destructive p-3 text-sm"><p>{error}</p><Button type="button" variant="outline" size="sm" onClick={retry}>Retry audience</Button></div> : <>
      <p className="text-sm font-medium">{recipients.filter(person => !audience.excludedKeys.includes(person.key)).length} selected · {new Set(recipients.filter(person => !audience.excludedKeys.includes(person.key)).flatMap(person => person.accountIds)).size} active accounts</p>
      {!!recipients.length && <div className="max-h-56 overflow-auto rounded-xl border" aria-label="Selected event recipients">{filtered.map(person => <label key={person.key} className="flex min-h-12 cursor-pointer items-start gap-3 border-b p-3 last:border-0"><input type="checkbox" className="mt-1 h-4 w-4" checked={!audience.excludedKeys.includes(person.key)} onChange={() => change({ excludedKeys: audience.excludedKeys.includes(person.key) ? audience.excludedKeys.filter(key => key !== person.key) : [...audience.excludedKeys, person.key] })}/><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{person.name}</span><span className="block text-xs text-muted-foreground">{person.context}</span></span><span className="shrink-0 text-right text-xs">{person.accountIds.length ? 'Has account' : 'No account'}<span className="block text-muted-foreground">{person.phone || 'No valid phone'}</span></span></label>)}</div>}
    </>}
  </section>;
}
