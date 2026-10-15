// Next 15's own build identifier prevents an old open app consuming a newer
// deployment's route tree (which would make Next fall back to a full reload).
import { getAppBuildId } from 'next/dist/client/app-build-id';

export const androidRouteBuildId = () => getAppBuildId();
export function androidRouteCacheRequest(path: string, build: string) {
  return new Request(new URL(`/__trinity_saved_route/${encodeURIComponent(build)}/${encodeURIComponent(path)}`, location.origin));
}
export async function readAndroidRoute(path: string, build: string) {
  if (!build || !('caches' in window)) return undefined;
  try {
    const names = (await caches.keys()).filter(name => name.startsWith('android-app-shell-')).sort().reverse();
    for (const name of names) {
      const response = await (await caches.open(name)).match(androidRouteCacheRequest(path, build));
      if (response?.ok && response.headers.get('Content-Type')?.includes('text/x-component')) return response;
    }
  } catch {
    // Storage can be unavailable or evicted. Keep the current page usable;
    // rejecting Next's fetch would trigger its full-document fallback.
  }
}

/** A bounded cancelled transition: keep the current URL/tree instead of asking
 * Next to perform its network-error/full-document fallback. No records enter it.
 * Covered against the installed Next router, including subsequent reconnects. */
export function cancelledAndroidRoute(build: string) {
  const response = new Response(`0:${JSON.stringify({ b: build, f: [], S: false })}\n`, {
    headers: { 'Content-Type': 'text/x-component', 'x-nextjs-stale-time': '0' },
  });
  Object.defineProperties(response, { url: { value: location.href }, redirected: { value: true } });
  return response;
}
