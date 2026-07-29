import type { Staff } from '@/types';
import { liteRead, liteWrite } from './lite-cache';

const STAFF_CACHE_TTL = Number.MAX_SAFE_INTEGER;
// Versioned separately so a malformed legacy staff snapshot can never prevent
// the cache owner from performing its one required recovery read.
const STAFF_CACHE_SCHEMA = 1;

export type StaffCacheSnapshot = {
  schema: number;
  revision: number;
  data: Staff[];
};

/**
 * Staff records are private. Keep them separated by Firebase project, signed-in
 * user and role so switching accounts cannot restore another user's snapshot.
 * Parents deliberately do not receive the full staff collection through this
 * cache; their views resolve only the explicitly assigned display data.
 */
export function getStaffCacheScope(userId?: string, role?: string): string {
  if (!userId || !role || role === 'Parent') return '';
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools';
  return [projectId, userId, role].map(encodeURIComponent).join(':');
}

export function getStaffCacheKey(scope: string): string {
  return `staff:${scope}`;
}

function toIso(value: unknown): unknown {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return value;
}

/** Normalise timestamps once so the localStorage payload is JSON-safe. */
export function normaliseStaff(staff: Staff[]): Staff[] {
  return [...staff]
    .map(staffMember => ({
      ...staffMember,
      createdAt: (toIso(staffMember.createdAt) || '') as string,
      updatedAt: toIso(staffMember.updatedAt) as Staff['updatedAt'],
      dateOfBirth: (toIso(staffMember.dateOfBirth) || '') as string,
      joinDate: toIso(staffMember.joinDate) as Staff['joinDate'],
    }))
    .sort((a, b) => {
      const lastName = (a.lastName || '').localeCompare(b.lastName || '');
      return lastName || (a.firstName || '').localeCompare(b.firstName || '');
    });
}

export function readStaffCache(scope: string): StaffCacheSnapshot | null {
  if (!scope) return null;
  const snapshot = liteRead<StaffCacheSnapshot>(getStaffCacheKey(scope));
  if (!snapshot || snapshot.schema !== STAFF_CACHE_SCHEMA || !Array.isArray(snapshot.data)) return null;

  return {
    ...snapshot,
    data: normaliseStaff(snapshot.data),
  };
}

export function writeStaffCache(scope: string, revision: number, staff: Staff[]): void {
  if (!scope) return;
  liteWrite(
    getStaffCacheKey(scope),
    {
      schema: STAFF_CACHE_SCHEMA,
      revision,
      data: normaliseStaff(staff),
    } satisfies StaffCacheSnapshot,
    STAFF_CACHE_TTL,
  );
}
