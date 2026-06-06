"use client";

import * as React from "react";
import { useTimetablePeriods, useTimetableEntries, useTimetableProfiles } from "@/lib/hooks/use-timetable";
import { useClasses } from "@/lib/hooks/use-classes";
import { useSubjects } from "@/lib/hooks/use-subjects";
import { useStaff } from "@/lib/hooks/use-staff";
import { Loader2, CalendarDays, AlignJustify } from "lucide-react";
import { format, parse } from "date-fns";
import { TimetableGrid } from "@/components/timetable/TimetableGrid";
import { PrintableTimetable } from "@/components/timetable/PrintableTimetable";
import type { TimetableEntry, GeneratedPeriod, Class, Subject, Staff } from "@/types";

// ─── Constants ───────────────────────────────────────────────────────────────
const DAYS = [
    { id: 1, label: "MON", full: "Monday" },
    { id: 2, label: "TUE", full: "Tuesday" },
    { id: 3, label: "WED", full: "Wednesday" },
    { id: 4, label: "THU", full: "Thursday" },
    { id: 5, label: "FRI", full: "Friday" },
    { id: 6, label: "SAT", full: "Saturday" },
];

const PIXELS_PER_MINUTE = 1.8;

function parseTimeStr(t: string): number {
    const parts = (t || "").split(":");
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

// Shared subject color system — golden-ratio hues for max distinction
const SUBJECT_HUES_W = [0, 138, 275, 53, 190, 328, 105, 243, 20, 158, 295, 73];

function getSubjectHueW(subjectId: string): number {
    let hash = 0;
    for (let i = 0; i < subjectId.length; i++) {
        hash = (hash * 31 + subjectId.charCodeAt(i)) & 0xffff;
    }
    return SUBJECT_HUES_W[hash % SUBJECT_HUES_W.length];
}

type WeekPeriodState = 'active' | 'past' | 'upcoming';

function getWeekCellStyle(subjectId: string, dimmed: boolean, highlighted: boolean, state: WeekPeriodState = 'upcoming'): React.CSSProperties {
    if (highlighted) return { background: '#fef3c7', outline: '1px solid #f59e0b', color: '#92400e' };
    if (dimmed) return { background: '#f8fafc', color: '#cbd5e1', opacity: 0.35 };
    const hue = getSubjectHueW(subjectId);
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
            background: `hsl(${hue}, 16%, 93%)`,
            borderColor: `hsl(${hue}, 12%, 84%)`,
            color: `hsl(${hue}, 14%, 62%)`,
        };
    }
    // upcoming / normal
    return {
        background: `hsl(${hue}, 55%, 88%)`,
        borderColor: `hsl(${hue}, 50%, 76%)`,
        color: `hsl(${hue}, 65%, 28%)`,
    };
}

type ViewMode = "day" | "week";
type FilterMode = "all" | "class" | "teacher" | "subject";

interface TimetableViewPanelProps {
    yearId: string;
    termId: string;
    profileId: string;
    profileName?: string;
    externalZoom?: number;
    setExternalZoom?: React.Dispatch<React.SetStateAction<number>>;
}

