"use client";

import * as React from "react";
import { TrackerCore } from "@/components/dashboard/DashboardLiveTracker";

interface LiveTrackerProps {
    yearId: string;
    termId: string;
    profileId: string;
    profileName?: string;
    liveEnabled?: boolean;
    selected?: boolean;
    onSelect?: () => void;
}

export function LiveTracker({ yearId, termId, profileId, profileName, liveEnabled = true, selected = false, onSelect }: LiveTrackerProps) {
    const label = profileName || "Timetable";
    const handleCardSelect = (event: React.MouseEvent<HTMLElement>) => {
        if (selected || !onSelect || (event.target as HTMLElement).closest("button, a, input, select, textarea, [data-pill-popover]")) return;
        onSelect();
    };

    return (
        <section
            onClick={handleCardSelect}
            aria-label={`${label} live lesson tracker`}
            className={`dashboard-timetable-card relative min-w-0 rounded-xl px-3 py-2.5 ${!selected && onSelect ? "cursor-pointer" : ""} ${selected ? "ring-1 ring-brand-alt-400 dark:ring-brand-alt-600" : ""}`}
        >
            <button
                type="button"
                onClick={onSelect}
                disabled={!onSelect}
                aria-pressed={selected}
                aria-controls="selected-timetable-panel"
                className="mb-1 block max-w-full truncate rounded text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-alt-500 dark:text-slate-400"
            >
                {label}{selected ? " · Timetable shown" : " · View timetable"}
            </button>
            {liveEnabled ? (
                <TrackerCore yearId={yearId} termId={termId} profileId={profileId} showClock onTimetablePage />
            ) : (
                <span className="text-xs text-gray-500 dark:text-slate-400">Saved timetable</span>
            )}
        </section>
    );
}
