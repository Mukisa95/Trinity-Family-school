"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { setNavigationPending } from '@/lib/navigation/navigation-work';
import { measureWorkspaceStep } from '@/lib/startup/workspace-timing';
import { createForegroundClock } from '@/lib/startup/foreground-clock';
import { hasAndroidOfflineBridge } from '@/lib/offline/android-bridge';
import { claimAutomaticRouteRecovery, internalNavigationHref, navigateToRecoveryRoute, ROUTE_RECOVERY_AFTER_MS } from '@/lib/navigation/route-recovery';
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
  timedOut: boolean;
  reportContentState: (loading: boolean, href: string) => void;
  retryNavigation: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [isNavigating, setIsNavigating] = useState(false);
  const [destination, setDestination] = useState<string | null>(null);
  const [isSlow, setIsSlow] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pathname = usePathname();
  const router = useRouter();
  const previousPathname = useRef<string>('');
  const routeHistory = useRef<string[]>([]);
  const historyInitialized = useRef(false);
  const fromHref = useRef('');
  const startedAt = useRef(0);
  const active = useRef(false);
  const startedInPlace = useRef(false);
  const targetHref = useRef('');
  const routeCommitted = useRef(false);
  const contentLoading = useRef(false);

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

  const beginNavigation = useCallback((dest?: string, href?: string, inPlace = false) => {
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const target = href ? internalNavigationHref(href, window.location.href) : current;
    if (href && !target) return;
    if (!inPlace && target === current && href) {
      active.current = false;
      setNavigationPending(false); setIsNavigating(false); setDestination(null); setIsSlow(false);
      setTimedOut(false);
      return;
    }
    fromHref.current = current;
    targetHref.current = target || current;
    active.current = true;
    startedInPlace.current = inPlace;
    routeCommitted.current = false;
    contentLoading.current = false;
    startedAt.current = performance.now();
    measureWorkspaceStep('navigation:start', startedAt.current, targetHref.current);
    setNavigationPending(true);
    setIsSlow(false);
    setTimedOut(false);
    setAttempt(value => value + 1);
    setIsNavigating(true);
    setDestination(dest || null);
    previousPathname.current = pathname || '';
    
  }, [pathname]);
  const startNavigation = useCallback((dest?: string, href?: string) => beginNavigation(dest, href), [beginNavigation]);

  const stopNavigation = useCallback(() => {
    active.current = false;
    setNavigationPending(false);
    setIsNavigating(false);
    setDestination(null);
    setIsSlow(false);
    setTimedOut(false);
  }, []);

  const reportContentState = useCallback((loading: boolean, href: string) => {
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (href !== current) return;
    if (loading && !active.current) beginNavigation(undefined, current, true);
    if (!active.current) return;
    if (loading && !contentLoading.current) {
      contentLoading.current = true;
      measureWorkspaceStep('navigation:route-loading', startedAt.current, targetHref.current);
    }
    if (!loading && (startedInPlace.current || current !== fromHref.current)) {
      measureWorkspaceStep('navigation:content-ready', startedAt.current, current);
      stopNavigation();
    }
  }, [beginNavigation, stopNavigation]);

  const retryNavigation = useCallback(() => {
    if (!active.current) return;
    measureWorkspaceStep('navigation:retry', startedAt.current, targetHref.current);
    navigateToRecoveryRoute(targetHref.current);
  }, []);

  // Record internal page URLs. Using the full query string preserves
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

  // A changed URL is a route commit, not proof that its page has mounted.
  useEffect(() => {
    if (isNavigating && pathname && pathname !== previousPathname.current) {
      if (!routeCommitted.current) measureWorkspaceStep('navigation:route-commit', startedAt.current, targetHref.current);
      routeCommitted.current = true;
    }
  }, [pathname, isNavigating, stopNavigation]);

  // Preserve the busy state until content commits. Hidden time never triggers recovery.
  useEffect(() => {
    if (isNavigating) {
      const visible = () => document.visibilityState === 'visible' && !document.querySelector('[data-workspace-visible="false"]');
      const clock = createForegroundClock(performance.now(), visible());
      let timeoutRecorded = false;
      const visibility = () => clock.setVisible(performance.now(), visible());
      document.addEventListener('visibilitychange', visibility);
      const poll = setInterval(() => {
        visibility();
        const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (current !== fromHref.current && !routeCommitted.current) {
          measureWorkspaceStep('navigation:route-commit', startedAt.current, targetHref.current); routeCommitted.current = true;
        }
        const foreground = clock.sample(performance.now()).foreground;
        if (foreground >= 4000) setIsSlow(true);
        if (foreground < ROUTE_RECOVERY_AFTER_MS || timeoutRecorded) return;
        timeoutRecorded = true; setTimedOut(true);
        measureWorkspaceStep('navigation:timeout', startedAt.current, targetHref.current);
        // A full document discards a stuck router/prefetch request without deleting saved records.
        if (hasAndroidOfflineBridge() && new URL(targetHref.current, location.origin).pathname === '/pupils'
          && navigator.onLine && window.trinityAndroidConnected !== false) {
          try {
            if (claimAutomaticRouteRecovery(window.sessionStorage, targetHref.current)) {
              measureWorkspaceStep('navigation:automatic-recovery', startedAt.current, targetHref.current);
              navigateToRecoveryRoute(targetHref.current);
            }
          } catch { /* Keep the explicit retry available when storage cannot be used. */ }
        }
      }, 100);
      return () => { clearInterval(poll); document.removeEventListener('visibilitychange', visibility); };
    }
  }, [isNavigating, attempt, stopNavigation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      active.current = false;
      setNavigationPending(false);
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
    timedOut,
    reportContentState,
    retryNavigation,
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
