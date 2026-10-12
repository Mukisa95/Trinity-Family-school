let pending = false;
const loadingContents = new Set<object>();
const listeners = new Set<(pending: boolean) => void>();

/** Shared with background providers mounted outside the navigation context. */
export function isNavigationPending() { return pending || loadingContents.size > 0; }
export function setNavigationPending(next: boolean) {
  if (pending === next) return;
  const previous = isNavigationPending();
  pending = next;
  if (previous !== isNavigationPending()) listeners.forEach(listener => listener(isNavigationPending()));
}
/** A URL commit must not release background work while its fallback is still visible. */
export function setRouteContentPending(owner: object, next: boolean) {
  const previous = isNavigationPending();
  if (next) loadingContents.add(owner); else loadingContents.delete(owner);
  if (previous !== isNavigationPending()) listeners.forEach(listener => listener(isNavigationPending()));
}
export function subscribeNavigationWork(listener: (pending: boolean) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const frequentRoutes = ['/', '/pupils', '/timetable', '/fees/collection', '/accounts/schoolpay-feed'];
export function selectNavigationPrefetchRoutes(allowed: readonly string[], current: string) {
  return frequentRoutes.filter(route => route !== current && allowed.includes(route)).slice(0, 4);
}
