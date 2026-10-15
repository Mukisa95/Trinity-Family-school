"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { observeNavigationContrast } from "./glass-navigation-contrast";

const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
type Indicator = { x: number; size: number };
interface GlassNavigationSurfaceProps {
  children: ReactNode;
  className?: string;
  compactOnDesktop?: boolean;
  label?: string;
}

/** One moving selection/press object, shared by native buttons and legacy page actions. */
export function GlassNavigationSurface({ children, className, compactOnDesktop = false, label = "Page actions" }: GlassNavigationSurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLDivElement>(null);
  const keyboardInteraction = useRef(false);
  const feedbackControl = useRef<HTMLElement | null>(null);
  const feedbackTimer = useRef(0);
  const reduceMotion = useReducedMotion();
  const [selection, setSelection] = useState<Indicator | null>(null);
  const [feedback, setFeedback] = useState<Indicator | null>(null);

  function geometry(control: HTMLElement): Indicator | null {
    const surface = surfaceRef.current;
    if (!surface) return null;
    const bounds = control.getBoundingClientRect();
    const parent = surface.getBoundingClientRect();
    const size = Math.min(40, bounds.width - 4, bounds.height - 8);
    const x = bounds.left - parent.left + (bounds.width - size) / 2;
    return size > 0 && x >= 0 && x + size <= parent.width ? { x, size } : null;
  }

  function clearFeedback() {
    clearTimeout(feedbackTimer.current);
    feedbackControl.current?.removeAttribute("data-glass-feedback");
    feedbackControl.current = null;
    setFeedback(null);
  }

  function controlAt(target: EventTarget | null) {
    const control = target instanceof Element ? target.closest<HTMLElement>('button, a[href], [role="button"]') : null;
    return control && itemsRef.current?.contains(control) && !control.matches(':disabled, [aria-disabled="true"], [role="switch"]') ? control : null;
  }

  function press(control: HTMLElement, keyboard = false) {
    clearFeedback();
    feedbackControl.current = control;
    control.dataset.glassFeedback = keyboard ? "keyboard" : "pressed";
    if (!keyboard) setFeedback(geometry(control));
  }

  function release() {
    if (!feedbackControl.current) return;
    if (feedbackControl.current.dataset.glassFeedback === "pressed") feedbackControl.current.dataset.glassFeedback = "released";
    clearTimeout(feedbackTimer.current);
    // Keep feedback visible after a quick tap without delaying the action itself.
    feedbackTimer.current = window.setTimeout(clearFeedback, 180);
  }

  useBrowserLayoutEffect(() => {
    const surface = surfaceRef.current;
    const items = itemsRef.current;
    if (!surface || !items) return;
    let frame = 0;
    const measureNow = () => {
      const controls = Array.from(items.querySelectorAll<HTMLElement>('button, a[href]:not(:has(button)), [role="button"]'))
        .filter(element => element.getBoundingClientRect().width > 0);
      const count = String(Math.max(1, controls.length));
      if (surface.style.getPropertyValue("--glass-navigation-items") !== count) surface.style.setProperty("--glass-navigation-items", count);
      const active = controls.find(element => element.getAttribute("aria-current") === "page" || element.getAttribute("aria-pressed") === "true");
      const next = active ? geometry(active) : null;
      setSelection(previous => previous?.x === next?.x && previous?.size === next?.size ? previous : next);
      if (feedbackControl.current && !items.contains(feedbackControl.current)) clearFeedback();
    };
    const measure = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measureNow); };
    const resize = new ResizeObserver(measure);
    resize.observe(surface);
    resize.observe(items);
    const mutations = new MutationObserver(measure);
    mutations.observe(items, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-current", "aria-pressed", "hidden", "class", "disabled"] });
    items.addEventListener("scroll", measure, { passive: true });
    measureNow();
    const stopContrast = observeNavigationContrast(surface);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(feedbackTimer.current);
      feedbackControl.current?.removeAttribute("data-glass-feedback");
      resize.disconnect();
      mutations.disconnect();
      items.removeEventListener("scroll", measure);
      stopContrast();
    };
  }, []);

  const indicator = feedback ?? selection;
  return (
    <div
      ref={surfaceRef} role="group" aria-label={label}
      className={cn("glass-chrome-surface glass-navigation-surface", compactOnDesktop && "glass-navigation-compact-desktop", className)}
      data-feedback-active={feedback ? "true" : undefined}
      onKeyDownCapture={event => {
        keyboardInteraction.current = true;
        event.currentTarget.dataset.inputMethod = "keyboard";
        if (event.key === "Enter" || event.key === " ") {
          const control = controlAt(event.target);
          if (control) { press(control, true); release(); }
        }
      }}
      onPointerDownCapture={event => {
        keyboardInteraction.current = false;
        event.currentTarget.dataset.inputMethod = "pointer";
        const control = controlAt(event.target);
        if (control) press(control);
      }}
      onPointerUpCapture={release} onPointerCancelCapture={clearFeedback} onPointerLeave={release}
      onClickCapture={event => {
        // Screen readers/programmatic activation may not emit pointer events.
        const control = controlAt(event.target);
        if (control && !feedbackControl.current) { press(control, event.detail === 0); release(); }
      }}
    >
      <AnimatePresence initial={false}>
        {indicator && <motion.span
          key="glass-navigation-selection" aria-hidden="true" className="glass-navigation-indicator"
          initial={{ opacity: 0, transform: `translate3d(${indicator.x}px, 0, 0)` }} animate={{ opacity: 1, transform: `translate3d(${indicator.x}px, 0, 0)` }} exit={{ opacity: 0 }}
          transition={{ transform: reduceMotion || keyboardInteraction.current ? { duration: 0 } : { type: "spring", duration: 0.5, bounce: 0.2 }, opacity: { duration: 0.12 } }}
          style={{ width: indicator.size, height: indicator.size, marginTop: -indicator.size / 2 }}
        />}
      </AnimatePresence>
      <div ref={itemsRef} className="glass-navigation-items">{children}</div>
    </div>
  );
}
