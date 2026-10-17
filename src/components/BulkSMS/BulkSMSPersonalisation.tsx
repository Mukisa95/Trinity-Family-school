'use client';

import React, { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import type { Class, Guardian, Pupil } from '@/types';
import { useTermStatus } from '@/lib/hooks/use-term-status';
import { buildFeesSMSPreview, type FeesSMSOptions, type FeesSMSPreview } from '@/lib/utils/fees-sms';
import { SMSCustomisation } from './SMSCustomisation';
import { BulkSMSModal } from '@/components/fees/BulkSMSModal';
import type { SMSField } from '@/lib/utils/sms-document';
import { Label } from '@/components/ui/label';

export interface PupilSMSRecipient {
  pupilId: string;
  guardian: Guardian;
  phone: string;
}
export interface BulkSMSPersonalisationHandle { review: () => void }
interface Props {
  message: string;
  options: FeesSMSOptions;
  onOptionsChange: (options: FeesSMSOptions) => void;
  onInsertField: (field: SMSField) => void;
  onInsertText: (text: string) => void;
  pupils: Pupil[];
  classes: Class[];
  recipients: PupilSMSRecipient[];
  manualNumbers: string[];
  active: boolean;
  sentBy: string;
  onCompleted: () => void;
}
export const BulkSMSPersonalisation = forwardRef<BulkSMSPersonalisationHandle, Props>(function BulkSMSPersonalisation({
  message, options, onOptionsChange, onInsertField, onInsertText, pupils, classes, recipients, manualNumbers, active, sentBy, onCompleted,
}, ref) {
  const { academicYears, effectiveTerm } = useTermStatus();
  const [yearId, setYearId] = useState('');
  const [termId, setTermId] = useState('');
  const [reviewRequest, setReviewRequest] = useState<FeesSMSPreview>();
  const [showReview, setShowReview] = useState(false);
  const year = academicYears.find(item => item.id === (yearId || effectiveTerm.academicYear?.id)) || null;
  const effectiveTermId = termId || (year?.id === effectiveTerm.academicYear?.id ? effectiveTerm.term?.id : year?.terms[0]?.id) || '';
  const selectedPupils = useMemo(() => {
    const ids = new Set(recipients.map(item => item.pupilId));
    return pupils.filter(pupil => ids.has(pupil.id));
  }, [pupils, recipients]);
  const recipientGuardians = useMemo(() => {
    const result: Record<string, Guardian[]> = {};
    for (const recipient of recipients) (result[recipient.pupilId] ||= []).push({ ...recipient.guardian, phone: recipient.phone });
    return result;
  }, [recipients]);
  const selectedTerm = year?.terms.find(term => term.id === effectiveTermId);
  const context = {
    pupils: selectedPupils, classes, pupilFeesInfo: {}, recipientGuardians, manualNumbers, allowFees: false,
    yearName: year?.name, termName: selectedTerm?.name,
    termNumber: year && selectedTerm ? year.terms.indexOf(selectedTerm) + 1 : undefined,
  };
  const preview = buildFeesSMSPreview(message, 'both', context, options);
  useImperativeHandle(ref, () => ({ review: () => {
    if (preview.issues.length) return;
    setReviewRequest(previous => previous && JSON.stringify(previous) === JSON.stringify(preview) ? previous : preview);
    setShowReview(true);
  } }));
  const selectClass = 'min-h-10 w-full rounded-md border border-input bg-background px-2 text-sm';
  return (
    <>
      <SMSCustomisation options={options} onChange={onOptionsChange} onInsertField={onInsertField} onInsertText={onInsertText} allowFees={false}>
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold">Academic period</legend>
          <div className="space-y-1.5">
            <Label htmlFor="bulk-sms-year">Academic year</Label>
            <select id="bulk-sms-year" value={year?.id || ''} onChange={event => { setYearId(event.target.value); setTermId(''); }} className={selectClass}>
              <option value="" disabled>Choose year</option>{academicYears.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bulk-sms-term">Term</Label>
            <select id="bulk-sms-term" value={effectiveTermId} onChange={event => { setTermId(event.target.value); }} className={selectClass}>
              <option value="" disabled>Choose term</option>{year?.terms.map(term => <option key={term.id} value={term.id}>{term.name}</option>)}
            </select>
          </div>
        </fieldset>
      </SMSCustomisation>
      {active && message.trim() && (
        <div className="space-y-2 rounded-xl border p-3 text-xs dark:border-slate-700" aria-label="Personalised SMS estimate">
          <p className="font-semibold">{preview.messages.length} messages · {preview.segments} SMS segments · Estimated Shs. {(preview.segments * 35).toLocaleString('en-US')}</p>
          <p>{preview.manualSkipped.length} manual numbers excluded</p>
          <p className="text-muted-foreground">Each final message is reviewed before sending. Personalised messages can be sent now; scheduling is available for standard messages.</p>
          {preview.issues.length > 0 && <ul role="alert" className="max-h-32 list-inside list-disc overflow-auto text-amber-700 dark:text-amber-300">{preview.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
        </div>
      )}
      {reviewRequest && <BulkSMSModal isOpen={showReview} onClose={() => setShowReview(false)} {...context} previewRequest={reviewRequest} currentPreview={preview} onEdit={() => setShowReview(false)} currentUser={{ displayName: sentBy }} onCompleted={onCompleted} />}
    </>
  );
});
