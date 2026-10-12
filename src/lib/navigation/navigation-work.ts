let pending = false;
const listeners = new Set<(pending: boolean) => void>();

/** Shared with background providers mounted outside the navigation context. */
export function isNavigationPending() { return pending; }
export function setNavigationPending(next: boolean) {
  if (pending === next) return;
  pending = next;
  listeners.forEach(listener => listener(next));
}
export function subscribeNavigationWork(listener: (pending: boolean) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const frequentRoutes = ['/', '/pupils', '/timetable', '/fees/collection', '/accounts/schoolpay-feed'];
export function selectNavigationPrefetchRoutes(allowed: readonly string[], current: string) {
  return frequentRoutes.filter(route => route !== current && allowed.includes(route)).slice(0, 4);
}
