'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isNavigationPending, selectNavigationPrefetchRoutes, subscribeNavigationWork } from '@/lib/navigation/navigation-work';

/** Prepare a few permitted route shells while the mobile drawer is closed. */
export function useNavigationPrefetch(allowed: string[], current: string, scope: string, enabled: boolean, drawerOpen: boolean) {
  const router = useRouter();
  const warmed = useRef({ scope: '', routes: new Map<string, number>() });
  const [wake, setWake] = useState(0);
  if (warmed.current.scope !== scope) warmed.current = { scope, routes: new Map() };
  const allowedKey = JSON.stringify(allowed);
  const warm = useCallback((href: string) => {
    if (warmed.current.scope !== scope || !enabled || document.visibilityState !== 'visible' || !navigator.onLine || (window as Window & { trinityAndroidConnected?: boolean }).trinityAndroidConnected === false
      || !href.startsWith('/') || href.startsWith('//') || !allowed.includes(href) || href === current || isNavigationPending()) return;
    if (Date.now() - (warmed.current.routes.get(href) || 0) < 20_000) return;
    warmed.current.routes.set(href, Date.now());
    try { router.prefetch(href); } catch { warmed.current.routes.delete(href); }
  }, [allowedKey, current, enabled, router, scope]);
  useEffect(() => {
    const reconnect = () => setWake(value => value + 1);
    window.addEventListener('online', reconnect);
    window.addEventListener('trinity-android-connectivity', reconnect);
    document.addEventListener('visibilitychange', reconnect);
    const unsubscribe = subscribeNavigationWork(pending => { if (!pending) reconnect(); });
    return () => { unsubscribe(); window.removeEventListener('online', reconnect); window.removeEventListener('trinity-android-connectivity', reconnect); document.removeEventListener('visibilitychange', reconnect); };
  }, []);
  useEffect(() => {
    if (!enabled || !scope) return;
    const routes = selectNavigationPrefetchRoutes(allowed, current);
    let disposed = false, idle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const next = () => {
      if (disposed || !routes.length) return;
      const prepare = () => { idle = undefined; if (disposed) return; warm(routes.shift()!); timer = setTimeout(next, 250); };
      if ('requestIdleCallback' in window) idle = window.requestIdleCallback(prepare, { timeout: 2000 });
      else timer = setTimeout(prepare, 250);
    };
    timer = setTimeout(next, drawerOpen ? 0 : 1200);
    return () => { disposed = true; clearTimeout(timer); if (idle !== undefined) window.cancelIdleCallback(idle); };
  }, [allowedKey, current, drawerOpen, enabled, scope, wake, warm]);
  return warm;
}
