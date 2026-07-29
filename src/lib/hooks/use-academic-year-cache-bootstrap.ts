"use client";

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/contexts/auth-context';
import { AcademicYearsService } from '@/lib/services/academic-years.service';
import { useDashboardDataRevisions } from './use-school-settings';
import { academicYearsKeys } from './use-academic-years';
import {
  getAcademicYearCacheScope,
  normaliseAcademicYears,
  readAcademicYearCache,
  writeAcademicYearCache,
} from '@/lib/cache/academic-year-cache';
import type { AcademicYear } from '@/types';

/**
 * The sole browser network owner for academic-year data. A warm snapshot is
 * restored synchronously; Firestore is consulted only for a cold cache or an
 * actual academic-year revision reported by the existing settings listener.
 */
export function useAcademicYearCacheBootstrap() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const revisionsQuery = useDashboardDataRevisions();
  const previousScope = useRef<string | null>(null);
  const retryTarget = useRef('');
  const retryCount = useRef(0);
  const [retryEpoch, setRetryEpoch] = useState(0);

  const scope = isAuthenticated ? getAcademicYearCacheScope(user?.id, user?.role) : '';
  const revision = revisionsQuery.data?.academicYears ?? 0;
  const revisionsReady = revisionsQuery.data !== undefined;

  useEffect(() => {
    if (!scope) {
      if (previousScope.current) {
        queryClient.removeQueries({ queryKey: academicYearsKeys.lists() });
        previousScope.current = null;
      }
      AcademicYearsService.clearSharedAcademicYears();
      return;
    }

    if (previousScope.current && previousScope.current !== scope) {
      queryClient.removeQueries({ queryKey: academicYearsKeys.lists() });
      AcademicYearsService.clearSharedAcademicYears();
    }
    previousScope.current = scope;

    const persisted = readAcademicYearCache(scope);
    const queryKey = academicYearsKeys.list(scope);
    const inMemory = queryClient.getQueryData<AcademicYear[]>(queryKey);

    if (inMemory === undefined && persisted) {
      queryClient.setQueryData(queryKey, persisted.data);
    }

    const sharedYears = inMemory ?? persisted?.data;
    if (sharedYears) {
      AcademicYearsService.hydrateSharedAcademicYears(sharedYears);
    }

    const needsColdFetch = persisted === null && inMemory === undefined;
    const needsRevisionRefresh =
      revisionsReady && persisted?.revision !== revision;

    // Cold recovery is independent of revision readiness. Otherwise a delayed
    // settings snapshot can leave all year/term consumers loading forever.
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
      // Restore Firestore's local IndexedDB snapshot without a billed read.
      // Revision -1 deliberately keeps it eligible for authoritative
      // reconciliation once the settings signal is available.
      void AcademicYearsService.getAllFromFirestoreCache().then(cachedYears => {
        if (disposed || serverSucceeded || cachedYears.length === 0) return;
        const normalised = normaliseAcademicYears(cachedYears);
        AcademicYearsService.hydrateSharedAcademicYears(normalised);
        queryClient.setQueryData(queryKey, normalised);
        writeAcademicYearCache(scope, -1, normalised);
        performance.mark?.('trinity:academic-years-firestore-cache-ready');
      });
    }

    void AcademicYearsService.refreshSharedAcademicYears(
      () => AcademicYearsService.getAllForCache(),
    ).then(years => {
      if (disposed) return;
      serverSucceeded = true;
      retryCount.current = 0;
      const normalised = normaliseAcademicYears(years);
      AcademicYearsService.hydrateSharedAcademicYears(normalised);
      queryClient.setQueryData(queryKey, normalised);
      writeAcademicYearCache(scope, targetRevision, normalised);
      performance.mark?.('trinity:academic-years-server-synced');
    }).catch(error => {
      console.error('Academic-year cache reconciliation failed:', error);
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
