"use client";

import * as React from "react";
import { useTimetablePeriods, useTimetableEntries, useTimetableProfiles } from "@/lib/hooks/use-timetable";
import { useClasses } from "@/lib/hooks/use-classes";
import { useSubjects } from "@/lib/hooks/use-subjects";
import { Check, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
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
    const currentTimeStr = format(currentTime, "HH:mm");
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
            className={`inline-flex h-8 flex-shrink-0 items-center gap-1 rounded-full border px-2.5 text-[9px] font-extrabold uppercase tracking-wide transition-colors ${selected
                ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
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
                ? `Next: ${nextPeriod.type === 'lesson' ? `Lesson ${nextPeriod.periodNumber}` : (nextPeriod.customLabel || nextPeriod.type)} at ${nextPeriod.startTime}`
                : "All classes finished for today."
            : selected
                ? "This timetable is shown below."
                : "Select this card to view and manage its timetable.";
        return (
            <section
                onClick={handleCardSelect}
                className={`relative h-full min-w-0 overflow-hidden rounded-2xl border bg-white p-3 pl-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all ${selected
                    ? "border-indigo-200 shadow-[0_12px_34px_rgba(79,70,229,0.12)]"
                    : "border-amber-200/80 hover:border-indigo-200 hover:shadow-[0_10px_28px_rgba(79,70,229,0.09)]"
                } ${!selected && onSelect ? "cursor-pointer" : ""}`}
            >
                <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${liveEnabled ? "from-amber-400 to-orange-500" : "from-indigo-500 to-violet-500"}`} />
                <div className="flex min-h-[52px] items-center gap-3">
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ring-1 ${liveEnabled
                        ? "bg-amber-50 text-amber-600 ring-amber-200/70"
                        : "bg-indigo-50 text-indigo-600 ring-indigo-200/70"
                    }`}>
                        <Clock className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-bold text-slate-900">{timetableLabel}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ring-1 ring-inset ${liveEnabled
                                ? "bg-amber-50 text-amber-700 ring-amber-200"
                                : "bg-indigo-50 text-indigo-700 ring-indigo-200"
                            }`}>
                                {statusLabel}
                            </span>
                        </div>
                        <span className="mt-1 block truncate text-xs font-medium text-slate-500">
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
        ? `Lesson ${activePeriod.periodNumber}`
        : activePeriod.customLabel || activePeriod.type;

    // Countdown
    let countdownStr = "";
    if (currentSecs < startSecs) {
        const diff = startSecs - currentSecs;
        countdownStr = `Starts in ${Math.floor(diff / 60)}m ${String(diff % 60).padStart(2, '0')}s`;
    } else if (currentSecs >= endSecs) {
        countdownStr = "Ended";
    } else {
        const remainingSecs = Math.max(totalSecs - elapsedSecs, 0);
        countdownStr = `${Math.floor(remainingSecs / 60)}m ${String(remainingSecs % 60).padStart(2, '0')}s`;
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
            className={`relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border bg-white p-2.5 pl-3.5 text-slate-800 transition-all sm:p-3 sm:pl-4 ${selected
                ? "border-indigo-200 shadow-[0_12px_34px_rgba(79,70,229,0.12)]"
                : "border-slate-200/90 shadow-[0_8px_24px_rgba(15,23,42,0.06)] hover:border-indigo-200 hover:shadow-[0_10px_30px_rgba(79,70,229,0.10)]"
            } ${!selected && onSelect ? "cursor-pointer" : ""}`}
        >
            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-indigo-500 via-violet-500 to-purple-500" />

            {/* Compact identity, status and navigation row */}
            <div className="flex min-w-0 items-start gap-2">
                <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 ring-1 ring-inset ring-indigo-200">
                    <span className={`h-2 w-2 rounded-full bg-indigo-600 ${isLive ? "animate-pulse" : "opacity-35"}`} />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                        {profileName && (
                            <span className="max-w-[150px] truncate text-[10px] font-extrabold uppercase tracking-[0.12em] text-indigo-600 sm:max-w-[220px]">
                                {profileName}
                            </span>
                        )}
                        {profileName && <span className="text-slate-300" aria-hidden="true">/</span>}
                        <span className="text-sm font-bold leading-none text-slate-900">{periodLabel}</span>
                        <span className={`rounded-full px-2 py-1 text-[9px] font-extrabold uppercase leading-none tracking-wide ring-1 ring-inset ${
                            currentSecs < startSecs
                                ? "bg-amber-50 text-amber-700 ring-amber-200"
                                : currentSecs >= endSecs
                                    ? "bg-slate-100 text-slate-500 ring-slate-200"
                                    : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        }`}>
                            {countdownStr}
                        </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-semibold text-slate-500">
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                            <Clock className="h-3 w-3 text-slate-400" />
                            {activePeriod.startTime}–{activePeriod.endTime}
                        </span>
                        <span className="text-slate-300" aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums text-slate-600">Now {currentTimeStr}</span>
                    </div>
                </div>

                <div className="ml-auto flex flex-shrink-0 items-center gap-0.5 rounded-full border border-slate-200 bg-slate-50 p-0.5 shadow-sm">
                    <button
                        onClick={handlePrev}
                        disabled={!prevPeriod}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-30"
                        title="Previous Period"
                        aria-label="Show previous period"
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    {viewOffset !== 0 && (
                        <button
                            onClick={handleLive}
                            className="h-7 rounded-full bg-indigo-600 px-2 text-[8px] font-extrabold uppercase tracking-wide text-white transition-colors hover:bg-indigo-700"
                            title="Return to Live Time"
                        >
                            Live
                        </button>
                    )}
                    <button
                        onClick={handleNext}
                        disabled={!nextPeriod}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-30"
                        title="Next Period"
                        aria-label="Show next period"
                    >
                        <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                </div>
                {selectionControl}
            </div>

            {/* Slim progress line */}
            <div className="relative mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 transition-all duration-1000 ease-linear"
                    style={{ width: `${clampedPct}%` }}
                />
            </div>

            {/* Compact class and subject list */}
            <div className="mt-2 flex min-h-6 flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
                {activeSubjectCards.length > 0 ? (
                    <>
                    {activeSubjectCards.map((sc, idx) => (
                        <div 
                            key={`${sc.id}-${idx}`} 
                            className="inline-flex min-h-6 items-center gap-1 rounded-lg border border-indigo-100 bg-indigo-50/70 px-2 py-0.5 text-[10px] font-bold tracking-tight text-slate-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50"
                        >
                            <span className="text-indigo-700">{sc.classCode}</span>
                            <span className="select-none text-indigo-300">·</span>
                            <span>{sc.subjectCode}</span>
                        </div>
                    ))}
                    </>
                ) : (
                    <span className="text-[10px] font-medium text-slate-400">No lessons assigned for this period.</span>
                )}
                {nextPeriod && (
                    <span className="ml-auto whitespace-nowrap text-[9px] font-semibold text-slate-400">
                        Next {nextPeriod.type === "lesson" ? `L${nextPeriod.periodNumber}` : (nextPeriod.customLabel || nextPeriod.type)} · {nextPeriod.startTime}
                    </span>
                )}
            </div>
        </article>
    );
}
