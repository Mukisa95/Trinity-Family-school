export const LOOK_AND_FEEL_STORAGE_KEY = "trinity-look-and-feel";

export const THEME_PRESETS = [
  { id: "trinity-classic", name: "Trinity Classic", description: "Our familiar blue and purple, balanced for both appearances." },
  { id: "soft-indigo", name: "Soft Indigo", description: "Calmer indigo and lavender with the same Trinity layout." },
] as const;

export type ThemePreset = typeof THEME_PRESETS[number]["id"];
export type BackgroundStyle = "illustration" | "plain";
export interface LookAndFeelSettings {
  preset: ThemePreset;
  background: BackgroundStyle;
  dimming: number;
}

export const DEFAULT_LOOK_AND_FEEL: LookAndFeelSettings = {
  preset: "trinity-classic", background: "illustration", dimming: 37,
};

export function parseLookAndFeel(value: unknown): LookAndFeelSettings {
  const input = value && typeof value === "object" ? value as Partial<LookAndFeelSettings> : {};
  return {
    preset: THEME_PRESETS.some(preset => preset.id === input.preset) ? input.preset! : DEFAULT_LOOK_AND_FEEL.preset,
    background: input.background === "plain" ? "plain" : "illustration",
    dimming: typeof input.dimming === "number" && Number.isFinite(input.dimming)
      ? Math.min(70, Math.max(20, Math.round(input.dimming))) : DEFAULT_LOOK_AND_FEEL.dimming,
  };
}

export function applyLookAndFeel(settings: LookAndFeelSettings) {
  const root = document.documentElement;
  root.dataset.appTheme = settings.preset;
  root.dataset.appBackground = settings.background;
  root.style.setProperty("--night-dim-top", String((settings.dimming - 5) / 100));
  root.style.setProperty("--night-dim-bottom", String((settings.dimming + 5) / 100));
}

// Runs before the page paints, alongside next-themes' appearance bootstrap.
export const LOOK_AND_FEEL_BOOTSTRAP = `(${function () {
  const root = document.documentElement;
  let value: { preset?: string; background?: string; dimming?: number } = {};
  try { value = JSON.parse(localStorage.getItem("trinity-look-and-feel") || "{}") || {}; } catch {}
  const dim = typeof value.dimming === "number" && Number.isFinite(value.dimming) ? Math.min(70, Math.max(20, Math.round(value.dimming))) : 37;
  root.dataset.appTheme = value.preset === "soft-indigo" ? "soft-indigo" : "trinity-classic";
  root.dataset.appBackground = value.background === "plain" ? "plain" : "illustration";
  root.style.setProperty("--night-dim-top", String((dim - 5) / 100));
  root.style.setProperty("--night-dim-bottom", String((dim + 5) / 100));
}.toString()})();`;
