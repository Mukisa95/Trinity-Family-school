'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CloudDownload, RefreshCw } from 'lucide-react';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import { PARENT_SHELL_READY_EVENT, prepareParentAppShell } from '@/lib/parent-offline/app-shell';
import { getParentOfflineReadiness, type ParentOfflineReadiness } from '@/lib/parent-offline/readiness';
import { subscribeToParentOfflineChanges } from '@/lib/parent-offline/repository';
import { getEffectiveTermForDataDisplay } from '@/lib/utils/term-status-utils';

export function ParentOfflineReadinessCard({ accountId }: { accountId?: string }) {
  const { data: academicYears = [] } = useAcademicYears();
  const year = useMemo(() => {
    const selected = getEffectiveTermForDataDisplay(academicYears)?.academicYear || null;
    if (!selected) return null;
    const finalDate = selected.endDate || selected.terms[selected.terms.length - 1]?.endDate;
    const end = finalDate ? new Date(finalDate).getTime() : NaN;
    // A stale school calendar must not make last year's records look ready for this year.
    if (!Number.isFinite(end) || end + 90 * 24 * 60 * 60 * 1000 < Date.now()) return null;
    return selected;
  }, [academicYears]);
  const [status, setStatus] = useState<ParentOfflineReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!accountId) return;
    try {
      setStatus(await getParentOfflineReadiness(accountId, year));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not check saved data on this device.');
    }
  }, [accountId, year]);

  useEffect(() => {
    void refresh();
    if (!accountId) return;
    const unsubscribe = subscribeToParentOfflineChanges(accountId, () => void refresh());
    window.addEventListener(PARENT_SHELL_READY_EVENT, refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => {
      unsubscribe();
      window.removeEventListener(PARENT_SHELL_READY_EVENT, refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [accountId, refresh]);

  const retry = async () => {
    setBusy(true);
    try {
      await prepareParentAppShell({ force: true });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the parent pages.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4" aria-live="polite">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${status?.ready ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
          {status?.ready ? <CheckCircle2 className="w-5 h-5" /> : <CloudDownload className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Offline download</p>
          <p className={`text-sm font-medium ${status?.ready ? 'text-green-700' : 'text-blue-700'}`}>
            {status?.ready ? 'Core dashboard ready offline' : status ? `Preparing on this device · ${status.completed}/${status.expected} saved` : 'Checking saved information…'}
          </p>
          {status?.ready ? (
            <p className="text-xs text-gray-500 mt-1">Parent pages, profiles, banking, attendance, results, and this academic year’s fees are saved here. New updates sync when you are online.</p>
          ) : (
            <p className="text-xs text-gray-500 mt-1">Keep this page open online while missing information downloads. {status?.missing.slice(0, 2).join('; ')}{(status?.missing.length || 0) > 2 ? '…' : ''}</p>
          )}
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
      </div>
      {!status?.ready && (
        <button type="button" disabled={busy || (typeof navigator !== 'undefined' && !navigator.onLine)} onClick={retry}
          className="mt-3 flex items-center gap-2 text-xs font-medium text-blue-700 disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} /> Retry saving pages
        </button>
      )}
    </section>
  );
}
