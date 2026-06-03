"use client";

import * as React from "react";
import { useTimetablePeriods, useTimetableEntries, useTimetableProfiles } from "@/lib/hooks/use-timetable";
import { useClasses } from "@/lib/hooks/use-classes";
import { useSubjects } from "@/lib/hooks/use-subjects";
import { useStaff } from "@/lib/hooks/use-staff";
import { Loader2, Clock } from "lucide-react";
import { format, parse } from "date-fns";
import type { TimetableEntry, GeneratedPeriod, Class, Subject, Staff, TimetableProfile } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────
const PIXELS_PER_MINUTE = 4; // slightly wider for timeline readability
const LEFT_LABEL_WIDTH = 180; // px for "Profile / Class" label column
const RULER_HEIGHT = 44; // px

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parseTimeStr(timeStr: string): number {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length < 2) return 0;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return 0;
    return h * 60 + m;
}

function formatDisplayTime(timeStr: string, _formatPref?: '12h' | '24h'): string {
    if (!timeStr) return '';
    try {
        return format(parse(timeStr, "HH:mm", new Date()), "h:mm a");
    } catch (e) {
        return timeStr;
    }
}

function formatHHMM(totalMins: number): string {
    const h = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatCountdown(remainingMins: number): string {
    if (remainingMins <= 0) return "Ending now";
    const h = Math.floor(remainingMins / 60);
    const m = remainingMins % 60;
    return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

// Same golden-ratio subject color system as day view
const SUBJECT_HUES_C = [0, 138, 275, 53, 190, 328, 105, 243, 20, 158, 295, 73];

function getSubjectHueC(subjectId: string): number {
    let hash = 0;
    for (let i = 0; i < subjectId.length; i++) {
        hash = (hash * 31 + subjectId.charCodeAt(i)) & 0xffff;
    }
    return SUBJECT_HUES_C[hash % SUBJECT_HUES_C.length];
}

function getTimelineBlockStyle(
    subjectId: string | null,
    state: 'active' | 'past' | 'upcoming' | 'empty'
): React.CSSProperties {
    if (state === 'empty') return { background: '#f8fafc', borderColor: '#e2e8f0', color: '#cbd5e1' };
    if (!subjectId) return { background: '#f1f5f9', borderColor: '#e2e8f0', color: '#94a3b8' };
    const hue = getSubjectHueC(subjectId);
    if (state === 'active') {
        return {
            background: `hsl(${hue}, 72%, 42%)`,
            borderColor: `hsl(${hue}, 72%, 32%)`,
            color: 'white',
            boxShadow: `0 0 0 2px hsl(${hue}, 72%, 62%) inset`,
        };
    }
    if (state === 'past') {
        return {
            background: `hsl(${hue}, 14%, 92%)`,
            borderColor: `hsl(${hue}, 10%, 82%)`,
            color: `hsl(${hue}, 12%, 60%)`,
        };
    }
    return {
        background: `hsl(${hue}, 55%, 86%)`,
        borderColor: `hsl(${hue}, 50%, 74%)`,
        color: `hsl(${hue}, 62%, 28%)`,
    };
}

// ─── Per-profile lane data fetcher ────────────────────────────────────────────
function ProfileLane({
    yearId, termId, profile, selectedDay, classes, subjects, staffList,
    dayStartMins, totalDayMins, nowMins, isToday,
}: {
    yearId: string; termId: string; profile: TimetableProfile;
    selectedDay: number; classes: Class[]; subjects: Subject[]; staffList: Staff[];
    dayStartMins: number; totalDayMins: number;
    nowMins: number; isToday: boolean;
}) {
    const { data: periods = [], isLoading: pl } = useTimetablePeriods(yearId, termId, profile.id);
    const { data: entries = [], isLoading: el } = useTimetableEntries(yearId, termId, profile.id);

    const dayPeriods = React.useMemo(() =>
        periods
            .filter(p => p.dayOfWeek === selectedDay)
            .sort((a, b) => parseTimeStr(a.startTime) - parseTimeStr(b.startTime)),
        [periods, selectedDay]);

    // Only show classes that have entries in this profile
    const profileClassIds = React.useMemo(() => new Set(entries.map(e => e.classId)), [entries]);
    const profileClasses = classes.filter(c => profileClassIds.has(c.id));

    if (pl || el) {
        return (
            <tr>
                <td className="text-xs text-gray-400 px-3 py-2" style={{ width: LEFT_LABEL_WIDTH }}>
                    Loading {profile.name}…
                </td>
                <td><Loader2 className="w-4 h-4 animate-spin text-blue-300 m-2" /></td>
            </tr>
        );
    }

    if (dayPeriods.length === 0) {
        return (
            <tr>
                <td className="text-xs text-gray-400 italic px-3 py-3 font-medium" style={{ width: LEFT_LABEL_WIDTH }}>
                    {profile.name || "Timetable"}
                </td>
                <td className="text-xs text-gray-300 italic py-3">No periods on this day</td>
            </tr>
        );
    }

    if (profileClasses.length === 0) {
        return (
            <tr>
                <td className="text-xs text-gray-400 italic px-3 py-3 font-medium" style={{ width: LEFT_LABEL_WIDTH }}>
                    {profile.name || "Timetable"}
                </td>
                <td className="text-xs text-gray-300 italic py-3">No entries yet</td>
            </tr>
        );
    }

    return (
        <>
            {/* Profile header row */}
            <tr className="bg-gradient-to-r from-indigo-50 to-blue-50 border-t-2 border-indigo-200">
                <td
                    colSpan={2}
                    className="px-3 py-1.5 text-xs font-bold text-indigo-700 uppercase tracking-wide"
                >
                    {profile.name || "Main Timetable"}
                </td>
            </tr>

            {profileClasses.map((cls, clsIdx) => (
                <tr key={cls.id} className={clsIdx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                    {/* Class label */}
                    <td
                        className="px-2 py-1 text-[10px] font-semibold text-gray-600 border-r border-gray-100 whitespace-nowrap"
                        style={{ width: LEFT_LABEL_WIDTH, minWidth: LEFT_LABEL_WIDTH }}
                    >
                        {cls.code || cls.name}
                    </td>

                    {/* Timeline cell */}
                    <td className="relative py-1" style={{ height: 44 }}>
                        <div className="relative" style={{ width: totalDayMins * PIXELS_PER_MINUTE, height: 40 }}>
                            {dayPeriods.map(period => {
                                const pStart = parseTimeStr(period.startTime);
                                const pEnd = parseTimeStr(period.endTime);
                                const dur = Math.max(pEnd - pStart, 5);
                                const left = (pStart - dayStartMins) * PIXELS_PER_MINUTE;
                                const width = dur * PIXELS_PER_MINUTE;

                                const isBreak = period.type === "break" || period.type === "lunch" || period.type === "assembly";
                                if (isBreak) {
                                    return (
                                        <div
                                            key={period.id}
                                            className="absolute top-0 bottom-0 flex items-center justify-center bg-gray-100/80 border-x border-gray-200"
                                            style={{ left, width }}
                                        >
                                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider"
                                                style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
                                                {period.customLabel || period.type}
                                            </span>
                                        </div>
                                    );
                                }

                                const entry = entries.find(e => e.classId === cls.id && e.periodId === period.id);
                                const subject = entry ? subjects.find(s => s.id === entry.subjectId) : null;
                                const teacher = entry ? staffList.find(s => s.id === entry.teacherId) : null;

                                const isActive = isToday && nowMins >= pStart && nowMins < pEnd;
                                const isPast = isToday && nowMins >= pEnd;
                                const remainingMins = isActive ? pEnd - nowMins : 0;

                                const blockState = isActive ? 'active' : isPast ? 'past' : entry ? 'upcoming' : 'empty';
                                const blockStyle = getTimelineBlockStyle(entry?.subjectId || null, blockState);

                                return (
                                    <div
                                        key={period.id}
                                        style={{ left: left + 1, width: width - 2, ...blockStyle }}
                                        className="absolute top-0.5 bottom-0.5 rounded-md border flex flex-col justify-center overflow-hidden px-1.5 transition-all"
                                        title={`${formatDisplayTime(period.startTime, profile.timeFormat)}–${formatDisplayTime(period.endTime, profile.timeFormat)}${subject ? ` | ${subject.name}` : ""}${teacher ? ` | ${teacher.firstName} ${teacher.lastName}` : ""}`}
                                    >
                                        {entry ? (
                                            <>
                                                <div className="text-[10px] font-bold leading-tight truncate">
                                                    {subject?.code || subject?.name || "?"}
                                                </div>
                                                <div className="text-[8px] leading-tight opacity-80 truncate">
                                                    {formatDisplayTime(period.startTime, profile.timeFormat)}–{formatDisplayTime(period.endTime, profile.timeFormat)}
                                                </div>
                                                {isActive && (
                                                    <div className="text-[8px] font-bold leading-tight truncate flex items-center gap-0.5">
                                                        <Clock className="w-2 h-2 inline" />
                                                        {formatCountdown(remainingMins)}
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="text-[8px] text-center opacity-40">
                                                {formatDisplayTime(period.startTime, profile.timeFormat)}–{formatDisplayTime(period.endTime, profile.timeFormat)}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </td>
                </tr>
            ))}
        </>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface CombinedTimelineViewProps {
    yearId: string;
    termId: string;
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function CombinedTimelineView({ yearId, termId }: CombinedTimelineViewProps) {
    const { data: profiles = [], isLoading: profilesLoading } = useTimetableProfiles(yearId, termId);
    const { data: classes = [] } = useClasses();
    const { data: subjects = [] } = useSubjects();
    const { data: staffList = [] } = useStaff();

    const [selectedDay, setSelectedDay] = React.useState<number>(() => {
        const d = new Date().getDay(); // 0=Sun
        return d === 0 ? 5 : d; // Default to today, clamp to Mon-Sat (1-6)
    });

    const [currentTime, setCurrentTime] = React.useState(new Date());
    React.useEffect(() => {
        const t = setInterval(() => setCurrentTime(new Date()), 30_000);
        return () => clearInterval(t);
    }, []);

    const nowMins = currentTime.getHours() * 60 + currentTime.getMinutes();
    const todayDayOfWeek = currentTime.getDay() || 7;
    const isToday = selectedDay === todayDayOfWeek;

    // We need periods across all profiles to compute the overall day start
    // We fetch profiles, then for each profile we render a ProfileLane which fetches its own data

    if (profilesLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                <span className="ml-2 text-gray-500 text-sm">Loading profiles…</span>
            </div>
        );
    }

    if (profiles.length === 0) return (
        <p className="text-gray-400 text-sm text-center py-10">No timetable profiles found.</p>
    );

    // For the ruler we need a time range. We use a reasonable school day range,
    // e.g., 06:00 to 18:00. ProfileLane provides the actual content positioned accordingly.
    // The ruler starts at 06:00 and shows every hour up to 18:00.
    const RULER_START = 6 * 60;   // 06:00
    const RULER_END = 18 * 60;    // 18:00
    const totalDayMins = RULER_END - RULER_START;
    const totalWidth = totalDayMins * PIXELS_PER_MINUTE;

    // Ruler hour ticks: 06, 07, 08, ..., 18
    const hourTicks: number[] = [];
    for (let h = RULER_START; h <= RULER_END; h += 60) {
        hourTicks.push(h);
    }

    // Now indicator offset
    const nowOffset = (nowMins - RULER_START) * PIXELS_PER_MINUTE;
    const showNow = isToday && nowMins >= RULER_START && nowMins <= RULER_END;

    return (
        <div className="space-y-4">
            {/* Day selector */}
            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                {DAY_NAMES.map((day, i) => {
                    const dayId = i + 1;
                    return (
                        <button
                            key={dayId}
                            onClick={() => setSelectedDay(dayId)}
                            className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all whitespace-nowrap ${selectedDay === dayId
                                ? "bg-blue-600 text-white border-blue-600 shadow-md"
                                : "bg-white text-gray-600 border-gray-200 hover:bg-blue-50 hover:border-blue-300"
                                }`}
                        >
                            {day}
                            {dayId === todayDayOfWeek && (
                                <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-red-400 inline-block align-middle" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Timeline grid */}
            <div className="overflow-x-auto rounded-xl border border-gray-200 custom-scrollbar bg-white">
                <table className="border-collapse" style={{ minWidth: LEFT_LABEL_WIDTH + totalWidth + 32 }}>
                    <thead>
                        <tr style={{ height: RULER_HEIGHT }}>
                            {/* Label column header */}
                            <th
                                className="bg-slate-50 border-b border-r border-gray-200 text-xs font-semibold text-gray-500 px-3 text-left sticky left-0 z-20"
                                style={{ width: LEFT_LABEL_WIDTH, minWidth: LEFT_LABEL_WIDTH }}
                            >
                                Profile / Class
                            </th>
                            {/* Ruler cell */}
                            <th className="bg-slate-50 border-b border-gray-200 p-0 relative">
                                <div className="relative" style={{ width: totalWidth, height: RULER_HEIGHT }}>
                                    {hourTicks.map(tick => {
                                        const x = (tick - RULER_START) * PIXELS_PER_MINUTE;
                                        return (
                                            <div
                                                key={tick}
                                                className="absolute top-0 bottom-0 flex flex-col justify-end pb-1"
                                                style={{ left: x }}
                                            >
                                                <div className="w-px h-3 bg-gray-300 mx-auto mb-0.5" />
                                                <span className="text-[10px] text-gray-400 font-semibold -translate-x-1/2 relative left-0">
                                                    {formatHHMM(tick)}
                                                </span>
                                            </div>
                                        );
                                    })}

                                    {/* Current time label on ruler */}
                                    {showNow && (
                                        <div
                                            className="absolute top-0 flex flex-col items-center"
                                            style={{ left: nowOffset }}
                                        >
                                            <div className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-b-md shadow">
                                                {formatHHMM(nowMins)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </th>
                        </tr>
                    </thead>

                    <tbody className="relative">
                        {profiles.map(profile => (
                            <ProfileLane
                                key={profile.id}
                                yearId={yearId}
                                termId={termId}
                                profile={profile}
                                selectedDay={selectedDay}
                                classes={classes}
                                subjects={subjects}
                                staffList={staffList}
                                dayStartMins={RULER_START}
                                totalDayMins={totalDayMins}
                                nowMins={nowMins}
                                isToday={isToday}
                            />
                        ))}

                        {/* Now indicator overlay row (absolute div won't work in table cells across rows, use outline trick) */}
                    </tbody>
                </table>

                {/* The red "now" line overlaid using position absolute on the scroll container */}
                {showNow && (
                    <div
                        className="absolute top-0 bottom-0 pointer-events-none z-30"
                        style={{ left: LEFT_LABEL_WIDTH + nowOffset, width: 2, background: "rgba(239,68,68,0.7)", boxShadow: "0 0 6px rgba(239,68,68,0.5)" }}
                    />
                )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-[11px] text-gray-500">
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-3 rounded" style={{ background: 'hsl(210,55%,86%)' }} />
                    Upcoming lesson
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-3 rounded" style={{ background: 'hsl(210,72%,42%)' }} />
                    Active now
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-3 rounded" style={{ background: 'hsl(210,14%,92%)' }} />
                    Completed
                </div>
                {showNow && (
                    <div className="flex items-center gap-1.5">
                        <div className="w-0.5 h-3 bg-red-400" />
                        Current time
                    </div>
                )}
            </div>
        </div>
    );
}
