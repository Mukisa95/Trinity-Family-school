import type { Event, UserRole } from '@/types';
import { liteRead, liteReadMetadata, liteWrite, LITE_TTL } from './lite-cache';

const EVENT_CACHE_SCHEMA = 2;

export type EventCacheSnapshot = {
  schema: number;
  revision: number;
  data: Event[];
};

export function getEventCacheScope(
  userId?: string,
  role?: UserRole,
  familyId?: string,
): string {
  if (!userId || !role) return '';
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools';
  return [projectId, userId, role, familyId || 'school']
    .map(encodeURIComponent)
    .join(':');
}

export function getEventCacheKey(scope: string): string {
  return `events:${scope}`;
}

export function getLegacyExamEventCacheKey(scope: string): string {
  return `legacy-exam-events:${scope}`;
}

export function readEventCache(scope: string): EventCacheSnapshot | null {
  if (!scope) return null;
  const cacheKey = getEventCacheKey(scope);
  const snapshot = liteRead<EventCacheSnapshot>(cacheKey);
  if (snapshot?.schema !== EVENT_CACHE_SCHEMA) return null;

  // Upgrade still-valid 48-hour entries written by older releases without
  // forcing one last expiry read from Firestore.
  if (liteReadMetadata(cacheKey)?.ttlMs !== LITE_TTL.events) {
    liteWrite(cacheKey, snapshot, LITE_TTL.events);
  }
  return snapshot;
}

export function writeEventCache(scope: string, revision: number, events: Event[]): void {
  if (!scope) return;
  liteWrite(
    getEventCacheKey(scope),
    { schema: EVENT_CACHE_SCHEMA, revision, data: events } satisfies EventCacheSnapshot,
    LITE_TTL.events,
  );
}

export function readLegacyExamEventCache(scope: string): EventCacheSnapshot | null {
  if (!scope) return null;
  const cacheKey = getLegacyExamEventCacheKey(scope);
  const snapshot = liteRead<EventCacheSnapshot>(cacheKey);
  if (snapshot?.schema !== EVENT_CACHE_SCHEMA) return null;
  if (liteReadMetadata(cacheKey)?.ttlMs !== LITE_TTL.events) {
    liteWrite(cacheKey, snapshot, LITE_TTL.events);
  }
  return snapshot;
}

export function writeLegacyExamEventCache(
  scope: string,
  revision: number,
  events: Event[],
): void {
  if (!scope) return;
  liteWrite(
    getLegacyExamEventCacheKey(scope),
    { schema: EVENT_CACHE_SCHEMA, revision, data: events } satisfies EventCacheSnapshot,
    LITE_TTL.events,
  );
}
