export const ROUTE_RECOVERY_AFTER_MS = 20_000;
const RECOVERY_KEY = 'trinity_route_recovery_v1';
const RECOVERY_COOLDOWN_MS = 120_000;

export function internalNavigationHref(href: string, base: string): string | null {
  try {
    const url = new URL(href, base);
    if (url.origin !== new URL(base).origin || !['http:', 'https:'].includes(url.protocol)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return null; }
}

/** One automatic full-document recovery per route/window; unavailable storage disables it. */
export function claimAutomaticRouteRecovery(storage: Pick<Storage, 'getItem' | 'setItem'>, href: string, now = Date.now()): boolean {
  try {
    const previous = JSON.parse(storage.getItem(RECOVERY_KEY) || 'null') as { href?: string; at?: number } | null;
    if (previous?.href === href && typeof previous.at === 'number' && now - previous.at < RECOVERY_COOLDOWN_MS) return false;
    storage.setItem(RECOVERY_KEY, JSON.stringify({ href, at: now }));
    return true;
  } catch { return false; }
}

export function navigateToRecoveryRoute(href: string): void {
  const safe = internalNavigationHref(href, window.location.href);
  if (safe) window.location.assign(safe);
}
