"use client";

import * as React from "react";
import { format, parse, addMinutes } from "date-fns";
import { useCreateTimetable, useUpdateTimetable, useCloneTimetable, useTimetableProfiles } from "@/lib/hooks/use-timetable";
import { useClasses } from "@/lib/hooks/use-classes";
import { useAcademicYears } from "@/lib/hooks/use-academic-years";
import { useToast } from "@/hooks/use-toast";
import {
    ModernDialog,
    ModernDialogContent,
    ModernDialogHeader,
    ModernDialogTitle,
} from "@/components/ui/modern-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, CalendarRange, Clock, Trash2, Plus, Download, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PeriodType, GeneratedPeriod } from "@/types";

function formatDisplayTime(timeStr: string, _fmt?: '12h' | '24h'): string {
    if (!timeStr) return '';
    try {
        const [h, m] = timeStr.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hour12 = h % 12 || 12;
        return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
    } catch { return timeStr; }
}

type TimeBlock = {
    id: string;
    type: 'lessons' | 'break';
    count?: number;           // number of lessons in this block
    duration?: number;        // break duration (breaks only)
    label: string;
    blockDuration?: number;   // override global lesson duration for this whole block
    individualDurations?: number[]; // per-lesson duration overrides (length must === count)
    expanded?: boolean;       // UI state: show per-lesson inputs
};

interface StructureGeneratorProps {
    isOpen: boolean;
    onClose: () => void;
    /** Default yearId (active year). User can override inside the dialog. */
    yearId: string;
    /** Default termId (current term). User can override inside the dialog. */
    termId: string;
    /** If provided, the dialog acts in "re-configure" mode for an existing profile */
    editingProfile?: import('@/types').TimetableProfile;
}

