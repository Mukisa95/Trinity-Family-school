'use client';

import { useEffect, useState } from 'react';
import { isAppleMobile, isHomeScreenApp } from '@/lib/pwa/platform';

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
      const nativeScale = visible?.scale ?? 1;
      const layoutHeight = document.documentElement.clientHeight;
      const layoutGap = layoutHeight - (visible ? visible.height * nativeScale : window.innerHeight);
      const focused = document.activeElement;
      const editing = focused instanceof HTMLElement && (focused.isContentEditable
        || focused instanceof HTMLTextAreaElement && !focused.readOnly
        || focused instanceof HTMLSelectElement
        || focused instanceof HTMLInputElement && !focused.readOnly
          && !['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'file', 'color', 'hidden'].includes(focused.type));
      // Home Screen WebKit can leave a small inset in visualViewport on launch.
      // Fill the actual layout area; never extend into space outside the web view.
      // Larger occlusions (the keyboard) and zoomed visual overlays keep their bounds.
      const fillLayout = isAppleMobile() && isHomeScreenApp() && (!followZoom || nativeScale === 1)
        && !editing && layoutGap >= 0 && layoutGap <= Math.min(150, layoutHeight / 4);
      const next = {
        top: fillLayout ? 0 : followOffset ? visible?.offsetTop ?? 0 : 0,
        left: followOffset ? visible?.offsetLeft ?? 0 : 0,
        width: visible ? Math.round(visible.width * scale) : window.innerWidth,
        height: fillLayout ? layoutHeight : visible ? Math.round(visible.height * scale) : window.innerHeight,
      };
      setViewport(previous => previous && previous.top === next.top && previous.left === next.left && previous.width === next.width && previous.height === next.height ? previous : next);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    update();
    visible?.addEventListener('resize', schedule);
    visible?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    window.addEventListener('pageshow', schedule);
    document.addEventListener('visibilitychange', schedule);
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
    return () => {
      cancelAnimationFrame(frame);
      visible?.removeEventListener('resize', schedule);
      visible?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('pageshow', schedule);
      document.removeEventListener('visibilitychange', schedule);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
    };
  }, [followZoom, enabled]);
  return enabled ? viewport : null;
}
