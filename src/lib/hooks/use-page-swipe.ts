'use client';

import { useRef, type TouchEvent } from 'react';

type Point = { x: number; y: number };
type Swipe = { startX: number; distanceX: number; distanceY: number };

/** Sidebar swipes use one finger. Multi-touch and zoomed-page panning belong to the browser. */
export function usePageSwipe(onSwipe: (swipe: Swipe) => void) {
  const gesture = useRef<{ start: Point; end: Point | null; horizontal: boolean } | null>(null);
  const cancel = () => { gesture.current = null; };
  const point = (event: TouchEvent): Point | null => {
    if (event.touches.length !== 1 || (window.visualViewport?.scale ?? 1) > 1.01) return null;
    const touch = event.touches[0];
    return { x: touch.clientX, y: touch.clientY };
  };
  return {
    onTouchStart: (event: TouchEvent) => {
      const start = point(event);
      gesture.current = start ? { start, end: null, horizontal: false } : null;
    },
    onTouchMove: (event: TouchEvent) => {
      const end = point(event);
      if (!end) { cancel(); return; }
      if (gesture.current) {
        const current = gesture.current;
        const dx = Math.abs(end.x - current.start.x), dy = Math.abs(end.y - current.start.y);
        if (!current.horizontal && Math.max(dx, dy) > 10) { if (dy >= dx) { cancel(); return; } current.horizontal = true; }
        current.end = end;
      }
    },
    onTouchEnd: (event: TouchEvent) => {
      const current = gesture.current;
      cancel();
      if (event.touches.length || !current?.end || (window.visualViewport?.scale ?? 1) > 1.01) return;
      const distanceX = current.start.x - current.end.x;
      const distanceY = current.start.y - current.end.y;
      if (Math.abs(distanceX) > Math.abs(distanceY)) onSwipe({ startX: current.start.x, distanceX, distanceY });
    },
    onTouchCancel: cancel,
  };
}
