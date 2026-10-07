import { hasAndroidOfflineBridge } from './android-bridge';
import type { AndroidOfflineSession } from './android-contracts';
import { prepareParentAppShell } from '@/lib/parent-offline/app-shell';

declare global { interface Window { trinityAndroidConnected?: boolean } }

export function isAndroidOffline() {
  return hasAndroidOfflineBridge() && (window.trinityAndroidConnected === false || !navigator.onLine);
}

export function isAndroidOfflineRoute(path: string, role?: string) {
  return role === 'Parent'
    ? ['/parent', '/parent/settings'].includes(path)
    : ['/', '/pupils', '/pupil-detail', '/timetable'].includes(path);
}

export function canOpenAndroidOfflineRoute(path: string, session: AndroidOfflineSession) {
  if (!isAndroidOfflineRoute(path, session.role)) return false;
  if (session.role === 'Parent') return true;
  return path === '/' ? session.grants.dashboard : path === '/timetable' ? session.grants.timetable : session.grants.pupils;
}

/** Save original Next pages; never copy data or credentials into HTML caches. */
export async function prepareAndroidAppShell(session: AndroidOfflineSession) {
  if (!hasAndroidOfflineBridge() || !('serviceWorker' in navigator) || isAndroidOffline()) return;
  if (session.role === 'Parent') { await prepareParentAppShell(); return; }
  const worker = (await navigator.serviceWorker.ready).active;
  if (!worker) throw new Error('The interface is still preparing.');
  const routes = ['/login', ...(session.grants.dashboard ? ['/'] : []),
    ...(session.grants.pupils ? ['/pupils', '/pupil-detail'] : []), ...(session.grants.timetable ? ['/timetable'] : [])];
  const assetUrls = performance.getEntriesByType('resource').map(entry => entry.name).filter(value => {
    const url = new URL(value, location.origin);
    return url.origin === location.origin && url.pathname.startsWith('/_next/static/');
  });
  assetUrls.push(new URL('/images/D.B%20background.png?v=1.1', location.origin).href, new URL('/trinity-logo-192.png', location.origin).href);
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); reject(new Error('The interface did not finish preparing.')); }, 60_000);
    channel.port1.onmessage = event => {
      clearTimeout(timer); channel.port1.close();
      if (event.data?.type === 'ANDROID_APP_SHELL_CACHED') resolve();
      else reject(new Error(event.data?.message || 'The interface could not be prepared.'));
    };
    worker.postMessage({ type: 'CACHE_ANDROID_APP_SHELL', routes, assetUrls }, [channel.port2]);
  });
}

/** Offline navigation loads the original HTML instead of requesting a new RSC payload. */
export function installAndroidOfflineNavigation(role: string, unavailable: () => void) {
  const originalFetch = window.fetch;
  const onClick = (event: MouseEvent) => {
    if (!isAndroidOffline() || !(event.target instanceof Element)) return;
    const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
    if (!anchor || anchor.hasAttribute('download')) return;
    const url = new URL(anchor.href, location.href);
    if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (isAndroidOfflineRoute(url.pathname, role)) location.assign(url.href);
    else unavailable();
  };
  window.fetch = async (input, init) => {
    if (isAndroidOffline()) {
      const request = input instanceof Request ? input : undefined;
      const url = new URL(request?.url || String(input), location.href);
      const headers = new Headers(init?.headers || request?.headers);
      if (url.origin === location.origin && headers.get('RSC') === '1') {
        // Hover/prefetch must never navigate or interrupt the current screen.
        if (headers.get('Next-Router-Prefetch') === '1') throw new Error('Prefetch unavailable offline.');
        if (isAndroidOfflineRoute(url.pathname, role)) {
          url.searchParams.delete('_rsc'); location.assign(url.href);
          return new Promise<Response>(() => {});
        }
        unavailable(); throw new Error('This section requires a connection.');
      }
      if (url.origin === location.origin && (init?.method || request?.method || 'GET').toUpperCase() !== 'GET') {
        unavailable(); throw new Error('Connect to make changes.');
      }
    }
    return originalFetch.call(window, input, init);
  };
  document.addEventListener('click', onClick, true);
  return () => { window.fetch = originalFetch; document.removeEventListener('click', onClick, true); };
}
