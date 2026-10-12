'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/contexts/auth-context';
import { catalogueKey, catalogueQueryOptions, catalogueStateKey, restoreCatalogue, type CatalogueName, type CatalogueState } from '@/lib/cache/school-catalogue-cache';
import { workspaceCacheAccessScope } from '@/lib/startup/workspace-cache-access';

/** One identity-scoped query owns restoration, refresh and every filtered view. */
export function useSchoolCatalogue<T>(name: CatalogueName, readServer: () => Promise<T[]>, enabled = true) {
  const client = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const scope = user && isAuthenticated ? workspaceCacheAccessScope(user) : '';
  const state = useQuery<CatalogueState>({ queryKey: catalogueStateKey(name, scope), enabled: false });
  useEffect(() => {
    if (!enabled || !scope || !user) return;
    const restore = () => { void restoreCatalogue<T>(client, name, user); };
    restore();
    window.addEventListener('trinity-workspace-cache-access', restore);
    return () => window.removeEventListener('trinity-workspace-cache-access', restore);
  }, [client, enabled, name, scope]);
  const query = useQuery<T[]>({
    ...(user ? catalogueQueryOptions(client, name, user, readServer) : {
      queryKey: catalogueKey(name, ''), queryFn: readServer,
    }),
    enabled: enabled && !!scope,
  });
  return {
    ...query,
    data: scope && state.data !== 'denied' ? query.data : undefined,
    isLoading: enabled && query.data === undefined && !query.error,
    isSavedData: state.data === 'saved',
  };
}
