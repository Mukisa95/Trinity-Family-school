'use client';

import { formatPupilDisplayName } from '@/lib/utils/name-formatter';
import React, {useMemo, useRef, useState, type ReactNode} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import {CUSTOM_NOTE_CONDITIONS, CUSTOM_NOTE_METRICS, renderCustomNote, validateCustomNoteInput,
  type CreateCustomFeeNoteInput, type CustomNoteField, type CustomMetric, type NumericMetric,
  type CustomCondition, type CustomFeeRow} from '@/lib/fees/custom-fee-notes';
import {parseFeeReminderSchedule, reminderLocalDate, reminderAmountLabel, type FeeReminderScope} from '@/lib/fees/fee-reminders';
import type {AcademicYear, Pupil} from '@/types';
import type {PupilFee, PreviousTermBalance} from '../types';

export interface CustomFeeChoice {key: string; scope: FeeReminderScope; fees: number; paid: number; balance: number}
export function customFeeChoices(fees: PupilFee[], previous: PreviousTermBalance | null, year: AcademicYear, termId: string): CustomFeeChoice[] {
  const term = year.terms.find(item => item.id === termId);
  return fees.flatMap(fee => fee.id === 'previous-balance'
    ? (previous?.breakdown || []).filter(item => item.feeStructureId && item.academicYearId && item.termId).map(item => ({
      key: JSON.stringify([item.feeStructureId, item.academicYearId, item.termId]),
      scope: {feeStructureId: item.feeStructureId!, academicYearId: item.academicYearId!, termId: item.termId!, feeName: item.name, academicYearName: item.year, termName: item.term},
      fees: item.amount, paid: item.paid, balance: item.balance,
    })) : [{key: JSON.stringify([fee.id, year.id, termId]),
      scope: {feeStructureId: fee.id, academicYearId: year.id, termId, feeName: fee.name, academicYearName: year.name, termName: term?.name || ''},
      fees: fee.amount, paid: fee.paid || 0, balance: fee.balance}]);
}

