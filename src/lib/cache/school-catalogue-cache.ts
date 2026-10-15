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
export const catalogueRevisionKey = (name: CatalogueName, scope: string) => ['catalogueRevision', name, scope] as const;
const diskKey = (name: CatalogueName, scope: string) => persistentCollectionCacheKey(
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools', name, scope,
);
const restorations = new WeakMap<QueryClient, Map<string, Promise<void>>>();
const configured = new WeakMap<QueryClient, Set<string>>();

/** Data and its revision must survive the same idle period between page visits. */
function retainCatalogue(client: QueryClient, name: CatalogueName, scope: string) {
  let keys = configured.get(client);
  if (!keys) { keys = new Set(); configured.set(client, keys); }
  const identity = JSON.stringify(catalogueKey(name, scope));
  if (keys.has(identity)) return;
  keys.add(identity);
  for (const key of [catalogueKey(name, scope), catalogueStateKey(name, scope), catalogueRevisionKey(name, scope)]) {
    client.setQueryDefaults(key, { staleTime: Infinity, gcTime: Infinity });
  }
}

function savedContents(value: unknown): { data: unknown[]; revision?: number } | null {
  if (Array.isArray(value)) return { data: value }; // One-time upgrade of existing saved copies.
  if (!value || typeof value !== 'object') return null;
  const item = value as { schema?: number; data?: unknown; revision?: unknown };
  if (item.schema !== 2 || !Array.isArray(item.data)) return null;
  return { data: item.data, revision: typeof item.revision === 'number' && Number.isFinite(item.revision) && item.revision >= 0 ? item.revision : undefined };
}

export function publishedCatalogueRevision(client: QueryClient, name: CatalogueName): number | undefined {
  const revisions = client.getQueryData<Record<string, number>>(['dashboardDataRevisions']);
  if (revisions === undefined) return undefined;
  const value = revisions[name];
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

/** Only a complete, account/permission-bound copy may become a saved catalogue. */
export function isSavedCatalogueSnapshot(snapshot: { data: unknown; complete?: boolean; authorizationScope?: string } | null, scope: string) {
  return !!snapshot && snapshot.complete === true && snapshot.authorizationScope === scope && savedContents(snapshot.data) !== null;
}

export function restoreCatalogue<T>(client: QueryClient, name: CatalogueName, user: SystemUser): Promise<void> {
  const scope = workspaceCacheAccessScope(user), key = catalogueKey(name, scope);
  retainCatalogue(client, name, scope);
  if (client.getQueryData(key) !== undefined) return Promise.resolve();
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
    const saved = savedContents(snapshot!.data)!;
    client.setQueryData(key, saved.data);
    if (saved.revision !== undefined) client.setQueryData(catalogueRevisionKey(name, scope), saved.revision);
    client.setQueryData(catalogueStateKey(name, scope), 'saved' satisfies CatalogueState);
  }).finally(() => jobs!.delete(jobKey));
  jobs.set(jobKey, job);
  return job;
}

