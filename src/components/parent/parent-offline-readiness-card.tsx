'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, CloudDownload, RefreshCw } from 'lucide-react';
import { useAcademicYears } from '@/lib/hooks/use-academic-years';
import {
  PARENT_OFFLINE_RETRY_EVENT,
  PARENT_SHELL_READY_EVENT,
  prepareParentAppShell,
} from '@/lib/parent-offline/app-shell';
import { getParentOfflineReadiness, type ParentOfflineReadiness } from '@/lib/parent-offline/readiness';
import { subscribeToParentOfflineChanges } from '@/lib/parent-offline/repository';
import { getEffectiveTermForDataDisplay } from '@/lib/utils/term-status-utils';

function formatUpdatedAt(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function ParentOfflineReadinessCard({ accountId }: { accountId?: string }) {
  const { data: academicYears = [] } = useAcademicYears();
  const year = useMemo(() => {
    const selected = getEffectiveTermForDataDisplay(academicYears)?.academicYear || null;
    if (!selected) return null;
    const finalDate = selected.endDate || selected.terms[selected.terms.length - 1]?.endDate;
    const end = finalDate ? new Date(finalDate).getTime() : NaN;
    if (!Number.isFinite(end) || end + 90 * 24 * 60 * 60 * 1000 < Date.now()) return null;
    return selected;
  }, [academicYears]);
  const [status, setStatus] = useState<ParentOfflineReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);

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
    const updateOnlineStatus = () => {
      setOnline(navigator.onLine);
      void refresh();
    };
    window.addEventListener(PARENT_SHELL_READY_EVENT, refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    return () => {
      unsubscribe();
      window.removeEventListener(PARENT_SHELL_READY_EVENT, refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, [accountId, refresh]);

  const retry = async () => {
    setBusy(true);
    setError(null);
    try {
      window.dispatchEvent(new Event(PARENT_OFFLINE_RETRY_EVENT));
      await prepareParentAppShell({ force: true });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update the downloaded application.');
    } finally {
      setBusy(false);
    }
  };

  const percentage = status?.percentage || 0;
  const grouped = useMemo(() => {
    const groups = new Map<string, NonNullable<ParentOfflineReadiness['datasets']>>();
    for (const dataset of status?.datasets || []) {
      const name = dataset.childName || 'Application';
      groups.set(name, [...(groups.get(name) || []), dataset]);
    }
    return [...groups.entries()];
  }, [status]);

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4" aria-live="polite">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${status?.ready ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
          {status?.ready ? <CheckCircle2 className="w-5 h-5" /> : <CloudDownload className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-gray-900">Offline download</p>
            <span className={`text-sm font-bold tabular-nums ${status?.ready ? 'text-green-700' : 'text-blue-700'}`}>
              {percentage}%
            </span>
          </div>
          <p className={`text-sm font-medium ${status?.ready ? 'text-green-700' : 'text-blue-700'}`}>
            {status?.ready
              ? 'Dashboard ready offline'
              : status
                ? `Downloading ${status.completed} of ${status.expected} data sets`
                : 'Checking saved information…'}
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-label="Offline download progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}>
            <div className={`h-full rounded-full transition-[width] duration-300 ${status?.ready ? 'bg-green-600' : 'bg-blue-600'}`} style={{ width: `${percentage}%` }} />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {status?.preparedAt
              ? `Last updated on this device: ${formatUpdatedAt(status.preparedAt)}`
              : online ? 'The first download is being prepared.' : 'Connect once to finish the first download.'}
          </p>
        </div>
      </div>

      {grouped.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-gray-100 pt-3">
          {grouped.map(([groupName, datasets]) => (
            <div key={groupName}>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{groupName}</p>
              <ul className="space-y-1.5">
                {datasets.map(dataset => (
                  <li key={dataset.id} className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2">
                    {dataset.state === 'saved'
                      ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                      : <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                        <span className="text-xs font-medium text-gray-800">{dataset.label}</span>
                        <span className="text-[10px] text-gray-400">
                          {dataset.preparedAt ? formatUpdatedAt(dataset.preparedAt) : 'Pending'}
                        </span>
                      </div>
                      {dataset.detail && <p className="mt-0.5 text-[11px] leading-4 text-gray-500">{dataset.detail}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <button type="button" disabled={busy || !online} onClick={retry}
        className="mt-3 flex min-h-10 items-center gap-2 text-xs font-semibold text-blue-700 disabled:opacity-50">
        <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
        {busy ? 'Updating downloaded data…' : status?.ready ? 'Check for updates' : 'Continue download'}
      </button>
    </section>
  );
}
