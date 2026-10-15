import { sanitizeAuditRoute } from '@/lib/operational-audit/core';
let pupilsPaintRecorded = false;

/** Named elapsed times and a sanitized route; no account IDs or private records. */
export function measureWorkspaceStep(name: string, startedAt: number, route?: string): void {
  if (typeof performance === 'undefined') return;
  measureWorkspaceDuration(name, performance.now() - startedAt, startedAt, route);
}

/** Active durations can span background pauses; preserve their actual observation window. */
export function measureWorkspaceDuration(name: string, duration: number, startedAt = performance.now() - duration, route?: string): void {
  if (typeof performance === 'undefined') return;
  try {
    performance.measure(`trinity:workspace:${name}`, { start: startedAt, duration: Math.max(0, duration),
      detail: { route: sanitizeAuditRoute(route || (typeof location === 'undefined' ? '/' : location.pathname)), observedEnd: performance.now() } });
    // Keep local profiling bounded during long sessions. Observers still receive
    // the completed entries even when old names are cleared from the timeline.
    const entries = performance.getEntriesByType('measure').filter(entry => entry.name.startsWith('trinity:workspace:'));
    if (entries.length > 120) performance.clearMeasures(entries[0].name);
  }
  catch { /* Older WebViews may not support measure options. */ }
}

export async function measureWorkspaceOperation<T>(name: string, operation: () => T | Promise<T>): Promise<T> {
  const start = performance.now();
  try { const result = await operation(); measureWorkspaceStep(name, start); return result; }
  catch (error) { measureWorkspaceStep(`${name}:failed`, start); throw error; }
}

/** Request headers received; response parsing/rendering is measured separately. */
export async function measureWorkspaceRequest(name: string, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const start = performance.now();
  try {
    const response = await fetch(input, init);
    measureWorkspaceStep(response.ok ? name : `${name}:http-error`, start);
    return response;
  } catch (error) { measureWorkspaceStep(`${name}:failed`, start); throw error; }
}

export function measurePupilsPaint(): () => void {
  if (typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined') return () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const frame = requestAnimationFrame(() => {
    timer = setTimeout(() => {
      if (!pupilsPaintRecorded) {
        pupilsPaintRecorded = true;
        measureWorkspaceStep('pupils-first-paint', 0);
      }
    }, 0);
  });
  return () => { cancelAnimationFrame(frame); if (timer) clearTimeout(timer); };
}
