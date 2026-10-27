import { androidRouteBuildId, readAndroidRoute, cancelledAndroidRoute } from './android-route-cache';
import { hasOfflineWorkspace } from './workspace-bridge';
import type { AndroidOfflineSession } from './android-contracts';
import { prepareParentAppShell } from '@/lib/parent-offline/app-shell';

declare global { interface Window { trinityAndroidConnected?: boolean } }

export function isAndroidOffline() {
  return hasOfflineWorkspace() && (window.trinityAndroidConnected === false || !navigator.onLine);
}

export function isAndroidOfflineRoute(path: string, role?: string) {
  return role === 'Parent'
    ? ['/parent', '/parent/settings'].includes(path)
    : ['/', '/pupils', '/pupil-detail', '/timetable', '/events', '/duty-service', '/settings/account', '/settings/app'].includes(path);
}

export function canOpenAndroidOfflineRoute(path: string, session: AndroidOfflineSession) {
  if (!isAndroidOfflineRoute(path, session.role)) return false;
  if (session.role === 'Parent') return true;
  if (path === '/settings/account' || path === '/settings/app') return true;
  return path === '/duty-service' ? !!session.grants.dutyService : path === '/events' ? !!session.grants.events : path === '/' ? session.grants.dashboard : path === '/timetable' ? session.grants.timetable : session.grants.pupils;
}

function samePage(url: URL) {
  const current = new URL(location.href);
  const query = (value: URL) => {
    const params = new URLSearchParams(value.search);
    params.delete('_rsc');
    params.sort();
    return params.toString();
  };
  return url.pathname === current.pathname && query(url) === query(current);
}

function isRoutePrefetch(headers: Headers) {
  return headers.has('Next-Router-Prefetch') || headers.has('Next-Router-Segment-Prefetch')
    || /\bprefetch\b/i.test(`${headers.get('Purpose') || ''} ${headers.get('Sec-Purpose') || ''}`);
}

/** Save original Next pages; never copy data or credentials into HTML caches. */
export async function prepareAndroidAppShell(session: AndroidOfflineSession) {
  if (!hasOfflineWorkspace() || !('serviceWorker' in navigator) || isAndroidOffline()) return;
  if (session.role === 'Parent') await prepareParentAppShell();
  const worker = (await navigator.serviceWorker.ready).active;
  if (!worker) throw new Error('The interface is still preparing.');
  const routes = session.role === 'Parent' ? ['/login', '/', '/parent', '/parent/settings'] : ['/login', '/settings/account', '/settings/app', ...(session.grants.dashboard ? ['/'] : []),
    ...(session.grants.pupils ? ['/pupils', '/pupil-detail'] : []), ...(session.grants.timetable ? ['/timetable'] : []), ...(session.grants.events ? ['/events'] : []), ...(session.grants.dutyService ? ['/duty-service'] : [])];
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
    worker.postMessage({ type: 'CACHE_ANDROID_APP_SHELL', routes, assetUrls, navigation: true, cacheDocuments: true }, [channel.port2]);
  });
}

/** Saved Next route trees keep the existing app/layout/session mounted offline. */
export function installAndroidOfflineNavigation(role: string, unavailable: () => void, options: {
  navigate?: (href: string) => void;
  buildId?: () => string;
} = {}) {
  const originalFetch = window.fetch;
  const buildId = options.buildId || androidRouteBuildId;
  let disposed = false;
  const blocked = () => { unavailable(); window.dispatchEvent(new Event('trinity-android-navigation-blocked')); };
  const onClick = (event: MouseEvent) => {
    if (!isAndroidOffline() || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
    const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
    if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
    const url = new URL(anchor.href, location.href);
    if (url.origin !== location.origin) return;
    if (!isAndroidOfflineRoute(url.pathname, role)) { event.preventDefault(); event.stopImmediatePropagation(); blocked(); return; }
    // Next Links and plain anchors both use the same client router after the
    // saved interface is confirmed. A missing download leaves this page usable.
    if (options.navigate) {
      event.preventDefault(); event.stopImmediatePropagation();
      void readAndroidRoute(url.pathname, buildId()).then(saved => {
        if (disposed) return;
        if (!isAndroidOffline() || saved) options.navigate?.(url.pathname + url.search + url.hash);
        else blocked();
      }).catch(() => { if (!disposed) blocked(); });
    }
  };
  window.fetch = async (input, init) => {
    if (isAndroidOffline()) {
      const request = input instanceof Request ? input : undefined;
      const url = new URL(request?.url || String(input), location.href);
      const headers = new Headers(init?.headers || request?.headers);
      if (url.origin === location.origin && headers.get('RSC') === '1') {
        if (isAndroidOfflineRoute(url.pathname, role)) {
          const saved = await readAndroidRoute(url.pathname, buildId());
          if (saved) return saved;
        }
        // Refreshing the mounted page and speculative downloads are background
        // work. Keep its current tree without presenting a navigation failure.
        if (!isRoutePrefetch(headers)) {
          if (!samePage(url)) blocked();
          else window.dispatchEvent(new Event('trinity-android-navigation-blocked'));
        }
        return cancelledAndroidRoute(buildId());
      }
      if (url.origin === location.origin && (init?.method || request?.method || 'GET').toUpperCase() !== 'GET') {
        // User actions have their own mutation guards. A background POST must
        // not create a reconnect toast over an otherwise usable workspace.
        throw new Error('Connect to make changes.');
      }
    }
    return originalFetch.call(window, input, init);
  };
  document.addEventListener('click', onClick, true);
  return () => { disposed = true; window.fetch = originalFetch; document.removeEventListener('click', onClick, true); };
}
