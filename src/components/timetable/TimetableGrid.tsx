"use client";

import * as React from "react";
import { useTimetablePeriods, useTimetableEntries, useSaveTimetableEntries, useDeleteTimetableEntry, useTimetableProfiles, useSaveTimetablePeriods } from "@/lib/hooks/use-timetable";
import { useClasses } from "@/lib/hooks/use-classes";
import { useSubjects } from "@/lib/hooks/use-subjects";
import { useStaff } from "@/lib/hooks/use-staff";
import { Loader2, Plus, GripVertical, Info, Clock, User, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parse, format, addMinutes, differenceInMinutes, isSameDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { TimetableEntry, GeneratedPeriod, Class, Subject, Staff } from "@/types";

const BASE_PX_PER_MIN = 1.8; // base: 60min = 108px — compact default

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

// Golden-ratio spaced hues — maximally perceptually distinct across full 360°
// Pattern: 0, 137.5, 275, 52.5, 190, 327.5, 105, 242.5, 20, 157.5, 295, 72.5
const SUBJECT_HUES = [0, 138, 275, 53, 190, 328, 105, 243, 20, 158, 295, 73];

function getSubjectCategoryHue(subjectName: string): number {
    if (!subjectName) return 0;
    const name = subjectName.toLowerCase();

    // Sciences / Math = Blue (210)
    if (name.match(/\b(math|mathematics|mtc|science|sci|physics|chemistry|biology|ict|computing|computer|tech)\b/)) return 210;

    // Languages = Green (145)
    if (name.match(/\b(english|eng|lit|literature|french|swahili|luganda|arabic|german|reading|writing|phonics)\b/)) return 145;

    // Humanities = Purple (270)
    if (name.match(/\b(social studies|sst|history|geography|cre|ire|religion|civics|ethics)\b/)) return 270;

    // Activities / Arts = Orange (30)
    if (name.match(/\b(pe|physical education|art|music|mdd|library|sports|games)\b/)) return 30;

    // Fallback: hash-based
    let hash = 0;
    for (let i = 0; i < subjectName.length; i++) {
        hash = (hash * 31 + subjectName.charCodeAt(i)) & 0xffff;
    }
    return SUBJECT_HUES[Math.abs(hash) % SUBJECT_HUES.length];
}

type PeriodState = 'active' | 'past' | 'upcoming';

function getSubjectCellStyle(
    subjectName: string,
    state: PeriodState,
    hasCollision: boolean,
    isEditing: boolean
): React.CSSProperties {
    if (hasCollision && isEditing) {
        return {
            background: state === 'active' ? '#dc2626' : state === 'past' ? '#fee2e2' : '#fef2f2',
            borderColor: state === 'active' ? '#b91c1c' : '#fca5a5',
            color: state === 'active' ? '#fff' : '#dc2626',
        };
    }
    const hue = getSubjectCategoryHue(subjectName);
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
        background: `hsl(${hue}, 58%, 88%)`,
        borderColor: `hsl(${hue}, 55%, 76%)`,
        color: `hsl(${hue}, 65%, 28%)`,
    };
}

