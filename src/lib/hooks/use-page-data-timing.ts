'use client';

import { useEffect, useRef } from 'react';
import { measureWorkspaceStep } from '@/lib/startup/workspace-timing';

/** Separate page data readiness from the first visible paint opportunity. */
export function usePageDataTiming(page: string, ready: boolean, visitKey = '') {
  const visit = useRef({ key: visitKey, startedAt: typeof performance === 'undefined' ? 0 : performance.now(), ready: false, painted: false });
  if (visit.current.key !== visitKey) visit.current = { key: visitKey, startedAt: performance.now(), ready: false, painted: false };
  useEffect(() => {
    if (!ready || visit.current.painted) return;
    const current = visit.current;
    if (!current.ready) { current.ready = true; measureWorkspaceStep(`page:${page}:data-ready`, current.startedAt); }
    let frame: number | undefined, timer: ReturnType<typeof setTimeout> | undefined;
    const paint = () => {
      if (current.painted || frame !== undefined || document.visibilityState !== 'visible'
        || document.querySelector('[data-workspace-visible="false"]')) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        timer = setTimeout(() => {
          if (document.visibilityState !== 'visible' || document.querySelector('[data-workspace-visible="false"]')) return;
          current.painted = true;
          measureWorkspaceStep(`page:${page}:first-data-visible`, current.startedAt);
        }, 0);
      });
    };
    paint();
    window.addEventListener('trinity-workspace-visible', paint);
    document.addEventListener('visibilitychange', paint);
    return () => { if (frame !== undefined) cancelAnimationFrame(frame); clearTimeout(timer);
      window.removeEventListener('trinity-workspace-visible', paint); document.removeEventListener('visibilitychange', paint); };
  }, [page, ready, visitKey]);
}
