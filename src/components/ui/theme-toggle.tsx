"use client";

import { Moon, Sun } from "lucide-react";
import { useAppearance, type ThemePreference } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";
import { DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";

export function ThemeToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { ready, dark, changing, changeTheme } = useAppearance();
  const visibleDark = ready && dark;
  return (
    <button
      type="button" role="switch" aria-label="Dark theme" aria-checked={ready && dark}
      aria-busy={changing} disabled={!ready || changing}
      title={visibleDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={event => void changeTheme(dark ? "light" : "dark", event.currentTarget)}
      className={cn("theme-toggle inline-flex h-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-wait", compact ? "w-11" : "w-16", className)}
    >
      <span aria-hidden="true" className={cn("theme-toggle-track relative flex h-8 items-center rounded-full border border-blue-200/80 bg-blue-50/90 px-[7px] text-slate-500 shadow-inner dark:border-slate-600/70 dark:bg-slate-800/90 dark:text-slate-400", compact ? "w-8 justify-center" : "w-[60px] justify-between")}>
        {!compact && <span className={cn("theme-toggle-thumb absolute left-[3px] top-[3px] h-6 w-6 rounded-full bg-white shadow-[0_2px_6px_rgba(15,23,42,0.16)] dark:bg-slate-600", ready && dark && "translate-x-7")} />}
        <Sun className={cn("relative h-4 w-4", !visibleDark && "text-amber-500", compact && "dark:hidden")} strokeWidth={1.8} />
        <Moon className={cn("relative h-4 w-4", visibleDark && "text-blue-200", compact && "hidden dark:block")} strokeWidth={1.8} />
      </span>
    </button>
  );
}

export function ThemePreferenceMenu() {
  const { preference, changing, changeTheme } = useAppearance();
  return <>
    <DropdownMenuLabel className="text-[10px] text-muted-foreground">Appearance</DropdownMenuLabel>
    <DropdownMenuRadioGroup value={preference}>
      {(["light", "dark", "system"] as ThemePreference[]).map(value => (
        <DropdownMenuRadioItem key={value} value={value} disabled={changing} className="text-xs capitalize"
          onSelect={event => {
            // Keep the menu in place while capturing the old and new themes.
            event.preventDefault();
            void changeTheme(value, event.currentTarget as HTMLElement);
          }}>
          {value === "system" ? "Use device setting" : value}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  </>;
}