interface TimetableGridProps {
    yearId: string;
    termId: string;
    profileId: string;
    /** When provided, hides the internal day tab selector and uses this value directly. */
    initialDay?: number;
    externalZoom?: number;
    setExternalZoom?: (z: number) => void;
    externalIsEditing?: boolean;
    setExternalIsEditing?: (bz: boolean) => void;
    externalSelectedDay?: number;
    setExternalSelectedDay?: (d: number) => void;
    hideToolbar?: boolean;
    filterMode?: string;
    filterId?: string;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function TimetableGrid({
    yearId, termId, profileId, initialDay,
    externalZoom, setExternalZoom,
    externalIsEditing, setExternalIsEditing,
    externalSelectedDay, setExternalSelectedDay,
    hideToolbar, filterMode, filterId
}: TimetableGridProps) {
    const { toast } = useToast();
    // Data Fetching
    const { data: profiles = [] } = useTimetableProfiles(yearId, termId);
    const profile = profiles.find(p => p.id === profileId);

    const { data: periods = [], isLoading: periodsLoading } = useTimetablePeriods(yearId, termId, profileId);
    const { data: entries = [], isLoading: entriesLoading } = useTimetableEntries(yearId, termId, profileId);
    const { data: classes = [], isLoading: classesLoading } = useClasses();
    const { data: subjects = [] } = useSubjects();
    const { data: staffList = [] } = useStaff();

    const classesToRender = React.useMemo(() => {
        if (!profile || !profile.classIds || profile.classIds.length === 0) return [...classes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        // Filter to profile's classes then sort by the class 'order' field (set at class creation)
        let filtered = classes
            .filter(c => profile.classIds.includes(c.id))
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        if (filterMode && filterId) {
            if (filterMode === "class") {
                filtered = filtered.filter(c => c.id === filterId);
            } else if (filterMode === "teacher") {
                const matchingClassIds = new Set(entries.filter(e => e.teacherId === filterId).map(e => e.classId));
                filtered = filtered.filter(c => matchingClassIds.has(c.id));
            } else if (filterMode === "subject") {
                const matchingClassIds = new Set(entries.filter(e => e.subjectId === filterId).map(e => e.classId));
                filtered = filtered.filter(c => matchingClassIds.has(c.id));
            }
        }
        return filtered;
    }, [classes, profile, filterMode, filterId, entries]);

    const saveMutation = useSaveTimetableEntries();
    const deleteMutation = useDeleteTimetableEntry();
    const savePeriodsMutation = useSaveTimetablePeriods();

    const currentDayOfWeek = new Date().getDay() || 7;
    const [internalSelectedDay, setInternalSelectedDay] = React.useState<number>(initialDay ?? currentDayOfWeek);
    const [internalZoom, setInternalZoom] = React.useState<number>(1); // 0.5 – 2.5
    const [internalIsEditing, setInternalIsEditing] = React.useState<boolean>(false);

    const selectedDay = externalSelectedDay ?? internalSelectedDay;
    const setSelectedDay = setExternalSelectedDay ?? setInternalSelectedDay;
    const zoom = externalZoom ?? internalZoom;
    const setZoom = setExternalZoom ?? setInternalZoom;
    const isEditing = externalIsEditing ?? internalIsEditing;
    const setIsEditing = setExternalIsEditing ?? setInternalIsEditing;

    // Keep selectedDay in sync if parent changes the initialDay prop
    React.useEffect(() => {
        if (initialDay !== undefined && !setExternalSelectedDay) setInternalSelectedDay(initialDay);
    }, [initialDay, setExternalSelectedDay]);

    const [activeCell, setActiveCell] = React.useState<{ classId: string; periodId: string } | null>(null);
    const [editingPeriod, setEditingPeriod] = React.useState<{ id: string, newStartTime: string, newEndTime: string } | null>(null);
    const [currentTime, setCurrentTime] = React.useState(new Date());
    const pxPerMin = BASE_PX_PER_MIN * zoom;

    const activeColRef = React.useRef<HTMLTableCellElement>(null);
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

    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const hasAutoScrolledRef = React.useRef(false);

    // Reset one-time auto-scroll when the day changes
    React.useEffect(() => {
        hasAutoScrolledRef.current = false;
    }, [selectedDay]);

    // Auto-scroll to active period once per day — skip while editing so horizontal scroll isn't hijacked
    React.useEffect(() => {
        if (isEditing || hasAutoScrolledRef.current) return;
        if (selectedDay !== currentDayOfWeek || !activeColRef.current) return;
        const timer = setTimeout(() => {
            const container = scrollContainerRef.current;
            const activeCol = activeColRef.current;
            if (!container || !activeCol) return;
            const containerRect = container.getBoundingClientRect();
            const colRect = activeCol.getBoundingClientRect();
            const targetLeft =
                container.scrollLeft +
                (colRect.left - containerRect.left) -
                (container.clientWidth - colRect.width) / 2;
            container.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
            hasAutoScrolledRef.current = true;
        }, 250);
        return () => clearTimeout(timer);
    }, [selectedDay, currentDayOfWeek, periods, zoom, isEditing]);

    React.useEffect(() => {
        const msUntilNextMinute = (60 - new Date().getSeconds()) * 1000 - new Date().getMilliseconds();
        const sync = setTimeout(() => {
            setCurrentTime(new Date());
            const interval = setInterval(() => setCurrentTime(new Date()), 60000);
            return () => clearInterval(interval);
        }, msUntilNextMinute);
        return () => clearTimeout(sync);
    }, []);

    const isLoading = periodsLoading || entriesLoading || classesLoading;

    // Filter periods for the selected day
    const dayPeriods = React.useMemo(() => {
        return periods.filter(p => p.dayOfWeek === selectedDay).sort((a, b) => a.startTime.localeCompare(b.startTime));
    }, [periods, selectedDay]);

    // Pre-compute grouped activities using linkedClassIds (set by the "Group Activity" toggle)
    // A grouped activity entry has linkedClassIds pointing to its partner class entries.
    const sharedActivityMap = React.useMemo(() => {
        const map = new Map<string, { activityName: string; teacherId: string; groupClassIds: string[]; rowSpan: number; colSpan: number }>();
        const processedPeriods = new Set<string>();
        dayPeriods.forEach(period => {
            if (processedPeriods.has(period.id)) return;
            // Find any activity entry for this period that has linkedClassIds
            const groupEntry = entries.find(e =>
                e.periodId === period.id &&
                e.entryType === 'activity' &&
                e.linkedClassIds && e.linkedClassIds.length > 0
            );
            if (!groupEntry) return;
            // The full group is this class + all linked classes
            const groupClassIds = [groupEntry.classId, ...(groupEntry.linkedClassIds || [])];
            // Count how many of our rendered classes are in this group
            const renderedInGroup = classesToRender.filter(c => groupClassIds.includes(c.id));
            if (renderedInGroup.length > 1) {
                map.set(period.id, {
                    activityName: groupEntry.activityName || 'ACT',
                    teacherId: groupEntry.teacherId || '',
                    groupClassIds,
                    rowSpan: renderedInGroup.length,
                    colSpan: groupEntry.periodSpan || 1,
                });
            }
            processedPeriods.add(period.id);
        });
        return map;
    }, [dayPeriods, classesToRender, entries]);

    const handleAssignSubject = async (
        classId: string, periodId: string, subjectId: string, teacherId: string, periodSpan: number = 1,
        optionalSubjectId?: string, optionalTeacherId?: string
    ) => {
        // 1. Collision detection front-end check
        const existingConflict = entries.find(e =>
            teacherId !== 'UNASSIGNED' &&
            e.periodId === periodId &&
            e.teacherId === teacherId &&
            e.classId !== classId
        );

        if (existingConflict) {
            const conflictClass = classes.find(c => c.id === existingConflict.classId);
            toast({
                variant: "destructive",
                title: "Teacher Collision Detected!",
                description: `This teacher is already teaching ${conflictClass?.name || 'another class'} during this period.`,
            });
            // Continuing to allow assignment with a warning (per requirements: "just a visible warning")
        }

        // 2. See if there is an existing entry for this cell
        const existingEntry = entries.find(e => e.classId === classId && e.periodId === periodId);

        try {
            if (existingEntry) {
                // Update
                if (existingEntry.subjectId === subjectId && existingEntry.teacherId === teacherId && existingEntry.periodSpan === periodSpan &&
                    existingEntry.optionalSubjectId === optionalSubjectId && existingEntry.optionalTeacherId === optionalTeacherId) return; // No change
                await saveMutation.mutateAsync({
                    yearId, termId, timetableId: profileId,
                    entries: [{ id: existingEntry.id, classId, periodId, subjectId, teacherId, periodSpan, optionalSubjectId, optionalTeacherId }]
                });
            } else {
                // Create
                await saveMutation.mutateAsync({
                    yearId, termId, timetableId: profileId,
                    entries: [{ classId, periodId, subjectId, teacherId, periodSpan, optionalSubjectId, optionalTeacherId }]
                });
            }
            setActiveCell(null);
        } catch (e) {
            toast({ variant: "destructive", title: "Error", description: "Failed to save assignment" });
        }
    };

    const handleClearCell = async (classId: string, periodId: string) => {
        const existingEntry = entries.find(e => e.classId === classId && e.periodId === periodId);
        if (existingEntry) {
            try {
                await deleteMutation.mutateAsync({ yearId, termId, timetableId: profileId, entryId: existingEntry.id });
                toast({ title: "Cleared", description: "Assignment removed." });
            } catch (e) {
                toast({ variant: "destructive", title: "Error", description: "Failed to remove assignment" });
            }
        }
        setActiveCell(null);
    };

    const handleAssignActivity = async (
        classId: string, periodId: string,
        activityName: string, teacherId: string,
        linkedClassIds: string[] = [], periodSpan: number = 1
    ) => {
        const existing = entries.find(e => e.classId === classId && e.periodId === periodId);

        // Find if there are any classes that were previously linked but are now removed
        const previousLinkedClassIds = existing?.linkedClassIds || [];
        const removedLinkedClassIds = previousLinkedClassIds.filter(id => !linkedClassIds.includes(id));

        const entryPayload = {
            classId, periodId,
            subjectId: 'ACTIVITY',
            teacherId: teacherId || 'UNASSIGNED',
            entryType: 'activity' as const,
            activityName,
            linkedClassIds,
            periodSpan,
        };

        const entriesToSave = [];

        if (existing) {
            entriesToSave.push({ id: existing.id, ...entryPayload });
        } else {
            entriesToSave.push(entryPayload);
        }

        // Propagate to each linked class
        for (const linkedId of linkedClassIds) {
            if (linkedId === classId) continue;
            const linkedExisting = entries.find(e => e.classId === linkedId && e.periodId === periodId);
            const linkedPayload = {
                ...entryPayload,
                classId: linkedId,
                linkedClassIds: [classId, ...linkedClassIds.filter(id => id !== linkedId)],
            };
            if (linkedExisting) {
                entriesToSave.push({ id: linkedExisting.id, ...linkedPayload });
            } else {
                entriesToSave.push(linkedPayload);
            }
        }

        try {
            // Delete orphaned linked classes
            for (const removedClassId of removedLinkedClassIds) {
                const orphanedEntry = entries.find(e => e.classId === removedClassId && e.periodId === periodId);
                if (orphanedEntry) {
                    await deleteMutation.mutateAsync({ yearId, termId, timetableId: profileId, entryId: orphanedEntry.id });
                }
            }

            // Save the current and new linked classes
            if (entriesToSave.length > 0) {
                await saveMutation.mutateAsync({ yearId, termId, timetableId: profileId, entries: entriesToSave });
            }

            setActiveCell(null);
            toast({
                title: "Activity Saved",
                description: `"${activityName}" assigned${linkedClassIds.length > 0 ? ` across ${linkedClassIds.length + 1} classes` : ''}.`,
            });
        } catch (e) {
            toast({ variant: "destructive", title: "Error", description: "Failed to save activity" });
        }
    };

    const handleSavePeriodTimes = async () => {
        if (!editingPeriod) return;

        try {
            // Find the index of the edited period
            const sortedPeriods = [...dayPeriods];
            const editedIndex = sortedPeriods.findIndex(p => p.id === editingPeriod.id);
            if (editedIndex === -1) return;

            const originalPeriod = sortedPeriods[editedIndex];

            // Parse dates
            const originalEnd = parse(originalPeriod.endTime, "HH:mm", new Date());
            const newEnd = parse(editingPeriod.newEndTime, "HH:mm", new Date());

            // Calculate delta in minutes
            const deltaMinutes = differenceInMinutes(newEnd, originalEnd);

            const updatedPeriods: Partial<GeneratedPeriod>[] = [];

            // Update the currently edited period
            updatedPeriods.push({
                id: editingPeriod.id,
                startTime: editingPeriod.newStartTime,
                endTime: editingPeriod.newEndTime
            });

            // If there's a delta, shift all subsequent periods for this day
            if (deltaMinutes !== 0) {
                for (let i = editedIndex + 1; i < sortedPeriods.length; i++) {
                    const p = sortedPeriods[i];
                    const pStart = parse(p.startTime, "HH:mm", new Date());
                    const pEnd = parse(p.endTime, "HH:mm", new Date());

                    const shiftedStart = addMinutes(pStart, deltaMinutes);
                    const shiftedEnd = addMinutes(pEnd, deltaMinutes);

                    updatedPeriods.push({
                        id: p.id,
                        startTime: format(shiftedStart, "HH:mm"),
                        endTime: format(shiftedEnd, "HH:mm")
                    });
                }
            }

            await savePeriodsMutation.mutateAsync({
                yearId, termId, timetableId: profileId, periods: updatedPeriods
            });

            toast({ title: "Updated", description: "Period structure updated successfully." });
            setEditingPeriod(null);
        } catch (e) {
            toast({ variant: "destructive", title: "Error", description: "Failed to update period times." });
        }
    };

    // We removed the explicit isLoading branch to allow the grid to snap-in instantly
    return (
        <div className="flex flex-col gap-3 min-w-0 max-w-full h-full flex-1 overflow-hidden">
            {/* Day Selector Tabs — hidden when toolbar is managed externally */}
            {!hideToolbar && initialDay === undefined && (
                <div className="flex flex-wrap gap-1 mb-2 overflow-x-auto pb-1 custom-scrollbar">
                    {DAYS.map((dayName, idx) => {
                        const dayId = idx + 1;
                        const hasPeriods = periods.some(p => p.dayOfWeek === dayId);
                        if (!hasPeriods && dayId > 5) return null;
                        return (
                            <Button
                                key={dayId}
                                variant={selectedDay === dayId ? "default" : "outline"}
                                onClick={() => setSelectedDay(dayId)}
                                size="sm"
                                className={`rounded-xl text-xs px-3 sm:px-4 py-1 h-8 ${selectedDay === dayId ? "bg-indigo-600 hover:bg-indigo-700 shadow-sm" : "bg-white text-gray-600 hover:bg-indigo-50"}`}
                            >
                                {dayName}
                            </Button>
                        );
                    })}
                    <div className="flex-1" />
                    {/* Zoom control */}
                    <div className="flex items-center gap-1 bg-white rounded-full px-2 py-1 border border-gray-200 shadow-sm">
                        <button
                            onClick={() => setZoom(Math.max(0.5, +(zoom - 0.25).toFixed(2)))}
                            className="w-5 h-5 rounded-full bg-gray-50 border border-gray-200 text-gray-600 text-xs flex items-center justify-center hover:bg-gray-100"
                            title="Zoom out"
                        >−</button>
                        <span className="text-[10px] font-mono text-gray-500 w-8 text-center">{Math.round(zoom * 100)}%</span>
                        <button
                            onClick={() => setZoom(Math.min(2.5, +(zoom + 0.25).toFixed(2)))}
                            className="w-5 h-5 rounded-full bg-gray-50 border border-gray-200 text-gray-600 text-xs flex items-center justify-center hover:bg-gray-100"
                            title="Zoom in"
                        >+</button>
                    </div>
                </div>
            )}

            <div
                ref={scrollContainerRef}
                className="overflow-x-auto overflow-y-auto overscroll-x-contain flex-1 min-h-[500px] min-w-0 max-w-full h-full w-full border border-gray-200 rounded-xl bg-white shadow-sm custom-scrollbar relative touch-pan-x touch-pan-y"
            >
                <table ref={tableRef} className="w-full text-sm text-left border-collapse min-w-[max-content]">
                    <thead>
                        <tr className="bg-slate-50 border-b border-gray-200">
                            <th className="p-1.5 font-semibold text-gray-600 border-r w-[80px] sticky top-0 left-0 bg-slate-50 z-40 shadow-[1px_1px_0_0_#e5e7eb] text-[10px]">
                                CLASS
                            </th>
                            {dayPeriods.map(period => {
                                const pStartMins = parseTimeStr(period.startTime);
                                const pEndMins = parseTimeStr(period.endTime);
                                let durationMinutes = pEndMins - pStartMins;
                                if (durationMinutes <= 0 || isNaN(durationMinutes)) durationMinutes = 40;

                                const cellWidth = Math.max(40, Math.round(durationMinutes * pxPerMin));

                                const todayDayOfWeek = currentTime.getDay() || 7;
                                const activeStr = format(currentTime, "HH:mm");
                                const isCurrentActivePeriod = selectedDay === todayDayOfWeek && activeStr >= period.startTime && activeStr < period.endTime;

                                // In-cell tracker: fraction within this period (seconds precision)
                                const inCellFraction = (() => {
                                    if (!isCurrentActivePeriod) return null;
                                    const pStartSecs = parseTimeStr(period.startTime) * 60;
                                    const pEndSecs = parseTimeStr(period.endTime) * 60;
                                    const nowSecs = currentTime.getHours() * 3600 + currentTime.getMinutes() * 60 + currentTime.getSeconds();
                                    return Math.min(Math.max((nowSecs - pStartSecs) / (pEndSecs - pStartSecs), 0), 1);
                                })();

                                return (
                                    <th
                                        key={period.id}
                                        ref={isCurrentActivePeriod ? activeColRef : null}
                                        className={`p-2 border-r text-center align-top relative group overflow-visible sticky top-0 z-30 shadow-[0_1px_0_0_#e5e7eb] ${isCurrentActivePeriod ? 'bg-amber-50' : 'bg-slate-50'}`}
                                        style={{ width: cellWidth, minWidth: cellWidth, maxWidth: cellWidth }}
                                    >
                                        {/* In-cell red timeline line — physically inside this column, cannot overshoot */}
                                        {inCellFraction !== null && (
                                            <div
                                                className="absolute top-0 z-30 pointer-events-none"
                                                style={{ left: `${inCellFraction * 100}%` }}
                                            >
                                                <div className="bg-red-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-b-md shadow-sm whitespace-nowrap -translate-x-1/2">
                                                    {activeStr}
                                                </div>
                                                <div
                                                    className="w-[2px] bg-red-400/80 shadow-[0_0_4px_rgba(239,68,68,0.5)] -translate-x-px"
                                                    style={{ height: tableHeight > 0 ? tableHeight : '100vh' }}
                                                />
                                            </div>
                                        )}
                                        {(() => {
                                            const showAmPm = cellWidth >= 55;
                                            const formatTime = (t: string) => {
                                                const formatted = formatDisplayTime(t, profile?.timeFormat);
                                                return showAmPm ? formatted : formatted.replace(/\s*[aApP]\.?[mM]\.?/g, "").trim();
                                            };
                                            const tStart = formatTime(period.startTime);
                                            const tEnd = formatTime(period.endTime);

                                            return isEditing ? (
                                                <Popover
                                                    open={editingPeriod?.id === period.id}
                                                    onOpenChange={(isOpen) => {
                                                        if (isOpen) {
                                                            setEditingPeriod({ id: period.id, newStartTime: period.startTime, newEndTime: period.endTime });
                                                        } else {
                                                            setEditingPeriod(null);
                                                        }
                                                    }}
                                                >
                                                    <PopoverTrigger asChild>
                                                        <div className="flex flex-col items-center cursor-pointer hover:bg-amber-50/50 p-1 rounded transition-colors group select-none">
                                                            <span className="text-[9px] sm:text-xs font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-sm mb-1 uppercase group-hover:bg-amber-100 group-hover:text-amber-700 transition-colors">
                                                                {period.type === 'lesson' ? `L${period.periodNumber}` : period.customLabel || period.type}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400 group-hover:text-amber-600 border-b border-transparent group-hover:border-amber-200 border-dashed whitespace-nowrap overflow-hidden max-w-full block text-center">
                                                                {tStart} - {tEnd}
                                                            </span>
                                                        </div>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-64 p-4 shadow-xl border border-gray-200" align="center">
                                                        <div className="space-y-4">
                                                            <h4 className="font-bold text-sm text-gray-800 border-b pb-2">Edit Block Times</h4>

                                                            <div className="grid gap-3">
                                                                <div className="grid grid-cols-3 items-center gap-2">
                                                                    <Label htmlFor="start" className="text-xs text-right">Start At</Label>
                                                                    <Input
                                                                        id="start"
                                                                        type="time"
                                                                        className="col-span-2 h-8 text-xs font-mono"
                                                                        value={editingPeriod?.newStartTime || period.startTime}
                                                                        onChange={e => setEditingPeriod(prev => prev ? { ...prev, newStartTime: e.target.value } : null)}
                                                                    />
                                                                </div>
                                                                <div className="grid grid-cols-3 items-center gap-2">
                                                                    <Label htmlFor="end" className="text-xs text-right">End At</Label>
                                                                    <Input
                                                                        id="end"
                                                                        type="time"
                                                                        className="col-span-2 h-8 text-xs font-mono"
                                                                        value={editingPeriod?.newEndTime || period.endTime}
                                                                        onChange={e => setEditingPeriod(prev => prev ? { ...prev, newEndTime: e.target.value } : null)}
                                                                    />
                                                                </div>
                                                            </div>

                                                            <div className="text-[10px] bg-amber-50 text-amber-700 p-2 rounded-md leading-tight border border-amber-200">
                                                                <strong>Note:</strong> Editing these times will automatically shift all subsequent periods forward or backward by the time difference to prevent overlaps.
                                                            </div>

                                                            <div className="flex justify-end gap-2 pt-2">
                                                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditingPeriod(null)}>Cancel</Button>
                                                                <Button size="sm" className="h-7 text-xs bg-blue-600" onClick={handleSavePeriodTimes} disabled={savePeriodsMutation.isPending}>
                                                                    {savePeriodsMutation.isPending ? "Saving..." : "Apply & Shift"}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            ) : (
                                                <div className="flex flex-col items-center p-0.5 min-w-0">
                                                    <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1 py-0.5 rounded-sm mb-0.5 uppercase leading-none">
                                                        {period.type === 'lesson' ? `L${period.periodNumber}` : period.customLabel || period.type}
                                                    </span>
                                                    <span className="text-[8px] text-gray-400 leading-none whitespace-nowrap overflow-hidden max-w-full block text-center select-none">{tStart}</span>
                                                    <span className="text-[8px] text-gray-400 leading-none whitespace-nowrap overflow-hidden max-w-full block text-center select-none">{tEnd}</span>
                                                </div>
                                            );
                                        })()}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {classesToRender.map((cls, clsIdx) => {
                            let skipCells = 0;
                            return (
                                <tr key={cls.id} className="border-b border-gray-100 hover:bg-slate-50/50 transition-colors">
                                    <td className="py-1 px-1.5 font-bold text-gray-800 border-r whitespace-nowrap sticky left-0 bg-white z-10 shadow-[1px_0_0_0_#f3f4f6] text-[10px] leading-tight max-w-[80px] truncate">
                                        {cls.code || cls.name}
                                    </td>
                                    {dayPeriods.map(period => {
                                        if (skipCells > 0) { skipCells--; return null; }

                                        // Grouped activity — only the first rendered class in the group renders the merged cell
                                        const sharedAct = sharedActivityMap.get(period.id);
                                        if (sharedAct) {
                                            const isInGroup = sharedAct.groupClassIds.includes(cls.id);
                                            if (!isInGroup) {
                                                // This class is not part of the group — render its own cell normally below
                                            } else {
                                                if (sharedAct.colSpan > 1) {
                                                    skipCells = sharedAct.colSpan - 1;
                                                }
                                                // Is this the first rendered class of the group?
                                                const firstGroupClassIdx = classesToRender.findIndex(c => sharedAct.groupClassIds.includes(c.id));
                                                if (clsIdx === firstGroupClassIdx) {
                                                    const actTeacher = staffList.find(s => s.id === sharedAct.teacherId);
                                                    const innerContent = (
                                                        <div
                                                            className={`flex flex-col items-center justify-center h-full gap-0.5 px-1 py-1 mx-0.5 my-0.5 rounded border transition-all ${isEditing ? 'cursor-pointer hover:bg-purple-200' : ''}`}
                                                            style={{ background: 'hsl(270,50%,87%)', borderColor: 'hsl(270,45%,75%)', color: 'hsl(270,60%,28%)' }}
                                                        >
                                                            <span className="text-[9px] font-black uppercase tracking-wide leading-tight text-center">{sharedAct.activityName}</span>
                                                            {actTeacher && <span className="text-[8px] opacity-70 leading-tight">{actTeacher.firstName[0]}. {actTeacher.lastName?.split(' ')[0]}</span>}
                                                            <span className="text-[7px] opacity-50 leading-none">All Classes</span>
                                                        </div>
                                                    );

                                                    const cellEntry = entries.find(e => e.classId === cls.id && e.periodId === period.id);

                                                    return (
                                                        <td
                                                            key={period.id}
                                                            rowSpan={sharedAct.rowSpan}
                                                            colSpan={sharedAct.colSpan || 1}
                                                            className="border-r align-middle text-center p-0 relative"
                                                            style={{ minWidth: Math.round((parseTimeStr(period.endTime) - parseTimeStr(period.startTime)) * pxPerMin) }}
                                                        >
                                                            {isEditing ? (
                                                                <Popover
                                                                    open={activeCell?.classId === cls.id && activeCell?.periodId === period.id}
                                                                    onOpenChange={(isOpen) => {
                                                                        if (isOpen) setActiveCell({ classId: cls.id, periodId: period.id });
                                                                        else setActiveCell(null);
                                                                    }}
                                                                >
                                                                    <PopoverTrigger asChild>
                                                                        {innerContent}
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-80 p-0 shadow-xl border border-gray-200" align="start">
                                                                        <AssignmentPopup
                                                                            classItem={cls}
                                                                            period={period}
                                                                            currentEntry={cellEntry}
                                                                            subjects={subjects}
                                                                            staffList={staffList}
                                                                            allClasses={classesToRender}
                                                                            onAssign={(subjectId, teacherId, span, optSubId, optTId) => handleAssignSubject(cls.id, period.id, subjectId, teacherId, span, optSubId, optTId)}
                                                                            onAssignActivity={(name, teacherId, linkedIds, span) => handleAssignActivity(cls.id, period.id, name, teacherId, linkedIds, span)}
                                                                            onClear={() => handleClearCell(cls.id, period.id)}
                                                                            onClose={() => setActiveCell(null)}
                                                                        />
                                                                    </PopoverContent>
                                                                </Popover>
                                                            ) : (
                                                                innerContent
                                                            )}
                                                        </td>
                                                    );
                                                }
                                                return null; // other group classes — covered by rowSpan
                                            }
                                        }

                                        const isBreak = period.type === 'break' || period.type === 'lunch';

                                        const todayDayOfWeek = currentTime.getDay() || 7;
                                        const activeStr = format(currentTime, "HH:mm");
                                        const isCurrentActivePeriod = selectedDay === todayDayOfWeek && activeStr >= period.startTime && activeStr < period.endTime;
                                        const isPastPeriod = selectedDay === todayDayOfWeek && activeStr >= period.endTime;
                                        const periodState: PeriodState = isCurrentActivePeriod ? 'active' : isPastPeriod ? 'past' : 'upcoming';

                                        // Shade breaks
                                        if (isBreak) {
                                            return (
                                                <td key={period.id} className={`p-0 border-r align-middle ${isCurrentActivePeriod ? 'bg-amber-100/60' : 'bg-gray-100/80'}`}>
                                                    <div className="flex items-center justify-center p-1 opacity-50">
                                                        <span className="text-[9px] font-bold tracking-widest text-gray-500 uppercase rotate-90 sm:rotate-0">{period.customLabel || period.type}</span>
                                                    </div>
                                                </td>
                                            );
                                        }

                                        // Find entry
                                        const entry = entries.find(e => e.classId === cls.id && e.periodId === period.id);
                                        const entrySubject = entry ? subjects.find(s => s.id === entry.subjectId) : null;
                                        const entryTeacher = entry ? staffList.find(s => s.id === entry.teacherId) : null;

                                        if (entry && entry.periodSpan && entry.periodSpan > 1) {
                                            skipCells = entry.periodSpan - 1;
                                        }

                                        // Check Collision visually for this cell
                                        const hasCollision = entry && entry.teacherId !== 'UNASSIGNED' && entries.some(e =>
                                            e.periodId === period.id &&
                                            e.teacherId === entry.teacherId &&
                                            e.classId !== cls.id
                                        );

                                        const cellStyle = entry && entry.entryType !== 'activity' && entrySubject && !entry.optionalSubjectId
                                            ? getSubjectCellStyle(entrySubject.name, periodState, !!hasCollision, isEditing)
                                            : {};

                                        // Optional subject rendering logic
                                        const optSubject = entry?.optionalSubjectId ? subjects.find(s => s.id === entry.optionalSubjectId) : null;
                                        const optTeacher = entry?.optionalTeacherId ? staffList.find(s => s.id === entry.optionalTeacherId) : null;
                                        const isSplit = !!(entry && entry.entryType !== 'activity' && optSubject);

                                        const primaryStyle = isSplit ? getSubjectCellStyle(entrySubject!.name, periodState, !!hasCollision, isEditing) : cellStyle;
                                        const secondaryStyle = isSplit ? getSubjectCellStyle(optSubject!.name, periodState, false, isEditing) : {};

                                        const cellContent = (
                                            <div
                                                style={!isSplit && entry && entry.entryType !== 'activity' ? cellStyle : {}}
                                                className={`absolute inset-0 m-px rounded border ${!isSplit ? 'p-1' : 'p-0 overflow-hidden border-transparent'} transition-all flex flex-col items-center justify-center text-center
                                                    ${isEditing ? 'cursor-pointer' : 'cursor-default'}
                                                    ${entry
                                                        ? (entry.entryType === 'activity'
                                                            ? `bg-purple-50/60 hover:bg-purple-100 border-purple-100 ${periodState === 'past' ? 'opacity-50' : ''}`
                                                            : (!isSplit ? 'border-transparent' : ''))
                                                        : (isEditing ? 'hover:bg-gray-50 hover:border-gray-300 border-dashed border-gray-200' : 'border-transparent')
                                                    }
                                                `}
                                            >
                                                {entry ? (
                                                    <>
                                                        {entry.entryType === 'activity' ? (
                                                            <>
                                                                <span className={`font-black text-[9px] uppercase tracking-wide leading-tight ${periodState === 'past' ? 'text-purple-400' : 'text-purple-700'}`}>
                                                                    {entry.activityName || 'ACT'}
                                                                </span>
                                                                <span className={`text-[8px] truncate max-w-full leading-tight ${periodState === 'past' ? 'text-purple-300' : 'text-purple-500'} `}>
                                                                    {entryTeacher ? `${entryTeacher.firstName[0]}${entryTeacher.lastName[0]} ` : ''}
                                                                </span>
                                                            </>
                                                        ) : isSplit ? (
                                                            // SPLIT CELL RENDERING
                                                            <div className="flex flex-col w-full h-full rounded border overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
                                                                {/* Top: Primary Subject */}
                                                                <div className="flex-1 flex flex-col items-center justify-center border-b border-white/40 min-h-0 py-0.5" style={primaryStyle}>
                                                                    <span className="font-bold text-[9px] leading-tight truncate px-1" style={{ color: 'inherit' }}>
                                                                        {entrySubject?.code || entrySubject?.name?.substring(0, 4) || '?'}
                                                                    </span>
                                                                    <span className="text-[7.5px] truncate max-w-full leading-tight opacity-75 px-1">
                                                                        {entryTeacher ? `${entryTeacher.firstName[0]}.${entryTeacher.lastName?.split(' ')[0]}` : ''}
                                                                    </span>
                                                                </div>
                                                                {/* Bottom: Optional Subject */}
                                                                <div className="flex-1 flex flex-col items-center justify-center min-h-0 py-0.5" style={secondaryStyle}>
                                                                    <span className="font-bold text-[9px] leading-tight truncate px-1" style={{ color: 'inherit' }}>
                                                                        {optSubject?.code || optSubject?.name?.substring(0, 4) || '?'}
                                                                    </span>
                                                                    <span className="text-[7.5px] truncate max-w-full leading-tight opacity-75 px-1">
                                                                        {optTeacher ? `${optTeacher.firstName[0]}.${optTeacher.lastName?.split(' ')[0]}` : ''}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            // NORMAL CELL RENDERING
                                                            <>
                                                                <span className="font-bold text-[10px] sm:text-[11px] md:text-xs leading-tight truncate px-0.5 w-full block" style={{ color: 'inherit' }}>
                                                                    {entrySubject?.code || entrySubject?.name?.substring(0, 4) || '?'}
                                                                </span>
                                                                <span className="text-[8px] sm:text-[9px] truncate max-w-full leading-tight opacity-75 mt-0.5">
                                                                    <span className="md:hidden">
                                                                        {entryTeacher ? `${entryTeacher.firstName[0]}. ${entryTeacher.lastName?.split(' ')[0]}` : ''}
                                                                    </span>
                                                                    <span className="hidden md:inline">
                                                                        {entryTeacher ? `${entryTeacher.firstName} ${entryTeacher.lastName}` : ''}
                                                                    </span>
                                                                </span>
                                                                {periodState === 'active' && (
                                                                    <span className="absolute bottom-0.5 left-0 right-0 flex justify-center">
                                                                        <span className="inline-block w-1 h-1 rounded-full bg-white opacity-80 animate-pulse" />
                                                                    </span>
                                                                )}
                                                                {hasCollision && isEditing && <AlertTriangle className="absolute top-0.5 right-0.5 w-2.5 h-2.5 text-red-500" />}
                                                            </>
                                                        )}
                                                    </>
                                                ) : (
                                                    isEditing && <Plus className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400 group-hover:scale-125 transition-transform" />
                                                )
                                                }
                                            </div >
                                        );

                                        return (
                                            <td key={period.id} colSpan={entry?.periodSpan || 1} className={`p-0 border-r relative group h-[42px] ${isCurrentActivePeriod ? 'bg-amber-50/40' : ''}`}>
                                                {isEditing ? (
                                                    <Popover
                                                        open={activeCell?.classId === cls.id && activeCell?.periodId === period.id}
                                                        onOpenChange={(isOpen) => {
                                                            if (isOpen) setActiveCell({ classId: cls.id, periodId: period.id });
                                                            else setActiveCell(null);
                                                        }}
                                                    >
                                                        <PopoverTrigger asChild>
                                                            {cellContent}
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-80 p-0 shadow-xl border border-gray-200" align="start">
                                                            <AssignmentPopup
                                                                classItem={cls}
                                                                period={period}
                                                                currentEntry={entry}
                                                                subjects={subjects}
                                                                staffList={staffList}
                                                                allClasses={classesToRender}
                                                                onAssign={(subjectId, teacherId, span, optSubId, optTId) => handleAssignSubject(cls.id, period.id, subjectId, teacherId, span, optSubId, optTId)}
                                                                onAssignActivity={(name, teacherId, linkedIds, span) => handleAssignActivity(cls.id, period.id, name, teacherId, linkedIds, span)}
                                                                onClear={() => handleClearCell(cls.id, period.id)}
                                                                onClose={() => setActiveCell(null)}
                                                            />
                                                        </PopoverContent>
                                                    </Popover>
                                                ) : (
                                                    cellContent
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr >
                            );
                        })}
                    </tbody >
                </table >
            </div >
        </div >
    );
}

// Sub-component for assignment popup
function AssignmentPopup({
    classItem, period, currentEntry, subjects, staffList, allClasses,
    onAssign, onAssignActivity, onClear, onClose
}: {
    classItem: Class; period: GeneratedPeriod; currentEntry?: TimetableEntry;
    subjects: Subject[]; staffList: Staff[]; allClasses: Class[];
    onAssign: (subId: string, tId: string, span: number, optSubId?: string, optTId?: string) => void;
    onAssignActivity: (name: string, teacherId: string, linkedClassIds: string[], span: number) => void;
    onClear: () => void;
    onClose: () => void;
}) {
    const assignments = classItem.subjectAssignments || [];
    const [isDouble, setIsDouble] = React.useState(currentEntry?.periodSpan === 2);
    const [tab, setTab] = React.useState<'subject' | 'activity'>(
        currentEntry?.entryType === 'activity' ? 'activity' : 'subject'
    );

    // Subject state
    const [primarySubId, setPrimarySubId] = React.useState<string | null>(currentEntry?.entryType !== 'activity' ? currentEntry?.subjectId || null : null);
    const [primaryTId, setPrimaryTId] = React.useState<string | null>(currentEntry?.entryType !== 'activity' ? currentEntry?.teacherId || null : null);

    const [hasOptional, setHasOptional] = React.useState<boolean>(!!currentEntry?.optionalSubjectId);
    const [optSubId, setOptSubId] = React.useState<string | null>(currentEntry?.optionalSubjectId || null);
    const [optTId, setOptTId] = React.useState<string | null>(currentEntry?.optionalTeacherId || null);

    // Co-curricular activity state
    const [activityName, setActivityName] = React.useState(currentEntry?.activityName || '');
    const [activityTeacherId, setActivityTeacherId] = React.useState(currentEntry?.teacherId || '');
    const [linkedClassIds, setLinkedClassIds] = React.useState<string[]>(currentEntry?.linkedClassIds || []);

    const toggleLinkedClass = (classId: string) => {
        setLinkedClassIds(prev =>
            prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]
        );
    };

    const otherClasses = allClasses.filter(c => c.id !== classItem.id);

    return (
        <div className="flex flex-col bg-slate-50">
            {/* Header */}
            <div className="p-3 border-b bg-white flex justify-between items-center bg-gradient-to-r from-blue-50/50 to-white">
                <div>
                    <h4 className="font-bold text-sm text-gray-800">{classItem.name}</h4>
                    <span className="text-xs text-gray-500 block font-mono">
                        {period.startTime} - {period.endTime}
                    </span>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                    Lesson {period.periodNumber}
                </Badge>
            </div>

            {/* Tab Switcher */}
            <div className="flex border-b bg-white">
                <button
                    onClick={() => setTab('subject')}
                    className={`flex-1 py-2 text-xs font-semibold transition-all border-b-2 ${tab === 'subject' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    📚 Subject
                </button>
                <button
                    onClick={() => setTab('activity')}
                    className={`flex-1 py-2 text-xs font-semibold transition-all border-b-2 ${tab === 'activity' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    🎯 Co-Curricular
                </button>
            </div>

            {/* Subject Tab */}
            {tab === 'subject' && (
                <div className="p-3 flex flex-col h-full space-y-3 relative">
                    {assignments.length === 0 ? (
                        <div className="text-center p-4 text-xs text-gray-500">
                            No subjects assigned to this class. Go to Class Management first.
                        </div>
                    ) : (
                        <>
                            {/* Primary Subject Selection */}
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-gray-600">Primary Subject</Label>
                                <div className="max-h-[140px] overflow-y-auto border border-gray-200 rounded-md p-1 custom-scrollbar space-y-1 bg-white">
                                    {assignments.map(assign => {
                                        const sub = subjects.find(s => s.id === assign.subjectId);
                                        if (!sub) return null;
                                        const teachIds = Array.isArray(assign.teacherIds) && assign.teacherIds.length > 0
                                            ? assign.teacherIds
                                            : assign.teacherId ? [assign.teacherId] : [];
                                        const teachersToRender = teachIds.map(id => staffList.find(s => s.id === id)).filter(Boolean) as Staff[];
                                        if (teachersToRender.length === 0) teachersToRender.push({ id: 'UNASSIGNED', firstName: 'Teacher', lastName: 'Not Assigned' } as Staff);

                                        return teachersToRender.map(teacher => {
                                            const isSelected = primarySubId === sub.id && primaryTId === teacher.id;
                                            return (
                                                <button
                                                    key={`pri-${sub.id}-${teacher.id}`}
                                                    onClick={() => { setPrimarySubId(sub.id); setPrimaryTId(teacher.id); }}
                                                    className={`w-full flex justify-between items-center text-left px-2 py-1.5 rounded border text-xs transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'hover:bg-blue-50 border-transparent text-gray-700'}`}
                                                >
                                                    <span className="font-bold truncate">{sub.name}</span>
                                                    <span className={`text-[10px] truncate max-w-[50%] text-right ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                                                        {teacher.firstName} {teacher.lastName}
                                                    </span>
                                                </button>
                                            );
                                        });
                                    })}
                                </div>
                            </div>

                            {/* Optional Subject Toggle */}
                            <div className="flex items-center gap-2 pt-1 border-t">
                                <input
                                    type="checkbox"
                                    id="optionalToggle"
                                    checked={hasOptional}
                                    onChange={(e) => {
                                        setHasOptional(e.target.checked);
                                        if (!e.target.checked) {
                                            setOptSubId(null);
                                            setOptTId(null);
                                        }
                                    }}
                                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <label htmlFor="optionalToggle" className="text-[11px] font-semibold text-gray-700 cursor-pointer">
                                    + Add Optional/Alternative Subject
                                </label>
                            </div>

                            {/* Optional Subject Selection */}
                            {hasOptional && (
                                <div className="space-y-1 animate-in slide-in-from-top-2 duration-200">
                                    <Label className="text-xs font-semibold text-blue-700">Optional Subject</Label>
                                    <div className="max-h-[120px] overflow-y-auto border border-blue-200 rounded-md p-1 custom-scrollbar space-y-1 bg-white">
                                        {assignments.map(assign => {
                                            const sub = subjects.find(s => s.id === assign.subjectId);
                                            if (!sub) return null;
                                            // Don't show the primary subject as an option for alternative
                                            if (sub.id === primarySubId) return null;

                                            const teachIds = Array.isArray(assign.teacherIds) && assign.teacherIds.length > 0 ? assign.teacherIds : assign.teacherId ? [assign.teacherId] : [];
                                            const teachersToRender = teachIds.map(id => staffList.find(s => s.id === id)).filter(Boolean) as Staff[];
                                            if (teachersToRender.length === 0) teachersToRender.push({ id: 'UNASSIGNED', firstName: 'Teacher', lastName: 'Not Assigned' } as Staff);

                                            return teachersToRender.map(teacher => {
                                                const isSelected = optSubId === sub.id && optTId === teacher.id;
                                                return (
                                                    <button
                                                        key={`opt-${sub.id}-${teacher.id}`}
                                                        onClick={() => { setOptSubId(sub.id); setOptTId(teacher.id); }}
                                                        className={`w-full flex justify-between items-center text-left px-2 py-1.5 rounded border text-[11px] transition-all ${isSelected ? 'bg-blue-100 border-blue-300 text-blue-800 font-bold' : 'hover:bg-slate-50 border-transparent text-gray-700'}`}
                                                    >
                                                        <span className="truncate">{sub.name}</span>
                                                        <span className="truncate max-w-[50%] text-right opacity-70">
                                                            {teacher.firstName} {teacher.lastName}
                                                        </span>
                                                    </button>
                                                );
                                            });
                                        })}
                                    </div>
                                </div>
                            )}

                            <button
                                disabled={!primarySubId || !primaryTId || (hasOptional && (!optSubId || !optTId))}
                                onClick={() => onAssign(primarySubId!, primaryTId!, isDouble ? 2 : 1, hasOptional ? optSubId! : undefined, hasOptional ? optTId! : undefined)}
                                className="w-full mt-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold py-2 rounded-lg transition-all"
                            >
                                Save Subject
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Co-Curricular Tab */}
            {tab === 'activity' && (
                <div className="p-3 space-y-3">
                    {/* Activity Name */}
                    <div>
                        <Label className="text-xs font-semibold text-gray-600 mb-1 block">Activity Name</Label>
                        <Input
                            placeholder="e.g. Assembly, Prayers, Sports, G.C.A.S"
                            value={activityName}
                            onChange={e => setActivityName(e.target.value)}
                            className="h-8 text-xs"
                        />
                    </div>

                    {/* Supervisor */}
                    <div>
                        <Label className="text-xs font-semibold text-gray-600 mb-1 block">Supervisor / In-charge</Label>
                        <select
                            value={activityTeacherId}
                            onChange={e => setActivityTeacherId(e.target.value)}
                            className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white"
                        >
                            <option value="">— Optional —</option>
                            {staffList.map(s => (
                                <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                            ))}
                        </select>
                    </div>

                    {/* Group Activity — Link other classes */}
                    {otherClasses.length > 0 && (
                        <div>
                            <Label className="text-xs font-semibold text-gray-600 mb-1 block">
                                Group Activity — share with:
                            </Label>
                            <div className="max-h-[120px] overflow-y-auto border border-gray-200 rounded-md bg-white p-2 custom-scrollbar space-y-1.5">
                                {otherClasses.map(cls => (
                                    <label key={cls.id} className="flex items-center gap-2 cursor-pointer hover:text-purple-700">
                                        <input
                                            type="checkbox"
                                            checked={linkedClassIds.includes(cls.id)}
                                            onChange={() => toggleLinkedClass(cls.id)}
                                            className="w-3.5 h-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                        />
                                        <span className="text-xs font-medium">{cls.name}</span>
                                    </label>
                                ))}
                            </div>
                            {linkedClassIds.length > 0 && (
                                <p className="text-[10px] text-purple-600 mt-1">
                                    Activity will be shared with {linkedClassIds.length} other class{linkedClassIds.length !== 1 ? 'es' : ''}.
                                </p>
                            )}
                        </div>
                    )}

                    <button
                        disabled={!activityName.trim()}
                        onClick={() => onAssignActivity(activityName.trim(), activityTeacherId, linkedClassIds, isDouble ? 2 : 1)}
                        className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-xs font-bold py-2 rounded-lg transition-all"
                    >
                        Save Activity
                    </button>
                </div>
            )}

            {/* Double period toggle (both tabs) */}
            <div className="px-3 py-2 border-t bg-amber-50/50 flex items-center gap-2">
                <input
                    type="checkbox"
                    id="doublePeriodToggle"
                    checked={isDouble}
                    onChange={(e) => setIsDouble(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="doublePeriodToggle" className="text-xs font-semibold text-gray-700 cursor-pointer">
                    Make Double Period <span className="text-gray-400 font-normal">(Spans 2 columns)</span>
                </label>
            </div>

            {/* Footer */}
            <div className="p-2 border-t bg-white flex justify-between gap-2">
                {currentEntry ? (
                    <Button variant="destructive" size="sm" className="w-full text-xs h-8" onClick={onClear}>
                        Clear
                    </Button>
                ) : (
                    <Button variant="outline" size="sm" className="w-full text-xs h-8" onClick={onClose}>
                        Cancel
                    </Button>
                )}
            </div>
        </div>
    );
}
