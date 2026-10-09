# Trinity application themes

Settings → Look and Feel offers Trinity Classic and Soft Indigo. Appearance is a separate preference: Follow device (the default), Light, or Dark. Staff can also open settings from the user menu; parents have a personal settings route. Preferences are saved on the current device, synchronize between browser tabs, and do not write school or account records.

The Android app also offers **Use device colours** on Android 12 or later. It reads Android's public wallpaper palette locally, without wallpaper access or extra permissions. This option is off by default and independent of Light/Dark/Follow device. Selecting a preset or restoring defaults turns it off. Older Android versions and the PWA retain the existing presets.

`DeviceColors.java` supplies validated paired light/dark roles through the native bridge. `src/lib/theme/device-colors.ts` applies screen-only semantic and accent variables and caches the public palette for offline startup. The provider refreshes colours on native configuration events and foreground entry without reloading the page. Widget and notification RemoteViews use Android colour resources so host reapplication resolves the current palette; saved manual light/dark modes use explicit tone references. Lesson/status/gender colours and paper/export colours retain their meaning. Native settings use the same saved preference.

Run `node --import tsx --test tests/device-colors.test.ts` and `node scripts/test-device-colors-browser.cjs` alongside the theme checks below. `DeviceColorsDeviceTest` checks public Android palette contrast; `TimetableAppearanceDeviceTest` covers widgets and collapsed/expanded notifications with the option enabled and disabled. The browser fixture uses public system colours and synthetic UI data.

## Colour roles

Use the shared semantic utilities for ordinary UI: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `ring-ring`. Primary buttons use `bg-primary text-primary-foreground`; links use `text-link hover:text-link-hover`.

Dialog contents use `bg-popover text-popover-foreground border-border`. Device colours also supply `--ui-neutral-{slate|gray|zinc|neutral|stone}-{shade}`: Tailwind's existing neutral utilities (including opacity, borders, gradients, hover and disabled states) resolve through these variables. Their fallbacks preserve the original preset colours when device colours are disabled. This compatibility layer prevents older cards and dialog sections from retaining navy backgrounds under a warm wallpaper palette; new components should still use semantic roles.

Calendar, chart thumb, scrollbar, sidebar and night-background materials follow the same device neutrals. Subject/status/gender accents remain independent. Paper scopes invalidate the neutral compatibility variables, restoring their exact original Tailwind values, and device variables apply only in screen media.

`npm run test:device-surfaces-browser` exercises warm and cool device palettes through the real provider, shared dialogs, alert dialogs, sheets, popovers, menus, selects, legacy neutral utility variants, cards and table rows. It also checks live wallpaper changes with a dialog open, input retention, exact restoration when disabled, and paper/print isolation.

For coloured sections, use these preset-aware families:

| Family | Trinity Classic | Soft Indigo |
| --- | --- | --- |
| `brand` | Blue | Indigo |
| `brand-alt` | Indigo | Indigo |
| `brand-secondary` | Purple | Violet |
| `brand-secondary-alt` | Violet | Violet |

Keep text separate from backgrounds:

```tsx
<a className="text-brand-ink-700 hover:text-brand-ink-800">Pupil details</a>
<div className="bg-brand-surface-50 hover:bg-brand-surface-100">Selected item</div>
<button className="bg-brand-surface-600 text-white hover:bg-brand-surface-700">Save</button>
```

`ink` shades become brighter in dark appearance. Pale `surface` shades become dark tints; saturated fills remain suitable for white labels. Coloured text gradients use `from-brand-ink-600`, etc. Borders and chart decorations use the primitive shades, e.g. `border-brand-200` or `rgb(var(--brand-500))`. Status, gender, school house and subject colours retain their meaning. Do not override status colours with a subject's accent.

Use complete class strings, never `text-${colour}-600`; Tailwind cannot reliably generate partial utilities. Shared pupil rows use `getPupilRowTheme` for hover and keyboard focus.

## Maintaining presets

`scripts/build-theme-presets.cjs` owns palette mappings and produces `src/app/brand-theme.css`. Run `npm run build:themes` and commit both when changing a preset. `tailwind.config.ts` exposes the same families. `src/app/theme.css` owns shared dark surfaces and motion. `src/lib/theme/appearance-settings.ts` validates stored preferences and applies them before hydration.

The settings model keeps theme, background, and night dimming independent from the saved appearance preference. Invalid settings fall back to Classic and the illustration; dimming is clamped. Background dimming affects the night illustration only. Reduced motion uses a short fade instead of the circular reveal.

## Paper and verification

PDF rendering, PDF bytes, downloads and document generation must not depend on screen preferences. Viewer controls follow the selected preset. `data-theme-surface="paper"` (and paper error/overlay surfaces) resets accents to Classic/light. Print media resets all screen theme roles to the original light palette. Do not migrate colour constants in document renderers or exported HTML templates.

Run `test:theme-types`, `test:theme-coverage`, `test:look-and-feel-browser`, `test:look-and-feel-navigation`, `test:theme-browser`, `test:dashboard-theme-browser`, `test:mobile-dashboard-theme-browser`, `test:pupil-theme-browser`, `test:pdf-theme-browser` and `test:pdf-workspace-contract` for theme changes. Browser fixtures render actual application components with synthetic data; they do not prove authenticated production routes were visited. The PDF suite compares real page and thumbnail pixels, PNG exports, original PDF download bytes and the print source. `node scripts/check-theme-migration.cjs <base-ref>` compares syntax trees to audit large colour migrations independently of the UI checks.

## Mobile dashboard cards

Below the dashboard's 1024px desktop breakpoint, statistic card accents and labels share the Total Pupils `brand` roles, including the cycling attendance card. Their translucent surfaces use the same card role and opacity. The expanded detail panels and chart data keep their meaningful colours.

`dashboard-timetable-card` owns the live timetable frame and `--dashboard-timetable-glow`. Charts, calendar, term schedule and both slideshow states use `dashboard-mobile-timetable-card` to share that frame on mobile. The old decorative strips and depth overlays are hidden there; photo overlays and controls stay intact. Use these classes for future dashboard cards instead of copying fixed gradients or shadows. Mobile overrides apply to screen media only.
