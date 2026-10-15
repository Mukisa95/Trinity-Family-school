'use client';

import { useEffect, useRef } from 'react';
import { measureWorkspaceDuration, measureWorkspaceStep } from '@/lib/startup/workspace-timing';
import { createForegroundClock } from '@/lib/startup/foreground-clock';

/** Separate page data readiness from the first visible paint opportunity. */
export function usePageDataTiming(page: string, ready: boolean, visitKey = '') {
  const newVisit = () => {
    const startedAt = typeof performance === 'undefined' ? 0 : performance.now();
    return { key: visitKey, startedAt, ready: false, painted: false,
      clock: createForegroundClock(startedAt, typeof document !== 'undefined' && document.visibilityState === 'visible') };
  };
  const visit = useRef<ReturnType<typeof newVisit> | null>(null);
  if (!visit.current || visit.current.key !== visitKey) visit.current = newVisit();
  useEffect(() => {
    const current = visit.current!;
    const visibility = () => current.clock.setVisible(performance.now(), document.visibilityState === 'visible');
    visibility();
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, [visitKey]);
  useEffect(() => {
    if (!ready || visit.current!.painted) return;
    const current = visit.current!;
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
          const time = current.clock.sample(performance.now());
          measureWorkspaceStep(`page:${page}:first-data-visible`, current.startedAt);
          measureWorkspaceDuration(`page:${page}:foreground-to-visible`, time.foreground, current.startedAt);
          measureWorkspaceDuration(`page:${page}:background-wait`, time.background, current.startedAt);
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
