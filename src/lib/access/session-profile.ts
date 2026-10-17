import type { SystemUser } from '@/types';
import { circumferenceKey } from './circumference';

const optionalLink = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

/** API JSON, legacy saved profiles and Firestore snapshots share one shape. */
export function normalizeSessionProfile(user: SystemUser): SystemUser {
  return { ...user, isActive: user.isActive !== false,
    familyId: optionalLink(user.familyId), pupilId: optionalLink(user.pupilId) };
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, stable(item)]));
  }
  return value ?? null;
}

/** Object key order is transport detail; permission array order is preserved. */
export function sessionAccessKey(user: SystemUser | null | undefined): string {
  if (!user) return 'signed-out';
  return JSON.stringify(stable({ id: user.id, role: user.role, active: user.isActive !== false,
    familyId: optionalLink(user.familyId), pupilId: optionalLink(user.pupilId),
    circumference: circumferenceKey(user), modulePermissions: user.modulePermissions,
    granularPermissions: user.granularPermissions }));
}
