'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { PaymentRecord, FeeStructure, AcademicYear, Pupil } from '@/types';
import type { GroupedSchoolPayTx } from './SchoolPayPaymentBanner';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface SchoolPayPaymentsModalProps {
  pupilId: string;
  pupil: Pupil;
  feeStructures: FeeStructure[];
  allFeeStructures: FeeStructure[];
  academicYears: AcademicYear[];
  selectedTermId: string;
  selectedAcademicYear: AcademicYear | null;
  allPayments: PaymentRecord[];  
  onClose: () => void;
  onRedistribute: (tx: GroupedSchoolPayTx) => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n);

const fmtDate = (d: string) =>
  new Date(d).toLocaleString('en-UG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kampala',
  });

function termLabel(termId: string, years: AcademicYear[]): string {
  for (const yr of years) {
    const t = yr.terms?.find(t => t.id === termId);
    if (t) return `${t.name} · ${yr.name}`;
  }
  return termId;
}

export function SchoolPayPaymentsModal({
  pupilId,
  pupil,
  feeStructures,
  allFeeStructures,
  academicYears,
  selectedTermId,
  selectedAcademicYear,
  allPayments,
  onClose,
  onRedistribute,
}: SchoolPayPaymentsModalProps) {
  // Live: listen to all SchoolPay payments for this pupil in real time
  const [livePayments, setLivePayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!pupilId) return;
    const q = query(
      collection(db, 'payments'),
      where('pupilId', '==', pupilId),
      where('source', '==', 'schoolpay')
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        paymentDate: d.data().paymentDate?.toDate?.()?.toISOString?.() ?? d.data().paymentDate,
      })) as PaymentRecord[];
      setLivePayments(
        docs.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
      );
      setIsLoading(false);
    }, () => setIsLoading(false));
    return () => unsub();
  }, [pupilId]);

  // Exclude reverted payments
  const activeSchoolPay = useMemo(() =>
    livePayments.filter((p: any) => !p.reverted),
    [livePayments]
  );

  // Group by SchoolPay receipt/transaction id → one card per SchoolPay transaction, sorted newest first
  const transactions = useMemo<GroupedSchoolPayTx[]>(() => {
    const map = new Map<string, { core: Omit<GroupedSchoolPayTx, 'termGroups'>; allPmts: any[] }>();

    for (const p of activeSchoolPay as any[]) {
      const key: string = p.schoolPayReceiptNumber || p.schoolPayTransactionId || p.id;
      if (!map.has(key)) {
        const payerRaw =
          (p.notes as string | undefined)?.split('|').find((s: string) => s.trim().startsWith('Payer:'))?.replace('Payer:', '').trim() ||
          p.paidBy?.name || '—';
        map.set(key, {
          core: { key, payments: [], totalAmount: 0, paymentDate: p.paymentDate, payerName: payerRaw, payCode: p.schoolPayPaymentCode, txRef: p.schoolPayTransactionId, paymentMethod: p.paymentMethod },
          allPmts: [],
        });
      }
      const g = map.get(key)!;
      g.core.payments.push(p);
      g.core.totalAmount += p.amount || 0;
      g.allPmts.push(p);
    }

    const result: GroupedSchoolPayTx[] = [];
    for (const { core, allPmts } of map.values()) {
      // Build per-term groups
      const termMap = new Map<string, { payments: any[]; isPushed: boolean }>();
      for (const p of allPmts) {
        const tId: string = p.termId;
        if (!termMap.has(tId)) termMap.set(tId, { payments: [], isPushed: !!p.schoolPayOriginTermId });
        termMap.get(tId)!.payments.push(p);
      }
      const termGroups = Array.from(termMap.entries()).map(([tId, { payments: tPmts, isPushed }]) => ({
        termId: tId, termLabel: termLabel(tId, academicYears), isPushed, payments: tPmts as PaymentRecord[],
        subTotal: tPmts.reduce((s: number, p: any) => s + (p.amount || 0), 0),
      })).sort((a, b) => (a.isPushed ? 1 : 0) - (b.isPushed ? 1 : 0));

      result.push({ ...core, termGroups });
    }

    // Sort newest first
    return result.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
  }, [activeSchoolPay, academicYears]);

  const getFeeName = (feeStructureId: string) => {
    if (feeStructureId === 'schoolpay-general') return 'Unmatched / Advance';
    return allFeeStructures.find(f => f.id === feeStructureId)?.name || feeStructureId;
  };

  const totalReceived = activeSchoolPay.reduce((s, p) => s + ((p as any).amount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-700 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">SchoolPay Payments</h2>
                {isLoading && <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {!isLoading && <span className="text-[10px] bg-green-400/30 border border-green-400/50 text-green-100 rounded-full px-2 py-0.5">● Live</span>}
              </div>
              <p className="text-xs text-violet-200">
                {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} · {fmt(totalReceived)} total received
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <span className="w-8 h-8 border-3 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Loading SchoolPay payments…</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-4xl mb-3 block">📭</span>
              <p className="text-gray-500 font-medium">No SchoolPay payments received yet</p>
              <p className="text-xs text-gray-400 mt-1">Payments from SchoolPay will appear here in real time</p>
            </div>
          ) : (
            transactions.map((tx) => {
              const hasUnmatched = tx.payments.some((p: any) => p.feeStructureId === 'schoolpay-general');
              return (
                <div key={tx.key} className="bg-violet-50/60 border border-violet-200 rounded-xl overflow-hidden">
                  {/* Transaction header */}
                  <div className="bg-gradient-to-r from-violet-100 to-purple-50 px-4 py-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-violet-900 text-base">{fmt(tx.totalAmount)}</span>
                        <span className="text-xs bg-violet-200 text-violet-800 rounded-full px-2 py-0.5 font-mono">via SchoolPay</span>
                        {tx.paymentMethod && <span className="text-xs bg-white border border-violet-200 text-violet-700 rounded-full px-2 py-0.5">{tx.paymentMethod}</span>}
                        {tx.termGroups.length > 1 && <span className="text-xs bg-fuchsia-100 text-fuchsia-700 rounded-full px-2 py-0.5">Split across {tx.termGroups.length} terms</span>}
                        {hasUnmatched && <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-medium">⚠ Needs matching</span>}
                      </div>
                      <p className="text-xs text-violet-600 mt-1">{fmtDate(tx.paymentDate)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <p className="text-xs text-gray-600 font-medium">{tx.payerName !== '—' ? tx.payerName : ''}</p>
                      {tx.payCode && <p className="text-[10px] text-gray-400 font-mono">PC: {tx.payCode}</p>}
                      {/* Redistribute button — always available here */}
                      <button
                        onClick={() => onRedistribute(tx)}
                        className="text-xs px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded-full font-semibold transition-colors shadow-sm"
                      >
                        ⚡ Redistribute
                      </button>
                    </div>
                  </div>

                  {/* Per-term distribution */}
                  <div className="px-4 py-3 space-y-3">
                    {tx.termGroups.map(group => (
                      <div key={group.termId}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          {group.isPushed
                            ? <span className="text-[10px] font-semibold text-fuchsia-600 bg-fuchsia-50 border border-fuchsia-200 rounded-full px-2 py-0.5">→ Pushed to {group.termLabel}</span>
                            : <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5">{group.termLabel}</span>}
                          <span className="text-[10px] text-violet-500 font-medium">{fmt(group.subTotal)}</span>
                        </div>
                        <div className="space-y-1">
                          {group.payments.map((p: any, i: number) => (
                            <div key={p.id || i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-violet-100 text-sm">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-gray-800 truncate text-sm">{getFeeName(p.feeStructureId)}</p>
                                {p.feeStructureId === 'schoolpay-general' && <p className="text-[10px] text-amber-600">Use Redistribute to allocate this amount</p>}
                              </div>
                              <span className="ml-3 font-bold text-violet-800 shrink-0">{fmt(p.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {tx.txRef && <p className="text-[10px] text-gray-400 font-mono mt-1 truncate">Ref: {tx.txRef}</p>}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-3 bg-gray-50 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-full text-sm font-semibold transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
}
