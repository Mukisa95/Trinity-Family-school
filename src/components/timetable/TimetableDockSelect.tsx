"use client";

import type { ReactNode, SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

type TimetableDockSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
    icon: ReactNode;
    label: string;
};

/** Keep the device's accessible picker, with the same icon and label as dock actions. */
export function TimetableDockSelect({ icon, label, children, ...props }: TimetableDockSelectProps) {
    return (
        <label className="timetable-dock-select" title={label}>
            <span className="glass-navigation-icon" aria-hidden="true">{icon}</span>
            <span className="glass-navigation-label" aria-hidden="true">{label}</span>
            <ChevronDown className="timetable-dock-chevron" aria-hidden="true" />
            <select {...props}>{children}</select>
        </label>
    );
}
