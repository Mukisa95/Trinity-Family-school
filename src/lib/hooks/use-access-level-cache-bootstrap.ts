"use client";

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/contexts/auth-context';
import { AccessLevelsService } from '@/lib/services/access-levels.service';
import { useDashboardDataRevisions } from './use-school-settings';
import { accessLevelKeys } from './use-access-levels';
import {
  getAccessLevelCacheScope,
  normaliseAccessLevels,
  readAccessLevelCache,
  writeAccessLevelCache,
} from '@/lib/cache/access-level-cache';
import type { AccessLevel } from '@/types/access-levels';

/** Sole browser network owner for the access-level collection. */
export function useAccessLevelCacheBootstrap() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const revisionsQuery = useDashboardDataRevisions();
  const previousScope = useRef<string | null>(null);
  const retryTarget = useRef('');
  const retryCount = useRef(0);
  const [retryEpoch, setRetryEpoch] = useState(0);

  const scope = isAuthenticated ? getAccessLevelCacheScope(user?.id, user?.role) : '';
  const revision = revisionsQuery.data?.accessLevels ?? 0;
  const revisionsReady = revisionsQuery.data !== undefined;

  useEffect(() => {
    if (!scope) {
      if (previousScope.current) {
        queryClient.removeQueries({ queryKey: accessLevelKeys.lists() });
        previousScope.current = null;
      }
      AccessLevelsService.clearSharedAccessLevels();
      return;
    }

    if (previousScope.current && previousScope.current !== scope) {
      queryClient.removeQueries({ queryKey: accessLevelKeys.lists() });
      AccessLevelsService.clearSharedAccessLevels();
    }
    previousScope.current = scope;

    const persisted = readAccessLevelCache(scope);
    const queryKey = accessLevelKeys.list(scope);
    const inMemory = queryClient.getQueryData<AccessLevel[]>(queryKey);
    if (inMemory === undefined && persisted) queryClient.setQueryData(queryKey, persisted.data);
    const sharedLevels = inMemory ?? persisted?.data;
    if (sharedLevels) AccessLevelsService.hydrateSharedAccessLevels(sharedLevels);

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
      void AccessLevelsService.getAllFromFirestoreCache().then(cachedLevels => {
        if (disposed || serverSucceeded || cachedLevels.length === 0) return;
        const normalised = normaliseAccessLevels(cachedLevels);
        AccessLevelsService.hydrateSharedAccessLevels(normalised);
        queryClient.setQueryData(queryKey, normalised);
        writeAccessLevelCache(scope, -1, normalised);
        performance.mark?.('trinity:access-levels-firestore-cache-ready');
      });
    }

    void AccessLevelsService.refreshSharedAccessLevels(() => AccessLevelsService.getAllForCache())
      .then(levels => {
        if (disposed) return;
        serverSucceeded = true;
        retryCount.current = 0;
        const normalised = normaliseAccessLevels(levels);
        AccessLevelsService.hydrateSharedAccessLevels(normalised);
        queryClient.setQueryData(queryKey, normalised);
        writeAccessLevelCache(scope, targetRevision, normalised);
        performance.mark?.('trinity:access-levels-server-synced');
      })
      .catch(error => {
        console.error('Access-level cache reconciliation failed:', error);
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
