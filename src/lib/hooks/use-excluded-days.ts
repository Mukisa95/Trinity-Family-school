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
  const queryClient = useQueryClient();

  // 🚀 CRITICAL: Get cached data immediately to prevent loading state
  const cachedData = queryClient.getQueryData<ExcludedDay[]>(excludedDaysKeys.lists());

  return useQuery({
    queryKey: excludedDaysKeys.lists(),
    queryFn: async () => {
      // Check cache first
      const currentCachedData = queryClient.getQueryData<ExcludedDay[]>(excludedDaysKeys.lists());
      if (currentCachedData && currentCachedData.length > 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`⚡ useExcludedDays: Using ${currentCachedData.length} excluded days from cache`);
        }
        return currentCachedData;
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('📥 useExcludedDays: No cache, fetching from server...');
      }
      return ExcludedDaysService.getAllExcludedDays();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes cache - excluded days rarely change
    gcTime: 30 * 60 * 1000, // 30 minutes cache
    refetchOnMount: false, // Don't refetch when component mounts - use cache
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on reconnect
    // 🚀 CRITICAL: Use cached data as initialData to prevent loading state
    initialData: cachedData && cachedData.length > 0 ? cachedData : undefined,
    // 🚀 CRITICAL: Use cached data as placeholder to show immediately
    placeholderData: (previousData) => {
      // If we have cached data, use it immediately
      if (cachedData && cachedData.length > 0) {
        return cachedData;
      }
      // Otherwise use previous data if available
      return previousData;
    },
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