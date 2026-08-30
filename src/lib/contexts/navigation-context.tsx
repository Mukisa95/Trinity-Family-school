"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  SMART_BACK_HISTORY_STORAGE_KEY,
  normalizeSmartBackHistory,
  reconcileSmartBackHistory,
  resolveSmartBackTarget,
} from '@/lib/navigation/smart-back-history';

interface NavigationContextType {
  isNavigating: boolean;
  startNavigation: (destination?: string) => void;
  stopNavigation: () => void;
  goBack: (fallbackHref?: string) => void;
  currentPath: string;
  destination: string | null;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [isNavigating, setIsNavigating] = useState(false);
  const [destination, setDestination] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const previousPathname = useRef<string>('');
  const navigationTimeout = useRef<NodeJS.Timeout | null>(null);
  const routeHistory = useRef<string[]>([]);
  const historyInitialized = useRef(false);

  const persistRouteHistory = useCallback((history: string[]) => {
    routeHistory.current = history;
    try {
      window.sessionStorage.setItem(SMART_BACK_HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Navigation still works with the in-memory history when storage is unavailable.
    }
  }, []);

  const readStoredRouteHistory = useCallback(() => {
    if (historyInitialized.current) return routeHistory.current;
    historyInitialized.current = true;
    try {
      const stored = JSON.parse(window.sessionStorage.getItem(SMART_BACK_HISTORY_STORAGE_KEY) || '[]');
      routeHistory.current = normalizeSmartBackHistory(stored);
    } catch {
      routeHistory.current = [];
    }
    return routeHistory.current;
  }, []);

  const startNavigation = useCallback((dest?: string) => {
    setIsNavigating(true);
    setDestination(dest || null);
    previousPathname.current = pathname || '';
    
    // Clear any existing timeout
    if (navigationTimeout.current) {
      clearTimeout(navigationTimeout.current);
    }
  }, [pathname]);

  const stopNavigation = useCallback(() => {
    setIsNavigating(false);
    setDestination(null);
    if (navigationTimeout.current) {
      clearTimeout(navigationTimeout.current);
      navigationTimeout.current = null;
    }
  }, []);

  // Record settled, internal page URLs. Using the full query string preserves
  // entity context such as /pupil-detail?id=... without trusting browser/tab
  // history entries that may belong to another website or an old redirect.
  useEffect(() => {
    if (!pathname) return;
    const currentRoute = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const nextHistory = reconcileSmartBackHistory(readStoredRouteHistory(), currentRoute);
    persistRouteHistory(nextHistory);
  }, [pathname, persistRouteHistory, readStoredRouteHistory]);

  const goBack = useCallback((fallbackHref = '/') => {
    const currentRoute = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const resolution = resolveSmartBackTarget(readStoredRouteHistory(), currentRoute, fallbackHref);
    persistRouteHistory(resolution.history);
    if (resolution.target === currentRoute) return;

    startNavigation(resolution.target);
    // Replace the current page instead of pushing a synthetic back entry. This
    // avoids A -> B -> A -> B loops while still restoring the exact prior URL.
    router.replace(resolution.target);
  }, [persistRouteHistory, readStoredRouteHistory, router, startNavigation]);

  // Stop navigation immediately when pathname changes (page has loaded)
  useEffect(() => {
    if (isNavigating && pathname && pathname !== previousPathname.current) {
      // Stop navigation immediately for instant page transitions
      setIsNavigating(false);
      setDestination(null);
      if (navigationTimeout.current) {
        clearTimeout(navigationTimeout.current);
        navigationTimeout.current = null;
      }
    }
  }, [pathname, isNavigating]);

  // Fallback: stop navigation after 3 seconds maximum
  useEffect(() => {
    if (isNavigating) {
      const maxTimer = setTimeout(() => {
        console.warn('Navigation timeout reached, forcing stop');
        setIsNavigating(false);
        setDestination(null);
        if (navigationTimeout.current) {
          clearTimeout(navigationTimeout.current);
          navigationTimeout.current = null;
        }
      }, 3000);
      
      return () => clearTimeout(maxTimer);
    }
  }, [isNavigating]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (navigationTimeout.current) {
        clearTimeout(navigationTimeout.current);
      }
    };
  }, []);

  const value: NavigationContextType = {
    isNavigating,
    startNavigation,
    stopNavigation,
    goBack,
    currentPath: pathname || '',
    destination,
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
