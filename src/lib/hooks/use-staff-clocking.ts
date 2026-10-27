'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/lib/contexts/auth-context';
import { useDashboardDataRevisions } from './use-school-settings';
import { loadStaffClockingCache } from '@/lib/cache/staff-clocking-cache';
import { useStaffClockingPersonalRevisions } from './use-staff-clocking-personal-revisions';
import type { SchoolSettings } from '@/types';
import type { StaffClockingBootstrap, StaffClockingDailyRecord, StaffClockingFeatureSettings, StaffClockingReportSummary, StaffClockingReviewRequest, StaffClockingSchedule, StaffClockingStaffCandidate, StaffClockingPersonalSchedule, StaffClockingTimekeeper } from '@/lib/staff-clocking/contracts';

export const STAFF_CLOCKING_QUERY_KEYS = {
  all: ['staff-clocking'] as const,
  bootstrap: () => [...STAFF_CLOCKING_QUERY_KEYS.all, 'bootstrap', 'private-v2'] as const,
  schedules: () => [...STAFF_CLOCKING_QUERY_KEYS.all, 'schedules'] as const,
  records: () => [...STAFF_CLOCKING_QUERY_KEYS.all, 'records'] as const,
  requests: (kind: 'exemption' | 'correction') => [...STAFF_CLOCKING_QUERY_KEYS.all, 'requests', kind] as const,
  staff: () => [...STAFF_CLOCKING_QUERY_KEYS.all, 'staff'] as const,
  closures: () => [...STAFF_CLOCKING_QUERY_KEYS.all, 'closures'] as const,
  notifications: () => [...STAFF_CLOCKING_QUERY_KEYS.all, 'notifications'] as const,
  myDashboard: () => [...STAFF_CLOCKING_QUERY_KEYS.all, 'my-dashboard'] as const,
};

function useClockingScope() {
  const { user } = useAuth();
  return [process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools', user?.id || 'signed-out', user?.staffId || '', user?.role || '', JSON.stringify(user?.granularPermissions?.find(item => item.moduleId === 'staff_clocking') || null)];
}

type RevisionName = keyof NonNullable<SchoolSettings['dataRevisions']>;

export function useSchoolDay(enabled: boolean) {
  const schoolDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [day, setDay] = useState(schoolDay);
  useEffect(() => {
    if (!enabled) return;
    const tick = () => setDay(schoolDay());
    tick();
    const timer = setInterval(tick, 30_000);
    window.addEventListener('focus', tick);
    return () => { clearInterval(timer); window.removeEventListener('focus', tick); };
  }, [enabled]);
  return day;
}

function useClockingQuery<T>(key: readonly unknown[], fetchData: () => Promise<T>, enabled: boolean, dependencies: RevisionName[], daily: boolean | string = false, ownRevision?: string) {
  const scope = useClockingScope();
  const { isAuthenticated } = useAuth();
  const personal = ownRevision !== undefined;
  const revisions = useDashboardDataRevisions({ enabled: enabled && isAuthenticated && !personal });
  const schoolDay = useSchoolDay(daily === true && enabled);
  const day = typeof daily === 'string' ? daily : daily ? schoolDay : '';
  const revision = personal ? ownRevision : JSON.stringify(dependencies.map(name => revisions.data?.[name] ?? 0));
  const cacheKey = JSON.stringify(['staff-clocking-cache-v1', ...scope, key, day]);
  const queryKey = [...key, ...scope, day, revision];
  return useQuery({
    queryKey,
    queryFn: () => loadStaffClockingCache(cacheKey, revision, fetchData),
    enabled: enabled && isAuthenticated && (personal || revisions.data?.staffClockingConfig !== undefined),
    placeholderData: (previous, query) => JSON.stringify(query?.queryKey.slice(0, -1)) === JSON.stringify(queryKey.slice(0, -1)) ? previous : undefined,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    networkMode: 'offlineFirst',
    // A failed cold load may retry when reopened; successful snapshots never
    // expire just because the page was mounted again.
    refetchOnMount: (query) => query.state.data === undefined,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });
}

export async function requestStaffClocking<T>(path: string, init?: RequestInit): Promise<T> {
  const owner = auth.currentUser?.uid;
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Your session is not ready. Please refresh and try again.');
  const response = await fetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!owner || auth.currentUser?.uid !== owner) throw new Error('Your account changed. Open Staff Clocking again.');
  if (!response.ok || !body.success) throw new Error(body.error || 'Staff clocking request failed.');
  return body.result ?? body;
}

export function useStaffClockingBootstrap(enabled = true) {
  return useClockingQuery(STAFF_CLOCKING_QUERY_KEYS.bootstrap(), () => requestStaffClocking<StaffClockingBootstrap>('/api/staff-clocking/bootstrap'), enabled, ['staffClockingConfig', 'staff']);
}

