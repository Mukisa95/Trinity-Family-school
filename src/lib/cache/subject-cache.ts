import type { Subject } from '@/types';
import { liteRead, liteWrite } from './lite-cache';

const SUBJECT_CACHE_TTL = Number.MAX_SAFE_INTEGER;
const SUBJECT_CACHE_SCHEMA = 1;

export type SubjectCacheSnapshot = {
  schema: number;
  revision: number;
  data: Subject[];
};

export function getSubjectCacheScope(userId?: string, role?: string): string {
  if (!userId || !role) return '';
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools';
  return [projectId, userId, role].map(encodeURIComponent).join(':');
}

export function getSubjectCacheKey(scope: string): string {
  return `subjects:${scope}`;
}

function toIso(value: unknown): string {
  if (!value) return '';
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (value && typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000).toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

/** Produces one JSON-safe, predictable subject list for every consumer. */
export function normaliseSubjects(subjects: Subject[]): Subject[] {
  return [...subjects]
    .map(subject => ({
      ...subject,
      createdAt: toIso(subject.createdAt) || subject.createdAt || '',
    }))
    .sort((left, right) =>
      left.name.localeCompare(right.name) || left.code.localeCompare(right.code),
    );
}

export function readSubjectCache(scope: string): SubjectCacheSnapshot | null {
  if (!scope) return null;
  const snapshot = liteRead<SubjectCacheSnapshot>(getSubjectCacheKey(scope));
  if (!snapshot || snapshot.schema !== SUBJECT_CACHE_SCHEMA || !Array.isArray(snapshot.data)) {
    return null;
  }
  return { ...snapshot, data: normaliseSubjects(snapshot.data) };
}

export function writeSubjectCache(
  scope: string,
  revision: number,
  subjects: Subject[],
): void {
  if (!scope) return;
  liteWrite(
    getSubjectCacheKey(scope),
    {
      schema: SUBJECT_CACHE_SCHEMA,
      revision,
      data: normaliseSubjects(subjects),
    } satisfies SubjectCacheSnapshot,
    SUBJECT_CACHE_TTL,
  );
}
