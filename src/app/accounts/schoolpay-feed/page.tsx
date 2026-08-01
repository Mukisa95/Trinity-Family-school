'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Zap, ArrowLeft, ExternalLink, ChevronDown, ChevronRight,
  RefreshCw, Calendar, ShieldAlert
} from 'lucide-react';
import { GlassPageTopBar } from '@/components/common/glass-page-top-bar';
import { useSchoolPayFeedState, type TxStatus } from '@/lib/hooks/use-schoolpay-feed-state';
import { useAuth } from '@/lib/contexts/auth-context';
import { GranularPermissionService } from '@/lib/services/granular-permissions.service';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { usePupils } from '@/lib/hooks/use-pupils';
import { useSchoolPayInbox } from '@/lib/hooks/use-schoolpay-inbox';
import { SchoolPayInboxCard } from '@/components/schoolpay/schoolpay-inbox-card';
import { SchoolPayReconcileDialog } from '@/components/schoolpay/schoolpay-reconcile-dialog';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LivePayment {
  id: string;
  pupilId: string;
  feeStructureId: string;
  academicYearId: string;
  termId: string;
  amount: number;
  paymentDate: string;
  paymentMethod?: string;
  notes?: string;
  source: string;
  schoolPayReceiptNumber?: string;
  schoolPayTransactionId?: string;
  schoolPayPaymentCode?: string;
  schoolPayOriginTermId?: string;
  schoolPayOriginYearId?: string;
  paidBy?: { name?: string };
  createdAt?: string;
  reverted?: boolean;
}

interface PupilInfo {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  classId: string;
  classCode?: string;
  className?: string;
  section?: string;
}

interface GroupedTransaction {
  key: string;
  payCode?: string;
  txRef?: string;
  payerName: string;
  paymentMethod?: string;
  paymentDate: string;
  totalAmount: number;
  pupilId: string;
  pupil?: PupilInfo;
  payments: LivePayment[];
  termGroups: {
    termId: string;
    academicYearId: string;
    isPushed: boolean;
    payments: LivePayment[];
    subTotal: number;
  }[];
}

interface DayGroup {
  dateLabel: string;
  dateKey: string;
  transactions: GroupedTransaction[];
  dayTotal: number;
}

type FeedConnectionState = 'connecting' | 'live' | 'reconnecting';

// ─── Status colour config ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TxStatus, {
  border: string;
  bg: string;
  dot: string;
  label: string;
  labelBg: string;
}> = {
  new: {
    border: 'border-orange-300',
    bg: 'from-orange-50 via-amber-50 to-orange-50',
    dot: 'bg-orange-500 animate-pulse',
    label: 'New',
    labelBg: 'bg-orange-100 text-orange-700 border border-orange-200',
  },
  seen: {
    border: 'border-blue-300',
    bg: 'from-blue-50 via-indigo-50 to-blue-50',
    dot: 'bg-blue-400',
    label: 'Seen',
    labelBg: 'bg-blue-100 text-blue-700 border border-blue-200',
  },
  clicked: {
    border: 'border-emerald-300',
    bg: 'from-emerald-50 via-green-50 to-emerald-50',
    dot: 'bg-emerald-500',
    label: 'Viewed',
    labelBg: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  },
};

const STRIP_GRADIENT: Record<TxStatus, string> = {
  new: 'from-orange-400 via-amber-400 to-orange-500',
  seen: 'from-blue-400 via-indigo-500 to-blue-500',
  clicked: 'from-emerald-400 via-teal-500 to-emerald-500',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(n);

const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kampala' });

const toDateKey = (d: string) =>
  new Date(d).toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });

