import { auth } from '@/lib/firebase';
import { isDefinitiveSessionError } from './session-error-policy';

export type AppSessionValidation =
  | {
      status: 'valid';
      role?: string;
    }
  | {
      status: 'unavailable';
      message: string;
    }
  | {
      status: 'invalid';
      message: string;
    };

/**
 * Validates the signed Firebase session without reading Firestore.
 *
 * A forced refresh asks Firebase Authentication for a current signed token.
 * It detects disabled users and refresh-token revocation, but does not fetch
 * the system_users document and therefore consumes no Firestore document read.
 */
export async function validateCurrentAppSession(
  expectedUserId: string,
  forceRefresh = false,
): Promise<AppSessionValidation> {
  const firebaseUser = auth.currentUser;

  if (!firebaseUser || firebaseUser.isAnonymous || firebaseUser.uid !== expectedUserId) {
    return {
      status: 'invalid',
      message: 'Your secure session is no longer available. Please sign in again.',
    };
  }

  try {
    const tokenResult = await firebaseUser.getIdTokenResult(forceRefresh);
    if (
      tokenResult.claims.appUser !== true ||
      tokenResult.claims.isActive !== true
    ) {
      return {
        status: 'invalid',
        message: 'Your access has been changed or disabled. Please sign in again.',
      };
    }

    return {
      status: 'valid',
      role: typeof tokenResult.claims.role === 'string'
        ? tokenResult.claims.role
        : undefined,
    };
  } catch (error) {
    if (!isDefinitiveSessionError(error)) {
      return {
        status: 'unavailable',
        message: 'The live session check is waiting for a stable connection. Your current session remains available.',
      };
    }

    return {
      status: 'invalid',
      message: 'Your session was revoked, disabled, or expired. Please sign in again.',
    };
  }
}
