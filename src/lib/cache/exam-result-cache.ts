import type { ExamResult } from '@/types';
import { firebaseProjectId } from '@/lib/firebase';
import {
  deletePersistentCollection,
  deletePersistentCollections,
  persistentCollectionCacheKey,
  readPersistentCollection,
  writePersistentCollection,
} from './persistent-collection-cache';
import { getExamCacheScope } from './exam-cache';

const SCHEMA = 2;
const COLLECTION = 'exam-result-v2';
const MANIFEST_COLLECTION = 'exam-result-manifest-v2';

export type CachedExamResult = {
  schema: number;
  academicYearId: string;
  termId: string;
  observedTermRevision: number;
  writtenAt: number;
  data: ExamResult | null;
};

export type ExamResultManifestEntry = {
  examId: string;
  academicYearId: string;
  termId: string;
  lastAccessedAt: number;
};

type ExamResultManifest = {
  schema: number;
  entries: ExamResultManifestEntry[];
};

/** Parent result pages must use their existing pupil-safe projection path. */
export function getExamResultCacheScope(userId?: string, role?: string): string {
  return getExamCacheScope(userId, role);
}

export function examResultCacheKey(scope: string, examId: string): string {
  return persistentCollectionCacheKey(firebaseProjectId, COLLECTION, `${scope}:${encodeURIComponent(examId)}`);
}

function manifestKey(scope: string): string {
  return persistentCollectionCacheKey(firebaseProjectId, MANIFEST_COLLECTION, scope);
}

function normalizeResult(result: ExamResult): ExamResult {
  const toIso = (value: unknown) => {
    if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
      return value.toDate().toISOString();
    }
    return value instanceof Date ? value.toISOString() : value;
  };

  return {
    ...result,
    recordedAt: (toIso(result.recordedAt) || '') as string,
    lastUpdatedAt: toIso(result.lastUpdatedAt) as string | undefined,
    releasedAt: toIso(result.releasedAt) as string | undefined,
  };
}

export async function readExamResultCache(scope: string, examId: string): Promise<CachedExamResult | null> {
  if (!scope || !examId) return null;
  const cached = await readPersistentCollection<CachedExamResult>(examResultCacheKey(scope, examId));
  if (!cached
    || cached.schema !== SCHEMA
    || !cached.academicYearId
    || !cached.termId
    || typeof cached.observedTermRevision !== 'number'
    || !Object.prototype.hasOwnProperty.call(cached, 'data')) return null;

  return {
    ...cached,
    data: cached.data ? normalizeResult(cached.data) : null,
  };
}

export async function writeExamResultCache(
  scope: string,
  examId: string,
  academicYearId: string,
  termId: string,
  observedTermRevision: number,
  data: ExamResult | null,
): Promise<void> {
  if (!scope || !examId || !academicYearId || !termId) return;
  const snapshot: CachedExamResult = {
    schema: SCHEMA,
    academicYearId,
    termId,
    observedTermRevision,
    writtenAt: Date.now(),
    data: data ? normalizeResult(data) : null,
  };
  await writePersistentCollection(examResultCacheKey(scope, examId), snapshot);

  const previous = await readPersistentCollection<ExamResultManifest>(manifestKey(scope));
  const entries = (previous?.schema === SCHEMA && Array.isArray(previous.entries) ? previous.entries : [])
    .filter(entry => entry?.examId !== examId)
    .concat({ examId, academicYearId, termId, lastAccessedAt: Date.now() });
  await writePersistentCollection(manifestKey(scope), { schema: SCHEMA, entries });
}

/** Remove result entries outside the caller's three-term retention window. */
export async function pruneExamResultCache(scope: string, keepTermKeys: Set<string>): Promise<void> {
  if (!scope) return;
  const manifest = await readPersistentCollection<ExamResultManifest>(manifestKey(scope));
  if (!manifest || manifest.schema !== SCHEMA || !Array.isArray(manifest.entries)) return;

  const keepEntries = manifest.entries.filter(entry =>
    keepTermKeys.has(`${entry.academicYearId}:${entry.termId}`),
  );
  const staleKeys = manifest.entries
    .filter(entry => !keepTermKeys.has(`${entry.academicYearId}:${entry.termId}`))
    .map(entry => examResultCacheKey(scope, entry.examId));
  await deletePersistentCollections(staleKeys);
  await writePersistentCollection(manifestKey(scope), { schema: SCHEMA, entries: keepEntries });
}

export async function deleteExamResultCache(scope: string, examId: string): Promise<void> {
  if (!scope || !examId) return;
  await deletePersistentCollection(examResultCacheKey(scope, examId));
}
