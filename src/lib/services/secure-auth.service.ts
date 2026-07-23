import { signInWithCustomToken } from 'firebase/auth';
import type { SystemUser } from '@/types';
import { auth } from '@/lib/firebase';

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
  if (!response.ok) throw new Error(payload.error || 'Authentication failed.');
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
    await signInWithCustomToken(auth, payload.customToken);
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
