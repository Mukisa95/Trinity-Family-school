import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FeeStructuresService } from '../services/fee-structures.service';
import type { FeeStructure, CreateFeeStructureData, UpdateFeeStructureData } from '@/types';

// Query Keys
export const feeStructureKeys = {
  all: ['feeStructures'] as const,
  lists: () => [...feeStructureKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...feeStructureKeys.lists(), { filters }] as const,
  details: () => [...feeStructureKeys.all, 'detail'] as const,
  detail: (id: string) => [...feeStructureKeys.details(), id] as const,
  byAcademicYear: (academicYearId: string) => [...feeStructureKeys.all, 'byAcademicYear', academicYearId] as const,
  byClass: (classId: string) => [...feeStructureKeys.all, 'byClass', classId] as const,
};

// Query Hooks
export function useFeeStructures() {
  return useQuery({
    queryKey: feeStructureKeys.lists(),
    queryFn: FeeStructuresService.getAllFeeStructures,
  });
}

export function useFeeStructure(id: string) {
  return useQuery({
    queryKey: feeStructureKeys.detail(id),
    queryFn: () => FeeStructuresService.getFeeStructureById(id),
    enabled: !!id,
  });
}

export function useFeeStructuresByAcademicYear(academicYearId: string) {
  return useQuery({
    queryKey: feeStructureKeys.byAcademicYear(academicYearId),
    queryFn: () => FeeStructuresService.getFeeStructuresByAcademicYear(academicYearId),
    enabled: !!academicYearId,
  });
}

export function useFeeStructuresByClass(classId: string) {
  return useQuery({
    queryKey: feeStructureKeys.byClass(classId),
    queryFn: () => FeeStructuresService.getFeeStructuresByClass(classId),
    enabled: !!classId,
  });
}

// Mutation Hooks
export function useCreateFeeStructure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: FeeStructuresService.createFeeStructure,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feeStructureKeys.all });
    },
  });
}

export function useCreateMultipleFeeStructures() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: FeeStructuresService.createMultipleFeeStructures,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feeStructureKeys.all });
    },
  });
}

export function useUpdateFeeStructure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFeeStructureData }) =>
      FeeStructuresService.updateFeeStructure(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: feeStructureKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: feeStructureKeys.lists() });
    },
  });
}

export function useDeleteFeeStructure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: FeeStructuresService.deleteFeeStructure,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feeStructureKeys.all });
    },
  });
} 