export function catalogueQueryOptions<T>(client: QueryClient, name: CatalogueName, user: SystemUser, readServer: () => Promise<T[]>) {
  const scope = workspaceCacheAccessScope(user);
  retainCatalogue(client, name, scope);
  return {
    queryKey: catalogueKey(name, scope),
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      try {
        let revision: number | undefined;
        const data = await withWorkspaceIdentity(user.id, () => {
          revision = publishedCatalogueRevision(client, name);
          return readServer();
        });
        // A late account's request cannot publish or persist into the next session.
        if (signal.aborted || auth.currentUser?.uid !== user.id || auth.currentUser?.isAnonymous) {
          throw Object.assign(new Error('The catalogue request belongs to an earlier session.'), { code: 'auth/workspace-identity' });
        }
        client.setQueryData(catalogueStateKey(name, scope), 'live' satisfies CatalogueState);
        if (revision !== undefined) client.setQueryData(catalogueRevisionKey(name, scope), revision);
        else client.removeQueries({ queryKey: catalogueRevisionKey(name, scope), exact: true });
        // Storage completion is independent of display; failure does not discard live data.
        void writePersistentCollection(diskKey(name, scope), { schema: 2, revision: revision ?? null, data }, scope, true).catch(() => undefined);
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
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: (query: { state: { status: string; error: unknown } }) => query.state.status === 'error'
      && !['permission-denied', 'unauthenticated', 'auth/workspace-identity'].includes(String((query.state.error as { code?: string } | null)?.code)),
    refetchOnWindowFocus: false,
    retry: (count: number, error: unknown) => count < 2
      && !['permission-denied', 'unauthenticated', 'auth/workspace-identity'].includes(String((error as { code?: string }).code)),
  };
}

/** Restore first. A normal mount/reconnect never invalidates healthy unchanged data. */
export async function ensureCatalogue<T>(client: QueryClient, name: CatalogueName, user: SystemUser, readServer: () => Promise<T[]>, active: () => boolean = () => true) {
  await restoreCatalogue<T>(client, name, user);
  if (!active()) throw Object.assign(new Error('The catalogue owner was disposed.'), { code: 'auth/workspace-identity' });
  const scope = workspaceCacheAccessScope(user), key = catalogueKey(name, scope);
  const query = client.getQueryState<T[]>(key);
  const revision = publishedCatalogueRevision(client, name);
  const savedRevision = client.getQueryData<number>(catalogueRevisionKey(name, scope));
  const changed = revision !== undefined && (savedRevision === undefined || savedRevision < revision);
  if (query?.data !== undefined && !changed && !query.isInvalidated && query.status !== 'error') return query.data;
  return client.fetchQuery({ ...catalogueQueryOptions<T>(client, name, user, readServer), staleTime: 0 });
}

type CatalogueOwner = { references: number; dispose: () => void };
const owners = new WeakMap<QueryClient, Map<string, CatalogueOwner>>();

/** One revision observer/reconciler per client, catalogue and permission scope. */
export function subscribeCatalogueOwner<T>(client: QueryClient, name: CatalogueName, user: SystemUser, readServer: () => Promise<T[]>) {
  let registry = owners.get(client);
  if (!registry) { registry = new Map(); owners.set(client, registry); }
  const scope = workspaceCacheAccessScope(user), key = catalogueKey(name, scope), identity = JSON.stringify(key);
  const existing = registry.get(identity);
  if (existing) { existing.references++; return () => release(existing); }
  let disposed = false, timer: ReturnType<typeof setTimeout> | undefined;
  let previousPublished = publishedCatalogueRevision(client, name);
  const reconcile = () => {
    if (disposed || client.getQueryData(catalogueStateKey(name, scope)) === 'denied') return;
    void ensureCatalogue<T>(client, name, user, readServer, () => !disposed).catch(() => undefined);
  };
  const schedule = () => { clearTimeout(timer); timer = setTimeout(reconcile, 0); };
  const unsubscribe = client.getQueryCache().subscribe(event => {
    if (event.type !== 'updated') return;
    if (event.query.queryKey[0] === 'dashboardDataRevisions' && event.action.type === 'success') {
      const next = publishedCatalogueRevision(client, name);
      if (next !== previousPublished) { previousPublished = next; schedule(); }
    }
    // A revision may arrive during a fetch. Recheck after completion without
    // cancelling that shared request or mislabelling it with the later revision.
    if (JSON.stringify(event.query.queryKey) === identity && event.action.type === 'success') schedule();
  });
  if (typeof window !== 'undefined') window.addEventListener('online', schedule);
  const owner: CatalogueOwner = { references: 1, dispose: () => {
    disposed = true; clearTimeout(timer); unsubscribe();
    if (typeof window !== 'undefined') window.removeEventListener('online', schedule);
    void client.cancelQueries({ queryKey: key, exact: true });
  } };
  registry.set(identity, owner); schedule();
  function release(item: CatalogueOwner) {
    if (--item.references === 0) { item.dispose(); registry!.delete(identity); }
  }
  return () => release(owner);
}
