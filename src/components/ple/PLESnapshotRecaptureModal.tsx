'use client';

import React, { useState, useMemo } from 'react';
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
import { Camera, Check, X } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import type { PLERecord, PLEPupilSnapshot } from '@/lib/services/ple-results.service';

interface PLESnapshotRecaptureModalProps {
    isOpen: boolean;
    onClose: () => void;
    pleRecord: PLERecord | null;
    onRecaptureComplete?: () => void;
}

interface BatchResult {
    pupilId: string;
    pupilName: string;
    success: boolean;
    error?: string;
}

export function PLESnapshotRecaptureModal({
    isOpen,
    onClose,
    pleRecord,
    onRecaptureComplete
}: PLESnapshotRecaptureModalProps) {
    const [selectedPupilIds, setSelectedPupilIds] = useState<Set<string>>(new Set());
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStatus, setProcessingStatus] = useState<{
        current: number;
        total: number;
        currentPupilName: string;
    } | null>(null);
    const [batchResults, setBatchResults] = useState<BatchResult[] | null>(null);

    // Get pupils from the PLE record
    const pupils = useMemo(() => {
        return pleRecord?.pupilsSnapshot || [];
    }, [pleRecord]);

    // Handle select all / deselect all
    const handleToggleAll = () => {
        if (selectedPupilIds.size === pupils.length) {
            setSelectedPupilIds(new Set());
        } else {
            setSelectedPupilIds(new Set(pupils.map(p => p.id)));
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

        if (!pleRecord) {
            toast({
                variant: 'destructive',
                title: 'Invalid Record',
                description: 'PLE record not found.'
            });
            return;
        }

        setIsProcessing(true);
        setBatchResults(null);

        try {
            const pupilIds = Array.from(selectedPupilIds);
            setProcessingStatus({
                current: 0,
                total: pupilIds.length,
                currentPupilName: 'Starting...'
            });

            // Call API endpoint for batch recapture
            const response = await fetch(`/api/ple/${pleRecord.id}/recapture-snapshots`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    pupilIds: pupilIds
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to recapture snapshots');
            }

            const result = await response.json();

            setBatchResults(result.results);

            const successCount = result.results.filter((r: BatchResult) => r.success).length;
            toast({
                title: 'Recapture Complete',
                description: `Successfully recaptured ${successCount} of ${result.totalProcessed} snapshots.`
            });

            // Call completion callback
            if (onRecaptureComplete) {
                onRecaptureComplete();
            }
        } catch (error) {
            console.error('Batch recapture error:', error);
            toast({
                variant: 'destructive',
                title: 'Recapture Failed',
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
                        <DialogTitle>Snapshot Recapture Results</DialogTitle>
                        <DialogDescription>
                            Summary of snapshot recapture operation for {pleRecord?.examName}
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
                                            <Check className="w-4 h-4 text-green-600" />
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
                                                <X className="w-4 h-4 text-red-600" />
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
                        <Camera className="w-5 h-5" />
                        Recapture Snapshots - {pleRecord?.examName}
                    </DialogTitle>
                    <DialogDescription>
                        Select pupils to recapture their current data into the PLE snapshot. This will update the snapshot with the pupil's current information from the system.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Pupil Selection */}
                    {pupils.length > 0 ? (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="block text-sm font-medium text-gray-700">
                                    Select Pupils ({selectedPupilIds.size} of {pupils.length} selected)
                                </label>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleToggleAll}
                                    disabled={isProcessing}
                                >
                                    {selectedPupilIds.size === pupils.length ? 'Deselect All' : 'Select All'}
                                </Button>
                            </div>

                            <div className="border border-gray-300 rounded-md max-h-96 overflow-y-auto">
                                {pupils.map((pupil) => (
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
                                                {pupil.firstName} {pupil.lastName} {pupil.otherNames || ''}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {pupil.admissionNumber} • {pupil.gender} • Class: {pupil.classId}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            <p>No pupils found in this PLE record.</p>
                        </div>
                    )}

                    {/* Processing Status */}
                    {isProcessing && processingStatus && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-center gap-3 mb-2">
                                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
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
                        className="bg-purple-600 hover:bg-purple-700"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <Camera className="w-4 h-4 mr-2" />
                                Recapture {selectedPupilIds.size} Snapshot{selectedPupilIds.size !== 1 ? 's' : ''}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
