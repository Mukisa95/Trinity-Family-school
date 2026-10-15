"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/contexts/auth-context";
import type { SchoolSettings } from "@/types";

interface DashboardWelcomeHeaderProps {
  schoolSettings?: { generalInfo?: SchoolSettings["generalInfo"] } | null;
}

export function DashboardWelcomeHeader({ schoolSettings }: DashboardWelcomeHeaderProps) {
  const { user } = useAuth();
  const [timeGreeting, setTimeGreeting] = useState("Welcome back");
  const [showGreeting, setShowGreeting] = useState(false);
  const [variation, setVariation] = useState(0);
  // Keep the decision through Strict Mode's effect cleanup/replay. A data refresh
  // must not restart the welcome, and switching accounts gets its own greeting.
  const sessionIntro = useRef<{ userId: string; play: boolean; variation: number } | null>(null);

  const displayName = useMemo(() => {
    if (user?.firstName) return user.firstName;
    const username = user?.username?.trim();
    if (!username) return "Friend";
    if (username.includes(" ")) return username.split(" ")[0];
    if (username.includes("_") || username.includes(".")) return username.split(/[_.]/)[0];
    return username.charAt(0).toUpperCase() + username.slice(1).toLowerCase();
  }, [user?.firstName, user?.username]);

  useEffect(() => {
    const hour = new Date().getHours();
    setTimeGreeting(hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");
    if (!user?.id) {
      sessionIntro.current = null;
      setShowGreeting(false);
      return;
    }

    const key = `trinity-dashboard-greeting:${user.id}`;
    if (sessionIntro.current?.userId !== user.id) {
      let seen = false;
      try { seen = sessionStorage.getItem(key) === "true"; } catch { /* Storage may be unavailable. */ }
      sessionIntro.current = { userId: user.id, play: !seen, variation: Math.floor(Math.random() * 8) };
    }
    const intro = sessionIntro.current;
    setVariation(intro.variation);
    setShowGreeting(intro.play);
    if (!intro.play) return;

    try { sessionStorage.setItem(key, "true"); } catch { /* The header still works without storage. */ }
    const timer = window.setTimeout(() => {
      intro.play = false;
      setShowGreeting(false);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [user?.id]);

  const greetings = [
    `Hello and welcome, ${displayName}! ${timeGreeting} ✨`,
    `Hey ${displayName}! ${timeGreeting} 🌟`,
    `Welcome back, ${displayName}! ${timeGreeting} 👋`,
    `${timeGreeting}, ${displayName}! Great to see you! 😊`,
    `Hi ${displayName}! ${timeGreeting} and welcome! 🎉`,
    `${timeGreeting}, ${displayName}! Ready to make magic? ✨`,
    `Hello ${displayName}! ${timeGreeting}! Let's do this! 💪`,
    `Welcome, ${displayName}! ${timeGreeting} 🌈`,
  ];

  return (
    <div className="dashboard-welcome-header container mx-auto px-3 sm:px-6 lg:px-8 pt-2 pb-3 sm:pt-3 sm:pb-4" data-greeting={showGreeting}>
      {/* Both layers reserve the same space, so the workspace never jumps. */}
      <div className="grid grid-cols-1 items-center">
        <div className="dashboard-welcome-greeting col-start-1 row-start-1 min-w-0" aria-hidden={!showGreeting}>
          <p className="text-lg font-bold tracking-tight text-brand-alt-ink-700 sm:text-xl md:text-2xl dark:text-brand-alt-ink-300">
            {greetings[variation]}
          </p>
          <div className="mt-1 h-1 w-16 rounded-full bg-brand-alt-500 sm:w-20" />
        </div>
        <div className="dashboard-welcome-identity col-start-1 row-start-1 flex min-w-0 items-center gap-3 sm:gap-4">
          {schoolSettings?.generalInfo?.logo && (
            <img
              src={schoolSettings.generalInfo.logo}
              alt="School Logo"
              className="dashboard-welcome-logo h-10 w-10 flex-shrink-0 rounded-lg object-contain sm:h-12 sm:w-12"
            />
          )}
          <div className="dashboard-welcome-text min-w-0">
            <p className="text-sm font-semibold text-brand-alt-ink-700 sm:text-base dark:text-brand-alt-ink-300">
              {timeGreeting}, {displayName}
            </p>
            <h1 className="truncate text-base font-bold tracking-tight text-gray-900 sm:text-lg md:text-xl dark:text-slate-100">
              {schoolSettings?.generalInfo?.name || "TRINITY FAMILY NURSERY AND PRIMARY SCHOOL"}
            </h1>
            <p className="truncate text-[11px] font-medium uppercase tracking-wide text-gray-500 sm:text-xs dark:text-slate-400">
              {schoolSettings?.generalInfo?.motto || "GUIDING GROWTH, INSPIRING GREATNESS"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
