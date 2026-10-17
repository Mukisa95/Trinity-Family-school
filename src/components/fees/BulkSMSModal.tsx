'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SMSComposer, type SMSComposerHandle } from '@/components/BulkSMS/SMSComposer';
import { Label } from '@/components/ui/label';
import { MessageSquare, Send, Eye, ArrowLeft } from 'lucide-react';
import { SMSService } from '@/lib/services/sms.service';
import { FieldError, FormErrorSummary } from '@/components/ui/form-feedback';
import { useFormValidation } from '@/lib/utils/form-validation';
import { SMSCustomisation } from '@/components/BulkSMS/SMSCustomisation';
import {
  buildFeesSMSPreview, sendFeesSMSMessages,
  type FeesSMSContext, type FeesSMSDelivery, type FeesSMSParents, type FeesSMSOptions, type FeesSMSPreview,
} from '@/lib/utils/fees-sms';

interface BulkSMSModalProps extends FeesSMSContext {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: { displayName?: string; email?: string; firstName?: string; lastName?: string; username?: string };
  previewRequest?: FeesSMSPreview;
  currentPreview?: FeesSMSPreview;
  onEdit?: () => void;
  onCompleted?: () => void;
}

const PARENT_OPTIONS = [['first', 'First parent'], ['second', 'Second parent'], ['both', 'Both parents']] as const;
const ESTIMATED_PRICE_PER_SMS = 35;

