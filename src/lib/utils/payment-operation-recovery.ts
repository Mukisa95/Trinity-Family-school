export interface PendingPaymentOperation {
  operationId: string;
  paymentDate: string;
  createdAt: string;
}

export interface PaymentOperationScope {
  kind: 'individual' | 'family';
  userId: string;
  ownerId: string;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const STORAGE_PREFIX = 'trinity:payment-operation-recovery:v1';

function encodeScopePart(value: string): string {
  return encodeURIComponent(value || 'unknown');
}

function storageKey(scope: PaymentOperationScope): string {
  return [
    STORAGE_PREFIX,
    scope.kind,
    encodeScopePart(scope.userId),
    encodeScopePart(scope.ownerId),
  ].join(':');
}

/**
 * Produces a compact storage key without persisting the payment intent itself.
 * The server still verifies the full financial payload before replaying an ID,
 * so this is only a browser-session recovery index, never an authorization or
 * financial-integrity decision.
 */
export function fingerprintPaymentOperationIntent(intent: string): string {
  let first = 0x811c9dc5;
  let second = 0x01000193;
  for (let index = 0; index < intent.length; index += 1) {
    const code = intent.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ (code + index), 0x27d4eb2d) >>> 0;
  }
  return `${first.toString(36)}-${second.toString(36)}`;
}

function getSessionStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function readEntries(storage: StorageLike, key: string): Record<string, PendingPaymentOperation> {
  try {
    const value = JSON.parse(storage.getItem(key) || '{}') as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).filter(([, candidate]) => {
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
        const record = candidate as Partial<PendingPaymentOperation>;
        return typeof record.operationId === 'string'
          && typeof record.paymentDate === 'string'
          && typeof record.createdAt === 'string';
      }),
    ) as Record<string, PendingPaymentOperation>;
  } catch {
    return {};
  }
}

function writeEntries(storage: StorageLike, key: string, entries: Record<string, PendingPaymentOperation>): void {
  try {
    if (Object.keys(entries).length === 0) {
      storage.removeItem(key);
      return;
    }
    storage.setItem(key, JSON.stringify(entries));
  } catch {
    // Private browsing or quota failures must not prevent a payment attempt.
  }
}

export function getOrCreatePendingPaymentOperation(
  scope: PaymentOperationScope,
  intent: string,
  create: () => Omit<PendingPaymentOperation, 'createdAt'>,
  storage: StorageLike | null = getSessionStorage(),
): PendingPaymentOperation {
  const fingerprint = fingerprintPaymentOperationIntent(intent);
  if (!storage) {
    return { ...create(), createdAt: new Date().toISOString() };
  }

  const key = storageKey(scope);
  const entries = readEntries(storage, key);
  const existing = entries[fingerprint];
  if (existing) return existing;

  const operation = { ...create(), createdAt: new Date().toISOString() };
  writeEntries(storage, key, { ...entries, [fingerprint]: operation });
  return operation;
}

/** Clear only after the server has confirmed the matching financial command. */
export function clearPendingPaymentOperation(
  scope: PaymentOperationScope,
  intent: string,
  storage: StorageLike | null = getSessionStorage(),
): void {
  if (!storage) return;
  const key = storageKey(scope);
  const entries = readEntries(storage, key);
  delete entries[fingerprintPaymentOperationIntent(intent)];
  writeEntries(storage, key, entries);
}
