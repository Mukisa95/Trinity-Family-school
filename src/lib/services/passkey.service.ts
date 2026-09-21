import { browserSupportsPasskeys, platformAuthenticatorIsAvailable, startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { auth } from '@/lib/firebase';
import { SecureAuthService } from './secure-auth.service';

type PasskeyRecord = { id: string; name: string; createdAt: string | null };

async function requestPasskey<T>(body: Record<string, unknown>, authenticated = false): Promise<T> {
  const token = authenticated ? await auth.currentUser?.getIdToken() : null;
  if (authenticated && !token) throw new Error('Sign in again to manage device unlock.');
  const response = await fetch('/api/auth/passkey', {
    method: 'POST', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || 'Device unlock is unavailable right now.');
  return payload;
}

export const PasskeyService = {
  async supported() {
    return typeof window !== 'undefined' && window.isSecureContext
      && await browserSupportsPasskeys()
      && await platformAuthenticatorIsAvailable();
  },

  async list(): Promise<PasskeyRecord[]> {
    const payload = await requestPasskey<{ passkeys: PasskeyRecord[] }>({ action: 'list' }, true);
    return payload.passkeys;
  },

  async register(password: string) {
    const setup = await requestPasskey<{ challengeId: string; options: Parameters<typeof startRegistration>[0]['optionsJSON'] }>(
      { action: 'register-options', password }, true,
    );
    const response = await startRegistration({ optionsJSON: setup.options });
    await requestPasskey({ action: 'register-verify', challengeId: setup.challengeId, response }, true);
  },

  async remove(credentialId: string, password: string) {
    await requestPasskey({ action: 'remove', credentialId, password }, true);
  },

  async signIn() {
    const setup = await requestPasskey<{ challengeId: string; options: Parameters<typeof startAuthentication>[0]['optionsJSON'] }>(
      { action: 'login-options' },
    );
    const response = await startAuthentication({ optionsJSON: setup.options });
    const payload = await requestPasskey<Parameters<typeof SecureAuthService.establishSession>[0]>(
      { action: 'login-verify', challengeId: setup.challengeId, response },
    );
    return SecureAuthService.establishSession(payload);
  },
};
