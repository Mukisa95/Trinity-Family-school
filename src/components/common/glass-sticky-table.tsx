"use client";

import { useEffect, useState, type CSSProperties, type HTMLAttributes, type ReactNode, type TableHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

interface GlassStickyTableShellProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function GlassStickyTableShell({
  children,
  className,
  ...props
}: GlassStickyTableShellProps) {
  return (
    <div
      className={cn(
        "overflow-visible rounded-xl border border-indigo-100 bg-white shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function GlassStickyTableScroller({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("overflow-x-auto overflow-y-visible rounded-t-xl", className)} {...props}>
      {children}
    </div>
  );
}

export function GlassStickyTable({
  className,
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn("min-w-full divide-y divide-indigo-100", className)}
      {...props}
    />
  );
}

interface GlassStickyTableHeaderProps extends HTMLAttributes<HTMLTableSectionElement> {
  stickyTop?: string;
}

export function GlassStickyTableHeader({
  className,
  stickyTop,
  style,
  ...props
}: GlassStickyTableHeaderProps) {
  const [measuredStickyTop, setMeasuredStickyTop] = useState(stickyTop || "58px");

  useEffect(() => {
    if (stickyTop) {
      setMeasuredStickyTop(stickyTop);
      return;
    }

    const syncTopbarHeight = () => {
      const topbar = document.querySelector<HTMLElement>(".glass-page-topbar-enter");
      const height = topbar?.getBoundingClientRect().height;
      setMeasuredStickyTop(height ? `${Math.ceil(height)}px` : "58px");
    };

    syncTopbarHeight();
    window.addEventListener("resize", syncTopbarHeight);
    return () => window.removeEventListener("resize", syncTopbarHeight);
  }, [stickyTop]);

  return (
    <thead
      className={cn(
        "bg-white/82 shadow-[0_8px_24px_rgba(79,70,229,0.10)] backdrop-blur-[18px]",
        "[&_th]:sticky [&_th]:z-20 [&_th]:top-[var(--glass-table-sticky-top)]",
        "[&_th]:bg-gradient-to-r [&_th]:from-indigo-50/95 [&_th]:to-white/95",
        "[&_th]:border-b [&_th]:border-indigo-100/80",
        className
      )}
      style={{ "--glass-table-sticky-top": measuredStickyTop, ...style } as CSSProperties}
      {...props}
    />
  );
}
