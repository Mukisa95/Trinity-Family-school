'use client';

import { useEffect, useState } from 'react';

/** Visible viewport bounds, optionally retaining layout size during native page zoom. */
export function useVisualViewport(followZoom = true, enabled = true) {
  const [viewport, setViewport] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const visible = window.visualViewport;
    let frame = 0;
    const update = () => {
      const scale = followZoom ? 1 : visible?.scale ?? 1;
      const followOffset = followZoom || scale === 1;
      const next = { top: followOffset ? visible?.offsetTop ?? 0 : 0, left: followOffset ? visible?.offsetLeft ?? 0 : 0, width: visible ? Math.round(visible.width * scale) : window.innerWidth, height: visible ? Math.round(visible.height * scale) : window.innerHeight };
      setViewport(previous => previous && previous.top === next.top && previous.left === next.left && previous.width === next.width && previous.height === next.height ? previous : next);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    update();
    visible?.addEventListener('resize', schedule);
    visible?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      visible?.removeEventListener('resize', schedule);
      visible?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [followZoom, enabled]);
  return enabled ? viewport : null;
}
