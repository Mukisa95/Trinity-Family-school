"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { ThemeProvider as NextThemeProvider, useTheme } from "next-themes";

export type ThemePreference = "light" | "dark" | "system";
type ThemeTransition = { ready: Promise<void>; finished: Promise<void>; skipTransition: () => void };
type ThemeDocument = Document & { startViewTransition?: (update: () => void) => ThemeTransition };

const AppearanceContext = createContext<{
  ready: boolean;
  dark: boolean;
  preference: ThemePreference;
  changing: boolean;
  changeTheme: (theme: ThemePreference, origin: HTMLElement) => Promise<void>;
} | null>(null);

function AppearanceProvider({ children }: { children: ReactNode }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [ready, setReady] = useState(false);
  const [changing, setChanging] = useState(false);
  const active = useRef(false);

  useEffect(() => setReady(true), []);
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

  const changeTheme = async (preference: ThemePreference, origin: HTMLElement) => {
    if (active.current) return;
    const dark = preference === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : preference === "dark";
    const apply = () => flushSync(() => setTheme(preference));
    // Changing the saved preference need not animate when the visible palette is unchanged.
    if (dark === (resolvedTheme === "dark")) { apply(); return; }

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
      fades.forEach(animation => animation.cancel());
      active.current = false;
      setChanging(false);
    }
  };

  return <AppearanceContext.Provider value={{ ready, dark: resolvedTheme === "dark", preference: (theme || "light") as ThemePreference, changing, changeTheme }}>{children}</AppearanceContext.Provider>;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider attribute="class" defaultTheme="light" enableSystem enableColorScheme disableTransitionOnChange storageKey="trinity-appearance">
      <AppearanceProvider>{children}</AppearanceProvider>
    </NextThemeProvider>
  );
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error("useAppearance must be used within ThemeProvider");
  return context;
}
