import { browserSupportsPasskeys, platformAuthenticatorIsAvailable, startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { auth } from '@/lib/firebase';
import { SecureAuthService } from './secure-auth.service';

type PasskeyRecord = { id: string; name: string; createdAt: string | null };
const LOCAL_PASSKEY_KEY_PREFIX = 'trinity_local_passkeys:';
export const PASSKEYS_CHANGED_EVENT = 'trinity:passkeys-changed';

function localPasskeyKey(userId: string) {
  return `${LOCAL_PASSKEY_KEY_PREFIX}${userId}`;
}

function readLocalPasskeyIds(userId: string): string[] {
  if (typeof window === 'undefined' || !userId) return [];
  try {
    const value = JSON.parse(localStorage.getItem(localPasskeyKey(userId)) || '[]');
    return Array.isArray(value) ? value.filter(id => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function saveLocalPasskeyIds(userId: string, ids: string[]) {
  if (typeof window === 'undefined' || !userId) return;
  localStorage.setItem(localPasskeyKey(userId), JSON.stringify([...new Set(ids)]));
  window.dispatchEvent(new Event(PASSKEYS_CHANGED_EVENT));
}

function randomChallenge() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function requestPasskey<T>(body: Record<string, unknown>, authenticated = false): Promise<T> {
  // The application profile is restored from its local cache before Firebase
  // Auth finishes restoring its persisted identity. Settings can therefore
  // mount while currentUser is briefly null even though the user is signed in.
  // Waiting here prevents that normal startup window from being reported as a
  // network or sign-in failure.
  if (authenticated) await auth.authStateReady();
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
  isPreviouslyRegisteredError(error: unknown) {
    return Boolean(
      error
      && typeof error === 'object'
      && 'code' in error
      && error.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED',
    );
  },

  async supported() {
    return typeof window !== 'undefined' && window.isSecureContext
      && await browserSupportsPasskeys()
      && await platformAuthenticatorIsAvailable();
  },

  async list(): Promise<PasskeyRecord[]> {
    const payload = await requestPasskey<{ passkeys: PasskeyRecord[] }>({ action: 'list' }, true);
    const userId = auth.currentUser?.uid;
    if (userId) saveLocalPasskeyIds(userId, payload.passkeys.map(passkey => passkey.id));
    return payload.passkeys;
  },

  async register(password: string) {
    const setup = await requestPasskey<{ challengeId: string; options: Parameters<typeof startRegistration>[0]['optionsJSON'] }>(
      { action: 'register-options', password }, true,
    );
    const response = await startRegistration({ optionsJSON: setup.options });
    await requestPasskey({ action: 'register-verify', challengeId: setup.challengeId, response }, true);
    const userId = auth.currentUser?.uid;
    if (userId) saveLocalPasskeyIds(userId, [...readLocalPasskeyIds(userId), response.id]);
  },

  async remove(credentialId: string, password: string) {
    await requestPasskey({ action: 'remove', credentialId, password }, true);
    const userId = auth.currentUser?.uid;
    if (userId) saveLocalPasskeyIds(userId, readLocalPasskeyIds(userId).filter(id => id !== credentialId));
  },

  hasLocalUnlock(userId: string) {
    return readLocalPasskeyIds(userId).length > 0;
  },

  /**
   * Unlocks the existing local privacy screen. The browser and operating
   * system perform user verification; no server or Firestore request is made.
   * Full account sign-in continues to use the server-verified passkey flow.
   */
  async unlockLocalSession(userId: string) {
    if (!await this.supported()) throw new Error('Device unlock is not available on this device.');
    const credentialIds = readLocalPasskeyIds(userId);
    if (!credentialIds.length) throw new Error('Set up biometric / device unlock in Settings while online first.');
    const options: Parameters<typeof startAuthentication>[0]['optionsJSON'] = {
      challenge: randomChallenge(),
      rpId: window.location.hostname,
      timeout: 60_000,
      userVerification: 'required',
      allowCredentials: credentialIds.map(id => ({ id, type: 'public-key' as const })),
    };
    const response = await startAuthentication({ optionsJSON: options });
    if (!credentialIds.includes(response.id)) throw new Error('This device unlock does not belong to the signed session.');
    return true;
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