export function useUpdateStaffClockingSettings() {
  return useMutation({
    mutationFn: (settings: Pick<StaffClockingFeatureSettings, 'enabled' | 'accessMode' | 'enrolledStaffIds'>) =>
      requestStaffClocking<StaffClockingFeatureSettings>('/api/staff-clocking/settings', { method: 'PUT', body: JSON.stringify(settings) }),
  });
}

export function useStaffClockingSchedules(enabled = true) {
  return useClockingQuery(STAFF_CLOCKING_QUERY_KEYS.schedules(), async () => (await requestStaffClocking<{ schedules: StaffClockingSchedule[] }>('/api/staff-clocking/schedules')).schedules, enabled, ['staffClockingConfig']);
}

export function useCreateStaffClockingSchedule() {
  return useMutation({
    mutationFn: (schedule: Omit<StaffClockingSchedule, 'id'>) =>
      requestStaffClocking<StaffClockingSchedule>('/api/staff-clocking/schedules', { method: 'POST', body: JSON.stringify(schedule) }),
  });
}

export function useDeleteStaffClockingSchedule() {
  return useMutation({
    mutationFn: (id: string) => requestStaffClocking(`/api/staff-clocking/schedules/${id}`, { method: 'DELETE' }),
  });
}

export function useUpdateStaffClockingSchedule() {
  return useMutation({
    mutationFn: ({ id, schedule }: { id: string; schedule: Omit<StaffClockingSchedule, 'id'> }) => requestStaffClocking(`/api/staff-clocking/schedules/${id}`, { method: 'PUT', body: JSON.stringify(schedule) }),
  });
}

export function useStaffClockingDailyRecords(filters: { from?: string; to?: string; staffId?: string; query?: string } = {}, enabled = true) {
  // Search the already authorised period locally; typing never re-reads it.
  const { query = '', ...period } = filters;
  const params = new URLSearchParams(Object.entries(period).filter(([, value]) => Boolean(value)).sort(([left], [right]) => left.localeCompare(right)) as Array<[string, string]>);
  const result = useClockingQuery([...STAFF_CLOCKING_QUERY_KEYS.records(), params.toString()], () => requestStaffClocking<{ records: StaffClockingDailyRecord[]; summary: StaffClockingReportSummary }>(`/api/staff-clocking/records?${params}`), enabled, ['staffClockingRecords']);
  if (!query.trim() || !result.data) return result;
  const search = query.trim().toLowerCase();
  const records = result.data.records.filter(record => `${record.staffName || ''} ${record.staffId}`.toLowerCase().includes(search));
  const summary = records.reduce<StaffClockingReportSummary>((totals, record) => ({ total: totals.total + 1, complete: totals.complete + Number(record.status === 'complete'), open: totals.open + Number(record.status === 'open'), late: totals.late + Number(record.arrivalStatus === 'late'), exempted: totals.exempted + Number(record.reviewStatus === 'exempted'), corrected: totals.corrected + Number(record.reviewStatus === 'corrected') }), { total: 0, complete: 0, open: 0, late: 0, exempted: 0, corrected: 0 });
  return { ...result, data: { records, summary } };
}

export function useStaffClockingStaffCandidates(enabled: boolean) { return useClockingQuery(STAFF_CLOCKING_QUERY_KEYS.staff(), async () => (await requestStaffClocking<{ staff: StaffClockingStaffCandidate[] }>('/api/staff-clocking/staff')).staff, enabled, ['staff']); }
export function useStaffClockingClosures(enabled: boolean) { return useClockingQuery(STAFF_CLOCKING_QUERY_KEYS.closures(), async () => (await requestStaffClocking<{ closures: Array<Record<string, unknown>> }>('/api/staff-clocking/closures')).closures, enabled, ['events']); }
export function useCreateStaffClockingClosure() { return useMutation({ mutationFn: (input: { title: string; startDate: string; endDate?: string; description?: string }) => requestStaffClocking('/api/staff-clocking/closures', { method: 'POST', body: JSON.stringify(input) }) }); }
export function useFinalizeStaffClockingDate() { return useMutation({ mutationFn: (localDate: string) => requestStaffClocking('/api/staff-clocking/finalize', { method: 'POST', body: JSON.stringify({ localDate }) }) }); }
export function useExportStaffClockingRecords() { return useMutation({ mutationFn: async (filters: { from?: string; to?: string; staffId?: string; query?: string }) => { const token = await auth.currentUser?.getIdToken(); if (!token) throw new Error('Your session is not ready. Please refresh and try again.'); const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => Boolean(value)) as Array<[string, string]>); const response = await fetch(`/api/staff-clocking/export?${params}`, { headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || 'Unable to export clock records.'); } const link = document.createElement('a'); link.href = URL.createObjectURL(await response.blob()); link.download = 'staff-clocking-records.csv'; link.click(); URL.revokeObjectURL(link.href); } }); }
export function useOwnStaffClockingNotifications(enabled: boolean) {
  const revisions = useStaffClockingPersonalRevisions(enabled);
  return useClockingQuery(STAFF_CLOCKING_QUERY_KEYS.notifications(), async () => (await requestStaffClocking<{ notifications: Array<{ id: string; title: string; body: string; createdAt?: string }> }>('/api/staff-clocking/notifications')).notifications, enabled && !!revisions.data, [], false, String(revisions.data?.notifications || 0));
}

