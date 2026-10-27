"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { CalendarDays, MapPin } from "lucide-react";
import { useAuth } from "@/lib/contexts/auth-context";
import { useSchoolDate } from '@/lib/hooks/use-school-date';
import type { Event, SchoolSettings } from "@/types";
import { ExamEventClasses } from '@/components/events/ui/exam-event-classes';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DASHBOARD_BRIEFING_MS, DASHBOARD_GREETING_MS, formatBriefingEventDate,
  getDashboardEventBriefing, getEventEndNotice,
} from "@/lib/utils/dashboard-event-briefing";

const NO_EVENTS: Event[] = [];

interface DashboardWelcomeHeaderProps {
  schoolSettings?: { generalInfo?: SchoolSettings["generalInfo"] } | null;
  events?: Event[];
}

export function DashboardWelcomeHeader({ schoolSettings, events = NO_EVENTS }: DashboardWelcomeHeaderProps) {
  const { user } = useAuth();
  const schoolDate = useSchoolDate();
  const [timeGreeting, setTimeGreeting] = useState("Welcome back");
  const [showGreeting, setShowGreeting] = useState(false);
  const [variation, setVariation] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [briefingEvents, setBriefingEvents] = useState<Event[]>([]);
  const [briefingIndex, setBriefingIndex] = useState(0);
  const [weekOpen, setWeekOpen] = useState(false);
  const dayKey = format(now, 'yyyy-MM-dd');
  const briefing = useMemo(() => getDashboardEventBriefing(events, now), [events, now]);
  // Keep the decision through Strict Mode's effect cleanup/replay. A data refresh
  // must not restart the welcome, and switching accounts gets its own greeting.
  const sessionIntro = useRef<{
    userId: string; day: string; play: boolean; variation: number; briefingDone: boolean;
  } | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setInterval(update, 60_000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  const displayName = useMemo(() => {
    if (user?.firstName) return user.firstName;
    const username = user?.username?.trim();
    if (!username) return "Friend";
    if (username.includes(" ")) return username.split(" ")[0];
    if (username.includes("_") || username.includes(".")) return username.split(/[_.]/)[0];
    return username.charAt(0).toUpperCase() + username.slice(1).toLowerCase();
  }, [user?.firstName, user?.username]);

  useEffect(() => {
    const hour = now.getHours();
    setTimeGreeting(hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");
  }, [now]);

  useEffect(() => {
    setBriefingEvents([]);
    setBriefingIndex(0);
    setWeekOpen(false);
    if (!user?.id) {
      sessionIntro.current = null;
      setShowGreeting(false);
      return;
    }

    const key = `trinity-dashboard-greeting:${user.id}:${dayKey}`;
    if (sessionIntro.current?.userId !== user.id || sessionIntro.current.day !== dayKey) {
      let seen = false;
      let briefingSeen = false;
      try { seen = sessionStorage.getItem(key) === "true"; } catch { /* Storage may be unavailable. */ }
      try { briefingSeen = sessionStorage.getItem(`trinity-dashboard-briefing:${user.id}:${dayKey}`) === "true"; } catch { /* Optional storage. */ }
      sessionIntro.current = { userId: user.id, day: dayKey, play: !seen, variation: Math.floor(Math.random() * 8), briefingDone: briefingSeen };
    }
    const intro = sessionIntro.current;
    setVariation(intro.variation);
    setShowGreeting(intro.play);
    if (!intro.play) return;

    try { sessionStorage.setItem(key, "true"); } catch { /* The header still works without storage. */ }
    const timer = window.setTimeout(() => {
      intro.play = false;
      setShowGreeting(false);
    }, DASHBOARD_GREETING_MS);
    return () => window.clearTimeout(timer);
  }, [user?.id, dayKey]);

  useEffect(() => {
    const intro = sessionIntro.current;
    if (!user?.id || intro?.userId !== user.id || intro.day !== dayKey
      || intro.play || showGreeting || intro.briefingDone || !briefing.today.length) return;
    intro.briefingDone = true;
    try { sessionStorage.setItem(`trinity-dashboard-briefing:${user.id}:${dayKey}`, 'true'); } catch { /* Optional storage. */ }
    setBriefingIndex(0);
    setBriefingEvents(briefing.today);
  }, [briefing.today, dayKey, showGreeting, user?.id]);

  useEffect(() => {
    if (!briefingEvents.length || showGreeting || weekOpen) return;
    const timer = window.setTimeout(() => {
      if (briefingIndex + 1 < briefingEvents.length) setBriefingIndex(index => index + 1);
      else setBriefingEvents([]);
    }, DASHBOARD_BRIEFING_MS / briefingEvents.length);
    return () => window.clearTimeout(timer);
  }, [briefingEvents, briefingIndex, showGreeting, weekOpen]);

  const activeEvent = !showGreeting ? briefingEvents[briefingIndex] : undefined;
  const activeEventId = briefing.today.some(event => event.id === activeEvent?.id) ? activeEvent?.id : undefined;
  const phase = showGreeting ? 'greeting' : activeEventId ? 'briefing' : 'identity';

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
    <div className="dashboard-welcome-header container mx-auto px-3 sm:px-6 lg:px-8 pt-2 pb-3 sm:pt-3 sm:pb-4" data-greeting={showGreeting} data-phase={phase}>
      {/* Overlapping layers reserve space before the greeting and event reveals. */}
      <div className="grid grid-cols-1 items-center">
        <div className="dashboard-welcome-greeting col-start-1 row-start-1 min-w-0" aria-hidden={!showGreeting}>
          <p className="text-lg font-bold tracking-tight text-brand-alt-ink-700 sm:text-xl md:text-2xl dark:text-brand-alt-ink-300">
            {greetings[variation]}
          </p>
          <div className="mt-1 h-1 w-16 rounded-full bg-brand-alt-500 sm:w-20" />
        </div>
        {briefing.today.length > 0 && (
          <div className="dashboard-welcome-briefing col-start-1 row-start-1 grid min-w-0" aria-hidden={phase !== 'briefing'} aria-live="polite" aria-atomic="true">
            {briefing.today.map(event => (
              <div key={event.id} className="col-start-1 row-start-1 min-w-0" style={{ visibility: event.id === activeEventId ? 'visible' : 'hidden' }} aria-hidden={event.id !== activeEventId}>
                <p className="flex items-center gap-2 text-sm font-semibold text-brand-alt-ink-700 sm:text-base dark:text-brand-alt-ink-300">
                  <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" /> Today
                </p>
                <p className="mt-1 break-words text-base font-bold leading-snug tracking-tight text-foreground sm:text-lg md:text-xl">{event.title}</p>
                {event.isExamEvent && <ExamEventClasses event={event} />}
                {getEventEndNotice(event, now) && <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{getEventEndNotice(event, now)}</p>}
              </div>
            ))}
          </div>
        )}
        <div className="dashboard-welcome-identity col-start-1 row-start-1 flex min-w-0 items-center gap-3 sm:gap-4" aria-hidden={phase !== 'identity'}>
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
            <time dateTime={schoolDate} className="block truncate text-xs text-gray-500 dark:text-slate-400" data-dashboard-date>
              {format(new Date(`${schoolDate}T12:00:00`), 'EEEE, d MMMM yyyy')}
            </time>
          </div>
        </div>
      </div>
      {briefing.laterThisWeek.length > 0 && (
        <Dialog open={weekOpen} onOpenChange={setWeekOpen}>
          <div className={`dashboard-welcome-weekly mt-1 ${showGreeting ? 'invisible pointer-events-none' : ''}`} aria-hidden={showGreeting}>
            <DialogTrigger asChild>
              <button type="button" disabled={showGreeting} className="min-h-11 rounded-md py-2 text-left text-xs font-medium text-brand-alt-ink-700 underline decoration-current/40 underline-offset-4 hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm dark:text-brand-alt-ink-300">
                You have {briefing.laterThisWeek.length} more {briefing.laterThisWeek.length === 1 ? 'event' : 'events'} this week
              </button>
            </DialogTrigger>
          </div>
          <DialogContent className="sm:max-w-xl print:hidden">
            <DialogTitle className="pr-7">More events this week</DialogTitle>
            <DialogDescription>Coming up through Sunday, {format(briefing.weekEnd, 'd MMMM')}. Times use your local calendar.</DialogDescription>
            <ul className="space-y-3">
              {briefing.laterThisWeek.map(event => (
                <li key={event.id} className="rounded-xl border border-border bg-muted/30 p-3 sm:p-4">
                  <p className="break-words font-semibold text-foreground">{event.title}</p>
                  {event.isExamEvent && <ExamEventClasses event={event} />}
                  <p className="mt-1 text-sm text-muted-foreground">{formatBriefingEventDate(event)}</p>
                  {event.location && <p className="mt-1 flex items-start gap-1.5 break-words text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{event.location}</p>}
                  {event.description && <p className="mt-2 whitespace-pre-line break-words text-sm text-muted-foreground">{event.description}</p>}
                </li>
              ))}
            </ul>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
