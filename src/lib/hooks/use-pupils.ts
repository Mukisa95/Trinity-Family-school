import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PupilsService } from '../services/pupils.service';
import type { Pupil } from '@/types';

// Query keys
export const pupilsKeys = {
  all: ['pupils'] as const,
  lists: () => [...pupilsKeys.all, 'list'] as const,
  list: (filters: string) => [...pupilsKeys.lists(), { filters }] as const,
  details: () => [...pupilsKeys.all, 'detail'] as const,
  detail: (id: string) => [...pupilsKeys.details(), id] as const,
  byClass: (classId: string) => [...pupilsKeys.all, 'byClass', classId] as const,
  byFamily: (familyId: string) => [...pupilsKeys.all, 'byFamily', familyId] as const,
  search: (term: string) => [...pupilsKeys.all, 'search', term] as const,
};

// Hooks
export function usePupils() {
  return useQuery({
    queryKey: pupilsKeys.lists(),
    queryFn: () => PupilsService.getAllPupils(),
  });
}

export function useActivePupils() {
  return useQuery({
    queryKey: [...pupilsKeys.lists(), 'active'],
    queryFn: () => PupilsService.getAllPupils().then(pupils => 
      pupils.filter(pupil => pupil.status === 'Active')
    ),
  });
}

// 🚀 OPTIMIZED: Only load pupils when explicitly needed
export function useActivePupilsOptimized(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...pupilsKeys.lists(), 'active', 'optimized'],
    queryFn: () => PupilsService.getAllPupils().then(pupils => 
      pupils.filter(pupil => pupil.status === 'Active')
    ),
    enabled: options?.enabled !== false,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: (failureCount, error) => {
      // Don't retry if it's an offline error
      if (error?.message?.includes('offline') || 
          error?.message?.includes('Could not reach Cloud Firestore') ||
          (error as any)?.code === 'unavailable') {
        console.log('🚫 Offline detected, not retrying pupils query');
        return false;
      }
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

export function usePupil(id: string) {
  return useQuery({
    queryKey: pupilsKeys.detail(id),
    queryFn: () => PupilsService.getPupilById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 🚀 OPTIMIZED: 5 minutes cache instead of always stale
    refetchOnWindowFocus: false, // 🚀 OPTIMIZED: Pupil data doesn't change frequently
    refetchOnMount: false, // 🚀 OPTIMIZED: Use cached data on mount
    refetchInterval: false, // 🚀 OPTIMIZED: No polling - pupil data is fairly static
  });
}

export function usePupilsByClass(classId: string) {
  return useQuery({
    queryKey: pupilsKeys.byClass(classId),
    queryFn: () => PupilsService.getPupilsByClass(classId),
    enabled: !!classId,
  });
}

export function usePupilsByFamily(familyId: string) {
  return useQuery({
    queryKey: pupilsKeys.byFamily(familyId),
    queryFn: () => PupilsService.getPupilsByFamily(familyId),
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000, // 🚀 OPTIMIZED: 5 minutes cache
    refetchOnWindowFocus: false, // 🚀 OPTIMIZED: Family data is fairly static
    refetchOnMount: false, // 🚀 OPTIMIZED: Use cached data
    refetchInterval: false, // 🚀 OPTIMIZED: No aggressive polling
  });
}

export function useSearchPupils(searchTerm: string) {
  return useQuery({
    queryKey: pupilsKeys.search(searchTerm),
    queryFn: () => PupilsService.searchPupils(searchTerm),
    enabled: !!searchTerm && searchTerm.length > 2,
  });
}

export function useCreatePupil() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pupilData: Omit<Pupil, 'id' | 'createdAt'>) => 
      PupilsService.createPupil(pupilData),
    onSuccess: () => {
      // Invalidate all pupil caches to ensure fresh data across sessions
      queryClient.invalidateQueries({ queryKey: pupilsKeys.all });
      // Force immediate refetch for better responsiveness
      queryClient.refetchQueries({ queryKey: pupilsKeys.all });
    },
  });
}

export function useUpdatePupil() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<Pupil, 'id' | 'createdAt'>> }) =>
      PupilsService.updatePupil(id, data),
    onSuccess: (_, { id }) => {
      // Invalidate all pupil caches to ensure fresh data across sessions
      queryClient.invalidateQueries({ queryKey: pupilsKeys.all });
      queryClient.invalidateQueries({ queryKey: pupilsKeys.detail(id) });
      // Force immediate refetch for better responsiveness
      queryClient.refetchQueries({ queryKey: pupilsKeys.all });
      queryClient.refetchQueries({ queryKey: pupilsKeys.detail(id) });
    },
  });
}

export function useDeletePupil() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => PupilsService.deletePupil(id),
    onSuccess: () => {
      // Invalidate all pupil caches to ensure fresh data across sessions
      queryClient.invalidateQueries({ queryKey: pupilsKeys.all });
      // Force immediate refetch for better responsiveness
      queryClient.refetchQueries({ queryKey: pupilsKeys.all });
    },
  });
}

// 🚀 NEW: Optimized hooks for database-level filtering
export function usePupilByAdmissionNumber(admissionNumber: string) {
  return useQuery({
    queryKey: [...pupilsKeys.all, 'byAdmissionNumber', admissionNumber],
    queryFn: () => PupilsService.getPupilByAdmissionNumber(admissionNumber),
    enabled: !!admissionNumber,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false, // Admission numbers don't change frequently
  });
}

export function usePupilsByIds(pupilIds: string[]) {
  return useQuery({
    queryKey: [...pupilsKeys.all, 'byIds', pupilIds.sort().join(',')],
    queryFn: () => PupilsService.getPupilsByIds(pupilIds),
    enabled: pupilIds.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes cache
    refetchOnWindowFocus: false,
  });
} 