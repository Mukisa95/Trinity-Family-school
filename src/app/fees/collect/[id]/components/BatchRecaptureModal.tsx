'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { Camera, Check, X, Spinner } from '@phosphor-icons/react';
import type { AcademicYear, Pupil } from '@/types';
import { isTermEnded } from '@/lib/utils/academic-year-utils';
import { getEffectiveTermForDataDisplay } from '@/lib/utils/term-status-utils';

interface BatchRecaptureModalProps {
    isOpen: boolean;
    onClose: () => void;
    academicYears: AcademicYear[];
    classes: Array<{ id: string; name: string; code: string }>;
    allPupils: Pupil[];
    onRecaptureComplete?: () => void;
}

interface BatchResult {
    pupilId: string;
    pupilName: string;
    success: boolean;
    error?: string;
}

export function BatchRecaptureModal({
    isOpen,
    onClose,
    academicYears,
    classes,
    allPupils,
    onRecaptureComplete
}: BatchRecaptureModalProps) {
    const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>('');
    const [selectedTermIds, setSelectedTermIds] = useState<Set<string>>(new Set());
    const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(new Set());
    const [selectedPupilIds, setSelectedPupilIds] = useState<Set<string>>(new Set());
    const [showOnlyWithSnapshots, setShowOnlyWithSnapshots] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStatus, setProcessingStatus] = useState<{
        current: number;
        total: number;
        currentPupilName: string;
    } | null>(null);
    const [batchResults, setBatchResults] = useState<BatchResult[] | null>(null);

    // Get selected academic year
    const selectedAcademicYear = useMemo(() => {
        return academicYears.find(year => year.id === selectedAcademicYearId);
    }, [academicYears, selectedAcademicYearId]);

    // 🚀 DYNAMIC YEAR LABELS
    const currentAcademicYearId = useMemo(() => {
        if (academicYears.length === 0) return null;
        const effectiveTerm = getEffectiveTermForDataDisplay(academicYears);
        return effectiveTerm?.academicYear?.id || null;
    }, [academicYears]);

    // Get ended terms from selected academic year
    const endedTerms = useMemo(() => {
        if (!selectedAcademicYear) return [];
        return selectedAcademicYear.terms.filter(term => isTermEnded(term));
    }, [selectedAcademicYear]);

    // Get pupils in selected classes
    const pupilsInClass = useMemo(() => {
        if (selectedClassIds.size === 0) return [];
        return allPupils.filter(pupil => selectedClassIds.has(pupil.classId));
    }, [allPupils, selectedClassIds]);

    // Filter pupils based on "show only with snapshots" toggle
    const displayedPupils = useMemo(() => {
        // For now, show all pupils in the class
        // TODO: Add snapshot checking if needed
        return pupilsInClass;
    }, [pupilsInClass, showOnlyWithSnapshots]);

    // Reset selections when academic year changes
    useEffect(() => {
        setSelectedTermIds(new Set());
        setSelectedClassIds(new Set());
        setSelectedPupilIds(new Set());
    }, [selectedAcademicYearId]);

    // Reset class and pupil selections when terms change
    useEffect(() => {
        setSelectedClassIds(new Set());
        setSelectedPupilIds(new Set());
    }, [selectedTermIds.size]);

    // Reset pupil selections when classes change
    useEffect(() => {
        setSelectedPupilIds(new Set());
    }, [selectedClassIds.size]);

    // Handle select all / deselect all
    const handleToggleAll = () => {
        if (selectedPupilIds.size === displayedPupils.length) {
            setSelectedPupilIds(new Set());
        } else {
            setSelectedPupilIds(new Set(displayedPupils.map(p => p.id)));
        }
    };

    // Handle individual pupil selection
    const handleTogglePupil = (pupilId: string) => {
        const newSet = new Set(selectedPupilIds);
        if (newSet.has(pupilId)) {
            newSet.delete(pupilId);
        } else {
            newSet.add(pupilId);
        }
        setSelectedPupilIds(newSet);
    };

    // Handle batch recapture
    const handleBatchRecapture = async () => {
        if (selectedPupilIds.size === 0) {
            toast({
                variant: 'destructive',
                title: 'No Pupils Selected',
                description: 'Please select at least one pupil to recapture snapshots.'
            });
            return;
        }

        if (!selectedAcademicYear || selectedTermIds.size === 0) {
            toast({
                variant: 'destructive',
                title: 'Invalid Selection',
                description: 'Please select an academic year and at least one term.'
            });
            return;
        }

        setIsProcessing(true);
        setBatchResults(null);

        try {
            const allResults: BatchResult[] = [];
            const termsArray = Array.from(selectedTermIds);
            const totalOperations = selectedPupilIds.size * termsArray.length;
            let processedCount = 0;

            // Process each term separately
            for (const termId of termsArray) {
                const term = endedTerms.find(t => t.id === termId);
                const termName = term?.name || 'Unknown Term';

                // Update processing status
                setProcessingStatus({
                    current: processedCount,
                    total: totalOperations,
                    currentPupilName: `Processing ${termName}...`
                });

                // Call API endpoint for batch recapture for this term
                const response = await fetch('/api/snapshots/batch-recapture', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        pupilIds: Array.from(selectedPupilIds),
                        termId: termId,
                        academicYearId: selectedAcademicYearId
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `Failed to recapture snapshots for ${termName}`);
                }

                const result = await response.json();

                // Add term information to results
                const resultsWithTerm = result.results.map((r: BatchResult) => ({
                    ...r,
                    pupilName: `${r.pupilName} (${termName})`
                }));

                allResults.push(...resultsWithTerm);
                processedCount += selectedPupilIds.size;
            }

            setBatchResults(allResults);

            const successCount = allResults.filter(r => r.success).length;
            toast({
                title: 'Batch Recapture Complete',
                description: `Successfully recaptured ${successCount} of ${allResults.length} snapshots across ${termsArray.length} term(s).`
            });

            // Call completion callback
            if (onRecaptureComplete) {
                onRecaptureComplete();
            }
        } catch (error) {
            console.error('Batch recapture error:', error);
            toast({
                variant: 'destructive',
                title: 'Batch Recapture Failed',
                description: error instanceof Error ? error.message : 'An unexpected error occurred.'
            });
        } finally {
            setIsProcessing(false);
            setProcessingStatus(null);
        }
    };

    // Handle modal close
    const handleClose = () => {
        if (!isProcessing) {
            // Reset state
            setSelectedAcademicYearId('');
            setSelectedTermIds(new Set());
            setSelectedClassIds(new Set());
            setSelectedPupilIds(new Set());
            setBatchResults(null);
            setProcessingStatus(null);
            onClose();
        }
    };

    // If showing results, display the results view
    if (batchResults) {
        const successResults = batchResults.filter(r => r.success);
        const failureResults = batchResults.filter(r => !r.success);

        return (
            <Dialog open={isOpen} onOpenChange={handleClose}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Batch Recapture Results</DialogTitle>
                        <DialogDescription>
                            Summary of snapshot recapture operation
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Summary */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-gray-50 rounded-lg p-4 text-center">
                                <div className="text-2xl font-bold text-gray-900">{batchResults.length}</div>
                                <div className="text-xs text-gray-600">Total Processed</div>
                            </div>
                            <div className="bg-green-50 rounded-lg p-4 text-center">
                                <div className="text-2xl font-bold text-green-900">{successResults.length}</div>
                                <div className="text-xs text-green-600">Successful</div>
                            </div>
                            <div className="bg-red-50 rounded-lg p-4 text-center">
                                <div className="text-2xl font-bold text-red-900">{failureResults.length}</div>
                                <div className="text-xs text-red-600">Failed</div>
                            </div>
                        </div>

                        {/* Success List */}
                        {successResults.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="font-medium text-green-900">✅ Successful Recaptures</h3>
                                <div className="bg-green-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                                    {successResults.map((result) => (
                                        <div key={result.pupilId} className="flex items-center gap-2 py-1">
                                            <Check className="w-4 h-4 text-green-600" weight="bold" />
                                            <span className="text-sm text-green-900">{result.pupilName}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Failure List */}
                        {failureResults.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="font-medium text-red-900">❌ Failed Recaptures</h3>
                                <div className="bg-red-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                                    {failureResults.map((result) => (
                                        <div key={result.pupilId} className="space-y-1 py-2 border-b border-red-100 last:border-b-0">
                                            <div className="flex items-center gap-2">
                                                <X className="w-4 h-4 text-red-600" weight="bold" />
                                                <span className="text-sm font-medium text-red-900">{result.pupilName}</span>
                                            </div>
                                            {result.error && (
                                                <p className="text-xs text-red-700 ml-6">{result.error}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button onClick={handleClose}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Camera className="w-5 h-5" weight="bold" />
                        Batch Snapshot Recapture
                    </DialogTitle>
                    <DialogDescription>
                        Select multiple terms and classes to batch recapture snapshots for pupils. This allows you to update historical data across multiple terms and classes at once.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Academic Year Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Academic Year
                        </label>
                        <select
                            value={selectedAcademicYearId}
                            onChange={(e) => setSelectedAcademicYearId(e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            disabled={isProcessing}
                        >
                            <option value="">Select Academic Year</option>
                            {academicYears.map((year) => {
                                const isCurrent = year.id === currentAcademicYearId;
                                const today = new Date();
                                const yearEnd = new Date(year.endDate);
                                const hasEnded = today > yearEnd;

                                let label = '';
                                if (isCurrent) {
                                    label = '(Current)';
                                } else if (year.isLocked) {
                                    label = '(Locked)';
                                } else if (!hasEnded) {
                                    label = '(Upcoming)';
                                }

                                return (
                                    <option key={year.id} value={year.id}>
                                        {year.name} {label}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    {/* Term Selection */}
                    {selectedAcademicYear && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="block text-sm font-medium text-gray-700">
                                    Terms (Ended Terms Only) - {selectedTermIds.size} selected
                                </label>
                                {endedTerms.length > 0 && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            if (selectedTermIds.size === endedTerms.length) {
                                                setSelectedTermIds(new Set());
                                            } else {
                                                setSelectedTermIds(new Set(endedTerms.map(t => t.id)));
                                            }
                                        }}
                                        disabled={isProcessing}
                                    >
                                        {selectedTermIds.size === endedTerms.length ? 'Deselect All' : 'Select All'}
                                    </Button>
                                )}
                            </div>
                            {endedTerms.length > 0 ? (
                                <div className="border border-gray-300 rounded-md max-h-48 overflow-y-auto">
                                    {endedTerms.map((term) => (
                                        <div
                                            key={term.id}
                                            className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                                        >
                                            <Checkbox
                                                checked={selectedTermIds.has(term.id)}
                                                onCheckedChange={() => {
                                                    const newSet = new Set(selectedTermIds);
                                                    if (newSet.has(term.id)) {
                                                        newSet.delete(term.id);
                                                    } else {
                                                        newSet.add(term.id);
                                                    }
                                                    setSelectedTermIds(newSet);
                                                }}
                                                disabled={isProcessing}
                                            />
                                            <span className="text-sm text-gray-900">{term.name}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-amber-600 mt-1">
                                    No ended terms available in this academic year.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Class Selection */}
                    {selectedTermIds.size > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="block text-sm font-medium text-gray-700">
                                    Classes - {selectedClassIds.size} selected
                                </label>
                                {classes.length > 0 && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            if (selectedClassIds.size === classes.length) {
                                                setSelectedClassIds(new Set());
                                            } else {
                                                setSelectedClassIds(new Set(classes.map(c => c.id)));
                                            }
                                        }}
                                        disabled={isProcessing}
                                    >
                                        {selectedClassIds.size === classes.length ? 'Deselect All' : 'Select All'}
                                    </Button>
                                )}
                            </div>
                            <div className="border border-gray-300 rounded-md max-h-48 overflow-y-auto">
                                {classes.map((cls) => (
                                    <div
                                        key={cls.id}
                                        className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                                    >
                                        <Checkbox
                                            checked={selectedClassIds.has(cls.id)}
                                            onCheckedChange={() => {
                                                const newSet = new Set(selectedClassIds);
                                                if (newSet.has(cls.id)) {
                                                    newSet.delete(cls.id);
                                                } else {
                                                    newSet.add(cls.id);
                                                }
                                                setSelectedClassIds(newSet);
                                            }}
                                            disabled={isProcessing}
                                        />
                                        <span className="text-sm text-gray-900">{cls.name} ({cls.code})</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Pupil Selection */}
                    {selectedClassIds.size > 0 && displayedPupils.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="block text-sm font-medium text-gray-700">
                                    Select Pupils ({selectedPupilIds.size} of {displayedPupils.length} selected)
                                </label>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleToggleAll}
                                    disabled={isProcessing}
                                >
                                    {selectedPupilIds.size === displayedPupils.length ? 'Deselect All' : 'Select All'}
                                </Button>
                            </div>

                            <div className="border border-gray-300 rounded-md max-h-64 overflow-y-auto">
                                {displayedPupils.map((pupil) => (
                                    <div
                                        key={pupil.id}
                                        className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                                    >
                                        <Checkbox
                                            checked={selectedPupilIds.has(pupil.id)}
                                            onCheckedChange={() => handleTogglePupil(pupil.id)}
                                            disabled={isProcessing}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm text-gray-900">
                                                {pupil.firstName} {pupil.lastName}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {pupil.admissionNumber} • {classes.find(c => c.id === pupil.classId)?.code || pupil.className} • {pupil.section}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {selectedClassIds.size > 0 && displayedPupils.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            <p>No pupils found in the selected classes.</p>
                        </div>
                    )}

                    {/* Processing Status */}
                    {isProcessing && processingStatus && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-center gap-3 mb-2">
                                <Spinner className="w-5 h-5 animate-spin text-blue-600" />
                                <span className="font-medium text-blue-900">Processing...</span>
                            </div>
                            <div className="text-sm text-blue-800">
                                Processing {processingStatus.current} of {processingStatus.total}: {processingStatus.currentPupilName}
                            </div>
                            <div className="mt-2 bg-blue-200 rounded-full h-2 overflow-hidden">
                                <div
                                    className="bg-blue-600 h-full transition-all duration-300"
                                    style={{ width: `${(processingStatus.current / processingStatus.total) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleBatchRecapture}
                        disabled={selectedPupilIds.size === 0 || isProcessing}
                        className="bg-indigo-600 hover:bg-indigo-700"
                    >
                        {isProcessing ? (
                            <>
                                <Spinner className="w-4 h-4 mr-2 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <Camera className="w-4 h-4 mr-2" weight="bold" />
                                Recapture {selectedPupilIds.size * selectedTermIds.size} Snapshot{(selectedPupilIds.size * selectedTermIds.size) !== 1 ? 's' : ''}
                                {selectedTermIds.size > 1 && ` (${selectedPupilIds.size} pupils × ${selectedTermIds.size} terms)`}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
