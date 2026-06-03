'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

/**
 * CacheHydrationContext
 *
 * Tracks whether the persisted React Query cache (stored in localStorage via
 * PersistQueryClientProvider) has been fully restored into the QueryClient.
 *
 * WHY THIS IS NEEDED:
 * PersistQueryClientProvider restores the cache asynchronously *after* the first
 * render. Components that read queryClient.getQueryData() during that first render
 * see empty caches and immediately fire Firestore fetches — even though 918 pupils
 * were stored in localStorage from the previous session.
 *
 * By gating GlobalDataPreloader and data hooks on isCacheReady, we avoid the
 * race condition and serve cached data instantly on the second load.
 */

interface CacheHydrationContextValue {
  isCacheReady: boolean;
  markCacheReady: () => void;
}

const CacheHydrationContext = createContext<CacheHydrationContextValue>({
  isCacheReady: false,
  markCacheReady: () => {},
});

interface CacheHydrationProviderProps {
  children: React.ReactNode;
  /**
   * Maximum ms to wait before assuming the cache is empty (no persisted data)
   * and proceeding anyway. Prevents infinite loading if localStorage is empty.
   * Default: 600ms
   */
  fallbackTimeoutMs?: number;
}

export function CacheHydrationProvider({
  children,
  fallbackTimeoutMs = 600,
}: CacheHydrationProviderProps) {
  const [isCacheReady, setIsCacheReady] = useState(false);
  const markedRef = useRef(false);

  const markCacheReady = useCallback(() => {
    if (markedRef.current) return;
    markedRef.current = true;
    setIsCacheReady(true);
  }, []);

  // Fallback: if onSuccess never fires (localStorage empty / SSR), unblock after timeout
  React.useEffect(() => {
    const timer = setTimeout(() => {
      markCacheReady();
    }, fallbackTimeoutMs);
    return () => clearTimeout(timer);
  }, [markCacheReady, fallbackTimeoutMs]);

  return (
    <CacheHydrationContext.Provider value={{ isCacheReady, markCacheReady }}>
      {children}
    </CacheHydrationContext.Provider>
  );
}

export function useCacheHydration() {
  return useContext(CacheHydrationContext);
}