// ─── Week Grid View ───────────────────────────────────────────────────────────
// Renders all days as row-groups (like the reference image) with periods as columns.
function WeekGridView({
    entries, periods, classes, subjects, staffList, filterMode, filterId, timeFormat, externalZoom
}: {
    entries: TimetableEntry[]; periods: GeneratedPeriod[]; classes: Class[];
    subjects: Subject[]; staffList: Staff[];
    filterMode: FilterMode; filterId: string;
    timeFormat?: '12h' | '24h';
    externalZoom?: number;
}) {
    const zoom = externalZoom ?? 1;
    const pxPerMin = PIXELS_PER_MINUTE * zoom;

    const fmt = (t: string) => {
        if (!t) return '';
        if (timeFormat === '12h') {
            try { return format(parse(t, 'HH:mm', new Date()), 'h:mm a'); } catch { return t; }
        }
        return t;
    };
    // Use Monday's periods as the canonical column template
    const templatePeriods = React.useMemo(() =>
        periods
            .filter(p => p.dayOfWeek === 1)
            .sort((a, b) => parseTimeStr(a.startTime) - parseTimeStr(b.startTime)),
        [periods]);

    // Determine which classes to show — preserve the order from the profile
    const visibleClasses = React.useMemo(() => {
        if (filterMode === "class" && filterId) return classes.filter(c => c.id === filterId);
        return classes; // already ordered by profile's classIds
    }, [classes, filterMode, filterId]);

    // Days that actually have periods
    const visibleDays = DAYS.filter(d => periods.some(p => p.dayOfWeek === d.id));

    if (templatePeriods.length === 0) {
        return <p className="text-gray-400 text-sm text-center py-10">No periods found. Generate a timetable structure first.</p>;
    }

    const getEntry = (classId: string, dayId: number, templatePeriod: GeneratedPeriod): TimetableEntry | undefined => {
        // Find the actual period for this day matching the same period number and type
        const dayPeriod = periods.find(p =>
            p.dayOfWeek === dayId &&
            p.type === templatePeriod.type &&
            p.periodNumber === templatePeriod.periodNumber
        );
        if (!dayPeriod) return undefined;
        return entries.find(e => e.classId === classId && e.periodId === dayPeriod.id);
    };

    const isHighlighted = (entry: TimetableEntry | undefined): boolean => {
        if (!entry || !filterId) return false;
        if (filterMode === "teacher") return entry.teacherId === filterId;
        if (filterMode === "subject") return entry.subjectId === filterId;
        return false;
    };

    const isDimmed = (entry: TimetableEntry | undefined): boolean => {
        if (filterMode === "all" || filterMode === "class" || !filterId) return false;
        return !isHighlighted(entry);
    };

    // Hide the class column when a single class is selected — it's redundant
    const showClassCol = !(filterMode === "class" && filterId);

    const [currentTime, setCurrentTime] = React.useState(new Date());
    React.useEffect(() => {
        const t = setInterval(() => setCurrentTime(new Date()), 30000);
        return () => clearInterval(t);
    }, []);

    const activeColRef = React.useRef<HTMLTableCellElement>(null);

    React.useEffect(() => {
        if (activeColRef.current) {
            const timer = setTimeout(() => {
                activeColRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'center' });
            }, 250);
            return () => clearTimeout(timer);
        }
    }, [templatePeriods, zoom]);

    // Live tracker calculation
    const todayDayOfWeek = currentTime.getDay() || 7;
    const currentTimeStr = format(currentTime, 'HH:mm');
    const currentSecs = currentTime.getHours() * 3600 + currentTime.getMinutes() * 60 + currentTime.getSeconds();

    const firstLessonPeriod = templatePeriods.find(p => p.type !== 'break' && p.type !== 'lunch' && p.type !== 'assembly');
    const lastLessonPeriod = [...templatePeriods].reverse().find(p => p.type !== 'break' && p.type !== 'lunch' && p.type !== 'assembly');
    const dayStartMins = firstLessonPeriod ? parseTimeStr(firstLessonPeriod.startTime) : null;
    const dayEndMins = lastLessonPeriod ? parseTimeStr(lastLessonPeriod.endTime) : null;
    const currentMins = currentTime.getHours() * 60 + currentTime.getMinutes();

    // Only show tracker if today is a visible day and within school hours
    const showTracker = visibleDays.some(d => d.id === todayDayOfWeek) &&
        dayStartMins !== null && dayEndMins !== null &&
        currentMins >= dayStartMins && currentMins <= dayEndMins;

    // Sticky cols: 48px (day) + 72px (class if shown)
    const stickyOffset = showClassCol ? 120 : 48;

    // Sum column widths exactly as the table renders them — no drift
    let liveOffsetPx: number | null = null;
    if (showTracker) {
        let offset = stickyOffset;
        for (const p of templatePeriods) {
            const pStartSecs = parseTimeStr(p.startTime) * 60;
            const pEndSecs = parseTimeStr(p.endTime) * 60;
            const pDurMins = Math.max((pEndSecs - pStartSecs) / 60, 0);
            const colWidth = Math.max(40, Math.round(pDurMins * pxPerMin));

            if (currentSecs >= pEndSecs) {
                offset += colWidth;
            } else if (currentSecs >= pStartSecs) {
                const elapsed = currentSecs - pStartSecs;
                const total = pEndSecs - pStartSecs;
                offset += (elapsed / total) * colWidth;
                break;
            } else {
                break;
            }
        }
        liveOffsetPx = offset;
    }

    const tableRef = React.useRef<HTMLTableElement>(null);
    const [tableHeight, setTableHeight] = React.useState<number>(800);

    // Update table height dynamically (avoids infinite loop from absolute element overflow)
    React.useEffect(() => {
        if (!tableRef.current) return;
        const observer = new ResizeObserver(() => {
            if (tableRef.current) setTableHeight(tableRef.current.offsetHeight);
        });
        observer.observe(tableRef.current);
        return () => observer.disconnect();
    }, []);

    return (
        <div className="flex-1 min-h-0 flex flex-col pt-1">
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-220px)] sm:max-h-[calc(100vh-200px)] custom-scrollbar rounded-xl border border-gray-200 relative mb-4">
                <table ref={tableRef} className="text-sm border-separate border-spacing-0 min-w-[max-content]">
                    <thead>
                        <tr className="bg-slate-50 border-b border-gray-200">
                            {/* Day column — sticky left-0 */}
                            <th className="sticky top-0 left-0 z-40 bg-slate-50 border-r border-b border-gray-200 w-[48px] min-w-[48px] shadow-[1px_1px_0_0_#e5e7eb]" />
                            {/* Class column — sticky left-[48px], hidden when a specific class is selected */}
                            {showClassCol && (
                                <th className="sticky top-0 left-[48px] z-40 bg-slate-50 p-2 text-xs font-semibold text-gray-500 border-r border-b border-gray-200 w-[72px] min-w-[72px] text-center shadow-[1px_1px_0_0_#e5e7eb]">CLASS</th>
                            )}
                            {/* Period columns */}
                            {templatePeriods.map(p => {
                                const dur = Math.max(parseTimeStr(p.endTime) - parseTimeStr(p.startTime), 20);
                                const w = Math.max(40, Math.round(dur * pxPerMin));
                                const isBreak = p.type === "break" || p.type === "lunch" || p.type === "assembly";

                                // Auto-scroll ref target (matches current time regardless of break status)
                                const isCurrentlyActiveCol = currentTimeStr >= p.startTime && currentTimeStr < p.endTime;

                                // In-cell tracker
                                const isCurrentDayVisible = visibleDays.some(d => d.id === todayDayOfWeek);

                                const inCellFraction = (() => {
                                    if (!isCurrentDayVisible || isBreak) return null;
                                    if (currentTimeStr < p.startTime || currentTimeStr >= p.endTime) return null;
                                    const pStartSecs = parseTimeStr(p.startTime) * 60;
                                    const pEndSecs = parseTimeStr(p.endTime) * 60;
                                    return Math.min(Math.max((currentSecs - pStartSecs) / (pEndSecs - pStartSecs), 0), 1);
                                })();

                                return (
                                    <th
                                        key={p.id}
                                        className={`p-0.5 border-r border-b border-gray-200 text-center align-top relative overflow-visible sticky top-0 z-30 shadow-[0_1px_0_0_#e5e7eb] ${isBreak ? "bg-gray-100/80" : "bg-slate-50"}`}
                                        style={{ width: w, minWidth: w }}
                                    >
                                        {/* In-cell red timeline line */}
                                        {inCellFraction !== null && (
                                            <div
                                                className="absolute top-0 z-30 pointer-events-none"
                                                style={{ left: `${inCellFraction * 100}%` }}
                                            >
                                                <div className="bg-red-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-b-md shadow-sm whitespace-nowrap -translate-x-1/2">
                                                    {currentTimeStr}
                                                </div>
                                                <div
                                                    className="w-[2px] bg-red-400/80 shadow-[0_0_4px_rgba(239,68,68,0.5)] -translate-x-px"
                                                    style={{ height: tableHeight > 0 ? tableHeight : '100vh' }}
                                                />
                                            </div>
                                        )}
                                        <div className={`text-[9px] font-bold uppercase leading-none ${isBreak ? "text-gray-400" : "text-gray-500 bg-gray-100 px-1 py-0.5 rounded-sm"}`}>
                                            {isBreak ? (p.customLabel || p.type) : `L${p.periodNumber}`}
                                        </div>
                                        {!isBreak && (
                                            <>
                                                <div className="text-[8px] text-gray-400 leading-none mt-0.5">{fmt(p.startTime)}</div>
                                                <div className="text-[8px] text-gray-400 leading-none">{fmt(p.endTime)}</div>
                                            </>
                                        )}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    {visibleDays.map((day, dayIdx) => {
                        const rowCount = visibleClasses.length;
                        const isToday = day.id === todayDayOfWeek;
                        return (
                            <tbody
                                key={day.id}
                                className={isToday ? "relative z-10 outline outline-2 outline-indigo-500 -outline-offset-[2px] shadow-[0_4px_20px_rgba(99,102,241,0.2)]" : ""}
                            >
                                {visibleClasses.map((cls, clsIdx) => (
                                    <tr
                                        key={`${day.id}-${cls.id}`}
                                        className={`${isToday ? (dayIdx % 2 === 0 ? "bg-indigo-50/30" : "bg-indigo-50/50") : (dayIdx % 2 === 0 ? "bg-white" : "bg-slate-50/40")} border-b border-gray-100`}
                                    >
                                        {/* Day label cell — only on first class row, spans all class rows */}
                                        {clsIdx === 0 && (
                                            <td
                                                rowSpan={rowCount}
                                                className={`sticky left-0 z-10 border-r border-b border-gray-200 text-center align-middle font-black ${isToday ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-gray-600'}`}
                                                style={{ width: 48, minWidth: 48 }}
                                            >
                                                <div className="flex items-center justify-center h-full">
                                                    <span
                                                        className="text-[11px] font-black tracking-widest uppercase"
                                                        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", letterSpacing: "0.15em" }}
                                                    >
                                                        {day.label}
                                                    </span>
                                                </div>
                                            </td>
                                        )}
                                        {/* Class name — hidden when filtering by one class */}
                                        {showClassCol && (
                                            <td className={`sticky left-[48px] z-10 py-0.5 px-1 border-r border-b border-gray-200 text-[10px] font-bold text-gray-700 whitespace-nowrap shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] ${dayIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}`}>
                                                {cls.code || cls.name}
                                            </td>
                                        )}
                                        {/* Period cells */}
                                        {templatePeriods.map(templatePeriod => {
                                            const isBreak = templatePeriod.type === "break" || templatePeriod.type === "lunch" || templatePeriod.type === "assembly";
                                            const isActivePeriodForToday = day.id === todayDayOfWeek && currentTimeStr >= templatePeriod.startTime && currentTimeStr < templatePeriod.endTime;

                                            if (isBreak) {
                                                // Only render break cell on first class row, spanning all
                                                if (clsIdx === 0) {
                                                    return (
                                                        <td
                                                            key={templatePeriod.id}
                                                            ref={isActivePeriodForToday ? activeColRef : null}
                                                            rowSpan={rowCount}
                                                            className={`border-r border-gray-200 text-center align-middle relative overflow-hidden ${isActivePeriodForToday ? "bg-amber-100/60" : "bg-gray-100/90"}`}
                                                        >
                                                            {isActivePeriodForToday && (
                                                                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-amber-400/20 blur-xl rounded-full pointer-events-none" />
                                                            )}
                                                            <span
                                                                className={`text-[9px] font-black uppercase tracking-widest relative z-10 ${isActivePeriodForToday ? "text-amber-700" : "text-gray-400"}`}
                                                                style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                                                            >
                                                                {templatePeriod.customLabel || templatePeriod.type}
                                                            </span>
                                                        </td>
                                                    );
                                                }
                                                return null; // Other class rows skip this cell (rowSpan covers it)
                                            }

                                            // Check for grouped activity via linkedClassIds
                                            const groupEntry = visibleClasses
                                                .map(c => getEntry(c.id, day.id, templatePeriod))
                                                .find(e => e?.entryType === 'activity' && e?.linkedClassIds && e.linkedClassIds.length > 0);

                                            if (groupEntry) {
                                                const groupClassIds = [groupEntry.classId, ...(groupEntry.linkedClassIds || [])];
                                                const isInGroup = groupClassIds.includes(cls.id);
                                                if (isInGroup) {
                                                    const firstGroupClsIdx = visibleClasses.findIndex(c => groupClassIds.includes(c.id));
                                                    if (clsIdx === firstGroupClsIdx) {
                                                        const groupRowSpan = visibleClasses.filter(c => groupClassIds.includes(c.id)).length;
                                                        const actTeacher = staffList.find(s => s.id === groupEntry.teacherId);
                                                        return (
                                                            <td key={templatePeriod.id} ref={isActivePeriodForToday ? activeColRef : null} rowSpan={groupRowSpan} className="border-r border-gray-100 text-center align-middle p-0">
                                                                <div
                                                                    className="flex flex-col items-center justify-center h-full gap-0.5 px-1 py-1 mx-0.5 my-0.5 rounded border"
                                                                    style={{ background: 'hsl(270,50%,87%)', borderColor: 'hsl(270,45%,75%)', color: 'hsl(270,60%,28%)' }}
                                                                >
                                                                    <span className="text-[9px] font-black uppercase tracking-wide leading-tight text-center">{groupEntry.activityName || 'ACT'}</span>
                                                                    {actTeacher && <span className="text-[8px] opacity-70 leading-tight">{actTeacher.firstName[0]}. {actTeacher.lastName?.split(' ')[0]}</span>}
                                                                    <span className="text-[7px] opacity-50 leading-none">All Classes</span>
                                                                </div>
                                                            </td>
                                                        );
                                                    }
                                                    return null; // covered by rowSpan
                                                }
                                            }

                                            const entry = getEntry(cls.id, day.id, templatePeriod);
                                            const subject = entry ? subjects.find(s => s.id === entry.subjectId) : null;
                                            const teacher = entry ? staffList.find(s => s.id === entry.teacherId) : null;
                                            const highlighted = isHighlighted(entry);
                                            const dimmed = isDimmed(entry);

                                            // Compute period state for this cell (only meaningful for today)
                                            const isToday = day.id === todayDayOfWeek;
                                            const activeTimeStr = currentTimeStr;
                                            const periodState: WeekPeriodState = isToday
                                                ? (activeTimeStr >= templatePeriod.startTime && activeTimeStr < templatePeriod.endTime
                                                    ? 'active'
                                                    : activeTimeStr >= templatePeriod.endTime ? 'past' : 'upcoming')
                                                : 'upcoming';

                                            if (entry && entry.entryType === 'activity') {
                                                const actTeacher = staffList.find(s => s.id === entry.teacherId);
                                                const isActiveActivity = periodState === 'active';
                                                return (
                                                    <td key={templatePeriod.id} ref={isActivePeriodForToday && clsIdx === 0 ? activeColRef : null} className="border-r border-gray-100 text-center align-middle relative h-[38px] p-0">
                                                        <div
                                                            className="absolute inset-0 m-px rounded border flex flex-col items-center justify-center"
                                                            style={isActiveActivity
                                                                ? { background: 'hsl(270,55%,45%)', borderColor: 'hsl(270,55%,35%)', color: 'white' }
                                                                : periodState === 'past'
                                                                    ? { background: 'hsl(270,12%,91%)', borderColor: 'hsl(270,10%,82%)', color: 'hsl(270,14%,62%)' }
                                                                    : { background: 'hsl(270,50%,87%)', borderColor: 'hsl(270,45%,75%)', color: 'hsl(270,60%,30%)' }
                                                            }
                                                        >
                                                            <span className="text-[9px] font-black uppercase leading-tight tracking-wide">{entry.activityName || 'ACT'}</span>
                                                            {actTeacher && <span className="text-[8px] leading-tight opacity-75">{actTeacher.firstName[0]}. {actTeacher.lastName?.split(' ')[0]}</span>}
                                                        </div>
                                                    </td>
                                                );
                                            }

                                            const cellStyle = entry && subject ? getWeekCellStyle(subject.id, dimmed, highlighted, periodState) : {};

                                            return (
                                                <td
                                                    key={templatePeriod.id}
                                                    ref={isActivePeriodForToday && clsIdx === 0 ? activeColRef : null}
                                                    className="border-r border-gray-100 text-center align-middle relative h-[38px] p-0"
                                                >
                                                    {entry && subject ? (() => {
                                                        const optSubject = entry.optionalSubjectId ? subjects.find(s => s.id === entry.optionalSubjectId) : null;
                                                        const optTeacher = entry.optionalTeacherId ? staffList.find(s => s.id === entry.optionalTeacherId) : null;
                                                        const isSplit = !!optSubject;

                                                        const primaryStyle = getWeekCellStyle(subject.id, dimmed, highlighted, periodState);
                                                        const secondaryStyle = isSplit ? getWeekCellStyle(optSubject.id, dimmed, highlighted, periodState) : {};

                                                        if (isSplit) {
                                                            return (
                                                                <div className="absolute inset-0 m-px flex flex-col rounded border overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
                                                                    <div className="flex-1 flex flex-col items-center justify-center border-b border-white/40 min-h-0 py-[1px]" style={primaryStyle}>
                                                                        <span className="text-[9px] font-bold leading-tight truncate px-1" style={{ color: 'inherit' }}>
                                                                            {subject.code || subject.name?.substring(0, 4) || '?'}
                                                                        </span>
                                                                        {teacher && (
                                                                            <span className="text-[7.5px] leading-tight opacity-75 truncate max-w-full px-1">
                                                                                {teacher.firstName[0]}. {teacher.lastName?.split(' ')[0]}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex-1 flex flex-col items-center justify-center min-h-0 py-[1px]" style={secondaryStyle}>
                                                                        <span className="text-[9px] font-bold leading-tight truncate px-1" style={{ color: 'inherit' }}>
                                                                            {optSubject.code || optSubject.name?.substring(0, 4) || '?'}
                                                                        </span>
                                                                        {optTeacher && (
                                                                            <span className="text-[7.5px] leading-tight opacity-75 truncate max-w-full px-1">
                                                                                {optTeacher.firstName[0]}. {optTeacher.lastName?.split(' ')[0]}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <div
                                                                style={primaryStyle}
                                                                className="absolute inset-0 m-px rounded border flex flex-col items-center justify-center p-0.5"
                                                            >
                                                                <span className="font-bold text-[10px] sm:text-[11px] leading-tight truncate px-1 w-full block text-center" style={{ color: 'inherit' }}>
                                                                    {subject.code || subject.name?.substring(0, 4) || '?'}
                                                                </span>
                                                                {teacher && (
                                                                    <span className="text-[8px] sm:text-[9px] leading-tight opacity-75 truncate px-1 w-full text-center mt-0.5">
                                                                        {teacher.firstName[0]}. {teacher.lastName?.split(' ')[0]}
                                                                    </span>
                                                                )}
                                                                {periodState === 'active' && (
                                                                    <span className="absolute bottom-0.5 left-0 right-0 flex justify-center">
                                                                        <span className="inline-block w-1 h-1 rounded-full bg-white opacity-80 animate-pulse" />
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })() : null}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                                {/* Day separator */}
                                <tr className="h-[2px] bg-gray-300" key={`sep-${day.id}`}>
                                    <td colSpan={2 + templatePeriods.length} className="bg-gray-300 p-0" />
                                </tr>
                            </tbody>
                        );
                    })}
                </table>
            </div>
        </div>
    );
}

// ─── Main Panel ──────────────────────────────────────────────────────────────
export function TimetableViewPanel({ yearId, termId, profileId, profileName, externalZoom, setExternalZoom }: TimetableViewPanelProps) {
    const [viewMode, setViewMode] = React.useState<ViewMode>("day");
    const [filterMode, setFilterMode] = React.useState<FilterMode>("all");
    const [filterId, setFilterId] = React.useState<string>("");
    const [isPrinting, setIsPrinting] = React.useState(false);

    const { data: periods = [], isLoading: pl } = useTimetablePeriods(yearId, termId, profileId);
    const { data: entries = [], isLoading: el } = useTimetableEntries(yearId, termId, profileId);
    const { data: classes = [], isLoading: cl } = useClasses();
    const { data: subjects = [] } = useSubjects();
    const { data: staffList = [] } = useStaff();

    const isLoading = pl || el || cl;

    // Fetch all profiles to find classIds for the current profile
    const { data: profiles = [] } = useTimetableProfiles(yearId, termId);
    const currentProfile = profiles.find(p => p.id === profileId);

    // Match day view ordering: filter the fetched classes array (preserves its order),
    // same as TimetableGrid does with classes.filter(c => profile.classIds.includes(c.id))
    const profileClasses = React.useMemo(() => {
        if (currentProfile?.classIds && currentProfile.classIds.length > 0) {
            const filtered = classes.filter(c => currentProfile.classIds.includes(c.id));
            return filtered.length > 0 ? filtered : classes;
        }
        // Fallback: derive from entries
        if (entries.length > 0) {
            const ids = new Set(entries.map(e => e.classId));
            const filtered = classes.filter(c => ids.has(c.id));
            if (filtered.length > 0) return filtered;
        }
        return classes;
    }, [currentProfile, entries, classes]);

    // Reset filterId when filterMode changes
    React.useEffect(() => { setFilterId(""); }, [filterMode]);

    const FILTER_OPTIONS = [
        { id: "all" as FilterMode, label: "All Classes" },
        { id: "class" as FilterMode, label: "By Class" },
        { id: "teacher" as FilterMode, label: "By Teacher" },
        { id: "subject" as FilterMode, label: "By Subject" },
    ];

    // Compute the initialDay prop for TimetableGrid when in day view + class filter
    const dayViewInitialDay = undefined; // TimetableGrid handles its own day tab

    const [internalZoom, setInternalZoom] = React.useState(1);
    const zoom = externalZoom !== undefined ? externalZoom : internalZoom;
    const updateZoom = setExternalZoom || setInternalZoom;

    const [isEditing, setIsEditing] = React.useState(false);
    const [selectedDay, setSelectedDay] = React.useState<number>(new Date().getDay() || 7);
    const [isFabOpen, setIsFabOpen] = React.useState(false);

    // Close FAB when disabling edit mode
    React.useEffect(() => {
        if (!isEditing) setIsFabOpen(false);
    }, [isEditing]);

    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-5 min-w-0 flex flex-col gap-3 h-[calc(100vh-170px)] overflow-hidden">

            {isPrinting && (
                <PrintableTimetable 
                    entries={entries}
                    periods={periods}
                    classes={profileClasses}
                    subjects={subjects}
                    staffList={staffList}
                    timeFormat={currentProfile?.timeFormat}
                    onClose={() => setIsPrinting(false)}
                />
            )}

            {/* ── Unified Control Toolbar ── */}
            <div className="flex-shrink-0 flex bg-gray-50/80 p-1.5 sm:p-2 rounded-full sm:rounded-xl border border-gray-100 overflow-hidden">
                <div className="flex flex-row items-center gap-2 w-full overflow-x-auto hide-scrollbar custom-scrollbar-mobile pb-0.5 min-w-0">

                    {/* Unified Pill: View Mode + Filters */}
                    <div className="flex flex-nowrap flex-shrink-0 items-center bg-white rounded-full border border-gray-200 p-0.5 shadow-sm divide-x divide-gray-200">
                        {/* View Mode Toggle */}
                        <div className="flex items-center px-1">
                            <select
                                value={viewMode}
                                onChange={(e) => setViewMode(e.target.value as ViewMode)}
                                className="sm:hidden text-xs font-semibold text-gray-700 bg-transparent focus:outline-none appearance-none cursor-pointer py-1"
                            >
                                <option value="day">Day View</option>
                                <option value="week">Week View</option>
                            </select>
                            <div className="hidden sm:flex items-center">
                                <button
                                    onClick={() => setViewMode("day")}
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${viewMode === "day"
                                        ? "bg-blue-50 text-blue-700 shadow-sm border border-blue-200/50"
                                        : "text-gray-500 hover:text-gray-700 bg-transparent"
                                        }`}
                                >
                                    Day
                                </button>
                                <button
                                    onClick={() => setViewMode("week")}
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${viewMode === "week"
                                        ? "bg-purple-50 text-purple-700 shadow-sm border border-purple-200/50"
                                        : "text-gray-500 hover:text-gray-700 bg-transparent"
                                        }`}
                                >
                                    Week
                                </button>
                            </div>
                        </div>

                        {/* Hidden Export PDF Button (triggered from header) */}
                        <div className="hidden">
                            <button id="hidden-print-btn" onClick={() => setIsPrinting(true)} />
                        </div>

                        {/* Filters */}
                        <div className="flex items-center gap-1 px-1.5 min-w-0">
                            <select
                                value={filterMode}
                                onChange={e => setFilterMode(e.target.value as FilterMode)}
                                className="text-xs font-medium text-gray-700 focus:outline-none bg-transparent appearance-none cursor-pointer py-1.5 px-1"
                            >
                                {FILTER_OPTIONS.map(opt => (
                                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                                ))}
                            </select>

                            {filterMode === "class" && (
                                <select
                                    value={filterId}
                                    onChange={e => setFilterId(e.target.value)}
                                    className="text-xs font-semibold text-indigo-700 focus:outline-none bg-indigo-50/50 rounded-full px-2.5 py-1 max-w-[120px] truncate appearance-none cursor-pointer border border-indigo-100/50"
                                >
                                    <option value="">— Class —</option>
                                    {profileClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            )}
                            {filterMode === "teacher" && (
                                <select
                                    value={filterId}
                                    onChange={e => setFilterId(e.target.value)}
                                    className="text-xs font-semibold text-indigo-700 focus:outline-none bg-indigo-50/50 rounded-full px-2.5 py-1 max-w-[120px] truncate appearance-none cursor-pointer border border-indigo-100/50"
                                >
                                    <option value="">— Teacher —</option>
                                    {staffList.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
                                </select>
                            )}
                            {filterId && filterMode === "teacher" && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold ml-1">{entries.filter(e => e.teacherId === filterId).length}</span>}
                            {filterId && filterMode === "subject" && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold ml-1">{entries.filter(e => e.subjectId === filterId).length}</span>}
                        </div>
                    </div>

                    {/* Compact Day Chips (Only on Day View) */}
                    {viewMode === "day" && (
                        <div className="flex flex-nowrap flex-shrink-0 items-center bg-white rounded-full border border-gray-200 p-0.5 shadow-sm ml-auto sm:ml-2">
                            {DAYS.map((dayName, idx) => {
                                const dayId = idx + 1;
                                const hasPeriods = periods.some(p => p.dayOfWeek === dayId);
                                if (!hasPeriods && dayId > 5) return null;
                                return (
                                    <button
                                        key={dayId}
                                        onClick={() => setSelectedDay(dayId)}
                                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors whitespace-nowrap flex-shrink-0 ${selectedDay === dayId
                                            ? "bg-blue-600 text-white shadow-sm"
                                            : "text-gray-500 hover:bg-gray-50"
                                            }`}
                                    >
                                        {dayName.substring(0, 3)}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Content Area ── */}
            {viewMode === "day" ? (
                // Day View — full interactive TimetableGrid with editing capability
                <div className="flex-1 min-h-0 min-w-0 overflow-hidden -mx-3 sm:-mx-5 px-3 sm:px-5 flex flex-col">
                    <TimetableGrid
                        yearId={yearId}
                        termId={termId}
                        profileId={profileId}
                        hideToolbar={true}
                        externalZoom={zoom}
                        setExternalZoom={updateZoom}
                        externalIsEditing={isEditing}
                        setExternalIsEditing={setIsEditing}
                        externalSelectedDay={selectedDay}
                        setExternalSelectedDay={setSelectedDay}
                        filterMode={filterMode}
                        filterId={filterId}
                    />
                </div>
            ) : (
                // Week View — full-week grid like reference image, with filter applied
                <WeekGridView
                    entries={entries}
                    periods={periods}
                    classes={profileClasses}
                    subjects={subjects}
                    staffList={staffList}
                    filterMode={filterMode}
                    filterId={filterId}
                    timeFormat={currentProfile?.timeFormat}
                    externalZoom={zoom}
                />
            )}

            {/* ── Floating Quick Actions (Day View) ── */}
            {viewMode === "day" && (
                <div className="fixed sm:absolute bottom-6 sm:bottom-6 right-6 sm:right-6 z-50 flex flex-col items-end gap-2 group">
                    {/* Expanded Actions */}
                    <div className={`flex flex-col items-end gap-2 transition-all duration-300 origin-bottom-right ${isFabOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4 pointer-events-none'}`}>
                        {/* Auto Arrange (Placeholder) */}
                        <button
                            className="bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-full shadow-lg border border-gray-200 flex items-center gap-2 text-sm font-semibold transition-all hover:-translate-y-0.5"
                            onClick={() => { }} // Hook up auto-arrange logic later
                        >
                            <span>✣</span> Auto Arrange
                        </button>

                        {/* Add Lesson (Turns on Edit Mode) */}
                        <button
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full shadow-lg border border-blue-700 flex items-center gap-2 text-sm font-semibold transition-all hover:-translate-y-0.5"
                            onClick={() => { setIsEditing(true); setIsFabOpen(false); }}
                        >
                            <span>➕</span> Add / Manage Lessons
                        </button>
                    </div>

                    {/* Primary FAB Toggle */}
                    <button
                        onClick={() => {
                            if (isEditing) {
                                setIsEditing(false);
                            } else {
                                setIsFabOpen(!isFabOpen);
                            }
                        }}
                        className={`flex items-center justify-center w-14 h-14 rounded-full shadow-xl text-white transition-all duration-300 hover:scale-105 active:scale-95 ${isEditing
                            ? 'bg-amber-500 hover:bg-amber-600 border-2 border-amber-300'
                            : isFabOpen
                                ? 'bg-gray-800 hover:bg-gray-900 border-2 border-gray-700'
                                : 'bg-white hover:bg-gray-50 border border-gray-200 text-gray-800'
                            }`}
                        title={isEditing ? 'Done Editing' : 'Quick Actions'}
                    >
                        {isEditing ? (
                            <span className="font-bold text-sm">Done</span>
                        ) : isFabOpen ? (
                            <span className="text-xl">✕</span>
                        ) : (
                            <div className="flex items-center gap-2 pr-2 pl-3">
                                <span>✏️</span>
                                <span className="text-xl leading-none -ml-1">+</span>
                            </div>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
