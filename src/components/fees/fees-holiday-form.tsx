"use client";

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { AcademicYear, FeesHoliday, FeesHolidayDraft, FeesHolidayPhase } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { holidayTerms, resolveFeesHoliday, feesHolidayLabel } from '@/lib/utils/fees-holiday-terms';

export function FeesHolidayForm({ value, onChange, years, existing, disabled = false }: {
  value: FeesHolidayDraft; onChange: (value: FeesHolidayDraft) => void; years: AcademicYear[];
  existing?: FeesHoliday | null; disabled?: boolean;
}) {
  const id = React.useId();
  const terms = holidayTerms(years);
  const editableTerms = terms.filter(term => !term.ended);
  const phases = value.schedule || [];
  const termKey = (yearId: string, termId: string) => `${yearId}::${termId}`;
  const updatePhase = (index: number, data: Partial<FeesHolidayPhase>) => onChange({ ...value, schedule: phases.map((phase, i) => i === index ? { ...phase, ...data } : phase) });
  const freeTerms = editableTerms.filter(term => !phases.some(phase => phase.academicYearId === term.academicYearId && phase.termId === term.termId));
  return <div className="space-y-4">
    <fieldset disabled={disabled} className="rounded-lg border border-border p-3">
      <legend className="px-1 text-sm font-semibold">Privilege options</legend>
      <div className="flex flex-wrap gap-x-6 gap-y-1">{(['required', 'non-required'] as const).map(category => <label key={category} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
        <Checkbox checked={value.categories.includes(category)} disabled={disabled} onCheckedChange={checked => onChange({ ...value, categories: checked === true ? [...new Set([...value.categories, category])] : value.categories.filter(item => item !== category) })} />
        {category === 'required' ? 'Required fees' : 'Non-required fees'}
      </label>)}</div>
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><Checkbox checked={value.isActive} disabled={disabled} onCheckedChange={checked => onChange({ ...value, isActive: checked === true })} />Enable current and future privileges</label>
    </fieldset>
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Term schedule</h3>
      <p className="text-xs leading-relaxed text-muted-foreground">Each benefit applies from its selected term until the next change. Add an Off change to set an expiry term. Ended terms keep their saved privileges.</p>
      {phases.map((phase, index) => {
        const term = terms.find(term => term.academicYearId === phase.academicYearId && term.termId === phase.termId);
        const locked = term?.ended === true;
        return <div key={index} className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium">{locked ? 'Ended term · locked' : `Change ${index + 1}`}</span>{!locked && <Button type="button" variant="ghost" className="h-11 w-11 p-0" aria-label={`Remove privilege change ${index + 1}`} disabled={disabled} onClick={() => onChange({ ...value, schedule: phases.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4" /></Button>}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><label htmlFor={`${id}-term-${index}`} className="text-xs font-medium">From term</label>
              <Select value={termKey(phase.academicYearId, phase.termId)} disabled={disabled || locked} onValueChange={key => { const next = terms.find(term => termKey(term.academicYearId, term.termId) === key); if (next) updatePhase(index, { academicYearId: next.academicYearId, termId: next.termId }); }}>
                <SelectTrigger id={`${id}-term-${index}`} className="h-11"><SelectValue placeholder="Choose term" /></SelectTrigger>
                <SelectContent>{terms.filter(term => !term.ended || termKey(term.academicYearId, term.termId) === termKey(phase.academicYearId, phase.termId)).map(term => <SelectItem key={termKey(term.academicYearId, term.termId)} value={termKey(term.academicYearId, term.termId)} disabled={phases.some((other, i) => i !== index && other.academicYearId === term.academicYearId && other.termId === term.termId)}>{term.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><label htmlFor={`${id}-benefit-${index}`} className="text-xs font-medium">Benefit</label>
              <Select value={phase.discountType} disabled={disabled || locked} onValueChange={type => updatePhase(index, { discountType: type as FeesHolidayPhase['discountType'], discountValue: type === 'percentage' ? phase.discountValue ?? 50 : undefined })}>
                <SelectTrigger id={`${id}-benefit-${index}`} className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="full">Full (100%)</SelectItem><SelectItem value="half">Half (50%)</SelectItem><SelectItem value="quarter">Quarter (25%)</SelectItem><SelectItem value="percentage">Custom percentage</SelectItem><SelectItem value="off">Off</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          {phase.discountType === 'percentage' && <div className="space-y-1"><label htmlFor={`${id}-percent-${index}`} className="text-xs font-medium">Discount percentage</label><Input id={`${id}-percent-${index}`} type="number" min="0" max="100" step="0.01" className="h-11" disabled={disabled || locked} value={phase.discountValue ?? ''} onChange={event => updatePhase(index, { discountValue: event.target.value === '' ? undefined : Number(event.target.value) })} /></div>}
        </div>;
      })}
      <Button type="button" variant="outline" className="min-h-11" disabled={disabled || !freeTerms.length} onClick={() => {
        const lastTerm = terms.find(term => term.academicYearId === phases.at(-1)?.academicYearId && term.termId === phases.at(-1)?.termId);
        const next = freeTerms.find(term => !lastTerm || term.startDate > lastTerm.startDate) || freeTerms[0];
        if (next) onChange({ ...value, schedule: [...phases, { academicYearId: next.academicYearId, termId: next.termId, discountType: 'off' }] });
      }}><Plus className="mr-2 h-4 w-4" />Add term change / expiry</Button>
      {!editableTerms.length && <p role="alert" className="text-sm text-destructive">Add a current or upcoming academic term before scheduling a privilege.</p>}
    </div>
    {existing && terms.some(term => term.ended) && <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-sm font-medium">Preserved ended terms</summary><ul className="mt-3 space-y-2 text-xs">{terms.filter(term => term.ended).map(term => <li key={termKey(term.academicYearId, term.termId)} className="flex flex-wrap justify-between gap-2"><span>{term.label}</span><span>{feesHolidayLabel(resolveFeesHoliday(existing, term.academicYearId, term.termId, years))}</span></li>)}</ul></details>}
  </div>;
}
