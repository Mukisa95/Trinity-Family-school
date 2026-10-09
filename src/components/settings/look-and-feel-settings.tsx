"use client";

import { Check, Monitor, Moon, Sun, RotateCcw, Palette, Image as ImageIcon } from "lucide-react";
import { GlassPageTopBar } from "@/components/common/glass-page-top-bar";
import { useAppearance, type ThemePreference } from "@/components/providers/theme-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Switch } from "@/components/ui/switch";
import { hasAndroidOfflineBridge } from "@/lib/offline/android-bridge";
import { cn } from "@/lib/utils";
import { DEFAULT_LOOK_AND_FEEL, THEME_PRESETS } from "@/lib/theme/appearance-settings";

const modes = [
  { id: "system", name: "Follow device", icon: Monitor },
  { id: "light", name: "Light", icon: Sun },
  { id: "dark", name: "Dark", icon: Moon },
] as const;
const choice = "min-h-12 rounded-xl border p-3 text-left transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60";
const selected = "border-brand-500 bg-brand-surface-50 text-brand-ink-800 dark:bg-brand-surface-950/50";
const unselected = "border-border bg-card text-card-foreground hover:bg-accent";

export function LookAndFeelSettings() {
  const { ready, changing, preference, lookAndFeel, storageAvailable, deviceColorsSupported, changeTheme, changeLookAndFeel } = useAppearance();
  const disabled = !ready || changing;
  const usingDeviceColors = lookAndFeel.deviceColors && deviceColorsSupported;
  const reset = async (origin: HTMLElement) => {
    await changeLookAndFeel(DEFAULT_LOOK_AND_FEEL, origin);
    await changeTheme("system", origin);
  };

  return <div className="mx-auto w-full max-w-5xl space-y-6 pb-8">
    <GlassPageTopBar title="Look and Feel" recordDetails="Saved on this device" leading={<Palette className="h-6 w-6 text-link" aria-hidden="true" />} sticky={false} />
    <div className="space-y-6 px-4 sm:px-6">
      <Card><CardContent className="space-y-4 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Appearance</h2>
        <p className="text-sm text-muted-foreground">Follow your device automatically, or choose the appearance you prefer.</p>
        <div role="group" aria-label="Appearance" className="grid grid-cols-3 gap-2 sm:gap-3">
          {modes.map(({ id, name, icon: Icon }) => <button key={id} type="button" aria-pressed={ready && preference === id} disabled={disabled}
            onClick={event => void changeTheme(id as ThemePreference, event.currentTarget)}
            className={cn(choice, "flex flex-col items-center gap-2 text-center text-xs sm:flex-row sm:text-sm", ready && preference === id ? selected : unselected)}>
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />{name}
          </button>)}
        </div>
      </CardContent></Card>

      <Card><CardContent className="space-y-4 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Theme</h2>
        <p className="text-sm text-muted-foreground">Both themes include matching light and dark colours.</p>
        {ready && hasAndroidOfflineBridge() && <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background p-4">
          <div className="space-y-1"><label htmlFor="device-colors" className="cursor-pointer text-sm font-semibold">Use device colours</label>
            <p id="device-colors-description" className="text-xs text-muted-foreground">{deviceColorsSupported ? "Match your wallpaper colours across the app, widgets and timetable notification." : "Available in the updated Android app on Android 12 or later."}</p></div>
          <Switch id="device-colors" aria-describedby="device-colors-description" checked={usingDeviceColors} disabled={disabled || !deviceColorsSupported}
            onCheckedChange={deviceColors => void changeLookAndFeel({ deviceColors })} />
        </div>}
        <div role="group" aria-label="Theme" className="grid gap-3 sm:grid-cols-2">
          {THEME_PRESETS.map(preset => <button key={preset.id} type="button" aria-pressed={ready && !usingDeviceColors && lookAndFeel.preset === preset.id} disabled={disabled}
            onClick={event => void changeLookAndFeel({ preset: preset.id, deviceColors: false }, event.currentTarget)}
            className={cn(choice, "space-y-3 p-4", ready && !usingDeviceColors && lookAndFeel.preset === preset.id ? selected : unselected)}>
            <span data-app-theme={preset.id} aria-hidden="true" className="flex h-24 overflow-hidden rounded-lg border border-border bg-background">
              <span className="flex w-12 flex-col gap-2 bg-brand-surface-950 p-3"><span className="h-4 w-4 rounded-full bg-brand-surface-400" /><span className="h-1 w-5 rounded bg-brand-surface-300" /><span className="h-1 w-5 rounded bg-brand-secondary-surface-300" /></span>
              <span className="flex flex-1 flex-col gap-3 p-3"><span className="h-2 w-20 rounded bg-brand-surface-400" /><span className="flex gap-2"><span className="h-9 flex-1 rounded border border-brand-300 bg-brand-surface-50 dark:bg-brand-surface-950/40" /><span className="h-9 flex-1 rounded bg-brand-secondary-surface-600" /></span></span>
            </span>
            <span className="flex items-center justify-between gap-2 font-semibold">{preset.name}{ready && !usingDeviceColors && lookAndFeel.preset === preset.id && <Check className="h-4 w-4" aria-hidden="true" />}</span>
            <span className="block text-sm text-muted-foreground">{preset.description}</span>
          </button>)}
        </div>
      </CardContent></Card>

      <Card><CardContent className="space-y-4 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Background</h2>
        <div role="group" aria-label="Background" className="grid grid-cols-2 gap-3">
          {([{ id: "illustration", name: "School illustration", icon: ImageIcon }, { id: "plain", name: "Plain", icon: Palette }] as const).map(({ id, name, icon: Icon }) => <button key={id} type="button" aria-pressed={ready && lookAndFeel.background === id} disabled={disabled}
            onClick={event => void changeLookAndFeel({ background: id }, event.currentTarget)}
            className={cn(choice, "flex items-center gap-3 text-sm", ready && lookAndFeel.background === id ? selected : unselected)}>
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />{name}
          </button>)}
        </div>
        <div className="space-y-2 pt-2">
          <label htmlFor="night-brightness" className="flex items-center justify-between gap-3 text-sm font-medium">Night illustration brightness <span className="text-muted-foreground">{100 - lookAndFeel.dimming}%</span></label>
          <input id="night-brightness" type="range" min="30" max="80" step="1" value={100 - lookAndFeel.dimming}
            disabled={disabled || lookAndFeel.background === "plain"} onChange={event => void changeLookAndFeel({ dimming: 100 - Number(event.target.value) })}
            className="min-h-11 w-full cursor-pointer accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default disabled:opacity-40" />
          <p className="text-xs text-muted-foreground">Keep the night artwork subtle so cards and text stay clear.</p>
        </div>
      </CardContent></Card>

      <Card><CardContent className="space-y-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4"><h2 className="text-lg font-semibold">Preview</h2><ThemeToggle /></div>
        <div data-testid="theme-preview" className="space-y-3 rounded-xl border border-border bg-background p-4">
          <p className="font-semibold text-brand-ink-700">Trinity Family School</p>
          <p className="text-sm text-muted-foreground">Your theme applies to cards, menus, buttons and links.</p>
          <div className="flex flex-wrap items-center gap-3"><Button>Primary button</Button><Button variant="link">Example link</Button><span className="rounded-full bg-brand-secondary-surface-100 px-3 py-1 text-sm text-brand-secondary-ink-800 dark:bg-brand-secondary-surface-950/60">Selected class</span><span className="text-sm text-emerald-700 dark:text-emerald-300">Active</span></div>
        </div>
      </CardContent></Card>
      {!storageAvailable && <p role="status" className="text-sm text-muted-foreground">Your changes work for this session. This browser could not save them for your next visit.</p>}
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Printed reports and PDF pages keep their original colours.</p><Button variant="outline" disabled={disabled} onClick={event => void reset(event.currentTarget)}><RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />Restore defaults</Button></div>
    </div>
  </div>;
}
