"use client";

import * as React from "react";
import { GripVertical, ArrowUp, ArrowDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PLESubjectsService, type PLESubject } from "@/lib/services/ple-subjects.service";
import type { PLERecord } from "@/lib/services/ple-results.service";

interface PLESubjectReorderModalProps {
    isOpen: boolean;
    onClose: () => void;
    pleRecord: PLERecord | null;
    onReorderComplete?: () => void;
}

export function PLESubjectReorderModal({
    isOpen,
    onClose,
    pleRecord,
    onReorderComplete
}: PLESubjectReorderModalProps) {
    const { toast } = useToast();
    const [subjects, setSubjects] = React.useState<PLESubject[]>([]);
    const [isSaving, setIsSaving] = React.useState(false);

    // Initialize subjects when modal opens
    React.useEffect(() => {
        if (isOpen && pleRecord) {
            const orderedSubjects = PLESubjectsService.getSubjectsForRecord(pleRecord);
            setSubjects(orderedSubjects);
        }
    }, [isOpen, pleRecord]);

    const moveSubject = (index: number, direction: 'up' | 'down') => {
        const newSubjects = [...subjects];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        if (targetIndex < 0 || targetIndex >= newSubjects.length) {
            return;
        }

        // Swap subjects
        [newSubjects[index], newSubjects[targetIndex]] = [newSubjects[targetIndex], newSubjects[index]];

        // Update order property
        newSubjects.forEach((subject, idx) => {
            subject.order = idx;
        });

        setSubjects(newSubjects);
    };

    const resetToDefault = () => {
        const defaultSubjects = PLESubjectsService.getSubjectsForRecord(null);
        setSubjects(defaultSubjects);
        toast({
            title: "Reset to Default",
            description: "Subject order has been reset to the default order.",
        });
    };

    const handleSave = async () => {
        if (!pleRecord) return;

        try {
            setIsSaving(true);
            const subjectOrder = subjects.map(s => s.id);

            await PLESubjectsService.updateSubjectOrder(pleRecord.id, subjectOrder);

            toast({
                title: "Order Saved",
                description: "Subject order has been updated successfully.",
            });

            onReorderComplete?.();
            onClose();
        } catch (error) {
            console.error('Error saving subject order:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to save subject order. Please try again.",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleClose = () => {
        if (!isSaving) {
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Reorder PLE Subjects</DialogTitle>
                    <DialogDescription>
                        Drag subjects or use arrow buttons to change their order. This will affect how subjects appear in the results table and on certificates.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-2 py-4">
                    {subjects.map((subject, index) => (
                        <div
                            key={subject.id}
                            className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                        >
                            {/* Drag Handle Visual */}
                            <div className="text-gray-400">
                                <GripVertical className="h-5 w-5" />
                            </div>

                            {/* Subject Info */}
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-sm font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                        {subject.code}
                                    </span>
                                    <span className="text-sm font-medium text-gray-700">
                                        {subject.name}
                                    </span>
                                </div>
                            </div>

                            {/* Order Number */}
                            <div className="text-xs text-gray-500 font-medium min-w-[60px] text-center">
                                Position {index + 1}
                            </div>

                            {/* Move Buttons */}
                            <div className="flex gap-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => moveSubject(index, 'up')}
                                    disabled={index === 0}
                                    className="h-8 w-8 p-0"
                                >
                                    <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => moveSubject(index, 'down')}
                                    disabled={index === subjects.length - 1}
                                    className="h-8 w-8 p-0"
                                >
                                    <ArrowDown className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Preview */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-blue-900 mb-2">Table Header Preview:</p>
                    <div className="flex gap-2">
                        {subjects.map(subject => (
                            <div
                                key={subject.id}
                                className="bg-white border border-blue-300 rounded px-2 py-1 text-xs font-semibold text-gray-700"
                            >
                                {subject.code}
                            </div>
                        ))}
                    </div>
                </div>

                <DialogFooter className="flex justify-between sm:justify-between">
                    <Button
                        variant="outline"
                        onClick={resetToDefault}
                        disabled={isSaving}
                        className="gap-2"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Reset to Default
                    </Button>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={handleClose}
                            disabled={isSaving}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? "Saving..." : "Save Order"}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
