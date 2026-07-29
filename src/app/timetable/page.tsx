"use client";

import * as React from "react";
import { PlusCircle, CalendarPlus, TableProperties, X } from "lucide-react";
import { useAcademicYears } from "@/lib/hooks/use-academic-years";
import { getEffectiveTermForDataDisplay } from "@/lib/utils/term-status-utils";
import { useTimetableProfiles } from "@/lib/hooks/use-timetable";
import { Loader2 } from "lucide-react";
import { StructureGenerator } from "@/components/timetable/StructureGenerator";
import { TimetableGrid } from "@/components/timetable/TimetableGrid";
import { LiveTracker } from "@/components/timetable/LiveTracker";
import { Button } from "@/components/ui/button";
import { Trash2, Settings, PencilRuler, Type, Printer } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
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
        if (profiles.length > 0 && !selectedProfileId) {
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
    const [sharedDay, setSharedDay] = React.useState<number>(1);
    const [zoom, setZoom] = React.useState(1);

    const isLoading = yearsLoading;

    return (
        <>
            <GlassPageTopBar
                title="Timetable"
                subtitle="Manage class schedules and teacher assignments"
                backHref="/dashboard"
                backLabel="Dashboard"
                meta={
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <select
                            value={yearId}
                            onChange={(e) => { setYearId(e.target.value); setTermId(''); }}
                            className="h-[30px] rounded-full border border-blue-200/60 bg-white/90 px-2 text-[10px] font-semibold text-blue-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 cursor-pointer"
                        >
                            <option value="" disabled>Select Year</option>
                            {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                        </select>
                        <select
                            value={termId}
                            onChange={(e) => setTermId(e.target.value)}
                            disabled={!yearId}
                            className="h-[30px] rounded-full border border-blue-200/60 bg-white/90 px-2 text-[10px] font-semibold text-blue-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 cursor-pointer disabled:opacity-50"
                        >
                            <option value="" disabled>Select Term</option>
                            {viewTerms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>

                        {yearId && termId && profiles.length > 0 && (
                            <>
                                <div className="w-px h-5 bg-white/40 mx-0.5" />
                                <div className="flex items-center gap-1 flex-wrap">
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
                                <GlassActionButton
                                    label={viewMode === 'all' ? "Single" : "Combined"}
                                    icon={viewMode === 'all' ? <X className="h-4 w-4" /> : <TableProperties className="h-4 w-4" />}
                                    tone="purple"
                                    onClick={() => setViewMode(prev => prev === 'all' ? 'single' : 'all')}
                                />
                            )}
                            {activeProfile && viewMode === 'single' && (
                                <>
                                    <GlassActionButton
                                        label="Zoom -"
                                        icon={<span className="text-sm font-bold leading-none">-</span>}
                                        tone="slate"
                                        onClick={() => setZoom(Math.max(0.5, +(zoom - 0.25).toFixed(2)))}
                                    />
                                    <div className="flex items-center justify-center px-1 text-[8px] font-mono font-bold text-gray-600 bg-gray-100 rounded-full select-none h-10 w-10 sm:h-11 sm:w-11">
                                        {Math.round(zoom * 100)}%
                                    </div>
                                    <GlassActionButton
                                        label="Zoom +"
                                        icon={<span className="text-sm font-bold leading-none">+</span>}
                                        tone="slate"
                                        onClick={() => setZoom(Math.min(2.5, +(zoom + 0.25).toFixed(2)))}
                                    />
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