// ─── Fetch Template Panel ─────────────────────────────────────────────────────
function FetchTemplatePanel({
    currentYearId, currentTermId,
    onLoadEmpty, onLoadPopulated,
    allYears,
}: {
    currentYearId: string; currentTermId: string;
    onLoadEmpty: (srcYearId: string, srcTermId: string, srcTimetableId: string, name: string) => void;
    onLoadPopulated: (srcYearId: string, srcTermId: string, srcTimetableId: string, name: string) => void;
    allYears: import('@/types').AcademicYear[];
}) {
    const [selYearId, setSelYearId] = React.useState('');
    const [selTermId, setSelTermId] = React.useState('');
    const [selTimetableId, setSelTimetableId] = React.useState('');

    const selYear = allYears.find(y => y.id === selYearId);
    const terms = selYear?.terms || [];
    const selTerm = terms.find(t => t.id === selTermId);

    // Fetch timetables from selected past term
    const { data: srcProfiles = [], isLoading: loadingProfiles } = useTimetableProfiles(
        selYearId || '__none__',
        selTermId || '__none__'
    );

    // Filter out the current term to show only PAST/OTHER terms
    const pastTermOptions: { yearId: string; termId: string; yearName: string; termName: string }[] = [];
    allYears.forEach(year => {
        year.terms?.forEach(term => {
            if (year.id === currentYearId && term.id === currentTermId) return; // skip current
            pastTermOptions.push({ yearId: year.id, termId: term.id, yearName: year.name, termName: term.name });
        });
    });

    const selectedProfile = srcProfiles.find(p => p.id === selTimetableId);

    return (
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-3">
            <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wide flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> Fetch Template from Past Term
            </h4>

            {pastTermOptions.length === 0 ? (
                <p className="text-xs text-gray-500 italic">No other terms found.</p>
            ) : (
                <>
                    {/* Term selector */}
                    <select
                        className="w-full border border-blue-200 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                        value={`${selYearId}|${selTermId}`}
                        onChange={e => {
                            const [y, t] = e.target.value.split('|');
                            setSelYearId(y || ''); setSelTermId(t || '');
                            setSelTimetableId('');
                        }}
                    >
                        <option value="|">— Select Year & Term —</option>
                        {pastTermOptions.map(opt => (
                            <option key={`${opt.yearId}|${opt.termId}`} value={`${opt.yearId}|${opt.termId}`}>
                                {opt.yearName} — {opt.termName}
                            </option>
                        ))}
                    </select>

                    {/* Timetable selector */}
                    {selYearId && selTermId && (
                        loadingProfiles ? (
                            <div className="flex items-center gap-2 text-xs text-blue-500">
                                <Loader2 className="w-3 h-3 animate-spin" /> Loading timetables…
                            </div>
                        ) : srcProfiles.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">No timetables in this term.</p>
                        ) : (
                            <select
                                className="w-full border border-blue-200 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                                value={selTimetableId}
                                onChange={e => setSelTimetableId(e.target.value)}
                            >
                                <option value="">— Select Timetable —</option>
                                {srcProfiles.map(p => (
                                    <option key={p.id} value={p.id}>{p.name || 'Timetable'}</option>
                                ))}
                            </select>
                        )
                    )}

                    {/* Import buttons */}
                    {selTimetableId && selectedProfile && (
                        <div className="space-y-2">
                            <p className="text-[11px] text-blue-600 font-medium">
                                Choose how to import "{selectedProfile.name}":
                            </p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => onLoadEmpty(selYearId, selTermId, selTimetableId, selectedProfile.name)}
                                    className="flex-1 bg-white border border-blue-300 text-blue-700 text-xs font-semibold py-2 rounded-lg hover:bg-blue-50 transition-all"
                                >
                                    📋 Empty Grid
                                    <span className="block text-[10px] font-normal text-gray-500">Structure only, no lessons</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onLoadPopulated(selYearId, selTermId, selTimetableId, selectedProfile.name)}
                                    className="flex-1 bg-blue-600 border border-blue-600 text-white text-xs font-semibold py-2 rounded-lg hover:bg-blue-700 transition-all"
                                >
                                    ✅ Populated
                                    <span className="block text-[10px] font-normal text-blue-200">Copy all lesson assignments</span>
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function StructureGenerator({ isOpen, onClose, yearId: defaultYearId, termId: defaultTermId, editingProfile }: StructureGeneratorProps) {
    const { toast } = useToast();
    const createMutation = useCreateTimetable();
    const updateMutation = useUpdateTimetable();
    const cloneMutation = useCloneTimetable();

    const { data: allYears = [] } = useAcademicYears();
    const { data: classes = [] } = useClasses();
    const isEditing = !!editingProfile;

    // Target year/term — editable by user, defaults to current
    const [targetYearId, setTargetYearId] = React.useState(editingProfile?.academicYearId || defaultYearId);
    const [targetTermId, setTargetTermId] = React.useState(editingProfile?.termId || defaultTermId);

    // Sync target year/term when prop defaults change or dialog opens
    React.useEffect(() => {
        if (!isEditing && isOpen) {
            setTargetYearId(defaultYearId);
            setTargetTermId(defaultTermId);
        }
    }, [defaultYearId, defaultTermId, isEditing, isOpen]);

    const targetYear = allYears.find(y => y.id === targetYearId);
    const targetTerms = targetYear?.terms || [];

    // Form state
    const defaultBlocks: TimeBlock[] = [
        { id: "1", type: "lessons", count: 2, label: "Lessons" },
        { id: "2", type: "break", duration: 30, label: "BREAK" },
        { id: "3", type: "lessons", count: 2, label: "Lessons" },
        { id: "4", type: "break", duration: 60, label: "LUNCH" },
        { id: "5", type: "lessons", count: 3, label: "Lessons" },
    ];

    const [name, setName] = React.useState(editingProfile?.name || "Main Timetable");
    const [selectedClasses, setSelectedClasses] = React.useState<string[]>(editingProfile?.classIds || []);
    const [firstLessonStart, setFirstLessonStart] = React.useState(editingProfile?.firstLessonStart || "06:30");
    const [timeFormat] = React.useState<'12h'>('12h'); // Force 12h system only
    const [lessonDuration, setLessonDuration] = React.useState(editingProfile?.lessonDuration || 60);
    const [timeBlocks, setTimeBlocks] = React.useState<TimeBlock[]>(
        editingProfile?.timeBlocks
            ? editingProfile.timeBlocks.map((b, i) => ({
                id: String(i + 1), type: b.type,
                count: b.count, duration: b.duration,
                label: b.label || (b.type === 'lessons' ? 'Lessons' : 'BREAK'),
            }))
            : defaultBlocks
    );

    const ALL_DAYS = [
        { num: 1, short: 'Mon', long: 'Monday' },
        { num: 2, short: 'Tue', long: 'Tuesday' },
        { num: 3, short: 'Wed', long: 'Wednesday' },
        { num: 4, short: 'Thu', long: 'Thursday' },
        { num: 5, short: 'Fri', long: 'Friday' },
        { num: 6, short: 'Sat', long: 'Saturday' },
        { num: 7, short: 'Sun', long: 'Sunday' },
    ];
    const [activeDays, setActiveDays] = React.useState<number[]>(
        editingProfile?.activeDays && editingProfile.activeDays.length > 0
            ? editingProfile.activeDays
            : [1, 2, 3, 4, 5]
    );
    const toggleDay = (dayNum: number) => {
        setActiveDays(prev =>
            prev.includes(dayNum)
                ? prev.filter(d => d !== dayNum).sort()
                : [...prev, dayNum].sort()
        );
    };

    const [showFetchPanel, setShowFetchPanel] = React.useState(false);
    const [cloningArgs, setCloningArgs] = React.useState<{ srcYearId: string; srcTermId: string; srcTimetableId: string; includeEntries: boolean } | null>(null);

    // When dialog opens in edit mode, reset ALL form fields from the profile being edited
    React.useEffect(() => {
        if (isOpen && isEditing && editingProfile) {
            setName(editingProfile.name || "Main Timetable");
            setSelectedClasses(editingProfile.classIds || []);
            setFirstLessonStart(editingProfile.firstLessonStart || "06:30");
            // timeFormat is forced to 12h
            setLessonDuration(editingProfile.lessonDuration || 60);
            setTimeBlocks(
                editingProfile.timeBlocks && editingProfile.timeBlocks.length > 0
                    ? editingProfile.timeBlocks.map((b, i) => ({
                        id: String(i + 1), type: b.type,
                        count: b.count, duration: b.duration,
                        label: b.label || (b.type === 'lessons' ? 'Lessons' : 'BREAK'),
                    }))
                    : defaultBlocks
            );
            setActiveDays(
                editingProfile.activeDays && editingProfile.activeDays.length > 0
                    ? editingProfile.activeDays
                    : [1, 2, 3, 4, 5]
            );
            setTargetYearId(editingProfile.academicYearId);
            setTargetTermId(editingProfile.termId);
        } else if (isOpen && !isEditing) {
            // Reset to defaults for new timetable
            setName("Main Timetable");
            setSelectedClasses([]);
            setFirstLessonStart("06:30");
            // setTimeFormat removed
            setLessonDuration(60);
            setTimeBlocks(defaultBlocks);
            setActiveDays([1, 2, 3, 4, 5]);
            setShowFetchPanel(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, editingProfile?.id]);

    // Period preview
    const [periodPreview, setPeriodPreview] = React.useState<GeneratedPeriod[]>([]);

    const addBlock = (type: 'lessons' | 'break') => {
        const newId = Math.random().toString(36).substring(7);
        if (type === 'lessons') {
            setTimeBlocks([...timeBlocks, { id: newId, type: 'lessons', count: 1, label: 'Lessons' }]);
        } else {
            setTimeBlocks([...timeBlocks, { id: newId, type: 'break', duration: 30, label: 'BREAK' }]);
        }
    };

    const removeBlock = (id: string) => setTimeBlocks(timeBlocks.filter(b => b.id !== id));
    const updateBlock = (id: string, updates: Partial<TimeBlock>) =>
        setTimeBlocks(timeBlocks.map(b => b.id === id ? { ...b, ...updates } : b));

    React.useEffect(() => {
        try {
            if (!firstLessonStart) return;
            const computedPeriods: GeneratedPeriod[] = [];
            const parsedStart = parse(firstLessonStart, "HH:mm", new Date());
            let currentTime = parsedStart;
            let periodCounter = 1;
            const pushBlock = (duration: number, type: PeriodType, label?: string) => {
                const startTimeStr = format(currentTime, "HH:mm");
                currentTime = addMinutes(currentTime, duration);
                const endTimeStr = format(currentTime, "HH:mm");
                computedPeriods.push({
                    id: `preview-${computedPeriods.length}`,
                    dayOfWeek: 1,
                    periodNumber: type === 'lesson' ? periodCounter++ : 0,
                    startTime: startTimeStr,
                    endTime: endTimeStr,
                    type,
                    customLabel: label,
                });
            };
            timeBlocks.forEach(block => {
                if (block.type === 'lessons') {
                    for (let i = 0; i < (block.count || 0); i++) pushBlock(lessonDuration, 'lesson');
                } else if (block.type === 'break' && block.duration && block.duration > 0) {
                    pushBlock(block.duration, (block.label?.toLowerCase().includes('lunch') ? 'lunch' : 'break'), block.label);
                }
            });
            setPeriodPreview(computedPeriods);
        } catch (e) { /* ignore bad time */ }
    }, [firstLessonStart, lessonDuration, timeBlocks]);

    // Handle clone submission when cloningArgs is set
    React.useEffect(() => {
        if (!cloningArgs) return;
        const run = async () => {
            try {
                await cloneMutation.mutateAsync({
                    ...cloningArgs,
                    dstYearId: targetYearId,
                    dstTermId: targetTermId,
                    overrideName: name,
                });
                toast({
                    title: cloningArgs.includeEntries ? "Populated Clone Created" : "Empty Clone Created",
                    description: `"${name}" was created ${cloningArgs.includeEntries ? 'with all lesson data' : 'with an empty grid'}.`,
                });
                onClose();
            } catch (e) {
                toast({ variant: "destructive", title: "Clone Failed", description: "Could not copy the timetable." });
            } finally {
                setCloningArgs(null);
            }
        };
        run();
    }, [cloningArgs]);

    const generateAllPeriods = (): Omit<GeneratedPeriod, 'id'>[] => {
        const result: Omit<GeneratedPeriod, 'id'>[] = [];
        activeDays.forEach(dayIndex => {
            const parsedStart = parse(firstLessonStart, "HH:mm", new Date());
            let currentTime = parsedStart;
            let periodCounter = 1;
            const pushBlock = (duration: number, type: PeriodType, label?: string) => {
                const startTimeStr = format(currentTime, "HH:mm");
                currentTime = addMinutes(currentTime, duration);
                const endTimeStr = format(currentTime, "HH:mm");
                result.push({
                    dayOfWeek: dayIndex, periodNumber: type === 'lesson' ? periodCounter++ : 0,
                    startTime: startTimeStr, endTime: endTimeStr, type, customLabel: label,
                });
            };
            timeBlocks.forEach(block => {
                if (block.type === 'lessons') {
                    const count = block.count || 0;
                    for (let i = 0; i < count; i++) {
                        // Priority: per-lesson > block override > global
                        const dur =
                            (block.individualDurations && block.individualDurations[i] != null && block.individualDurations[i] > 0)
                                ? block.individualDurations[i]
                                : (block.blockDuration && block.blockDuration > 0)
                                    ? block.blockDuration
                                    : lessonDuration;
                        pushBlock(dur, 'lesson');
                    }
                } else if (block.type === 'break' && block.duration && block.duration > 0) {
                    pushBlock(block.duration, (block.label?.toLowerCase().includes('lunch') ? 'lunch' : 'break'), block.label);
                }
            });
        });
        return result;
    };

    const handleGenerate = async () => {
        if (!name.trim()) return toast({ variant: "destructive", title: "Validation Error", description: "Please name this timetable." });
        if (selectedClasses.length === 0) return toast({ variant: "destructive", title: "Validation Error", description: "Please select at least one class." });
        if (!targetYearId || !targetTermId) return toast({ variant: "destructive", title: "Validation Error", description: "Please select an academic year and term." });
        if (activeDays.length === 0) return toast({ variant: "destructive", title: "Validation Error", description: "Please select at least one school day." });

        try {
            const allGeneratedPeriods = generateAllPeriods();
            const profileData = {
                name, classIds: selectedClasses,
                academicYearId: targetYearId, termId: targetTermId,
                firstLessonStart, lessonDuration, timeFormat, timeBlocks, activeDays,
            };

            if (isEditing && editingProfile) {
                await updateMutation.mutateAsync({
                    yearId: targetYearId, termId: targetTermId,
                    timetableId: editingProfile.id,
                    profileData, generatedPeriods: allGeneratedPeriods,
                });
                toast({ title: "Updated", description: `"${name}" has been reconfigured.` });
            } else {
                await createMutation.mutateAsync({ profileData, generatedPeriods: allGeneratedPeriods });
                toast({ title: "Success", description: "Timetable structure saved!" });
            }
            onClose();
        } catch (e) {
            toast({ variant: "destructive", title: "Error", description: "Could not save structure." });
        }
    };

    const isPending = createMutation.isPending || updateMutation.isPending || cloneMutation.isPending;

    return (
        <ModernDialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
            <ModernDialogContent size="lg" className="w-[95vw] max-w-4xl max-h-[90vh] overflow-hidden relative">
                <ModernDialogHeader className="p-4 border-b">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-sm">
                            <CalendarRange className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <ModernDialogTitle className="text-lg font-bold">
                                {isEditing ? `Reconfigure: ${editingProfile?.name}` : 'Configure Timetable Structure'}
                            </ModernDialogTitle>
                            <p className="text-sm text-gray-500">
                                {isEditing
                                    ? 'Change lesson lengths, breaks, or classes. Existing assignments are preserved.'
                                    : 'Define the structure for a new timetable — or fetch one from a past term.'}
                            </p>
                        </div>
                    </div>
                </ModernDialogHeader>

                <div className="flex flex-col md:flex-row h-[calc(100vh-200px)] md:h-[600px]">
                    {/* Settings Column */}
                    <ScrollArea className="w-full md:w-1/2 p-6 border-r flex flex-col gap-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-xs font-semibold">Timetable Name</Label>
                                <Input
                                    className="mt-1.5 h-9"
                                    placeholder="e.g. Upper Primary"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <Label className="text-xs font-semibold flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> First Lesson Starts
                                    </Label>
                                    <Input
                                        type="time"
                                        className="mt-1.5 h-9 font-mono w-full"
                                        value={firstLessonStart}
                                        onChange={e => setFirstLessonStart(e.target.value)}
                                    />
                                </div>
                                <div className="w-24 hidden">
                                    {/* 12h/24h toggle removed - explicitly forced to 12h */}
                                </div>
                            </div>
                        </div>

                        {/* Year / Term Selector */}
                        {!isEditing && (
                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <div>
                                    <Label className="text-xs font-semibold">Academic Year</Label>
                                    <select
                                        value={targetYearId}
                                        onChange={e => { setTargetYearId(e.target.value); setTargetTermId(''); }}
                                        className="mt-1.5 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                                    >
                                        <option value="">— Select Year —</option>
                                        {allYears.map(y => (
                                            <option key={y.id} value={y.id}>
                                                {y.name}{y.isActive ? ' (Current)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <Label className="text-xs font-semibold">Term</Label>
                                    <select
                                        value={targetTermId}
                                        onChange={e => setTargetTermId(e.target.value)}
                                        className="mt-1.5 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                                        disabled={!targetYearId}
                                    >
                                        <option value="">— Select Term —</option>
                                        {targetTerms.map(t => (
                                            <option key={t.id} value={t.id}>
                                                {t.name}{t.isCurrent ? ' (Current)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Lesson Duration */}
                        <div className="mt-4">
                            <Label className="text-xs font-semibold">Default Lesson Duration (minutes)</Label>
                            <Input
                                type="number"
                                className="mt-1.5 h-9 w-36"
                                min={15} max={180}
                                value={lessonDuration}
                                onChange={e => setLessonDuration(Number(e.target.value))}
                            />
                        </div>

                        {/* Classes */}
                        <div className="mt-4">
                            <Label className="text-xs font-semibold mb-2 block">Classes in this Timetable</Label>
                            <div className="border border-gray-200 rounded-xl p-3 bg-white max-h-40 overflow-y-auto custom-scrollbar grid grid-cols-2 gap-2">
                                {classes.map(cls => (
                                    <label key={cls.id} className="flex items-center gap-2 cursor-pointer hover:text-blue-600 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={selectedClasses.includes(cls.id)}
                                            onChange={() => setSelectedClasses(prev =>
                                                prev.includes(cls.id) ? prev.filter(id => id !== cls.id) : [...prev, cls.id]
                                            )}
                                            className="rounded border-gray-300 text-blue-600"
                                        />
                                        {cls.name}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* School Days */}
                        <div className="mt-4">
                            <Label className="text-xs font-semibold mb-2 block">School Days</Label>
                            <div className="flex gap-1.5 flex-wrap">
                                {ALL_DAYS.map(day => {
                                    const active = activeDays.includes(day.num);
                                    return (
                                        <button
                                            key={day.num}
                                            type="button"
                                            onClick={() => toggleDay(day.num)}
                                            title={day.long}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border
                                                ${active
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                                    : 'bg-white text-gray-400 border-gray-200 hover:border-blue-300 hover:text-blue-500'
                                                }
                                                ${day.num === 7 ? 'opacity-60' : ''}
                                            `}
                                        >
                                            {day.short}
                                        </button>
                                    );
                                })}
                            </div>
                            {activeDays.length === 0 && (
                                <p className="text-[11px] text-red-500 mt-1">Select at least one day.</p>
                            )}
                            <p className="text-[10px] text-gray-400 mt-1">
                                {activeDays.length} day{activeDays.length !== 1 ? 's' : ''} selected
                            </p>
                        </div>

                        {/* Time Blocks */}

                        <div className="mt-4">
                            <Label className="text-xs font-semibold mb-2 block">Daily Schedule Blocks</Label>
                            <div className="space-y-2">
                                {timeBlocks.map((block) => (
                                    <div key={block.id} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                                        {/* Block header row */}
                                        <div className="flex items-center gap-2 p-2">
                                            <div className={`w-2 h-6 rounded-full flex-shrink-0 ${block.type === 'lessons' ? 'bg-blue-500' : 'bg-amber-400'}`} />
                                            {block.type === 'lessons' ? (
                                                <>
                                                    <span className="text-xs text-gray-500 w-[3rem] font-medium">Lessons</span>
                                                    {/* Count */}
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[10px] text-gray-400">×</span>
                                                        <Input
                                                            type="number" min={1} max={20}
                                                            value={block.count || 1}
                                                            onChange={e => {
                                                                const newCount = Number(e.target.value);
                                                                const newDurations = Array.from({ length: newCount }, (_, i) =>
                                                                    block.individualDurations?.[i] ?? (block.blockDuration || lessonDuration)
                                                                );
                                                                updateBlock(block.id, { count: newCount, individualDurations: newDurations });
                                                            }}
                                                            className="h-7 w-16 text-xs text-center"
                                                        />
                                                    </div>
                                                    {/* Block-level duration override */}
                                                    <div className="flex items-center gap-1">
                                                        <Input
                                                            type="number" min={5} max={300}
                                                            value={block.blockDuration ?? lessonDuration}
                                                            onChange={e => {
                                                                const d = Number(e.target.value);
                                                                updateBlock(block.id, {
                                                                    blockDuration: d,
                                                                    individualDurations: Array(block.count || 1).fill(d),
                                                                });
                                                            }}
                                                            className="h-7 w-16 text-xs text-center"
                                                        />
                                                        <span className="text-[10px] text-gray-400">min</span>
                                                    </div>
                                                    {/* Expand toggle */}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            updateBlock(block.id, {
                                                                expanded: !block.expanded,
                                                                individualDurations: !block.expanded
                                                                    ? Array.from({ length: block.count || 1 }, (_, i) =>
                                                                        block.individualDurations?.[i] ?? (block.blockDuration || lessonDuration)
                                                                    )
                                                                    : block.individualDurations,
                                                            });
                                                        }}
                                                        className="ml-auto text-[11px] text-blue-500 hover:text-blue-700 border border-blue-200 rounded-md px-2 py-1 hover:bg-blue-50 transition"
                                                    >
                                                        {block.expanded ? '▲' : '▼'}
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <Input
                                                        value={block.label}
                                                        onChange={e => updateBlock(block.id, { label: e.target.value })}
                                                        className="h-7 text-xs w-24"
                                                        placeholder="Break label"
                                                    />
                                                    <Input
                                                        type="number" min={5} max={180}
                                                        value={block.duration || 30}
                                                        onChange={e => updateBlock(block.id, { duration: Number(e.target.value) })}
                                                        className="h-7 w-16 text-xs text-center"
                                                    />
                                                    <span className="text-xs text-gray-400 flex-1">min</span>
                                                </>
                                            )}
                                            <button onClick={() => removeBlock(block.id)} className="text-gray-300 hover:text-red-400 transition flex-shrink-0">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        {/* Per-lesson expanded rows */}
                                        {block.type === 'lessons' && block.expanded && (
                                            <div className="border-t border-blue-100 bg-blue-50/50 px-3 py-2 space-y-1.5">
                                                <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide mb-1">Individual Lesson Durations</p>
                                                {Array.from({ length: block.count || 1 }, (_, i) => (
                                                    <div key={i} className="flex items-center gap-2">
                                                        <span className="text-[11px] text-blue-500 w-16">Lesson {i + 1}</span>
                                                        <Input
                                                            type="number" min={5} max={300}
                                                            value={block.individualDurations?.[i] ?? (block.blockDuration || lessonDuration)}
                                                            onChange={e => {
                                                                const newDurs = [...(block.individualDurations || Array(block.count || 1).fill(block.blockDuration || lessonDuration))];
                                                                newDurs[i] = Number(e.target.value);
                                                                updateBlock(block.id, { individualDurations: newDurs });
                                                            }}
                                                            className="h-6 w-16 text-xs text-center"
                                                        />
                                                        <span className="text-[10px] text-gray-400">min</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2 mt-2">
                                <button onClick={() => addBlock('lessons')} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition">
                                    <Plus className="w-3.5 h-3.5" /> Add Lessons
                                </button>
                                <button onClick={() => addBlock('break')} className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 border border-amber-200 rounded-lg px-3 py-1.5 hover:bg-amber-50 transition">
                                    <Plus className="w-3.5 h-3.5" /> Add Break
                                </button>
                            </div>
                        </div>

                        {/* Fetch Template Panel — only for new timetables */}
                        {!isEditing && (
                            <div className="mt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowFetchPanel(p => !p)}
                                    className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold hover:underline"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    {showFetchPanel ? 'Hide' : 'Fetch Template from Past Term'}
                                </button>
                                {showFetchPanel && (
                                    <div className="mt-2">
                                        <FetchTemplatePanel
                                            currentYearId={defaultYearId}
                                            currentTermId={defaultTermId}
                                            allYears={allYears}
                                            onLoadEmpty={(srcY, srcT, srcId, srcName) => {
                                                setName(srcName + ' (Copy)');
                                                setShowFetchPanel(false);
                                                // Trigger direct clone without needing Save
                                                if (!name.trim()) { toast({ variant: "destructive", title: "Set a name first" }); return; }
                                                if (!targetYearId || !targetTermId) { toast({ variant: "destructive", title: "Select year & term first" }); return; }
                                                const finalName = (srcName + ' (Copy)').trim();
                                                setName(finalName);
                                                setCloningArgs({ srcYearId: srcY, srcTermId: srcT, srcTimetableId: srcId, includeEntries: false });
                                            }}
                                            onLoadPopulated={(srcY, srcT, srcId, srcName) => {
                                                setName(srcName + ' (Copy)');
                                                setShowFetchPanel(false);
                                                if (!targetYearId || !targetTermId) { toast({ variant: "destructive", title: "Select year & term first" }); return; }
                                                const finalName = (srcName + ' (Copy)').trim();
                                                setName(finalName);
                                                setCloningArgs({ srcYearId: srcY, srcTermId: srcT, srcTimetableId: srcId, includeEntries: true });
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </ScrollArea>

                    {/* Preview Column */}
                    <div className="w-full md:w-1/2 p-6 flex flex-col">
                        <h3 className="text-sm font-bold text-gray-700 mb-3">Preview (Monday)</h3>
                        <ScrollArea className="flex-1">
                            <div className="space-y-1.5">
                                {periodPreview.map((period, i) => {
                                    const isBreak = period.type !== 'lesson';
                                    return (
                                        <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${isBreak ? 'bg-amber-50 border border-amber-100' : 'bg-blue-50 border border-blue-100'}`}>
                                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isBreak ? 'bg-amber-400' : 'bg-blue-500'}`} />
                                            <span className={`text-xs font-semibold flex-1 ${isBreak ? 'text-amber-700' : 'text-blue-700'}`}>
                                                {isBreak ? (period.customLabel || period.type) : `Lesson ${period.periodNumber}`}
                                            </span>
                                            <span className="text-xs text-gray-400 font-mono">{formatDisplayTime(period.startTime, timeFormat)} – {formatDisplayTime(period.endTime, timeFormat)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>

                        {/* Footer */}
                        <div className="pt-4 mt-4 border-t flex justify-end gap-2">
                            <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
                            <Button
                                onClick={handleGenerate}
                                disabled={isPending}
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700"
                            >
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                                {isEditing ? 'Save Changes' : 'Generate & Save'}
                            </Button>
                        </div>
                    </div>
                </div>
            </ModernDialogContent>
        </ModernDialog>
    );
}
