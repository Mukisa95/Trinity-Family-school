import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    createPromotionBatch,
    getPromotionBatches,
    getPromotionBatchById,
    removePupilFromBatch,
    type CreatePromotionBatchData
} from '@/lib/services/promotion-batches.service';
import type { PromotionBatch } from '@/types';

const QUERY_KEY = 'promotionBatches';

/**
 * Hook to fetch recent promotion batches
 */
export function usePromotionBatches(limitCount: number = 10) {
    return useQuery<PromotionBatch[], Error>({
        queryKey: [QUERY_KEY, 'list', limitCount],
        queryFn: () => getPromotionBatches(limitCount),
    });
}

/**
 * Hook to fetch a specific promotion batch by ID
 */
export function usePromotionBatch(batchId: string) {
    return useQuery<PromotionBatch | null, Error>({
        queryKey: [QUERY_KEY, 'detail', batchId],
        queryFn: () => getPromotionBatchById(batchId),
        enabled: !!batchId, // Only run query if batchId is provided
    });
}

/**
 * Mutation hook to create a new promotion batch
 */
export function useCreatePromotionBatch() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreatePromotionBatchData) => createPromotionBatch(data),
        onSuccess: () => {
            // Invalidate and refetch promotion batches list
            queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'list'] });
        },
    });
}

/**
 * Mutation hook to remove a pupil from a batch
 */
export function useRemovePupilFromBatch() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ batchId, pupilId }: { batchId: string; pupilId: string }) =>
            removePupilFromBatch(batchId, pupilId),
        onSuccess: (batchDeleted, variables) => {
            // Invalidate batch detail query
            queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'detail', variables.batchId] });

            // If batch was deleted, also invalidate the list
            if (batchDeleted) {
                queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'list'] });
            }
        },
    });
}
