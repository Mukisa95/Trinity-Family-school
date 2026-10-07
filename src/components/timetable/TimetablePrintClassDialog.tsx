"use client";

import * as React from "react";
import { CheckCheck, Printer } from "lucide-react";
import type { Class } from "@/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface TimetablePrintClassDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    classes: Class[];
    timetableName?: string;
    onPrint: (classIds: string[]) => void;
}

export function TimetablePrintClassDialog({
    open,
    onOpenChange,
    classes,
    timetableName,
    onPrint,
}: TimetablePrintClassDialogProps) {
    const [selectedClassIds, setSelectedClassIds] = React.useState<Set<string>>(new Set());
    const classIdsKey = React.useMemo(() => classes.map(classItem => classItem.id).join("|"), [classes]);

    React.useEffect(() => {
        if (open) setSelectedClassIds(new Set(classes.map(classItem => classItem.id)));
    }, [classIdsKey, classes, open]);

    const selectedCount = selectedClassIds.size;
    const allSelected = classes.length > 0 && selectedCount === classes.length;

    const toggleClass = (classId: string, checked: boolean) => {
        setSelectedClassIds(current => {
            const next = new Set(current);
            if (checked) next.add(classId);
            else next.delete(classId);
            return next;
        });
    };

    const handlePrint = () => {
        const orderedSelection = classes
            .filter(classItem => selectedClassIds.has(classItem.id))
            .map(classItem => classItem.id);
        if (orderedSelection.length === 0) return;
        onOpenChange(false);
        onPrint(orderedSelection);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
                <DialogHeader className="border-b border-slate-200/80 bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-5 py-5 pr-14 sm:px-6">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                            <Printer className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <DialogTitle>Choose classes to print</DialogTitle>
                            <DialogDescription className="mt-1.5 leading-5">
                                Select the classes to include in {timetableName || "this timetable"}. The PDF will resize to fit your selection.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 sm:px-6">
                    <p className="text-sm font-semibold text-slate-700" aria-live="polite">
                        {selectedCount} of {classes.length} classes selected
                    </p>
                    <div className="flex items-center gap-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-full px-3 text-xs text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                            onClick={() => setSelectedClassIds(new Set(classes.map(classItem => classItem.id)))}
                            disabled={allSelected}
                        >
                            <CheckCheck className="h-3.5 w-3.5" />
                            Select all
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-full px-3 text-xs text-slate-600 hover:bg-slate-100"
                            onClick={() => setSelectedClassIds(new Set())}
                            disabled={selectedCount === 0}
                        >
                            Clear
                        </Button>
                    </div>
                </div>

                <div className="max-h-[48dvh] overflow-y-auto px-5 py-4 sm:px-6">
                    {classes.length > 0 ? (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {classes.map((classItem, index) => {
                                const checkboxId = `print-timetable-class-${index}`;
                                const checked = selectedClassIds.has(classItem.id);
                                const secondaryName = classItem.name !== classItem.code ? classItem.name : "Included in timetable";
                                return (
                                    <label
                                        key={classItem.id}
                                        htmlFor={checkboxId}
                                        className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors ${checked
                                            ? "border-blue-200 bg-blue-50/80 shadow-sm"
                                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                                        }`}
                                    >
                                        <Checkbox
                                            id={checkboxId}
                                            checked={checked}
                                            onCheckedChange={value => toggleClass(classItem.id, value === true)}
                                            aria-label={`Include ${classItem.name || classItem.code} in the PDF`}
                                            className="h-5 w-5 rounded-md"
                                        />
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-bold text-slate-900">
                                                {classItem.code || classItem.name}
                                            </span>
                                            <span className="block truncate text-xs text-slate-500">{secondaryName}</span>
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                            This timetable has no classes available to print.
                        </div>
                    )}
                </div>

                <DialogFooter className="mt-0 flex-row justify-end space-x-2 border-t border-slate-200 bg-slate-50/80 px-5 py-4 sm:px-6">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={handlePrint} disabled={selectedCount === 0} className="bg-blue-600 hover:bg-blue-700">
                        <Printer className="h-4 w-4" />
                        Generate PDF{selectedCount > 0 ? ` (${selectedCount})` : ""}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
