"use client";

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { registerWorkspaceRecovery, reportWorkspaceTask } from '@/lib/startup/workspace-setup';
import { withWorkspaceIdentity } from '@/lib/startup/workspace-auth';
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

const CLASS_FOCUS_REFRESH_COOLDOWN_MS = 60_000;
const CLASS_VISIBLE_REFRESH_INTERVAL_MS = 5 * 60_000;

/**
 * The sole network owner for ordinary class data. It restores the persisted
 * list immediately, then reconciles revisions and checks once per session.
 * Database-console edits do not publish revisions, so returning to the app,
 * reconnecting, and a bounded visible-tab check also reconcile the snapshot.
 */
export function useClassCacheBootstrap() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const revisionsQuery = useDashboardDataRevisions();
  const previousScope = useRef<string | null>(null);
  const retryTarget = useRef('');
  const retryCount = useRef(0);
  const freshness = useRef({ scope: '', confirmed: false, lastAttemptAt: 0 });
  const [retryEpoch, setRetryEpoch] = useState(0);

  const scope = isAuthenticated ? getClassCacheScope(user?.id, user?.role) : '';
  const revision = revisionsQuery.data?.classes ?? 0;
  const revisionsReady = revisionsQuery.data !== undefined;

  useEffect(() => {
    if (!scope) return;
    return registerWorkspaceRecovery(queryClient, scope, 'classes', () => {
      freshness.current.confirmed = false;
      retryCount.current = 0;
      setRetryEpoch(epoch => epoch + 1);
    });
  }, [queryClient, scope]);

  useEffect(() => {
    if (!scope) return;
    const refresh = (reconnected = false) => {
      if (document.visibilityState === 'hidden' || navigator.onLine === false) return;
      const current = freshness.current;
      if (current.scope !== scope) return;
      // Focus and visibility often fire together. Reconnect may bypass the
      // focus cooldown, but still coalesces with a read already just started.
      const cooldown = reconnected ? 1_000 : CLASS_FOCUS_REFRESH_COOLDOWN_MS;
      if (Date.now() - current.lastAttemptAt < cooldown) return;
      current.lastAttemptAt = Date.now();
      current.confirmed = false;
      retryCount.current = 0;
      setRetryEpoch(epoch => epoch + 1);
    };
    const onReturn = () => refresh();
    const onReconnect = () => refresh(true);
    window.addEventListener('focus', onReturn);
    window.addEventListener('online', onReconnect);
    document.addEventListener('visibilitychange', onReturn);
    const timer = setInterval(onReturn, CLASS_VISIBLE_REFRESH_INTERVAL_MS);
    return () => {
      window.removeEventListener('focus', onReturn);
      window.removeEventListener('online', onReconnect);
      document.removeEventListener('visibilitychange', onReturn);
      clearInterval(timer);
    };
  }, [scope]);

  useEffect(() => {
    if (!scope) {
      freshness.current = { scope: '', confirmed: false, lastAttemptAt: 0 };
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
    if (freshness.current.scope !== scope) {
      freshness.current = { scope, confirmed: false, lastAttemptAt: 0 };
    }

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

    const needsColdFetch = persisted === null && inMemory === undefined;
    const needsRevisionRefresh =
      revisionsReady && persisted?.revision !== revision;
    const needsSessionRefresh = !freshness.current.confirmed;

    // A cold device must never wait indefinitely for the settings listener.
    // Revision readiness only controls reconciliation of an existing snapshot.
    if (!needsColdFetch && !needsRevisionRefresh && !needsSessionRefresh) {
      reportWorkspaceTask(queryClient, scope, 'classes', 'ready');
      return;
    }
    reportWorkspaceTask(queryClient, scope, 'classes', 'loading');
    freshness.current.lastAttemptAt = Date.now();

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
      // Firestore's IndexedDB cache is free and may still contain the last
      // confirmed class list after a lite-cache schema migration. Paint it
      // immediately, but mark it unconfirmed so only the server response may
      // claim the current revision.
      void ClassesService.getAllFromFirestoreCache().then(cachedClasses => {
        if (disposed || serverSucceeded || cachedClasses.length === 0) return;
        const normalised = normaliseClasses(cachedClasses);
        ClassesService.hydrateSharedClasses(normalised);
        queryClient.setQueryData(queryKey, normalised);
        writeClassCache(scope, -1, normalised);
        performance.mark?.('trinity:classes-firestore-cache-ready');
      });
    }

    void withWorkspaceIdentity(user?.id, () => ClassesService.refreshSharedClasses(() => ClassesService.getAllForCache())).then(classes => {
      if (disposed) return;
      serverSucceeded = true;
      freshness.current.confirmed = true;
      retryCount.current = 0;
      const normalised = normaliseClasses(classes);
      ClassesService.hydrateSharedClasses(normalised);
      queryClient.setQueryData(queryKey, normalised);
      writeClassCache(scope, targetRevision, normalised);
      performance.mark?.('trinity:classes-server-synced');
      reportWorkspaceTask(queryClient, scope, 'classes', 'ready');
    }).catch(error => {
      console.error('Class cache reconciliation failed:', error);
      if (!disposed) reportWorkspaceTask(queryClient, scope, 'classes', 'error');
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
