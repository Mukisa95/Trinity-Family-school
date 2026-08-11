"use client";

import {
  collection,
  doc,
  documentId,
  getDocs,
  getDocsFromCache,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  readPersistedInbox,
  writePersistedInbox,
  type PersistedInboxNotification,
} from '@/lib/notification-inbox-cache';
import type { Notification } from '@/types';

const INBOX_PAGE_SIZE = 250;
const DOCUMENT_ID_CHUNK_SIZE = 10;
const RETENTION_MS = 15 * 24 * 60 * 60 * 1000;

export type InboxNotification = PersistedInboxNotification;

export type NotificationInboxSnapshot = {
  notifications: InboxNotification[];
  isLoading: boolean;
  error: string | null;
};

type Delivery = {
  id: string;
  notificationId?: unknown;
  method?: unknown;
  status?: unknown;
  sentAt?: unknown;
};

type InboxEntry = NotificationInboxSnapshot & {
  userId: string;
  unsubscribe?: Unsubscribe;
  starting?: boolean;
  listeners: Set<(snapshot: NotificationInboxSnapshot) => void>;
  notificationById: Map<string, InboxNotification>;
  deliveryById: Map<string, Delivery>;
  cacheOnlyNotificationIds: Set<string>;
  cursor?: string;
  sequence: number;
};

const inboxes = new Map<string, InboxEntry>();

function toIso(value: unknown): string {
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return ((value as { toDate: () => Date }).toDate()).toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' ? value : new Date().toISOString();
}

function toDate(value: unknown): Date | null {
  const iso = toIso(value);
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? date : null;
}

function normalizeNotification(id: string, data: Record<string, any>): InboxNotification {
  return {
    ...data,
    id,
    createdAt: toIso(data.createdAt),
    updatedAt: data.updatedAt ? toIso(data.updatedAt) : undefined,
    sentAt: data.sentAt ? toIso(data.sentAt) : undefined,
    recipients: Array.isArray(data.recipients) ? data.recipients : [],
    recipientIds: Array.isArray(data.recipientIds) ? data.recipientIds : undefined,
    readBy: Array.isArray(data.readBy) ? data.readBy : [],
  } as InboxNotification;
}

function normalizeDelivery(id: string, data: Record<string, unknown>): Delivery {
  return { id, ...data } as Delivery;
}

function publish(entry: InboxEntry) {
  const snapshot: NotificationInboxSnapshot = {
    notifications: entry.notifications,
    isLoading: entry.isLoading,
    error: entry.error,
  };
  entry.listeners.forEach(listener => listener(snapshot));
}

function persist(entry: InboxEntry) {
  void writePersistedInbox(entry.userId, entry.notifications, entry.cursor);
}

function isRetentionExpired(notification: InboxNotification): boolean {
  return new Date(notification.createdAt).getTime() <= Date.now() - RETENTION_MS;
}

async function loadNotificationDetails(
  entry: InboxEntry,
  notificationIds: string[],
  allowNetwork: boolean,
) {
  const missingIds = notificationIds.filter(id => !entry.notificationById.has(id));
  for (let index = 0; index < missingIds.length; index += DOCUMENT_ID_CHUNK_SIZE) {
    const ids = missingIds.slice(index, index + DOCUMENT_ID_CHUNK_SIZE);
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where(documentId(), 'in', ids),
    );
    let snapshots;
    try {
      snapshots = allowNetwork
        ? await getDocs(notificationsQuery)
        : await getDocsFromCache(notificationsQuery);
    } catch {
      // A cached delivery may outlive its retained database record. Keep the
      // device copy rather than treating retention cleanup as a user deletion.
      continue;
    }
    snapshots.docs.forEach(notification => {
      entry.notificationById.set(notification.id, normalizeNotification(notification.id, notification.data()));
    });
  }
}

