/**
 * Push Notifications Service — Clean Rebuild
 *
 * Responsibilities:
 *  - Subscribe a browser to web push (save to Firestore `pushSubscriptions`)
 *  - Server-side: send push to a list of userIds (called from API routes only)
 *  - Server-side: resolve "fees-access users" and push to them (SchoolPay hook)
 *
 * NOTE: On native Capacitor (Android), the @capacitor/push-notifications plugin
 * handles its own registration via AndroidAppInit. This service only covers
 * web-push subscriptions (desktop + mobile browsers).
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
  isActive: boolean;
  createdAt: Timestamp | ReturnType<typeof serverTimestamp>;
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
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
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
  }
): Promise<string> {
  const subscriptionsRef = collection(db, 'pushSubscriptions');

  // Deactivate any existing subscription with the same endpoint (clean upsert)
  const existingQ = query(
    subscriptionsRef,
    where('endpoint', '==', subscription.endpoint)
  );
  const existingSnap = await getDocs(existingQ);
  for (const existing of existingSnap.docs) {
    await updateDoc(existing.ref, { isActive: false });
  }

  // Detect device type from user agent (server-safe, defaults to 'desktop' if no navigator)
  const deviceType =
    typeof navigator !== 'undefined' &&
    /mobile|android|iphone|ipad/i.test(navigator.userAgent)
      ? 'mobile'
      : 'desktop';

  const record: Omit<PushSubscriptionRecord, 'id'> = {
    userId,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    deviceType,
    userAgent:
      typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    isActive: true,
    createdAt: serverTimestamp(),
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
    const VAPID_KEY =
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
      'BKdPGmGr1PGvX5FgBPph5yywU7ilPtSFxSYzpNdf751UHl7dFn-Qgt_qVQWeZ4-KSCkXC1F0VrbnfJ6m7Ozc2W4';

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const pushSub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_KEY).buffer as ArrayBuffer,
    });

    const json = pushSub.toJSON();
    if (!json.keys?.p256dh || !json.keys?.auth) return null;

    const docId = await saveSubscription(userId, { endpoint: json.endpoint!, keys: json.keys as { p256dh: string; auth: string } });
    return { id: docId, userId, endpoint: json.endpoint, isActive: true };
  },

  /**
   * Unsubscribe a user — deactivates browser subscription and Firestore record.
   */
  async unsubscribe(userId: string): Promise<void> {
    const { deactivateUserSubscriptions } = await import('./push-notifications.service');
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    }
    await deactivateUserSubscriptions(userId);
  },

  /**
   * Validate and sync browser subscription with database.
   * Returns compatibility object.
   */
  async validateAndSyncSubscription(userId: string) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const browserSub = await reg.pushManager.getSubscription();
      const { getUserSubscription } = await import('./push-notifications.service');
      const dbSub = await getUserSubscription(userId);

      // If database says active but browser has no sub, deactivate DB record
      if (dbSub && !browserSub) {
        const { deactivateUserSubscriptions } = await import('./push-notifications.service');
        await deactivateUserSubscriptions(userId);
        return { isValid: false, needsResubscription: true, browserHasSubscription: false, databaseHasSubscription: true };
      }

      return {
        isValid: !!(browserSub && dbSub),
        needsResubscription: !!browserSub && !dbSub,
        browserHasSubscription: !!browserSub,
        databaseHasSubscription: !!dbSub,
      };
    } catch {
      return { isValid: false, needsResubscription: false, browserHasSubscription: false, databaseHasSubscription: false };
    }
  },
} as const;
