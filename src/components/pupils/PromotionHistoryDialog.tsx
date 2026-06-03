"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
    TrendingUp,
    TrendingDown,
    ArrowRight,
    GraduationCap,
    Loader2,
    Users,
    Calendar,
    ArrowRightLeft
} from "lucide-react";
import { usePromotionBatches } from "@/lib/hooks/use-promotion-batches";
import type { PromotionBatchType } from "@/types";

interface PromotionHistoryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const typeConfig: Record<PromotionBatchType, {
    icon: React.ElementType;
    color: string;
    bgColor: string;
    label: string;
}> = {
    Promotion: {
        icon: TrendingUp,
        color: "text-green-700",
        bgColor: "bg-green-100",
        label: "Promotion"
    },
    Demotion: {
        icon: TrendingDown,
        color: "text-red-700",
        bgColor: "bg-red-100",
        label: "Demotion"
    },
    Transfer: {
        icon: ArrowRight,
        color: "text-blue-700",
        bgColor: "bg-blue-100",
        label: "Transfer"
    },
    Graduation: {
        icon: GraduationCap,
        color: "text-purple-700",
        bgColor: "bg-purple-100",
        label: "Graduation"
    }
};

export function PromotionHistoryDialog({ open, onOpenChange }: PromotionHistoryDialogProps) {
    const router = useRouter();
    const { data: batches, isLoading, error } = usePromotionBatches(10);

    const handleBatchClick = (batchId: string) => {
        onOpenChange(false);
        router.push(`/pupils/promotion-history/${batchId}`);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center">
                        <ArrowRightLeft className="mr-2 h-5 w-5" />
                        Promotions History
                    </DialogTitle>
                    <DialogDescription>
                        View the 10 most recent promotion batches. Click on any batch to see details.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[500px] pr-4">
                    {isLoading && (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            <span className="ml-2 text-sm text-muted-foreground">Loading history...</span>
                        </div>
                    )}

                    {error && (
                        <div className="py-8 text-center">
                            <p className="text-sm text-destructive">Failed to load promotion history</p>
                            <p className="text-xs text-muted-foreground mt-1">{error.message}</p>
                        </div>
                    )}

                    {!isLoading && !error && batches && batches.length === 0 && (
                        <div className="py-8 text-center">
                            <p className="text-sm text-muted-foreground">No promotion history found</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Promotions will appear here after pupils are promoted
                            </p>
                        </div>
                    )}

                    {!isLoading && !error && batches && batches.length > 0 && (
                        <div className="space-y-2">
                            {batches.map((batch) => {
                                const config = typeConfig[batch.type];
                                const Icon = config.icon;

                                return (
                                    <Button
                                        key={batch.id}
                                        variant="outline"
                                        className="w-full h-auto p-4 flex flex-col items-start hover:bg-accent"
                                        onClick={() => handleBatchClick(batch.id)}
                                    >
                                        <div className="w-full flex items-start justify-between">
                                            <div className="flex items-start space-x-3">
                                                <div className={`${config.bgColor} p-2 rounded-lg`}>
                                                    <Icon className={`h-4 w-4 ${config.color}`} />
                                                </div>
                                                <div className="text-left space-y-1">
                                                    <div className="flex items-center space-x-2">
                                                        <Badge variant="secondary" className="font-medium">
                                                            {config.label}
                                                        </Badge>
                                                        {batch.graduationYear && (
                                                            <span className="text-xs text-muted-foreground">
                                                                Class of {batch.graduationYear}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm font-medium">
                                                        {batch.fromClassName}
                                                        {batch.toClassName && (
                                                            <>
                                                                {" → "}
                                                                {batch.toClassName}
                                                            </>
                                                        )}
                                                    </p>
                                                    <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                                                        <div className="flex items-center">
                                                            <Calendar className="mr-1 h-3 w-3" />
                                                            {format(new Date(batch.createdAt), 'MMM dd, yyyy')}
                                                        </div>
                                                        <div className="flex items-center">
                                                            <Users className="mr-1 h-3 w-3" />
                                                            {batch.pupilCount} {batch.pupilCount === 1 ? 'pupil' : 'pupils'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Button>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
