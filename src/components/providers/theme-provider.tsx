"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { ThemeProvider as NextThemeProvider, useTheme } from "next-themes";
import { androidOfflineRequest, hasAndroidOfflineBridge } from "@/lib/offline/android-bridge";
import { applyLookAndFeel, DEFAULT_LOOK_AND_FEEL, LOOK_AND_FEEL_BOOTSTRAP, LOOK_AND_FEEL_STORAGE_KEY, parseLookAndFeel, type LookAndFeelSettings } from "@/lib/theme/appearance-settings";

export type ThemePreference = "light" | "dark" | "system";
type ThemeTransition = { ready: Promise<void>; finished: Promise<void>; skipTransition: () => void };
type ThemeDocument = Document & { startViewTransition?: (update: () => void) => ThemeTransition };

const AppearanceContext = createContext<{
  ready: boolean;
  dark: boolean;
  preference: ThemePreference;
  changing: boolean;
  lookAndFeel: LookAndFeelSettings;
  storageAvailable: boolean;
  changeTheme: (theme: ThemePreference, origin: HTMLElement) => Promise<void>;
  changeLookAndFeel: (settings: Partial<LookAndFeelSettings>, origin?: HTMLElement) => Promise<void>;
} | null>(null);

function AppearanceProvider({ children }: { children: ReactNode }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [ready, setReady] = useState(false);
  const [changing, setChanging] = useState(false);
  const [lookAndFeel, setLookAndFeel] = useState(DEFAULT_LOOK_AND_FEEL);
  const settingsRef = useRef(DEFAULT_LOOK_AND_FEEL);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const active = useRef(false);

  useEffect(() => {
    const load = () => {
      let settings = DEFAULT_LOOK_AND_FEEL;
      try { settings = parseLookAndFeel(JSON.parse(localStorage.getItem(LOOK_AND_FEEL_STORAGE_KEY) || "{}")); }
      catch { /* Corrupt or unavailable storage falls back to a usable theme. */ }
      settingsRef.current = settings;
      setLookAndFeel(settings);
      applyLookAndFeel(settings);
    };
    load();
    setReady(true);
    const sync = (event: StorageEvent) => { if (event.key === LOOK_AND_FEEL_STORAGE_KEY || event.key === null) load(); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    if (!theme || !resolvedTheme || !hasAndroidOfflineBridge()) return;
    // Persist preference even when changing it leaves the visible palette unchanged.
    void androidOfflineRequest("appearance", { preference: theme, dark: resolvedTheme === "dark" }).catch(() => {});
  }, [theme, resolvedTheme]);
  useEffect(() => {
    const root = document.documentElement;
    let wasDark: boolean | null = null;
    const beforePrint = () => {
      if (wasDark === null) wasDark = root.classList.contains("dark");
      root.classList.remove("dark");
    };
    const afterPrint = () => { if (wasDark) root.classList.add("dark"); wasDark = null; };
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => { window.removeEventListener("beforeprint", beforePrint); window.removeEventListener("afterprint", afterPrint); };
  }, []);
  useEffect(() => {
    if (!resolvedTheme) return;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolvedTheme === "dark" ? "#0b1120" : "#f1f7ff");
  }, [resolvedTheme]);

  const transitionAppearance = async (apply: () => void, origin: HTMLElement) => {
    if (active.current) return;
    active.current = true;
    setChanging(true);
    const root = document.documentElement;
    const rect = origin.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const doc = document as ThemeDocument;
    const fades: Animation[] = [];

    try {
      if (doc.startViewTransition && !reduced) {
        root.dataset.themeReveal = "true";
        origin.dataset.themeControl = "active";
        const transition = doc.startViewTransition(apply);
        // A hidden tab or an overlapping browser transition can skip snapshot capture.
        // The update still runs; falling back should never undo the saved preference.
        try {
          await transition.ready;
          const animation = root.animate(
            { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
            {
              duration: 450, easing: "cubic-bezier(0.77, 0, 0.175, 1)", fill: "both",
              pseudoElement: "::view-transition-new(root)",
            },
          );
          await animation.finished;
        } catch { transition.skipTransition(); }
        await transition.finished.catch(() => {});
      } else {
        // Fade through a quiet surface on older WebViews; no DOM clone or screenshot library.
        const duration = reduced ? 80 : 120;
        const fadeOut = document.body.animate({ opacity: [1, 0.35] }, { duration, fill: "forwards" });
        fades.push(fadeOut);
        await fadeOut.finished;
        apply();
        const fadeIn = document.body.animate({ opacity: [0.35, 1] }, { duration, fill: "forwards" });
        fades.push(fadeIn);
        await fadeIn.finished;
      }
    } catch {
      // Appearance must remain usable even if a browser cancels its animation.
      apply();
    } finally {
      delete root.dataset.themeReveal;
      delete origin.dataset.themeControl;
      fades.forEach(animation => animation.cancel());
      active.current = false;
      setChanging(false);
    }
  };

  const changeTheme = async (preference: ThemePreference, origin: HTMLElement) => {
    if (active.current) return;
    const dark = preference === "system" ? window.matchMedia("(prefers-color-scheme: dark)").matches : preference === "dark";
    const apply = () => flushSync(() => setTheme(preference));
    // Remembering a preference does not need motion when its visible appearance is unchanged.
    if (dark === (resolvedTheme === "dark")) { apply(); return; }
    await transitionAppearance(apply, origin);
  };

  const changeLookAndFeel = async (patch: Partial<LookAndFeelSettings>, origin?: HTMLElement) => {
    if (active.current) return;
    const next = parseLookAndFeel({ ...settingsRef.current, ...patch });
    const previous = settingsRef.current;
    const apply = () => {
      settingsRef.current = next;
      applyLookAndFeel(next);
      flushSync(() => setLookAndFeel(next));
      try { localStorage.setItem(LOOK_AND_FEEL_STORAGE_KEY, JSON.stringify(next)); setStorageAvailable(true); }
      catch { setStorageAvailable(false); }
    };
    if (origin && (next.preset !== previous.preset || next.background !== previous.background)) {
      await transitionAppearance(apply, origin);
    } else apply();
  };

  return <AppearanceContext.Provider value={{ ready, dark: resolvedTheme === "dark", preference: (theme || "system") as ThemePreference, changing, changeTheme, lookAndFeel, storageAvailable, changeLookAndFeel }}>{children}</AppearanceContext.Provider>;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider attribute="class" defaultTheme="system" enableSystem enableColorScheme disableTransitionOnChange storageKey="trinity-appearance">
      <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: LOOK_AND_FEEL_BOOTSTRAP }} />
      <AppearanceProvider>{children}</AppearanceProvider>
    </NextThemeProvider>
  );
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error("useAppearance must be used within ThemeProvider");
  return context;
}
