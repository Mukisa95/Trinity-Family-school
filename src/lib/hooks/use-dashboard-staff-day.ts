'use client';

import { useRef } from 'react';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/lib/contexts/auth-context';
import type { DashboardStaffDay } from '@/lib/dashboard/staff-day-contracts';
import { useDashboardDataRevisions, useDashboardRevisionReadiness } from './use-school-settings';
import { useRevisionedDomainQuery } from './use-revisioned-domain-query';
import { staffDayRevisionToken } from '@/lib/cache/staff-day-revisions';

export const dashboardStaffDayKey = ['dashboard-staff-day'] as const;

export function useDashboardStaffDay(date: string, roleStamp = '') {
  const { user, isAuthenticated } = useAuth();
  const revisions = useDashboardDataRevisions();
  const ready = useDashboardRevisionReadiness(['operational', 'reference']);
  const enabled = isAuthenticated && !!user?.isActive && (user.role === 'Admin' || user.role === 'Staff');
  const revision = staffDayRevisionToken(revisions.data, date, user?.staffId, user?.role === 'Admin' || roleStamp === 'school');
  const identity = JSON.stringify([user?.id, user?.role, user?.staffId, roleStamp, revision]);
  const latestIdentity = useRef(identity);
  latestIdentity.current = identity;
  const result = useRevisionedDomainQuery<DashboardStaffDay>({
    queryKey: [...dashboardStaffDayKey, user?.id, user?.role, user?.staffId, date, roleStamp],
    cacheName: `dashboard-staff-day:${encodeURIComponent(user?.staffId || '')}:${roleStamp}`,
    revisionKeys: [], revisionToken: revision, canReconcile: ready, enabled,
    queryFn: async (): Promise<DashboardStaffDay> => {
      const owner = auth.currentUser?.uid;
      const token = await auth.currentUser?.getIdToken();
      if (!owner || !token) throw new Error('Your session is not ready. Please try again.');
      const response = await fetch('/api/dashboard/staff-day', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const body = await response.json();
      if (auth.currentUser?.uid !== owner) throw new Error('Your account changed. Please refresh.');
      if (latestIdentity.current !== identity) throw new Error('Staff information changed while loading.');
      if (!response.ok || !body.success) throw new Error(body.error || 'Unable to load your staff day.');
      return body.result;
    },
  });
  const data = enabled && result.data?.date === date ? result.data : undefined;
  return { ...result,
    data: data && revisions.data?.staffClockingEnabled === false ? { ...data, clockingEnabled: false, arrivals: [] } : data,
    isLoading: enabled && !data && !result.isError,
  };
}
