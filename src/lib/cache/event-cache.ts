import type { Event, UserRole } from '@/types';
import { liteRead, liteReadMetadata, liteWrite, LITE_TTL } from './lite-cache';

export type EventCacheSnapshot = {
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
  return liteRead<EventCacheSnapshot>(getEventCacheKey(scope));
}

export function readEventCacheMetadata(scope: string) {
  if (!scope) return null;
  return liteReadMetadata(getEventCacheKey(scope));
}

export function writeEventCache(scope: string, revision: number, events: Event[]): void {
  if (!scope) return;
  liteWrite(
    getEventCacheKey(scope),
    { revision, data: events } satisfies EventCacheSnapshot,
    LITE_TTL.events,
  );
}

export function readLegacyExamEventCache(scope: string): EventCacheSnapshot | null {
  if (!scope) return null;
  return liteRead<EventCacheSnapshot>(getLegacyExamEventCacheKey(scope));
}

export function readLegacyExamEventCacheMetadata(scope: string) {
  if (!scope) return null;
  return liteReadMetadata(getLegacyExamEventCacheKey(scope));
}

export function writeLegacyExamEventCache(
  scope: string,
  revision: number,
  events: Event[],
): void {
  if (!scope) return;
  liteWrite(
    getLegacyExamEventCacheKey(scope),
    { revision, data: events } satisfies EventCacheSnapshot,
    LITE_TTL.events,
  );
}
