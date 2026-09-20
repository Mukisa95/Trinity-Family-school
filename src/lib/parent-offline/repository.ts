import type { Account, AttendanceRecord, Loan, Pupil, Transaction } from '@/types';
import {
  PARENT_OFFLINE_ATTENDANCE_SCHEMA,
  PARENT_OFFLINE_BANKING_SCHEMA,
  PARENT_OFFLINE_FAMILY_SCHEMA,
  PARENT_OFFLINE_FEES_SCHEMA,
  PARENT_OFFLINE_RESULTS_SCHEMA,
  isParentOfflineAttendanceSnapshot,
  isParentOfflineBankingSnapshot,
  isParentOfflineFamilySnapshot,
  isParentOfflineFeesSnapshot,
  isParentOfflineResultsSnapshot,
  parentOfflineAttendanceKey,
  parentOfflineBankingKey,
  parentOfflineFeesKey,
  parentOfflineResultsKey,
  type ParentOfflineAttendanceSnapshot,
  type ParentOfflineBankingSnapshot,
  type ParentOfflineFamilySnapshot,
  type ParentOfflineFamilyStatus,
  type ParentOfflineFeeDisplay,
  type ParentOfflineFeesSnapshot,
  type ParentOfflineResultsSnapshot,
  type ParentReleasedResult,
} from './contracts';

const DATABASE_NAME = 'trinity-parent-dashboard';
const DATABASE_VERSION = 5;
const FAMILY_STORE = 'familySnapshots';
const BANKING_STORE = 'bankingSnapshots';
const ATTENDANCE_STORE = 'attendanceSnapshots';
const RESULTS_STORE = 'resultsSnapshots';
const FEES_STORE = 'feesSnapshots';
const CHANGE_EVENT = 'trinity-parent-offline-changed';

function canUseOfflineStorage() {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase> {
  if (!canUseOfflineStorage()) {
    return Promise.reject(new Error('This browser cannot save parent information for offline use.'));
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(FAMILY_STORE)) {
        request.result.createObjectStore(FAMILY_STORE, { keyPath: 'accountId' });
      }
      let bankingStore: IDBObjectStore;
      if (!request.result.objectStoreNames.contains(BANKING_STORE)) {
        bankingStore = request.result.createObjectStore(BANKING_STORE, { keyPath: 'key' });
      } else {
        bankingStore = request.transaction!.objectStore(BANKING_STORE);
      }
      if (!bankingStore.indexNames.contains('accountId')) {
        bankingStore.createIndex('accountId', 'accountId', { unique: false });
      }
      let attendanceStore: IDBObjectStore;
      if (!request.result.objectStoreNames.contains(ATTENDANCE_STORE)) {
        attendanceStore = request.result.createObjectStore(ATTENDANCE_STORE, { keyPath: 'key' });
      } else {
        attendanceStore = request.transaction!.objectStore(ATTENDANCE_STORE);
      }
      if (!attendanceStore.indexNames.contains('accountId')) {
        attendanceStore.createIndex('accountId', 'accountId', { unique: false });
      }
      let resultsStore: IDBObjectStore;
      if (!request.result.objectStoreNames.contains(RESULTS_STORE)) {
        resultsStore = request.result.createObjectStore(RESULTS_STORE, { keyPath: 'key' });
      } else {
        resultsStore = request.transaction!.objectStore(RESULTS_STORE);
      }
      if (!resultsStore.indexNames.contains('accountId')) {
        resultsStore.createIndex('accountId', 'accountId', { unique: false });
      }
      let feesStore: IDBObjectStore;
      if (!request.result.objectStoreNames.contains(FEES_STORE)) {
        feesStore = request.result.createObjectStore(FEES_STORE, { keyPath: 'key' });
      } else {
        feesStore = request.transaction!.objectStore(FEES_STORE);
      }
      if (!feesStore.indexNames.contains('accountId')) {
        feesStore.createIndex('accountId', 'accountId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open parent offline storage.'));
    request.onblocked = () => reject(new Error('Parent offline storage is busy in another tab.'));
  });
}