export function CustomFeeNoteEditor({pupil, choices, academicYearId, termId, loading, saving, onSave, onBack, recipients}: {
  pupil: Pupil; choices: CustomFeeChoice[]; academicYearId: string; termId: string; loading: boolean; saving: boolean;
  onSave: (input: CreateCustomFeeNoteInput) => Promise<void>; onBack: () => void;
  recipients: (value: string[] | null, onChange: (value: string[] | null) => void) => ReactNode;
}) {
  const [selected, setSelected] = useState(() => choices.map(item => item.key));
  const [message, setMessage] = useState('');
  const [fields, setFields] = useState<CustomNoteField[]>([]);
  const [condition, setCondition] = useState<CustomCondition>('scheduled');
  const [target, setTarget] = useState('');
  const [date, setDate] = useState(() => reminderLocalDate(new Date(Date.now() + 86_400_000)));
  const [time, setTime] = useState('09:00');
  const [recipientIds, setRecipientIds] = useState<string[] | null>(null);
  const [metric, setMetric] = useState<CustomMetric>('pupil_name');
  const [scope, setScope] = useState('all');
  const [left, setLeft] = useState<NumericMetric>('fees');
  const [operator, setOperator] = useState<'+' | '-'>('-');
  const [right, setRight] = useState<NumericMetric | 'number'>('paid');
  const [number, setNumber] = useState('0');
  const [error, setError] = useState('');
  const textarea = useRef<HTMLTextAreaElement>(null);
  const pending = useRef<{signature: string; id: string} | null>(null);
  const selectedChoices = useMemo(() => selected.map(key => choices.find(item => item.key === key)).filter((item): item is CustomFeeChoice => !!item), [selected, choices]);
  const scopeIndexes = scope === 'all' ? undefined : [Number(scope)];
  const previewRows: CustomFeeRow[] = selectedChoices.map(item => ({...item.scope, fees: item.fees, paid: item.paid, balance: item.balance, paid_since_note: 0}));
  const spec = {message, fields, condition: {type: condition, ...(['paid_at_least', 'paid_below', 'balance_above'].includes(condition) ? {amount: Number(target)} : {})}};
  const needsTarget = ['paid_at_least', 'paid_below', 'balance_above'].includes(condition);
  const schedule = new Date(`${date}T${time}:00+03:00`);
  let preview = message;
  try { if (Number.isFinite(schedule.getTime())) preview = renderCustomNote({custom: spec, pupilName: `${formatPupilDisplayName(pupil)}`.trim()}, previewRows, pupil.className || '', schedule); } catch { /* Partial editor input is allowed. */ }
  const selectClass = 'min-h-11 min-w-0 max-w-full w-full rounded-xl border border-slate-300 bg-white px-3 text-sm';
  function insert(field: CustomNoteField) {
    const same = fields.find(item => JSON.stringify({...item, label: ''}) === JSON.stringify({...field, label: ''}));
    const label = same?.label || (fields.some(item => item.label === field.label) ? `${field.label} ${fields.length + 1}` : field.label);
    if (!same) setFields(previous => [...previous, {...field, label}]);
    const start = textarea.current?.selectionStart ?? message.length, end = textarea.current?.selectionEnd ?? start;
    const token = `[${label}]`;
    setMessage(previous => previous.slice(0, start) + token + previous.slice(end));
    requestAnimationFrame(() => {textarea.current?.focus(); textarea.current?.setSelectionRange(start + token.length, start + token.length);});
  }
  function changeSelection(key: string, checked: boolean) {
    if (checked) {setSelected(previous => [...previous, key]); return;}
    const index = selectedChoices.findIndex(item => item.key === key);
    const used = fields.some(field => message.includes(`[${field.label}]`) && (field.scopeIndexes?.includes(index)
      || field.calculation?.some(term => term.scopeIndexes?.includes(index))));
    if (used) {setError('Remove this fee’s inline fields from the message before removing the fee.'); return;}
    const remap = (indexes?: number[]) => indexes?.filter(item => item !== index).map(item => item > index ? item - 1 : item);
    setFields(previous => previous.filter(field => message.includes(`[${field.label}]`)).map(field => ({...field,
      ...(field.scopeIndexes ? {scopeIndexes: remap(field.scopeIndexes)} : {}),
      ...(field.calculation ? {calculation: field.calculation.map(term => ({...term, ...(term.scopeIndexes ? {scopeIndexes: remap(term.scopeIndexes)} : {})}))} : {})})));
    setSelected(previous => previous.filter(item => item !== key)); setScope('all'); setError('');
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setError('');
    try {
      if (loading) throw new Error('Wait for the fee records to load.');
      if (recipientIds !== null && !recipientIds.length) throw new Error('Choose at least one recipient.');
      parseFeeReminderSchedule(date, time);
      const input = {kind: 'custom' as const, pupilId: pupil.id, academicYearId, termId,
        scopes: selectedChoices.map(({scope: {feeStructureId, academicYearId, termId}}) => ({feeStructureId, academicYearId, termId})),
        custom: {...spec, fields: fields.filter(field => message.includes(`[${field.label}]`))}, scheduleDate: date, scheduleTime: time, recipientIds};
      const signature = JSON.stringify(input);
      if (!pending.current || pending.current.signature !== signature) pending.current = {signature, id: crypto.randomUUID()};
      await onSave(validateCustomNoteInput({...input, requestId: pending.current.id}));
    } catch (error) {setError((error as Error).message);}
  }
  return <form onSubmit={save} className="min-w-0 space-y-4">
    <fieldset disabled={saving} className="min-w-0 space-y-4">
      <div><Label htmlFor="custom-note-message">Your note</Label><Textarea ref={textarea} id="custom-note-message" required maxLength={4000} rows={5} value={message}
        onChange={event => setMessage(event.target.value)} placeholder="Write your message, then insert live details where you need them." className="mt-1 rounded-xl" /></div>
      <fieldset className="min-w-0 space-y-2"><legend className="max-w-full text-sm font-medium whitespace-normal">Fee items used by this note and its condition</legend>
        <div className="max-h-44 overflow-y-auto rounded-xl border p-2">{choices.map(item => <label key={item.key} className="flex min-h-11 items-center gap-3 px-2 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={selected.includes(item.key)} disabled={loading} onChange={event => changeSelection(item.key, event.target.checked)} />
          <span className="min-w-0 break-words">{item.scope.feeName} · {item.scope.academicYearName} {item.scope.termName} · {reminderAmountLabel(item.balance)} balance</span>
        </label>)}{!choices.length && <p className="p-2 text-sm">No verified fee items are available for this period.</p>}</div>
        <p className="text-xs text-slate-600">Balances refer to these selected items and terms. Cleared items can be included.</p>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="custom-note-field">Insert live information</Label><select id="custom-note-field" value={metric} onChange={event => setMetric(event.target.value as CustomMetric)} className={selectClass}>
          {Object.entries(CUSTOM_NOTE_METRICS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
        <div><Label htmlFor="custom-note-scope">Fee information for</Label><select id="custom-note-scope" value={scope} onChange={event => setScope(event.target.value)} className={selectClass}>
          <option value="all">All selected fees</option>{selectedChoices.map((item, index) => <option key={item.key} value={index}>{item.scope.feeName} · {item.scope.termName}</option>)}</select></div>
      </div>
      <Button type="button" variant="outline" className="min-h-11" disabled={!selectedChoices.length && !['pupil_name', 'class', 'date', 'time'].includes(metric) || fields.length >= 50} onClick={() => insert({
        label: `${scopeIndexes ? `${selectedChoices[scopeIndexes[0]]?.scope.feeName} · ` : ''}${CUSTOM_NOTE_METRICS[metric]}`, metric, ...(scopeIndexes ? {scopeIndexes} : {})})}>Insert into note</Button>
      <details className="rounded-xl border p-3"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Insert a calculation</summary>
        <p className="mb-3 text-xs text-slate-600">Add or subtract fee totals, paid amounts, balances or a number. Uses the fee selection above.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><Label htmlFor="custom-calc-left">First amount</Label><select id="custom-calc-left" className={selectClass} value={left} onChange={event => setLeft(event.target.value as NumericMetric)}>{['fees', 'paid', 'balance', 'paid_since_note', 'remaining_to_target'].map(key => <option key={key} value={key}>{CUSTOM_NOTE_METRICS[key as NumericMetric]}</option>)}</select></div>
          <div><Label htmlFor="custom-calc-operation">Operation</Label><select id="custom-calc-operation" className={selectClass} value={operator} onChange={event => setOperator(event.target.value as '+' | '-')}><option value="-">Subtract</option><option value="+">Add</option></select></div>
          <div><Label htmlFor="custom-calc-right">Second amount</Label><select id="custom-calc-right" className={selectClass} value={right} onChange={event => setRight(event.target.value as NumericMetric | 'number')}><option value="number">A number</option>{['fees', 'paid', 'balance', 'paid_since_note', 'remaining_to_target'].map(key => <option key={key} value={key}>{CUSTOM_NOTE_METRICS[key as NumericMetric]}</option>)}</select></div>
        </div>
        {right === 'number' && <div className="mt-3"><Label htmlFor="custom-calc-number">Number (shillings)</Label><Input id="custom-calc-number" type="number" min="0" step="1" value={number} onChange={event => setNumber(event.target.value)} className="min-h-11" /></div>}
        <Button type="button" variant="outline" className="mt-3 min-h-11" disabled={!selectedChoices.length || fields.length >= 50} onClick={() => insert({label: `${CUSTOM_NOTE_METRICS[left]} ${operator} ${right === 'number' ? number : CUSTOM_NOTE_METRICS[right]}`,
          calculation: [{operator: '+', metric: left, ...(scopeIndexes ? {scopeIndexes} : {})}, {operator, ...(right === 'number' ? {amount: Number(number)} : {metric: right, ...(scopeIndexes ? {scopeIndexes} : {})})}]})}>Insert calculation into note</Button>
      </details>
      <div><Label htmlFor="custom-note-condition">When to notify</Label><select id="custom-note-condition" value={condition} onChange={event => setCondition(event.target.value as CustomCondition)} className={selectClass}>{Object.entries(CUSTOM_NOTE_CONDITIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
      {needsTarget && <div><Label htmlFor="custom-note-target">Target amount (shillings)</Label><Input id="custom-note-target" type="number" required min="1" step="1" value={target} onChange={event => setTarget(event.target.value)} className="min-h-11" /></div>}
      <p className="text-xs leading-5 text-slate-600">Payment targets count new payments dated from this note’s creation to its deadline, excluding reversals. “Fees cleared” and “target paid” send immediately when met, up to the deadline. Other conditions are checked at the chosen time.</p>
      <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="custom-note-date">Notification date / condition deadline</Label><Input id="custom-note-date" type="date" required min={reminderLocalDate()} value={date} onChange={event => setDate(event.target.value)} className="min-h-11" /></div>
        <div><Label htmlFor="custom-note-time">Time (East Africa)</Label><Input id="custom-note-time" type="time" required value={time} onChange={event => setTime(event.target.value)} className="min-h-11" /></div></div>
      {recipients(recipientIds, setRecipientIds)}
    </fieldset>
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4"><p className="text-xs font-medium text-indigo-700">Preview using today’s figures</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{preview || 'Your message will appear here.'}</p>
      <p className="mt-2 text-xs leading-5 text-slate-600">The sent message recalculates fees using the records at that time and payments dated up to the notification date. Future payments are unknown; this preview is not a forecast.</p></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t bg-white/95 pt-3 pb-[env(safe-area-inset-bottom)]"><Button type="button" variant="outline" className="min-h-11" disabled={saving} onClick={onBack}>Back to notes</Button><Button type="submit" className="min-h-11" disabled={saving || loading}>{saving ? 'Saving…' : 'Save custom note'}</Button></div>
  </form>;
}
