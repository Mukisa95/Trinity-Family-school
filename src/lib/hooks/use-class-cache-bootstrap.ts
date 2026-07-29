"use client";

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/contexts/auth-context';
import { ClassesService } from '@/lib/services/classes.service';
import { useDashboardDataRevisions } from './use-school-settings';
import { classesKeys } from './use-classes';
import {
  getClassCacheScope,
  normaliseClasses,
  readClassCache,
  writeClassCache,
} from '@/lib/cache/class-cache';
import type { Class } from '@/types';

/**
 * The sole network owner for ordinary class data. It restores the persisted
 * list immediately, then reads Firestore only when the existing settings
 * listener reports that the class revision has changed.
 */
export function useClassCacheBootstrap() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const revisionsQuery = useDashboardDataRevisions();
  const previousScope = useRef<string | null>(null);
  const retryTarget = useRef('');
  const retryCount = useRef(0);
  const [retryEpoch, setRetryEpoch] = useState(0);

  const scope = isAuthenticated ? getClassCacheScope(user?.id, user?.role) : '';
  const revision = revisionsQuery.data?.classes ?? 0;
  const revisionsReady = revisionsQuery.data !== undefined;

  useEffect(() => {
    if (!scope) {
      if (previousScope.current) {
        queryClient.removeQueries({ queryKey: classesKeys.lists() });
        previousScope.current = null;
      }
      ClassesService.clearSharedClasses();
      return;
    }

    if (previousScope.current && previousScope.current !== scope) {
      queryClient.removeQueries({ queryKey: classesKeys.lists() });
      ClassesService.clearSharedClasses();
    }
    previousScope.current = scope;

    const persisted = readClassCache(scope);
    const queryKey = classesKeys.list(scope);
    const inMemory = queryClient.getQueryData<Class[]>(queryKey);

    // A warm cache paints before the settings revision arrives. If it is older
    // than the server revision, it remains visible only until the one necessary
    // reconciliation below completes.
    if (inMemory === undefined && persisted) {
      queryClient.setQueryData(queryKey, persisted.data);
    }

    const sharedClasses = inMemory ?? persisted?.data;
    if (sharedClasses) {
      ClassesService.hydrateSharedClasses(sharedClasses);
    }

    if (!revisionsReady || persisted?.revision === revision) return;

    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const target = `${scope}:${revision}`;
    if (retryTarget.current !== target) {
      retryTarget.current = target;
      retryCount.current = 0;
    }
    void ClassesService.refreshSharedClasses(() => ClassesService.getAllForCache()).then(classes => {
      if (disposed) return;
      retryCount.current = 0;
      const normalised = normaliseClasses(classes);
      ClassesService.hydrateSharedClasses(normalised);
      queryClient.setQueryData(queryKey, normalised);
      writeClassCache(scope, revision, normalised);
      performance.mark?.('trinity:classes-server-synced');
    }).catch(error => {
      console.error('Class cache reconciliation failed:', error);
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
