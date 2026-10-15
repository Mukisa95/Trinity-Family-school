# Pixel Terracotta

A fixed Material You preset available in Look and Feel and first-time welcome
setup, alongside Trinity Classic and Soft Indigo. It works in browsers and
Android without requiring a native bridge or changing the device wallpaper.

## Palette source

Captured on 10 October 2026 from a connected Pixel 7's public Android colour
resources. The phone used the EXPRESSIVE style and seed `A95132`. Only colours
were exported; no wallpaper image or account data belongs in the preset.

`src/lib/theme/pixel-terracotta-palette.json` contains all 13 tones for primary,
secondary, tertiary, neutral and neutral variant, with the same 14 light/dark
roles used by native `DeviceColors.java`. Light mode uses `#FFFBFF` surfaces and
`#8F4C35` primary; dark mode uses `#2A170D` surfaces and `#FFB59D` primary.

`scripts/build-theme-presets.cjs` validates the captured palette and reuses
`devicePaletteCss` to generate screen-only CSS. This keeps semantic surfaces,
legacy neutral utilities, glass, navigation, charts and calendar roles on the
same palette. Rebuild with `npm.cmd run build:themes` after changing role mapping.

## Fixed preset versus live device colours

Pixel Terracotta stays the same when a wallpaper changes. Selecting any named
preset disables live device colours. Android's **Use device colours** option
still takes priority when enabled and follows that phone's own live palette.
The existing paper/PDF colour reset and print stylesheet remain independent.

## Validation

Run `npm.cmd run test:theme-palettes`, `npm.cmd run test:theme-types`,
`npm.cmd run test:look-and-feel-browser`, and
`npm.cmd run test:workspace-welcome-browser`. Browser fixtures measure light/dark
text and hover contrast, print isolation, desktop persistence without Android,
and the welcome theme choice with responsive Material You layouts.
