'use client';

import { useSyncExternalStore } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { GranularPermissionService as Permissions } from '@/lib/services/granular-permissions.service';
import { DutyServiceService } from '@/lib/services/duty-service.service';
import { useDashboardDataRevisions, useDashboardRevisionReadiness } from './use-school-settings';
import { useRevisionedDomainQuery } from './use-revisioned-domain-query';
import { dutyServiceCacheName, type DutyServiceData } from '@/lib/duty-service/contracts';
import { isDutyServiceOffline } from '@/lib/duty-service/connectivity';

function subscribe(listener: () => void) {
  for (const name of ['online', 'offline', 'trinity-android-connectivity']) window.addEventListener(name, listener);
  return () => { for (const name of ['online', 'offline', 'trinity-android-connectivity']) window.removeEventListener(name, listener); };
}
export function useDutyServiceOffline() { return useSyncExternalStore(subscribe, isDutyServiceOffline, () => false); }

/** One authorized persisted owner for all duty views. Derived tabs never query again. */
export function useDutyServiceData(options?: { enabled?: boolean }) {
  const { user, isAuthenticated } = useAuth();
  const revisions = useDashboardDataRevisions();
  const ready = useDashboardRevisionReadiness(['operational']);
  const offline = useDutyServiceOffline();
  const enabled = options?.enabled !== false && !!user && isAuthenticated && user.isActive !== false && ['Admin', 'Staff'].includes(user.role)
    && Permissions.canAccessPage(user, 'duty_service', 'list');
  const query = useRevisionedDomainQuery<DutyServiceData>({
    queryKey: ['duty-service-snapshot', user ? dutyServiceCacheName(user) : 'signed-out'],
    cacheName: user ? dutyServiceCacheName(user) : 'duty-service:signed-out',
    revisionKeys: [], revisionToken: `duty:${revisions.data?.dutyService || 0}`,
    canReconcile: ready && !offline, enabled,
    queryFn: () => DutyServiceService.getOfflineData(),
  });
  return { ...query, data: enabled ? query.data : undefined, offline };
}
