import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UniformInventoryService } from '../services/uniform-inventory.service';
import type {
    CreateUniformSizeConfigData,
    UpdateUniformStockData
} from '@/types';

const UNIFORM_INVENTORY_QUERY_KEY = 'uniformInventory';

/**
 * Hook to fetch all uniform inventory items
 */
export function useUniformInventory() {
    return useQuery({
        queryKey: [UNIFORM_INVENTORY_QUERY_KEY],
        queryFn: UniformInventoryService.getUniformInventory,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Hook to fetch a single uniform inventory item
 */
export function useUniformInventoryItem(uniformId: string) {
    return useQuery({
        queryKey: [UNIFORM_INVENTORY_QUERY_KEY, uniformId],
        queryFn: () => UniformInventoryService.getUniformInventoryItem(uniformId),
        enabled: !!uniformId,
    });
}

/**
 * Hook to fetch inventory summary
 */
export function useUniformInventorySummary() {
    return useQuery({
        queryKey: [UNIFORM_INVENTORY_QUERY_KEY, 'summary'],
        queryFn: UniformInventoryService.getInventorySummary,
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Hook to set/update sizes for a uniform item
 */
export function useSetUniformSizes() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            data,
            uniformPrice,
            uniformGender
        }: {
            data: CreateUniformSizeConfigData;
            uniformPrice: number;
            uniformGender: string;
        }) => UniformInventoryService.setSizesForUniform(data, uniformPrice, uniformGender),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [UNIFORM_INVENTORY_QUERY_KEY] });
        },
    });
}

/**
 * Hook to update stock for all sizes of a uniform item
 */
export function useUpdateUniformStock() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            data,
            uniformPrice
        }: {
            data: UpdateUniformStockData;
            uniformPrice: number;
        }) => UniformInventoryService.updateStock(data, uniformPrice),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [UNIFORM_INVENTORY_QUERY_KEY] });
        },
    });
}

/**
 * Hook to update stock for a single size
 */
export function useUpdateSizeStock() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            uniformId,
            size,
            quantity
        }: {
            uniformId: string;
            size: string;
            quantity: number;
        }) => UniformInventoryService.updateSizeStock(uniformId, size, quantity),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [UNIFORM_INVENTORY_QUERY_KEY] });
        },
    });
}

/**
 * Hook to delete a uniform inventory item
 */
export function useDeleteUniformInventory() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (uniformId: string) => UniformInventoryService.deleteUniformInventory(uniformId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [UNIFORM_INVENTORY_QUERY_KEY] });
        },
    });
}

/**
 * Hook to reduce stock for a specific size (used when uniform is collected)
 */
export function useReduceStock() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            uniformId,
            size,
            quantity = 1
        }: {
            uniformId: string;
            size: string;
            quantity?: number;
        }) => UniformInventoryService.reduceStock(uniformId, size, quantity),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [UNIFORM_INVENTORY_QUERY_KEY] });
        },
    });
}

/**
 * Hook to increment stock for a specific size (used for returns)
 */
export function useIncrementStock() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            uniformId,
            size,
            quantity = 1
        }: {
            uniformId: string;
            size: string;
            quantity?: number;
        }) => UniformInventoryService.incrementStock(uniformId, size, quantity),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [UNIFORM_INVENTORY_QUERY_KEY] });
        },
    });
}

/**
 * Hook to reduce stock for multiple items at once
 */
export function useReduceStockBatch() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (items: Array<{ uniformId: string; size: string; quantity?: number }>) =>
            UniformInventoryService.reduceStockBatch(items),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [UNIFORM_INVENTORY_QUERY_KEY] });
        },
    });
}

/**
 * Hook to increment stock for multiple items at once
 */
export function useIncrementStockBatch() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (items: Array<{ uniformId: string; size: string; quantity?: number }>) => UniformInventoryService.incrementStockBatch(items),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [UNIFORM_INVENTORY_QUERY_KEY] });
        },
    });
}
