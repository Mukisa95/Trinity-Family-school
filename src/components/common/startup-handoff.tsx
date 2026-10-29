'use client';

import { useEffect, useState } from 'react';
import { afterStartupContentPaint, isNonLoginPublicPath, STARTUP_SCREEN_ID } from '@/lib/performance/startup-display';

/** Own only the visual handoff; authentication and data retain their owners. */
export function StartupHandoff({ pathname, authLoading, isAuthenticated, recovery = false }: { pathname: string | null; authLoading: boolean; isAuthenticated: boolean; recovery?: boolean }) {
  const publicRoute = pathname === '/login' || isNonLoginPublicPath(pathname);
  const [phase, setPhase] = useState<'visible' | 'fading' | 'complete'>(() => isNonLoginPublicPath(pathname) ? 'complete' : 'visible');
  useEffect(() => {
    if (phase !== 'visible') return;
    if (publicRoute && !isAuthenticated && !authLoading) { setPhase('complete'); return; }
    if (authLoading || !isAuthenticated || pathname === '/login') return;
    // Frontend/auth only: never wait for Firestore, React Query, cache hydration
    // or GlobalDataPreloader completion. Let the destination paint before fading.
    return afterStartupContentPaint(() => setPhase('fading'));
  }, [phase, publicRoute, isAuthenticated, authLoading, pathname]);

  useEffect(() => {
    const screen = document.getElementById(STARTUP_SCREEN_ID);
    if (!screen) return;
    screen.dataset.startupState = phase;
    screen.hidden = recovery || phase === 'complete';
  }, [phase, recovery]);

  useEffect(() => {
    if (phase !== 'fading') return;
    const timer = setTimeout(() => setPhase('complete'), 180);
    return () => clearTimeout(timer);
  }, [phase]);
  return null;
}
