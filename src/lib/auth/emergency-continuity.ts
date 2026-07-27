import type { SystemUser } from '@/types';

/**
 * This feature is deliberately opt-in and temporary. It only helps an already
 * authenticated Firebase user keep using a matching local profile while a
 * Firestore quota incident prevents the normal live permission check.
 *
 * A browser with cleared data has neither the Firebase identity nor the
 * matching profile, and therefore cannot use this path.
 */
const emergencyContinuityUntil = process.env.NEXT_PUBLIC_AUTH_DEGRADED_MODE_UNTIL;

export function getEmergencyContinuityExpiry(): Date | null {
  if (!emergencyContinuityUntil) return null;

  const expiry = new Date(emergencyContinuityUntil);
  return Number.isNaN(expiry.getTime()) ? null : expiry;
}

export function isEmergencyContinuityActive(now = Date.now()): boolean {
  const expiry = getEmergencyContinuityExpiry();
  return Boolean(expiry && now < expiry.getTime());
}

export function isFirestoreQuotaExceeded(error: unknown): boolean {
  const value = error as { code?: unknown; message?: unknown } | null;
  const code = typeof value?.code === 'string' ? value.code.toLowerCase() : '';
  const message = typeof value?.message === 'string' ? value.message.toLowerCase() : '';

  return code === 'resource-exhausted'
    || message.includes('resource_exhausted')
    || message.includes('resource-exhausted')
    || message.includes('quota exceeded');
}

export function canUseEmergencyContinuity({
  firebaseUid,
  cachedUser,
  hasApplicationClaim,
}: {
  firebaseUid: string;
  cachedUser: SystemUser | null;
  hasApplicationClaim: boolean;
}): boolean {
  return isEmergencyContinuityActive()
    && hasApplicationClaim
    && cachedUser?.id === firebaseUid
    && cachedUser.isActive !== false;
}
