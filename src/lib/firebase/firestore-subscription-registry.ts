import type { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Shares one Firestore subscription between every mounted consumer of the
 * same canonical query. It deliberately has no Firebase dependency so hooks
 * can supply their own query and data-normalisation logic.
 *
 * A shared listener is important for quota as well as speed: opening the same
 * query in two components creates two initial Firestore snapshots. Consumers
 * still receive live updates through their own React Query client cache.
 */
export type FirestoreUnsubscribe = () => void;

export interface SharedSubscriptionHandlers<T> {
  next: (data: T) => void;
  error: (error: unknown) => void;
}

export interface SharedFirestoreSubscriptionOptions<T> {
  /** Stable, identity-scoped name, for example `users:firebaseUid`. */
  key: string;
  queryClient: QueryClient;
  queryKey: QueryKey;
  subscribe: (handlers: SharedSubscriptionHandlers<T>) => FirestoreUnsubscribe;
  /**
   * Runs only when no initial listener snapshot arrives. This keeps the
   * existing recovery path without every component issuing its own getDocs.
   */
  fallback?: () => Promise<T>;
  fallbackDelayMs?: number;
  onError?: (error: unknown) => void;
}

interface SubscriptionTarget {
  queryKey: QueryKey;
  refCount: number;
}

interface SubscriptionEntry<T> {
  key: string;
  refCount: number;
  targets: Map<QueryClient, SubscriptionTarget>;
  unsubscribe: FirestoreUnsubscribe | null;
  fallback: (() => Promise<T>) | undefined;
  fallbackDelayMs: number;
  fallbackTimer: ReturnType<typeof setTimeout> | null;
  fallbackStarted: boolean;
  receivedInitialSnapshot: boolean;
  disposed: boolean;
  onError: ((error: unknown) => void) | undefined;
}

const subscriptions = new Map<string, SubscriptionEntry<unknown>>();

function publish<T>(entry: SubscriptionEntry<T>, data: T) {
  if (entry.disposed) return;

  entry.targets.forEach((target, queryClient) => {
    queryClient.setQueryData(target.queryKey, data);
  });
}

function reportError<T>(entry: SubscriptionEntry<T>, error: unknown) {
  if (entry.disposed) return;

  if (entry.onError) {
    entry.onError(error);
  } else {
    console.error(`Shared Firestore subscription failed for ${entry.key}:`, error);
  }
}

function runFallback<T>(entry: SubscriptionEntry<T>) {
  if (
    entry.disposed ||
    entry.receivedInitialSnapshot ||
    entry.fallbackStarted ||
    !entry.fallback
  ) {
    return;
  }

  entry.fallbackStarted = true;
  void entry.fallback()
    .then(data => publish(entry, data))
    .catch(error => reportError(entry, error));
}

function scheduleFallback<T>(entry: SubscriptionEntry<T>) {
  if (!entry.fallback || entry.fallbackTimer || entry.receivedInitialSnapshot) return;

  entry.fallbackTimer = setTimeout(() => {
    entry.fallbackTimer = null;
    runFallback(entry);
  }, entry.fallbackDelayMs);
}

function disposeEntry(entry: SubscriptionEntry<unknown>) {
  if (entry.disposed) return;
  entry.disposed = true;

  if (entry.fallbackTimer) {
    clearTimeout(entry.fallbackTimer);
    entry.fallbackTimer = null;
  }

  entry.unsubscribe?.();
  subscriptions.delete(entry.key);
}

/**
 * Acquire a shared subscription. The returned function must be called from a
 * React effect cleanup. The final release closes the Firebase listener.
 */
export function acquireSharedFirestoreSubscription<T>(
  options: SharedFirestoreSubscriptionOptions<T>,
): FirestoreUnsubscribe {
  let entry = subscriptions.get(options.key) as SubscriptionEntry<T> | undefined;

  if (!entry) {
    entry = {
      key: options.key,
      refCount: 0,
      targets: new Map(),
      unsubscribe: null,
      fallback: options.fallback,
      fallbackDelayMs: options.fallbackDelayMs ?? 5000,
      fallbackTimer: null,
      fallbackStarted: false,
      receivedInitialSnapshot: false,
      disposed: false,
      onError: options.onError,
    };

    subscriptions.set(options.key, entry as SubscriptionEntry<unknown>);

    try {
      entry.unsubscribe = options.subscribe({
        next: (data) => {
          if (entry?.disposed) return;
          entry.receivedInitialSnapshot = true;
          if (entry.fallbackTimer) {
            clearTimeout(entry.fallbackTimer);
            entry.fallbackTimer = null;
          }
          publish(entry, data);
        },
        error: (error) => {
          if (!entry) return;
          reportError(entry, error);
          runFallback(entry);
        },
      });
    } catch (error) {
      reportError(entry, error);
      runFallback(entry);
    }

    scheduleFallback(entry);
  } else {
    // The first owner defines the query and recovery policy. Later consumers
    // only join that exact canonical subscription.
  }

  entry.refCount += 1;
  const existingTarget = entry.targets.get(options.queryClient);
  if (existingTarget) {
    existingTarget.refCount += 1;
  } else {
    entry.targets.set(options.queryClient, {
      queryKey: options.queryKey,
      refCount: 1,
    });
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;

    const currentEntry = subscriptions.get(options.key) as SubscriptionEntry<T> | undefined;
    if (!currentEntry || currentEntry !== entry) return;

    currentEntry.refCount = Math.max(0, currentEntry.refCount - 1);
    const target = currentEntry.targets.get(options.queryClient);
    if (target) {
      target.refCount -= 1;
      if (target.refCount <= 0) currentEntry.targets.delete(options.queryClient);
    }

    if (currentEntry.refCount === 0) {
      disposeEntry(currentEntry as SubscriptionEntry<unknown>);
    }
  };
}

/** Used by authentication teardown and isolated tests. */
export function clearSharedFirestoreSubscriptions() {
  Array.from(subscriptions.values()).forEach(disposeEntry);
}

export function getSharedFirestoreSubscriptionCount() {
  return subscriptions.size;
}
