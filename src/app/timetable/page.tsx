"use client";

import * as React from "react";
import { PlusCircle, CalendarPlus, TableProperties } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
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

    const { data: profiles = [], isLoading: profilesLoading, refetch } = useTimetableProfiles(yearId, termId);

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
            refetch();
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
            refetch();
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
            {/* Top Header Row */}
            {/* Top Header Row - Tightly Consolidated Button-like Pill */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100">
                <div className="flex items-center bg-white border border-gray-200/80 shadow-sm rounded-xl overflow-x-auto hide-scrollbar w-full sm:w-auto h-10 flex-nowrap group hover:border-blue-300 transition-colors">

                    {/* Title Section */}
                    <div className="flex items-center h-full px-3.5 bg-gray-50/80 border-r border-gray-200/80 flex-shrink-0">
                        <h1 className="text-sm sm:text-base font-bold text-gray-800 whitespace-nowrap">
                            Timetable Management
                        </h1>
                    </div>

                    {/* Selectors Section - fully integrated, no inner borders */}
                    <div className="flex items-center h-full flex-shrink-0">
                        <select
                            value={yearId}
                            onChange={(e) => { setYearId(e.target.value); setTermId(''); }}
                            className="h-full bg-transparent text-[11px] sm:text-xs font-semibold px-2 focus:outline-none text-blue-700 cursor-pointer min-w-[90px] border-r border-gray-100 appearance-none text-center"
                            style={{ backgroundImage: 'none' }} // Remove default dropdown arrow for cleaner look, or custom icon could be added
                        >
                            <option value="" disabled>Select Year</option>
                            {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                        </select>
                        <select
                            value={termId}
                            onChange={(e) => setTermId(e.target.value)}
                            disabled={!yearId}
                            className="h-full bg-transparent text-[11px] sm:text-xs font-semibold px-2 focus:outline-none text-blue-700 cursor-pointer disabled:opacity-50 min-w-[100px] appearance-none text-center"
                            style={{ backgroundImage: 'none' }}
                        >
                            <option value="" disabled>Select Term</option>
                            {viewTerms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>

                    {/* Decorative active indicator on hover */}
                    <div className="h-full w-1 bg-transparent group-hover:bg-blue-600 transition-colors flex-shrink-0"></div>
                </div>
            </div>

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
                    {/* Unified Toolbar Row: Profiles (Left) + Actions (Right) */}
                    <div className="flex items-center justify-between gap-2.5 mb-2 bg-gray-50/70 p-1.5 rounded-full border border-gray-200/60 shadow-sm overflow-x-auto hide-scrollbar w-full flex-nowrap">

                        {/* Left: Profile Tabs */}
                        <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar flex-1 min-w-0">
                            {profiles.map(profile => (
                                <button
                                    key={profile.id}
                                    onClick={() => { setSelectedProfileId(profile.id); setViewMode('single'); }}
                                    className={`px-3.5 py-1 rounded-full font-semibold text-xs sm:text-sm transition-all whitespace-nowrap flex-shrink-0 ${selectedProfileId === profile.id && viewMode === 'single'
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300'
                                        }`}
                                >
                                    {profile.name || "Main Timetable"}
                                </button>
                            ))}
                        </div>

                        {/* Right: Actions (Combined View, Zoom, Settings) */}
                        <div className="flex items-center gap-2 flex-shrink-0 ml-auto flex-nowrap pl-2">
                            {profiles.length > 1 && (
                                <button
                                    onClick={() => setViewMode(prev => prev === 'all' ? 'single' : 'all')}
                                    className={`h-7 px-3 rounded-full font-semibold text-xs sm:text-sm transition-all whitespace-nowrap border flex-shrink-0 ${viewMode === 'all'
                                        ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                                        : 'bg-white text-purple-700 border-purple-300 hover:bg-purple-50'
                                        }`}
                                    title={viewMode === 'all' ? "Exit Combined View" : "View All Together"}
                                >
                                    {viewMode === 'all' ? (
                                        <><span className="sm:hidden">✕ Exit</span><span className="hidden sm:inline">✕ Exit Combined</span></>
                                    ) : (
                                        <><span className="sm:hidden">⊞ All</span><span className="hidden sm:inline">⊞ View Together</span></>
                                    )}
                                </button>
                            )}

                            {/* Divider if multiple tools are present */}
                            {profiles.length > 1 && <div className="h-6 w-px bg-gray-300 mx-0.5 flex-shrink-0"></div>}

                            {/* Zoom Control */}
                            {activeProfile && viewMode === 'single' && (
                                <div className="flex items-center bg-white rounded-full px-1.5 border border-gray-200 shadow-sm h-7 flex-shrink-0">
                                    <button onClick={() => setZoom(Math.max(0.5, +(zoom - 0.25).toFixed(2)))} className="text-gray-500 hover:text-blue-600 font-bold px-1.5 text-base leading-none">−</button>
                                    <span className="text-xs font-mono text-gray-600 w-9 sm:w-10 text-center">{Math.round(zoom * 100)}%</span>
                                    <button onClick={() => setZoom(Math.min(2.5, +(zoom + 0.25).toFixed(2)))} className="text-gray-500 hover:text-blue-600 font-bold px-1.5 text-base leading-none">+</button>
                                </div>
                            )}

                            {/* Print Button */}
                            {activeProfile && viewMode === 'single' && (
                                <Button size="sm" variant="outline" onClick={() => document.getElementById('hidden-print-btn')?.click()} className="h-7 w-7 p-0 rounded-full bg-white text-gray-700 border-gray-200 hover:bg-gray-50 shadow-sm flex items-center justify-center flex-shrink-0 focus:ring-2 focus:ring-blue-500" title="Export PDF">
                                    <Printer className="w-4 h-4" />
                                </Button>
                            )}

                            {/* Settings Dropdown */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button size="sm" variant="outline" className="h-7 w-7 p-0 rounded-full bg-white text-gray-700 border-gray-200 hover:bg-gray-50 shadow-sm flex items-center justify-center flex-shrink-0 focus:ring-2 focus:ring-blue-500">
                                        <Settings className="w-4 h-4" />
                                    </Button>
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
                        </div>
                    </div>

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
                        ))}
                </div>
            )}

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
