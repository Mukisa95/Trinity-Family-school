export const DEVICE_COLORS_STORAGE_KEY = "trinity-device-colors";
export type DevicePalette = {
  supported: true;
  palettes: Record<string, Record<string, string>>;
  light: Record<string, string>;
  dark: Record<string, string>;
};

/** Accept only the public Android palette contract, never arbitrary CSS from storage/bridge data. */
export function parseDevicePalette(value: unknown): DevicePalette | null {
  if (!value || typeof value !== "object") return null;
  const input = value as DevicePalette;
  if (input.supported !== true) return null;
  const families = ["primary", "secondary", "tertiary", "neutral", "neutralVariant"];
  const tones = [0, 10, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
  const roles = ["background", "surface", "foreground", "muted", "mutedForeground", "outline", "primary", "onPrimary", "primaryContainer", "onPrimaryContainer", "secondary", "onSecondary", "secondaryContainer", "onSecondaryContainer"];
  const hex = (color: unknown): color is string => typeof color === "string" && /^#[\da-f]{6}$/i.test(color);
  const palettes: DevicePalette["palettes"] = {};
  for (const family of families) {
    palettes[family] = {};
    for (const tone of tones) {
      const color = input.palettes?.[family]?.[tone];
      if (!hex(color)) return null;
      palettes[family][tone] = color;
    }
  }
  const light: DevicePalette["light"] = {}, dark: DevicePalette["dark"] = {};
  for (const role of roles) {
    if (!hex(input.light?.[role]) || !hex(input.dark?.[role])) return null;
    light[role] = input.light[role]; dark[role] = input.dark[role];
  }
  return { supported: true, palettes, light, dark };
}

export function devicePaletteCss(palette: DevicePalette): string {
  const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const channels = (hex: string) => rgb(hex).join(" ");
  const hsl = (hex: string) => {
    const [r, g, b] = rgb(hex).map(n => n / 255), max = Math.max(r, g, b), min = Math.min(r, g, b);
    const delta = max - min, light = (max + min) / 2;
    const hue = !delta ? 0 : max === r ? ((g - b) / delta + (g < b ? 6 : 0)) * 60 : max === g ? ((b - r) / delta + 2) * 60 : ((r - g) / delta + 4) * 60;
    const saturation = !delta ? 0 : delta / (1 - Math.abs(2 * light - 1));
    return `${hue.toFixed(2)} ${(saturation * 100).toFixed(2)}% ${(light * 100).toFixed(2)}%`;
  };
  const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
  const families = { brand: "primary", "brand-alt": "primary", "brand-secondary": "secondary", "brand-secondary-alt": "tertiary" };
  const roles = (dark: boolean) => {
    const colors = dark ? palette.dark : palette.light;
    const declarations: string[] = [];
    const add = (name: string, value: string) => declarations.push(`--${name}:${value};`);
    // Many existing screens use neutral utilities rather than semantic roles.
    // Adapt their shared primitives so every utility, gradient and opacity variant
    // follows the wallpaper hue without hundreds of page-specific overrides.
    const neutralTones: Record<number, number> = { 50: 10, 100: 50, 200: 100, 300: 200, 400: 400, 500: 600, 600: 700, 700: 700, 800: 800, 900: 900, 950: 1000 };
    for (const family of ["slate", "gray", "zinc", "neutral", "stone"]) {
      for (const shade of shades) {
        const value = dark && shade === 950 ? colors.background : palette.palettes.neutral[neutralTones[shade]];
        add(`ui-neutral-${family}-${shade}`, channels(value));
      }
    }
    for (const [family, source] of Object.entries(families)) {
      const tones = palette.palettes[source];
      for (const shade of shades) {
        const tone = shade === 950 ? 1000 : shade;
        add(`${family}-${shade}`, channels(tones[tone]));
        const ink = dark ? shade >= 900 ? 100 : shade >= 700 ? 200 : shade >= 500 ? 300 : tone : tone;
        add(`${family}-ink-${shade}`, channels(tones[ink]));
        // Solid 400/500/600+ fills retain dark enough tones for existing white button labels.
        const fill = shade === 400 || shade === 500 ? 600 : tone;
        const surface = dark && shade <= 200 ? rgb(colors.surface).map((n, i) => Math.round(n * .8 + rgb(tones[200])[i] * .2)).join(" ") : channels(tones[fill]);
        add(`${family}-surface-${shade}`, surface);
      }
    }
    const map: Record<string, string> = { background: "background", foreground: "foreground", card: "surface", "card-foreground": "foreground", popover: "muted", "popover-foreground": "foreground", primary: "primary", "primary-foreground": "onPrimary", secondary: "secondaryContainer", "secondary-foreground": "onSecondaryContainer", muted: "muted", "muted-foreground": "mutedForeground", accent: "primaryContainer", "accent-foreground": "onPrimaryContainer", border: "outline", input: "outline", ring: "primary", "sidebar-background": "surface", "sidebar-foreground": "foreground", "sidebar-accent": "primaryContainer", "sidebar-accent-foreground": "onPrimaryContainer", "sidebar-border": "outline", "sidebar-primary": "primary", "sidebar-primary-foreground": "onPrimary", "sidebar-ring": "primary" };
    for (const [variable, role] of Object.entries(map)) add(variable, hsl(colors[role]));
    add("glass-surface", channels(colors.surface)); add("glass-edge", channels(colors.outline));
    add("night-background", channels(colors.background));
    add("link", channels(colors.primary)); add("link-hover", channels(colors.foreground));
    add("brand-fill", channels(palette.palettes.primary[600])); add("brand-fill-hover", channels(palette.palettes.primary[700])); add("brand-on-fill", channels(palette.palettes.primary[0]));
    add("calendar-today", colors.primary); add("calendar-control", colors.primary); add("dashboard-tracker-border", colors.outline);
    add("chart-axis", colors.mutedForeground); add("chart-axis-strong", colors.foreground); add("chart-grid", colors.outline); add("chart-track", colors.muted); add("chart-value", colors.foreground);
    add("chart-thumb-top", palette.palettes.neutral[dark ? 600 : 0]);
    add("chart-thumb-middle", colors.muted); add("chart-thumb-edge", colors.surface); add("chart-thumb-label", colors.foreground); add("chart-thumb-label-shadow", "none");
    add("calendar-text", colors.foreground); add("calendar-muted", colors.mutedForeground); add("calendar-hover", colors.muted); add("calendar-control-bg", colors.surface);
    add("calendar-border", `rgb(${channels(colors.outline)} / .3)`);
    add("scrollbar-thumb", colors.outline); add("scrollbar-track", colors.background);
    add("schedule-bg", colors.surface); add("schedule-neutral-bg", colors.muted); add("schedule-border", colors.outline); add("schedule-muted", colors.mutedForeground);
    add("schedule-empty-bg", colors.surface);
    // These lesson roles normally reference brand accents; keep their subject identity under device colours.
    const lessonTones = { indigo: { 50: "#EEF2FF", 100: "#E0E7FF", 200: "#C7D2FE", 300: "#A5B4FC", 700: "#4338CA", 900: "#312E81", 950: "#1E1B4B" }, violet: { 50: "#F5F3FF", 100: "#EDE9FE", 200: "#DDD6FE", 300: "#C4B5FD", 700: "#6D28D9", 900: "#4C1D95", 950: "#2E1065" } };
    for (const [hue, tones] of Object.entries(lessonTones)) {
      add(`lesson-${hue}-ink`, channels(tones[dark ? 300 : 700]));
      add(`lesson-${hue}-surface`, channels(tones[dark ? 950 : 50]));
      add(`lesson-${hue}-hover`, channels(tones[dark ? 900 : 100]));
      add(`lesson-${hue}-border`, channels(tones[dark ? 700 : 300]));
      add(`lesson-${hue}-header`, channels(tones[dark ? 900 : 700]));
      add(`lesson-${hue}-header-ink`, dark ? channels(tones[200]) : "255 255 255");
    }
    return declarations.join("");
  };
  // Screen-only root roles leave report/PDF descendants and print colours on the existing pipeline.
  return `@media screen{html[data-device-colors="true"]{${roles(false)}}html.dark[data-device-colors="true"]{${roles(true)}}}`;
}

export function applyDevicePalette(palette: DevicePalette | null, enabled: boolean) {
  const root = document.documentElement;
  if (!palette || !enabled) { delete root.dataset.deviceColors; return; }
  let style = document.getElementById("trinity-device-colors") as HTMLStyleElement | null;
  if (!style) { style = document.createElement("style"); style.id = "trinity-device-colors"; document.head.appendChild(style); }
  style.textContent = devicePaletteCss(palette);
  root.dataset.deviceColors = "true";
}

// Reuse the last verified palette before first paint, including offline starts.
export const DEVICE_COLORS_BOOTSTRAP = `(${function (parse: typeof parseDevicePalette, css: typeof devicePaletteCss) {
  try {
    if (!(window as Window & { TrinityOffline?: unknown }).TrinityOffline) return;
    const settings = JSON.parse(localStorage.getItem("trinity-look-and-feel") || "{}");
    if (settings.deviceColors !== true) return;
    const palette = parse(JSON.parse(localStorage.getItem("trinity-device-colors") || "null"));
    if (!palette) return;
    const style = document.createElement("style"); style.id = "trinity-device-colors"; style.textContent = css(palette); document.head.appendChild(style);
    document.documentElement.dataset.deviceColors = "true";
  } catch { /* Cached device colours are optional; the normal theme remains usable. */ }
}.toString()})(${parseDevicePalette.toString()},${devicePaletteCss.toString()});`;
