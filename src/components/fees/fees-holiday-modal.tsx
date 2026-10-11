"use client";

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { useCreateFeesHoliday, useUpdateFeesHoliday } from '@/lib/hooks/use-fees-holiday';
import { FeesHolidayForm } from './fees-holiday-form';
import { initialFeesHolidayDraft, prepareFeesHolidayWrite } from '@/lib/utils/fees-holiday-terms';
import type { FeesHoliday, FeesHolidayDraft } from '@/types';

export function FeesHolidayModal({ open, onOpenChange, pupilId, pupilName, existingHoliday }: {
  open: boolean; onOpenChange: (open: boolean) => void; pupilId: string; pupilName?: string; existingHoliday?: FeesHoliday | null;
}) {
  const { data: years = [], isLoading, error } = useAcademicYears();
  const { toast } = useToast();
  const create = useCreateFeesHoliday();
  const update = useUpdateFeesHoliday();
  const [draft, setDraft] = React.useState<FeesHolidayDraft>(() => initialFeesHolidayDraft(years, existingHoliday));
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => { if (open && years.length) setDraft(initialFeesHolidayDraft(years, existingHoliday)); }, [open, existingHoliday, years]);
  const save = async (stop = false) => {
    if (saving) return;
    setSaving(true);
    try {
      const data = stop && existingHoliday ? { isActive: false }
        : { ...draft, pupilId, reason: existingHoliday?.reason || 'staff privilege' };
      prepareFeesHolidayWrite(existingHoliday || null, data, years);
      if (existingHoliday) await update.mutateAsync({ id: existingHoliday.id, data });
      else await create.mutateAsync({ ...draft, pupilId, reason: 'staff privilege' });
      toast({ title: stop ? 'Privilege stopped' : 'Privilege saved', description: 'Ended terms retain their saved privileges.' });
      onOpenChange(false);
    } catch (error) { toast({ variant: 'destructive', title: 'Could not save privilege', description: error instanceof Error ? error.message : 'Please try again.' }); }
    finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={value => { if (!saving) onOpenChange(value); }}><DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden">
    <DialogTitle>{existingHoliday ? 'Edit MOFUS privilege' : 'Add MOFUS privilege'}</DialogTitle>
    <DialogDescription>{pupilName || 'Selected pupil'} · Choose fee categories, benefits and the terms when they change.</DialogDescription>
    <div className="min-h-0 overflow-y-auto pr-1">{isLoading ? <p role="status">Loading academic terms…</p> : error ? <p role="alert" className="text-destructive">Could not load academic terms.</p> : <FeesHolidayForm value={draft} onChange={setDraft} years={years} existing={existingHoliday} disabled={saving} />}</div>
    <div className="flex flex-col justify-end gap-2 border-t border-border pt-3 sm:flex-row">
      {existingHoliday && <Button type="button" variant="outline" className="min-h-11 text-destructive sm:mr-auto" disabled={saving || isLoading || !!error} onClick={() => save(true)}>Stop privilege</Button>}
      <div className="grid grid-cols-2 gap-2 sm:flex">
      <Button type="button" variant="outline" className="min-h-11" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button>
      <Button type="button" className="min-h-11" disabled={saving || isLoading || !!error || !years.length} onClick={() => save()}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save privilege</Button>
      </div>
    </div>
  </DialogContent></Dialog>;
}
