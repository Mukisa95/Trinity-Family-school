import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FeesService } from '../services/fees.service';
import type { FeeStructure, FeeAdjustmentEntry } from '@/types';

export const FEES_QUERY_KEYS = {
  all: ['fees'] as const,
  // Version the shared key once so clients that cached an unconfirmed empty
  // catalogue cannot carry it into the server-confirmed collection path.
  structures: () => [...FEES_QUERY_KEYS.all, 'structures', 'server-confirmed-v1'] as const,
  structure: (id: string) => [...FEES_QUERY_KEYS.structures(), id] as const,
  structuresByYear: (yearId: string) => [...FEES_QUERY_KEYS.structures(), 'year', yearId] as const,
  adjustments: () => [...FEES_QUERY_KEYS.all, 'adjustments'] as const,
  adjustmentsByStructure: (structureId: string) => [...FEES_QUERY_KEYS.adjustments(), 'structure', structureId] as const,
};

export function useFeeStructures() {
  const queryClient = useQueryClient();
  
  // ⚡ Use preloaded data from GlobalDataPreloader
  return useQuery({
    queryKey: FEES_QUERY_KEYS.structures(),
    // initialData below provides the preloaded snapshot. A query run caused by
    // an explicit invalidation must read the authoritative collection instead
    // of returning that same stale snapshot again.
    queryFn: FeesService.getAllFeeStructures,
    staleTime: Infinity,
    gcTime: Infinity, // Keep in cache forever
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    // A failed read may recover when connectivity returns; a successful
    // catalogue remains fresh and never incurs a reconnect read.
    refetchOnReconnect: query => query.state.status === 'error',
    placeholderData: (previousData) => previousData,
    initialData: () => {
      const cached = queryClient.getQueryData(FEES_QUERY_KEYS.structures());
      return cached as Awaited<ReturnType<typeof FeesService.getAllFeeStructures>> | undefined;
    },
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
