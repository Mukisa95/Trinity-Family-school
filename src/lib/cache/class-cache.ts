import type { Class } from '@/types';
import { liteRead, liteWrite } from './lite-cache';

const CLASS_CACHE_TTL = Number.MAX_SAFE_INTEGER;
// v2 invalidates snapshots that the initial cache rollout may have persisted
// as empty when a collection request timed out.
const CLASS_CACHE_SCHEMA = 2;

export type ClassCacheSnapshot = {
  schema: number;
  revision: number;
  data: Class[];
};

export function getClassCacheScope(userId?: string, role?: string): string {
  if (!userId || !role) return '';
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools';
  return [projectId, userId, role].map(encodeURIComponent).join(':');
}

export function getClassCacheKey(scope: string): string {
  return `classes:${scope}`;
}

function toIso(value: unknown): unknown {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return value;
}

export function normaliseClasses(classes: Class[]): Class[] {
  return [...classes]
    .map(classItem => ({
      ...classItem,
      createdAt: toIso(classItem.createdAt) as Class['createdAt'],
    }))
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
}

export function readClassCache(scope: string): ClassCacheSnapshot | null {
  if (!scope) return null;
  const snapshot = liteRead<ClassCacheSnapshot>(getClassCacheKey(scope));
  if (!snapshot || snapshot.schema !== CLASS_CACHE_SCHEMA || !Array.isArray(snapshot.data)) return null;

  return {
    ...snapshot,
    data: normaliseClasses(snapshot.data),
  };
}

export function writeClassCache(scope: string, revision: number, classes: Class[]): void {
  if (!scope) return;
  liteWrite(
    getClassCacheKey(scope),
    {
      schema: CLASS_CACHE_SCHEMA,
      revision,
      data: normaliseClasses(classes),
    } satisfies ClassCacheSnapshot,
    CLASS_CACHE_TTL,
  );
}
