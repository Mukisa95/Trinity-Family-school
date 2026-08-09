"use client";

import { auth } from '@/lib/firebase';

const DEFAULT_VAPID_PUBLIC_KEY =
  'BMOU7Zc7H4Kx4pgm8KBjrIxPBZcYxFYoz5kxVOmHHI4Up5mNxnXGpbc91fBEZcndzU0E9Zk7AFUAelNuD6RXnWY';

export type PushSyncResult = {
  active: boolean;
  reason?:
    | 'unsupported'
    | 'permission-required'
    | 'permission-denied'
    | 'offline'
    | 'signed-out';
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  let key = (base64String || DEFAULT_VAPID_PUBLIC_KEY)
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/[^A-Za-z0-9\-_]/g, '');

  if (!key) key = DEFAULT_VAPID_PUBLIC_KEY;

  let base64 = key.replace(/-/g, '+').replace(/_/g, '/');
  base64 += '='.repeat((4 - (base64.length % 4)) % 4);

  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, character => character.charCodeAt(0));
}

function applicationServerKeyMatches(subscription: PushSubscription, publicKey: string): boolean {
  const currentKey = subscription.options.applicationServerKey;
  // Some browsers deliberately do not expose the key for an existing
  // subscription. An unknown key is not proof of a mismatch and must never
  // cause a working endpoint to be destroyed on startup.
  if (!currentKey) return true;

  const expected = urlBase64ToUint8Array(publicKey);
  const actual = new Uint8Array(currentKey);
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

let serverPublicKeyPromise: Promise<string> | null = null;

async function getServerPublicKey(): Promise<string> {
  if (!serverPublicKeyPromise) {
    serverPublicKeyPromise = fetch('/api/notifications/vapid-public-key', {
      cache: 'no-store',
    })
      .then(async response => {
        if (!response.ok) throw new Error('Unable to load the Web Push public key.');
        const payload = await response.json();
        const publicKey = typeof payload?.publicKey === 'string' ? payload.publicKey.trim() : '';
        if (!publicKey) throw new Error('The Web Push public key is unavailable.');
        return publicKey;
      })
      .catch(error => {
        serverPublicKeyPromise = null;
        throw error;
      });
  }
  return serverPublicKeyPromise;
}

function getDeviceMetadata() {
  const userAgent = navigator.userAgent;
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

  return {
    deviceType: /mobile|android|iphone|ipad/i.test(userAgent) ? 'mobile' : 'desktop',
    userAgent,
    platform: navigator.platform || 'unknown',
    pwaInstalled: standalone,
  };
}

const CONFIRMED_SUBSCRIPTION_PREFIX = 'trinity-push-confirmed:';

function endpointFingerprint(endpoint: string): string {
  let hash = 2166136261;
  for (let index = 0; index < endpoint.length; index += 1) {
    hash ^= endpoint.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function confirmationKey(userId: string) {
  return `${CONFIRMED_SUBSCRIPTION_PREFIX}${userId}`;
}

function markSubscriptionConfirmed(userId: string, endpoint: string) {
  try {
    sessionStorage.setItem(confirmationKey(userId), endpointFingerprint(endpoint));
  } catch {
    // A private browsing mode may make sessionStorage unavailable. The device
    // still works; it will simply reconcile once again after a page reload.
  }
}

function clearSubscriptionConfirmation(userId: string) {
  try {
    sessionStorage.removeItem(confirmationKey(userId));
  } catch {
    // Ignore unavailable storage during logout/cleanup.
  }
}

function isSubscriptionConfirmed(userId: string, endpoint: string) {
  try {
    return sessionStorage.getItem(confirmationKey(userId)) === endpointFingerprint(endpoint);
  } catch {
    return false;
  }
}

/** Browser-local status that was confirmed by the server in this app session. */
export async function getConfirmedBrowserPushSubscription(userId: string): Promise<PushSubscription | null> {
  if (!supportsWebPush() || Notification.permission !== 'granted') return null;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return subscription && isSubscriptionConfirmed(userId, subscription.endpoint) ? subscription : null;
}

async function getIdentityToken(expectedUserId: string): Promise<string | null> {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser || firebaseUser.isAnonymous || firebaseUser.uid !== expectedUserId) return null;
  return firebaseUser.getIdToken();
}

async function saveSubscription(
  userId: string,
  subscription: PushSubscription,
  publicKey: string,
  previousEndpoint?: string,
): Promise<void> {
  const token = await getIdentityToken(userId);
  if (!token) throw new Error('A verified signed-in session is required to save push notifications.');

  const response = await fetch('/api/notifications/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      userId,
      subscription: subscription.toJSON(),
      device: getDeviceMetadata(),
      publicKey,
      ...(previousEndpoint ? { previousEndpoint } : {}),
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to save the push subscription.');
  }

  const payload = await response.json().catch(() => ({}));
  if (payload?.active !== true) throw new Error('The server did not confirm this push subscription.');
}

async function getCurrentOrNewSubscription(publicKey: string): Promise<{
  subscription: PushSubscription;
  previousEndpoint?: string;
}> {
  await navigator.serviceWorker.register('/sw.js');
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  let previousEndpoint: string | undefined;

  // A subscription created with a previous VAPID key cannot be used by the
  // current sender. Rotate it while permission is already granted.
  if (subscription && !applicationServerKeyMatches(subscription, publicKey)) {
    previousEndpoint = subscription.endpoint;
    await subscription.unsubscribe();
    subscription = null;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
    });
  }

  return { subscription, previousEndpoint };
}

