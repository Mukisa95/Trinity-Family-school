'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Bell, CheckCircle2, Clock, Loader2, Phone, Plus, StickyNote } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { useFeeReminders } from '@/lib/hooks/use-fee-reminders';
import {
  canManageFeeReminders, feeReminderPromiseText, feeReminderOutcomeText, getFeeReminderProgress, getFeeReminderSettlement,
  normalizeReminderPhone, parseFeeReminderSchedule, reminderLocalDate, reminderAmountLabel,
  reminderDateLabel, reminderTimeLabel, type CreateFeeReminderInput, type FeeReminder, type FeeReminderRecipient,
} from '@/lib/fees/fee-reminders';
import type { AcademicYear, PaymentRecord, Pupil } from '@/types';
import type { PreviousTermBalance, PupilFee } from '../types';
import {CustomFeeNoteEditor, customFeeChoices} from './CustomFeeNoteEditor';
import {CUSTOM_NOTE_CONDITIONS, type CreateCustomFeeNoteInput} from '@/lib/fees/custom-fee-notes';

interface FeeNotesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pupil: Pupil;
  fees: PupilFee[];
  payments: PaymentRecord[];
  academicYear: AcademicYear;
  termId: string;
  previousBalance: PreviousTermBalance | null;
  isPaymentDataLoading: boolean;
}

