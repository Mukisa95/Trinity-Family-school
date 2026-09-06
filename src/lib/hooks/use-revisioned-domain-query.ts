'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, type QueryKey } from '@tanstack/react-query';

import { useAuth } from '@/lib/contexts/auth-context';
import { domainRevisionToken, type DomainRevisionKey } from '@/lib/cache/domain-revisions';
import {
  getDomainCacheScope,
  readRevisionedDomainCache,
  type RevisionedDomainSnapshot,
  writeRevisionedDomainCache,
} from '@/lib/cache/revisioned-domain-cache';
import { useDashboardDataRevisions } from '@/lib/hooks/use-school-settings';

type RestoreState<T> = {
  identity: string;
  loaded: boolean;
  snapshot: RevisionedDomainSnapshot<T> | null;
};

/**
 * Restores a user-scoped IndexedDB snapshot and watches only the tiny revision
 * document. The collection query runs on a cold cache or a revision mismatch,
 * never merely because a page was revisited, focused, or reconnected.
 */
export function useRevisionedDomainQuery<T>({
  queryKey,
  cacheName,
  revisionKeys,
  queryFn,
  enabled = true,
}: {
  queryKey: QueryKey;
  cacheName: string;
  revisionKeys: readonly DomainRevisionKey[];
  queryFn: () => Promise<T>;
  enabled?: boolean;
}) {
  const { user, isAuthenticated } = useAuth();
  const revisionsQuery = useDashboardDataRevisions();
  const scope = isAuthenticated ? getDomainCacheScope(user?.id, user?.role) : '';
  const revisionsReady = revisionsQuery.data !== undefined;
  const revision = domainRevisionToken(revisionsQuery.data, revisionKeys);
  const identity = `${cacheName}:${scope}:${revision}`;
  const [restore, setRestore] = useState<RestoreState<T>>({ identity: '', loaded: false, snapshot: null });

  useEffect(() => {
    let disposed = false;
    if (!scope || !enabled) {
      setRestore({ identity, loaded: true, snapshot: null });
      return () => { disposed = true; };
    }

    setRestore(previous => previous.identity === identity
      ? previous
      : { identity, loaded: false, snapshot: null });
    void readRevisionedDomainCache<T>(cacheName, scope).then(snapshot => {
      if (!disposed) setRestore({ identity, loaded: true, snapshot });
    });
    return () => { disposed = true; };
  }, [cacheName, enabled, identity, scope]);

  const currentRestore = restore.identity === identity
    ? restore
    : { identity, loaded: false, snapshot: null };
  const mustReconcile = currentRestore.loaded
    && currentRestore.snapshot?.revision !== revision;
  const resolvedQueryKey = useMemo(
    () => [...queryKey, 'revision', revision, 'scope', scope] as QueryKey,
    [queryKey, revision, scope],
  );

  const query = useQuery<T>({
    queryKey: resolvedQueryKey,
    queryFn: async () => {
      const data = await queryFn();
      await writeRevisionedDomainCache(cacheName, scope, revision, data);
      return data;
    },
    enabled: enabled && Boolean(scope) && revisionsReady && mustReconcile,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });

  return {
    ...query,
    data: query.data ?? currentRestore.snapshot?.data,
    isLoading: enabled && (!currentRestore.loaded || (!currentRestore.snapshot && query.isLoading)),
  };
}
