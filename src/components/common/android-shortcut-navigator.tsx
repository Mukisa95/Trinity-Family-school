'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { androidOfflineRequest, hasAndroidOfflineBridge } from '@/lib/offline/android-bridge';
import { isAndroidOffline, isAndroidOfflineRoute } from '@/lib/offline/android-app-shell';
import { toast } from '@/hooks/use-toast';
import { sanitizeInternalAppRoute } from '@/lib/navigation/smart-back-history';

const routes: Record<string, string> = {
  search: '/?openSearch=1', timetable: '/timetable', events: '/events', pupils: '/pupils', exams: '/exams',
};

function nativeNavigationRoute(value: unknown): string | null {
  const path = sanitizeInternalAppRoute(value);
  if (path) return path;
  if (typeof value !== 'string' || value.includes('\\')) return null;
  try {
    // Android's entry intents contain full school URLs. Convert only this
    // document's origin to a router path; the shared path guard stays strict.
    const url = new URL(value);
    if (url.origin !== window.location.origin || url.username || url.password) return null;
    return sanitizeInternalAppRoute(`${url.pathname}${url.search}${url.hash}`);
  } catch {
    return null;
  }
}

/** Native warm shortcuts use the existing Next router and retain this document. */
export function AndroidShortcutNavigator() {
  const router = useRouter();
  useEffect(() => {
    if (!hasAndroidOfflineBridge()) return;
    const handled = new Set<string>();
    const navigateRequest = (event: Event) => {
      const request = (event as CustomEvent<{ requestId?: unknown; url?: unknown }>).detail;
      if (typeof request?.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(request.requestId)) return;
      const route = nativeNavigationRoute(request.url);
      if (!route) return;
      if (!handled.has(request.requestId)) {
        handled.add(request.requestId);
        if (handled.size > 40) handled.delete(handled.values().next().value!);
        if (isAndroidOffline() && !isAndroidOfflineRoute(route.split('?')[0])) {
          toast({ title: 'Connection needed', description: 'Connect to open this section.' });
          window.dispatchEvent(new Event('trinity-android-navigation-blocked'));
        } else if (route === '/?openSearch=1' && location.pathname === '/') {
          const url = new URL(location.href); url.searchParams.set('openSearch', '1');
          history.replaceState(history.state, '', url.pathname + url.search + url.hash);
          window.dispatchEvent(new Event('trinity-open-dashboard-search'));
        } else if (location.pathname + location.search + location.hash !== route) router.push(route);
      }
      void androidOfflineRequest('navigationHandled', { requestId: request.requestId }, 5000).catch(() => {});
    };
    const navigate = (event: Event) => {
      const id: unknown = (event as CustomEvent).detail;
      if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(routes, id)) return;
      if (isAndroidOffline() && !isAndroidOfflineRoute(routes[id].split('?')[0])) {
        toast({ title: 'Connection needed', description: 'Connect to open this section.' });
        window.dispatchEvent(new Event('trinity-android-navigation-blocked'));
        return;
      }
      if (id === 'search' && window.location.pathname === '/') {
        // Retain the request if authentication/header hydration is still pending.
        const url = new URL(window.location.href);
        url.searchParams.set('openSearch', '1');
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
        window.dispatchEvent(new Event('trinity-open-dashboard-search'));
      } else if (window.location.pathname + window.location.search !== routes[id]) {
        router.push(routes[id]);
      }
    };
    window.addEventListener('trinity-android-shortcut', navigate);
    window.addEventListener('trinity-android-navigate', navigateRequest);
    // The listener must exist before native releases a queued launch request.
    // Post in order without waiting for an unsupported action on older APKs.
    void androidOfflineRequest('navigationReady', {}, 5000).catch(() => {});
    void androidOfflineRequest('shortcutRouterReady', {}, 5000).catch(() => {});
    return () => {
      window.removeEventListener('trinity-android-shortcut', navigate);
      window.removeEventListener('trinity-android-navigate', navigateRequest);
    };
  }, [router]);
  return null;
}
