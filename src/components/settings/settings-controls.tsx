'use client';

import { useState, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

export const settingsButtonClass = 'relative inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-accent active:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 after:absolute after:-inset-y-1 after:inset-x-0 sm:min-h-8';
export const settingsSwitchClass = 'relative my-1.5 after:absolute after:-inset-y-2.5 after:-inset-x-1';

export function SettingsRows({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 bg-card/75">{children}</div>;
}

export function SettingsRow({ label, htmlFor, hint, children }: { label: ReactNode; htmlFor?: string; hint?: ReactNode; children?: ReactNode }) {
  return <div className="flex min-h-[54px] items-center justify-between gap-3 px-3.5 py-2 sm:px-4">
    <div className="min-w-0 flex-1">
      {htmlFor ? <label htmlFor={htmlFor} className="cursor-pointer text-[13px] font-medium leading-5">{label}</label> : <span className="text-[13px] font-medium leading-5">{label}</span>}
      {hint && <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{hint}</p>}
    </div>
    {children && <div className="flex max-w-[58%] shrink-0 items-center gap-2">{children}</div>}
  </div>;
}

export function SettingsSelect({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn('h-10 max-w-full min-w-0 rounded-full border border-border bg-background py-1 pl-3 pr-7 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:h-8', className)} />;
}

export function SettingsToggle({ id, value, disabled, onCheckedChange }: { id: string; value: boolean | undefined; disabled?: boolean; onCheckedChange: (checked: boolean) => void }) {
  if (typeof value === 'boolean') return <Switch id={id} className={settingsSwitchClass} checked={value} disabled={disabled} onCheckedChange={onCheckedChange} />;
  // Older APKs cannot report this preference. Mixed state avoids claiming it is Off.
  return <button id={id} type="button" role="checkbox" aria-checked="mixed" disabled className="relative my-1.5 flex h-6 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground opacity-60"><span aria-hidden="true" className="text-xs">—</span></button>;
}

export function SettingsDisclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <details className="rounded-2xl border border-border/70 bg-card/75" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-3.5 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4 [&::-webkit-details-marker]:hidden">{title}<ChevronDown className={`h-4 w-4 text-muted-foreground ${open ? 'rotate-180' : ''}`} aria-hidden="true" /></summary>
    {open && <div className="border-t border-border/60 p-3">{children}</div>}
  </details>;
}
