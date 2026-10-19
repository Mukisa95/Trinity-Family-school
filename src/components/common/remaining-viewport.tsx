"use client";

import { useEffect, useLayoutEffect, useRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

interface RemainingViewportProps extends HTMLAttributes<HTMLDivElement> {
  /** Card layouts can keep natural document flow below this breakpoint. */
  minWidth?: number;
}

/** Fit the actual space below this panel, including the workspace's bottom inset. */
export function RemainingViewport({ minWidth = 0, className, children, ...props }: RemainingViewportProps) {
  const ref = useRef<HTMLDivElement>(null);
  useBrowserLayoutEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    const ancestors: HTMLElement[] = [];
    for (let node = panel.parentElement; node; node = node.parentElement) ancestors.push(node);
    const scroller = ancestors.find(node => /^(auto|scroll)$/.test(getComputedStyle(node).overflowY));
    const main = panel.closest("main");
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (window.innerWidth < minWidth) {
        panel.style.removeProperty("--remaining-viewport-height");
        return;
      }
      const viewport = window.visualViewport;
      const bottom = scroller ? scroller.clientHeight : viewport?.height ?? window.innerHeight;
      // Use layout coordinates: scrolling rows or an enclosing page must not grow
      // the document or leave a new blank area below the panel.
      const top = scroller
        ? panel.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - scroller.clientTop
        : panel.getBoundingClientRect().top + window.scrollY - (viewport?.offsetTop ?? 0);
      const inset = parseFloat(getComputedStyle(scroller || main || document.body).paddingBottom) || 0;
      const height = `${Math.max(48, Math.floor(bottom - top - inset))}px`;
      if (panel.style.getPropertyValue("--remaining-viewport-height") !== height) panel.style.setProperty("--remaining-viewport-height", height);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    // Ancestors change when filters wrap, chrome resizes or a sidebar collapses.
    for (const ancestor of ancestors) observer.observe(ancestor);
    observer.observe(panel);
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    measure();
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
    };
  }, [minWidth]);
  return <div ref={ref} data-remaining-viewport className={cn("remaining-viewport min-h-0", className)} {...props}>{children}</div>;
}
