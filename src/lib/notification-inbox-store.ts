"use client";

import {
  collection,
  documentId,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Notification } from '@/types';

const INBOX_PAGE_SIZE = 100;
const DOCUMENT_ID_CHUNK_SIZE = 10;

export type NotificationInboxSnapshot = {
  notifications: Notification[];
  isLoading: boolean;
  error: string | null;
};

type Delivery = {
  notificationId?: unknown;
  method?: unknown;
  status?: unknown;
};

type InboxEntry = NotificationInboxSnapshot & {
  userId: string;
  unsubscribe?: Unsubscribe;
  listeners: Set<(snapshot: NotificationInboxSnapshot) => void>;
  notificationById: Map<string, Notification>;
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

function normalizeNotification(id: string, data: Record<string, any>): Notification {
  return {
    ...data,
    id,
    createdAt: toIso(data.createdAt),
    updatedAt: data.updatedAt ? toIso(data.updatedAt) : undefined,
    sentAt: data.sentAt ? toIso(data.sentAt) : undefined,
    recipients: Array.isArray(data.recipients) ? data.recipients : [],
    recipientIds: Array.isArray(data.recipientIds) ? data.recipientIds : undefined,
    readBy: Array.isArray(data.readBy) ? data.readBy : [],
  } as Notification;
}

function publish(entry: InboxEntry) {
  const snapshot: NotificationInboxSnapshot = {
    notifications: entry.notifications,
    isLoading: entry.isLoading,
    error: entry.error,
  };
  entry.listeners.forEach(listener => listener(snapshot));
}

async function applyDeliveries(entry: InboxEntry, deliveries: Delivery[]) {
  const sequence = ++entry.sequence;
  const deliveryByNotification = new Map<string, Delivery[]>();

  deliveries.forEach(delivery => {
    if (typeof delivery.notificationId !== 'string' || !delivery.notificationId) return;
    const current = deliveryByNotification.get(delivery.notificationId) ?? [];
    current.push(delivery);
    deliveryByNotification.set(delivery.notificationId, current);
  });

  const notificationIds = [...deliveryByNotification.keys()];
  const missingIds = notificationIds.filter(id => !entry.notificationById.has(id));
  for (let index = 0; index < missingIds.length; index += DOCUMENT_ID_CHUNK_SIZE) {
    const ids = missingIds.slice(index, index + DOCUMENT_ID_CHUNK_SIZE);
    const snapshots = await getDocs(query(
      collection(db, 'notifications'),
      where(documentId(), 'in', ids),
    ));
    snapshots.docs.forEach(notification => {
      entry.notificationById.set(notification.id, normalizeNotification(notification.id, notification.data()));
    });
  }

  // A newer local/server snapshot arrived while notification details were being
  // loaded. Let that newer snapshot publish instead of rendering stale state.
  if (sequence !== entry.sequence) return;

  entry.notifications = notificationIds
    .map(id => {
      const notification = entry.notificationById.get(id);
      if (!notification) return null;
      const wasRead = deliveryByNotification.get(id)?.some(delivery =>
        delivery.method === 'in_app' && delivery.status === 'read',
      );
      // The parent UI only needs this user's read state. Keep the local shape
      // user-specific so another recipient's historical `readBy` entry cannot
      // make this recipient's message look read.
      const isRead = wasRead || notification.readBy.includes(entry.userId);
      const readBy = isRead ? [entry.userId] : [];
      return { ...notification, readBy };
    })
    .filter((notification): notification is Notification => notification !== null)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  entry.isLoading = false;
  entry.error = null;
  publish(entry);
}

function startInbox(entry: InboxEntry) {
  try {
    const deliveriesQuery = query(
      collection(db, 'notificationDeliveries'),
      where('userId', '==', entry.userId),
      orderBy('sentAt', 'desc'),
      limit(INBOX_PAGE_SIZE),
    );
    entry.unsubscribe = onSnapshot(
      deliveriesQuery,
      { includeMetadataChanges: true },
      snapshot => {
        void applyDeliveries(entry, snapshot.docs.map(delivery => delivery.data() as Delivery))
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
  } catch (error) {
    entry.isLoading = false;
    entry.error = error instanceof Error ? error.message : 'Unable to start notification inbox.';
    publish(entry);
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
      sequence: 0,
    };
    inboxes.set(userId, entry);
    startInbox(entry);
  }

  entry.listeners.add(listener);
  listener({ notifications: entry.notifications, isLoading: entry.isLoading, error: entry.error });

  return () => {
    entry?.listeners.delete(listener);
    if (entry && entry.listeners.size === 0) {
      entry.unsubscribe?.();
      inboxes.delete(userId);
    }
  };
}

export function markInboxNotificationRead(userId: string, notificationId: string) {
  const entry = inboxes.get(userId);
  if (!entry) return;
  entry.notifications = entry.notifications.map(notification =>
    notification.id === notificationId && !notification.readBy.includes(userId)
      ? { ...notification, readBy: [...notification.readBy, userId] }
      : notification,
  );
  publish(entry);
}