function complete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error('Parent offline storage was cancelled.'));
    transaction.onerror = () => reject(transaction.error || new Error('Parent offline storage failed.'));
  });
}

function readRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not read parent offline storage.'));
  });
}

function notify(accountId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { accountId } }));
}

function uniquePupils(pupils: Pupil[]) {
  const byId = new Map<string, Pupil>();
  pupils.forEach(pupil => {
    if (pupil?.id) byId.set(pupil.id, pupil);
  });
  return Array.from(byId.values());
}

function byteLength(value: unknown) {
  return new Blob([JSON.stringify(value)]).size;
}

export function isParentOfflineStorageAvailable() {
  return canUseOfflineStorage();
}

export async function readParentOfflineFamily(
  accountId: string,
): Promise<ParentOfflineFamilySnapshot | null> {
  if (!accountId || !canUseOfflineStorage()) return null;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(FAMILY_STORE, 'readonly');
    const stored = await readRequest(transaction.objectStore(FAMILY_STORE).get(accountId));
    await complete(transaction);
    return isParentOfflineFamilySnapshot(stored, accountId) ? stored : null;
  } finally {
    database.close();
  }
}

/**
 * Called by the real parent layout after its existing authorized family query
 * has produced data. It never starts a Firestore query itself.
 */
export async function saveParentOfflineFamily({
  accountId,
  familyId,
  pupils,
}: {
  accountId: string;
  familyId?: string;
  pupils: Pupil[];
}): Promise<ParentOfflineFamilySnapshot> {
  if (!accountId) throw new Error('A signed-in parent account is required before information can be saved.');
  if (!canUseOfflineStorage()) throw new Error('This browser cannot save parent information for offline use.');

  const snapshot: ParentOfflineFamilySnapshot = {
    schema: PARENT_OFFLINE_FAMILY_SCHEMA,
    accountId,
    familyId,
    preparedAt: new Date().toISOString(),
    pupils: uniquePupils(pupils),
  };
  const database = await openDatabase();
  try {
    const transaction = database.transaction(FAMILY_STORE, 'readwrite');
    transaction.objectStore(FAMILY_STORE).put(snapshot);
    await complete(transaction);
  } finally {
    database.close();
  }
  notify(accountId);
  return snapshot;
}

export async function getParentOfflineFamilyStatus(
  accountId: string,
): Promise<ParentOfflineFamilyStatus | null> {
  const snapshot = await readParentOfflineFamily(accountId);
  if (!snapshot) return null;
  return {
    preparedAt: snapshot.preparedAt,
    pupilCount: snapshot.pupils.length,
    byteLength: byteLength(snapshot),
  };
}

export async function readParentOfflineBanking(
  accountId: string,
  pupilId: string,
): Promise<ParentOfflineBankingSnapshot | null> {
  if (!accountId || !pupilId || !canUseOfflineStorage()) return null;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(BANKING_STORE, 'readonly');
    const stored = await readRequest(transaction.objectStore(BANKING_STORE).get(parentOfflineBankingKey(accountId, pupilId)));
    await complete(transaction);
    return isParentOfflineBankingSnapshot(stored, accountId, pupilId) ? stored : null;
  } finally {
    database.close();
  }
}

/**
 * Saves only a complete response from the parent-only banking endpoint. A
 * network failure is never written as an empty account or an empty history.
 */
