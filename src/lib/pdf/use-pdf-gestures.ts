"use client";
import { hasAndroidOfflineBridge } from '@/lib/offline/android-bridge';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

interface Anchor { page: HTMLElement; x: number; y: number; screenX: number; screenY: number }
/** Android handles PDF gestures locally. Web browsers retain page pinch zoom. */
export function usePDFGestures(viewport: React.RefObject<HTMLDivElement | null>, scale: number, changeScale: (scale: number) => void, active: boolean) {
  const latest = useRef({ scale, changeScale }); latest.current = { scale, changeScale };
  const anchor = useRef<Anchor | null>(null);
  const zoomAt = useCallback((next: number, clientX?: number, clientY?: number) => {
    const root = viewport.current; if (!root) return;
    const bounds = root.getBoundingClientRect();
    const x = clientX ?? bounds.left + root.clientWidth / 2, y = clientY ?? bounds.top + root.clientHeight / 2;
    const pages = Array.from(root.querySelectorAll<HTMLElement>('[data-pdf-page]'));
    const page = pages.find(page => { const r = page.getBoundingClientRect(); return y >= r.top && y <= r.bottom; }) ?? pages[0];
    if (page) {
      const r = page.getBoundingClientRect();
      anchor.current = { page, x: (x - r.left) / Math.max(1, r.width), y: (y - r.top) / Math.max(1, r.height), screenX: x - bounds.left, screenY: y - bounds.top };
    }
    latest.current.changeScale(Math.min(3, Math.max(.05, next)));
  }, [viewport]);
  useLayoutEffect(() => {
    const root = viewport.current, point = anchor.current;
    if (!root || !point || !point.page.isConnected) return;
    anchor.current = null;
    const bounds = root.getBoundingClientRect(), page = point.page.getBoundingClientRect();
    root.scrollLeft += page.left + point.x * page.width - bounds.left - point.screenX;
    root.scrollTop += page.top + point.y * page.height - bounds.top - point.screenY;
  }, [scale, viewport]);
  useEffect(() => {
    const root = viewport.current; if (!root || !active || !hasAndroidOfflineBridge()) return;
    let pinch: { distance: number; scale: number; x: number; y: number } | null = null;
    let pan: { x: number; y: number } | null = null;
    let frame = 0, pending: { scale: number; x: number; y: number } | null = null;
    const distance = (touches: TouchList) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    const start = (event: TouchEvent) => {
      if (event.touches.length < 2) return;
      event.preventDefault(); pan = null;
      pinch = { distance: Math.max(1, distance(event.touches)), scale: latest.current.scale, x: (event.touches[0].clientX + event.touches[1].clientX) / 2, y: (event.touches[0].clientY + event.touches[1].clientY) / 2 };
    };
    const move = (event: TouchEvent) => {
      if (pinch && event.touches.length >= 2) {
        event.preventDefault();
        const a = event.touches[0], b = event.touches[1];
        const x = (a.clientX + b.clientX) / 2, y = (a.clientY + b.clientY) / 2;
        root.scrollLeft -= x - pinch.x; root.scrollTop -= y - pinch.y; pinch.x = x; pinch.y = y;
        pending = { scale: pinch.scale * distance(event.touches) / pinch.distance, x, y };
        if (!frame) frame = requestAnimationFrame(() => { frame = 0; if (pending) { zoomAt(pending.scale, pending.x, pending.y); pending = null; } });
      } else if (pan && event.touches.length === 1) {
        event.preventDefault(); const touch = event.touches[0];
        root.scrollLeft += pan.x - touch.clientX; root.scrollTop += pan.y - touch.clientY;
        pan = { x: touch.clientX, y: touch.clientY };
      }
    };
    const end = (event: TouchEvent) => {
      if (event.touches.length >= 2) { start(event); return; }
      if (pending) { cancelAnimationFrame(frame); frame = 0; zoomAt(pending.scale, pending.x, pending.y); pending = null; }
      if (pinch && event.touches.length === 1) pan = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      if (event.touches.length === 0) pan = null;
      pinch = null;
    };
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault(); zoomAt(latest.current.scale * Math.exp(-event.deltaY * .01), event.clientX, event.clientY);
    };
    root.addEventListener('touchstart', start, { passive: false }); root.addEventListener('touchmove', move, { passive: false });
    root.addEventListener('touchend', end); root.addEventListener('touchcancel', end); root.addEventListener('wheel', wheel, { passive: false });
    return () => { cancelAnimationFrame(frame); root.removeEventListener('touchstart', start); root.removeEventListener('touchmove', move); root.removeEventListener('touchend', end); root.removeEventListener('touchcancel', end); root.removeEventListener('wheel', wheel); };
  }, [viewport, zoomAt, active]);
  return zoomAt;
}
