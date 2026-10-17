'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import type { AcademicYear, Class, Guardian, Pupil } from '@/types';
import { useTermStatus } from '@/lib/hooks/use-term-status';
import { useProgressiveFees, type PupilFeesInfo } from '@/lib/hooks/use-progressive-fees';
import { buildFeesSMSPreview, type FeesSMSOptions, type FeesSMSPreview } from '@/lib/utils/fees-sms';
import { SMSCustomisation } from './SMSCustomisation';
import { BulkSMSModal } from '@/components/fees/BulkSMSModal';
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
  onInsert: (text: string) => void;
  pupils: Pupil[];
  classes: Class[];
  recipients: PupilSMSRecipient[];
  manualNumbers: string[];
  active: boolean;
  sentBy: string;
  onCompleted: () => void;
}
interface FeesData {
  scope: string;
  pupilFeesInfo: Record<string, PupilFeesInfo>;
  loading: boolean;
  error: string | null;
}

// Mount only when the draft uses fees; ordinary bulk SMS adds no fee reads.
function FeesLoader({ pupils, year, termId, years, scope, onData }: {
  pupils: Pupil[]; year: AcademicYear | null; termId: string; years: AcademicYear[]; scope: string; onData: (data: FeesData) => void;
}) {
  const data = useProgressiveFees({ pupils, selectedYear: year, selectedTermId: termId, academicYears: years, enabled: Boolean(year && termId && pupils.length) });
  useEffect(() => {
    onData({ scope, pupilFeesInfo: data.pupilFeesInfo, loading: data.isProcessing || data.isLoading, error: data.error });
  }, [scope, data.pupilFeesInfo, data.isProcessing, data.isLoading, data.error, onData]);
  return null;
}

export const BulkSMSPersonalisation = forwardRef<BulkSMSPersonalisationHandle, Props>(function BulkSMSPersonalisation({
  message, options, onOptionsChange, onInsert, pupils, classes, recipients, manualNumbers, active, sentBy, onCompleted,
}, ref) {
  const { academicYears, effectiveTerm } = useTermStatus();
  const [yearId, setYearId] = useState('');
  const [termId, setTermId] = useState('');
  const [feeId, setFeeId] = useState('');
  const [fees, setFees] = useState<FeesData | null>(null);
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
  const needsFees = Boolean(options.minimumBalance?.trim()) || /\{(?:total_fees|amount_paid|balance|fee_item)\}/.test(message);
  const scope = JSON.stringify([selectedPupils.map(pupil => pupil.id).sort(), year?.id, effectiveTermId]);
  const matchingFees = fees?.scope === scope ? fees : null;
  const info = matchingFees?.pupilFeesInfo;
  const feeItems = useMemo(() => {
    const items = new Map<string, string>();
    for (const pupil of selectedPupils) for (const fee of info?.[pupil.id]?.applicableFees || []) items.set(fee.feeStructureId, fee.name);
    return [...items].sort((a, b) => a[1].localeCompare(b[1]));
  }, [info, selectedPupils]);
  const context = {
    pupils: selectedPupils, classes, pupilFeesInfo: info || {}, recipientGuardians, manualNumbers,
    selectedFeeId: feeId, feeItemName: feeItems.find(([id]) => id === feeId)?.[1], yearName: year?.name,
    termName: year?.terms.find(term => term.id === effectiveTermId)?.name,
    isFeesLoading: needsFees && (!year || !effectiveTermId || !matchingFees || matchingFees.loading || selectedPupils.some(pupil => !info?.[pupil.id])),
    feesError: matchingFees?.error,
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
      {needsFees && <FeesLoader key={scope} pupils={selectedPupils} year={year} termId={effectiveTermId} years={academicYears} scope={scope} onData={setFees} />}
      <SMSCustomisation options={options} onChange={onOptionsChange} onInsert={onInsert}>
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold">Fee period</legend>
          <div className="space-y-1.5">
            <Label htmlFor="bulk-sms-year">Academic year</Label>
            <select id="bulk-sms-year" value={year?.id || ''} onChange={event => { setYearId(event.target.value); setTermId(''); setFeeId(''); }} className={selectClass}>
              <option value="" disabled>Choose year</option>{academicYears.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bulk-sms-term">Term</Label>
            <select id="bulk-sms-term" value={effectiveTermId} onChange={event => { setTermId(event.target.value); setFeeId(''); }} className={selectClass}>
              <option value="" disabled>Choose term</option>{year?.terms.map(term => <option key={term.id} value={term.id}>{term.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="bulk-sms-fee">Fee item</Label>
            <select id="bulk-sms-fee" value={feeId} onChange={event => setFeeId(event.target.value)} className={selectClass}>
              <option value="">All fees</option>{feeItems.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">Fee choices load when a fee field or balance exclusion is used.</p>
          </div>
        </fieldset>
      </SMSCustomisation>
      {active && message.trim() && (
        <div className="space-y-2 rounded-xl border p-3 text-xs dark:border-slate-700" aria-label="Personalised SMS estimate">
          <p className="font-semibold">{preview.messages.length} messages · {preview.segments} SMS segments · Estimated Shs. {(preview.segments * 35).toLocaleString('en-US')}</p>
          <p>{preview.excluded.length} pupils excluded by balance · {preview.manualSkipped.length} manual numbers excluded</p>
          <p className="text-muted-foreground">Each final message is reviewed before sending. Personalised messages can be sent now; scheduling is available for standard messages.</p>
          {preview.issues.length > 0 && <ul role="alert" className="max-h-32 list-inside list-disc overflow-auto text-amber-700 dark:text-amber-300">{preview.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
        </div>
      )}
      {reviewRequest && <BulkSMSModal isOpen={showReview} onClose={() => setShowReview(false)} {...context} previewRequest={reviewRequest} currentPreview={preview} onEdit={() => setShowReview(false)} currentUser={{ displayName: sentBy }} onCompleted={onCompleted} />}
    </>
  );
});
