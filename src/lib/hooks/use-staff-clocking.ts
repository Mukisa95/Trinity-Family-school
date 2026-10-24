'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/lib/contexts/auth-context';
import type { StaffClockingBootstrap, StaffClockingDailyRecord, StaffClockingFeatureSettings, StaffClockingReportSummary, StaffClockingReviewRequest, StaffClockingSchedule, StaffClockingStaffCandidate } from '@/lib/staff-clocking/contracts';

export const STAFF_CLOCKING_QUERY_KEYS = {
  all: ['staff-clocking'] as const,
  bootstrap: () => [...STAFF_CLOCKING_QUERY_KEYS.all, 'bootstrap'] as const,
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
  return [user?.id || 'signed-out', user?.staffId || '', user?.role || '', JSON.stringify(user?.granularPermissions?.find(item => item.moduleId === 'staff_clocking') || null)];
}

async function requestStaffClocking<T>(path: string, init?: RequestInit): Promise<T> {
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
  const scope = useClockingScope();
  return useQuery({
    queryKey: [...STAFF_CLOCKING_QUERY_KEYS.bootstrap(), ...scope],
    queryFn: () => requestStaffClocking<StaffClockingBootstrap>('/api/staff-clocking/bootstrap'),
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useUpdateStaffClockingSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (settings: Pick<StaffClockingFeatureSettings, 'enabled' | 'accessMode' | 'enrolledStaffIds'>) =>
      requestStaffClocking<StaffClockingFeatureSettings>('/api/staff-clocking/settings', { method: 'PUT', body: JSON.stringify(settings) }),
    onSuccess: () => void client.invalidateQueries({ queryKey: STAFF_CLOCKING_QUERY_KEYS.bootstrap() }),
  });
}

export function useStaffClockingSchedules(enabled = true) {
  const scope = useClockingScope();
  return useQuery({
    queryKey: [...STAFF_CLOCKING_QUERY_KEYS.schedules(), ...scope],
    queryFn: async () => (await requestStaffClocking<{ schedules: StaffClockingSchedule[] }>('/api/staff-clocking/schedules')).schedules,
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateStaffClockingSchedule() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (schedule: Omit<StaffClockingSchedule, 'id'>) =>
      requestStaffClocking<StaffClockingSchedule>('/api/staff-clocking/schedules', { method: 'POST', body: JSON.stringify(schedule) }),
    onSuccess: () => void client.invalidateQueries({ queryKey: STAFF_CLOCKING_QUERY_KEYS.schedules() }),
  });
}

export function useDeleteStaffClockingSchedule() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => requestStaffClocking(`/api/staff-clocking/schedules/${id}`, { method: 'DELETE' }),
    onSuccess: () => void client.invalidateQueries({ queryKey: STAFF_CLOCKING_QUERY_KEYS.schedules() }),
  });
}

export function useUpdateStaffClockingSchedule() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, schedule }: { id: string; schedule: Omit<StaffClockingSchedule, 'id'> }) => requestStaffClocking(`/api/staff-clocking/schedules/${id}`, { method: 'PUT', body: JSON.stringify(schedule) }),
    onSuccess: () => void client.invalidateQueries({ queryKey: STAFF_CLOCKING_QUERY_KEYS.schedules() }),
  });
}

