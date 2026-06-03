import {
  addDoc,
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

const HISTORY_COLLECTION = 'historyLogs';
const MAX_LABEL_LENGTH = 80;
const MAX_META_KEYS = 10;
const MAX_META_VALUE_LENGTH = 80;

export type HistoryAction = 'create' | 'update' | 'delete' | 'revert' | 'status';

export type HistoryActor = {
  id?: string;
  username?: string;
  role?: string;
};

export type HistoryLogInput = {
  action: HistoryAction;
  entity: string;
  recordId: string;
  label?: string;
  changedFields?: string[];
  meta?: Record<string, unknown>;
  actor?: HistoryActor;
};

export type HistoryLogRecord = {
  id: string;
  a: HistoryAction;
  e: string;
  rid: string;
  rl?: string;
  cf?: string[];
  m?: Record<string, string | number | boolean>;
  uid?: string;
  un?: string;
  ur?: string;
  ts?: Date | string;
};

export type HistorySubscriptionMeta = {
  fromCache: boolean;
  hasPendingWrites: boolean;
};

function trimText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) return undefined;
  return normalized.slice(0, maxLength);
}

function toPrimitiveMeta(meta?: Record<string, unknown>) {
  if (!meta) return undefined;

  const cleanedEntries = Object.entries(meta)
    .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
    .slice(0, MAX_META_KEYS)
    .map(([key, value]) => [
      key.slice(0, 20),
      typeof value === 'string' ? value.trim().slice(0, MAX_META_VALUE_LENGTH) : value,
    ])
    .filter(([, value]) => value !== '' && value !== undefined);

  if (cleanedEntries.length === 0) return undefined;
  return Object.fromEntries(cleanedEntries) as Record<string, string | number | boolean>;
}

function getStoredActor(): HistoryActor | undefined {
  if (typeof window === 'undefined') return undefined;

  try {
    const raw = window.localStorage.getItem('trinity_user');
    if (!raw) return undefined;

    const user = JSON.parse(raw);
    return {
      id: trimText(user?.id, 40),
      username: trimText(user?.username || `${user?.firstName || ''} ${user?.lastName || ''}`, 40),
      role: trimText(user?.role, 20),
    };
  } catch (error) {
    console.warn('Failed to read current user for history log:', error);
    return undefined;
  }
}

function mergeActor(actor?: HistoryActor): HistoryActor | undefined {
  const storedActor = getStoredActor();
  const merged = {
    id: trimText(actor?.id ?? storedActor?.id, 40),
    username: trimText(actor?.username ?? storedActor?.username, 40),
    role: trimText(actor?.role ?? storedActor?.role, 20),
  };

  if (!merged.id && !merged.username && !merged.role) {
    return undefined;
  }

  return merged;
}

/** Strip undefined/null so Firestore doesn't store empty fields */
function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null)
  );
}

function mapHistorySnapshot(snapshot: Awaited<ReturnType<typeof getDocs>>) {
  return snapshot.docs.map((docItem) => {
    const data = docItem.data() as Record<string, unknown> & {
      ts?: { toDate?: () => Date } | Date | string | Timestamp;
    };

    let resolvedTs: Date | string | undefined;
    const rawTs = data.ts;
    if (rawTs instanceof Date) {
      resolvedTs = rawTs;
    } else if (typeof rawTs === 'string') {
      resolvedTs = rawTs;
    } else if (rawTs && typeof (rawTs as any).toDate === 'function') {
      // Handles Firestore Timestamp objects (Timestamp.now() and serverTimestamp)
      resolvedTs = (rawTs as any).toDate();
    }

    return {
      id: docItem.id,
      ...data,
      ts: resolvedTs,
    } as HistoryLogRecord;
  });
}

function recentHistoryQuery(limitCount: number) {
  return query(
    collection(db, HISTORY_COLLECTION),
    orderBy('ts', 'desc'),
    limit(limitCount)
  );
}

export class HistoryLogService {
  static async log(input: HistoryLogInput): Promise<void> {
    try {
      const actor = mergeActor(input.actor);

      // ✅ KEY FIX: Use Timestamp.now() instead of serverTimestamp().
      // serverTimestamp() writes a sentinel that resolves to null locally during the
      // pending-write phase. Firestore's orderBy('ts', 'desc') EXCLUDES null-ts docs,
      // making them invisible until the server confirms the write. Timestamp.now()
      // gives every log an immediate, non-null value so it always appears in queries.
      const rawPayload = {
        a: input.action,
        e: input.entity.slice(0, 30),
        rid: input.recordId?.slice(0, 60) ?? '',
        rl: trimText(input.label, MAX_LABEL_LENGTH),
        cf: input.changedFields?.filter(Boolean).slice(0, 12),
        m: toPrimitiveMeta(input.meta),
        uid: actor?.id,
        un: actor?.username,
        ur: actor?.role,
        ts: Timestamp.now(),
      };

      // Strip undefined fields so Firestore doesn't store null keys
      const payload = stripUndefined(rawPayload as Record<string, unknown>);

      await addDoc(collection(db, HISTORY_COLLECTION), payload);
    } catch (error) {
      // Upgraded to console.error so write failures are clearly visible in DevTools
      console.error('[HistoryLog] Failed to write log entry:', error, { input });
    }
  }

  static async getRecent(limitCount = 200): Promise<HistoryLogRecord[]> {
    const snapshot = await getDocs(recentHistoryQuery(limitCount));
    return mapHistorySnapshot(snapshot);
  }

  static subscribeRecent(
    onUpdate: (logs: HistoryLogRecord[], meta: HistorySubscriptionMeta) => void,
    limitCount = 200
  ) {
    return onSnapshot(
      recentHistoryQuery(limitCount),
      (snapshot) => {
        onUpdate(mapHistorySnapshot(snapshot), {
          fromCache: snapshot.metadata.fromCache,
          hasPendingWrites: snapshot.metadata.hasPendingWrites,
        });
      },
      (error) => {
        console.error('[HistoryLog] Real-time subscription failed:', error);
      }
    );
  }

  static async getByRecord(entity: string, recordId: string, limitCount = 100): Promise<HistoryLogRecord[]> {
    const q = query(
      collection(db, HISTORY_COLLECTION),
      where('e', '==', entity),
      where('rid', '==', recordId),
      orderBy('ts', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return mapHistorySnapshot(snapshot);
  }
}
