import { cn } from "@/lib/utils";

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-full bg-slate-200/70",
        className
      )}
    >
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/70 to-transparent animate-shimmer-pass" />
    </div>
  );
}

export function GlassPageTopBarSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "glass-page-topbar-enter -mx-3 mb-4 overflow-hidden rounded-b-[18px] border-b border-white/45 bg-white/72 shadow-[0_4px_20px_rgba(0,0,0,0.06)] backdrop-blur-[20px] sm:-mx-6",
        className
      )}
      aria-hidden="true"
    >
      <div className="h-px bg-gradient-to-r from-transparent via-blue-200/60 to-transparent" />
      <div className="w-full px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <SkeletonBlock className="h-8 w-8 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonBlock className="h-4 w-44 max-w-[70%] sm:w-64" />
              <SkeletonBlock className="h-3 w-56 max-w-[85%] sm:w-80" />
            </div>
          </div>

          <div className="hidden min-w-0 flex-1 justify-center lg:flex">
            <SkeletonBlock className="h-[34px] w-44" />
          </div>

          <div className="flex shrink-0 items-center justify-center gap-2 lg:justify-start">
            <div className="flex items-center gap-1 rounded-full border border-white/60 bg-white/80 px-2 py-1 shadow-sm ring-1 ring-blue-100/60 backdrop-blur-sm">
              <SkeletonBlock className="h-10 w-10 sm:h-11 sm:w-11" />
              <SkeletonBlock className="h-10 w-10 sm:h-11 sm:w-11" />
              <SkeletonBlock className="h-10 w-10 sm:h-11 sm:w-11" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Variant: Default ────────────────────────────────────────────────────────
// Layout: Topbar + 4 stat cards + 6-row list panel
// Best for: fees/collection, fees/family — pages with summary stats + a table
function DefaultSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-lg border border-white/55 bg-white/65 p-4 shadow-sm backdrop-blur-sm"
          >
            <SkeletonBlock className="mb-4 h-8 w-8" />
            <SkeletonBlock className="mb-2 h-4 w-20" />
            <SkeletonBlock className="h-3 w-28" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-white/55 bg-white/65 p-4 shadow-sm backdrop-blur-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <SkeletonBlock className="h-4 w-36" />
          <SkeletonBlock className="h-8 w-24" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <SkeletonBlock className="h-9 w-9 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonBlock className="h-3 w-full max-w-xl" />
                <SkeletonBlock className="h-3 w-2/3 max-w-md" />
              </div>
              <SkeletonBlock className="hidden h-8 w-20 sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Variant: List ───────────────────────────────────────────────────────────
