/**
 * Asynchronous, identity-scoped snapshots for large Firestore collections.
 *
 * Firestore's IndexedDB cache stores each document separately. Reconstructing a
 * large collection from hundreds of cached documents can therefore take many
 * seconds on slower devices. This cache stores the already-normalized collection
 * as one IndexedDB value, which can be restored into React Query without blocking
 * the main thread with synchronous localStorage parsing.
 *
 * Snapshots deliberately do not expire. They are only an instant starting point:
 * the existing Firestore listener remains authoritative and reconciles changes as
 * soon as Firebase Authentication and the network are available.
 */

const DATABASE_NAME = 'trinity-fast-collection-cache';
const DATABASE_VERSION = 1;
const STORE_NAME = 'snapshots';
const SNAPSHOT_VERSION = 1;

type PersistentCollectionSnapshot<T> = {
  version: number;
  writtenAt: number;
  data: T;
};

let databasePromise: Promise<IDBDatabase> | null = null;

function canUseIndexedDb(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase> {
  if (!canUseIndexedDb()) {
    return Promise.reject(new Error('IndexedDB is unavailable.'));
  }

  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };

    request.onerror = () => {
      databasePromise = null;
      reject(request.error || new Error('Could not open the collection cache.'));
    };

    request.onblocked = () => {
      databasePromise = null;
      reject(new Error('Collection cache upgrade was blocked by another tab.'));
    };
  });

  return databasePromise;
}

function completeTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error || new Error('Collection cache transaction failed.'));
    transaction.onabort = () =>
      reject(transaction.error || new Error('Collection cache transaction was aborted.'));
  });
}

export function persistentCollectionCacheKey(
  projectId: string,
  collectionName: string,
  scope: string,
): string {
  return `${projectId.trim()}::${collectionName.trim()}::${scope.trim()}`;
}

export async function readPersistentCollection<T>(key: string): Promise<T | null> {
  if (!canUseIndexedDb()) return null;

  try {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(key);

    const snapshot = await new Promise<PersistentCollectionSnapshot<T> | undefined>(
      (resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(request.error || new Error('Could not read the collection cache.'));
      },
    );
    await completeTransaction(transaction);

    if (!snapshot || snapshot.version !== SNAPSHOT_VERSION) return null;
    return snapshot.data;
  } catch {
    // Firestore remains the fallback and source of truth.
    return null;
  }
}

export async function writePersistentCollection<T>(key: string, data: T): Promise<void> {
  if (!canUseIndexedDb()) return;

  try {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(
      {
        version: SNAPSHOT_VERSION,
        writtenAt: Date.now(),
        data,
      } satisfies PersistentCollectionSnapshot<T>,
      key,
    );
    await completeTransaction(transaction);
  } catch {
    // Cache writes are an optimization. A failed write must never disrupt live data.
  }
}