function rebuildInbox(entry: InboxEntry) {
  const deliveryByNotification = new Map<string, Delivery>();
  entry.deliveryById.forEach(delivery => {
    if (typeof delivery.notificationId !== 'string' || !delivery.notificationId) return;
    const current = deliveryByNotification.get(delivery.notificationId);
    const currentDate = current ? toDate(current.sentAt)?.getTime() || 0 : -1;
    const nextDate = toDate(delivery.sentAt)?.getTime() || 0;
    if (!current || nextDate >= currentDate) deliveryByNotification.set(delivery.notificationId, delivery);
  });

  entry.notifications = [...entry.notificationById.values()]
    .filter(notification => deliveryByNotification.has(notification.id) || entry.cacheOnlyNotificationIds.has(notification.id))
    .map(notification => {
      const delivery = deliveryByNotification.get(notification.id);
      if (!delivery) return notification;
      const isRead = delivery.status === 'read' || notification.readBy.includes(entry.userId);
      return {
        ...notification,
        readBy: isRead ? [entry.userId] : [],
        inboxDeliveryId: delivery.id,
        inboxSentAt: toIso(delivery.sentAt),
      };
    })
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  entry.isLoading = false;
  entry.error = null;
  persist(entry);
  publish(entry);
}

async function applyDeliveries(
  entry: InboxEntry,
  deliveries: Delivery[],
  removedDeliveryIds: string[],
  allowNetwork: boolean,
) {
  const sequence = ++entry.sequence;
  deliveries.forEach(delivery => {
    entry.deliveryById.set(delivery.id, delivery);
    const sentAt = toDate(delivery.sentAt);
    if (sentAt && (!entry.cursor || sentAt.getTime() > new Date(entry.cursor).getTime())) {
      entry.cursor = sentAt.toISOString();
    }
  });

  removedDeliveryIds.forEach(id => {
    const delivery = entry.deliveryById.get(id);
    if (!delivery) return;
    const notificationId = typeof delivery.notificationId === 'string' ? delivery.notificationId : '';
    const notification = notificationId ? entry.notificationById.get(notificationId) : undefined;
    // Retention cleanup is deliberately database-only. A recent removal is a
    // user action, while an expired one remains in the device history cache.
    if (!notification || !isRetentionExpired(notification)) {
      entry.deliveryById.delete(id);
      if (notificationId) {
        entry.notificationById.delete(notificationId);
        entry.cacheOnlyNotificationIds.delete(notificationId);
      }
    }
  });

  const notificationIds = deliveries
    .map(delivery => typeof delivery.notificationId === 'string' ? delivery.notificationId : '')
    .filter(Boolean);
  await loadNotificationDetails(entry, notificationIds, allowNetwork);
  if (sequence !== entry.sequence) return;
  rebuildInbox(entry);
}

async function restorePersistedInbox(entry: InboxEntry) {
  const persisted = await readPersistedInbox(entry.userId);
  if (!persisted) return;
  persisted.notifications.forEach(notification => {
    entry.notificationById.set(notification.id, notification);
    entry.cacheOnlyNotificationIds.add(notification.id);
    if (notification.inboxDeliveryId) {
      entry.deliveryById.set(notification.inboxDeliveryId, {
        id: notification.inboxDeliveryId,
        notificationId: notification.id,
        method: 'in_app',
        status: notification.readBy.includes(entry.userId) ? 'read' : 'sent',
        sentAt: notification.inboxSentAt || notification.createdAt,
      });
    }
  });
  entry.cursor = persisted.cursor;
  entry.notifications = persisted.notifications;
  entry.isLoading = false;
  publish(entry);
}

function currentDeliveriesQuery(userId: string) {
  return query(
    collection(db, 'notificationDeliveries'),
    where('userId', '==', userId),
    orderBy('sentAt', 'desc'),
    limit(INBOX_PAGE_SIZE),
  );
}

async function hydrateFromFirestoreCache(entry: InboxEntry) {
  try {
    const snapshot = await getDocsFromCache(currentDeliveriesQuery(entry.userId));
    await applyDeliveries(
      entry,
      snapshot.docs.map(document => normalizeDelivery(document.id, document.data())),
      [],
      false,
    );
  } catch {
    // No cached Firestore query is normal on a first device visit.
  }
}

