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
        <div className="bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-600 rounded-xl shadow-sm p-3 sm:p-4 flex flex-col text-white overflow-hidden border border-blue-200 gap-3">
            {/* Top Row: Main Tracker */}
            <div className="flex flex-row items-center gap-2 sm:gap-3 w-full pb-0.5 min-w-0">
                {/* Branding Icon Only */}
                <div className="flex flex-shrink-0 items-center justify-center bg-white/10 p-1.5 rounded-lg" title={viewOffset === 0 ? "Live Lesson" : "Previewing"}>
                    <Navigation className={`w-4 h-4 text-white opacity-90 ${viewOffset === 0 ? 'animate-pulse fill-white' : ''}`} />
                </div>

                {/* Time (Hidden on very small screens to save space) */}
                <span className="hidden sm:inline-flex flex-shrink-0 text-white font-bold font-mono text-xs md:text-sm bg-white/10 px-2 py-1 rounded-md">
                    {currentTimeStr}
                </span>

                {/* Current Lesson Label */}
                <span className="flex-shrink-0 font-semibold text-xs sm:text-sm md:text-base truncate max-w-[120px] sm:max-w-[300px] flex items-center">
                    {profileName && (
                        <>
                            <span className="text-white/70 uppercase tracking-widest text-[9px] sm:text-[10px] mr-1.5 truncate max-w-[90px] sm:max-w-[150px]">{profileName}</span>
                            <span className="text-white/40 mr-1.5 hidden sm:inline">|</span>
                        </>
                    )}
                    <span className="truncate">{periodLabel}</span>
                </span>

                {/* Dynamic Progress Pill */}
                <div className="flex items-center bg-white rounded-full px-1 py-1 shadow-inner overflow-hidden border border-blue-200 flex-1 min-w-[50px] max-w-4xl flex-shrink">
                    <div className="h-4 bg-indigo-100 rounded-full w-full mx-1 relative overflow-hidden flex items-center justify-center">
                        <div
                            className="absolute top-0 left-0 bottom-0 bg-indigo-500 rounded-full transition-all duration-1000 ease-linear"
                            style={{ width: `${clampedPct}%` }}
                        />
                        <span className="absolute text-[9px] sm:text-[10px] font-bold text-indigo-900 z-10 bg-white/80 px-1.5 rounded-full shadow-sm backdrop-blur-sm whitespace-nowrap">
                            {countdownStr}
                        </span>
                    </div>
                </div>

                {/* Next Lesson Label */}
                {nextPeriod && (
                    <div className="hidden md:flex flex-shrink-0 items-center bg-white/20 backdrop-blur-md rounded-lg px-2.5 py-1 border border-white/20">
                        <span className="text-xs font-medium opacity-90 truncate max-w-[150px]">
                            Next: {nextPeriod.type === 'lesson' ? `Lesson ${nextPeriod.periodNumber}` : (nextPeriod.customLabel || nextPeriod.type)}
                        </span>
                    </div>
                )}

                {/* Navigation Controls */}
                <div className="flex flex-shrink-0 items-center gap-1 bg-white/10 rounded-lg p-1 ml-auto">
                    <button
                        onClick={handlePrev}
                        disabled={!prevPeriod}
                        className="p-1.5 rounded bg-transparent hover:bg-white/20 disabled:opacity-30 transition"
                        title="Previous Lesson"
                    >
                        <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                    {viewOffset !== 0 && (
                        <button
                            onClick={handleLive}
                            className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-600 text-[9px] sm:text-[10px] font-bold uppercase transition"
                            title="Return to Live Time"
                        >
                            Reset
                        </button>
                    )}
                    <button
                        onClick={handleNext}
                        disabled={!nextPeriod}
                        className="p-1.5 rounded bg-transparent hover:bg-white/20 disabled:opacity-30 transition"
                        title="Next Lesson"
                    >
                        <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                </div>
            </div>

            {/* Bottom Row: Active Subjects & Classes Array */}
            {activeSubjectCards.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                    {activeSubjectCards.map((sc, idx) => (
                        <div key={`${sc.id}-${idx}`} className="bg-white border border-blue-400 shadow-sm rounded-md px-2 py-1 flex items-center gap-1.5">
                            <span className="text-[11px] sm:text-xs font-bold text-blue-700">{sc.classCode}</span>
                            <div className="w-1 h-1 rounded-full bg-blue-300"></div>
                            <span className="text-[11px] sm:text-xs font-bold text-blue-900">{sc.subjectCode}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