let activeSync: { userId: string; promise: Promise<PushSyncResult> } | null = null;

export function supportsWebPush(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export function isIosDevice(): boolean {
  return typeof navigator !== 'undefined'
    && /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

/**
 * Reconcile an already-authorized browser subscription with the signed-in
 * user. This never opens a permission prompt. Call it after login, after a
 * real subscription invalidation, or when retrying a recorded failure.
 */
export function reconcilePushSubscription(userId: string): Promise<PushSyncResult> {
  if (activeSync?.userId === userId) return activeSync.promise;

  const promise = (async (): Promise<PushSyncResult> => {
    if (!supportsWebPush()) return { active: false, reason: 'unsupported' };
    if (!navigator.onLine) return { active: false, reason: 'offline' };
    if (Notification.permission === 'denied') return { active: false, reason: 'permission-denied' };
    if (Notification.permission !== 'granted') return { active: false, reason: 'permission-required' };

    // A marker is written only after the server confirms the endpoint. This
    // makes additional hook mounts, focus events, and page UI checks free of
    // Firestore reads and writes for the rest of the app session.
    if (await getConfirmedBrowserPushSubscription(userId)) return { active: true };
    if (!await getIdentityToken(userId)) return { active: false, reason: 'signed-out' };

    // Never create a subscription from a compile-time fallback: production
    // signing credentials can differ between environments. The server-derived
    // key is the only authoritative key for this deployment.
    const publicKey = await getServerPublicKey();
    const { subscription, previousEndpoint } = await getCurrentOrNewSubscription(publicKey);
    await saveSubscription(userId, subscription, publicKey, previousEndpoint);
    markSubscriptionConfirmed(userId, subscription.endpoint);
    return { active: true };
  })().finally(() => {
    if (activeSync?.promise === promise) activeSync = null;
  });

  activeSync = { userId, promise };
  return promise;
}

/** Request permission from a direct user action, then register the device. */
export async function enablePushSubscription(userId: string): Promise<PushSyncResult> {
  if (!supportsWebPush()) return { active: false, reason: 'unsupported' };

  const permission = Notification.permission === 'default'
    ? await Notification.requestPermission()
    : Notification.permission;

  if (permission === 'denied') return { active: false, reason: 'permission-denied' };
  if (permission !== 'granted') return { active: false, reason: 'permission-required' };
  return reconcilePushSubscription(userId);
}

/**
 * Remove only this browser endpoint from the departing user. Other phones and
 * computers belonging to that user remain subscribed.
 */
export async function detachPushSubscriptionForLogout(userId: string): Promise<void> {
  if (!supportsWebPush()) return;

  clearSubscriptionConfirmation(userId);

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  const token = await getIdentityToken(userId).catch(() => null);
  if (token && navigator.onLine) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4000);
    try {
      await fetch('/api/notifications/subscribe', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
        cache: 'no-store',
        keepalive: true,
        signal: controller.signal,
      });
    } catch {
      // Local unsubscribe below prevents delivery even if the cleanup request
      // is interrupted while the page is closing or the connection is weak.
    } finally {
      window.clearTimeout(timeout);
    }
  }

  await subscription.unsubscribe().catch(() => false);
}