// Layout: Topbar + optional filter bar + 8 shimmer rows (table/list-like)
// Best for: staff, banking, exams, subjects, history-log, notifications — pages
// that are primarily a flat list/table of records
function ListSkeleton() {
  return (
    <div className="space-y-4">
      {/* Filter / search bar row */}
      <div className="flex items-center gap-3">
        <SkeletonBlock className="h-9 flex-1 rounded-lg max-w-xs" />
        <SkeletonBlock className="h-9 w-28 rounded-lg" />
        <SkeletonBlock className="h-9 w-28 rounded-lg" />
      </div>

      {/* Table-like panel */}
      <div className="rounded-lg border border-white/55 bg-white/65 shadow-sm backdrop-blur-sm overflow-hidden">
        {/* Table header */}
        <div className="border-b border-white/40 bg-white/40 px-4 py-3 flex items-center gap-4">
          <SkeletonBlock className="h-3 w-6 shrink-0" />
          <SkeletonBlock className="h-3 w-32" />
          <SkeletonBlock className="h-3 w-24 ml-auto hidden sm:block" />
          <SkeletonBlock className="h-3 w-20 hidden md:block" />
          <SkeletonBlock className="h-3 w-16 hidden lg:block" />
        </div>

        {/* Rows */}
        <div className="divide-y divide-white/30">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 px-4 py-3.5">
              <SkeletonBlock className="h-9 w-9 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonBlock className={`h-3 ${index % 3 === 0 ? "w-48" : index % 3 === 1 ? "w-56" : "w-40"} max-w-full`} />
                <SkeletonBlock className={`h-2.5 ${index % 2 === 0 ? "w-32" : "w-44"} max-w-full`} />
              </div>
              <SkeletonBlock className="hidden h-6 w-16 rounded-full sm:block" />
              <SkeletonBlock className="hidden h-8 w-8 md:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Variant: Cards ──────────────────────────────────────────────────────────
// Layout: Topbar + 6 larger cards in a 3-column grid
// Best for: classes, boarding, inventory, uniforms — pages with card grids
function CardsSkeleton() {
  return (
    <div className="space-y-4">
      {/* Page subtitle / summary row */}
      <div className="flex items-center justify-between gap-3">
        <SkeletonBlock className="h-4 w-48" />
        <SkeletonBlock className="h-9 w-32 rounded-lg" />
      </div>

      {/* Card grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border border-white/55 bg-white/65 p-5 shadow-sm backdrop-blur-sm space-y-3"
          >
            {/* Card header */}
            <div className="flex items-center justify-between">
              <SkeletonBlock className="h-10 w-10" />
              <SkeletonBlock className="h-6 w-16 rounded-full" />
            </div>
            {/* Card title */}
            <SkeletonBlock className="h-4 w-3/4" />
            {/* Card meta */}
            <SkeletonBlock className="h-3 w-1/2" />
            {/* Card footer */}
            <div className="flex items-center gap-2 pt-1">
              <SkeletonBlock className="h-3 w-16" />
              <SkeletonBlock className="h-3 w-12" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Summary Bar Skeleton ─────────────────────────────────────────────────────
// Matches the GlassSummaryBar layout: left icon+label + right stat pill row.
// Rendered between the topbar skeleton and the body skeleton when showSummaryBar=true.
export function GlassSummaryBarSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "glass-page-topbar-enter -mx-3 mb-1.5 overflow-hidden rounded-[18px] border border-white/45 bg-white/72 shadow-[0_4px_20px_rgba(0,0,0,0.06)] backdrop-blur-[20px] px-4 py-3 sm:-mx-6 sm:px-6 lg:px-8",
        className
      )}
      aria-hidden="true"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: icon + label */}
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-7 w-7 shrink-0" />
          <SkeletonBlock className="h-4 w-36" />
        </div>
        {/* Right: stat pills */}
        <div className="flex flex-wrap items-center gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock
              key={i}
              className={`h-7 rounded-full ${i % 3 === 0 ? "w-24" : i % 3 === 1 ? "w-28" : "w-20"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Public export ───────────────────────────────────────────────────────────

export type GlassPageRouteSkeletonVariant = "default" | "list" | "cards";

export function GlassPageRouteSkeleton({
  variant = "default",
  showSummaryBar = false,
}: {
  /**
   * Controls the content area layout below the topbar.
   *
   * - `"default"` — 4 stat cards + 6-row list panel (fees/collection, fees/family)
   * - `"list"`    — filter bar + 8 shimmer table rows (staff, banking, exams, subjects…)
   * - `"cards"`   — 6 larger cards in a grid (classes, boarding, inventory, uniforms…)
   */
  variant?: GlassPageRouteSkeletonVariant;
  /**
   * When true, renders a GlassSummaryBarSkeleton between the topbar and the
   * body content — matching pages that use <GlassSummaryBar />.
   */
  showSummaryBar?: boolean;
}) {
  return (
    <div className="glass-page-route-skeleton">
      <GlassPageTopBarSkeleton />
      {showSummaryBar && <GlassSummaryBarSkeleton />}
      {variant === "list" && <ListSkeleton />}
      {variant === "cards" && <CardsSkeleton />}
      {variant === "default" && <DefaultSkeleton />}
    </div>
  );
}
