import type { QueryClient } from '@tanstack/react-query';
import type { SystemUser } from '@/types';
import { auth } from '@/lib/firebase';
import { withWorkspaceIdentity } from '@/lib/startup/workspace-auth';
import { hasSavedWorkspaceAccess, workspaceCacheAccessScope } from '@/lib/startup/workspace-cache-access';
import { persistentCollectionCacheKey, readPersistentCollectionWithMetadata, writePersistentCollection } from './persistent-collection-cache';

export type CatalogueName = 'requirements' | 'uniforms' | 'excludedDays';
export type CatalogueState = 'saved' | 'live' | 'denied';
export const catalogueKey = (name: CatalogueName, scope: string) => [name, 'saved-catalogue-v1', scope] as const;
export const catalogueStateKey = (name: CatalogueName, scope: string) => ['catalogueStatus', name, scope] as const;
const diskKey = (name: CatalogueName, scope: string) => persistentCollectionCacheKey(
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools', name, scope,
);
const restorations = new WeakMap<QueryClient, Map<string, Promise<void>>>();

/** Only a complete, account/permission-bound copy may become a saved catalogue. */
export function isSavedCatalogueSnapshot(snapshot: { data: unknown; complete?: boolean; authorizationScope?: string } | null, scope: string) {
  return !!snapshot && snapshot.complete === true && snapshot.authorizationScope === scope && Array.isArray(snapshot.data);
}

export function restoreCatalogue<T>(client: QueryClient, name: CatalogueName, user: SystemUser): Promise<void> {
  const scope = workspaceCacheAccessScope(user), key = catalogueKey(name, scope);
  let jobs = restorations.get(client);
  if (!jobs) { jobs = new Map(); restorations.set(client, jobs); }
  const jobKey = JSON.stringify(key);
  const existing = jobs.get(jobKey);
  if (existing) return existing;
  const job = readPersistentCollectionWithMetadata<T[]>(diskKey(name, scope)).then(snapshot => {
    const signed = auth.currentUser;
    if (!hasSavedWorkspaceAccess(user) || (signed && (signed.uid !== user.id || signed.isAnonymous))
      || !isSavedCatalogueSnapshot(snapshot, scope) || client.getQueryData(key) !== undefined
      || client.getQueryData(catalogueStateKey(name, scope)) === 'denied') return;
    client.setQueryData(key, snapshot!.data, { updatedAt: 0 });
    client.setQueryData(catalogueStateKey(name, scope), 'saved' satisfies CatalogueState);
  }).finally(() => jobs!.delete(jobKey));
  jobs.set(jobKey, job);
  return job;
}

export function catalogueQueryOptions<T>(client: QueryClient, name: CatalogueName, user: SystemUser, readServer: () => Promise<T[]>) {
  const scope = workspaceCacheAccessScope(user);
  return {
    queryKey: catalogueKey(name, scope),
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      try {
        const data = await withWorkspaceIdentity(user.id, readServer);
        // A late account's request cannot publish or persist into the next session.
        if (signal.aborted || auth.currentUser?.uid !== user.id || auth.currentUser?.isAnonymous) {
          throw Object.assign(new Error('The catalogue request belongs to an earlier session.'), { code: 'auth/workspace-identity' });
        }
        client.setQueryData(catalogueStateKey(name, scope), 'live' satisfies CatalogueState);
        // Storage completion is independent of display; failure does not discard live data.
        void writePersistentCollection(diskKey(name, scope), data, scope, true).catch(() => undefined);
        return data;
      } catch (error) {
        if (['permission-denied', 'unauthenticated'].includes(String((error as { code?: string }).code))) {
          client.setQueryData(catalogueStateKey(name, scope), 'denied' satisfies CatalogueState);
          client.setQueryData(catalogueKey(name, scope), []);
          // Remove this module's reusable saved copy without treating a module
          // permission rejection as a logout from otherwise allowed pages.
          void writePersistentCollection(diskKey(name, scope), [], scope, false).catch(() => undefined);
        } else if (client.getQueryData(catalogueKey(name, scope)) !== undefined) {
          client.setQueryData(catalogueStateKey(name, scope), 'saved' satisfies CatalogueState);
        }
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: 'always' as const,
    refetchOnReconnect: 'always' as const,
    refetchOnWindowFocus: false,
    retry: (count: number, error: unknown) => count < 2
      && !['permission-denied', 'unauthenticated', 'auth/workspace-identity'].includes(String((error as { code?: string }).code)),
  };
}
