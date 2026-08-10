import 'server-only';

import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';
import { getServerVapidDetails } from '@/lib/server/vapid-config';

export interface ServerPushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface BrowserSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

interface DeviceMetadata {
  deviceType?: 'desktop' | 'mobile';
  userAgent?: string;
  platform?: string;
  pwaInstalled?: boolean;
}

export interface WebPushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
  timestamp?: number;
}

const db = () => getFirestore(getFirebaseAdminApp());
const safeText = (value: unknown, maxLength: number, fallback = 'unknown') =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : fallback;

/**
 * Upsert one browser endpoint using the Admin SDK. A healthy reconciliation
 * performs one query and no write when the stored material has not changed.
 */
export async function saveServerPushSubscription(
  userId: string,
  subscription: BrowserSubscriptionInput,
  device: DeviceMetadata,
  vapidPublicKey: string,
  previousEndpoint?: string,
): Promise<{ id: string; changed: boolean }> {
  const firestore = db();
  const collection = firestore.collection('pushSubscriptions');
  const endpointSnapshot = await collection
    .where('endpoint', '==', subscription.endpoint)
    .get();

  const deviceFields = {
    deviceType: device.deviceType === 'mobile' ? 'mobile' : 'desktop',
    userAgent: safeText(device.userAgent, 500),
    platform: safeText(device.platform, 100),
    pwaInstalled: device.pwaInstalled === true,
    vapidPublicKey,
  };
  const existing = endpointSnapshot.docs.find(doc => doc.data().userId === userId)
    ?? endpointSnapshot.docs[0];
  const now = FieldValue.serverTimestamp();
  const batch = firestore.batch();
  let changed = false;
  let id: string;

  if (existing) {
    id = existing.id;
    const data = existing.data();
    const materialChanged = data.userId !== userId
      || data.p256dh !== subscription.keys.p256dh
      || data.auth !== subscription.keys.auth
      || data.deviceType !== deviceFields.deviceType
      || data.userAgent !== deviceFields.userAgent
      || data.platform !== deviceFields.platform
      || data.pwaInstalled !== deviceFields.pwaInstalled
      || data.vapidPublicKey !== vapidPublicKey
      || data.isActive !== true;

    if (materialChanged) {
      batch.set(existing.ref, {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        ...deviceFields,
        isActive: true,
        deactivatedAt: null,
        updatedAt: now,
      }, { merge: true });
      changed = true;
    }
  } else {
    const ref = collection.doc();
    id = ref.id;
    batch.create(ref, {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      ...deviceFields,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    changed = true;
  }

  for (const duplicate of endpointSnapshot.docs) {
    if (duplicate.id === id || duplicate.data().isActive !== true) continue;
    batch.set(duplicate.ref, { isActive: false, deactivatedAt: now, updatedAt: now }, { merge: true });
    changed = true;
  }

  // Rotation is rare. Preserve the previous record until the replacement is
  // ready, then retire it in the same commit as the new/updated endpoint.
  if (previousEndpoint && previousEndpoint !== subscription.endpoint) {
    const previousSnapshot = await collection.where('endpoint', '==', previousEndpoint).get();
    for (const previous of previousSnapshot.docs) {
      if (previous.data().userId !== userId || previous.data().isActive !== true) continue;
      batch.set(previous.ref, { isActive: false, deactivatedAt: now, updatedAt: now }, { merge: true });
      changed = true;
    }
  }

  if (changed) await batch.commit();
  return { id, changed };
}

export async function deactivateServerPushEndpoint(userId: string, endpoint: string): Promise<number> {
  const firestore = db();
  const snapshot = await firestore.collection('pushSubscriptions')
    .where('endpoint', '==', endpoint)
    .get();
  const active = snapshot.docs.filter(doc => doc.data().userId === userId && doc.data().isActive === true);
  if (!active.length) return 0;

  const batch = firestore.batch();
  const now = FieldValue.serverTimestamp();
  active.forEach(doc => batch.set(doc.ref, {
    isActive: false,
    deactivatedAt: now,
    updatedAt: now,
  }, { merge: true }));
  await batch.commit();
  return active.length;
}

export async function getServerPushSubscriptionsForUsers(
  userIds: string[],
  vapidPublicKey = getServerVapidDetails().publicKey,
): Promise<ServerPushSubscription[]> {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (!uniqueUserIds.length) return [];

  const results: ServerPushSubscription[] = [];
  const collection = db().collection('pushSubscriptions');
  // Firestore supports up to 30 equality values for an `in` query. Larger
  // chunks reduce empty-query minimum reads compared with the previous size 10.
  for (let index = 0; index < uniqueUserIds.length; index += 30) {
    const snapshot = await collection
      .where('userId', 'in', uniqueUserIds.slice(index, index + 30))
      .where('isActive', '==', true)
      .get();
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const p256dh = data.p256dh || data.keys?.p256dh;
      const auth = data.auth || data.keys?.auth;
      if (data.vapidPublicKey !== vapidPublicKey || !data.endpoint || !p256dh || !auth) return;
      results.push({ id: doc.id, userId: data.userId, endpoint: data.endpoint, p256dh, auth });
    });
  }
  return results;
}