export function useOwnStaffClockingDashboard(enabled: boolean) {
  const revisions = useStaffClockingPersonalRevisions(enabled);
  const day = useSchoolDay(enabled);
  const dates = revisions.data?.dates || {};
  const schedule = useClockingQuery([...STAFF_CLOCKING_QUERY_KEYS.myDashboard(), 'schedule'], () => requestStaffClocking<StaffClockingPersonalSchedule>('/api/staff-clocking/my-dashboard?part=schedule'), enabled, ['staffClockingConfig', 'staff', 'events', 'staffClockingDuty'], day);
  const status = useClockingQuery([...STAFF_CLOCKING_QUERY_KEYS.myDashboard(), 'status'], () => requestStaffClocking<{localDate: string; record?: StaffClockingDailyRecord}>('/api/staff-clocking/my-dashboard?part=status'), enabled && !!revisions.data, [], day, String(dates[day] || 0));
  // A scan today cannot change the previous five days. Corrections to older
  // dates and the next school day reconcile history independently.
  const historyRevision = JSON.stringify(Object.entries(dates).filter(([date]) => date < day).sort(([a], [b]) => a.localeCompare(b)));
  const history = useClockingQuery([...STAFF_CLOCKING_QUERY_KEYS.myDashboard(), 'history'], () => requestStaffClocking<{history: StaffClockingDailyRecord[]}>('/api/staff-clocking/my-dashboard?part=history'), enabled && !!revisions.data, [], day, historyRevision);
  const error = revisions.error || schedule.error || status.error || history.error;
  const data = schedule.data && status.data && history.data ? { ...schedule.data, ...status.data, ...history.data } : undefined;
  if (error) return { data, isPending: false, isError: true as const, error };
  return { data, isPending: schedule.isPending || status.isPending || history.isPending, isError: false as const, error: null };
}

export function useStaffClockingTimekeepers(enabled: boolean) {
  return useClockingQuery([...STAFF_CLOCKING_QUERY_KEYS.all, 'timekeepers'], () => requestStaffClocking<StaffClockingTimekeeper[]>('/api/staff-clocking/timekeepers'), enabled, ['staffClockingTimekeepers', 'staff']);
}

export function useUpdateStaffClockingTimekeeper() {
  return useMutation({ mutationFn: (input: { accountId: string; allowed: boolean; revision: number }) => requestStaffClocking('/api/staff-clocking/timekeepers', { method: 'PUT', body: JSON.stringify(input) }) });
}

export function useCreateStaffClockingQrSession() {
  return useMutation({
    mutationFn: (sessionId?: string) => requestStaffClocking<{ sessionId: string; token: string; expiresAt: string }>('/api/staff-clocking/record/session', { method: 'POST', body: JSON.stringify(sessionId ? { sessionId } : {}) }),
  });
}

export function useRevokeStaffClockingQrSession() {
  return useMutation({ mutationFn: (sessionId: string) => requestStaffClocking('/api/staff-clocking/record/session', { method: 'DELETE', body: JSON.stringify({ sessionId }) }) });
}

export function useSubmitStaffClockingScan() {
  return useMutation({
    mutationFn: (input: { token: string; operationId: string }) => requestStaffClocking('/api/staff-clocking/clock', { method: 'POST', body: JSON.stringify(input) }),
  });
}

export function useCreateStaffClockingRequest(kind: 'exemption' | 'correction') {
  return useMutation({
    mutationFn: (input: { localDate: string; reason: string; proposedClockInTime?: string; proposedClockOutTime?: string }) =>
      requestStaffClocking(`/api/staff-clocking/${kind}s`, { method: 'POST', body: JSON.stringify(input) }),
  });
}

export function useCreateManagedStaffClockingExemption() {
  return useMutation({
    mutationFn: (input: { staffId: string; localDate: string; reason: string }) =>
      requestStaffClocking('/api/staff-clocking/manager-exemptions', { method: 'POST', body: JSON.stringify(input) }),
  });
}

export function useStaffClockingReviewRequests(kind: 'exemption' | 'correction', enabled: boolean) {
  return useClockingQuery(STAFF_CLOCKING_QUERY_KEYS.requests(kind), async () => (await requestStaffClocking<{ requests: StaffClockingReviewRequest[] }>(`/api/staff-clocking/requests/${kind}`)).requests, enabled, ['staffClockingRequests']);
}

export function useReviewStaffClockingRequest(kind: 'exemption' | 'correction') {
  return useMutation({
    mutationFn: ({ id, approved, reviewNote }: { id: string; approved: boolean; reviewNote?: string }) =>
      requestStaffClocking(`/api/staff-clocking/requests/${kind}/${id}/review`, { method: 'POST', body: JSON.stringify({ approved, reviewNote }) }),
  });
}
