"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { setNavigationPending } from '@/lib/navigation/navigation-work';
import { measureWorkspaceStep } from '@/lib/startup/workspace-timing';
import { internalNavigationHref } from '@/lib/navigation/route-recovery';
import {
  SMART_BACK_HISTORY_STORAGE_KEY,
  normalizeSmartBackHistory,
  reconcileSmartBackHistory,
  resolveSmartBackTarget,
} from '@/lib/navigation/smart-back-history';

interface NavigationContextType {
  isNavigating: boolean;
  startNavigation: (destination?: string, href?: string) => void;
  stopNavigation: () => void;
  goBack: (fallbackHref?: string) => void;
  currentPath: string;
  destination: string | null;
  isSlow: boolean;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [isNavigating, setIsNavigating] = useState(false);
  const [destination, setDestination] = useState<string | null>(null);
  const [isSlow, setIsSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pathname = usePathname();
  const router = useRouter();
  const previousPathname = useRef<string>('');
  const navigationTimeout = useRef<NodeJS.Timeout | null>(null);
  const routeHistory = useRef<string[]>([]);
  const historyInitialized = useRef(false);
  const fromHref = useRef('');
  const startedAt = useRef(0);

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

  const startNavigation = useCallback((dest?: string, href?: string) => {
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const target = href ? internalNavigationHref(href, window.location.href) : undefined;
    if (href && !target) return;
    if (target === current) {
      setNavigationPending(false); setIsNavigating(false); setDestination(null); setIsSlow(false);
      return;
    }
    fromHref.current = current;
    startedAt.current = performance.now();
    measureWorkspaceStep('navigation:start', startedAt.current, target ?? undefined);
    setNavigationPending(true);
    setIsSlow(false);
    setAttempt(value => value + 1);
    setIsNavigating(true);
    setDestination(dest || null);
    previousPathname.current = pathname || '';

    // Clear any existing timeout
    if (navigationTimeout.current) {
      clearTimeout(navigationTimeout.current);
    }
  }, [pathname]);

  const stopNavigation = useCallback(() => {
    setNavigationPending(false);
    setIsNavigating(false);
    setDestination(null);
    setIsSlow(false);
    if (navigationTimeout.current) {
      clearTimeout(navigationTimeout.current);
      navigationTimeout.current = null;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('trinity-android-navigation-blocked', stopNavigation);
    return () => window.removeEventListener('trinity-android-navigation-blocked', stopNavigation);
  }, [stopNavigation]);

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

    startNavigation(resolution.target, resolution.target);
    // Replace the current page instead of pushing a synthetic back entry. This
    // avoids A -> B -> A -> B loops while still restoring the exact prior URL.
    router.replace(resolution.target);
  }, [persistRouteHistory, readStoredRouteHistory, router, startNavigation]);

  // Release the transition UI when the destination route commits. Page data
  // readiness must never restart navigation or make cached records inert.
  useEffect(() => {
    if (isNavigating && pathname && pathname !== previousPathname.current) {
      // Stop navigation immediately for instant page transitions
      measureWorkspaceStep('navigation:route-commit', startedAt.current);
      stopNavigation();
      if (navigationTimeout.current) {
        clearTimeout(navigationTimeout.current);
        navigationTimeout.current = null;
      }
    }
  }, [pathname, isNavigating, stopNavigation]);

  // Keep truthful progress through slower transitions; also detect same-path
  // query changes, which pathname alone cannot observe.
  useEffect(() => {
    if (isNavigating) {
      const poll = setInterval(() => {
        const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (current !== fromHref.current) { measureWorkspaceStep('navigation:route-commit', startedAt.current); stopNavigation(); }
      }, 100);
      const slowTimer = setTimeout(() => setIsSlow(true), 4000);
      const maxTimer = setTimeout(() => {
        measureWorkspaceStep('navigation:timeout', startedAt.current);
        stopNavigation();
        if (navigationTimeout.current) {
          clearTimeout(navigationTimeout.current);
          navigationTimeout.current = null;
        }
      }, 30_000);

      return () => { clearInterval(poll); clearTimeout(slowTimer); clearTimeout(maxTimer); };
    }
  }, [isNavigating, attempt, stopNavigation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setNavigationPending(false);
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
    isSlow,
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