export async function saveParentOfflineBanking({
  accountId,
  pupilId,
  revision,
  account,
  transactions,
  loans,
}: {
  accountId: string;
  pupilId: string;
  revision: number;
  account: Account | null;
  transactions: Transaction[];
  loans: Loan[];
}): Promise<ParentOfflineBankingSnapshot> {
  if (!accountId || !pupilId) throw new Error('A signed-in parent and pupil are required before banking information can be saved.');
  if (!canUseOfflineStorage()) throw new Error('This browser cannot save parent information for offline use.');

  const snapshot: ParentOfflineBankingSnapshot = {
    schema: PARENT_OFFLINE_BANKING_SCHEMA,
    key: parentOfflineBankingKey(accountId, pupilId),
    accountId,
    pupilId,
    revision,
    preparedAt: new Date().toISOString(),
    account,
    transactions,
    loans,
  };
  const database = await openDatabase();
  try {
    const transaction = database.transaction(BANKING_STORE, 'readwrite');
    transaction.objectStore(BANKING_STORE).put(snapshot);
    await complete(transaction);
  } finally {
    database.close();
  }
  notify(accountId);
  return snapshot;
}

export async function readParentOfflineAttendance(
  accountId: string,
  pupilId: string,
): Promise<ParentOfflineAttendanceSnapshot | null> {
  if (!accountId || !pupilId || !canUseOfflineStorage()) return null;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(ATTENDANCE_STORE, 'readonly');
    const stored = await readRequest(transaction.objectStore(ATTENDANCE_STORE).get(parentOfflineAttendanceKey(accountId, pupilId)));
    await complete(transaction);
    return isParentOfflineAttendanceSnapshot(stored, accountId, pupilId) ? stored : null;
  } finally {
    database.close();
  }
}

export async function saveParentOfflineAttendance({
  accountId,
  pupilId,
  revision,
  records,
}: {
  accountId: string;
  pupilId: string;
  revision: number;
  records: AttendanceRecord[];
}): Promise<ParentOfflineAttendanceSnapshot> {
  if (!accountId || !pupilId) throw new Error('A signed-in parent and pupil are required before attendance can be saved.');
  if (!canUseOfflineStorage()) throw new Error('This browser cannot save parent information for offline use.');
  const snapshot: ParentOfflineAttendanceSnapshot = {
    schema: PARENT_OFFLINE_ATTENDANCE_SCHEMA,
    key: parentOfflineAttendanceKey(accountId, pupilId),
    accountId,
    pupilId,
    revision,
    preparedAt: new Date().toISOString(),
    records,
  };
  const database = await openDatabase();
  try {
    const transaction = database.transaction(ATTENDANCE_STORE, 'readwrite');
    transaction.objectStore(ATTENDANCE_STORE).put(snapshot);
    await complete(transaction);
  } finally {
    database.close();
  }
  notify(accountId);
  return snapshot;
}

export async function readParentOfflineResults(
  accountId: string,
  pupilId: string,
): Promise<ParentOfflineResultsSnapshot | null> {
  if (!accountId || !pupilId || !canUseOfflineStorage()) return null;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(RESULTS_STORE, 'readonly');
    const stored = await readRequest(transaction.objectStore(RESULTS_STORE).get(parentOfflineResultsKey(accountId, pupilId)));
    await complete(transaction);
    return isParentOfflineResultsSnapshot(stored, accountId, pupilId) ? stored : null;
  } finally {
    database.close();
  }
}

export async function saveParentOfflineResults({
  accountId,
  pupilId,
  revision,
  results,
}: {
  accountId: string;
  pupilId: string;
  revision: number;
  results: ParentReleasedResult[];
}): Promise<ParentOfflineResultsSnapshot> {
  if (!accountId || !pupilId) throw new Error('A signed-in parent and pupil are required before results can be saved.');
  if (!canUseOfflineStorage()) throw new Error('This browser cannot save parent information for offline use.');
  const snapshot: ParentOfflineResultsSnapshot = {
    schema: PARENT_OFFLINE_RESULTS_SCHEMA,
    key: parentOfflineResultsKey(accountId, pupilId),
    accountId,
    pupilId,
    revision,
    preparedAt: new Date().toISOString(),
    results,
  };
  const database = await openDatabase();
  try {
    const transaction = database.transaction(RESULTS_STORE, 'readwrite');
    transaction.objectStore(RESULTS_STORE).put(snapshot);
    await complete(transaction);
  } finally {
    database.close();
  }
  notify(accountId);
  return snapshot;
}

