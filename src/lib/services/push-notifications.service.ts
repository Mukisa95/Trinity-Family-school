/**
 * Push Notifications Service — Clean Rebuild
 *
 * Responsibilities:
 *  - Subscribe a browser to web push (save to Firestore `pushSubscriptions`)
 *  - Server-side: send push to a list of userIds (called from API routes only)
 *  - Server-side: resolve "fees-access users" and push to them (SchoolPay hook)
 *
 * This service manages web-push subscriptions for desktop and mobile browsers.
 */

import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

// ─── Shared types ────────────────────────────────────────────────────────────

export interface PushSubscriptionRecord {
  id?: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  deviceType: 'desktop' | 'mobile';
  userAgent: string;
  platform?: string;
  pwaInstalled?: boolean;
  isActive: boolean;
  createdAt: Timestamp | ReturnType<typeof serverTimestamp>;
  updatedAt?: Timestamp | ReturnType<typeof serverTimestamp>;
  lastSeenAt?: Timestamp | ReturnType<typeof serverTimestamp>;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
}

// ─── VAPID key helper (browser-side only) ────────────────────────────────────

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const DEFAULT_VAPID_KEY = 'BKdPGmGr1PGvX5FgBPph5yywU7ilPtSFxSYzpNdf751UHl7dFn-Qgt_qVQWeZ4-KSCkXC1F0VrbnfJ6m7Ozc2W4';

  let key = (base64String || '').trim();
  key = key.replace(/^["']|["']$/g, '').trim();

  if (!key || key === 'undefined' || key === 'null') {
    key = DEFAULT_VAPID_KEY;
  }

  // Sanitize key: keep only base64url characters A-Z, a-z, 0-9, -, _
  const cleanKey = key.replace(/[^A-Za-z0-9\-_]/g, '');
  if (!cleanKey) {
    key = DEFAULT_VAPID_KEY;
  } else {
    key = cleanKey;
  }

  let base64 = key.replace(/-/g, '+').replace(/_/g, '/');
  const paddingNeeded = (4 - (base64.length % 4)) % 4;
  if (paddingNeeded > 0 && paddingNeeded < 4) {
    base64 += '='.repeat(paddingNeeded);
  }

  try {
    const rawData = typeof window !== 'undefined' ? window.atob(base64) : Buffer.from(base64, 'base64').toString('binary');
    const output = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
      output[i] = rawData.charCodeAt(i);
    }
    return output;
  } catch (err) {
    console.warn('[urlBase64ToUint8Array] Base64 decode failed, trying fallback key:', err);
    if (key !== DEFAULT_VAPID_KEY) {
      return urlBase64ToUint8Array(DEFAULT_VAPID_KEY);
    }
    return new Uint8Array(65);
  }
}

// ─── Browser-side: save subscription to Firestore ────────────────────────────

/**
 * Save (upsert) a browser PushSubscription for a given user into Firestore.
 * Called from the Subscribe API route after the browser subscribes.
 */
export async function saveSubscription(
  userId: string,
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  },
  device: {
    deviceType?: 'desktop' | 'mobile';
    userAgent?: string;
    platform?: string;
    pwaInstalled?: boolean;
  } = {},
): Promise<string> {
  const subscriptionsRef = collection(db, 'pushSubscriptions');

  // One browser endpoint belongs to exactly one signed-in user. Reconciliation
  // updates the current record instead of creating a new document every time
  // the PWA comes online or returns to the foreground.
  const existingQ = query(
    subscriptionsRef,
    where('endpoint', '==', subscription.endpoint)
  );
  const existingSnap = await getDocs(existingQ);

  const matching = existingSnap.docs.find(existing => existing.data().userId === userId);
  const now = serverTimestamp();
  const deviceType: PushSubscriptionRecord['deviceType'] =
    device.deviceType === 'mobile' ? 'mobile' : 'desktop';
  const safeText = (value: unknown, maxLength: number) =>
    typeof value === 'string' ? value.slice(0, maxLength) : 'unknown';
  const deviceFields = {
    deviceType,
    userAgent: safeText(device.userAgent, 500),
    platform: safeText(device.platform, 100),
    pwaInstalled: device.pwaInstalled === true,
  };

  for (const existing of existingSnap.docs) {
    if (existing.id === matching?.id) continue;
    await updateDoc(existing.ref, {
      isActive: false,
      deactivatedAt: now,
      updatedAt: now,
    });
  }

  if (matching) {
    await updateDoc(matching.ref, {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      ...deviceFields,
      isActive: true,
      deactivatedAt: null,
      updatedAt: now,
      lastSeenAt: now,
    });
    return matching.id;
  }

  const record: Omit<PushSubscriptionRecord, 'id'> = {
    userId,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    ...deviceFields,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    lastSeenAt: now,
  };

  const docRef = await addDoc(subscriptionsRef, record);
  return docRef.id;
}

