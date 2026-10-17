'use client';

import React, { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SlidersHorizontal } from 'lucide-react';
import { FEES_SMS_FIELDS, FEES_SMS_NAME_FORMATS, FEES_SMS_TEXT_CASES, type FeesSMSOptions, type FeesSMSNameFormat, type FeesSMSTextCase } from '@/lib/utils/fees-sms';

interface Props {
  options: FeesSMSOptions;
  onChange: (options: FeesSMSOptions) => void;
  onInsert: (text: string) => void;
  children?: React.ReactNode;
}

/** The composer stays compact until the user explicitly opens these controls. */
export function SMSCustomisation({ options, onChange, onInsert, children }: Props) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const selectClass = 'min-h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-controls={`${id}-panel`} className="rounded-full">
        <SlidersHorizontal className="mr-2 h-4 w-4" />Customisation
      </Button>
      {expanded && (
        <section id={`${id}-panel`} aria-label="SMS customisation options" className="space-y-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <div className="space-y-2">
            <p className="text-sm font-semibold">Insert automatic field</p>
            <div className="flex flex-wrap gap-1.5">
              {FEES_SMS_FIELDS.map(([field, label]) => <Button key={field} type="button" variant="outline" size="sm" onClick={() => onInsert(`{${field}}`)} className="min-h-9 rounded-full px-3 text-xs">{label}</Button>)}
              <Button type="button" variant="outline" size="sm" onClick={() => onInsert('\n')} className="min-h-9 rounded-full px-3 text-xs">New line</Button>
            </div>
          </div>
          {children}
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-minimum`}>Skip balances below (Shs.)</Label>
            <Input id={`${id}-minimum`} type="number" min="0" step="1" inputMode="numeric" placeholder="No minimum" value={options.minimumBalance || ''} onChange={event => onChange({ ...options, minimumBalance: event.target.value })} aria-describedby={`${id}-minimum-help`} />
            <p id={`${id}-minimum-help`} className="text-xs text-muted-foreground">Leave blank to include all balances. Entering 10000 keeps balances of 10,000 and above for the chosen fee and period.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-name-format`}>Pupil name format</Label>
              <select id={`${id}-name-format`} value={options.nameFormat || 'all'} onChange={event => onChange({ ...options, nameFormat: event.target.value as FeesSMSNameFormat })} className={selectClass}>
                {FEES_SMS_NAME_FORMATS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-name-case`}>Pupil name case</Label>
              <select id={`${id}-name-case`} value={options.nameCase || 'unchanged'} onChange={event => onChange({ ...options, nameCase: event.target.value as FeesSMSTextCase })} className={selectClass}>
                {FEES_SMS_TEXT_CASES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-message-case`}>Whole message case</Label>
            <select id={`${id}-message-case`} value={options.messageCase || 'unchanged'} onChange={event => onChange({ ...options, messageCase: event.target.value as FeesSMSTextCase })} className={selectClass}>
              {FEES_SMS_TEXT_CASES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">Whole-message case also changes inserted names. Use “As written” to keep the pupil name case separate.</p>
          </div>
          <p className="text-xs text-muted-foreground">SMS is plain text. Use uppercase or new lines for emphasis; bold is not supported.</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange({})}>Reset customisation settings</Button>
          <p className="text-xs text-muted-foreground">Hiding this panel keeps your settings. Reset restores the defaults; fields already inserted remain in the message.</p>
        </section>
      )}
    </div>
  );
}
