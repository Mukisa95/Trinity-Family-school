'use client';

import { useId } from 'react';

export function PhotoPrintOptions({ colorPhotos, onChange }: {
  colorPhotos: boolean;
  onChange: (colorPhotos: boolean) => void;
}) {
  const name = useId();
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-semibold text-foreground">Photo printing</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {[
          { color: false, label: 'Black and white', detail: 'Default · photos and form' },
          { color: true, label: 'Colour photos', detail: 'Photos only · form stays black and white' },
        ].map(option => (
          <label key={String(option.color)} className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${colorPhotos === option.color ? 'border-brand-500 bg-brand-surface-50 dark:bg-brand-surface-950/40' : 'border-border bg-background'}`}>
            <input
              type="radio"
              name={name}
              checked={colorPhotos === option.color}
              onChange={() => onChange(option.color)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
              aria-label={option.label}
            />
            <span className="min-w-0">
              <span className="block font-medium text-foreground">{option.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{option.detail}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
