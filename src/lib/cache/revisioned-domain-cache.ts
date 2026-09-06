import { firebaseProjectId } from '@/lib/firebase';
import {
  persistentCollectionCacheKey,
  readPersistentCollection,
  writePersistentCollection,
} from '@/lib/cache/persistent-collection-cache';

const SCHEMA_VERSION = 1;

export type RevisionedDomainSnapshot<T> = {
  schema: number;
  revision: string;
  data: T;
};

export function getDomainCacheScope(userId?: string, role?: string): string {
  if (!userId || !role) return '';
  return [userId, role].map(encodeURIComponent).join(':');
}

export function getRevisionedDomainCacheKey(cacheName: string, scope: string): string {
  return persistentCollectionCacheKey(firebaseProjectId, cacheName, scope);
}

export async function readRevisionedDomainCache<T>(
  cacheName: string,
  scope: string,
): Promise<RevisionedDomainSnapshot<T> | null> {
  if (!scope) return null;
  const snapshot = await readPersistentCollection<RevisionedDomainSnapshot<T>>(
    getRevisionedDomainCacheKey(cacheName, scope),
  );
  if (!snapshot || snapshot.schema !== SCHEMA_VERSION || !('data' in snapshot)) return null;
  return snapshot;
}

export function writeRevisionedDomainCache<T>(
  cacheName: string,
  scope: string,
  revision: string,
  data: T,
): Promise<void> {
  if (!scope) return Promise.resolve();
  return writePersistentCollection(
    getRevisionedDomainCacheKey(cacheName, scope),
    { schema: SCHEMA_VERSION, revision, data } satisfies RevisionedDomainSnapshot<T>,
  );
}
