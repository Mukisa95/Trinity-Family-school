import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getDailyAttendanceSummary,
  buildDashboardAttendanceData,
  toAttendanceSummaryEntry,
} from '@/lib/services/attendance-summary.service';
import { AttendanceService } from '@/lib/services/attendance.service';
import {
  getAttendanceCacheScope,
  readAttendanceSummaryCache,
  writeAttendanceSummaryCache,
  type AttendanceDailySummary,
} from '@/lib/cache/attendance-summary-cache';
import { useDashboardDataRevisions } from './use-school-settings';
import { flushDueAttendanceSummaryOutbox } from '@/lib/services/attendance-summary-outbox';
import { useAuth } from '@/lib/contexts/auth-context';

export const attendanceSummaryKeys = {
  daily: (scope: string, date: string, revision: number) =>
    ['attendance', 'daily-summary', scope, date, revision] as const,
};

function emptySummary(date: string, revision: number): AttendanceDailySummary {
  return { schema: 1, date, revision, records: [] };
}

/**
 * Shared cache owner for today's attendance. A warm summary is available
 * synchronously; the only reconciliation read is a single document read after
 * the attendance revision changes or when a device has no cached summary.
 */
export function useAttendanceSummary(date: string, enabled = true) {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const scope = isAuthenticated ? getAttendanceCacheScope(user?.id, user?.role) : '';
  const revisionsQuery = useDashboardDataRevisions();
  const revisionsReady = revisionsQuery.data !== undefined;
  const revision = revisionsQuery.data?.attendance ?? 0;
  const persisted = useMemo(() => readAttendanceSummaryCache(scope, date), [date, scope]);
  const needsFetch = enabled && !!scope && !!date && (
    !persisted || (revisionsReady && persisted.revision !== revision)
  );

  useEffect(() => {
    if (enabled && scope) void flushDueAttendanceSummaryOutbox(scope);
  }, [enabled, scope]);

  const query = useQuery<AttendanceDailySummary>({
    queryKey: attendanceSummaryKeys.daily(scope, date, revision),
    queryFn: async () => {
      const remote = await getDailyAttendanceSummary(date);
      // Migration-safe cold start: existing schools may not have the derived
      // document yet. One bounded daily read seeds the local summary so the
      // dashboard remains correct immediately; future sessions publish the
      // projection and avoid this fallback.
      const legacyRecords = remote ? [] : await AttendanceService.getAttendanceByDateRange(date, date);
      const next = remote || {
        ...emptySummary(date, revision),
        records: legacyRecords.map(toAttendanceSummaryEntry).filter(Boolean) as AttendanceDailySummary['records'],
      };
      // Legacy summary documents may carry an older per-day revision. Stamp
      // the cache with the observed school revision after reconciliation.
      const reconciled = revisionsReady ? { ...next, revision } : next;
      writeAttendanceSummaryCache(scope, date, reconciled);
      return reconciled;
    },
    enabled: needsFetch,
    initialData: persisted || undefined,
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: previous => previous,
  });

  useEffect(() => {
    if (persisted && !queryClient.getQueryData(attendanceSummaryKeys.daily(scope, date, revision))) {
      queryClient.setQueryData(attendanceSummaryKeys.daily(scope, date, revision), persisted);
    }
  }, [date, persisted, queryClient, revision, scope]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onSummaryUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{
        scope: string;
        summary: AttendanceDailySummary;
      }>).detail;
      const summary = detail?.summary;
      if (detail?.scope !== scope || !summary || summary.date !== date) return;
      writeAttendanceSummaryCache(scope, date, summary);
      queryClient.setQueryData(attendanceSummaryKeys.daily(scope, date, summary.revision), summary);
      queryClient.setQueryData(attendanceSummaryKeys.daily(scope, date, revision), summary);
    };
    window.addEventListener('trinity:attendance-summary-updated', onSummaryUpdated);
    return () => window.removeEventListener('trinity:attendance-summary-updated', onSummaryUpdated);
  }, [date, queryClient, revision, scope]);

  const summary = query.data || persisted || null;
  return {
    summary,
    data: buildDashboardAttendanceData(summary),
    isLoading: enabled && !!scope && !summary && (needsFetch || query.isPending),
    error: query.error,
    refetch: query.refetch,
  };
}