function RecipientSelector({ id, value, onChange, users, loading, error }: {
  id: string; value: string[] | null; onChange: (value: string[] | null) => void;
  users: FeeReminderRecipient[]; loading: boolean; error?: string;
}) {
  return <fieldset className="space-y-2">
    <legend className="text-sm font-medium text-slate-900">Who receives the push reminder</legend>
    <Label htmlFor={`${id}-mode`} className="sr-only">Recipient selection</Label>
    <select id={`${id}-mode`} value={value === null ? 'all' : 'selected'} onChange={event =>
      onChange(event.target.value === 'all' ? null : users.map(user => user.id))}
      className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm">
      <option value="all">All active users with Fees access</option><option value="selected">Choose specific people</option>
    </select>
    {value !== null && <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
      {loading ? <p className="p-2 text-sm text-slate-600">Loading eligible recipients…</p>
        : error ? <p role="alert" className="p-2 text-sm text-red-700">{error}</p>
          : !users.length ? <p className="p-2 text-sm text-slate-600">No active users with Fees access are available.</p>
            : users.map(user => <label key={user.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm hover:bg-slate-50">
              <input type="checkbox" checked={value.includes(user.id)} className="h-5 w-5 accent-indigo-600" onChange={event =>
                onChange(event.target.checked ? [...value.filter(item => item !== user.id), user.id] : value.filter(item => item !== user.id))} />
              <span>{user.name} <span className="text-xs text-slate-500">· {user.role}</span></span>
            </label>)}
    </div>}
    <p className="text-xs leading-5 text-slate-500">{value === null ? 'The recipient list follows current Fees access automatically.' : `${value.length} people selected. Only users who still have Fees access will receive the reminder.`}</p>
  </fieldset>;
}

function FeePromiseCard({ note, payments, now, canCancel, cancelling, onCancel, recipients, savingRecipients, onSaveRecipients }: {
  note: FeeReminder; payments: PaymentRecord[]; now: Date;
  canCancel: boolean; cancelling: boolean; onCancel: (reason: string) => void;
  recipients: { data?: FeeReminderRecipient[]; isLoading: boolean; error?: Error | null };
  savingRecipients: boolean; onSaveRecipients: (value: string[] | null) => Promise<void>;
}) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [editingRecipients, setEditingRecipients] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<string[] | null>(note.recipientIds ?? null);
  const [recipientError, setRecipientError] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const custom = note.kind === 'custom';
  const progress = custom ? {status: 'unpaid' as const, paid: 0, remaining: 0, overdue: Date.parse(note.dueAt) <= now.getTime(), completedAt: null, lastPaymentAt: null, paidAfterDeadline: 0, payments: []} : getFeeReminderProgress(note, payments, now);
  const settlement = custom ? progress : getFeeReminderSettlement(note, payments, now);
  const cancelled = note.reminderStatus === 'cancelled';
  const fulfilled = !custom && settlement.status === 'paid';
  const tone = cancelled ? 'border-slate-200 bg-slate-50' : fulfilled ? 'border-emerald-200 bg-emerald-50/70'
    : progress.overdue ? 'border-amber-200 bg-amber-50/70' : 'border-blue-200 bg-blue-50/50';
  const status = cancelled ? 'Cancelled' : custom ? note.reminderStatus === 'sent' ? 'Sent' : note.reminderStatus === 'not_triggered' ? 'Condition not met' : note.customDeliveryPending ? 'Sending' : 'Active' : fulfilled ? 'Promise paid' : progress.status === 'partial' ? 'Partly paid' : 'No payment yet';
  return (
    <article className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{custom ? 'Custom note' : 'Promise'} · {note.feeName}</h3>
        <span className="rounded-full border border-current/15 bg-white/70 px-2 py-1 text-xs font-semibold text-slate-700">{status}</span>
      </div>
      {custom ? <>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{note.renderedMessage || note.liveMessage || note.custom?.message}</p>
        <p className="mt-2 text-sm text-slate-700">Condition: {CUSTOM_NOTE_CONDITIONS[note.custom!.condition.type]}{note.custom?.condition.amount ? ` · ${reminderAmountLabel(note.custom.condition.amount)}` : ''}</p>
        <p className="mt-2 text-xs leading-5 text-slate-600">{note.lastOutcome || 'Inline figures update from the selected fee records. Payment targets count new payments from creation to the deadline.'}</p>
        {note.evaluatedAt && <p className="mt-2 text-xs text-slate-600">Evaluated {reminderDateLabel(note.evaluatedAt)} at {reminderTimeLabel(note.evaluatedAt)}</p>}
        <div className="mt-3 space-y-1 rounded-xl bg-white/60 p-3 text-xs text-slate-700">{(note.evaluatedFees || note.liveFees || []).map((row, index) => <p key={index}>{row.feeName} · {row.academicYearName} {row.termName}: {reminderAmountLabel(row.fees)} fees, {reminderAmountLabel(row.paid)} paid, {reminderAmountLabel(row.balance)} balance</p>)}</div>
        {note.renderedMessage && note.liveMessage && note.renderedMessage !== note.liveMessage && <details className="mt-3 text-sm"><summary className="min-h-11 cursor-pointer py-3">Current figures</summary><p className="whitespace-pre-wrap break-words leading-6">{note.liveMessage}</p></details>}
      </> : <>
        <p className="mt-3 break-words text-sm leading-6 text-slate-800">{feeReminderPromiseText(note, now)}</p>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-800">{feeReminderOutcomeText(note, progress)}</p>
      </>}
      {fulfilled && progress.status !== 'paid' && <p className="mt-2 text-sm font-medium text-emerald-800">The full promised amount is now paid as of {reminderDateLabel(settlement.completedAt!)}. The reminder is dismissed; the deadline record above is retained.</p>}
      {!custom && !cancelled && (
        <div className="mt-3">
          <div className="mb-1 flex flex-wrap justify-between gap-1 text-xs text-slate-600">
            <span>{reminderAmountLabel(progress.paid)} paid within the promise period</span>
            <span>{reminderAmountLabel(progress.remaining)} remaining</span>
          </div>
          <progress aria-label="Promised amount paid" value={Math.min(progress.paid, note.promisedAmount)} max={note.promisedAmount}
            className="h-2 w-full overflow-hidden rounded-full accent-emerald-600" />
        </div>
      )}
      {progress.paidAfterDeadline > 0 && (
        <p className="mt-2 text-xs leading-5 text-slate-600">A further {reminderAmountLabel(progress.paidAfterDeadline)} was paid after the deadline. This is shown separately from payments made within the promise period.</p>
      )}
      {note.additionalNote && <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-white/60 p-3 text-sm text-slate-700">{note.additionalNote}</p>}
      {cancelled && <p className="mt-3 break-words text-sm text-slate-700">Cancelled{note.cancelledByName ? ` by ${note.cancelledByName}` : ''}{note.cancelReason ? `: ${note.cancelReason}` : ''}. Recipients receive an update explaining that this reminder should no longer be used for parent follow-up. Cancellation itself does not confirm payment.</p>}
      {note.cancelledAt && <p className="mt-2 text-xs text-slate-600">Cancelled on {reminderDateLabel(note.cancelledAt)} at {reminderTimeLabel(note.cancelledAt)}</p>}
      {note.resolutionNotificationId && <p className="mt-2 text-xs text-slate-600">{note.dismissalPending ? 'Recipient cancellation update is pending and will retry automatically.' : 'Recipient cancellation update sent.'}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
        <span>{note.academicYearName} · {note.termName}</span>
        <span>Noted by {note.createdByName}</span>
        <span>Created {reminderDateLabel(note.createdAt)} at {reminderTimeLabel(note.createdAt)}</span>
        {note.phone && <span>Contact: {note.phone}</span>}
        <span className="inline-flex items-center gap-1"><Bell className="h-3.5 w-3.5" aria-hidden="true" />
          {cancelled ? 'Reminder cancelled' : fulfilled ? 'Reminder dismissed · promise paid' : note.reminderStatus === 'not_triggered' ? 'No notification · condition not met' : note.reminderStatus === 'sent' ? 'Reminder sent' : note.reminderStatus === 'failed'
            ? 'Reminder delivery failed' : `${custom && ['cleared', 'paid_at_least'].includes(note.custom!.condition.type) ? 'Watching until' : 'Remind on'} ${reminderDateLabel(note.dueAt)} at ${reminderTimeLabel(note.dueAt)}`}
        </span>
      </div>
      <p className="mt-2 break-words text-xs leading-5 text-slate-600">Recipients: {note.recipientIds == null ? 'All active users with Fees access'
        : note.recipientIds.map((id, index) => recipients.data?.find(user => user.id === id)?.name || note.recipientNames?.[index] || 'Selected user').join(', ')}</p>
      {canCancel && !cancelled && !fulfilled && ['scheduled', 'failed'].includes(note.reminderStatus) && (
        editingRecipients ? <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-white/80 p-3">
          <RecipientSelector id={`recipients-${note.id}`} value={selectedRecipients} onChange={setSelectedRecipients}
            users={recipients.data || []} loading={recipients.isLoading} error={recipients.error?.message} />
          {recipientError && <p role="alert" className="text-sm text-red-700">{recipientError}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="min-h-11" disabled={savingRecipients} onClick={() => setEditingRecipients(false)}>Keep current recipients</Button>
            <Button className="min-h-11" disabled={savingRecipients || (selectedRecipients !== null && (!selectedRecipients.length || recipients.isLoading || !!recipients.error))}
              onClick={async () => { try { setRecipientError(''); await onSaveRecipients(selectedRecipients); setEditingRecipients(false); }
                catch (error) { setRecipientError((error as Error).message); } }}>{savingRecipients ? 'Saving…' : 'Save recipients'}</Button>
          </div>
        </div> : <Button variant="outline" className="mt-3 min-h-11 rounded-full" onClick={() => {
          setSelectedRecipients(note.recipientIds ?? null); setRecipientError(''); setEditingRecipients(true);
        }}>Change recipients</Button>
      )}
      {!custom && !cancelled && !fulfilled && (
        <a href={`tel:${note.phone}`} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50">
          <Phone className="h-4 w-4" aria-hidden="true" />Call {note.promisedBy} · {note.phone}
        </a>
      )}
      {canCancel && !cancelled && !fulfilled && note.reminderStatus !== 'not_triggered' && (
        confirmCancel ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-white/80 p-3">
            <p className="text-sm text-slate-700">Cancel this reminder and immediately notify its recipients? The note will stay in the history.</p>
            <Label htmlFor={`fee-note-cancel-${note.id}`} className="mt-3 block">Cancellation reason (optional)</Label>
            <Input id={`fee-note-cancel-${note.id}`} maxLength={400} value={cancelReason} onChange={event => setCancelReason(event.target.value)}
              placeholder="Explain why this follow-up is no longer needed" className="mt-1 min-h-11 rounded-xl" disabled={cancelling} />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="outline" className="min-h-11" disabled={cancelling} onClick={() => setConfirmCancel(false)}>Keep reminder</Button>
              <Button variant="destructive" className="min-h-11" disabled={cancelling} onClick={() => onCancel(cancelReason.trim())}>{cancelling ? 'Cancelling…' : 'Cancel and notify'}</Button>
            </div>
          </div>
        ) : <Button variant="ghost" className="mt-2 min-h-11 text-slate-600" onClick={() => setConfirmCancel(true)}>Cancel reminder</Button>
      )}
    </article>
  );
}

export function FeeNotesModal({ open, onOpenChange, pupil, fees, payments, academicYear, termId, previousBalance, isPaymentDataLoading }: FeeNotesModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { notes, create, cancel, recipients, updateRecipients } = useFeeReminders(pupil.id, open);
  const canManage = canManageFeeReminders(user);
  const [view, setView] = useState<'notes' | 'create' | 'custom'>('notes');
  const [feeId, setFeeId] = useState('');
  const [amount, setAmount] = useState('');
  const [promisedBy, setPromisedBy] = useState('');
  const [phone, setPhone] = useState('');
  const [scheduleDate, setScheduleDate] = useState(() => reminderLocalDate(new Date(Date.now() + 86_400_000)));
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [additionalNote, setAdditionalNote] = useState('');
  const [formError, setFormError] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [recipientIds, setRecipientIds] = useState<string[] | null>(null);
  const pendingSubmission = useRef<{ signature: string; requestId: string } | null>(null);
  const feeOptions = useMemo(() => fees.filter(fee => fee.balance > 0).map(fee => {
    const scopes = fee.id === 'previous-balance'
      ? previousBalance?.breakdown.filter(item => item.balance > 0).map(item => ({
        feeStructureId: item.feeStructureId!, academicYearId: item.academicYearId!, termId: item.termId!,
      })) : undefined;
    return { id: fee.id, name: fee.name, balance: fee.balance, scopes };
  }).filter(fee => fee.id !== 'previous-balance' || (fee.scopes?.length && fee.scopes.every(scope =>
    scope.feeStructureId && scope.academicYearId && scope.termId))), [fees, previousBalance]);
  const selectedFee = feeOptions.find(fee => fee.id === feeId);
  const guardianNames = (pupil.guardians || []).map(guardian => ({
    name: `${guardian.firstName || ''} ${guardian.lastName || ''}`.trim(), phone: guardian.phone || '',
  })).filter(guardian => guardian.name);

  useEffect(() => {
    if (!open) return;
    setView('notes');
    setFormError('');
    setNow(new Date());
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, [open]);

  useEffect(() => {
    if (open && !isPaymentDataLoading) void notes.refetch();
  }, [open, payments, isPaymentDataLoading, notes.refetch]);

  useEffect(() => {
    if (isPaymentDataLoading || !notes.data || !('serviceWorker' in navigator)) return;
    const paidNotes = notes.data.filter(note => note.kind !== 'custom' && getFeeReminderSettlement(note, payments).status === 'paid');
    if (!paidNotes.length) return;
    // Close this device's displayed reminders immediately when its live ledger updates.
    void navigator.serviceWorker.getRegistration().then(async registration => {
      if (!registration) return;
      for (const note of paidNotes) {
        const displayed = await registration.getNotifications({ tag: `fee-reminder-${note.id}` });
        displayed.forEach(notification => notification.close());
      }
    }).catch(error => console.warn('Unable to close paid fee reminders on this device:', error));
  }, [notes.data, payments, isPaymentDataLoading]);

  useEffect(() => {
    if (!feeId && feeOptions.length) setFeeId(feeOptions[0].id);
  }, [feeId, feeOptions]);

  useEffect(() => {
    const guardian = pupil.guardians?.[0];
    if (guardian) {
      setPromisedBy(`${guardian.firstName || ''} ${guardian.lastName || ''}`.trim());
      setPhone(guardian.phone || '');
    }
  }, [pupil.id]);

  let preview = 'Choose a fee, promised amount, person, date and time to personalise this note.';
  const previewDate = new Date(`${scheduleDate}T${scheduleTime}:00+03:00`);
  if (selectedFee && Number(amount) > 0 && promisedBy.trim() && Number.isFinite(previewDate.getTime())) {
    preview = feeReminderPromiseText({
      pupilName: `${pupil.firstName} ${pupil.lastName}`.trim(), feeName: selectedFee.name,
      promisedAmount: Number(amount), promisedBy: promisedBy.trim(), createdAt: now.toISOString(), dueAt: previewDate.toISOString(),
    }, now);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    try {
      if (!selectedFee || isPaymentDataLoading) throw new Error('Wait for the fees to load, then choose an item with a balance.');
      const promisedAmount = Number(amount);
      if (!Number.isSafeInteger(promisedAmount) || promisedAmount <= 0 || promisedAmount > selectedFee.balance) {
        throw new Error('Enter a positive whole-shilling amount within the selected fee balance.');
      }
      if (!promisedBy.trim()) throw new Error('Enter the person who promised to pay.');
      if (recipientIds !== null && (!recipientIds.length || recipients.isLoading || recipients.isError)) {
        throw new Error('Choose at least one eligible recipient, or use all users with Fees access.');
      }
      parseFeeReminderSchedule(scheduleDate, scheduleTime);
      const input = {
        pupilId: pupil.id, feeId: selectedFee.id, academicYearId: academicYear.id, termId,
        ...(selectedFee.scopes ? { scopes: selectedFee.scopes } : {}),
        promisedAmount, promisedBy: promisedBy.trim(), phone: normalizeReminderPhone(phone),
        scheduleDate, scheduleTime, additionalNote: additionalNote.trim(), recipientIds,
      };
      const signature = JSON.stringify(input);
      if (!pendingSubmission.current || pendingSubmission.current.signature !== signature) {
        pendingSubmission.current = { signature, requestId: crypto.randomUUID() };
      }
      await create.mutateAsync({ ...input, requestId: pendingSubmission.current.requestId } as CreateFeeReminderInput);
      pendingSubmission.current = null;
      setAmount(''); setAdditionalNote(''); setView('notes');
      toast({ title: 'Payment promise saved', description: 'Your recipients will be reminded at the chosen time unless the promise is fully paid.' });
    } catch (error) { setFormError(error instanceof Error ? error.message : 'Unable to save this note.'); }
  }

  async function cancelNote(id: string, reason: string) {
    try {
      const result = await cancel.mutateAsync({ id, reason });
      toast({ title: 'Reminder cancelled', description: result.updateStatus === 'pending'
        ? 'The reminder is stopped. The recipient update is saved and will retry automatically.'
        : 'Recipients have been notified. The note remains in the pupil’s history.' });
    } catch (error) {
      toast({ title: 'Unable to cancel reminder', description: (error as Error).message, variant: 'destructive' });
    }
  }

  const noteList = notes.data || [];
  const activeNotes = noteList.filter(note => !['cancelled', 'fulfilled', 'not_triggered'].includes(note.reminderStatus)
    && (note.kind === 'custom' ? note.reminderStatus !== 'sent' : getFeeReminderSettlement(note, payments, now).status !== 'paid'));
  const historyNotes = noteList.filter(note => !activeNotes.includes(note));
  const renderNote = (note: FeeReminder) => <FeePromiseCard key={note.id} note={note} payments={payments} now={now}
    canCancel={canManage && (user?.role === 'Admin' || user?.id === note.createdBy)}
    cancelling={cancel.isPending && cancel.variables?.id === note.id} onCancel={reason => void cancelNote(note.id, reason)}
    recipients={recipients} savingRecipients={updateRecipients.isPending && updateRecipients.variables?.id === note.id}
    onSaveRecipients={async value => { await updateRecipients.mutateAsync({ id: note.id, recipientIds: value }); }} />;
  return (
    <Dialog open={open} onOpenChange={value => { if (!create.isPending && !cancel.isPending && !updateRecipients.isPending) onOpenChange(value); }}>
      <DialogContent className="max-w-2xl gap-4 p-4 sm:p-6">
        <DialogTitle className="flex items-center gap-2 pr-8"><StickyNote className="h-5 w-5 text-indigo-600" aria-hidden="true" />Notes · {pupil.firstName} {pupil.lastName}</DialogTitle>
        <DialogDescription>Promises and custom notes for this pupil. Fee details and payment conditions update automatically.</DialogDescription>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <Button variant={view === 'notes' ? 'default' : 'outline'} className="min-h-11 rounded-full" disabled={create.isPending} onClick={() => setView('notes')}>
            Active notes {isPaymentDataLoading ? '' : `(${activeNotes.length})`}
          </Button>
          {canManage && <div className="flex flex-wrap gap-2"><Button variant={view === 'create' ? 'default' : 'outline'} className="min-h-11 rounded-full" disabled={create.isPending} onClick={() => { setFormError(''); setView('create'); }}><Plus className="mr-1 h-4 w-4" />Promise</Button><Button variant={view === 'custom' ? 'default' : 'outline'} className="min-h-11 rounded-full" disabled={create.isPending} onClick={() => setView('custom')}><Plus className="mr-1 h-4 w-4" />Custom note</Button></div>}
        </div>
        {view === 'custom' && canManage ? <CustomFeeNoteEditor pupil={pupil} choices={customFeeChoices(fees, previousBalance, academicYear, termId)}
          academicYearId={academicYear.id} termId={termId} loading={isPaymentDataLoading} saving={create.isPending}
          onBack={() => setView('notes')} onSave={async (input: CreateCustomFeeNoteInput) => {await create.mutateAsync(input); setView('notes'); toast({title: 'Custom note saved', description: 'The note will notify your recipients when its date or condition is reached.'});}}
          recipients={(value, onChange) => <RecipientSelector id="custom-note-recipients" value={value} onChange={onChange} users={recipients.data || []} loading={recipients.isLoading} error={recipients.error?.message} />}
        /> : view === 'create' && canManage ? (
          <form onSubmit={save} className="min-w-0 space-y-4">
            <fieldset disabled={create.isPending} className="min-w-0 space-y-4">
              <div><Label htmlFor="fee-note-kind">Note type</Label><select id="fee-note-kind" className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm" defaultValue="promise"><option value="promise">Promise</option></select></div>
              <div>
                <Label htmlFor="fee-note-fee">Fee item with a balance</Label>
                <select id="fee-note-fee" value={selectedFee ? feeId : ''} required disabled={isPaymentDataLoading || !feeOptions.length}
                  onChange={event => setFeeId(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm">
                  <option value="">Choose a fee item</option>
                  {feeOptions.map(fee => <option key={fee.id} value={fee.id}>{fee.name} · {reminderAmountLabel(fee.balance)} balance</option>)}
                </select>
                {!feeOptions.length && <p className="mt-1 text-sm text-slate-600">There are no verified unpaid fee items in the selected academic period.</p>}
                <p className="mt-1 text-xs text-slate-500">{academicYear.name} · {academicYear.terms.find(term => term.id === termId)?.name}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><Label htmlFor="fee-note-amount">Amount promised (shillings)</Label><Input id="fee-note-amount" type="number" inputMode="numeric" min="1" step="1" max={selectedFee?.balance} required value={amount} onChange={event => setAmount(event.target.value)} placeholder="20,000" className="mt-1 min-h-11 rounded-xl" /></div>
                <div><Label htmlFor="fee-note-person">Who promised</Label><Input id="fee-note-person" list="fee-note-guardians" required maxLength={120} value={promisedBy} onChange={event => {
                  setPromisedBy(event.target.value); const guardian = guardianNames.find(item => item.name === event.target.value); if (guardian) setPhone(guardian.phone);
                }} placeholder="Parent or guardian’s name" className="mt-1 min-h-11 rounded-xl" /><datalist id="fee-note-guardians">{guardianNames.map((guardian, index) => <option key={`${guardian.name}-${index}`} value={guardian.name} />)}</datalist></div>
                <div><Label htmlFor="fee-note-phone">Phone number</Label><Input id="fee-note-phone" type="tel" inputMode="tel" autoComplete="tel" required maxLength={40} value={phone} onChange={event => setPhone(event.target.value)} placeholder="e.g. 0700 123 456" className="mt-1 min-h-11 rounded-xl" /></div>
                <div><Label htmlFor="fee-note-date">Promised payment date</Label><Input id="fee-note-date" type="date" min={reminderLocalDate(now)} required value={scheduleDate} onChange={event => setScheduleDate(event.target.value)} className="mt-1 min-h-11 rounded-xl" /></div>
                <div><Label htmlFor="fee-note-time">Reminder time</Label><Input id="fee-note-time" type="time" required value={scheduleTime} onChange={event => setScheduleTime(event.target.value)} className="mt-1 min-h-11 rounded-xl" /><p className="mt-1 text-xs text-slate-500">East Africa time · on the promised date</p></div>
              </div>
              <div><Label htmlFor="fee-note-extra">Additional note (optional)</Label><Textarea id="fee-note-extra" maxLength={1000} value={additionalNote} onChange={event => setAdditionalNote(event.target.value)} placeholder="Any other details from the conversation" className="mt-1 rounded-xl" /></div>
              <RecipientSelector id="fee-note-recipients" value={recipientIds} onChange={setRecipientIds}
                users={recipients.data || []} loading={recipients.isLoading} error={recipients.error?.message} />
            </fieldset>
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4" aria-live="polite">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-700">Your note</p>
              <p className="break-words text-sm leading-6 text-slate-800">{preview}</p>
              {additionalNote.trim() && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">{additionalNote.trim()}</p>}
              {phone.trim() && <p className="mt-2 text-sm text-slate-700">Contact: {phone}</p>}
            </div>
            <p className="flex items-start gap-2 text-xs leading-5 text-slate-600"><Bell className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Full payment dismisses this reminder automatically, including payment before the chosen date. Partial payments keep it active.</p>
            {formError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
            <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] pt-3">
              <Button type="button" variant="outline" className="min-h-11 rounded-full" disabled={create.isPending} onClick={() => setView('notes')}>Back to notes</Button>
              <Button type="submit" className="min-h-11 rounded-full" disabled={create.isPending || isPaymentDataLoading || !selectedFee}>{create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}{create.isPending ? 'Saving…' : 'Save reminder'}</Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            {notes.isLoading ? <p className="flex items-center gap-2 py-5 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Loading notes…</p>
              : notes.isError ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><p>{notes.error.message}</p><Button variant="outline" className="mt-2 min-h-11" onClick={() => void notes.refetch()}>Try again</Button></div>
                : !noteList.length ? <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center"><StickyNote className="mx-auto h-7 w-7 text-indigo-500" aria-hidden="true" /><h3 className="mt-3 font-semibold text-slate-900">No notes yet</h3><p className="mt-2 text-sm leading-6 text-slate-600">Create a Promise or a custom note to notify the fees team.</p>{canManage && <Button className="mt-4 min-h-11 rounded-full" onClick={() => setView('create')}><Plus className="mr-1 h-4 w-4" />Promise</Button>}</div>
                  : <>
                    <p className="flex items-center gap-2 text-xs text-slate-600">{isPaymentDataLoading ? <Clock className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} {isPaymentDataLoading ? 'Checking the latest payments…' : 'Payment status updates automatically. Reversed payments are excluded.'}</p>
                    {!isPaymentDataLoading && <>
                      <h3 className="text-sm font-semibold text-slate-900">Active notes · {activeNotes.length}</h3>
                      {activeNotes.length ? activeNotes.map(renderNote) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No active notes. Create a Promise or a custom note.</p>}
                      {historyNotes.length > 0 && <details className="space-y-3 rounded-xl border border-slate-200 p-3">
                        <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-slate-700">Completed and cancelled notes · {historyNotes.length}</summary>
                        {historyNotes.map(renderNote)}
                      </details>}
                    </>}
                  </>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