export function BulkSMSModal({ isOpen, onClose, currentUser, previewRequest, currentPreview, onEdit, onCompleted, ...context }: BulkSMSModalProps) {
  const [parents, setParents] = useState<FeesSMSParents>('first');
  const [message, setMessage] = useState('');
  const [options, setOptions] = useState<FeesSMSOptions>({});
  const [review, setReview] = useState<FeesSMSPreview | null>(previewRequest || null);
  const [deliveries, setDeliveries] = useState<FeesSMSDelivery[]>([]);
  const [isSending, setIsSending] = useState(false);
  const sendingRef = useRef(false);
  const composerRef = useRef<SMSComposerHandle>(null);
  const { pupils, classes, pupilFeesInfo, selectedFeeId, feeItemName, yearName, termName, termNumber, allowFees, isFeesLoading, feesError } = context;
  const preview = useMemo(() => buildFeesSMSPreview(message, parents, {
    pupils, classes, pupilFeesInfo, selectedFeeId, feeItemName, yearName, termName, termNumber, allowFees, isFeesLoading, feesError,
  }, options), [
    message, parents, pupils, classes, pupilFeesInfo, selectedFeeId, feeItemName,
    yearName, termName, termNumber, allowFees, isFeesLoading, feesError, options,
  ]);
  useEffect(() => {
    if (previewRequest && !sendingRef.current) {
      setReview(previewRequest);
      setDeliveries([]);
    }
  }, [previewRequest]);
  const form = useFormValidation([
    { id: 'fees-sms-message', label: 'Message', value: message, required: true, message: 'Enter the message to send.' },
  ]);
  const reviewedMessages = review?.messages || [];
  const pending = reviewedMessages.filter(item => !deliveries.some(result => result.id === item.id));
  const accepted = deliveries.filter(result => result.status === 'sent').length;
  const needsReview = deliveries.filter(result => result.status === 'review').length;
  const started = deliveries.length > 0;
  const changed = Boolean(review && !started && JSON.stringify(review) !== JSON.stringify(currentPreview || preview));

  const handleReview = () => {
    if (!form.validateAll().isValid) return;
    if (preview.issues.length) return;
    setReview(preview);
    setDeliveries([]);
    form.resetValidation();
  };
  const handleSend = async () => {
    if (sendingRef.current || !review || changed || !pending.length || review.issues.length) return;
    sendingRef.current = true;
    setIsSending(true);
    const sentBy = currentUser?.displayName || [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(' ') || currentUser?.username || currentUser?.email || 'Admin';
    try {
      const completed: FeesSMSDelivery[] = [];
      await sendFeesSMSMessages(pending, sentBy, request => SMSService.sendBulkSMS(request), result => {
        completed.push(result);
        setDeliveries(previous => [...previous, result]);
      });
      if (completed.length === pending.length && [...deliveries, ...completed].every(result => result.status === 'sent')) onCompleted?.();
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  };
  const handleClose = () => {
    if (sendingRef.current) return;
    if (!previewRequest && started && !pending.length && !needsReview) {
      setMessage('');
      setReview(null);
      setDeliveries([]);
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) handleClose(); }}>
      <DialogContent className="flex max-w-2xl flex-col" onEscapeKeyDown={event => { if (sendingRef.current) event.preventDefault(); }} onPointerDownOutside={event => { if (sendingRef.current) event.preventDefault(); }}>
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 pr-8 text-lg">
            <MessageSquare className="h-5 w-5 text-brand-ink-600 dark:text-brand-ink-400" />
            {review ? 'Review personalised SMS' : 'Fees collection SMS'}
          </DialogTitle>
          <DialogDescription>
            {review ? 'Check each message and phone number before sending.' : 'Write a message to the parents of the selected pupils.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 min-w-0 space-y-4 overflow-y-auto pr-1">
          <div className="rounded-xl border border-brand-200 bg-brand-surface-50 px-3 py-2 text-xs text-brand-ink-900 dark:border-brand-800 dark:bg-brand-surface-950/40 dark:text-brand-ink-100">
            {(review || preview).scope}
            {allowFees !== false && <p className="mt-1 text-brand-ink-700 dark:text-brand-ink-300">Amounts use the fee item and academic period selected on the collection page.</p>}
          </div>

          {!review ? (
            <>
              <FormErrorSummary errors={form.errors} submissionError={form.submissionError} onSelectError={form.focusField} />
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-semibold">Send to</legend>
                <div className="grid grid-cols-3 gap-2">
                  {PARENT_OPTIONS.map(([value, label]) => (
                    <label key={value} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border p-2 text-xs sm:p-3 sm:text-sm ${parents === value ? 'border-brand-500 bg-brand-surface-50 text-brand-ink-900 dark:bg-brand-surface-950/50 dark:text-brand-ink-100' : 'border-slate-200 dark:border-slate-700'}`}>
                      <input type="radio" name="fees-sms-parents" value={value} checked={parents === value} onChange={() => setParents(value)} className="accent-brand-600" />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="space-y-2">
                <Label htmlFor="fees-sms-message">Message <span className="text-red-600">*</span></Label>
                <SMSComposer ref={composerRef} id="fees-sms-message" aria-label="Message" value={message} placeholder="Type your message..." onChange={value => { setMessage(value); form.handleFieldChange('fees-sms-message'); }} {...form.getFieldProps('fees-sms-message')} />
                <FieldError error={form.getFieldError('fees-sms-message')} />
                <SMSCustomisation options={options} onChange={setOptions} onInsertField={field => composerRef.current?.insertField(field)} onInsertText={text => composerRef.current?.insertText(text)} onConditional={() => composerRef.current?.markBalanceSelection()}>
                  <Button type="button" variant="link" size="sm" className="h-auto px-0 text-xs" onClick={() => setMessage('Dear {guardian_name}, {pupil_name} in {class} has a {fee_item} balance of {balance} for {term}, {year}. Please arrange payment.')}>Use fees reminder example</Button>
                </SMSCustomisation>
              </div>
              {message.trim() && preview.issues.length > 0 && (
                <div role="alert" className="max-h-32 overflow-auto rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  <ul className="list-inside list-disc space-y-1">{preview.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>
                </div>
              )}
            </>
          ) : (
            <>
              {changed && <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">Pupil details or fees changed. Go back and review the updated messages before sending.</p>}
              {(started || isSending) && (
                <div role="status" aria-live="polite" className="rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">
                  {accepted} accepted · {needsReview} need checking · {pending.length} not yet attempted
                  {isSending && <p className="mt-1">Sending messages. Keep this window open.</p>}
                  {needsReview > 0 && <p className="mt-1">Sending stopped after an unconfirmed result. Check SMS history for those messages. Continuing sends only messages not yet attempted.</p>}
                </div>
              )}
              <div className="max-h-[38dvh] space-y-2 overflow-y-auto rounded-xl border p-2 dark:border-slate-700" aria-label="Personalised message previews" tabIndex={0}>
                {reviewedMessages.map(item => {
                  const result = deliveries.find(delivery => delivery.id === item.id);
                  return (
                    <article key={item.id} className="min-w-0 rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
                      <p className="break-words text-sm font-semibold">{item.pupilNames.join(', ')}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.phone} · {item.segments} SMS</p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm">{item.message}</p>
                      {result && <p className={`mt-2 text-xs font-medium ${result.status === 'sent' ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>{result.detail}</p>}
                    </article>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">A shared parent receives a separate message for each pupil when the personalised text differs. Identical messages to the same number are sent once.</p>
            </>
          )}

          {(review || message.trim()) && (
            <div className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700" aria-label="SMS estimate">
              <p className="font-semibold">{(review || preview).messages.length} {(review || preview).messages.length === 1 ? 'message' : 'messages'} · {(review || preview).segments} SMS {(review || preview).segments === 1 ? 'segment' : 'segments'}</p>
              <p className="mt-1 text-xs text-muted-foreground">Estimated cost: Shs. {((review || preview).segments * ESTIMATED_PRICE_PER_SMS).toLocaleString('en-US')} at Shs. {ESTIMATED_PRICE_PER_SMS} per segment. Final charges depend on your SMS provider.</p>
              {(review || preview).excluded.length > 0 && (
                <details className="mt-2 text-xs" aria-label="Balance exclusions">
                  <summary className="cursor-pointer font-medium text-amber-700 dark:text-amber-300">{(review || preview).excluded.length} {(review || preview).excluded.length === 1 ? 'pupil excluded' : 'pupils excluded'} by the balance threshold</summary>
                  <ul className="mt-2 max-h-24 list-inside list-disc overflow-auto">{(review || preview).excluded.map(item => <li key={item}>{item}</li>)}</ul>
                </details>
              )}
              {(review || preview).skipped.length > 0 && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer font-medium text-amber-700 dark:text-amber-300">{(review || preview).skipped.length} {(review || preview).skipped.length === 1 ? 'pupil has' : 'pupils have'} no valid number for this parent option</summary>
                  <ul className="mt-2 max-h-24 list-inside list-disc overflow-auto">{(review || preview).skipped.map(item => <li key={item}>{item}</li>)}</ul>
                </details>
              )}
              {(review || preview).manualSkipped.length > 0 && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer font-medium text-amber-700 dark:text-amber-300">{(review || preview).manualSkipped.length} manual {(review || preview).manualSkipped.length === 1 ? 'number' : 'numbers'} excluded</summary>
                  <ul className="mt-2 max-h-24 list-inside list-disc overflow-auto">{(review || preview).manualSkipped.map(item => <li key={item}>{item}</li>)}</ul>
                </details>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-0 shrink-0 gap-2 pt-4">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSending}>{started && !pending.length ? 'Done' : 'Close'}</Button>
          {review && !started && <Button type="button" variant="outline" onClick={() => onEdit ? onEdit() : setReview(null)} disabled={isSending}><ArrowLeft className="mr-2 h-4 w-4" />Edit message</Button>}
          {started && !pending.length && !previewRequest && <Button type="button" variant="outline" onClick={() => { setReview(null); setDeliveries([]); setMessage(''); form.resetValidation(); }}>Compose another message</Button>}
          {!review ? (
            <Button type="button" onClick={handleReview} disabled={Boolean(message.trim()) && preview.issues.length > 0}><Eye className="mr-2 h-4 w-4" />Preview messages</Button>
          ) : pending.length > 0 && (
            <Button type="button" onClick={handleSend} disabled={isSending || changed}><Send className="mr-2 h-4 w-4" />{isSending ? 'Sending…' : started ? `Send remaining (${pending.length})` : `Send messages (${pending.length})`}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
