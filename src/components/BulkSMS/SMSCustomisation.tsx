'use client';

import React, { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SlidersHorizontal } from 'lucide-react';
import { FEES_SMS_FIELDS, type FeesSMSOptions } from '@/lib/utils/fees-sms';

import { SMS_FEE_FIELDS, type SMSField } from '@/lib/utils/sms-document';

interface Props {
  options: FeesSMSOptions;
  onChange: (options: FeesSMSOptions) => void;
  onInsertField: (field: SMSField) => void;
  onInsertText: (text: string) => void;
  onConditional?: () => void;
  allowFees?: boolean;
  allowedFields?:SMSField[];
  fieldLabels?:Partial<Record<SMSField,string>>;
  children?: React.ReactNode;
}

/** The composer stays compact until the user explicitly opens these controls. */
export function SMSCustomisation({ options, onChange, onInsertField, onInsertText, onConditional, allowFees = true,allowedFields,fieldLabels, children }: Props) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
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
              {FEES_SMS_FIELDS.filter(([field]) => (allowFees || !SMS_FEE_FIELDS.has(field))&&(!allowedFields||allowedFields.includes(field))).map(([field, label]) => <Button key={field} type="button" variant="outline" size="sm" onClick={() => onInsertField(field)} className="min-h-9 rounded-full px-3 text-xs">{fieldLabels?.[field]||label}</Button>)}
              <Button type="button" variant="outline" size="sm" onClick={() => onInsertText('\n')} className="min-h-9 rounded-full px-3 text-xs">New line</Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Click an inserted field in your message to change its format. Fields are filled automatically for each recipient.</p>
          {children}
          {allowFees && <>
          <div className="space-y-1.5">
            <Button type="button" variant="outline" size="sm" className="h-auto min-h-9 whitespace-normal text-left" onClick={onConditional}>Exclude selected text when there is no balance</Button>
            <p className="text-xs text-muted-foreground">Highlight part of the message first. Only that section is left out when the balance is zero or in credit.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-minimum`}>Skip balances below (Shs.)</Label>
            <Input id={`${id}-minimum`} type="number" min="0" step="1" inputMode="numeric" placeholder="No minimum" value={options.minimumBalance || ''} onChange={event => onChange({ ...options, minimumBalance: event.target.value })} aria-describedby={`${id}-minimum-help`} />
            <p id={`${id}-minimum-help`} className="text-xs text-muted-foreground">Leave blank to include all balances. Entering 10000 keeps balances of 10,000 and above for the chosen fee and period.</p>
          </div>
          </>}
        </section>
      )}
    </div>
  );
}
