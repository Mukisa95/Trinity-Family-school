"use client";

import type { Notification } from '@/types';

export type PersistedInboxNotification = Notification & {
  inboxDeliveryId?: string;
  inboxSentAt?: string;
};

type InboxCacheRecord = {
  key: string;
  cursor?: string;
  notifications: PersistedInboxNotification[];
  updatedAt: number;
};

const DATABASE_NAME = 'trinity-notification-history';
const STORE_NAME = 'inboxes';
const VERSION = 1;

function cacheKey(userId: string) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'trinity-family-schools';
  return `${projectId}:${userId}`;
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return Promise.resolve(null);
  return new Promise(resolve => {
    const request = window.indexedDB.open(DATABASE_NAME, VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

export async function readPersistedInbox(userId: string): Promise<InboxCacheRecord | null> {
  const database = await openDatabase();
  if (!database) return null;
  return new Promise(resolve => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(cacheKey(userId));
    request.onsuccess = () => resolve((request.result as InboxCacheRecord | undefined) || null);
    request.onerror = () => resolve(null);
  });
}

export async function writePersistedInbox(
  userId: string,
  notifications: PersistedInboxNotification[],
  cursor?: string,
): Promise<void> {
  const database = await openDatabase();
  if (!database) return;
  await new Promise<void>(resolve => {
    const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put({
      key: cacheKey(userId),
      cursor,
      notifications,
      updatedAt: Date.now(),
    } satisfies InboxCacheRecord);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
}
