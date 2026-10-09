"use client";

import * as React from "react";
import { useTimetablePeriods, useTimetableEntries, useTimetableProfiles } from "@/lib/hooks/use-timetable";
import { useClasses } from "@/lib/hooks/use-classes";
import { useSubjects } from "@/lib/hooks/use-subjects";
import { Check, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { formatTimetableCountdown } from "@/lib/utils/timetable-time";
import { getTimetableStreamInitial } from "@/lib/utils/timetable-streams";

interface LiveTrackerProps {
    yearId: string;
    termId: string;
    profileId: string;
    profileName?: string;
    liveEnabled?: boolean;
    selected?: boolean;
    onSelect?: () => void;
}

function parseTimeToMins(t: string): number {
    const [h, m] = (t || "00:00").split(":").map(Number);
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

export function LiveTracker({
    yearId,
    termId,
    profileId,
    profileName,
    liveEnabled = true,
    selected = false,
    onSelect,
}: LiveTrackerProps) {
    const { data: profiles = [] } = useTimetableProfiles(yearId, termId);
    const profile = profiles.find(p => p.id === profileId);
    const { data: periods = [] } = useTimetablePeriods(yearId, termId, profileId);
    const { data: entries = [] } = useTimetableEntries(yearId, termId, profileId);
    const { data: classes = [] } = useClasses();
    const { data: subjects = [] } = useSubjects();

    const [currentTime, setCurrentTime] = React.useState(new Date());

    React.useEffect(() => {
        if (!liveEnabled) return;
        const interval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, [liveEnabled]);


    const [viewOffset, setViewOffset] = React.useState(0);

    const currentDayOfWeek = currentTime.getDay() || 7;
    const currentTimePeriodStr = format(currentTime, "HH:mm"); // for period boundary comparison
    const currentSecs = currentTime.getHours() * 3600 + currentTime.getMinutes() * 60 + currentTime.getSeconds();

    const todayPeriods = periods
        .filter(p => p.dayOfWeek === currentDayOfWeek)
        .sort((a, b) => parseTimeToMins(a.startTime) - parseTimeToMins(b.startTime));

    let baseIndex = todayPeriods.findIndex(p =>
        currentTimePeriodStr >= p.startTime && currentTimePeriodStr < p.endTime
    );

    if (baseIndex === -1) {
        baseIndex = todayPeriods.findIndex(p => p.startTime > currentTimePeriodStr);
        if (baseIndex === -1) baseIndex = Math.max(0, todayPeriods.length - 1);
    }

    const viewingIndex = Math.max(0, Math.min(todayPeriods.length - 1, baseIndex + viewOffset));
    const activePeriod = todayPeriods[viewingIndex];
    const isLive = viewOffset === 0 && currentTimePeriodStr >= activePeriod?.startTime && currentTimePeriodStr < activePeriod?.endTime;

    // Auto-reset offset if the actual period moves on and they were left on "Live"
    React.useEffect(() => {
        if (viewOffset === 0 && baseIndex !== -1 && viewingIndex !== baseIndex) {
            // Re-sync internally if the actual time advanced
        }
    }, [baseIndex, viewOffset, viewingIndex]);

    const handleNext = () => setViewOffset(prev => Math.min(todayPeriods.length - 1 - baseIndex, prev + 1));
    const handlePrev = () => setViewOffset(prev => Math.max(0 - baseIndex, prev - 1));
    const handleLive = () => setViewOffset(0);

    const nextPeriod = todayPeriods[viewingIndex + 1];
    const prevPeriod = todayPeriods[viewingIndex - 1];

    const timetableLabel = profileName || profile?.name || "Timetable";
    const selectionControl = onSelect ? (
        <button
            type="button"
            onClick={(event) => {
                event.stopPropagation();
                onSelect();
            }}
            aria-pressed={selected}
            aria-controls="selected-timetable-panel"
            className={`hidden h-8 flex-shrink-0 items-center gap-1 rounded-full border px-2.5 text-[9px] font-extrabold uppercase tracking-wide transition-colors sm:inline-flex ${selected
                ? "border-brand-alt-200 bg-brand-alt-surface-50 text-brand-alt-ink-700 dark:border-brand-alt-800/60 dark:bg-brand-alt-surface-950/40 dark:text-brand-alt-ink-300"
                : "border-slate-200 bg-white text-slate-600 hover:border-brand-alt-200 hover:bg-brand-alt-surface-50 hover:text-brand-alt-ink-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-alt-800/60 dark:hover:bg-brand-alt-surface-950/40 dark:hover:text-brand-alt-ink-300"
            }`}
        >
            <span>{selected ? "Timetable shown" : "View timetable"}</span>
            {selected ? <Check className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
    ) : null;

    const handleCardSelect = (event: React.MouseEvent<HTMLElement>) => {
        if (selected || !onSelect) return;
        const target = event.target as HTMLElement;
        if (target.closest("button, a, input, select, textarea")) return;
        onSelect();
    };

    if (!liveEnabled || !activePeriod) {
        const statusLabel = liveEnabled ? "No active lesson" : "Saved timetable";
        const statusDescription = liveEnabled
            ? nextPeriod
                ? `Next: ${nextPeriod.type === 'lesson' ? `L${nextPeriod.periodNumber}` : (nextPeriod.customLabel || nextPeriod.type)} at ${nextPeriod.startTime}`
                : "All classes finished for today."
            : selected
                ? "This timetable is shown below."
                : "Select this card to view and manage its timetable.";
        return (
            <section
                onClick={handleCardSelect}
                className={`relative h-full min-w-0 overflow-hidden rounded-2xl border bg-white p-3 pl-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all  dark:bg-slate-900 ${selected
                    ? "border-brand-alt-200 shadow-[0_12px_34px_rgba(79,70,229,0.12)] dark:border-brand-alt-800/60"
                    : "border-amber-200/80 hover:border-brand-alt-200 hover:shadow-[0_10px_28px_rgba(79,70,229,0.09)] dark:border-amber-800/80 dark:hover:border-brand-alt-800/60"
                } ${!selected && onSelect ? "cursor-pointer" : ""}`}
            >
                <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${liveEnabled ? "from-amber-400 to-orange-500" : "from-brand-alt-surface-500 to-brand-secondary-alt-surface-500"}`} />
                <div className="flex min-h-[52px] items-center gap-3">
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ring-1 ${liveEnabled
                        ? "bg-amber-50 text-amber-600 ring-amber-200/70 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-800/70"
                        : "bg-brand-alt-surface-50 text-brand-alt-ink-600 ring-brand-alt-200/70 dark:bg-brand-alt-surface-950/40 dark:text-brand-alt-ink-400 dark:ring-brand-alt-800/70"
                    }`}>
                        <Clock className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <button type="button" onClick={onSelect} disabled={!onSelect} aria-pressed={selected} aria-controls="selected-timetable-panel"
                                className="truncate text-left text-sm font-bold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-alt-500 dark:text-slate-100">{timetableLabel}</button>
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ring-1 ring-inset ${liveEnabled
                                ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/60"
                                : "bg-brand-alt-surface-50 text-brand-alt-ink-700 ring-brand-alt-200 dark:bg-brand-alt-surface-950/40 dark:text-brand-alt-ink-300 dark:ring-brand-alt-800/60"
                            }`}>
                                {statusLabel}
                            </span>
                        </div>
                        <span className="mt-1 block truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                            {statusDescription}
                        </span>
                    </div>
                    {selectionControl}
                </div>
            </section>
        );
    }

    // ── Progress calculation (seconds precision) ──────────────────────────────
    const startSecs = parseTimeToMins(activePeriod.startTime) * 60;
    const endSecs = parseTimeToMins(activePeriod.endTime) * 60;
    const totalSecs = Math.max(endSecs - startSecs, 1);
    const elapsedSecs = Math.min(Math.max(currentSecs - startSecs, 0), totalSecs);
    const progressPct = (elapsedSecs / totalSecs) * 100;
    // Clamp the pill so it stays fully visible inside the track
    const clampedPct = Math.min(Math.max(progressPct, 4), 96);

    // Match TimetableGrid's exact class ordering:
    // filter the `classes` array (which has the canonical order) by the profile's classIds
    const classesToRender = (profile?.classIds?.length)
        ? classes.filter(c => profile!.classIds.includes(c.id))
        : classes;

    const activeEntries = entries
        .filter(e => e.periodId === activePeriod.id)
        .sort((a, b) => {
            const ai = classesToRender.findIndex(c => c.id === a.classId);
            const bi = classesToRender.findIndex(c => c.id === b.classId);
            return (ai === -1 ? 9999 : ai) - (bi === -1 ? 9999 : bi);
        });
    const periodLabel = activePeriod.type === 'lesson'
        ? `L${activePeriod.periodNumber}`
        : activePeriod.customLabel || activePeriod.type;

    // Countdown
    let countdownStr = "";
    if (currentSecs < startSecs) {
        const diff = startSecs - currentSecs;
        countdownStr = `${formatTimetableCountdown(diff)} to start`;
    } else if (currentSecs >= endSecs) {
        countdownStr = "Ended";
    } else {
        const remainingSecs = Math.max(totalSecs - elapsedSecs, 0);
        countdownStr = `${formatTimetableCountdown(remainingSecs)} left`;
    }

    const activeSubjectCards = activeEntries.map(e => {
        const cls = classes.find(c => c.id === e.classId);
        const sub = subjects.find(s => s.id === e.subjectId);
        // Shorten standard class names e.g. "Senior 1" -> "S.1" if possible, otherwise use name
        let classCode = cls?.code || cls?.name || "Class";
        classCode = classCode.replace(/Senior\s+/i, "S").replace(/Primary\s+/i, "P");
        const streamInitial = getTimetableStreamInitial(e, cls);
        if (streamInitial) classCode = `${classCode} ${streamInitial}`;

        return {
            id: e.id,
            classCode,
            subjectCode: sub?.code || sub?.name || e.activityName || "Activity"
        };
    });

    return (
        <article
            onClick={handleCardSelect}
            className={`relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border bg-white p-2 pl-3 text-slate-800 transition-all sm:p-3 sm:pl-4  dark:bg-slate-900 dark:text-slate-100 ${selected
                ? "border-brand-alt-200 shadow-[0_12px_34px_rgba(79,70,229,0.12)] dark:border-brand-alt-800/60"
                : "border-slate-200/90 shadow-[0_8px_24px_rgba(15,23,42,0.06)] hover:border-brand-alt-200 hover:shadow-[0_10px_30px_rgba(79,70,229,0.10)] dark:border-slate-700/90 dark:hover:border-brand-alt-800/60"
            } ${!selected && onSelect ? "cursor-pointer" : ""}`}
        >
            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand-alt-surface-500 via-brand-secondary-alt-surface-500 to-brand-secondary-surface-500" />

            <div className="flex min-w-0 items-center gap-1.5">
                <span className={`h-2 w-2 shrink-0 rounded-full bg-brand-alt-surface-600 ${isLive ? "animate-pulse" : "opacity-35"}`} />
                {onSelect ? (
                    <button type="button" onClick={onSelect} aria-pressed={selected} aria-controls="selected-timetable-panel"
                        className="min-w-0 flex-1 truncate text-left text-[10px] font-extrabold uppercase tracking-wide text-brand-alt-ink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-alt-500 dark:text-brand-alt-ink-400">
                        {timetableLabel}
                    </button>
                ) : <span className="min-w-0 flex-1 truncate text-[10px] font-extrabold uppercase tracking-wide text-brand-alt-ink-600 dark:text-brand-alt-ink-400">{timetableLabel}</span>}
                <span className="shrink-0 text-xs font-bold text-slate-900 dark:text-slate-100">{periodLabel}</span>
                {selectionControl}
            </div>

            <div className="mt-1 flex items-center justify-between gap-2 whitespace-nowrap text-[10px] font-semibold">
                <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">{activePeriod.startTime}–{activePeriod.endTime}</span>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold leading-none tabular-nums ring-1 ring-inset ${
                    currentSecs < startSecs ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/60"
                        : currentSecs >= endSecs ? "bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700"
                            : "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/60"
                }`}>{countdownStr}</span>
            </div>

            <div className="mt-1 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handlePrev}
                        disabled={!prevPeriod}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:bg-brand-alt-surface-50 hover:text-brand-alt-ink-700 disabled:cursor-not-allowed disabled:opacity-30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-brand-alt-surface-950/40 dark:hover:text-brand-alt-ink-300"
                        title="Previous Period"
                        aria-label="Show previous period"
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <div role="progressbar" aria-label={`${timetableLabel} lesson progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressPct)}
                        className="relative h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100 shadow-inner dark:bg-slate-900">
                        <div className="h-full rounded-full bg-gradient-to-r from-brand-alt-surface-500 via-brand-secondary-alt-surface-500 to-brand-secondary-surface-500 transition-all duration-1000 ease-linear"
                            style={{ width: `${clampedPct}%` }} />
                    </div>
                    {viewOffset !== 0 && (
                        <button
                            type="button"
                            onClick={handleLive}
                            className="h-7 rounded-full bg-brand-alt-surface-600 px-2 text-[8px] font-extrabold uppercase tracking-wide text-white transition-colors hover:bg-brand-alt-surface-700"
                            title="Return to Live Time"
                        >
                            Live
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleNext}
                        disabled={!nextPeriod}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:bg-brand-alt-surface-50 hover:text-brand-alt-ink-700 disabled:cursor-not-allowed disabled:opacity-30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-brand-alt-surface-950/40 dark:hover:text-brand-alt-ink-300"
                        title="Next Period"
                        aria-label="Show next period"
                    >
                        <ChevronRight className="h-3.5 w-3.5" />
                    </button>
            </div>

            {/* Compact class and subject list */}
            <div className="mt-1 flex min-h-5 flex-wrap items-center gap-1 border-t border-slate-100 pt-1 sm:mt-2 sm:gap-1.5 sm:pt-2 dark:border-slate-700">
                {activeSubjectCards.length > 0 ? (
                    <>
                    {activeSubjectCards.map((sc, idx) => (
                        <div 
                            key={`${sc.id}-${idx}`} 
                            className="inline-flex min-h-5 items-center gap-1 rounded-lg border border-brand-alt-100 bg-brand-alt-surface-50/70 px-1.5 py-0.5 text-[10px] font-bold tracking-tight text-slate-700 transition-colors hover:border-brand-alt-200 hover:bg-brand-alt-surface-50 sm:min-h-6 sm:px-2 dark:border-brand-alt-800/60 dark:bg-brand-alt-surface-950/70 dark:text-slate-200 dark:hover:border-brand-alt-800/60 dark:hover:bg-brand-alt-surface-950/40"
                        >
                            <span className="text-brand-alt-ink-700 dark:text-brand-alt-ink-300">{sc.classCode}</span>
                            <span className="select-none text-brand-alt-ink-300">·</span>
                            <span>{sc.subjectCode}</span>
                        </div>
                    ))}
                    </>
                ) : (
                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-400">No lessons assigned for this period.</span>
                )}
                {nextPeriod && (
                    <span className="ml-auto whitespace-nowrap text-[9px] font-semibold text-slate-400 dark:text-slate-400">
                        Next {nextPeriod.type === "lesson" ? `L${nextPeriod.periodNumber}` : (nextPeriod.customLabel || nextPeriod.type)} · {nextPeriod.startTime}
                    </span>
                )}
            </div>
        </article>
    );
}
