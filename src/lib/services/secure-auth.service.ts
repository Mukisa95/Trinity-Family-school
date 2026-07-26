import {
  browserLocalPersistence,
  setPersistence,
  signInWithCustomToken,
} from 'firebase/auth';
import type { SystemUser } from '@/types';
import { auth } from '@/lib/firebase';

export type SecureAuthErrorCode =
  | 'invalid-credentials'
  | 'rate-limited'
  | 'service-unavailable'
  | 'secure-session-failed';

export class SecureAuthError extends Error {
  constructor(
    public readonly code: SecureAuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SecureAuthError';
  }
}

type LoginResponse = {
  customToken: string;
  user: SystemUser;
  error?: string;
};

type VerifyResponse = {
  user: SystemUser;
  error?: string;
};

async function parseResponse<T extends { error?: string }>(response: Response) {
  const payload = await response.json().catch(() => ({})) as Partial<T>;
  if (!response.ok) {
    if (response.status === 400 || response.status === 401) {
      throw new SecureAuthError('invalid-credentials', 'Invalid username or password.');
    }
    if (response.status === 429) {
      throw new SecureAuthError(
        'rate-limited',
        payload.error || 'Too many sign-in attempts. Please wait one minute and try again.',
      );
    }
    throw new SecureAuthError(
      'service-unavailable',
      payload.error || 'Sign-in is temporarily unavailable. Please try again.',
    );
  }
  return payload as T;
}

export class SecureAuthService {
  static async signIn(username: string, password: string): Promise<SystemUser | null> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      cache: 'no-store',
    });
    const payload = await parseResponse<LoginResponse>(response);

    try {
      // Make the Firebase identity survive page reloads. If this embedded
      // browser cannot use local persistence, Firebase keeps its current
      // fallback and the sign-in can still complete for this tab.
      await setPersistence(auth, browserLocalPersistence).catch(() => undefined);
      await signInWithCustomToken(auth, payload.customToken);
    } catch {
      throw new SecureAuthError(
        'secure-session-failed',
        'Your username and password were accepted, but this device could not establish a secure session. Check your connection and try again.',
      );
    }

    return payload.user;
  }

  static async verifyCredentials(username: string, password: string): Promise<SystemUser | null> {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser || firebaseUser.isAnonymous) return null;
    const idToken = await firebaseUser.getIdToken();

    const response = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ username, password }),
      cache: 'no-store',
    });
    if (response.status === 401) return null;
    const payload = await parseResponse<VerifyResponse>(response);
    return payload.user;
  }
}
