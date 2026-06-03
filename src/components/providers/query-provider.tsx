'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// ─── QueryClient factory ────────────────────────────────────────────────────
// Created once per browser session. React Query's in-memory cache persists
// across client-side navigations (no need for localStorage persistence).
// Firestore's built-in IndexedDB offline cache (used via getDocsFromCache in
// the GlobalDataPreloader) handles cross-session persistence without blocking
// the main thread like createSyncStoragePersister did.
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data stays fresh for 5 minutes — no redundant background refetches
        staleTime: 5 * 60 * 1000,
        // Keep unused cache entries for 30 minutes
        gcTime: 30 * 60 * 1000,
        // Never refetch when the browser tab regains focus
        refetchOnWindowFocus: false,
        // Retry logic: skip retries on 4xx client errors
        retry: (failureCount, error) => {
          if (error && typeof error === 'object' && 'status' in error) {
            const status = (error as any).status as number;
            if (status >= 400 && status < 500) return false;
          }
          return failureCount < 3;
        },
      },
      mutations: { retry: false },
    },
  });
}

// ─── Singleton QueryClient ──────────────────────────────────────────────────
// Module-level singleton so SSR and client share the same instance references
// until Next.js hydrates. After hydration React's useState takes over.
let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always create a new client (no state sharing between requests)
    return makeQueryClient();
  }
  // Browser: reuse the same instance across re-renders
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

// ─── Public export ──────────────────────────────────────────────────────────
export function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState keeps the same QueryClient instance for the component lifetime.
  // getQueryClient() returns the browser singleton, so navigations don't reset
  // the in-memory cache.
  const [queryClient] = React.useState(getQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}