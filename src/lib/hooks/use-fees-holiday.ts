import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FeesHolidayService } from '../services/fees-holiday.service';
import type { FeesHoliday } from '@/types';

// Query keys
export const feesHolidayKeys = {
  all: ['feesHolidays'] as const,
  lists: () => [...feesHolidayKeys.all, 'list'] as const,
  list: () => [...feesHolidayKeys.lists()] as const,
  details: () => [...feesHolidayKeys.all, 'detail'] as const,
  detail: (id: string) => [...feesHolidayKeys.details(), id] as const,
  byPupil: (pupilId: string) => [...feesHolidayKeys.all, 'pupil', pupilId] as const,
  activeByPupil: (pupilId: string) => [...feesHolidayKeys.all, 'pupil', pupilId, 'active'] as const,
};

/**
 * Hook to fetch all fees holidays
 */
export function useFeesHolidays() {
  return useQuery({
    queryKey: feesHolidayKeys.list(),
    queryFn: () => FeesHolidayService.getAllFeesHolidays(),
  });
}

/**
 * Hook to fetch fees holidays for a specific pupil
 */
export function useFeesHolidaysByPupil(pupilId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: feesHolidayKeys.byPupil(pupilId),
    queryFn: () => FeesHolidayService.getFeesHolidaysByPupil(pupilId),
    enabled: options?.enabled !== false && !!pupilId,
  });
}

/**
 * Hook to fetch active fees holidays for a specific pupil
 */
export function useActiveFeesHolidaysByPupil(pupilId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: feesHolidayKeys.activeByPupil(pupilId),
    queryFn: () => FeesHolidayService.getActiveFeesHolidaysByPupil(pupilId),
    enabled: options?.enabled !== false && !!pupilId,
  });
}

/**
 * Hook to fetch a single fees holiday by ID
 */
export function useFeesHoliday(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: feesHolidayKeys.detail(id),
    queryFn: () => FeesHolidayService.getFeesHolidayById(id),
    enabled: options?.enabled !== false && !!id,
  });
}

/**
 * Hook to create a fees holiday
 */
export function useCreateFeesHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<FeesHoliday, 'id' | 'createdAt' | 'updatedAt'>) =>
      FeesHolidayService.createFeesHoliday(data),
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: feesHolidayKeys.all });
      queryClient.invalidateQueries({ queryKey: feesHolidayKeys.byPupil(data.pupilId) });
      queryClient.invalidateQueries({ queryKey: feesHolidayKeys.activeByPupil(data.pupilId) });
    },
  });
}

/**
 * Hook to update a fees holiday
 */
export function useUpdateFeesHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<FeesHoliday, 'id' | 'createdAt' | 'updatedAt'>> }) =>
      FeesHolidayService.updateFeesHoliday(id, data),
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: feesHolidayKeys.all });
      queryClient.invalidateQueries({ queryKey: feesHolidayKeys.detail(variables.id) });
      // We need to get the pupilId from the existing data to invalidate pupil queries
      queryClient.invalidateQueries({ queryKey: feesHolidayKeys.all });
    },
  });
}

/**
 * Hook to delete a fees holiday
 */
export function useDeleteFeesHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => FeesHolidayService.deleteFeesHoliday(id),
    onSuccess: () => {
      // Invalidate all queries
      queryClient.invalidateQueries({ queryKey: feesHolidayKeys.all });
    },
  });
}

/**
 * Hook to disable a fees holiday
 */
export function useDisableFeesHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, disabledBy }: { id: string; disabledBy?: string }) =>
      FeesHolidayService.disableFeesHoliday(id, disabledBy),
    onSuccess: () => {
      // Invalidate all queries
      queryClient.invalidateQueries({ queryKey: feesHolidayKeys.all });
    },
  });
}

/**
 * Hook to enable a fees holiday
 */
export function useEnableFeesHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updatedBy }: { id: string; updatedBy?: string }) =>
      FeesHolidayService.enableFeesHoliday(id, updatedBy),
    onSuccess: () => {
      // Invalidate all queries
      queryClient.invalidateQueries({ queryKey: feesHolidayKeys.all });
    },
  });
}



























