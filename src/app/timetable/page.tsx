"use client";

import * as React from "react";
import { CalendarRange, Check, ChevronDown, PlusCircle, TableProperties, X } from "lucide-react";
import { useAcademicYears } from "@/lib/hooks/use-academic-years";
import { getEffectiveTermForDataDisplay } from "@/lib/utils/term-status-utils";
import { useTimetableProfiles } from "@/lib/hooks/use-timetable";
import { Loader2 } from "lucide-react";
import { StructureGenerator } from "@/components/timetable/StructureGenerator";
import { LiveTracker } from "@/components/timetable/LiveTracker";
import { Trash2, Settings, PencilRuler, Type, Printer } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TimetableViewPanel } from "@/components/timetable/TimetableViewPanel";
import { CombinedTimelineView } from "@/components/timetable/CombinedTimelineView";
import { GlassPageTopBar, GlassActionDock, GlassActionButton } from "@/components/common/glass-page-top-bar";

export default function TimetablePage() {
    const { data: years = [], isLoading: yearsLoading } = useAcademicYears();

    const [yearId, setYearId] = React.useState<string>("");
    const [termId, setTermId] = React.useState<string>("");

    // Initialize to the current/most-recent term using the same centralized logic
    // as the working exams and fees-collection pages. getEffectiveTermForDataDisplay
    // searches ALL years using date-fns parseISO/isWithinInterval (timezone-safe) and
    // handles holiday periods by returning the most recently completed term.
    React.useEffect(() => {
        if (years.length > 0 && !yearId) {
            const effective = getEffectiveTermForDataDisplay(years);
            const detectedYearId = effective?.academicYear?.id || years[0]?.id;
            const detectedTermId = effective?.term?.id;
            if (detectedYearId) setYearId(detectedYearId);
            if (detectedTermId) setTermId(detectedTermId);
        }
    }, [years, yearId]);

    const viewYear = years.find(y => y.id === yearId);
    const viewTerms = viewYear?.terms || [];

    // Determine if the selected term is the current one (by date range)
    const isCurrentTerm = React.useMemo(() => {
        const now = new Date();
        const selectedTerm = viewTerms.find(t => t.id === termId);
        if (!selectedTerm?.startDate || !selectedTerm?.endDate) return false;
        return now >= new Date(selectedTerm.startDate) && now <= new Date(selectedTerm.endDate);
    }, [viewTerms, termId]);

    const { data: profiles = [] } = useTimetableProfiles(yearId, termId);

    // Default to first profile if available
    const [selectedProfileId, setSelectedProfileId] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (profiles.length > 0 && !profiles.some(profile => profile.id === selectedProfileId)) {
            setSelectedProfileId(profiles[0].id);
        } else if (profiles.length === 0) {
            setSelectedProfileId(null);
        }
    }, [profiles, selectedProfileId]);

    const activeProfile = profiles.find(p => p.id === selectedProfileId) || profiles[0];

    // Quick delete
    const handleDeleteProfile = async () => {
        if (!activeProfile || !confirm(`Are you sure you want to delete the "${activeProfile.name || 'Timetable'}" profile? All entries will be lost.`)) return;
        try {
            const { TimetableService } = await import("@/lib/services/timetable.service");
            await TimetableService.deleteTimetable(yearId, termId, activeProfile.id);
            setSelectedProfileId(null);
            // The mutation advances this term's revision. The shared timetable
            // cache refreshes once from that signal; do not add a second read.
        } catch (e) {
            console.error(e);
        }
    };

    // Quick rename
    const handleRenameProfile = async () => {
        if (!activeProfile) return;
        const newName = window.prompt(`Enter a new name for "${activeProfile.name || 'Main Timetable'}":`, activeProfile.name);
        if (!newName || newName.trim() === '' || newName === activeProfile.name) return;

        try {
            const { TimetableService } = await import("@/lib/services/timetable.service");
            await TimetableService.renameTimetable(yearId, termId, activeProfile.id, newName.trim());
            // The revision listener updates the cached profile list after the
            // confirmed write, without an eager page-level refetch.
        } catch (e) {
            console.error('Error renaming timetable:', e);
            alert("Failed to rename timetable.");
        }
    };

    const [isGeneratorOpen, setIsGeneratorOpen] = React.useState(false);
    const [editingProfileForConfig, setEditingProfileForConfig] = React.useState<typeof profiles[0] | null>(null);
    const [viewMode, setViewMode] = React.useState<'single' | 'all'>('single');
    const [zoom, setZoom] = React.useState(1);

    const isLoading = yearsLoading;
    const selectedTerm = viewTerms.find(term => term.id === termId);
    const selectedPeriodLabel = viewYear && selectedTerm
        ? `${viewYear.name} · ${selectedTerm.name}`
        : "Year & Term";
    const selectedTimetableLabel = viewMode === "all"
        ? "All Timetables"
        : activeProfile?.name || "Timetables";

    return (
        <>
            <GlassPageTopBar
                title="Timetable"
                subtitle="Manage class schedules and teacher assignments"
                backHref="/dashboard"
                backLabel="Dashboard"
                titleControls={
                    <div className="flex min-w-0 items-center gap-1.5">
                        <div className="sm:hidden">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        className="flex h-8 max-w-[42vw] items-center gap-1 rounded-full border border-blue-200/70 bg-white/95 px-2.5 text-[10px] font-bold text-blue-700 shadow-sm transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                        aria-label={`Select academic year and term. Current selection: ${selectedPeriodLabel}`}
                                    >
                                        <CalendarRange className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">{selectedPeriodLabel}</span>
                                        <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="max-h-[70vh] w-[min(18rem,calc(100vw-1.5rem))] overflow-y-auto">
                                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-slate-500">
                                        Academic period
                                    </DropdownMenuLabel>
                                    {years.map((year, yearIndex) => (
                                        <React.Fragment key={year.id}>
                                            {yearIndex > 0 && <DropdownMenuSeparator />}
                                            <DropdownMenuLabel className="py-1 text-xs font-bold text-slate-700">
                                                {year.name}
                                            </DropdownMenuLabel>
                                            {(year.terms || []).map(term => {
                                                const isSelected = year.id === yearId && term.id === termId;
                                                return (
                                                    <DropdownMenuItem
                                                        key={`${year.id}-${term.id}`}
                                                        onClick={() => {
                                                            setYearId(year.id);
                                                            setTermId(term.id);
                                                            setViewMode("single");
                                                        }}
                                                        className="cursor-pointer justify-between py-2 text-xs"
                                                    >
                                                        <span>{term.name}</span>
                                                        {isSelected && <Check className="h-3.5 w-3.5 text-blue-600" />}
                                                    </DropdownMenuItem>
                                                );
                                            })}
                                        </React.Fragment>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        <select
                            value={yearId}
                            onChange={(e) => { setYearId(e.target.value); setTermId(''); }}
                            className="hidden h-[30px] cursor-pointer rounded-full border border-blue-200/60 bg-white/90 px-2 text-[10px] font-semibold text-blue-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 sm:block"
                        >
                            <option value="" disabled>Select Year</option>
                            {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                        </select>
                        <select
                            value={termId}
                            onChange={(e) => setTermId(e.target.value)}
                            disabled={!yearId}
                            className="hidden h-[30px] cursor-pointer rounded-full border border-blue-200/60 bg-white/90 px-2 text-[10px] font-semibold text-blue-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 disabled:opacity-50 sm:block"
                        >
                            <option value="" disabled>Select Term</option>
                            {viewTerms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>

                        {yearId && termId && profiles.length > 0 && (
                            <>
                                <div className="mx-0.5 hidden h-5 w-px bg-white/40 sm:block" />

                                <div className="sm:hidden">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                type="button"
                                                className="flex h-8 max-w-[34vw] items-center gap-1 rounded-full border border-violet-200/70 bg-white/95 px-2.5 text-[10px] font-bold text-violet-700 shadow-sm transition-colors hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                                                aria-label={`Choose timetable. Current selection: ${selectedTimetableLabel}`}
                                            >
                                                <TableProperties className="h-3.5 w-3.5 shrink-0" />
                                                <span className="truncate">{selectedTimetableLabel}</span>
                                                <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-[min(16rem,calc(100vw-1.5rem))]">
                                            <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-slate-500">
                                                Available timetables
                                            </DropdownMenuLabel>
                                            {profiles.map(profile => {
                                                const isSelected = selectedProfileId === profile.id && viewMode === "single";
                                                return (
                                                    <DropdownMenuItem
                                                        key={profile.id}
                                                        onClick={() => {
                                                            setSelectedProfileId(profile.id);
                                                            setViewMode("single");
                                                        }}
                                                        className="cursor-pointer justify-between py-2 text-xs"
                                                    >
                                                        <span className="truncate">{profile.name || "Main Timetable"}</span>
                                                        {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-violet-600" />}
                                                    </DropdownMenuItem>
                                                );
                                            })}
                                            {profiles.length > 1 && (
                                                <>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={() => setViewMode("all")}
                                                        className="cursor-pointer justify-between py-2 text-xs"
                                                    >
                                                        <span>All Timetables</span>
                                                        {viewMode === "all" && <Check className="h-3.5 w-3.5 text-violet-600" />}
                                                    </DropdownMenuItem>
                                                </>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                <div className="hidden flex-wrap items-center gap-1 sm:flex">
                                    {profiles.map(profile => (
                                        <button
                                            key={profile.id}
                                            onClick={() => { setSelectedProfileId(profile.id); setViewMode('single'); }}
                                            className={`px-3 py-0.5 rounded-full font-bold text-[10px] transition-all whitespace-nowrap flex-shrink-0 border ${
                                                selectedProfileId === profile.id && viewMode === 'single'
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
                                                    : 'bg-white/80 border-white/60 text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                                            }`}
                                        >
                                            {profile.name || "Main Timetable"}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                }
                actions={
                    yearId && termId && profiles.length > 0 ? (
                        <GlassActionDock>
                            {profiles.length > 1 && (
                                <div data-mobile-action-hidden className="hidden sm:contents">
                                    <GlassActionButton
                                        label={viewMode === 'all' ? "Single" : "Combined"}
                                        icon={viewMode === 'all' ? <X className="h-4 w-4" /> : <TableProperties className="h-4 w-4" />}
                                        tone="purple"
                                        onClick={() => setViewMode(prev => prev === 'all' ? 'single' : 'all')}
                                    />
                                </div>
                            )}
                            {activeProfile && viewMode === 'single' && (
                                <>
                                    <div data-mobile-action-hidden className="hidden sm:contents">
                                        <GlassActionButton
                                            label="Zoom -"
                                            icon={<span className="text-sm font-bold leading-none">-</span>}
                                            tone="slate"
                                            onClick={() => setZoom(Math.max(0.5, +(zoom - 0.25).toFixed(2)))}
                                        />
                                        <div className="flex h-11 w-11 select-none items-center justify-center rounded-full bg-gray-100 px-1 font-mono text-[8px] font-bold text-gray-600">
                                            {Math.round(zoom * 100)}%
                                        </div>
                                        <GlassActionButton
                                            label="Zoom +"
                                            icon={<span className="text-sm font-bold leading-none">+</span>}
                                            tone="slate"
                                            onClick={() => setZoom(Math.min(2.5, +(zoom + 0.25).toFixed(2)))}
                                        />
                                    </div>
                                    <GlassActionButton
                                        label="PDF"
                                        icon={<Printer className="h-4 w-4" />}
                                        tone="blue"
                                        onClick={() => document.getElementById('hidden-print-btn')?.click()}
                                    />
                                </>
                            )}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <GlassActionButton
                                        label="Actions"
                                        icon={<Settings className="h-4 w-4" />}
                                        tone="slate"
                                    />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56 font-medium">
                                    <DropdownMenuItem onClick={() => setIsGeneratorOpen(true)} className="cursor-pointer text-blue-600 focus:text-blue-700 focus:bg-blue-50 py-2.5">
                                        <PlusCircle className="mr-2 h-4 w-4" />
                                        <span>New Timetable Structure</span>
                                    </DropdownMenuItem>

                                    {activeProfile && viewMode === 'single' && (
                                        <>
                                            <DropdownMenuSeparator className="my-1 border-gray-100" />
                                            <DropdownMenuItem onClick={() => { setEditingProfileForConfig(activeProfile); setIsGeneratorOpen(true); }} className="cursor-pointer py-2.5">
                                                <PencilRuler className="mr-2 h-4 w-4 text-gray-500" />
                                                <span>Reconfigure {activeProfile.name || 'Timetable'}</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={handleRenameProfile} className="cursor-pointer py-2.5">
                                                <Type className="mr-2 h-4 w-4 text-gray-500" />
                                                <span>Rename Timetable</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={handleDeleteProfile} className="cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50 py-2.5">
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                <span>Delete Timetable</span>
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </GlassActionDock>
                    ) : undefined
                }
            />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="ml-2">Loading timetable data...</span>
                </div>
            ) : !yearId || !termId ? (
                <div className="text-center text-amber-600 py-12 bg-amber-50 rounded-xl border border-amber-200">
                    <p>Please select an academic year and term to view or manage timetables.</p>
                </div>
            ) : profiles.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center">
                    <div className="p-4 bg-blue-50 text-blue-500 rounded-full mb-4">
                        <TableProperties className="h-12 w-12" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-800 mb-2">No Timetable Configured</h2>
                    <p className="text-gray-500 mb-6 max-w-md">You haven't generated a timetable structure for {viewYear?.name || 'this Year'} - {viewTerms.find(t => t.id === termId)?.name || 'this Term'} yet. Create one to get started.</p>
                    <button
                        onClick={() => setIsGeneratorOpen(true)}
                        className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition"
                    >
                        <PlusCircle className="h-4 w-4" />
                        Generate New Timetable Structure
                    </button>
                </div>
            ) : (
                <div className="space-y-4 min-w-0 w-full">



                    {viewMode === 'all' ? (
                        <div className="space-y-4">
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-5">
                                    All Timetables — Combined Timeline View
                                </h2>
                                <CombinedTimelineView yearId={yearId} termId={termId} />
                            </div>
                        </div>
                    ) : (
                        activeProfile && (
                            <>
                                {/* Live trackers: map over ALL active profiles for current term */}
                                {isCurrentTerm && profiles.length > 0 && (
                                    <div className="flex flex-col gap-3 mb-2">
                                        {profiles.map(p => (
                                            <LiveTracker
                                                key={p.id}
                                                yearId={yearId}
                                                termId={termId}
                                                profileId={p.id}
                                                profileName={profiles.length > 1 ? p.name : undefined}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Main unified grid + filter panel */}
                                <TimetableViewPanel
                                    yearId={yearId}
                                    termId={termId}
                                    profileId={activeProfile.id}
                                    profileName={activeProfile.name || "Main Timetable"}
                                    externalZoom={zoom}
                                    setExternalZoom={setZoom}
                                />
                            </>
                        )
                    )}
                </div>
            )}
            </div>

            {/* Generator Form Modal */}
            {yearId && termId && (
                <StructureGenerator
                    isOpen={isGeneratorOpen}
                    onClose={() => { setIsGeneratorOpen(false); setEditingProfileForConfig(null); }}
                    yearId={yearId}
                    termId={termId}
                    editingProfile={editingProfileForConfig ?? undefined}
                />
            )}
        </>
    );
}
