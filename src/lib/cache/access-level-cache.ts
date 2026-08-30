import type { AccessLevel } from '@/types/access-levels';
import { liteRead, liteWrite } from './lite-cache';

const ACCESS_LEVEL_CACHE_TTL = Number.MAX_SAFE_INTEGER;
const ACCESS_LEVEL_CACHE_SCHEMA = 1;

export type AccessLevelCacheSnapshot = {
  schema: number;
  revision: number;
  data: AccessLevel[];
};

export function getAccessLevelCacheScope(userId?: string, role?: string): string {
  if (!userId || !role || role === 'Parent') return '';
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools';
  return [projectId, userId, role].map(encodeURIComponent).join(':');
}

export function getAccessLevelCacheKey(scope: string): string {
  return `access-levels:${scope}`;
}

/** Produces one predictable access-level list for all authorized consumers. */
export function normaliseAccessLevels(levels: AccessLevel[]): AccessLevel[] {
  return [...levels].sort((left, right) =>
    left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
  );
}

export function readAccessLevelCache(scope: string): AccessLevelCacheSnapshot | null {
  if (!scope) return null;
  const snapshot = liteRead<AccessLevelCacheSnapshot>(getAccessLevelCacheKey(scope));
  if (!snapshot || snapshot.schema !== ACCESS_LEVEL_CACHE_SCHEMA || !Array.isArray(snapshot.data)) {
    return null;
  }
  return { ...snapshot, data: normaliseAccessLevels(snapshot.data) };
}

export function writeAccessLevelCache(
  scope: string,
  revision: number,
  levels: AccessLevel[],
): void {
  if (!scope) return;
  liteWrite(
    getAccessLevelCacheKey(scope),
    {
      schema: ACCESS_LEVEL_CACHE_SCHEMA,
      revision,
      data: normaliseAccessLevels(levels),
    } satisfies AccessLevelCacheSnapshot,
    ACCESS_LEVEL_CACHE_TTL,
  );
}