/**
 * Deactivate all active push subscriptions for a user.
 */
export async function deactivateUserSubscriptions(userId: string): Promise<void> {
  const subscriptionsRef = collection(db, 'pushSubscriptions');
  const q = query(
    subscriptionsRef,
    where('userId', '==', userId),
    where('isActive', '==', true)
  );
  const snap = await getDocs(q);
  const updates = snap.docs.map((d) =>
    updateDoc(d.ref, { isActive: false, deactivatedAt: serverTimestamp() })
  );
  await Promise.all(updates);
}

/** Deactivate one browser endpoint without affecting the user's other devices. */
export async function deactivateSubscriptionEndpoint(
  userId: string,
  endpoint: string,
): Promise<void> {
  const subscriptionsRef = collection(db, 'pushSubscriptions');
  const q = query(subscriptionsRef, where('endpoint', '==', endpoint));
  const snap = await getDocs(q);
  const now = serverTimestamp();
  const updates = snap.docs
    .filter(subscription => subscription.data().userId === userId)
    .map(subscription => updateDoc(subscription.ref, {
      isActive: false,
      deactivatedAt: now,
      updatedAt: now,
    }));
  await Promise.all(updates);
}

/**
 * Get the active subscription document for a user (most recent if multiple).
 */
export async function getUserSubscription(
  userId: string
): Promise<PushSubscriptionRecord | null> {
  const subscriptionsRef = collection(db, 'pushSubscriptions');
  const q = query(
    subscriptionsRef,
    where('userId', '==', userId),
    where('isActive', '==', true)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PushSubscriptionRecord));
  // Return most recently created
  docs.sort((a, b) => {
    const aMs = (a.createdAt as Timestamp)?.toMillis?.() ?? 0;
    const bMs = (b.createdAt as Timestamp)?.toMillis?.() ?? 0;
    return bMs - aMs;
  });
  return docs[0];
}

// ─── Server-side: fetch subscriptions for a list of userIds ──────────────────

/**
 * Fetch all active push subscriptions for a list of user IDs.
 * Handles Firestore's 10-item `in` query limit internally.
 */
export async function getSubscriptionsForUsers(
  userIds: string[]
): Promise<PushSubscriptionRecord[]> {
  if (userIds.length === 0) return [];
  const subscriptionsRef = collection(db, 'pushSubscriptions');
  const results: PushSubscriptionRecord[] = [];
  const CHUNK = 10; // Firestore 'in' limit

  for (let i = 0; i < userIds.length; i += CHUNK) {
    const chunk = userIds.slice(i, i + CHUNK);
    const q = query(
      subscriptionsRef,
      where('userId', 'in', chunk),
      where('isActive', '==', true)
    );
    const snap = await getDocs(q);
    snap.docs.forEach((d) =>
      results.push({ id: d.id, ...d.data() } as PushSubscriptionRecord)
    );
  }

  return results;
}

/**
 * Fetch ALL active push subscriptions (for broadcast).
 */
export async function getAllActiveSubscriptions(): Promise<PushSubscriptionRecord[]> {
  const subscriptionsRef = collection(db, 'pushSubscriptions');
  const q = query(subscriptionsRef, where('isActive', '==', true));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PushSubscriptionRecord));
}

// ─── Server-side: resolve target group to user IDs ───────────────────────────

/**
 * Get user IDs for users that have fees/accounts access.
 * These are users whose role is Admin OR who have modulePermissions
 * containing an entry for 'fees' or 'accounts' with allowed=true.
 */
