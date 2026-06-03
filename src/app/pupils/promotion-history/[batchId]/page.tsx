"use client";
import { SmartBackButton } from "@/components/common/SmartBackButton";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    ArrowLeft,
    TrendingUp,
    TrendingDown,
    ArrowRight,
    GraduationCap,
    Loader2,
    Users,
    Calendar,
    Search,
    Undo2
} from "lucide-react";
import { usePromotionBatch, useRemovePupilFromBatch } from "@/lib/hooks/use-promotion-batches";
import { usePupils, useUpdatePupil } from "@/lib/hooks/use-pupils";
import { useToast } from "@/hooks/use-toast";
import type { PromotionBatchType, Pupil } from "@/types";

const typeConfig: Record<PromotionBatchType, {
    icon: React.ElementType;
    color: string;
    bgColor: string;
    label: string;
}> = {
    Promotion: {
        icon: TrendingUp,
        color: "text-green-700",
        bgColor: "bg-green-50",
        label: "Promotion"
    },
    Demotion: {
        icon: TrendingDown,
        color: "text-red-700",
        bgColor: "bg-red-50",
        label: "Demotion"
    },
    Transfer: {
        icon: ArrowRight,
        color: "text-blue-700",
        bgColor: "bg-blue-50",
        label: "Transfer"
    },
    Graduation: {
        icon: GraduationCap,
        color: "text-purple-700",
        bgColor: "bg-purple-50",
        label: "Graduation"
    }
};

