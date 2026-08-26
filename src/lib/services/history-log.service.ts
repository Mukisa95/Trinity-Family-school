import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  type WriteBatch,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/utils/logger';

const HISTORY_COLLECTION = 'historyLogs';
const MAX_LABEL_LENGTH = 80;
const MAX_META_KEYS = 12;
const MAX_META_VALUE_LENGTH = 120;

export type HistoryAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'revert'
  | 'status'
  | 'approve'
  | 'export'
  | 'login'
  | 'permission'
  | 'adjust';

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

export type AuditTrailInput = Omit<HistoryLogInput, 'meta'> & {
  module?: string;
  reason?: string;
  outcome?: 'success' | 'failed' | 'blocked';
  sensitive?: boolean;
  meta?: Record<string, unknown>;
};

export type ExportLogInput = {
  dataType: string;
  label?: string;
  recordCount?: number;
  format?: string;
  filters?: Record<string, unknown>;
  scope?: string;
  sensitive?: boolean;
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

function summarizeFilters(filters?: Record<string, unknown>): string | undefined {
  if (!filters) return undefined;

  const summary = Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .slice(0, 6)
    .map(([key, value]) => {
      if (Array.isArray(value)) return `${key}:${value.length} selected`;
      if (typeof value === 'object') return `${key}:set`;
      return `${key}:${String(value).slice(0, 30)}`;
    })
    .join('; ');

  return trimText(summary, MAX_META_VALUE_LENGTH);
}

function getStoredActor(): HistoryActor | undefined {
  if (typeof window === 'undefined') return undefined;

  try {
    const raw = window.localStorage.getItem('trinity_user');
    if (!raw) return undefined;

    const parsed = JSON.parse(raw);
    const user = parsed?.user || parsed;
    return {
      id: trimText(user?.id, 40),
      username: trimText(user?.username || `${user?.firstName || ''} ${user?.lastName || ''}`, 40),
      role: trimText(user?.role, 20),
    };
  } catch (error) {
    logger.warn('Failed to read current user for history log', error);
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
  private static buildPayload(input: HistoryLogInput) {
    const actor = mergeActor(input.actor);

    // Timestamp.now() keeps new entries visible to ordered local queries while
    // the batch is awaiting its server acknowledgement.
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

    return stripUndefined(rawPayload as Record<string, unknown>);
  }

  /** Add an audit entry to an existing atomic Firestore write. */
  static addToBatch(batch: WriteBatch, input: HistoryLogInput): void {
    batch.set(doc(collection(db, HISTORY_COLLECTION)), this.buildPayload(input));
  }

  static async log(input: HistoryLogInput): Promise<void> {
    try {
      const payload = this.buildPayload(input);

      await addDoc(collection(db, HISTORY_COLLECTION), payload);
    } catch (error) {
      logger.error('[HistoryLog] Failed to write log entry', { error, input });
    }
  }

  static async audit(input: AuditTrailInput): Promise<void> {
    return this.log({
      action: input.action,
      entity: input.entity,
      recordId: input.recordId,
      label: input.label,
      changedFields: input.changedFields,
      actor: input.actor,
      meta: {
        ...input.meta,
        module: input.module,
        reason: input.reason,
        outcome: input.outcome || 'success',
        sensitive: input.sensitive ?? false,
      },
    });
  }

  static async logExport(input: ExportLogInput): Promise<void> {
    const label = input.label || input.dataType;
    return this.log({
      action: 'export',
      entity: 'export',
      recordId: `${input.dataType}:${Date.now()}`,
      label,
      actor: input.actor,
      meta: {
        dataType: input.dataType,
        recordCount: input.recordCount ?? 0,
        format: input.format || '',
        filters: summarizeFilters(input.filters),
        scope: input.scope || '',
        sensitive: input.sensitive ?? true,
        outcome: 'success',
      },
    });
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
        logger.error('[HistoryLog] Real-time subscription failed', error);
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
