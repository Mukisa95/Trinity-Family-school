'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PaymentRecord, FeeStructure, AcademicYear, Pupil } from '@/types';
import type { GroupedSchoolPayTx } from './SchoolPayPaymentBanner';
import { PaymentsService } from '@/lib/services/payments.service';
import { HistoryLogService } from '@/lib/services/history-log.service';
import { filterApplicableFees } from '../utils/feeProcessing';

interface SchoolPayRedistributeModalProps {
  transaction: GroupedSchoolPayTx;
  feeStructures: FeeStructure[];
  allAcademicYears: AcademicYear[];
  pupil: Pupil;
  siblings?: Pupil[];
  selectedTermId: string;
  selectedAcademicYear: AcademicYear;
  allPayments: PaymentRecord[];
  onDone: () => void;
  onClose: () => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n);

const fmtDate = (d: string) =>
  new Date(d).toLocaleString('en-UG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kampala',
  });

/** Build a chronologically sorted flat list of all (year, term) pairs */
function buildAllTermSlots(allYears: AcademicYear[]) {
  const slots: { termId: string; termName: string; yearId: string; yearName: string; startDate: Date }[] = [];
  for (const yr of allYears) {
    for (const t of yr.terms ?? []) {
      slots.push({ termId: t.id, termName: t.name, yearId: yr.id, yearName: yr.name, startDate: new Date(t.startDate) });
    }
  }
  return slots.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

export function SchoolPayRedistributeModal({
  transaction,
  feeStructures,
  allAcademicYears,
  pupil,
  siblings = [],
  selectedTermId,
  selectedAcademicYear,
  allPayments,
  onDone,
  onClose,
}: SchoolPayRedistributeModalProps) {
  const total = transaction.totalAmount;
  const hasSiblings = siblings.length > 0;

  // ─── Distribution target tab ───────────────────────────────────────────────
  const [distributionTarget, setDistributionTarget] = useState<'pupil' | 'family'>('pupil');

  // ─── Single-pupil mode ─────────────────────────────────────────────────────
  const txPaymentIds = useMemo(() => new Set(transaction.payments.map((p: any) => p.id)), [transaction.payments]);
  const otherPayments = useMemo(() => allPayments.filter((p: any) => !txPaymentIds.has(p.id) && !p.reverted), [allPayments, txPaymentIds]);

  const allTermSlots = useMemo(() => buildAllTermSlots(allAcademicYears), [allAcademicYears]);

  const [activeTermIds, setActiveTermIds] = useState<string[]>(() => {
    const txTermIds = new Set((transaction.payments as any[]).map((p: any) => p.termId));
    txTermIds.add(selectedTermId);
    return [...txTermIds];
  });

  const [pickerValue, setPickerValue] = useState('');

  const addTerm = (termId: string) => {
    if (termId && !activeTermIds.includes(termId)) setActiveTermIds(prev => [...prev, termId]);
    setPickerValue('');
  };

  const removeTerm = (termId: string) => {
    if (termId === selectedTermId) return;
    setActiveTermIds(prev => prev.filter(id => id !== termId));
    setAllocations(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (k.startsWith(`${termId}::`)) delete next[k]; });
      return next;
    });
  };

  const termFeeData = useMemo(() => {
    return activeTermIds.map(termId => {
      const slot = allTermSlots.find(s => s.termId === termId);
      if (!slot) return null;
      const termYear = allAcademicYears.find(y => y.id === slot.yearId) ?? selectedAcademicYear;
      const fees = filterApplicableFees(feeStructures, pupil, termId, termYear, allAcademicYears);
      const withBalance = fees.map(fs => {
        const paid = otherPayments
          .filter((p: any) => p.feeStructureId === fs.id && p.termId === termId)
          .reduce((s, p) => s + ((p as any).amount || 0), 0);
        return { fee: fs, paid, balance: Math.max(0, (fs.amount || 0) - paid) };
      });
      return { slot, withBalance, hasAnyBalance: withBalance.some(r => r.balance > 0), isCurrent: termId === selectedTermId };
    }).filter(Boolean) as NonNullable<{
      slot: typeof allTermSlots[0]; withBalance: { fee: FeeStructure; paid: number; balance: number }[];
      hasAnyBalance: boolean; isCurrent: boolean;
    }>[];
  }, [activeTermIds, allTermSlots, feeStructures, pupil, otherPayments, allAcademicYears, selectedAcademicYear, selectedTermId]);

  // Allocations for single-pupil mode: keyed `${termId}::${feeId}`
  const [allocations, setAllocations] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const p of transaction.payments as any[]) {
      if (p.feeStructureId !== 'schoolpay-general') {
        const key = `${p.termId}::${p.feeStructureId}`;
        init[key] = String((parseFloat(init[key] || '0') + (p.amount || 0)));
      }
    }
    return init;
  });

  const setAlloc = (termId: string, feeId: string, val: string) =>
    setAllocations(prev => ({ ...prev, [`${termId}::${feeId}`]: val }));

  const getAlloc = (termId: string, feeId: string) =>
    allocations[`${termId}::${feeId}`] || '';

  const allocatedTotal = Object.values(allocations).reduce((s, v) => {
    const n = parseFloat(v); return s + (isNaN(n) ? 0 : n);
  }, 0);
  const excess = Math.max(0, total - allocatedTotal);
  const overAllocated = allocatedTotal > total;

  // ─── Family mode ───────────────────────────────────────────────────────────
  const [siblingPayments, setSiblingPayments] = useState<Record<string, any[]>>({});
  const [loadingSiblings, setLoadingSiblings] = useState(false);

  // Fetch sibling payments once when family tab is first opened
  useEffect(() => {
    if (distributionTarget === 'family' && siblings.length > 0 && Object.keys(siblingPayments).length === 0) {
      setLoadingSiblings(true);
      Promise.all(
        siblings.map(async (sib) => {
          try {
            const snap = await getDocs(query(collection(db, 'payments'), where('pupilId', '==', sib.id)));
            const payments = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((p: any) => !p.reverted);
            return [sib.id, payments] as [string, any[]];
          } catch {
            return [sib.id, []] as [string, any[]];
          }
        })
      ).then(results => setSiblingPayments(Object.fromEntries(results)))
       .finally(() => setLoadingSiblings(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distributionTarget]);

  // Family allocations: keyed `${pupilId}::${termId}::${feeId}`
  const [familyAllocations, setFamilyAllocations] = useState<Record<string, string>>({});

  const setFamilyAlloc = (pupilId: string, termId: string, feeId: string, val: string) =>
    setFamilyAllocations(prev => ({ ...prev, [`${pupilId}::${termId}::${feeId}`]: val }));

  const getFamilyAlloc = (pupilId: string, termId: string, feeId: string) =>
    familyAllocations[`${pupilId}::${termId}::${feeId}`] || '';

  // Compute fees for current pupil + each sibling (current term only)
  const familyFeeData = useMemo(() => {
    if (distributionTarget !== 'family') return [];

    const members = [
      { person: pupil, payments: otherPayments, isMainPupil: true },
      ...siblings.map(sib => ({
        person: sib,
        payments: (siblingPayments[sib.id] || []).filter((p: any) => !txPaymentIds.has(p.id)),
        isMainPupil: false,
      })),
    ];

    return members.map(({ person, payments, isMainPupil }) => {
      const fees = filterApplicableFees(feeStructures, person, selectedTermId, selectedAcademicYear, allAcademicYears);
      const withBalance = fees.map(fs => {
        const paid = payments
          .filter((p: any) => p.feeStructureId === fs.id && p.termId === selectedTermId)
          .reduce((s: number, p: any) => s + (p.amount || 0), 0);
        return { fee: fs, paid, balance: Math.max(0, (fs.amount || 0) - paid) };
      }).filter(r => r.balance > 0);
      return { person, withBalance, isMainPupil };
    });
  }, [distributionTarget, pupil, siblings, otherPayments, siblingPayments, feeStructures, selectedTermId, selectedAcademicYear, allAcademicYears, txPaymentIds]);

  const familyAllocatedTotal = Object.values(familyAllocations).reduce((s, v) => {
    const n = parseFloat(v); return s + (isNaN(n) ? 0 : n);
  }, 0);
  const familyExcess = Math.max(0, total - familyAllocatedTotal);
  const familyOverAllocated = familyAllocatedTotal > total;

  // ─── Smart distribute ──────────────────────────────────────────────────────
  const handleSmartDistribute = () => {
    let remaining = total;
    const newAlloc: Record<string, string> = {};
    for (const { slot, withBalance } of termFeeData) {
      const sorted = [...withBalance].filter(r => r.balance > 0).sort((a, b) => b.balance - a.balance);
      for (const { fee, balance } of sorted) {
        if (remaining <= 0) break;
        const allocate = Math.min(remaining, balance);
        newAlloc[`${slot.termId}::${fee.id}`] = String(allocate);
        remaining -= allocate;
      }
      if (remaining <= 0) break;
    }
    setAllocations(newAlloc);
  };

  const handleSmartDistributeFamily = () => {
    let remaining = total;
    const newAlloc: Record<string, string> = {};
    for (const { person, withBalance } of familyFeeData) {
      const sorted = [...withBalance].sort((a, b) => b.balance - a.balance);
      for (const { fee, balance } of sorted) {
        if (remaining <= 0) break;
        const allocate = Math.min(remaining, balance);
        newAlloc[`${person.id}::${selectedTermId}::${fee.id}`] = String(allocate);
        remaining -= allocate;
      }
      if (remaining <= 0) break;
    }
    setFamilyAllocations(newAlloc);
  };

  // ─── Submit ────────────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFamily = distributionTarget === 'family';
  const currentAllocatedTotal = isFamily ? familyAllocatedTotal : allocatedTotal;
  const currentExcess = isFamily ? familyExcess : excess;
  const currentOverAllocated = isFamily ? familyOverAllocated : overAllocated;

  const handleSubmit = async () => {
    if (currentOverAllocated) {
      setError(`Allocated (${fmt(currentAllocatedTotal)}) exceeds received (${fmt(total)})`);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      // Step 1: Revert all existing payments from this transaction
      const revertedBy = { id: 'schoolpay-redistribute', name: 'SchoolPay Redistribution', role: 'admin' };
      for (const p of transaction.payments as any[]) await PaymentsService.revertPayment(p.id, revertedBy);

      if (!isFamily) {
        // ── Single-pupil mode ──────────────────────────────────────────────
        for (const [key, val] of Object.entries(allocations)) {
          const n = parseFloat(val);
          if (!isNaN(n) && n > 0) {
            const [termId, feeId] = key.split('::');
            const slot = allTermSlots.find(s => s.termId === termId);
            const feeName = feeStructures.find(f => f.id === feeId)?.name || feeId;
            const isCrossTermPush = termId !== selectedTermId;
            const response = await fetch('/api/payments/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                pupilId: pupil.id,
                academicYearId: slot?.yearId ?? selectedAcademicYear.id,
                termId,
                paymentDate: transaction.paymentDate,
                feeStructureId: feeId,
                amount: n,
                paidBy: { id: 'schoolpay-system', name: transaction.payerName, role: 'Parent/Guardian' },
                paymentMethod: transaction.paymentMethod,
                schoolPayReceiptNumber: transaction.key,
                schoolPayTransactionId: transaction.txRef,
                schoolPayPaymentCode: transaction.payCode,
                source: 'schoolpay',
                notes: `${feeName} (SchoolPay – manual redistribution${isCrossTermPush ? ` pushed to ${slot?.termName} ${slot?.yearName}` : ''}) | Payer: ${transaction.payerName} | Transaction: ${transaction.txRef || ''} | Date: ${fmtDate(transaction.paymentDate)}`,
                skipHistoryLog: true,
                historyContext: {
                  feeName,
                  pupilName: `${pupil.firstName} ${pupil.lastName}`,
                  paymentMethod: transaction.paymentMethod,
                  source: 'schoolpay_redistribution',
                  paidByName: transaction.payerName,
                },
                ...(isCrossTermPush && { schoolPayOriginTermId: selectedTermId, schoolPayOriginYearId: selectedAcademicYear.id }),
              }),
            });
            const result = await response.json();
            await HistoryLogService.log({
              action: 'create',
              entity: 'payment',
              recordId: result.paymentId,
              label: feeName,
              meta: {
                amount: n,
                feeName,
                pupilName: `${pupil.firstName} ${pupil.lastName}`,
                method: transaction.paymentMethod,
                source: 'schoolpay_redistribution',
              },
              actor: { id: 'schoolpay-system', username: transaction.payerName, role: 'Parent/Guardian' },
            });
          }
        }
      } else {
        // ── Family mode ────────────────────────────────────────────────────
        // Group allocations by pupilId
        const byPupil = new Map<string, { termId: string; feeId: string; amount: number }[]>();
        for (const [key, val] of Object.entries(familyAllocations)) {
          const n = parseFloat(val);
          if (!isNaN(n) && n > 0) {
            const [targetPupilId, termId, feeId] = key.split('::');
            if (!byPupil.has(targetPupilId)) byPupil.set(targetPupilId, []);
            byPupil.get(targetPupilId)!.push({ termId, feeId, amount: n });
          }
        }

        const allMembers = [pupil, ...siblings];
        for (const [targetPupilId, entries] of byPupil) {
          const targetPupil = allMembers.find(m => m.id === targetPupilId);
          if (!targetPupil) continue;
          for (const { termId, feeId, amount } of entries) {
            const feeName = feeStructures.find(f => f.id === feeId)?.name || feeId;
            const response = await fetch('/api/payments/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                pupilId: targetPupilId,
                academicYearId: selectedAcademicYear.id,
                termId,
                paymentDate: transaction.paymentDate,
                feeStructureId: feeId,
                amount,
                paidBy: { id: 'schoolpay-system', name: transaction.payerName, role: 'Parent/Guardian' },
                paymentMethod: transaction.paymentMethod,
                schoolPayReceiptNumber: transaction.key,
                schoolPayTransactionId: transaction.txRef,
                schoolPayPaymentCode: transaction.payCode,
                source: 'schoolpay',
                notes: `${feeName} (SchoolPay – family redistribution) | For: ${targetPupil.firstName} ${targetPupil.lastName} | Payer: ${transaction.payerName} | Transaction: ${transaction.txRef || ''} | Date: ${fmtDate(transaction.paymentDate)}`,
                skipHistoryLog: true,
                historyContext: {
                  feeName,
                  pupilName: `${targetPupil.firstName} ${targetPupil.lastName}`,
                  paymentMethod: transaction.paymentMethod,
                  source: 'schoolpay_family_redistribution',
                  paidByName: transaction.payerName,
                },
              }),
            });
            const result = await response.json();
            await HistoryLogService.log({
              action: 'create',
              entity: 'payment',
              recordId: result.paymentId,
              label: feeName,
              meta: {
                amount,
                feeName,
                pupilName: `${targetPupil.firstName} ${targetPupil.lastName}`,
                method: transaction.paymentMethod,
                source: 'schoolpay_family_redistribution',
              },
              actor: { id: 'schoolpay-system', username: transaction.payerName, role: 'Parent/Guardian' },
            });
          }
        }
      }

      // Excess/advance always goes to current (main) pupil
      if (currentExcess > 0) {
        await fetch('/api/payments/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pupilId: pupil.id,
            academicYearId: selectedAcademicYear.id,
            termId: selectedTermId,
            paymentDate: transaction.paymentDate,
            feeStructureId: 'schoolpay-general',
            amount: currentExcess,
            paidBy: { id: 'schoolpay-system', name: transaction.payerName, role: 'Parent/Guardian' },
            paymentMethod: transaction.paymentMethod,
            schoolPayReceiptNumber: transaction.key,
            schoolPayTransactionId: transaction.txRef,
            schoolPayPaymentCode: transaction.payCode,
            source: 'schoolpay',
            notes: `Advance/Excess (SchoolPay – ${isFamily ? 'family ' : ''}redistribution) | ${transaction.txRef || ''}`,
          }),
        });
      }

      onDone(); onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to redistribute. Please try again.');
    } finally { setIsSubmitting(false); }
  };

  const availableToAdd = allTermSlots.filter(s => !activeTermIds.includes(s.termId));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-700 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚡</span>
              <h2 className="text-base font-bold">Redistribute SchoolPay Payment</h2>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-sm transition-colors">✕</button>
          </div>
          <p className="text-xs text-violet-200 mt-1">
            Total: <span className="font-bold text-white">{fmt(total)}</span>
            {' '}· {fmtDate(transaction.paymentDate)}
            {transaction.payerName && transaction.payerName !== '—' && <span> · {transaction.payerName}</span>}
          </p>

          {/* Target tabs — only shown when pupil has siblings */}
          {hasSiblings && (
            <div className="flex items-center gap-1.5 mt-3">
              <button
                onClick={() => setDistributionTarget('pupil')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  distributionTarget === 'pupil'
                    ? 'bg-white text-violet-700 shadow'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                This pupil
              </button>
              <button
                onClick={() => setDistributionTarget('family')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  distributionTarget === 'family'
                    ? 'bg-white text-violet-700 shadow'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Family ({siblings.length + 1})
              </button>
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {distributionTarget === 'pupil' ? (
            <>
              {/* Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-gray-600 flex-1">Allocate across terms. Only fees with outstanding balance are shown.</p>
                <button onClick={handleSmartDistribute}
                  className="text-xs px-3 py-1.5 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-full font-semibold transition-colors whitespace-nowrap">
                  ⚡ Smart Distribute
                </button>
              </div>

              {/* Add term picker */}
              {availableToAdd.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    value={pickerValue}
                    onChange={e => addTerm(e.target.value)}
                    className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 text-gray-700"
                  >
                    <option value="">+ Add another term to redistribute into…</option>
                    {availableToAdd.map(s => (
                      <option key={s.termId} value={s.termId}>{s.termName} {s.yearName}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Per-term sections */}
              {termFeeData.map(({ slot, withBalance, hasAnyBalance, isCurrent }) => (
                <div key={slot.termId} className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className={`px-4 py-2 flex items-center justify-between ${isCurrent ? 'bg-violet-50 border-b border-violet-100' : 'bg-fuchsia-50 border-b border-fuchsia-100'}`}>
                    <div className="flex items-center gap-2">
                      {!isCurrent && <span className="text-fuchsia-500 text-xs font-bold">→</span>}
                      <span className={`text-sm font-bold ${isCurrent ? 'text-violet-800' : 'text-fuchsia-800'}`}>
                        {slot.termName} {slot.yearName}
                      </span>
                      {isCurrent
                        ? <span className="text-[10px] bg-violet-200 text-violet-700 rounded-full px-2 py-0.5">Current</span>
                        : <span className="text-[10px] bg-fuchsia-200 text-fuchsia-700 rounded-full px-2 py-0.5">Added</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {hasAnyBalance ? `${withBalance.filter(r => r.balance > 0).length} fee(s) due` : '✅ Settled'}
                      </span>
                      {!isCurrent && (
                        <button onClick={() => removeTerm(slot.termId)}
                          className="text-xs text-gray-400 hover:text-red-500 transition-colors">✕</button>
                      )}
                    </div>
                  </div>
                  {!hasAnyBalance ? (
                    <div className="px-4 py-3 text-sm text-gray-400 italic">All fees in this term are fully paid.</div>
                  ) : (
                    <div className="p-3 space-y-2">
                      {withBalance.filter(r => r.balance > 0).map(({ fee, paid, balance }) => (
                        <div key={fee.id} className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{fee.name}</p>
                              <p className="text-[10px] text-gray-400">
                                Total: {fmt(fee.amount || 0)} · Paid: {fmt(paid)} · Balance: {fmt(balance)}
                              </p>
                            </div>
                            <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-medium">{fmt(balance)} due</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-14 shrink-0">Allocate:</span>
                            <input
                              type="number" min={0} max={total} step={100}
                              value={getAlloc(slot.termId, fee.id)}
                              onChange={e => setAlloc(slot.termId, fee.id, e.target.value)}
                              placeholder="0"
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                            <button
                              onClick={() => {
                                const cur = parseFloat(getAlloc(slot.termId, fee.id)) || 0;
                                const available = total - (allocatedTotal - cur);
                                setAlloc(slot.termId, fee.id, String(Math.min(balance, available)));
                              }}
                              className="text-xs px-2 py-1 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-lg transition-colors whitespace-nowrap"
                            >Max</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          ) : (
            // ── Family mode UI ─────────────────────────────────────────────
            <>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-gray-600 flex-1">
                  Distribute across all {siblings.length + 1} family members for the current term.
                </p>
                {!loadingSiblings && (
                  <button onClick={handleSmartDistributeFamily}
                    className="text-xs px-3 py-1.5 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-full font-semibold transition-colors whitespace-nowrap">
                    ⚡ Smart Distribute
                  </button>
                )}
              </div>

              {loadingSiblings ? (
                <div className="flex items-center justify-center py-10 gap-2 text-gray-400 text-sm">
                  <span className="w-4 h-4 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
                  Loading sibling fee data…
                </div>
              ) : (
                familyFeeData.map(({ person, withBalance, isMainPupil }) => (
                  <div key={person.id} className="rounded-xl border border-gray-200 overflow-hidden">
                    {/* Person header */}
                    <div className={`px-4 py-2.5 flex items-center gap-2.5 ${isMainPupil ? 'bg-violet-50 border-b border-violet-100' : 'bg-indigo-50 border-b border-indigo-100'}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${isMainPupil ? 'bg-violet-600' : 'bg-indigo-500'}`}>
                        {person.firstName.charAt(0)}{person.lastName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-bold ${isMainPupil ? 'text-violet-800' : 'text-indigo-800'}`}>
                          {person.firstName} {person.lastName}
                        </span>
                        {isMainPupil && (
                          <span className="ml-2 text-[10px] bg-violet-200 text-violet-700 rounded-full px-2 py-0.5">This pupil</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        {withBalance.length > 0 ? `${withBalance.length} fee(s) due` : '✅ Settled'}
                      </span>
                    </div>

                    {withBalance.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-400 italic">All fees settled for this term.</div>
                    ) : (
                      <div className="p-3 space-y-2">
                        {withBalance.map(({ fee, paid, balance }) => (
                          <div key={fee.id} className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <div>
                                <p className="text-sm font-semibold text-gray-800">{fee.name}</p>
                                <p className="text-[10px] text-gray-400">
                                  Total: {fmt(fee.amount || 0)} · Paid: {fmt(paid)} · Balance: {fmt(balance)}
                                </p>
                              </div>
                              <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-medium">{fmt(balance)} due</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 w-14 shrink-0">Allocate:</span>
                              <input
                                type="number" min={0} max={total} step={100}
                                value={getFamilyAlloc(person.id, selectedTermId, fee.id)}
                                onChange={e => setFamilyAlloc(person.id, selectedTermId, fee.id, e.target.value)}
                                placeholder="0"
                                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                              />
                              <button
                                onClick={() => {
                                  const cur = parseFloat(getFamilyAlloc(person.id, selectedTermId, fee.id)) || 0;
                                  const available = total - (familyAllocatedTotal - cur);
                                  setFamilyAlloc(person.id, selectedTermId, fee.id, String(Math.min(balance, available)));
                                }}
                                className="text-xs px-2 py-1 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-lg transition-colors whitespace-nowrap"
                              >Max</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </>
          )}

          {/* ── Summary panel ── */}
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Total received</span>
              <span className="font-bold text-violet-900">{fmt(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Allocated to fees</span>
              <span className={`font-semibold ${currentOverAllocated ? 'text-red-600' : 'text-gray-800'}`}>{fmt(currentAllocatedTotal)}</span>
            </div>
            <div className="flex justify-between border-t border-violet-200 pt-1.5">
              <span className="text-gray-600">Advance / Excess</span>
              <span className={`font-bold ${currentExcess > 0 ? 'text-amber-600' : 'text-green-600'}`}>{fmt(currentExcess)}</span>
            </div>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>}
        </div>

        {/* ── Footer ── */}
        <div className="border-t px-5 py-3 bg-gray-50 flex items-center justify-between gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || currentOverAllocated}
            className="px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full text-sm font-semibold transition-colors flex items-center gap-2"
          >
            {isSubmitting
              ? (<><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Redistributing…</>)
              : 'Confirm Redistribution'}
          </button>
        </div>
      </div>
    </div>
  );
}
