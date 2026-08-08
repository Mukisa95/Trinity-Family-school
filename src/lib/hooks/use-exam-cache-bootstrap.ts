"use client";

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/contexts/auth-context';
import { ExamsService } from '@/lib/services/exams.service';
import { useDashboardDataRevisions } from './use-school-settings';
import { examKeys } from './use-exams';
import {
  getExamCacheScope,
  normaliseExams,
  readExamCache,
  writeExamCache,
} from '@/lib/cache/exam-cache';
import type { Exam } from '@/types';

/**
 * The sole browser network owner for school-wide exam definitions. A valid
 * scoped snapshot paints synchronously; Firestore is consulted only for a cold
 * cache or when the existing school-settings listener reports an exam change.
 */
export function useExamCacheBootstrap() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const revisionsQuery = useDashboardDataRevisions();
  const previousScope = useRef<string | null>(null);
  const retryTarget = useRef('');
  const retryCount = useRef(0);
  const [retryEpoch, setRetryEpoch] = useState(0);

  const scope = isAuthenticated ? getExamCacheScope(user?.id, user?.role) : '';
  const revision = revisionsQuery.data?.exams ?? 0;
  const revisionsReady = revisionsQuery.data !== undefined;

  useEffect(() => {
    if (!scope) {
      if (previousScope.current) {
        queryClient.removeQueries({ queryKey: examKeys.lists() });
        previousScope.current = null;
      }
      ExamsService.clearSharedExams();
      return;
    }

    if (previousScope.current && previousScope.current !== scope) {
      queryClient.removeQueries({ queryKey: examKeys.lists() });
      ExamsService.clearSharedExams();
    }
    previousScope.current = scope;

    const persisted = readExamCache(scope);
    const queryKey = examKeys.list(scope);
    const inMemory = queryClient.getQueryData<Exam[]>(queryKey);

    if (inMemory === undefined && persisted) {
      queryClient.setQueryData(queryKey, persisted.data);
    }

    const sharedExams = inMemory ?? persisted?.data;
    if (sharedExams) {
      ExamsService.hydrateSharedExams(sharedExams);
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
      void ExamsService.getAllFromFirestoreCache().then(cachedExams => {
        if (disposed || serverSucceeded || cachedExams.length === 0) return;
        const normalised = normaliseExams(cachedExams);
        ExamsService.hydrateSharedExams(normalised);
        queryClient.setQueryData(queryKey, normalised);
        writeExamCache(scope, -1, normalised);
        performance.mark?.('trinity:exams-firestore-cache-ready');
      });
    }

    void ExamsService.refreshSharedExams(() => ExamsService.getAllForCache()).then(exams => {
      if (disposed) return;
      serverSucceeded = true;
      retryCount.current = 0;
      const normalised = normaliseExams(exams);
      ExamsService.hydrateSharedExams(normalised);
      queryClient.setQueryData(queryKey, normalised);
      writeExamCache(scope, targetRevision, normalised);
      performance.mark?.('trinity:exams-server-synced');
    }).catch(error => {
      console.error('Exam cache reconciliation failed:', error);
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
