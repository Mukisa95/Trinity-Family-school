/**
 * Lightweight persistent cache for rarely-changing collections.
 *
 * WHY localStorage (not sessionStorage)?
 * - sessionStorage is wiped every time the browser window closes.
 *   So every new tab/window open was a cold start, defeating the whole purpose.
 * - localStorage survives browser restarts — data is available synchronously
 *   on the VERY FIRST render of every session.
 *
 * WHY NOT the old PersistQueryClientProvider?
 * - That persisted the ENTIRE React Query cache (918 pupils + all collections)
 *   and called JSON.stringify on every single Firestore snapshot update,
 *   blocking the main thread and freezing CSS animations system-wide.
 * - This cache is SURGICAL: only 3 small, rarely-changing collections
 *   (~50–100KB total) written ONCE when the preloader first loads them.
 *
 * Collections persisted here: academicYears, events, photos, and published
 * daily attendance summaries.
 * Each has its own TTL. Mutations must call liteInvalidate() to force refresh.
 */

const PREFIX = 'trinity_lite_';

// Per-key TTLs — set conservatively since mutations invalidate proactively
export const LITE_TTL = {
  // Academic years change maybe once a year — 7-day TTL is very safe
  academicYears: 7 * 24 * 60 * 60 * 1000,
  // Events/calendar receive a bounded safety refresh every 48 hours
  events: 48 * 60 * 60 * 1000,
  // Photos rarely change — 24-hour TTL
  photos: 24 * 60 * 60 * 1000,
  // Attendance summaries are published after a recording session and are
  // reconciled by the shared attendance revision. Keep a warm daily snapshot
  // available across reloads without turning attendance into a daily query.
  attendance: 48 * 60 * 60 * 1000,
} as const;

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  writtenAt: number;
  ttlMs: number;
  version: number; // bump this to force a global cache bust on schema changes
}

export interface LiteCacheMetadata {
  writtenAt: number;
  ttlMs: number;
}

// Increment this when the shape of cached data changes OR when detection
// logic changes require a fresh array (e.g. after fixing year ordering bugs).
// v3: Force-bust caches that stored raw Firestore Timestamps in term dates
//     instead of ISO strings, causing term dates to silently not display.
// v4: event caches are now identity/role scoped. Bust the former global event
// payload so a private staff event can never be restored into another session.
const CACHE_VERSION = 4;

function isAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/**
 * Write data to localStorage.
 * Call this from the preloader after a successful fetch.
 * The write is tiny (~50KB max) so it doesn't block the main thread.
 */
export function liteWrite<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
  if (!isAvailable() || data == null) return;
  try {
    const entry: CacheEntry<T> = {
      data,
      writtenAt: Date.now(),
      ttlMs,
      version: CACHE_VERSION,
    };
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // localStorage quota exceeded — silently ignore, fetch will still work
  }
}

/**
 * Read data synchronously from localStorage.
 * Returns null on: cache miss, expiry, version mismatch, or parse error.
 *
 * Use the return value as `initialData` in useQuery — this makes the component
 * render immediately with data instead of showing a loading spinner.
 */
export function liteRead<T>(key: string): T | null {
  if (!isAvailable()) return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;

    const entry: CacheEntry<T> = JSON.parse(raw);

    // Bust cache on schema version change
    if (entry.version !== CACHE_VERSION) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }

    // Bust cache on TTL expiry
    if (Date.now() - entry.writtenAt > entry.ttlMs) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

/** Read cache age without materialising the stored payload. */
export function liteReadMetadata(key: string): LiteCacheMetadata | null {
  if (!isAvailable()) return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry: CacheEntry<unknown> = JSON.parse(raw);
    if (entry.version !== CACHE_VERSION || Date.now() - entry.writtenAt > entry.ttlMs) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return { writtenAt: entry.writtenAt, ttlMs: entry.ttlMs };
  } catch {
    return null;
  }
}

/**
 * Remove a single cache entry.
 * Call this from mutation onSuccess handlers so stale data isn't served
 * after a create/update/delete operation.
 */
export function liteInvalidate(key: string): void {
  if (!isAvailable()) return;
  try { localStorage.removeItem(PREFIX + key); } catch { /* noop */ }
}

/** Wipe the entire lite cache (e.g. on logout). */
export function liteClearAll(): void {
  if (!isAvailable()) return;
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k));
  } catch { /* noop */ }
}

// Stable cache keys — used by preloader (write) and hooks (read)
export const LITE_KEYS = {
  photos: 'photos',
  events: 'events',
  academicYears: 'academicYears',
} as const;
