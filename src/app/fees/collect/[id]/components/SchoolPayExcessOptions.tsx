'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/lib/contexts/auth-context';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { schoolPayReceiptSummary, schoolPaySiblingShares, type SchoolPayExcessPreview } from '@/lib/utils/schoolpay-excess';
import type { AcademicYear, Pupil } from '@/types';
import { formatPupilDisplayName } from '@/lib/utils/name-formatter';
import type { GroupedSchoolPayTx } from './SchoolPayPaymentBanner';

const fmt = (amount: number) => `UGX ${new Intl.NumberFormat('en-UG', { maximumFractionDigits: 0 }).format(amount)}`;
const buttonClass = 'rounded-full border border-brand-secondary-alt-300 px-3 py-1.5 text-xs font-semibold text-brand-secondary-alt-ink-800 hover:bg-brand-secondary-alt-surface-100 disabled:opacity-50 dark:border-brand-secondary-alt-700 dark:text-brand-secondary-alt-ink-200 dark:hover:bg-brand-secondary-alt-surface-900/50';

export function SchoolPayExcessOptions({ transaction, pupil, years, hasSiblings, initialOpen = false, onTransferred }: {
  transaction: GroupedSchoolPayTx;
  pupil: Pupil;
  years: AcademicYear[];
  hasSiblings: boolean;
  initialOpen?: boolean;
  onTransferred?: (pupilIds: string[]) => void;
}) {
  const { user } = useAuth();
  const canTransfer = GranularPermissionService.canPerformAction(user, 'fees', 'collect', 'record_payment')
    && GranularPermissionService.canPerformAction(user, 'fees', 'collect', 'revert_payment');
  const summary = schoolPayReceiptSummary(transaction.payments, years);
  const originalOwner = transaction.payments.every(payment => !(payment as any).schoolPayOriginalPupilId || (payment as any).schoolPayOriginalPupilId === pupil.id);
  const [open, setOpen] = useState(initialOpen);
  const [kept, setKept] = useState(false);
  const [preview, setPreview] = useState<SchoolPayExcessPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [target, setTarget] = useState('');
  const [success, setSuccess] = useState('');
  const operation = useRef('');
  const storageKey = `schoolpay-keep-excess:${pupil.id}:${transaction.key}`;
  useEffect(() => {
    try { setKept(localStorage.getItem(storageKey) === 'yes'); } catch { /* Choice can still be kept for this visit. */ }
  }, [storageKey]);

  const load = useCallback(async () => {
    setLoading(true); setError(''); setTarget(''); setPreview(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Your session is not ready. Please retry.');
      const response = await fetch(`/api/schoolpay/excess?pupilId=${encodeURIComponent(pupil.id)}&receipt=${encodeURIComponent(transaction.key)}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load sibling balances.');
      setPreview(data);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not load sibling balances.'); }
    finally { setLoading(false); }
  }, [pupil.id, transaction.key]);
  useEffect(() => {
    if ((summary?.excessAmount || 0) > 0 && originalOwner && open && !kept && hasSiblings && canTransfer && !preview && !loading && !error && !success) void load();
  }, [summary?.excessAmount, originalOwner, open, kept, hasSiblings, canTransfer, preview, loading, error, success, load]);

  if (!summary || !originalOwner || (summary.excessAmount <= 0 && summary.transferredAmount <= 0)) return null;
  const choose = (value: string) => { setTarget(value); operation.current = crypto.randomUUID(); setError(''); };
  const selected = preview?.siblings.filter(sibling => target === 'all' || sibling.pupilId === target) || [];
  const shares = preview ? schoolPaySiblingShares(preview.excessAmount, selected) : [];
  const transferAmount = shares.reduce((sum, share) => sum + share.amount, 0);
  const keep = () => {
    setKept(true); setTarget(''); setOpen(false); setError('');
    try { localStorage.setItem(storageKey, 'yes'); } catch { /* This is a display choice; no money moves. */ }
  };
  const transfer = async () => {
    if (!preview || !target || submitting || transferAmount <= 0) return;
    setSubmitting(true); setError('');
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Your session is not ready. Please retry.');
      const response = await fetch('/api/schoolpay/excess', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pupilId: pupil.id, receipt: transaction.key, target, version: preview.version, operationId: operation.current }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not transfer the excess.');
      setSuccess(`${fmt(data.transferAmount)} transferred. ${fmt(data.remainingExcess)} remains with ${formatPupilDisplayName(pupil)} for future fees or advance.`);
      setTarget('');
      onTransferred?.(data.pupilIds);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not transfer the excess.'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="mt-3 rounded-xl border border-brand-secondary-alt-200 bg-white/80 p-3 text-sm text-slate-700 dark:border-brand-secondary-alt-800 dark:bg-slate-950/70 dark:text-slate-200">
      <p className="font-semibold text-brand-secondary-alt-ink-900 dark:text-brand-secondary-alt-ink-200">Payment exceeded the amount needed through this term</p>
      <p className="mt-1 text-xs leading-relaxed">
        {fmt(summary.receivedAmount)} received for {formatPupilDisplayName(pupil)}. {fmt(summary.appliedThroughOrigin)} covered previous/current fees.
        {summary.futureAmount > 0 && <> Excess of {fmt(summary.futureAmount)} was pushed to {summary.futureTerms.join(', ')}.</>}
        {summary.advanceAmount > 0 && <> {fmt(summary.advanceAmount)} remains as advance.</>}
        {summary.transferredAmount > 0 && <> {fmt(summary.transferredAmount)} has been transferred to siblings.</>}
      </p>
      {success ? <p role="status" className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">{success}</p> : (
        <>
          {kept && <p role="status" className="mt-2 text-xs">Kept for {formatPupilDisplayName(pupil)}. The distribution remains as it is.</p>}
          {summary.excessAmount > 0 && hasSiblings && canTransfer && (
            <>
              {(!open || kept) && <button type="button" className={`${buttonClass} mt-2`} onClick={() => { setKept(false); setOpen(true); }}>Transfer excess to siblings</button>}
              {open && !kept && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium">Transfer only the excess. Sibling balances include earlier unpaid terms.</p>
                  {loading && <p role="status" className="text-xs">Loading current sibling balances…</p>}
                  {preview && !preview.canTransfer && <p className="text-xs">The available excess or pupil balances have changed. Keep the distribution or use Redistribute to review it.</p>}
                  {preview?.siblings.map(sibling => (
                    <div key={sibling.pupilId} className="flex items-center justify-between gap-2 rounded-lg bg-brand-secondary-alt-surface-50 p-2 dark:bg-brand-secondary-alt-surface-950/50">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold">{sibling.name}</p>
                        <p className="text-xs">Current balance: {fmt(sibling.balance)}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Previous: {fmt(sibling.previousBalance)} · This term: {fmt(sibling.termBalance)}</p>
                      </div>
                      <button type="button" aria-label={`Transfer excess here to ${sibling.name}`} className={buttonClass} disabled={submitting || !preview.canTransfer || sibling.balance <= 0} onClick={() => choose(sibling.pupilId)}>Here</button>
                    </div>
                  ))}
                  {preview && preview.siblings.length > 1 && <button type="button" className={buttonClass} disabled={submitting || !preview.canTransfer || preview.siblings.every(sibling => sibling.balance <= 0)} onClick={() => choose('all')}>All — distribute between them</button>}
                  {target && preview && <div className="rounded-lg border border-brand-secondary-alt-200 p-3 text-xs dark:border-brand-secondary-alt-800">
                    <p className="font-semibold">Review transfer of {fmt(transferAmount)}</p>
                    {shares.filter(share => share.amount > 0).map(share => <p key={share.pupilId}>{preview.siblings.find(sibling => sibling.pupilId === share.pupilId)?.name}: {fmt(share.amount)}</p>)}
                    {target === 'all' && transferAmount < selected.reduce((sum, sibling) => sum + sibling.balance, 0) && <p className="mt-1">The excess is shared in proportion to each sibling’s balance.</p>}
                    <p className="mt-1">{fmt(preview.excessAmount - transferAmount)} stays with {formatPupilDisplayName(pupil)}. Earlier/current fee payments stay in place.</p>
                    <button type="button" className={`${buttonClass} mt-2 bg-brand-secondary-alt-surface-600 !text-white hover:bg-brand-secondary-alt-surface-700 dark:bg-brand-secondary-alt-surface-600`} disabled={submitting || transferAmount <= 0} onClick={transfer}>{submitting ? 'Transferring…' : 'Confirm excess transfer'}</button>
                    <button type="button" className={`${buttonClass} ml-2 mt-2`} disabled={submitting} onClick={() => setTarget('')}>Cancel transfer</button>
                  </div>}
                  {error && <div role="alert" className="text-xs text-red-700 dark:text-red-300">{error} <button type="button" className="underline" disabled={submitting} onClick={load}>Reload balances</button></div>}
                </div>
              )}
            </>
          )}
          {summary.excessAmount > 0 && !kept && <button type="button" className={`${buttonClass} mt-2`} disabled={submitting} onClick={keep}>Keep</button>}
        </>
      )}
    </div>
  );
}
