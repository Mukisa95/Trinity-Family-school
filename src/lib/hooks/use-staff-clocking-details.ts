'use client';

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/contexts/auth-context';
import { useDashboardDataRevisions, dashboardDataRevisionKeys, type DashboardDataRevisions } from './use-school-settings';
import { useStaffClockingPersonalRevisions } from './use-staff-clocking-personal-revisions';
import { useSchoolDay, requestStaffClocking } from './use-staff-clocking';
import { loadStaffClockingCache } from '@/lib/cache/staff-clocking-cache';
import { detailMonths } from '@/lib/staff-clocking/details-report';
import type { DetailRange } from '@/lib/staff-clocking/details-contracts';
import type { StaffClockingDailyRecord, StaffClockingPersonalRevisions } from '@/lib/staff-clocking/contracts';

function useDetailContext(staffId: string, enabled: boolean) {
  const { user, isAuthenticated } = useAuth();
  const scoped = user?.role === 'Admin' || user?.staffId === staffId;
  const personal = useStaffClockingPersonalRevisions(enabled && scoped, staffId);
  const shared = useDashboardDataRevisions({ enabled: enabled && isAuthenticated });
  const today = useSchoolDay(enabled);
  const scope = JSON.stringify([process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools', user?.id, user?.staffId, user?.role, user?.granularPermissions]);
  const dates = (range?: DetailRange) => scoped ? Object.entries(personal.data?.dates || {}).filter(([date]) => !range || date >= range.from && date <= range.to).sort(([a], [b]) => a.localeCompare(b)) : shared.data?.staffClockingRecords;
  return { scope, today, personal, shared, dates, scoped, ready: isAuthenticated && shared.data?.staffClockingConfig !== undefined && (!scoped || !!personal.data), enabled };
}
function detailOptions<T>(scope: string, staffId: string, part: string, revision: string, enabled: boolean, range?: DetailRange, cursor?: string) {
  const params = new URLSearchParams({ part, ...(range || {}), ...(cursor ? { cursor } : {}) });
  const key = ['staff-clocking-details-v1', scope, staffId, params.toString()];
  const queryKey = [...key, revision];
  return { queryKey, queryFn: () => loadStaffClockingCache(JSON.stringify(key), revision, () => requestStaffClocking<T>(`/api/staff-clocking/staff/${encodeURIComponent(staffId)}?${params}`)),
    enabled, staleTime: Infinity, gcTime: 24 * 60 * 60 * 1000, networkMode: 'offlineFirst' as const, refetchOnMount: (query: { state: { data?: unknown } }) => query.state.data === undefined, refetchOnReconnect: false as const, refetchOnWindowFocus: false as const };
}
export function useStaffClockingDetail<T>(staffId: string, part: 'profile' | 'plan' | 'today' | 'exemptions' | 'requests' | 'audit', enabled: boolean, range?: DetailRange, cursor?: string) {
  const context = useDetailContext(staffId, enabled);
  const revision = JSON.stringify(part === 'profile' ? [context.shared.data?.staff] : part === 'plan' ? [context.shared.data?.staff, context.shared.data?.staffClockingConfig, context.shared.data?.events] : part === 'today' ? [context.dates({ from: context.today, to: context.today })] : [context.dates(range), context.scoped ? context.personal.data?.requests || 0 : context.shared.data?.staffClockingRequests]);
  const query = useQuery<T>(detailOptions<T>(context.scope, staffId, part, revision, enabled && context.ready, part === 'today' ? { from: context.today, to: context.today } : range, cursor));
  return { ...query, synchronizationError: context.personal.error, revision };
}
export function useStaffClockingDetailMonths(staffId: string, range: DetailRange, enabled: boolean) {
  const context = useDetailContext(staffId, enabled);
  const queries = useQueries({ queries: detailMonths(range).map(month => detailOptions<{records: StaffClockingDailyRecord[]; verifiedAt?: string}>(context.scope, staffId, 'history', JSON.stringify(context.dates(month)), enabled && context.ready, month)) });
  return { records: queries.flatMap(query => query.data?.records || []).filter(record => record.localDate >= range.from && record.localDate <= range.to),
    isPending: queries.some(query => query.isPending), error: context.personal.error || queries.find(query => query.error)?.error, updatedAt: queries.length ? Math.min(...queries.map(query => query.data?.verifiedAt ? Date.parse(query.data.verifiedAt) : 0)) : 0 };
}
export function useMutateStaffClockingDetail(staffId: string) {
  return useMutation({ mutationFn: (input: Record<string, unknown>) => requestStaffClocking(`/api/staff-clocking/staff/${encodeURIComponent(staffId)}`, { method: 'POST', body: JSON.stringify(input) }) });
}

export function useCheckStaffClockingDetail(staffId: string) {
  const client = useQueryClient(), { user } = useAuth();
  return useMutation({
    mutationFn: () => requestStaffClocking<{shared: Record<string, number>; personal: StaffClockingPersonalRevisions}>(`/api/staff-clocking/staff/${encodeURIComponent(staffId)}?part=revisions`),
    onSuccess: result => {
      client.setQueryData(dashboardDataRevisionKeys.all, (current: DashboardDataRevisions | undefined) => ({...current, ...Object.fromEntries(Object.entries(result.shared).map(([key, value]) => [key, Math.max(Number(current?.[key as keyof DashboardDataRevisions] || 0), value)]))}));
      const key = ['staff-clocking-personal-revisions', JSON.stringify([user?.id, staffId])];
      client.setQueryData(key, result.personal);
      client.setQueryData([...key, 'error'], null);
    },
  });
}
