'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { PaymentRecord, FeeStructure, AcademicYear } from '@/types';

export interface GroupedSchoolPayTx {
  key: string;
  payments: PaymentRecord[];
  totalAmount: number;
  paymentDate: string;
  payerName: string;
  payCode?: string;
  txRef?: string;
  paymentMethod?: string;
  termGroups: {
    termId: string;
    termLabel: string;
    isPushed: boolean;
    payments: PaymentRecord[];
    subTotal: number;
  }[];
}

interface SchoolPayPaymentBannerProps {
  payments: PaymentRecord[];
  feeStructures: FeeStructure[];
  allAcademicYears: AcademicYear[];
  selectedTermId: string;
  selectedAcademicYear: AcademicYear | null;
  pupilId: string;
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
    if (t) return `${t.name} ${yr.name}`;
  }
  return termId;
}

export function SchoolPayPaymentBanner({
  payments,
  feeStructures,
  allAcademicYears,
  selectedTermId,
  selectedAcademicYear,
  pupilId,
  onRedistribute,
}: SchoolPayPaymentBannerProps) {
  // ── Global dismiss state: stored in Firestore so it applies to ALL users ──
  // When any user dismisses a banner it is gone permanently for everyone.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [isDismissLoaded, setIsDismissLoaded] = useState(false);

  // Load dismissed keys from Firestore on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { db } = await import('@/lib/firebase');
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const q = query(
          collection(db, 'schoolPayDismissedBanners'),
          where('pupilId', '==', pupilId)
        );
        const snap = await getDocs(q);
        if (!cancelled) {
          const keys = new Set<string>(snap.docs.map(d => d.data().txKey as string));
          setDismissed(keys);
          setIsDismissLoaded(true);
        }
      } catch (e) {
        console.error('Error loading dismissed banners:', e);
        if (!cancelled) setIsDismissLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [pupilId]);

  // Dismiss a banner: write to Firestore so every user sees it gone
  const dismiss = async (key: string) => {
    // Optimistic local update first for instant UI response
    setDismissed(prev => new Set([...prev, key]));
    try {
      const { db } = await import('@/lib/firebase');
      const { collection, addDoc } = await import('firebase/firestore');
      await addDoc(collection(db, 'schoolPayDismissedBanners'), {
        pupilId,
        txKey: key,
        dismissedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Error saving banner dismissal:', e);
    }
  };

  // Build transactions: group all SchoolPay payments by receipt or transaction id
  // Show in current term if any payment has termId===selectedTermId OR schoolPayOriginTermId===selectedTermId
  const transactions = useMemo<GroupedSchoolPayTx[]>(() => {
    const schoolPay = (payments as any[]).filter(p => p.source === 'schoolpay' && !p.reverted);
    const map = new Map<string, { core: Omit<GroupedSchoolPayTx, 'termGroups'>; allPmts: any[] }>();

    for (const p of schoolPay) {
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
      const touchesTerm = allPmts.some(p => p.termId === selectedTermId || p.schoolPayOriginTermId === selectedTermId);
      if (!touchesTerm) continue;

      const termMap = new Map<string, { payments: any[]; isPushed: boolean }>();
      for (const p of allPmts) {
        const tId: string = p.termId;
        if (!termMap.has(tId)) termMap.set(tId, { payments: [], isPushed: !!p.schoolPayOriginTermId });
        termMap.get(tId)!.payments.push(p);
      }
      const termGroups = Array.from(termMap.entries()).map(([tId, { payments: tPmts, isPushed }]) => ({
        termId: tId, termLabel: termLabel(tId, allAcademicYears), isPushed, payments: tPmts as PaymentRecord[],
        subTotal: tPmts.reduce((s: number, p: any) => s + (p.amount || 0), 0),
      })).sort((a, b) => (a.isPushed ? 1 : 0) - (b.isPushed ? 1 : 0));

      result.push({ ...core, termGroups });
    }
    return result.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
  }, [payments, selectedTermId, allAcademicYears]);

  // Wait until dismissed list is loaded (prevents flicker of already-dismissed banners)
  const visible = isDismissLoaded
    ? transactions.filter(tx => !dismissed.has(tx.key))
    : [];

  if (visible.length === 0) return null;

  const getFeeName = (feeStructureId: string) => {
    if (feeStructureId === 'schoolpay-general') return 'Advance / Excess';
    return feeStructures.find(f => f.id === feeStructureId)?.name || 'Unknown Fee';
  };

  return (
    <div className="space-y-3 mb-4">
      {visible.map((tx) => (
        <div key={tx.key} className="relative rounded-2xl overflow-hidden border border-violet-300 shadow-md"
          style={{ background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 40%, #f3e8ff 100%)', animation: 'slideDown 0.3s ease-out' }}>
          <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-lg shadow-md flex-shrink-0">⚡</div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-violet-900 text-base">{fmt(tx.totalAmount)}</span>
                    <span className="text-xs bg-violet-200 text-violet-800 rounded-full px-2 py-0.5 font-semibold">SchoolPay Payment Received</span>
                    {tx.paymentMethod && <span className="text-xs bg-white/70 border border-violet-200 text-violet-700 rounded-full px-2 py-0.5">{tx.paymentMethod}</span>}
                    {tx.termGroups.length > 1 && <span className="text-xs bg-fuchsia-100 text-fuchsia-700 rounded-full px-2 py-0.5 font-medium">Split across {tx.termGroups.length} terms</span>}
                  </div>
                  <p className="text-xs text-violet-600 mt-0.5">
                    {fmtDate(tx.paymentDate)}
                    {tx.payerName && tx.payerName !== '—' && <span className="ml-2 text-violet-500">· Paid by {tx.payerName}</span>}
                    {tx.payCode && <span className="ml-2 font-mono text-violet-400">PC: {tx.payCode}</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => onRedistribute(tx)} className="text-xs px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-full font-semibold transition-colors shadow-sm">Redistribute</button>
                {/* Dismiss is saved to Firestore — gone for ALL users, permanently */}
                <button
                  onClick={() => dismiss(tx.key)}
                  className="w-6 h-6 rounded-full bg-violet-200/60 hover:bg-violet-200 flex items-center justify-center text-violet-600 text-xs transition-colors"
                  title="Dismiss for everyone (saved to server — permanent)"
                >✕</button>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {tx.termGroups.map(group => (
                <div key={group.termId}>
                  <div className="flex items-center gap-1.5 mb-1">
                    {group.isPushed
                      ? <span className="text-[10px] font-semibold text-fuchsia-600 bg-fuchsia-50 border border-fuchsia-200 rounded-full px-2 py-0.5">→ Pushed to {group.termLabel}</span>
                      : <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5">{group.termLabel}</span>}
                    <span className="text-[10px] text-violet-500 font-medium">{fmt(group.subTotal)}</span>
                  </div>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {group.payments.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between bg-white/70 rounded-lg px-3 py-2 border border-violet-100 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 truncate text-xs">{getFeeName(p.feeStructureId)}</p>
                          {p.feeStructureId === 'schoolpay-general' && <p className="text-[10px] text-amber-600">Advance / Needs matching</p>}
                        </div>
                        <span className="ml-2 font-bold text-violet-800 text-xs shrink-0">{fmt(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {tx.txRef && <p className="text-[10px] text-violet-400 font-mono mt-2 truncate">Ref: {tx.txRef}</p>}
          </div>
        </div>
      ))}
      <style>{`@keyframes slideDown { from { opacity:0;transform:translateY(-8px) } to { opacity:1;transform:translateY(0) } }`}</style>
    </div>
  );
}
