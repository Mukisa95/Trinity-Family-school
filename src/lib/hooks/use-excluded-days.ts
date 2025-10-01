import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ExcludedDaysService } from '../services/excluded-days.service';
import type { ExcludedDay } from '@/types';

// Query Keys
export const excludedDaysKeys = {
  all: ['excludedDays'] as const,
  lists: () => [...excludedDaysKeys.all, 'list'] as const,
  details: () => [...excludedDaysKeys.all, 'detail'] as const,
  detail: (id: string) => [...excludedDaysKeys.details(), id] as const,
};

// Query Hooks
export function useExcludedDays() {
  return useQuery({
    queryKey: excludedDaysKeys.lists(),
    queryFn: ExcludedDaysService.getAllExcludedDays,
  });
}

export function useExcludedDay(id: string) {
  return useQuery({
    queryKey: excludedDaysKeys.detail(id),
    queryFn: () => ExcludedDaysService.getExcludedDayById(id),
    enabled: !!id,
  });
}

// Mutation Hooks
export function useCreateExcludedDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ExcludedDaysService.createExcludedDay,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: excludedDaysKeys.all });
    },
  });
}

export function useUpdateExcludedDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<ExcludedDay, 'id' | 'createdAt'>> }) =>
      ExcludedDaysService.updateExcludedDay(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: excludedDaysKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: excludedDaysKeys.lists() });
    },
  });
}

export function useDeleteExcludedDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ExcludedDaysService.deleteExcludedDay,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: excludedDaysKeys.all });
    },
  });
} 