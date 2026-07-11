"use client";

import * as React from "react";
import { useTimetablePeriods, useTimetableEntries, useTimetableProfiles } from "@/lib/hooks/use-timetable";
import { useClasses } from "@/lib/hooks/use-classes";
import { useSubjects } from "@/lib/hooks/use-subjects";
import { useStaff } from "@/lib/hooks/use-staff";
import { Navigation, AlertCircle, Clock, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface LiveTrackerProps {
    yearId: string;
    termId: string;
    profileId: string;
    profileName?: string;
}

function parseTimeToMins(t: string): number {
    const [h, m] = (t || "00:00").split(":").map(Number);
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

export function LiveTracker({ yearId, termId, profileId, profileName }: LiveTrackerProps) {
    const { data: profiles = [] } = useTimetableProfiles(yearId, termId);
    const profile = profiles.find(p => p.id === profileId);
    const { data: periods = [] } = useTimetablePeriods(yearId, termId, profileId);
    const { data: entries = [] } = useTimetableEntries(yearId, termId, profileId);
    const { data: classes = [] } = useClasses();
    const { data: subjects = [] } = useSubjects();
    const { data: staffList = [] } = useStaff();

    const [currentTime, setCurrentTime] = React.useState(new Date());

    React.useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);


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

    if (!activePeriod) {
        return (
            <Card className="border-amber-200 bg-amber-50">
                <CardContent className="flex items-center gap-3 p-3 text-amber-700">
                    <Clock className="w-5 h-5 opacity-50 flex-shrink-0" />
                    <div>
                        <span className="font-semibold text-sm">No Active Lesson — </span>
                        {profileName && <span className="text-[10px] font-bold text-amber-700/70 uppercase tracking-wider mr-1">[{profileName}]</span>}
                        <span className="text-sm">
                            {nextPeriod
                                ? `Next: ${nextPeriod.type === 'lesson' ? `Lesson ${nextPeriod.periodNumber}` : (nextPeriod.customLabel || nextPeriod.type)} at ${nextPeriod.startTime}`
                                : "All classes finished for today."}
                        </span>
                    </div>
                </CardContent>
            </Card>
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

        return {
            id: e.id,
            classCode,
            subjectCode: sub?.code || sub?.name || e.activityName || "Activity"
        };
    });

    return (
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-600 rounded-xl shadow-sm p-2.5 sm:p-3 flex flex-col text-white overflow-hidden border border-indigo-500/30 gap-1.5">
            {/* Top Row: Details & Navigation */}
            <div className="flex items-center gap-1.5 w-full min-w-0 flex-wrap sm:flex-nowrap">
                {/* Status dot pulse */}
                <div className="flex-shrink-0 w-3.5 h-3.5 rounded-full border border-white/30 flex items-center justify-center">
                    <div className={`w-1.5 h-1.5 rounded-full bg-white ${isLive ? "animate-pulse" : "opacity-30"}`} />
                </div>

                {/* Period & Profile Details */}
                <div className="flex items-center flex-wrap gap-1 text-xs font-bold tracking-tight">
                    {profileName && (
                        <span className="text-white/70 uppercase tracking-wider text-[9px] sm:text-[10px] truncate max-w-[80px] sm:max-w-none">
                            {profileName}
                        </span>
                    )}
                    {profileName && <span className="text-white/30 select-none">|</span>}
                    
                    <span className="text-white">{periodLabel}</span>

                    {/* Compact Countdown Badge */}
                    <span className={`px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded-md tracking-wider leading-none ${
                        currentSecs < startSecs 
                            ? 'bg-amber-400/20 border border-amber-400/30 text-amber-200' 
                            : currentSecs >= endSecs 
                                ? 'bg-white/10 border border-white/20 text-white/60' 
                                : 'bg-emerald-400/20 border border-emerald-400/30 text-emerald-200'
                    }`}>
                        {countdownStr}
                    </span>

                    <span className="text-white/30 font-normal select-none">·</span>
                    <span className="text-white/70 font-mono font-medium text-[10px]">{activePeriod.startTime}–{activePeriod.endTime}</span>
                </div>

                <div className="flex-1" />

                {/* Clock */}
                <span className="hidden sm:inline-flex flex-shrink-0 text-white/90 font-bold font-mono text-[10px] bg-white/10 px-1.5 py-0.5 rounded">
                    {currentTimeStr}
                </span>

                {/* Navigation Buttons */}
                <div className="flex flex-shrink-0 items-center gap-0.5 bg-white/10 rounded-lg p-0.5 ml-auto">
                    <button
                        onClick={handlePrev}
                        disabled={!prevPeriod}
                        className="p-1 rounded bg-transparent hover:bg-white/10 disabled:opacity-30 transition"
                        title="Previous Period"
                    >
                        <ChevronLeft className="w-3 h-3" />
                    </button>
                    {viewOffset !== 0 && (
                        <button
                            onClick={handleLive}
                            className="px-1.5 py-0.5 rounded bg-amber-500 hover:bg-amber-600 text-[8px] font-bold uppercase transition leading-none"
                            title="Return to Live Time"
                        >
                            Reset
                        </button>
                    )}
                    <button
                        onClick={handleNext}
                        disabled={!nextPeriod}
                        className="p-1 rounded bg-transparent hover:bg-white/10 disabled:opacity-30 transition"
                        title="Next Period"
                    >
                        <ChevronRight className="w-3 h-3" />
                    </button>
                </div>
            </div>

            {/* Row 2: Slim Progress Line */}
            <div className="relative w-full h-1 bg-white/20 rounded-full overflow-hidden mt-0.5 mb-0.5">
                <div
                    className="h-full bg-white rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${clampedPct}%` }}
                />
            </div>

            {/* Row 3: Active Subjects Array (Glassmorphic Badges) */}
            {activeSubjectCards.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-white/10">
                    {activeSubjectCards.map((sc, idx) => (
                        <div 
                            key={`${sc.id}-${idx}`} 
                            className="bg-white/10 border border-white/15 rounded px-2 py-0.5 flex items-center gap-1 text-[9px] font-bold tracking-tight hover:bg-white/15 transition-all shadow-sm"
                        >
                            <span className="opacity-90">{sc.classCode}</span>
                            <span className="opacity-40 select-none">·</span>
                            <span className="opacity-95">{sc.subjectCode}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
