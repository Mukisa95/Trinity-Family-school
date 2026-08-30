const MAX_HISTORY_ENTRIES = 40;

export const SMART_BACK_HISTORY_STORAGE_KEY = 'trinity-smart-back-history-v1';

function pathnameOf(route: string): string {
  return route.split(/[?#]/, 1)[0] || '/';
}

function isNonPageRoute(route: string): boolean {
  const pathname = pathnameOf(route);
  return pathname === '/login'
    || pathname.startsWith('/api/')
    || pathname.startsWith('/_next/');
}

export function sanitizeInternalAppRoute(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) return null;

  try {
    const base = 'https://trinity.local';
    const parsed = new URL(candidate, base);
    if (parsed.origin !== base) return null;
    const route = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return isNonPageRoute(route) ? null : route;
  } catch {
    return null;
  }
}

export function normalizeSmartBackHistory(history: unknown): string[] {
  if (!Array.isArray(history)) return [];

  const normalized: string[] = [];
  history.forEach((entry) => {
    const route = sanitizeInternalAppRoute(entry);
    if (route && normalized[normalized.length - 1] !== route) normalized.push(route);
  });
  return normalized.slice(-MAX_HISTORY_ENTRIES);
}

/**
 * Add a settled app page to the tab-owned history.
 * Query-only changes replace the latest entry so filters and temporary view
 * state do not become fake pages in the back stack.
 */
export function reconcileSmartBackHistory(history: unknown, currentRoute: unknown): string[] {
  const current = sanitizeInternalAppRoute(currentRoute);
  if (!current) return pathnameOf(String(currentRoute || '')) === '/login'
    ? []
    : normalizeSmartBackHistory(history);

  const normalized = normalizeSmartBackHistory(history);
  const existingIndex = normalized.lastIndexOf(current);
  if (existingIndex >= 0) return normalized.slice(0, existingIndex + 1);

  const lastRoute = normalized[normalized.length - 1];
  if (lastRoute && pathnameOf(lastRoute) === pathnameOf(current)) {
    return [...normalized.slice(0, -1), current];
  }

  return [...normalized, current].slice(-MAX_HISTORY_ENTRIES);
}

export interface SmartBackResolution {
  target: string;
  history: string[];
  usedFallback: boolean;
}

export function resolveSmartBackTarget(
  history: unknown,
  currentRoute: unknown,
  fallbackRoute: unknown = '/',
): SmartBackResolution {
  const current = sanitizeInternalAppRoute(currentRoute) || '/';
  const normalized = reconcileSmartBackHistory(history, current);

  for (let index = normalized.length - 2; index >= 0; index -= 1) {
    const candidate = sanitizeInternalAppRoute(normalized[index]);
    if (candidate && candidate !== current) {
      return {
        target: candidate,
        history: normalized.slice(0, index + 1),
        usedFallback: false,
      };
    }
  }

  const fallback = sanitizeInternalAppRoute(fallbackRoute) || '/';
  return {
    target: fallback,
    history: fallback === current ? normalized : reconcileSmartBackHistory([], fallback),
    usedFallback: true,
  };
}
