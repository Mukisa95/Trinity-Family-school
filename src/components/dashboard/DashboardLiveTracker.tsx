"use client";

import * as React from "react";
import { useAcademicYears } from "@/lib/hooks/use-academic-years";
import { useTimetableProfiles, useTimetablePeriods, useTimetableEntries } from "@/lib/hooks/use-timetable";
import { useClasses } from "@/lib/hooks/use-classes";
import { useSubjects } from "@/lib/hooks/use-subjects";
import { useStaff } from "@/lib/hooks/use-staff";
import { ChevronLeft, ChevronRight, BookOpen, Clock, User, X } from "lucide-react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

function parseTimeToMins(t: string): number {
    const [h, m] = (t || "00:00").split(":").map(Number);
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

const PILL_COLORS: [string, string][] = [
    ["#22c55e", "#fff"],
    ["#6366f1", "#fff"],
    ["#f59e0b", "#fff"],
    ["#ec4899", "#fff"],
    ["#14b8a6", "#fff"],
    ["#8b5cf6", "#fff"],
    ["#f97316", "#fff"],
    ["#06b6d4", "#fff"],
];
function getPillColor(i: number): [string, string] { return PILL_COLORS[i % PILL_COLORS.length]; }

interface PillData {
    id: string;
    classCode: string;
    className: string;
    subjectCode: string;
    subjectName: string;
    teacher: string;
    bg: string;
    text: string;
    startTime: string;
    endTime: string;
}

function PillPopover({ pill, onClose }: { pill: PillData; onClose: () => void }) {
    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest("[data-pill-popover]") && !target.closest("[data-pill-btn]")) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    return (
        <div
            data-pill-popover
            className="absolute bottom-full mb-2 left-0 z-50 w-52 rounded-xl overflow-hidden"
            style={{
                border: `2px solid ${pill.bg}`,
                boxShadow: `0 4px 20px rgba(0,0,0,0.12), 0 0 0 4px ${pill.bg}22`
            }}
        >
            {/* Colored header */}
            <div className="flex items-center justify-between px-3 py-2" style={{ background: pill.bg }}>
                <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-white/60 flex-shrink-0" />
                    <span className="text-xs font-bold text-white tracking-wide truncate">{pill.className}</span>
                </div>
                <button onClick={onClose} className="text-white/70 hover:text-white transition flex-shrink-0 ml-1">
                    <X className="w-3 h-3" />
                </button>
            </div>
            {/* Body */}
            <div className="bg-white px-3 py-2.5 flex flex-col gap-1.5">
                <div className="flex items-start gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-800 leading-tight">{pill.subjectName}</p>
                        {pill.subjectCode !== pill.subjectName && (
                            <p className="text-[10px] text-gray-400">{pill.subjectCode}</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-600 font-medium">{pill.startTime} – {pill.endTime}</span>
                </div>
                {pill.teacher ? (
                    <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-xs text-gray-700 font-medium truncate">{pill.teacher}</span>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

// ... (existing code above TrackerCore inside DashboardLiveTracker.tsx)

function TrackerCore({ yearId, termId, profileId, profileName, showClock }: { yearId: string; termId: string; profileId: string; profileName?: string; showClock?: boolean }) {
    const router = useRouter();
    const { data: periods = [] } = useTimetablePeriods(yearId, termId, profileId);
    const { data: entries = [] } = useTimetableEntries(yearId, termId, profileId);
    const { data: profiles = [] } = useTimetableProfiles(yearId, termId);
    const profile = profiles.find(p => p.id === profileId);
    const { data: classes = [] } = useClasses();
    const { data: subjects = [] } = useSubjects();
    const { data: staff = [] } = useStaff();

    const [currentTime, setCurrentTime] = React.useState(new Date());
    React.useEffect(() => {
        const id = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    const [viewOffset, setViewOffset] = React.useState(0);
    const [openPillIdx, setOpenPillIdx] = React.useState<number | null>(null);

    const currentDayOfWeek = currentTime.getDay() || 7;
    const currentTimeStr = format(currentTime, "HH:mm");
    const currentSecs = currentTime.getHours() * 3600 + currentTime.getMinutes() * 60 + currentTime.getSeconds();

    const todayPeriods = periods
        .filter(p => p.dayOfWeek === currentDayOfWeek)
        .sort((a, b) => parseTimeToMins(a.startTime) - parseTimeToMins(b.startTime));

    let baseIndex = todayPeriods.findIndex(p => currentTimeStr >= p.startTime && currentTimeStr < p.endTime);
    if (baseIndex === -1) {
        baseIndex = todayPeriods.findIndex(p => p.startTime > currentTimeStr);
        if (baseIndex === -1) baseIndex = Math.max(0, todayPeriods.length - 1);
    }

    const viewingIndex = Math.max(0, Math.min(todayPeriods.length - 1, baseIndex + viewOffset));
    const activePeriod = todayPeriods[viewingIndex];
    const nextPeriod = todayPeriods[viewingIndex + 1];
    const prevPeriod = todayPeriods[viewingIndex - 1];

    const handleNext = () => { setViewOffset(prev => Math.min(todayPeriods.length - 1 - baseIndex, prev + 1)); setOpenPillIdx(null); };
    const handlePrev = () => { setViewOffset(prev => Math.max(0 - baseIndex, prev - 1)); setOpenPillIdx(null); };
    const handleLive = () => { setViewOffset(0); setOpenPillIdx(null); };
    const isLive = viewOffset === 0;

    if (!activePeriod) {
        return (
            <div className="flex items-center gap-2 py-1">
                <div className="w-3.5 h-3.5 rounded-full border border-gray-300 flex items-center justify-center flex-shrink-0">
                    <div className="w-1 h-1 rounded-full bg-gray-400" />
                </div>
                {profileName && <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{profileName}:</span>}
                <span className="text-xs text-gray-500">No active lessons.</span>
                <button onClick={() => router.push("/timetable")} className="ml-auto text-[10px] font-semibold text-indigo-500 hover:text-indigo-700 transition">
                    Timetable →
                </button>
            </div>
        );
    }

    const startSecs = parseTimeToMins(activePeriod.startTime) * 60;
    const endSecs = parseTimeToMins(activePeriod.endTime) * 60;
    const totalSecs = Math.max(endSecs - startSecs, 1);
    const elapsedSecs = Math.min(Math.max(currentSecs - startSecs, 0), totalSecs);
    const clampedPct = Math.min(Math.max((elapsedSecs / totalSecs) * 100, 2), 98);
    const isUpcoming = currentSecs < startSecs;

    let countdownStr = "";
    if (isUpcoming) {
        const diff = startSecs - currentSecs;
        countdownStr = `${Math.floor(diff / 60)}m ${String(diff % 60).padStart(2, "0")}s`;
    } else if (currentSecs >= endSecs) {
        countdownStr = "Ended";
    } else {
        const rem = Math.max(totalSecs - elapsedSecs, 0);
        countdownStr = `${Math.floor(rem / 60)}m ${String(rem % 60).padStart(2, "0")}s left`;
    }

    const periodLabel = activePeriod.type === "lesson"
        ? `L${activePeriod.periodNumber}`
        : (activePeriod.customLabel || activePeriod.type);

    const classesToRender = profile?.classIds?.length
        ? classes.filter(c => profile!.classIds.includes(c.id))
        : classes;

    const activeEntries = entries
        .filter(e => e.periodId === activePeriod.id)
        .sort((a, b) => {
            const ai = classesToRender.findIndex(c => c.id === a.classId);
            const bi = classesToRender.findIndex(c => c.id === b.classId);
            return (ai === -1 ? 9999 : ai) - (bi === -1 ? 9999 : bi);
        });

    const subjectCards: PillData[] = activeEntries.map((e, idx) => {
        const cls = classes.find(c => c.id === e.classId);
        const sub = subjects.find(s => s.id === e.subjectId);
        const teacherObj = staff.find(t => t.id === e.teacherId);
        let classCode = cls?.code || cls?.name || "Cls";
        classCode = classCode.replace(/Senior\s+/i, "S").replace(/Primary\s+/i, "P");
        const subjectCode = sub?.code || sub?.name || e.activityName || "—";
        const teacherName = teacherObj
            ? [teacherObj.firstName, teacherObj.lastName].filter(Boolean).join(" ")
            : "";
        const [bg, text] = getPillColor(idx);
        return {
            id: e.id,
            classCode,
            className: cls?.name || classCode,
            subjectCode,
            subjectName: sub?.name || e.activityName || "—",
            teacher: teacherName,
            bg,
            text,
            startTime: activePeriod.startTime,
            endTime: activePeriod.endTime,
        };
    });

    const nextLabel = nextPeriod
        ? (nextPeriod.type === "lesson" ? `L${nextPeriod.periodNumber}` : (nextPeriod.customLabel || nextPeriod.type))
        : null;

    const BAR_HEIGHT = 22; // px

    return (
        <div className="flex flex-col gap-1 w-full min-w-0 py-0.5">
            {/* Row 1: indicator · profile/period details + countdown badge · times | clock | nav */}
            <div className="flex flex-wrap items-center gap-1.5 w-full min-w-0">
                <div className="flex-shrink-0 w-3.5 h-3.5 rounded-full border border-red-300 flex items-center justify-center">
                    <div className={`w-1.5 h-1.5 rounded-full bg-red-500 ${isLive && !isUpcoming ? "animate-pulse" : "opacity-25"}`} />
                </div>
                
                <div className="flex items-center flex-wrap gap-1 text-xs font-bold text-gray-900 tracking-tight">

                    
                    <span className="text-gray-800">{periodLabel}</span>
                    
                    {/* Compact Countdown Badge */}
                    <span className={`px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded-md tracking-wider leading-none ${
                        isUpcoming 
                            ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                            : currentSecs >= endSecs 
                                ? 'bg-gray-100 text-gray-500 border border-gray-200' 
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                        {countdownStr}
                    </span>

                    <span className="text-gray-300 font-normal select-none">·</span>
                    <span className="text-gray-500 font-mono font-medium text-[11px]">{activePeriod.startTime}–{activePeriod.endTime}</span>
                </div>

                <div className="flex-1" />
                
                {showClock && (
                    <div className="hidden sm:flex items-center px-2 py-0.5 bg-indigo-50/50 border border-indigo-100/60 rounded-full mr-1 flex-shrink-0">
                        <Clock className="w-2.5 h-2.5 text-indigo-400 mr-1" />
                        <span className="font-mono text-[10px] font-bold bg-gradient-to-br from-indigo-700 to-indigo-900 bg-clip-text text-transparent tabular-nums tracking-tight">
                            {format(currentTime, "h:mm a")}
                        </span>
                    </div>
                )}
                
                <div className="flex-shrink-0 flex items-center gap-0.5 p-0.5 bg-gray-50 border border-gray-200 rounded-full shadow-sm">
                    <button onClick={handlePrev} disabled={!prevPeriod} className="p-0.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all">
                        <ChevronLeft className="w-3 h-3" />
                    </button>
                    {!isLive && (
                        <button onClick={handleLive} className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider bg-white shadow-sm border border-amber-200 text-amber-600 rounded-full hover:bg-amber-50 hover:border-amber-300 transition-all leading-none">
                            Live
                        </button>
                    )}
                    <button onClick={handleNext} disabled={!nextPeriod} className="p-0.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all">
                        <ChevronRight className="w-3 h-3" />
                    </button>
                </div>
            </div>

            {/* Row 2: Sleek, slim progress line */}
            <div className="relative w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-0.5 mb-1 shadow-[inset_0_1px_1px_rgba(0,0,0,0.05)]">
                <div
                    className="h-full rounded-full transition-all duration-1000 ease-linear"
                    style={{
                        width: `${clampedPct}%`,
                        background: isUpcoming
                            ? "linear-gradient(90deg, #fcd34d, #f59e0b)"
                            : "linear-gradient(90deg, #818cf8, #4f46e5)"
                    }}
                />
            </div>

            {/* Row 3: pills + next */}
            <div className="relative flex items-center gap-1 flex-wrap">
                {subjectCards.map((sc, idx) => (
                    <div key={`${sc.id}-${idx}`} className="relative">
                        <button
                            data-pill-btn
                            onClick={() => setOpenPillIdx(openPillIdx === idx ? null : idx)}
                            className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap transition-all hover:brightness-105 active:scale-95 border"
                            style={{ 
                                backgroundColor: `${sc.bg}15`, 
                                color: sc.bg, 
                                borderColor: `${sc.bg}30` 
                            }}
                        >
                            <span>{sc.classCode}</span>
                            <span style={{ opacity: 0.4 }}>·</span>
                            <span>{sc.subjectCode}</span>
                        </button>
                        {openPillIdx === idx && (
                            <PillPopover pill={sc} onClose={() => setOpenPillIdx(null)} />
                        )}
                    </div>
                ))}
                {nextLabel && (
                    <span className="ml-auto text-[9px] text-gray-400 whitespace-nowrap select-none font-medium">
                        Next: <span className="font-bold text-gray-500 uppercase">{nextLabel}</span>{" "}
                        <span className="text-gray-300">·</span>{" "}
                        <span className="text-gray-400 font-mono">{nextPeriod?.startTime}</span>
                    </span>
                )}
            </div>
        </div>
    );
}

export function DashboardLiveTracker() {
    const { data: years = [], isLoading } = useAcademicYears();
    const now = new Date();
    const activeYear = years.find(y => {
        if (!y.startDate || !y.endDate) return false;
        return now >= new Date(y.startDate) && now <= new Date(y.endDate);
    }) || years.find(y => y.isActive) || years[0];

    const currentTerm = activeYear?.terms?.find(t => {
        if (!t.startDate || !t.endDate) return false;
        return now >= new Date(t.startDate) && now <= new Date(t.endDate);
    }) ?? activeYear?.terms?.find(t => t.isCurrent) ?? activeYear?.terms?.[0];

    const yearId = activeYear?.id || "";
    const termId = currentTerm?.id || "";
    const { data: profiles = [], isLoading: profilesLoading } = useTimetableProfiles(yearId, termId);

    if (isLoading || profilesLoading || profiles.length === 0) {
        if (!isLoading && !profilesLoading && profiles.length === 0) return null;
        return (
            <div className="bg-white rounded-xl px-3 py-2.5 flex items-center gap-2 border-2 border-indigo-100 shadow-sm">
                <div className="w-3 h-3 border-2 border-indigo-100 border-t-indigo-400 rounded-full animate-spin flex-shrink-0" />
                <span className="text-xs text-gray-400 font-medium">Loading timetables…</span>
            </div>
        );
    }

    return (
        <div
            className="bg-white rounded-xl px-3 py-2.5 text-gray-800 relative overflow-visible"
            style={{
                border: "2px solid #c7d2fe",
                boxShadow: "0 0 0 4px rgba(99,102,241,0.08), 0 2px 8px rgba(99,102,241,0.10)"
            }}
        >
            <div className="flex flex-col gap-2 divide-y divide-indigo-50/60">
                {profiles.map((profile, idx) => (
                    <TrackerCore
                        key={profile.id}
                        yearId={yearId}
                        termId={termId}
                        profileId={profile.id}
                        profileName={profiles.length > 1 ? profile.name : undefined}
                        showClock={idx === 0}
                    />
                ))}
            </div>
        </div>
    );
}
