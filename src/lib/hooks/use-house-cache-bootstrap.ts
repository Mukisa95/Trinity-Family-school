"use client";

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/contexts/auth-context';
import { HousesService } from '@/lib/services/houses.service';
import { useDashboardDataRevisions } from './use-school-settings';
import { houseKeys } from './use-houses';
import {
  getHouseCacheScope,
  normaliseHouses,
  readHouseCache,
  writeHouseCache,
} from '@/lib/cache/house-cache';
import type { House } from '@/types';

/** Sole browser network owner for the complete house collection. */
export function useHouseCacheBootstrap() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const revisionsQuery = useDashboardDataRevisions();
  const previousScope = useRef<string | null>(null);
  const retryTarget = useRef('');
  const retryCount = useRef(0);
  const [retryEpoch, setRetryEpoch] = useState(0);

  const scope = isAuthenticated ? getHouseCacheScope(user?.id, user?.role) : '';
  const revision = revisionsQuery.data?.houses ?? 0;
  const revisionsReady = revisionsQuery.data !== undefined;

  useEffect(() => {
    if (!scope) {
      if (previousScope.current) {
        queryClient.removeQueries({ queryKey: houseKeys.lists() });
        previousScope.current = null;
      }
      HousesService.clearSharedHouses();
      return;
    }

    if (previousScope.current && previousScope.current !== scope) {
      queryClient.removeQueries({ queryKey: houseKeys.lists() });
      HousesService.clearSharedHouses();
    }
    previousScope.current = scope;

    const persisted = readHouseCache(scope);
    const queryKey = houseKeys.list(scope);
    const inMemory = queryClient.getQueryData<House[]>(queryKey);
    if (inMemory === undefined && persisted) queryClient.setQueryData(queryKey, persisted.data);
    const sharedHouses = inMemory ?? persisted?.data;
    if (sharedHouses) HousesService.hydrateSharedHouses(sharedHouses);

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
      void HousesService.getAllFromFirestoreCache().then(cachedHouses => {
        if (disposed || serverSucceeded || cachedHouses.length === 0) return;
        const normalised = normaliseHouses(cachedHouses);
        HousesService.hydrateSharedHouses(normalised);
        queryClient.setQueryData(queryKey, normalised);
        writeHouseCache(scope, -1, normalised);
        performance.mark?.('trinity:houses-firestore-cache-ready');
      });
    }

    void HousesService.refreshSharedHouses(() => HousesService.getAllForCache())
      .then(houses => {
        if (disposed) return;
        serverSucceeded = true;
        retryCount.current = 0;
        const normalised = normaliseHouses(houses);
        HousesService.hydrateSharedHouses(normalised);
        queryClient.setQueryData(queryKey, normalised);
        writeHouseCache(scope, targetRevision, normalised);
        performance.mark?.('trinity:houses-server-synced');
      })
      .catch(error => {
        console.error('House cache reconciliation failed:', error);
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
