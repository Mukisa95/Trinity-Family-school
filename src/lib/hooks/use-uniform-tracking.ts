"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UniformTrackingService,
  type UniformStockReduction,
} from '../services/uniform-tracking.service';
import { useDigitalSignatureHelpers } from './use-digital-signature';
import { useAuth } from '../contexts/auth-context';
import type {
  UniformTracking,
  CreateUniformTrackingData,
  UpdateUniformTrackingData,
  UniformInventoryItem,
} from '@/types';

const UNIFORM_TRACKING_QUERY_KEY = 'uniformTracking';

function mergeTrackingCacheValue(
  current: unknown,
  update: UniformTracking
): unknown {
  if (Array.isArray(current)) {
    return current.map(record =>
      record && typeof record === 'object' && 'id' in record && record.id === update.id
        ? { ...record, ...update }
        : record
    );
  }

  if (current && typeof current === 'object' && 'id' in current && current.id === update.id) {
    return { ...current, ...update };
  }

  return current;
}

function reduceCachedUniformInventory(
  current: UniformInventoryItem[] | undefined,
  reductions: UniformStockReduction[]
): UniformInventoryItem[] | undefined {
  if (!current || reductions.length === 0) return current;

  return current.map(inventory => {
    const matching = reductions.filter(item => item.uniformId === inventory.uniformId);
    if (matching.length === 0) return inventory;

    const updatedStock = inventory.stock.map(stockItem => {
      const reduction = matching
        .filter(item => item.size === stockItem.size)
        .reduce((sum, item) => sum + (item.quantity || 1), 0);
      return reduction > 0
        ? { ...stockItem, quantity: Math.max(0, stockItem.quantity - reduction) }
        : stockItem;
    });
    const totalStock = updatedStock.reduce((sum, item) => sum + item.quantity, 0);

    return {
      ...inventory,
      stock: updatedStock,
      totalStock,
      totalValue: totalStock * (inventory.uniformPrice || 0),
      updatedAt: new Date().toISOString(),
    };
  });
}

export function useUniformTrackingByPupil(pupilId: string) {
  return useQuery({
    queryKey: [UNIFORM_TRACKING_QUERY_KEY, 'pupil', pupilId],
    queryFn: () => UniformTrackingService.getTrackingRecordsByPupil(pupilId),
    enabled: !!pupilId,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    // At most one pupil-scoped refresh after the five-minute stale window.
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    placeholderData: previousData => previousData,
    // The service already falls back to Firestore's persistent cache.
    // Retrying quota exhaustion only produces repeated reads and console noise.
    retry: false,
  });
}

export function useUniformTrackingRecord(id: string) {
  return useQuery({
    queryKey: [UNIFORM_TRACKING_QUERY_KEY, id],
    queryFn: () => UniformTrackingService.getTrackingRecordById(id),
    enabled: !!id,
  });
}

export function useAllUniformTracking() {
  return useQuery({
    queryKey: [UNIFORM_TRACKING_QUERY_KEY, 'all'],
    queryFn: UniformTrackingService.getAllTrackingRecords,
  });
}

export function useUniformTrackingByUniform(uniformId: string) {
  return useQuery({
    queryKey: [UNIFORM_TRACKING_QUERY_KEY, 'uniform', uniformId],
    queryFn: () => UniformTrackingService.getTrackingRecordsByUniform(uniformId),
    enabled: !!uniformId,
  });
}

export function useCreateUniformTracking() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (data: CreateUniformTrackingData) => {
      const recordId = await UniformTrackingService.createTrackingRecord(data);
      const newRecord: UniformTracking = {
        id: recordId,
        ...data,
        createdAt: new Date().toISOString(),
      };
      
      // Create digital signature for uniform tracking creation
      if (user && newRecord) {
        try {
          await signAction(
            'uniform_payment',
            recordId,
            'created',
            {
              pupilId: data.pupilId,
              uniformId: data.uniformId,
              academicYearId: data.academicYearId,
              termId: data.termId,
              selectionMode: data.selectionMode,
              originalAmount: data.originalAmount,
              finalAmount: data.finalAmount,
              paymentStatus: data.paymentStatus
            }
          );
        } catch (error) {
          console.error('Uniform tracking created, but its digital signature failed:', error);
        }
      }
      
      return newRecord;
    },
    onSuccess: (newRecord) => {
      queryClient.setQueryData<UniformTracking[]>(
        [UNIFORM_TRACKING_QUERY_KEY, 'pupil', newRecord.pupilId],
        current => [newRecord, ...(current || []).filter(record => record.id !== newRecord.id)]
      );
      queryClient.setQueryData([UNIFORM_TRACKING_QUERY_KEY, newRecord.id], newRecord);
    },
  });
}

export function useUpdateUniformTracking() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({
      id,
      data,
      stockReductions,
    }: {
      id: string;
      data: UpdateUniformTrackingData;
      stockReductions?: UniformStockReduction[];
    }) => {
      let updatedRecord: UniformTracking | null;

      if (stockReductions?.length) {
        updatedRecord = await UniformTrackingService.updateTrackingRecordWithStock(
          id,
          data,
          stockReductions
        );
      } else {
        await UniformTrackingService.updateTrackingRecord(id, data);
        updatedRecord = { id, ...data } as UniformTracking;
      }
      
      // Create digital signature for uniform tracking update
      if (user) {
        // Filter out undefined values from metadata
        const metadata: Record<string, any> = {
          updatedFields: Object.keys(data),
          paymentStatusChanged: !!data.paymentStatus,
          collectionStatusChanged: !!data.collectionStatus,
          amountPaidChanged: !!data.paidAmount,
          itemsCollectedChanged: !!data.collectedItems,
        };

        // Only add these fields if they have values
        if (data.releasedBy) {
          metadata.releasedBy = data.releasedBy;
        }
        if (data.receivedBy) {
          metadata.receivedBy = data.receivedBy;
        }

        try {
          await signAction(
            'uniform_payment',
            id,
            'updated',
            metadata
          );
        } catch (error) {
          // Audit logging must not make a committed collection appear to have failed.
          console.error('Uniform tracking updated, but its digital signature failed:', error);
        }
      }
      
      return {
        updatedRecord,
        stockReductions: stockReductions || [],
      };
    },
    onSuccess: ({ updatedRecord, stockReductions }) => {
      if (updatedRecord) {
        queryClient.setQueriesData(
          { queryKey: [UNIFORM_TRACKING_QUERY_KEY] },
          current => mergeTrackingCacheValue(current, updatedRecord)
        );
        queryClient.setQueryData(
          [UNIFORM_TRACKING_QUERY_KEY, updatedRecord.id],
          current => current && typeof current === 'object'
            ? { ...current, ...updatedRecord }
            : updatedRecord
        );
      }
      if (stockReductions.length > 0) {
        queryClient.setQueryData<UniformInventoryItem[]>(
          ['uniformInventory'],
          current => reduceCachedUniformInventory(current, stockReductions)
        );
      }
    },
  });
}

export function useDeleteUniformTracking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => UniformTrackingService.deleteTrackingRecord(id),
    onSuccess: (_, id) => {
      queryClient.setQueriesData(
        { queryKey: [UNIFORM_TRACKING_QUERY_KEY] },
        current => Array.isArray(current)
          ? current.filter(record => record?.id !== id)
          : current
      );
      queryClient.removeQueries({ queryKey: [UNIFORM_TRACKING_QUERY_KEY, id], exact: true });
    },
  });
}