export async function readParentOfflineFees(
  accountId: string,
  pupilId: string,
  academicYearId: string,
  termId: string,
): Promise<ParentOfflineFeesSnapshot | null> {
  if (!accountId || !pupilId || !academicYearId || !termId || !canUseOfflineStorage()) return null;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(FEES_STORE, 'readonly');
    const stored = await readRequest(transaction.objectStore(FEES_STORE).get(parentOfflineFeesKey(accountId, pupilId, academicYearId, termId)));
    await complete(transaction);
    return isParentOfflineFeesSnapshot(stored, accountId, pupilId, academicYearId, termId) ? stored : null;
  } finally {
    database.close();
  }
}

export async function saveParentOfflineFees({
  accountId,
  pupilId,
  academicYearId,
  termId,
  fees,
  totals,
}: {
  accountId: string;
  pupilId: string;
  academicYearId: string;
  termId: string;
  fees: ParentOfflineFeeDisplay[];
  totals: ParentOfflineFeesSnapshot['totals'];
}): Promise<ParentOfflineFeesSnapshot> {
  if (!accountId || !pupilId || !academicYearId || !termId) throw new Error('A parent, pupil, academic year, and term are required before fees can be saved.');
  if (!canUseOfflineStorage()) throw new Error('This browser cannot save parent information for offline use.');
  const snapshot: ParentOfflineFeesSnapshot = {
    schema: PARENT_OFFLINE_FEES_SCHEMA,
    key: parentOfflineFeesKey(accountId, pupilId, academicYearId, termId),
    accountId,
    pupilId,
    academicYearId,
    termId,
    preparedAt: new Date().toISOString(),
    fees,
    totals,
  };
  const database = await openDatabase();
  try {
    const transaction = database.transaction(FEES_STORE, 'readwrite');
    transaction.objectStore(FEES_STORE).put(snapshot);
    await complete(transaction);
  } finally {
    database.close();
  }
  notify(accountId);
  return snapshot;
}

function deleteSnapshotsForAccount(store: IDBObjectStore, accountId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = store.index('accountId').openCursor(IDBKeyRange.only(accountId));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      cursor.delete();
      cursor.continue();
    };
    request.onerror = () => reject(request.error || new Error('Could not remove saved banking information.'));
  });
}

export async function removeParentOfflineAccount(accountId: string): Promise<void> {
  if (!accountId || !canUseOfflineStorage()) return;
  const database = await openDatabase();
  try {
    const transaction = database.transaction([FAMILY_STORE, BANKING_STORE, ATTENDANCE_STORE, RESULTS_STORE, FEES_STORE], 'readwrite');
    transaction.objectStore(FAMILY_STORE).delete(accountId);
    await Promise.all([
      deleteSnapshotsForAccount(transaction.objectStore(BANKING_STORE), accountId),
      deleteSnapshotsForAccount(transaction.objectStore(ATTENDANCE_STORE), accountId),
      deleteSnapshotsForAccount(transaction.objectStore(RESULTS_STORE), accountId),
      deleteSnapshotsForAccount(transaction.objectStore(FEES_STORE), accountId),
    ]);
    await complete(transaction);
  } finally {
    database.close();
  }
  notify(accountId);
}

export function subscribeToParentOfflineChanges(
  accountId: string,
  listener: () => void,
) {
  if (typeof window === 'undefined') return () => undefined;
  const handleChange = (event: Event) => {
    if ((event as CustomEvent<{ accountId?: string }>).detail?.accountId === accountId) listener();
  };
  window.addEventListener(CHANGE_EVENT, handleChange);
  return () => window.removeEventListener(CHANGE_EVENT, handleChange);
}
