"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassSummaryBarProps {
  /**
   * Content displayed on the left side of the summary bar (e.g. titles, info tags, metadata).
   */
  left?: ReactNode;
  /**
   * Content displayed on the right side of the summary bar (e.g. statistics row, status badges, actions).
   */
  right?: ReactNode;
  /**
   * Additional class names for the outer container.
   */
  className?: string;
  /**
   * Additional class names for the inner flex row wrapper.
   */
  containerClassName?: string;
}

export function GlassSummaryBar({
  left,
  right,
  className,
  containerClassName,
}: GlassSummaryBarProps) {
  return (
    <div
      className={cn(
        "glass-page-topbar-enter -mx-3 mb-1.5 overflow-hidden rounded-[18px] border border-white/45 dark:border-gray-800/50 bg-white/72 dark:bg-gray-900/72 shadow-[0_4px_20px_rgba(0,0,0,0.06)] backdrop-blur-[20px] px-4 py-3 sm:-mx-6 sm:px-6 lg:px-8 transition-all duration-300",
        className
      )}
    >
      <div
        className={cn(
          "flex flex-col md:flex-row md:items-center justify-between gap-3",
          containerClassName
        )}
      >
        {left && <div className="flex flex-col gap-0.5 min-w-0">{left}</div>}
        {right && <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">{right}</div>}
      </div>
    </div>
  );
}