function buildDateLabel(dateKey: string): string {
  const today = toDateKey(new Date().toISOString());
  const yesterday = toDateKey(new Date(Date.now() - 86_400_000).toISOString());
  if (dateKey === today) return 'Today';
  if (dateKey === yesterday) return 'Yesterday';
  return new Date(dateKey + 'T12:00:00').toLocaleDateString('en-UG', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

function extractPayer(p: LivePayment): string {
  const seg = (p.notes || '').split('|').find(s => s.trim().startsWith('Payer:'));
  return seg?.replace('Payer:', '').trim() || p.paidBy?.name || '—';
}

function feeLabel(p: LivePayment): string {
  if (p.feeStructureId === 'schoolpay-general') return 'Advance / Excess';
  const first = (p.notes || '').split('|')[0].replace(/\(SchoolPay.*\)/i, '').trim();
  return first || p.feeStructureId;
}

// ─── Transaction Card ─────────────────────────────────────────────────────────

function TransactionCard({
  tx,
  allTermLabels,
  status,
  onClickViewFees,
}: {
  tx: GroupedTransaction;
  allTermLabels: Map<string, string>;
  status: TxStatus;
  onClickViewFees: (txKey: string, pupilId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[status];
  const strip = STRIP_GRADIENT[status];

  const pupilName = tx.pupil
    ? `${tx.pupil.firstName} ${tx.pupil.lastName}`
    : 'Unknown Pupil';

  // Prefer classCode, fall back to className, then classId
  const classLabel = tx.pupil?.classCode || tx.pupil?.className || tx.pupil?.classId || '';
  const sectionLabel = tx.pupil?.section || '';

  const termLabel = (termId: string, yearId: string) =>
    allTermLabels.get(`${yearId}::${termId}`) || allTermLabels.get(termId) || termId;

  return (
    <div className={`rounded-xl border-l-4 ${cfg.border} border border-gray-100 shadow-sm overflow-hidden bg-white hover:shadow-md transition-shadow`}>

      {/* Collapsed / Summary row */}
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full text-left px-3 py-2.5 hover:bg-gray-50/60 transition-colors"
      >
        <div className="grid grid-cols-[auto,minmax(0,1.7fr),minmax(80px,0.65fr),minmax(110px,0.75fr),minmax(120px,0.75fr),auto] items-center gap-2.5 max-lg:grid-cols-[auto,minmax(0,1fr),auto] max-lg:items-start">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />

          <div className="min-w-0">
            <p className="font-extrabold text-gray-900 text-sm leading-snug truncate">{pupilName}</p>
            <p className="text-[11px] text-gray-400 leading-tight truncate">{tx.payerName && tx.payerName !== '—' ? tx.payerName : 'SchoolPay payer'}</p>
          </div>

          <div className="min-w-0 max-lg:col-start-2 max-lg:row-start-2">
            <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Class</p>
            <p className="text-[11px] font-semibold text-gray-600 truncate">
              {[classLabel, sectionLabel].filter(Boolean).join(' · ') || 'N/A'}
            </p>
          </div>

          <div className="min-w-0 max-lg:col-start-2 max-lg:row-start-3">
            <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Pay Code</p>
            <p className="text-[11px] font-mono font-semibold text-violet-500 truncate">{tx.payCode || 'N/A'}</p>
          </div>

          <div className="min-w-0 max-lg:col-start-2 max-lg:row-start-4">
            <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Amount</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-gray-900 text-sm">{fmt(tx.totalAmount)}</span>
              <span className="font-bold text-gray-500 text-xs">{fmtTime(tx.paymentDate)}</span>
              {tx.termGroups.length > 1 && (
                <span className="text-[9px] bg-fuchsia-100 text-fuchsia-700 rounded-full px-1.5 py-0.5 font-semibold">
                  Split·{tx.termGroups.length}t
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-1.5 max-lg:row-span-4 max-lg:self-center">
            {tx.pupil && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  onClickViewFees(tx.key, tx.pupilId);
                }}
                className="flex items-center gap-1 text-[11px] px-2.5 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded-full font-semibold transition-colors"
              >
                View <ExternalLink size={10} />
              </button>
            )}
            <div className="text-gray-400">
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>
          </div>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-100">
          {/* Hidden-in-collapsed meta row */}
          <div className="px-3 py-2 flex flex-wrap items-center gap-1.5 bg-gray-50/50 border-b border-gray-100">
            <span className={`text-[9px] font-semibold rounded-full px-1.5 py-0.5 ${cfg.labelBg}`}>{cfg.label}</span>
            {tx.paymentMethod && (
              <span className="text-[10px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{tx.paymentMethod}</span>
            )}
            {tx.payerName && tx.payerName !== '—' && (
              <span className="text-[10px] text-gray-500">Payer: <strong>{tx.payerName}</strong></span>
            )}
            {tx.txRef && (
              <span className="text-[9px] font-mono text-gray-400 truncate">Ref: {tx.txRef}</span>
            )}
          </div>

          {/* Fee distribution */}
          <div className="px-3 pb-3 pt-2 space-y-2">
            {tx.termGroups.map(group => (
              <div key={group.termId}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  {group.isPushed ? (
                    <span className="text-[9px] font-semibold text-fuchsia-600 bg-fuchsia-50 border border-fuchsia-200 rounded-full px-2 py-0.5">
                      → Pushed to {termLabel(group.termId, group.academicYearId)}
                    </span>
                  ) : (
                    <span className="text-[9px] font-semibold text-violet-600 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5">
                      {termLabel(group.termId, group.academicYearId)}
                    </span>
                  )}
                  <span className="text-[9px] text-gray-400 font-medium">{fmt(group.subTotal)}</span>
                </div>
                <div className="grid gap-1 sm:grid-cols-2">
                  {group.payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5">
                      <p className="text-[11px] font-medium text-gray-700 truncate">{feeLabel(p)}</p>
                      <span className="ml-2 font-bold text-violet-800 text-[11px] shrink-0">{fmt(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Legend removed per user request ────────────────────────────────────────

// ─── Access Denied Screen ─────────────────────────────────────────────────────

function AccessDenied() {
  const router = useRouter();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-violet-50/20 to-purple-50/10">
      <div className="text-center p-10 max-w-xs mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={28} className="text-red-400" />
        </div>
        <p className="text-gray-700 font-bold text-lg">Access Restricted</p>
        <p className="text-sm text-gray-400 mt-2 leading-relaxed">
          You don't have permission to view the SchoolPay Live Feed.<br />
          Contact your administrator to request access.
        </p>
        <button
          onClick={() => router.replace('/')}
          className="mt-5 px-4 py-2 rounded-full bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}

// ─── Main Feed Content (only rendered when user has access) ───────────────────

function FeedContent() {
  const router = useRouter();
  const { markFeedViewed, markTxClicked, getTxStatus } = useSchoolPayFeedState();
  const { data: academicYears = [] } = useAcademicYears();
  const pupilsQuery = usePupils();
  const { data: unresolvedPayments } = useSchoolPayInbox();

  const [payments, setPayments] = useState<LivePayment[]>([]);
  const [allTermLabels, setAllTermLabels] = useState<Map<string, string>>(new Map());
  const [connectionState, setConnectionState] = useState<FeedConnectionState>('connecting');
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'seen' | 'clicked' | 'today'>('all');

  const pupils = useMemo(() => {
    const map = new Map<string, PupilInfo>();
    (pupilsQuery.data || []).forEach(pupil => map.set(pupil.id, {
      id: pupil.id,
      firstName: pupil.firstName || '',
      lastName: pupil.lastName || '',
      admissionNumber: pupil.admissionNumber || '',
      classId: pupil.classId || '',
      classCode: pupil.classCode || pupil.classId || '',
      className: pupil.className || '',
      section: pupil.section || '',
    }));
    return map;
  }, [pupilsQuery.data]);
  const isLoadingPupils = pupilsQuery.isLoading;

  // Mark feed as viewed on mount — clears the badge
  useEffect(() => {
    markFeedViewed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load academic year / term labels ─────────────────────────────────────
  useEffect(() => {
    const labels = new Map<string, string>();
    academicYears.forEach(year => {
      year.terms.forEach(term => {
        labels.set(`${year.id}::${term.id}`, `${term.name} ${year.name}`);
        labels.set(term.id, `${term.name} ${year.name}`);
      });
    });
    setAllTermLabels(labels);
  }, [academicYears]);

  // ── Load pupils once ─────────────────────────────────────────────────────
  // ── Live listener: SchoolPay payments ───────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, 'payments'),
      where('source', '==', 'schoolpay')
    );

    let unsub: (() => void) | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const startListener = () => {
      if (stopped) return;
      setConnectionState(prev => (prev === 'live' ? 'live' : 'connecting'));

      unsub = onSnapshot(
        q,
        snap => {
          const docs: LivePayment[] = snap.docs
            .map(doc => {
              const d = doc.data();
              return {
                id: doc.id,
                pupilId: d.pupilId || '',
                feeStructureId: d.feeStructureId || '',
                academicYearId: d.academicYearId || '',
                termId: d.termId || '',
                amount: d.amount || 0,
                paymentDate:
                  d.paymentDate?.toDate?.()?.toISOString?.() ?? d.paymentDate ?? new Date().toISOString(),
                paymentMethod: d.paymentMethod,
                notes: d.notes,
                source: d.source,
                schoolPayReceiptNumber: d.schoolPayReceiptNumber,
                schoolPayTransactionId: d.schoolPayTransactionId,
                schoolPayPaymentCode: d.schoolPayPaymentCode,
                schoolPayOriginTermId: d.schoolPayOriginTermId,
                schoolPayOriginYearId: d.schoolPayOriginYearId,
                paidBy: d.paidBy,
                createdAt: d.createdAt?.toDate?.()?.toISOString?.() ?? d.createdAt,
                reverted: !!d.reverted,
              } as LivePayment;
            })
            .filter(p => !p.reverted);
          setPayments(docs);
          setConnectionState('live');
        },
        error => {
          console.error('SchoolPay live feed listener error:', error);
          setConnectionState('reconnecting');
          retryTimer = setTimeout(startListener, 3000);
        }
      );
    };

    startListener();

    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (unsub) unsub();
    };
  }, []);

  // ── Handle "View Fees" click ──────────────────────────────────────────────
  const handleViewFees = useCallback((txKey: string, pupilId: string) => {
    markTxClicked(txKey);
    router.push(`/fees/collect/${pupilId}`);
  }, [markTxClicked, router]);

  // ── Group payments → transactions → day groups ────────────────────────────
  const dayGroups = useMemo<DayGroup[]>(() => {
    const txMap = new Map<string, { payments: LivePayment[] }>();
    for (const p of payments) {
      const key = p.schoolPayReceiptNumber || p.schoolPayTransactionId || p.id;
      if (!txMap.has(key)) txMap.set(key, { payments: [] });
      txMap.get(key)!.payments.push(p);
    }

    const transactions: GroupedTransaction[] = [];
    for (const [key, { payments: tPmts }] of txMap.entries()) {
      const first = tPmts[0];
      const pupil = pupils.get(first.pupilId);

      const termMap = new Map<string, { payments: LivePayment[]; isPushed: boolean; yearId: string }>();
      for (const p of tPmts) {
        if (!termMap.has(p.termId)) {
          termMap.set(p.termId, { payments: [], isPushed: !!p.schoolPayOriginTermId, yearId: p.academicYearId });
        }
        termMap.get(p.termId)!.payments.push(p);
      }

      const termGroups = Array.from(termMap.entries())
        .map(([termId, { payments: gPmts, isPushed, yearId }]) => ({
          termId, academicYearId: yearId, isPushed,
          payments: gPmts,
          subTotal: gPmts.reduce((s, p) => s + (p.amount || 0), 0),
        }))
        .sort((a, b) => (a.isPushed ? 1 : 0) - (b.isPushed ? 1 : 0));

      transactions.push({
        key,
        payCode: first.schoolPayPaymentCode,
        txRef: first.schoolPayTransactionId,
        payerName: extractPayer(first),
        paymentMethod: first.paymentMethod,
        paymentDate: first.paymentDate,
        totalAmount: tPmts.reduce((s, p) => s + (p.amount || 0), 0),
        pupilId: first.pupilId,
        pupil,
        payments: tPmts,
        termGroups,
      });
    }

    transactions.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

    // Apply statusFilter
    let filteredTransactions = transactions;
    if (statusFilter === 'new') {
      filteredTransactions = transactions.filter(tx => getTxStatus(tx.key, tx.paymentDate) === 'new');
    } else if (statusFilter === 'seen') {
      filteredTransactions = transactions.filter(tx => getTxStatus(tx.key, tx.paymentDate) === 'seen');
    } else if (statusFilter === 'clicked') {
      filteredTransactions = transactions.filter(tx => getTxStatus(tx.key, tx.paymentDate) === 'clicked');
    } else if (statusFilter === 'today') {
      const todayKey = toDateKey(new Date().toISOString());
      filteredTransactions = transactions.filter(tx => toDateKey(tx.paymentDate) === todayKey);
    }

    const dayMap = new Map<string, GroupedTransaction[]>();
    for (const tx of filteredTransactions) {
      const dk = toDateKey(tx.paymentDate);
      if (!dayMap.has(dk)) dayMap.set(dk, []);
      dayMap.get(dk)!.push(tx);
    }

    return Array.from(dayMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateKey, txs]) => ({
        dateKey,
        dateLabel: buildDateLabel(dateKey),
        transactions: txs,
        dayTotal: txs.reduce((s, tx) => s + tx.totalAmount, 0),
      }));
  }, [payments, pupils, statusFilter, getTxStatus]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const allTxKeys = useMemo(() => {
    const unique = new Map<string, string>();
    payments.forEach(p => {
      const key = p.schoolPayReceiptNumber || p.schoolPayTransactionId || p.id;
      if (!unique.has(key)) unique.set(key, p.paymentDate);
    });
    return unique;
  }, [payments]);

  const newCount = Array.from(allTxKeys.entries()).filter(([k, d]) => getTxStatus(k, d) === 'new').length;
  const seenCount = Array.from(allTxKeys.entries()).filter(([k, d]) => getTxStatus(k, d) === 'seen').length;
  const clickedCount = Array.from(allTxKeys.entries()).filter(([k, d]) => getTxStatus(k, d) === 'clicked').length;

  const totalToday = useMemo(() => {
    const todayKey = toDateKey(new Date().toISOString());
    const txMap = new Map<string, number>();
    for (const p of payments) {
      if (toDateKey(p.paymentDate) === todayKey) {
        const key = p.schoolPayReceiptNumber || p.schoolPayTransactionId || p.id;
        txMap.set(key, (txMap.get(key) || 0) + (p.amount || 0));
      }
    }
    return Array.from(txMap.values()).reduce((sum, amt) => sum + amt, 0);
  }, [payments]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/20 to-purple-50/10">
      <GlassPageTopBar
        title="SchoolPay Live Feed"
        subtitle="Real-time SchoolPay payment transactions"
        backHref="/"
        backLabel="Back to dashboard"
        meta={
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
              connectionState === 'live'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                connectionState === 'live' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'
              }`} />
              {connectionState === 'live' ? 'Live' : connectionState === 'reconnecting' ? 'Reconnecting' : 'Listening'}
            </div>
            
            <button
              onClick={() => setStatusFilter(prev => prev === 'today' ? 'all' : 'today')}
              className={`rounded-full border transition-all duration-200 active:scale-95 px-2 py-0.5 flex items-center gap-1 text-[10px] ${
                statusFilter === 'today'
                  ? 'bg-slate-200 border-slate-400 text-slate-900 font-extrabold ring-2 ring-slate-400/40 shadow-md scale-105'
                  : 'bg-white/80 border-gray-200/60 shadow-sm hover:bg-gray-100/70'
              }`}
              title={statusFilter === 'today' ? "Click to clear filter" : "Filter by payments received today"}
            >
              <span className="font-bold text-gray-500 uppercase">Today:</span>
              <span className="font-bold text-gray-900">{fmt(totalToday)}</span>
            </button>
            <button
              onClick={() => setStatusFilter(prev => prev === 'new' ? 'all' : 'new')}
              className={`rounded-full border transition-all duration-200 active:scale-95 px-2 py-0.5 flex items-center gap-1 text-[10px] ${
                statusFilter === 'new'
                  ? 'bg-orange-100 border-orange-400 text-orange-900 font-extrabold ring-2 ring-orange-400/40 shadow-md scale-105'
                  : 'bg-orange-50 border-orange-200/55 shadow-sm hover:bg-orange-100/60'
              }`}
              title={statusFilter === 'new' ? "Click to clear filter" : "Filter by new unread payments"}
            >
              <span className="font-bold text-orange-500 uppercase">New:</span>
              <span className="font-bold text-orange-700">{newCount}</span>
            </button>
            <button
              onClick={() => setStatusFilter(prev => prev === 'seen' ? 'all' : 'seen')}
              className={`rounded-full border transition-all duration-200 active:scale-95 px-2 py-0.5 flex items-center gap-1 text-[10px] ${
                statusFilter === 'seen'
                  ? 'bg-blue-100 border-blue-400 text-blue-900 font-extrabold ring-2 ring-blue-400/40 shadow-md scale-105'
                  : 'bg-blue-50 border-blue-200/55 shadow-sm hover:bg-blue-100/60'
              }`}
              title={statusFilter === 'seen' ? "Click to clear filter" : "Filter by viewed/seen payments"}
            >
              <span className="font-bold text-blue-500 uppercase">Seen:</span>
              <span className="font-bold text-blue-700">{seenCount}</span>
            </button>
            <button
              onClick={() => setStatusFilter(prev => prev === 'clicked' ? 'all' : 'clicked')}
              className={`rounded-full border transition-all duration-200 active:scale-95 px-2 py-0.5 flex items-center gap-1 text-[10px] ${
                statusFilter === 'clicked'
                  ? 'bg-emerald-100 border-emerald-400 text-emerald-900 font-extrabold ring-2 ring-emerald-400/40 shadow-md scale-105'
                  : 'bg-emerald-50 border-emerald-200/55 shadow-sm hover:bg-emerald-100/60'
              }`}
              title={statusFilter === 'clicked' ? "Click to clear filter" : "Filter by processed/viewed fees"}
            >
              <span className="font-bold text-emerald-500 uppercase">Done:</span>
              <span className="font-bold text-emerald-700">{clickedCount}</span>
            </button>
            {statusFilter !== 'all' && (
              <button
                onClick={() => setStatusFilter('all')}
                className="text-[9px] font-bold text-violet-600 hover:text-violet-800 transition-colors uppercase px-1 py-0.5 border border-dashed border-violet-300 rounded hover:bg-violet-50/50"
              >
                Clear Filter
              </button>
            )}
          </div>
        }
      />
      <div className="w-full px-3 sm:px-4 lg:px-6 py-4 space-y-4 pb-10">

        <div className="flex justify-end">
          <SchoolPayReconcileDialog />
        </div>

        {unresolvedPayments.length > 0 && (
          <section aria-labelledby="schoolpay-recovery-heading" className="space-y-3">
            <div>
              <h2 id="schoolpay-recovery-heading" className="font-bold text-slate-950">Payments needing attention ({unresolvedPayments.length})</h2>
              <p className="text-xs text-slate-500">These receipts were safely received but have not yet been added to pupil fees.</p>
            </div>
            {unresolvedPayments.map(record => <SchoolPayInboxCard key={record.id} record={record} compact />)}
          </section>
        )}

        {/* Feed */}
        {payments.length === 0 && !isLoadingPupils ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-3">
              <Zap size={22} className="text-violet-400" />
            </div>
            <p className="text-gray-500 font-medium text-sm">No SchoolPay payments recorded yet</p>
            <p className="text-xs text-gray-400 mt-1">Payments appear here in real time as they arrive</p>
          </div>
        ) : (
          <div className="space-y-6">
            {dayGroups.map(day => (
              <section key={day.dateKey}>
                {/* Date header */}
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={13} className="text-violet-500 flex-shrink-0" />
                  <span className="font-bold text-gray-800 text-sm">{day.dateLabel}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-[11px] text-gray-500">{day.transactions.length} payment{day.transactions.length !== 1 ? 's' : ''}</span>
                  <span className="text-[11px] font-bold text-violet-700 bg-violet-100 rounded-full px-2 py-0.5">{fmt(day.dayTotal)}</span>
                </div>

                {/* Transactions */}
                <div className="space-y-2">
                  {day.transactions.map(tx => (
                    <TransactionCard
                      key={tx.key}
                      tx={tx}
                      allTermLabels={allTermLabels}
                      status={getTxStatus(tx.key, tx.paymentDate)}
                      onClickViewFees={handleViewFees}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Loading hint */}
        {isLoadingPupils && payments.length > 0 && (
          <div className="text-center py-3">
            <div className="inline-flex items-center gap-2 text-xs text-gray-400">
              <RefreshCw size={12} className="animate-spin" />
              Loading pupil details…
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Root Page — permission shell ─────────────────────────────────────────────
// All hooks are called unconditionally here, so Rules of Hooks are satisfied.
// The guard is purely a render decision, not a hook conditional.

export default function SchoolPayFeedPage() {
  const { user } = useAuth();
  const router = useRouter();

  const hasAccess = GranularPermissionService.canAccessPage(user as any, 'fees', 'schoolpay_feed');

  // Redirect unauthorised users (after auth resolves)
  useEffect(() => {
    if (user && !hasAccess) {
      router.replace('/');
    }
  }, [user, hasAccess, router]);

  // If user is not yet resolved, show nothing (avoids flash)
  if (!user) return null;

  // Access denied UI (redirect happens in background)
  if (!hasAccess) return <AccessDenied />;

  return <FeedContent />;
}
