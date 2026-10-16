'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { androidOfflineRequest, hasAndroidOfflineBridge } from '@/lib/offline/android-bridge';
import { isAndroidOffline, isAndroidOfflineRoute } from '@/lib/offline/android-app-shell';
import { toast } from '@/hooks/use-toast';

const routes: Record<string, string> = {
  search: '/?openSearch=1', timetable: '/timetable', events: '/events', pupils: '/pupils', exams: '/exams',
};

/** Native warm shortcuts use the existing Next router and retain this document. */
export function AndroidShortcutNavigator() {
  const router = useRouter();
  useEffect(() => {
    if (!hasAndroidOfflineBridge()) return;
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
    // The listener must exist before native releases a queued launch request.
    void androidOfflineRequest('shortcutRouterReady', {}, 5000).catch(() => {});
    return () => window.removeEventListener('trinity-android-shortcut', navigate);
  }, [router]);
  return null;
}
