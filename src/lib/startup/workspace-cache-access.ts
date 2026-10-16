import type { SystemUser } from '@/types';
import { circumferenceKey, hasCircumference } from '@/lib/access/circumference';

const ACCESS_KEY = 'trinity_workspace_cache_access_v1';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type CacheAccess = { version: 1; scope: string; verifiedAt: number; expiresAt: number };
type WorkspaceUser = Pick<SystemUser, 'id' | 'role'> & Partial<SystemUser>;

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, stable(item)]));
  }
  return value ?? null;
}

/** Bind saved viewing to the school, account, role, family and permission set. */
export function workspaceCacheAccessScope(user: WorkspaceUser): string {
  return JSON.stringify(stable({
    project: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools',
    id: user.id, role: user.role, active: user.isActive !== false, familyId: user.familyId, pupilId: user.pupilId,
    modulePermissions: user.modulePermissions, granularPermissions: user.granularPermissions,
    ...(hasCircumference(user) ? { circumference: circumferenceKey(user) } : {}),
  }));
}

export function isWorkspaceCacheAccessValid(value: unknown, user: WorkspaceUser, now = Date.now()): boolean {
  if (!value || typeof value !== 'object' || !user.id || !user.role || user.isActive === false) return false;
  const access = value as CacheAccess;
  return access.version === 1 && access.scope === workspaceCacheAccessScope(user)
    && Number.isFinite(access.verifiedAt) && Number.isFinite(access.expiresAt)
    && access.verifiedAt <= now && access.expiresAt > now
    && access.expiresAt - access.verifiedAt === MAX_AGE_MS;
}

/** This local viewing receipt is written only after signed Firebase validation.
 * It is not a credential and never authorizes a server request or a mutation.
 * Like other device session storage, it assumes the application's origin is trusted.
 */
export function rememberVerifiedWorkspaceAccess(user: WorkspaceUser): void {
  if (typeof window === 'undefined') return;
  const verifiedAt = Date.now();
  try {
    window.localStorage.setItem(ACCESS_KEY, JSON.stringify({
      version: 1, scope: workspaceCacheAccessScope(user), verifiedAt, expiresAt: verifiedAt + MAX_AGE_MS,
    } satisfies CacheAccess));
  } catch { /* Live signed identity remains available when device storage is full. */ }
  window.dispatchEvent(new Event('trinity-workspace-cache-access'));
}

export function savedWorkspaceAccessStatus(value: unknown, user: WorkspaceUser, now = Date.now()): string {
  if (!value) return 'missing-receipt';
  if (!value || typeof value !== 'object') return 'invalid-receipt';
  const access = value as CacheAccess;
  if (access.scope !== workspaceCacheAccessScope(user)) return 'scope-changed';
  if (Number.isFinite(access.expiresAt) && access.expiresAt <= now) return 'expired-receipt';
  return isWorkspaceCacheAccessValid(value, user, now) ? 'eligible' : 'invalid-receipt';
}

/** Broad local diagnostic reasons only; never export the receipt or its private scope. */
export function getSavedWorkspaceAccessStatus(user: WorkspaceUser): string {
  if (typeof window === 'undefined') return 'storage-unavailable';
  try {
    const profile = JSON.parse(window.localStorage.getItem('trinity_user') || 'null');
    if (workspaceCacheAccessScope(profile?.user || profile || {}) !== workspaceCacheAccessScope(user)) return 'profile-mismatch';
    return savedWorkspaceAccessStatus(JSON.parse(window.localStorage.getItem(ACCESS_KEY) || 'null'), user);
  } catch { return 'storage-unavailable'; }
}

export function hasSavedWorkspaceAccess(user: WorkspaceUser): boolean {
  return getSavedWorkspaceAccessStatus(user) === 'eligible';
}

export function clearSavedWorkspaceAccess(): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(ACCESS_KEY); } catch { /* Storage may be disabled. */ }
}