function startLiveInbox(entry: InboxEntry) {
  const cursorDate = entry.cursor ? new Date(entry.cursor) : null;
  const hasCursor = cursorDate && Number.isFinite(cursorDate.getTime());
  const deliveriesQuery = hasCursor
    ? query(
        collection(db, 'notificationDeliveries'),
        where('userId', '==', entry.userId),
        where('sentAt', '>=', Timestamp.fromDate(cursorDate)),
        orderBy('sentAt', 'asc'),
        limit(INBOX_PAGE_SIZE),
      )
    : currentDeliveriesQuery(entry.userId);

  entry.unsubscribe = onSnapshot(
    deliveriesQuery,
    { includeMetadataChanges: true },
    snapshot => {
      const changes = snapshot.docChanges();
      const deliveries = (changes.length ? changes : snapshot.docs.map(document => ({ type: 'added' as const, doc: document })))
        .filter(change => change.type !== 'removed')
        .map(change => normalizeDelivery(change.doc.id, change.doc.data()));
      const removed = changes
        .filter(change => change.type === 'removed')
        .map(change => change.doc.id);
      void applyDeliveries(entry, deliveries, removed, !snapshot.metadata.fromCache)
        .catch(error => {
          entry.isLoading = false;
          entry.error = error instanceof Error ? error.message : 'Unable to load notifications.';
          publish(entry);
        });
    },
    error => {
      entry.isLoading = false;
      entry.error = error.message || 'Unable to listen for notifications.';
      publish(entry);
    },
  );
}

async function startInbox(entry: InboxEntry) {
  if (entry.starting || entry.unsubscribe) return;
  entry.starting = true;
  try {
    await restorePersistedInbox(entry);
    await hydrateFromFirestoreCache(entry);
    startLiveInbox(entry);
  } finally {
    entry.starting = false;
  }
}

export function subscribeToUserNotificationInbox(
  userId: string,
  listener: (snapshot: NotificationInboxSnapshot) => void,
) {
  let entry = inboxes.get(userId);
  if (!entry) {
    entry = {
      userId,
      notifications: [],
      isLoading: true,
      error: null,
      listeners: new Set(),
      notificationById: new Map(),
      deliveryById: new Map(),
      cacheOnlyNotificationIds: new Set(),
      sequence: 0,
    };
    inboxes.set(userId, entry);
  }

  entry.listeners.add(listener);
  listener({ notifications: entry.notifications, isLoading: entry.isLoading, error: entry.error });
  void startInbox(entry);

  return () => {
    entry?.listeners.delete(listener);
    if (entry && entry.listeners.size === 0) {
      entry.unsubscribe?.();
      entry.unsubscribe = undefined;
      // Keep the hydrated entry. Returning to the page in this app session can
      // reuse it immediately; IndexedDB keeps the same history after reload.
    }
  };
}

export async function markInboxNotificationRead(userId: string, notificationId: string): Promise<boolean> {
  const entry = inboxes.get(userId);
  if (!entry) return false;
  const notification = entry.notificationById.get(notificationId);
  if (!notification || notification.readBy.includes(userId)) return Boolean(notification?.inboxDeliveryId);

  const updated = { ...notification, readBy: [userId] };
  entry.notificationById.set(notificationId, updated);
  const deliveryId = notification.inboxDeliveryId;
  if (deliveryId) {
    const delivery = entry.deliveryById.get(deliveryId);
    if (delivery) entry.deliveryById.set(deliveryId, { ...delivery, status: 'read' });
  }
  rebuildInbox(entry);

  if (!deliveryId) return false;
  try {
    await updateDoc(doc(db, 'notificationDeliveries', deliveryId), {
      status: 'read',
      readAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.warn('Unable to mark cached notification delivery as read:', error);
    return false;
  }
}

/** Remove a user-requested deletion from both the in-memory and device cache. */
export function removeInboxNotification(userId: string, notificationId: string) {
  const entry = inboxes.get(userId);
  if (!entry) return;
  entry.notificationById.delete(notificationId);
  entry.cacheOnlyNotificationIds.delete(notificationId);
  [...entry.deliveryById.entries()].forEach(([deliveryId, delivery]) => {
    if (delivery.notificationId === notificationId) entry.deliveryById.delete(deliveryId);
  });
  rebuildInbox(entry);
}