export async function getFeesAccessUserIds(): Promise<string[]> {
  const systemUsersRef = collection(db, 'system_users');

  // 1. All active admins always get fees notifications
  const adminQ = query(
    systemUsersRef,
    where('role', 'in', ['Admin', 'admin']),
    where('isActive', '==', true)
  );
  const adminSnap = await getDocs(adminQ);
  const userIds = new Set<string>(adminSnap.docs.map((d) => d.id));

  // 2. Staff users with explicit fees/accounts module access
  const staffQ = query(
    systemUsersRef,
    where('isActive', '==', true)
  );
  const staffSnap = await getDocs(staffQ);

  staffSnap.docs.forEach((d) => {
    const data = d.data() as any;
    const perms: any[] = data.modulePermissions || [];
    const hasFeesAccess = perms.some(
      (p: any) =>
        (p.module === 'fees' ||
          p.module === 'accounts' ||
          p.module === 'Fees' ||
          p.module === 'Accounts') &&
        p.allowed !== false
    );
    if (hasFeesAccess) userIds.add(d.id);
  });

  return Array.from(userIds);
}

/**
 * Get user IDs for a target group string.
 */
export async function resolveTargetToUserIds(
  target: 'all' | 'admins' | 'fees_staff' | string
): Promise<string[]> {
  const systemUsersRef = collection(db, 'system_users');

  if (target === 'all') {
    const q = query(systemUsersRef, where('isActive', '==', true));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.id);
  }

  if (target === 'admins') {
    const q = query(
      systemUsersRef,
      where('role', 'in', ['Admin', 'admin']),
      where('isActive', '==', true)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.id);
  }

  if (target === 'fees_staff') {
    return getFeesAccessUserIds();
  }

  // Custom: treat target as a space/comma-separated list of user IDs
  return target
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─── Backward-Compatibility Shim ─────────────────────────────────────────────
// Several older files (notifications/page.tsx, floating-notifications-modal.tsx,
// optimized-notification.service.ts, notification-service.ts) import
// `pushNotificationService` as a class instance. We export a compatible object
// here so those files continue to compile without modification.

export const pushNotificationService = {
  /**
   * Request browser notification permission.
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) return 'denied';
    if (Notification.permission === 'default') {
      return Notification.requestPermission();
    }
    return Notification.permission;
  },

  /**
   * Subscribe a user — browser-side. Registers SW + saves to Firestore.
   */
  async subscribe(userId: string) {
    const { enablePushSubscription } = await import('@/lib/push-subscription-client');
    const result = await enablePushSubscription(userId);
    if (!result.active) return null;
    return getUserSubscription(userId);
  },

  /**
   * Unsubscribe a user — deactivates browser subscription and Firestore record.
   */
  async unsubscribe(userId: string): Promise<void> {
    const { detachPushSubscriptionForLogout } = await import('@/lib/push-subscription-client');
    await detachPushSubscriptionForLogout(userId);
  },

  /**
   * Get user's active push subscription document from Firestore.
   */
  async getSubscription(userId: string) {
    return getUserSubscription(userId);
  },

  /**
   * Alias for getSubscription for backward compatibility.
   */
  async getUserPushSubscription(userId: string) {
    return getUserSubscription(userId);
  },

  /**
   * Validate and sync browser subscription with database.
   * Returns compatibility object.
   */
  async validateAndSyncSubscription(userId: string) {
    try {
      const { reconcilePushSubscription } = await import('@/lib/push-subscription-client');
      const syncResult = await reconcilePushSubscription(userId);
      const reg = await navigator.serviceWorker.getRegistration();
      const browserSub = await reg?.pushManager.getSubscription();
      const dbSub = await getUserSubscription(userId);

      return {
        isValid: syncResult.active && !!browserSub && !!dbSub,
        needsResubscription: !syncResult.active && !browserSub,
        browserHasSubscription: !!browserSub,
        databaseHasSubscription: !!dbSub,
      };
    } catch {
      return { isValid: false, needsResubscription: false, browserHasSubscription: false, databaseHasSubscription: false };
    }
  },
};