export async function deactivateServerPushSubscriptionIds(ids: string[]): Promise<number> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (!uniqueIds.length) return 0;
  const firestore = db();
  const now = FieldValue.serverTimestamp();
  for (let index = 0; index < uniqueIds.length; index += 450) {
    const batch = firestore.batch();
    uniqueIds.slice(index, index + 450).forEach(id => {
      batch.set(firestore.collection('pushSubscriptions').doc(id), {
        isActive: false,
        deactivatedAt: now,
        updatedAt: now,
      }, { merge: true });
    });
    await batch.commit();
  }
  return uniqueIds.length;
}

export async function getFeesAccessUserIdsAdmin(): Promise<string[]> {
  const snapshot = await db().collection('system_users').where('isActive', '==', true).get();
  return snapshot.docs.filter(doc => {
    const data = doc.data();
    if (String(data.role || '').toLowerCase() === 'admin') return true;
    const permissions = Array.isArray(data.modulePermissions) ? data.modulePermissions : [];
    return permissions.some((permission: any) =>
      ['fees', 'accounts'].includes(String(permission?.module || '').toLowerCase())
      && permission?.allowed !== false,
    );
  }).map(doc => doc.id);
}

export async function resolvePushTargetToUserIdsAdmin(target: string): Promise<string[]> {
  const collection = db().collection('system_users');
  if (target === 'all') {
    const snapshot = await collection.where('isActive', '==', true).get();
    return snapshot.docs.map(doc => doc.id);
  }
  if (target === 'admins') {
    const snapshot = await collection
      .where('role', 'in', ['Admin', 'admin'])
      .where('isActive', '==', true)
      .get();
    return snapshot.docs.map(doc => doc.id);
  }
  if (target === 'fees_staff') return getFeesAccessUserIdsAdmin();
  return target.split(/[\s,]+/).map(value => value.trim()).filter(Boolean);
}

let webPushPromise: Promise<any> | null = null;

async function getWebPushSender() {
  if (!webPushPromise) {
    webPushPromise = import('web-push').then(module => {
      const sender = module.default;
      const { subject, publicKey, privateKey } = getServerVapidDetails();
      if (!privateKey) throw new Error('VAPID_PRIVATE_KEY is not set');
      sender.setVapidDetails(subject, publicKey, privateKey);
      return sender;
    }).catch(error => {
      webPushPromise = null;
      throw error;
    });
  }
  return webPushPromise;
}

export async function sendServerWebPush(
  subscriptions: ServerPushSubscription[],
  payload: WebPushPayload,
  options: {
    urgency?: 'very-low' | 'low' | 'normal' | 'high';
    ttlSeconds?: number;
    deactivateExpired?: boolean;
  } = {},
): Promise<{ accepted: number; failed: number; expired: number; rejected: number }> {
  if (!subscriptions.length) return { accepted: 0, failed: 0, expired: 0, rejected: 0 };
  const sender = await getWebPushSender();
  const payloadText = JSON.stringify({
    ...payload,
    icon: payload.icon || '/trinity-logo-192.png',
    badge: payload.badge || '/icons/trinity-badge-72.png',
    url: payload.url || '/',
    timestamp: payload.timestamp || Date.now(),
  });
  const expiredIds: string[] = [];
  let accepted = 0;
  let failed = 0;
  let rejected = 0;

  for (let index = 0; index < subscriptions.length; index += 20) {
    const chunk = subscriptions.slice(index, index + 20);
    const results = await Promise.allSettled(chunk.map(subscription => sender.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      payloadText,
      {
        urgency: options.urgency || 'normal',
        TTL: options.ttlSeconds ?? 24 * 60 * 60,
        ...(payload.tag ? { topic: payload.tag.slice(0, 32) } : {}),
      },
    )));
    results.forEach((result, itemIndex) => {
      if (result.status === 'fulfilled') {
        accepted += 1;
        return;
      }
      failed += 1;
      const statusCode = (result.reason as any)?.statusCode;
      if (statusCode === 404 || statusCode === 410) expiredIds.push(chunk[itemIndex].id);
      else if (statusCode === 403) rejected += 1;
      else console.warn('Web Push delivery failed:', statusCode || 'unknown', (result.reason as any)?.message || 'Unknown error');
    });
  }

  const expired = options.deactivateExpired === false
    ? expiredIds.length
    : await deactivateServerPushSubscriptionIds(expiredIds);
  return { accepted, failed, expired, rejected };
}