export function useStaffClockingDailyRecords(filters: { from?: string; to?: string; staffId?: string; query?: string } = {}, enabled = true) {
  const scope = useClockingScope();
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => Boolean(value)) as Array<[string, string]>);
  return useQuery({
    queryKey: [...STAFF_CLOCKING_QUERY_KEYS.records(), ...scope, filters],
    queryFn: () => requestStaffClocking<{ records: StaffClockingDailyRecord[]; summary: StaffClockingReportSummary }>(`/api/staff-clocking/records?${params.toString()}`),
    enabled,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useStaffClockingStaffCandidates(enabled: boolean) { const scope = useClockingScope(); return useQuery({ queryKey: [...STAFF_CLOCKING_QUERY_KEYS.staff(), ...scope], queryFn: async () => (await requestStaffClocking<{ staff: StaffClockingStaffCandidate[] }>('/api/staff-clocking/staff')).staff, enabled, staleTime: 60_000 }); }
export function useStaffClockingClosures(enabled: boolean) { const scope = useClockingScope(); return useQuery({ queryKey: [...STAFF_CLOCKING_QUERY_KEYS.closures(), ...scope], queryFn: async () => (await requestStaffClocking<{ closures: Array<Record<string, unknown>> }>('/api/staff-clocking/closures')).closures, enabled, staleTime: 30_000 }); }
export function useCreateStaffClockingClosure() { const client = useQueryClient(); return useMutation({ mutationFn: (input: { title: string; startDate: string; endDate?: string; description?: string }) => requestStaffClocking('/api/staff-clocking/closures', { method: 'POST', body: JSON.stringify(input) }), onSuccess: () => void client.invalidateQueries({ queryKey: STAFF_CLOCKING_QUERY_KEYS.closures() }) }); }
export function useFinalizeStaffClockingDate() { const client = useQueryClient(); return useMutation({ mutationFn: (localDate: string) => requestStaffClocking('/api/staff-clocking/finalize', { method: 'POST', body: JSON.stringify({ localDate }) }), onSuccess: () => void client.invalidateQueries({ queryKey: STAFF_CLOCKING_QUERY_KEYS.records() }) }); }
export function useExportStaffClockingRecords() { return useMutation({ mutationFn: async (filters: { from?: string; to?: string; staffId?: string; query?: string }) => { const token = await auth.currentUser?.getIdToken(); if (!token) throw new Error('Your session is not ready. Please refresh and try again.'); const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => Boolean(value)) as Array<[string, string]>); const response = await fetch(`/api/staff-clocking/export?${params}`, { headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || 'Unable to export clock records.'); } const link = document.createElement('a'); link.href = URL.createObjectURL(await response.blob()); link.download = 'staff-clocking-records.csv'; link.click(); URL.revokeObjectURL(link.href); } }); }
export function useOwnStaffClockingNotifications(enabled: boolean) { const scope = useClockingScope(); return useQuery({ queryKey: [...STAFF_CLOCKING_QUERY_KEYS.notifications(), ...scope], queryFn: async () => (await requestStaffClocking<{ notifications: Array<{ id: string; title: string; body: string; createdAt?: string }> }>('/api/staff-clocking/notifications')).notifications, enabled, staleTime: 30_000 }); }
export function useOwnStaffClockingDashboard(enabled: boolean) { const scope = useClockingScope(); return useQuery({ queryKey: [...STAFF_CLOCKING_QUERY_KEYS.myDashboard(), ...scope], queryFn: () => requestStaffClocking<{ staff: { id: string; name: string; group?: string }; localDate: string; record?: StaffClockingDailyRecord; history: StaffClockingDailyRecord[]; schedule: { kind: string; clockInBy?: string; clockOutBy?: string; graceMinutes?: number; sourceScope?: string; reason?: string }; calendar?: { isClosed: boolean; label?: string } }>('/api/staff-clocking/my-dashboard'), enabled, staleTime: 15_000, refetchOnWindowFocus: false }); }

export function useCreateStaffClockingQrSession() {
  return useMutation({
    mutationFn: (sessionId?: string) => requestStaffClocking<{ sessionId: string; token: string; expiresAt: string }>('/api/staff-clocking/record/session', { method: 'POST', body: JSON.stringify(sessionId ? { sessionId } : {}) }),
  });
}

export function useRevokeStaffClockingQrSession() {
  return useMutation({ mutationFn: (sessionId: string) => requestStaffClocking('/api/staff-clocking/record/session', { method: 'DELETE', body: JSON.stringify({ sessionId }) }) });
}

export function useSubmitStaffClockingScan() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { token: string; operationId: string }) => requestStaffClocking('/api/staff-clocking/clock', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => void Promise.all([client.invalidateQueries({ queryKey: STAFF_CLOCKING_QUERY_KEYS.bootstrap() }), client.invalidateQueries({ queryKey: STAFF_CLOCKING_QUERY_KEYS.myDashboard() })]),
  });
}

export function useCreateStaffClockingRequest(kind: 'exemption' | 'correction') {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { localDate: string; reason: string; proposedClockInTime?: string; proposedClockOutTime?: string }) =>
      requestStaffClocking(`/api/staff-clocking/${kind}s`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => void client.invalidateQueries({ queryKey: STAFF_CLOCKING_QUERY_KEYS.requests(kind) }),
  });
}

export function useCreateManagedStaffClockingExemption() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { staffId: string; localDate: string; reason: string }) =>
      requestStaffClocking('/api/staff-clocking/manager-exemptions', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => void Promise.all([
      client.invalidateQueries({ queryKey: STAFF_CLOCKING_QUERY_KEYS.records() }),
      client.invalidateQueries({ queryKey: STAFF_CLOCKING_QUERY_KEYS.requests('exemption') }),
    ]),
  });
}

export function useStaffClockingReviewRequests(kind: 'exemption' | 'correction', enabled: boolean) {
  const scope = useClockingScope();
  return useQuery({
    queryKey: [...STAFF_CLOCKING_QUERY_KEYS.requests(kind), ...scope],
    queryFn: async () => (await requestStaffClocking<{ requests: StaffClockingReviewRequest[] }>(`/api/staff-clocking/requests/${kind}`)).requests,
    enabled,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useReviewStaffClockingRequest(kind: 'exemption' | 'correction') {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approved, reviewNote }: { id: string; approved: boolean; reviewNote?: string }) =>
      requestStaffClocking(`/api/staff-clocking/requests/${kind}/${id}/review`, { method: 'POST', body: JSON.stringify({ approved, reviewNote }) }),
    onSuccess: () => void Promise.all([
      client.invalidateQueries({ queryKey: STAFF_CLOCKING_QUERY_KEYS.requests(kind) }),
      client.invalidateQueries({ queryKey: STAFF_CLOCKING_QUERY_KEYS.records() }),
    ]),
  });
}