export default function PromotionBatchDetailPage() {
    const params = useParams();
    const router = useRouter();
    const batchId = params?.batchId as string;
    const { toast } = useToast();

    const { data: batch, isLoading: batchLoading, error: batchError } = usePromotionBatch(batchId);
    const { data: allPupils, isLoading: pupilsLoading } = usePupils();
    const updatePupilMutation = useUpdatePupil();
    const removePupilMutation = useRemovePupilFromBatch();

    const [searchTerm, setSearchTerm] = React.useState("");
    const [undoDialogOpen, setUndoDialogOpen] = React.useState(false);
    const [selectedPupilForUndo, setSelectedPupilForUndo] = React.useState<Pupil | null>(null);

    // Get pupils in this batch
    const batchPupils = React.useMemo(() => {
        if (!batch || !allPupils) return [];

        return allPupils.filter(pupil => batch.pupilIds.includes(pupil.id));
    }, [batch, allPupils]);

    // Filter pupils by search term
    const filteredPupils = React.useMemo(() => {
        if (!searchTerm) return batchPupils;

        const term = searchTerm.toLowerCase();
        return batchPupils.filter(pupil =>
            pupil.firstName.toLowerCase().includes(term) ||
            pupil.lastName.toLowerCase().includes(term) ||
            pupil.admissionNumber.toLowerCase().includes(term)
        );
    }, [batchPupils, searchTerm]);

    const handleUndoClick = (pupil: Pupil) => {
        setSelectedPupilForUndo(pupil);
        setUndoDialogOpen(true);
    };

    const handleUndoConfirm = async () => {
        if (!selectedPupilForUndo || !batch) return;

        try {
            // Add undo entry to promotion history
            const undoHistoryEntry = {
                date: new Date().toISOString(),
                fromClassId: selectedPupilForUndo.classId,
                fromClassName: selectedPupilForUndo.className,
                toClassId: batch.fromClassId,
                toClassName: batch.fromClassName,
                type: 'Transfer' as const,
                notes: `Undone ${batch.type.toLowerCase()} - Reverted from ${selectedPupilForUndo.className} back to ${batch.fromClassName}`,
                processedBy: "System Admin",
            };

            // Update the pupil's class
            const { id, createdAt, ...updateData } = selectedPupilForUndo;
            await updatePupilMutation.mutateAsync({
                id: selectedPupilForUndo.id,
                data: {
                    ...updateData,
                    classId: batch.fromClassId,
                    className: batch.fromClassName,
                    promotionHistory: [...(selectedPupilForUndo.promotionHistory || []), undoHistoryEntry],
                }
            });

            // Remove pupil from the batch (this may delete the batch if it's the last pupil)
            const batchDeleted = await removePupilMutation.mutateAsync({
                batchId: batch.id,
                pupilId: selectedPupilForUndo.id,
            });

            toast({
                title: "Promotion Undone",
                description: `${selectedPupilForUndo.firstName} ${selectedPupilForUndo.lastName} has been moved back to ${batch.fromClassName}.`,
            });

            setUndoDialogOpen(false);
            setSelectedPupilForUndo(null);

            // If batch was deleted, redirect to promote page
            if (batchDeleted) {
                toast({
                    title: "Batch Deleted",
                    description: "This was the last pupil in the batch. Redirecting...",
                });
                setTimeout(() => {
                    router.push('/pupils/promote');
                }, 1500);
            }
        } catch (error) {
            console.error('Error undoing promotion:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to undo promotion. Please try again.",
            });
        }
    };

    if (batchLoading || pupilsLoading) {
        return (
            <div className="p-4 sm:p-6 space-y-6">
                <PageHeader title="Promotion Batch Details" />
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="ml-2">Loading batch details...</span>
                </div>
            </div>
        );
    }

    if (batchError || !batch) {
        return (
            <div className="p-4 sm:p-6 space-y-6">
                <PageHeader title="Promotion Batch Details" />
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center">
                            <p className="text-destructive font-medium">Failed to load batch details</p>
                            <p className="text-sm text-muted-foreground mt-2">
                                {batchError?.message || "Batch not found"}
                            </p>
                            <SmartBackButton fallbackHref="/pupils/promote" className="mt-4">
  <ArrowLeft className="mr-2 h-4 w-4" />
  Back to Promote Page
</SmartBackButton>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const config = typeConfig[batch.type];
    const Icon = config.icon;

    return (
        <div className="p-4 sm:p-6 space-y-6">
            <div className="flex items-center justify-between">
                <PageHeader
                    title="Promotion Batch Details"
                    description={`View all pupils in this ${batch.type.toLowerCase()} batch`}
                />
                <SmartBackButton fallbackHref="/pupils/promote" className="mr-2 h-4 w-4">
  <ArrowLeft className="mr-2 h-4 w-4" />
  Back to Promote
</SmartBackButton>
            </div>

            {/* Batch Summary Card */}
            <Card className={config.bgColor}>
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <Icon className={`mr-2 h-5 w-5 ${config.color}`} />
                        {config.label} Batch
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <p className="text-sm text-muted-foreground">Date</p>
                            <p className="font-medium flex items-center mt-1">
                                <Calendar className="mr-1 h-4 w-4" />
                                {format(new Date(batch.createdAt), 'MMMM dd, yyyy')}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">From Class</p>
                            <p className="font-medium mt-1">{batch.fromClassName}</p>
                        </div>
                        {batch.toClassName && (
                            <div>
                                <p className="text-sm text-muted-foreground">To Class</p>
                                <p className="font-medium mt-1">{batch.toClassName}</p>
                            </div>
                        )}
                        <div>
                            <p className="text-sm text-muted-foreground">Total Pupils</p>
                            <p className="font-medium flex items-center mt-1">
                                <Users className="mr-1 h-4 w-4" />
                                {batch.pupilCount}
                            </p>
                        </div>
                        {batch.graduationYear && (
                            <div>
                                <p className="text-sm text-muted-foreground">Graduation Year</p>
                                <p className="font-medium mt-1">Class of {batch.graduationYear}</p>
                            </div>
                        )}
                        {batch.processedBy && (
                            <div>
                                <p className="text-sm text-muted-foreground">Processed By</p>
                                <p className="font-medium mt-1">{batch.processedBy}</p>
                            </div>
                        )}
                    </div>
                    {batch.notes && (
                        <div className="mt-4 pt-4 border-t">
                            <p className="text-sm text-muted-foreground">Notes</p>
                            <p className="text-sm mt-1">{batch.notes}</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Pupils List Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Pupils in this Batch ({filteredPupils.length})</CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search pupils..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {filteredPupils.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            {searchTerm ? 'No pupils found matching your search' : 'No pupils found in this batch'}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Admission No.</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Gender</TableHead>
                                    <TableHead>Current Class</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredPupils.map((pupil) => (
                                    <TableRow key={pupil.id}>
                                        <TableCell className="font-medium">{pupil.admissionNumber}</TableCell>
                                        <TableCell>
                                            {pupil.firstName} {pupil.lastName}
                                        </TableCell>
                                        <TableCell>{pupil.gender || 'N/A'}</TableCell>
                                        <TableCell>{pupil.className || 'N/A'}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={pupil.status === 'Active' ? 'default' : 'secondary'}
                                            >
                                                {pupil.status || 'N/A'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleUndoClick(pupil)}
                                                disabled={updatePupilMutation.isPending}
                                            >
                                                <Undo2 className="h-4 w-4 mr-1" />
                                                Undo
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Undo Confirmation Dialog */}
            <AlertDialog open={undoDialogOpen} onOpenChange={setUndoDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Undo {batch.type}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to undo the {batch.type.toLowerCase()} for{" "}
                            <strong>
                                {selectedPupilForUndo?.firstName} {selectedPupilForUndo?.lastName}
                            </strong>?
                            <br />
                            <br />
                            This will move them from <strong>{selectedPupilForUndo?.className}</strong> back to{" "}
                            <strong>{batch.fromClassName}</strong>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleUndoConfirm}
                            disabled={updatePupilMutation.isPending}
                        >
                            {updatePupilMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Undoing...
                                </>
                            ) : (
                                'Confirm Undo'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
