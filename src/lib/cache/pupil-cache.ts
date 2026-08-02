import type { Pupil } from '@/types';
import {
  persistentCollectionCacheKey,
  readPersistentCollection,
  writePersistentCollection,
} from './persistent-collection-cache';

const PUPIL_CACHE_SCHEMA = 1;

export type PupilCacheSnapshot = {
  schema: number;
  revision: number;
  data: Pupil[];
};

export function getPupilCacheScope(userId?: string, role?: string): string {
  if (!userId || !role || role === 'Parent') return '';
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools';
  return [projectId, userId, role].map(encodeURIComponent).join(':');
}

function getPupilCacheKey(scope: string): string {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools';
  return persistentCollectionCacheKey(projectId, 'pupils-v2', scope);
}

function toIso(value: unknown): unknown {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return value;
}

export function normalisePupils(pupils: Pupil[]): Pupil[] {
  return [...pupils]
    .map(pupil => ({
      ...pupil,
      dateOfBirth: toIso(pupil.dateOfBirth) as Pupil['dateOfBirth'],
      registrationDate: toIso(pupil.registrationDate) as Pupil['registrationDate'],
      createdAt: toIso(pupil.createdAt) as Pupil['createdAt'],
    }))
    .sort((a, b) => {
      const lastName = (a.lastName || '').localeCompare(b.lastName || '');
      return lastName || (a.firstName || '').localeCompare(b.firstName || '');
    });
}

export async function readPupilCache(scope: string): Promise<PupilCacheSnapshot | null> {
  if (!scope) return null;
  const snapshot = await readPersistentCollection<PupilCacheSnapshot>(getPupilCacheKey(scope));
  if (!snapshot || snapshot.schema !== PUPIL_CACHE_SCHEMA || !Array.isArray(snapshot.data)) return null;

  return {
    ...snapshot,
    data: normalisePupils(snapshot.data),
  };
}

export async function writePupilCache(
  scope: string,
  revision: number,
  pupils: Pupil[],
): Promise<void> {
  if (!scope) return;
  await writePersistentCollection(
    getPupilCacheKey(scope),
    {
      schema: PUPIL_CACHE_SCHEMA,
      revision,
      data: normalisePupils(pupils),
    } satisfies PupilCacheSnapshot,
  );
}
