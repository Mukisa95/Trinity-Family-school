import type { Class, TimetableEntry } from "@/types";

export function filterTimetablePrintData(
    classes: Class[],
    entries: TimetableEntry[],
    selectedClassIds: string[],
): { classes: Class[]; entries: TimetableEntry[] } {
    const selectedIds = new Set(selectedClassIds);
    return {
        classes: classes.filter(classItem => selectedIds.has(classItem.id)),
        entries: entries.filter(entry => selectedIds.has(entry.classId)),
    };
}
