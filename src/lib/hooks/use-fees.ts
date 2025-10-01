import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FeesService } from '../services/fees.service';
import type { FeeStructure, FeeAdjustmentEntry } from '@/types';

export const FEES_QUERY_KEYS = {
  all: ['fees'] as const,
  structures: () => [...FEES_QUERY_KEYS.all, 'structures'] as const,
  structure: (id: string) => [...FEES_QUERY_KEYS.structures(), id] as const,
  structuresByYear: (yearId: string) => [...FEES_QUERY_KEYS.structures(), 'year', yearId] as const,
  adjustments: () => [...FEES_QUERY_KEYS.all, 'adjustments'] as const,
  adjustmentsByStructure: (structureId: string) => [...FEES_QUERY_KEYS.adjustments(), 'structure', structureId] as const,
};

export function useFeeStructures() {
  return useQuery({
    queryKey: FEES_QUERY_KEYS.structures(),
    queryFn: FeesService.getAllFeeStructures,
    retry: (failureCount, error) => {
      // Don't retry if it's an offline error
      if (error?.message?.includes('offline') || (error as any)?.code === 'unavailable') {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useFeeStructureById(id: string) {
  return useQuery({
    queryKey: FEES_QUERY_KEYS.structure(id),
    queryFn: () => FeesService.getFeeStructureById(id),
    enabled: !!id,
  });
}

export function useFeeStructuresByAcademicYear(academicYearId: string) {
  return useQuery({
    queryKey: FEES_QUERY_KEYS.structuresByYear(academicYearId),
    queryFn: () => FeesService.getFeeStructuresByAcademicYear(academicYearId),
    enabled: !!academicYearId,
  });
}

export function useFeeAdjustments() {
  return useQuery({
    queryKey: FEES_QUERY_KEYS.adjustments(),
    queryFn: FeesService.getAllFeeAdjustments,
    retry: (failureCount, error) => {
      // Don't retry if it's an offline error
      if (error?.message?.includes('offline') || (error as any)?.code === 'unavailable') {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useFeeAdjustmentsByStructure(feeStructureId: string) {
  return useQuery({
    queryKey: FEES_QUERY_KEYS.adjustmentsByStructure(feeStructureId),
    queryFn: () => FeesService.getFeeAdjustmentsByStructure(feeStructureId),
    enabled: !!feeStructureId,
  });
}

export function useCreateFeeStructure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (feeData: Omit<FeeStructure, 'id' | 'createdAt' | 'status' | 'disableHistory'>) =>
      FeesService.createFeeStructure(feeData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FEES_QUERY_KEYS.structures() });
    },
  });
}

export function useUpdateFeeStructure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<FeeStructure, 'id' | 'createdAt'>> }) =>
      FeesService.updateFeeStructure(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: FEES_QUERY_KEYS.structures() });
      queryClient.invalidateQueries({ queryKey: FEES_QUERY_KEYS.structure(id) });
    },
  });
}

export function useDeleteFeeStructure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => FeesService.deleteFeeStructure(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FEES_QUERY_KEYS.structures() });
    },
  });
}

export function useCreateFeeAdjustment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (adjustmentData: Omit<FeeAdjustmentEntry, 'id' | 'createdAt'>) =>
      FeesService.createFeeAdjustment(adjustmentData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FEES_QUERY_KEYS.adjustments() });
    },
  });
} 