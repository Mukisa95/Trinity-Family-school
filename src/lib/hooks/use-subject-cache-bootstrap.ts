"use client";

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/contexts/auth-context';
import { SubjectsService } from '@/lib/services/subjects.service';
import { useDashboardDataRevisions } from './use-school-settings';
import { subjectsKeys } from './use-subjects';
import {
  getSubjectCacheScope,
  normaliseSubjects,
  readSubjectCache,
  writeSubjectCache,
} from '@/lib/cache/subject-cache';
import type { Subject } from '@/types';

/** Sole browser network owner for the complete subject collection. */
export function useSubjectCacheBootstrap() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const revisionsQuery = useDashboardDataRevisions();
  const previousScope = useRef<string | null>(null);
  const retryTarget = useRef('');
  const retryCount = useRef(0);
  const [retryEpoch, setRetryEpoch] = useState(0);

  const scope = isAuthenticated ? getSubjectCacheScope(user?.id, user?.role) : '';
  const revision = revisionsQuery.data?.subjects ?? 0;
  const revisionsReady = revisionsQuery.data !== undefined;

  useEffect(() => {
    if (!scope) {
      if (previousScope.current) {
        queryClient.removeQueries({ queryKey: subjectsKeys.lists() });
        previousScope.current = null;
      }
      SubjectsService.clearSharedSubjects();
      return;
    }

    if (previousScope.current && previousScope.current !== scope) {
      queryClient.removeQueries({ queryKey: subjectsKeys.lists() });
      SubjectsService.clearSharedSubjects();
    }
    previousScope.current = scope;

    const persisted = readSubjectCache(scope);
    const queryKey = subjectsKeys.list(scope);
    const inMemory = queryClient.getQueryData<Subject[]>(queryKey);

    if (inMemory === undefined && persisted) queryClient.setQueryData(queryKey, persisted.data);
    const sharedSubjects = inMemory ?? persisted?.data;
    if (sharedSubjects) SubjectsService.hydrateSharedSubjects(sharedSubjects);

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
      void SubjectsService.getAllFromFirestoreCache().then(cachedSubjects => {
        if (disposed || serverSucceeded || cachedSubjects.length === 0) return;
        const normalised = normaliseSubjects(cachedSubjects);
        SubjectsService.hydrateSharedSubjects(normalised);
        queryClient.setQueryData(queryKey, normalised);
        writeSubjectCache(scope, -1, normalised);
        performance.mark?.('trinity:subjects-firestore-cache-ready');
      });
    }

    void SubjectsService.refreshSharedSubjects(() => SubjectsService.getAllForCache())
      .then(subjects => {
        if (disposed) return;
        serverSucceeded = true;
        retryCount.current = 0;
        const normalised = normaliseSubjects(subjects);
        SubjectsService.hydrateSharedSubjects(normalised);
        queryClient.setQueryData(queryKey, normalised);
        writeSubjectCache(scope, targetRevision, normalised);
        performance.mark?.('trinity:subjects-server-synced');
      })
      .catch(error => {
        console.error('Subject cache reconciliation failed:', error);
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
