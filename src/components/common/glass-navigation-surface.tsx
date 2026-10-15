"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassNavigationSurfaceProps {
  children: ReactNode;
  className?: string;
  /** Page toolbars keep their compact treatment on desktop. */
  compactOnDesktop?: boolean;
  label?: string;
}

/** Measures rendered controls, including permission guards and menu triggers. */
export function GlassNavigationSurface({
  children,
  className,
  compactOnDesktop = false,
  label = "Page actions",
}: GlassNavigationSurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLDivElement>(null);
  const keyboardInteraction = useRef(false);
  const reduceMotion = useReducedMotion();
  const [itemCount, setItemCount] = useState(1);
  const [indicator, setIndicator] = useState<{ x: number; size: number } | null>(null);

  useEffect(() => {
    const surface = surfaceRef.current;
    const items = itemsRef.current;
    if (!surface || !items) return;

    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Legacy docks sometimes wrap a button in a link. Count the hit area once.
        const controls = Array.from(items.querySelectorAll<HTMLElement>(
          'button, a[href]:not(:has(button)), [role="button"]',
        )).filter(element => element.getBoundingClientRect().width > 0);
        setItemCount(Math.max(1, controls.length));
        const active = controls.find(element =>
          element.getAttribute("aria-current") === "page" ||
          element.getAttribute("aria-pressed") === "true",
        );
        if (!active) {
          setIndicator(null);
          return;
        }
        const bounds = active.getBoundingClientRect();
        const surfaceBounds = surface.getBoundingClientRect();
        const size = Math.min(52, bounds.width);
        const x = bounds.left - surfaceBounds.left + (bounds.width - size) / 2;
        // Do not leave the selection circle floating beyond a scrolled capsule.
        if (x < 0 || x + size > surfaceBounds.width) {
          setIndicator(null);
          return;
        }
        setIndicator(previous => previous?.x === x && previous.size === size ? previous : { x, size });
      });
    };

    const resize = new ResizeObserver(measure);
    resize.observe(surface);
    resize.observe(items);
    const mutations = new MutationObserver(measure);
    mutations.observe(items, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ["aria-current", "aria-pressed", "hidden", "class", "disabled"],
    });
    items.addEventListener("scroll", measure, { passive: true });
    measure();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
      items.removeEventListener("scroll", measure);
    };
  }, []);

  return (
    <div
      ref={surfaceRef}
      role="group"
      aria-label={label}
      className={cn("glass-navigation-surface", compactOnDesktop && "glass-navigation-compact-desktop", className)}
      style={{ "--glass-navigation-items": itemCount } as CSSProperties}
      onKeyDownCapture={event => {
        keyboardInteraction.current = true;
        event.currentTarget.dataset.inputMethod = "keyboard";
      }}
      onPointerDownCapture={event => {
        keyboardInteraction.current = false;
        event.currentTarget.dataset.inputMethod = "pointer";
      }}
    >
      {indicator && (
        <motion.span
          aria-hidden="true"
          className="glass-navigation-indicator"
          initial={false}
          animate={{ transform: `translate3d(${indicator.x}px, 0, 0)` }}
          transition={reduceMotion || keyboardInteraction.current
            ? { duration: 0 }
            : { type: "spring", duration: 0.5, bounce: 0.2 }}
          style={{ width: indicator.size, height: indicator.size }}
        />
      )}
      <div ref={itemsRef} className="glass-navigation-items">{children}</div>
    </div>
  );
}
