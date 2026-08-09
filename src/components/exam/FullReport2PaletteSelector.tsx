"use client";

import { Check } from "lucide-react";

export type FullReport2Palette = "blue" | "purple" | "orange";

export function FullReport2PaletteSelector({
  palette,
  onPaletteChange,
}: {
  palette: FullReport2Palette;
  onPaletteChange: (palette: FullReport2Palette) => void;
}) {
  return (
    <section className="mb-6 space-y-3" aria-labelledby="bespoke-report-palette-heading">
      <div>
        <h3 id="bespoke-report-palette-heading" className="text-sm font-semibold text-gray-900">Report colour palette</h3>
        <p className="mt-1 text-xs text-gray-500">Choose the accent colours used throughout the Bespoke Report.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {([
          { id: "blue", label: "Current Blue", primary: "#244291", secondary: "#2563eb", soft: "#eef4ff" },
          { id: "purple", label: "Purple", primary: "#6b21a8", secondary: "#d35ac7", soft: "#faf5ff" },
          { id: "orange", label: "Orange", primary: "#f4510b", secondary: "#f59e0b", soft: "#fff7ed" },
        ] as const).map((option) => {
          const isSelected = palette === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onPaletteChange(option.id)}
              className="group rounded-xl border-2 bg-white p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{ borderColor: isSelected ? option.primary : "#e5e7eb", boxShadow: isSelected ? `0 0 0 3px ${option.soft}` : undefined }}
            >
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <div className="h-2" style={{ backgroundColor: option.primary }} />
                <div className="space-y-1.5 p-2" style={{ backgroundColor: option.soft }}>
                  <div className="h-1.5 w-3/4 rounded-full" style={{ backgroundColor: option.primary, opacity: 0.75 }} />
                  <div className="grid grid-cols-4 gap-1">
                    <div className="col-span-2 h-4 rounded-sm" style={{ backgroundColor: option.primary }} />
                    <div className="h-4 rounded-sm" style={{ backgroundColor: option.secondary }} />
                    <div className="h-4 rounded-sm" style={{ backgroundColor: option.primary, opacity: 0.72 }} />
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-gray-900">{option.label}</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full border" style={{ borderColor: option.primary, backgroundColor: isSelected ? option.primary : "#ffffff" }}>
                  {isSelected && <Check className="h-3.5 w-3.5 text-white" aria-hidden="true" />}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
