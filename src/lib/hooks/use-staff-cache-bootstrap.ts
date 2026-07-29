"use client";

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/contexts/auth-context';
import { StaffService } from '@/lib/services/staff.service';
import { useDashboardDataRevisions } from './use-school-settings';
import { STAFF_QUERY_KEYS } from './use-staff';
import {
  getStaffCacheScope,
  normaliseStaff,
  readStaffCache,
  writeStaffCache,
} from '@/lib/cache/staff-cache';
import type { Staff } from '@/types';

/**
 * The sole browser network owner for the full authorised staff list. A warm
 * snapshot renders synchronously; Firestore is read only for a cold cache or
 * when the existing school-settings listener reports a staff mutation.
 */
export function useStaffCacheBootstrap() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const revisionsQuery = useDashboardDataRevisions();
  const previousScope = useRef<string | null>(null);
  const retryTarget = useRef('');
  const retryCount = useRef(0);
  const [retryEpoch, setRetryEpoch] = useState(0);

  const scope = isAuthenticated ? getStaffCacheScope(user?.id, user?.role) : '';
  const revision = revisionsQuery.data?.staff ?? 0;
  const revisionsReady = revisionsQuery.data !== undefined;

  useEffect(() => {
    if (!scope) {
      if (previousScope.current) {
        queryClient.removeQueries({ queryKey: STAFF_QUERY_KEYS.lists() });
        previousScope.current = null;
      }
      StaffService.clearSharedStaff();
      return;
    }

    if (previousScope.current && previousScope.current !== scope) {
      queryClient.removeQueries({ queryKey: STAFF_QUERY_KEYS.lists() });
      StaffService.clearSharedStaff();
    }
    previousScope.current = scope;

    const persisted = readStaffCache(scope);
    const queryKey = STAFF_QUERY_KEYS.list(scope);
    const inMemory = queryClient.getQueryData<Staff[]>(queryKey);

    if (inMemory === undefined && persisted) {
      queryClient.setQueryData(queryKey, persisted.data);
    }

    const sharedStaff = inMemory ?? persisted?.data;
    if (sharedStaff) {
      StaffService.hydrateSharedStaff(sharedStaff);
    }

    const needsColdFetch = persisted === null && inMemory === undefined;
    const needsRevisionRefresh = revisionsReady && persisted?.revision !== revision;
    if (!needsColdFetch && !needsRevisionRefresh) return;

    let disposed = false;
    let serverSucceeded = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const targetRevision = revisionsReady ? revision : 0;
    const target = `${scope}:${revisionsReady ? revision : 'cold'}`;
    if (retryTarget.current !== target) {
      retryTarget.current = target;
      retryCount.current = 0;
    }

    if (needsColdFetch) {
      void StaffService.getAllFromFirestoreCache().then(cachedStaff => {
        if (disposed || serverSucceeded || cachedStaff.length === 0) return;
        const normalised = normaliseStaff(cachedStaff);
        StaffService.hydrateSharedStaff(normalised);
        queryClient.setQueryData(queryKey, normalised);
        writeStaffCache(scope, -1, normalised);
        performance.mark?.('trinity:staff-firestore-cache-ready');
      });
    }

    void StaffService.refreshSharedStaff(() => StaffService.getAllForCache()).then(staff => {
      if (disposed) return;
      serverSucceeded = true;
      retryCount.current = 0;
      const normalised = normaliseStaff(staff);
      StaffService.hydrateSharedStaff(normalised);
      queryClient.setQueryData(queryKey, normalised);
      writeStaffCache(scope, targetRevision, normalised);
      performance.mark?.('trinity:staff-server-synced');
    }).catch(error => {
      console.error('Staff cache reconciliation failed:', error);
      if (!disposed && retryCount.current < 2) {
        retryCount.current += 1;
        retryTimer = setTimeout(() => setRetryEpoch(epoch => epoch + 1), 3000);
      }
    });

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [queryClient, retryEpoch, revision, revisionsReady, scope]);
}
