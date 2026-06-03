import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RequirementsService } from '../services/requirements.service';
import { PupilSnapshotsService } from '@/lib/services/pupil-snapshots.service';
import type { RequirementItem, CreateRequirementData, UpdateRequirementData, RequirementGender, RequirementSection, Pupil, AcademicYear } from '@/types';
import { filterApplicableRequirements } from '@/lib/utils/requirements-data-integrity';

const REQUIREMENTS_QUERY_KEY = 'requirements';

export function useRequirements() {
  const queryClient = useQueryClient();
  
  // 🚀 CRITICAL: Get cached requirements data immediately to avoid loading state
  const cachedData = queryClient.getQueryData<RequirementItem[]>([REQUIREMENTS_QUERY_KEY]);
  
  // ⚡ Use preloaded data from GlobalDataPreloader
  return useQuery({
    queryKey: [REQUIREMENTS_QUERY_KEY],
    queryFn: async () => {
      // Check cache first (populated by GlobalDataPreloader)
      const currentCachedData = queryClient.getQueryData<RequirementItem[]>([REQUIREMENTS_QUERY_KEY]);
      if (currentCachedData && currentCachedData.length > 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log('⚡ REQUIREMENTS: Loaded from cache (instant)');
        }
        return currentCachedData;
      }
      
      // Fallback to service if cache empty
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 REQUIREMENTS: Fetching from service...');
      }
      return RequirementsService.getAllRequirements();
    },
    staleTime: Infinity, // Never stale - updated by real-time listener
    gcTime: Infinity, // Keep in cache forever
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

export function useActiveRequirements() {
  return useQuery({
    queryKey: [REQUIREMENTS_QUERY_KEY, 'active'],
    queryFn: RequirementsService.getActiveRequirements,
    staleTime: 5 * 60 * 1000, // 5 minutes - prevent constant refetching
    refetchOnWindowFocus: false, // Disable aggressive refetching
    refetchOnMount: false, // Use cache when available
    refetchInterval: false, // Disable polling - only refetch on mutations
  });
}

export function useRequirementsByFilter(filters: {
  gender?: RequirementGender;
  classId?: string;
  section?: RequirementSection;
}, enabled: boolean = true) {
  const queryClient = useQueryClient();
  
  // 🚀 CRITICAL: Get cached requirements data immediately to filter from cache
  const cachedRequirements = queryClient.getQueryData<RequirementItem[]>([REQUIREMENTS_QUERY_KEY]);
  
  return useQuery({
    queryKey: [REQUIREMENTS_QUERY_KEY, 'filtered', filters],
    queryFn: async () => {
      // 🚀 CRITICAL: If we have cached requirements, filter from cache (instant!)
      if (cachedRequirements && cachedRequirements.length > 0) {
        // Filter requirements based on the provided filters
        let filtered = cachedRequirements;
        
        if (filters.gender && filters.gender !== 'all') {
          filtered = filtered.filter(req => 
            !req.gender || req.gender === filters.gender || req.gender === 'all'
          );
        }
        
        if (filters.classId) {
          filtered = filtered.filter(req => 
            !req.classId || req.classId === filters.classId || req.classId === 'all'
          );
        }
        
        if (filters.section) {
          filtered = filtered.filter(req => 
            !req.section || req.section === filters.section || req.section === 'all'
          );
        }
        
        if (filtered.length > 0) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`⚡ useRequirementsByFilter: Using ${filtered.length} requirements from cache (instant!)`);
          }
          return filtered;
        }
      }
      
      // Fallback to service if cache doesn't have data or filtering fails
      if (process.env.NODE_ENV === 'development') {
        console.log('📥 useRequirementsByFilter: No cache, fetching from server...');
      }
      return RequirementsService.getRequirementsByFilter(filters);
    },
    enabled: enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes cache
    gcTime: 30 * 60 * 1000, // 30 minutes cache
    refetchOnMount: false, // Don't refetch when component mounts - use cache
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on reconnect
    refetchInterval: false, // Disable polling - only refetch on mutations
    // 🚀 CRITICAL: Use cached data as initialData to prevent loading state
    initialData: () => {
      if (cachedRequirements && cachedRequirements.length > 0) {
        // Filter requirements based on the provided filters
        let filtered = cachedRequirements;
        
        if (filters.gender && filters.gender !== 'all') {
          filtered = filtered.filter(req => 
            !req.gender || req.gender === filters.gender || req.gender === 'all'
          );
        }
        
        if (filters.classId) {
          filtered = filtered.filter(req => 
            !req.classId || req.classId === filters.classId || req.classId === 'all'
          );
        }
        
        if (filters.section) {
          filtered = filtered.filter(req => 
            !req.section || req.section === filters.section || req.section === 'all'
          );
        }
        
        return filtered.length > 0 ? filtered : undefined;
      }
      return undefined;
    },
    // 🚀 CRITICAL: Use cached data as placeholder to show immediately
    placeholderData: (previousData) => {
      // If we have cached requirements, filter and use them immediately
      if (cachedRequirements && cachedRequirements.length > 0) {
        let filtered = cachedRequirements;
        
        if (filters.gender && filters.gender !== 'all') {
          filtered = filtered.filter(req => 
            !req.gender || req.gender === filters.gender || req.gender === 'all'
          );
        }
        
        if (filters.classId) {
          filtered = filtered.filter(req => 
            !req.classId || req.classId === filters.classId || req.classId === 'all'
          );
        }
        
        if (filters.section) {
          filtered = filtered.filter(req => 
            !req.section || req.section === filters.section || req.section === 'all'
          );
        }
        
        if (filtered.length > 0) {
          return filtered;
        }
      }
      // Otherwise use previous data if available
      return previousData;
    },
  });
}

export function useRequirement(id: string) {
  return useQuery({
    queryKey: [REQUIREMENTS_QUERY_KEY, id],
    queryFn: () => RequirementsService.getRequirementById(id),
    enabled: !!id,
  });
}

export function useCreateRequirement() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (requirementData: CreateRequirementData) =>
      RequirementsService.createRequirement(requirementData),
    onSuccess: () => {
      // Invalidate all requirements caches to ensure fresh data across sessions
      queryClient.invalidateQueries({ queryKey: [REQUIREMENTS_QUERY_KEY] });
      // Force immediate refetch for better responsiveness
      queryClient.refetchQueries({ queryKey: [REQUIREMENTS_QUERY_KEY] });
    },
  });
}

export function useUpdateRequirement() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRequirementData }) =>
      RequirementsService.updateRequirement(id, data),
    onSuccess: () => {
      // Invalidate all requirements caches to ensure fresh data across sessions
      queryClient.invalidateQueries({ queryKey: [REQUIREMENTS_QUERY_KEY] });
      // Force immediate refetch for better responsiveness
      queryClient.refetchQueries({ queryKey: [REQUIREMENTS_QUERY_KEY] });
    },
  });
}

export function useDeleteRequirement() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => RequirementsService.deleteRequirement(id),
    onSuccess: () => {
      // Invalidate all requirements caches to ensure fresh data across sessions
      queryClient.invalidateQueries({ queryKey: [REQUIREMENTS_QUERY_KEY] });
      // Force immediate refetch for better responsiveness
      queryClient.refetchQueries({ queryKey: [REQUIREMENTS_QUERY_KEY] });
    },
  });
}

export function useToggleRequirementStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      RequirementsService.toggleRequirementStatus(id, isActive),
    onSuccess: () => {
      // Invalidate all requirements caches to ensure fresh data across sessions
      queryClient.invalidateQueries({ queryKey: [REQUIREMENTS_QUERY_KEY] });
      // Force immediate refetch for better responsiveness
      queryClient.refetchQueries({ queryKey: [REQUIREMENTS_QUERY_KEY] });
    },
  });
}

// Enhanced requirements hook with data integrity using pupil snapshots
export function useEnhancedRequirementsByFilter(
  pupil: Pupil | null,
  termId: string,
  academicYear: AcademicYear | null,
  allAcademicYears: AcademicYear[] = []
) {
  return useQuery({
    queryKey: ['enhancedRequirements', 'pupil', pupil?.id, 'term', termId, academicYear?.id],
    queryFn: async () => {
      if (!pupil || !academicYear) {
        return [];
      }
      
      // 🔥 CRITICAL: Get historical pupil snapshot for the selected term (same as fees collection)
      // This ensures requirements are filtered using the pupil's class/section as it was during that term
      let historicalPupil: Pupil;
      
      try {
        if (process.env.NODE_ENV === 'development') {
          console.log('📸 Fetching historical snapshot for requirements filtering:', {
            pupilId: pupil.id,
            termId,
            academicYear: academicYear.name
          });
        }
        
        // Get or create snapshot for this term
        const snapshot = await PupilSnapshotsService.getOrCreateSnapshot(
          pupil,
          termId,
          academicYear
        );
        
        // Create virtual pupil with historical data
        historicalPupil = PupilSnapshotsService.createVirtualPupilFromSnapshot(pupil, snapshot);
        
        if (process.env.NODE_ENV === 'development') {
          console.log('📸 Historical pupil created for requirements:', {
            isRealSnapshot: !snapshot.id.startsWith('virtual-'),
            snapshotId: snapshot.id,
            currentClass: pupil.classId,
            historicalClass: historicalPupil.classId,
            currentSection: pupil.section,
            historicalSection: historicalPupil.section
          });
        }
      } catch (error) {
        console.error('❌ Error fetching historical pupil snapshot for requirements:', error);
        // Fallback to current pupil if snapshot fails
        historicalPupil = pupil;
      }
      
      // Get all requirements first
      const allRequirements = await RequirementsService.getAllRequirements();
      
      // Apply enhanced filtering with historical pupil data integrity
      return filterApplicableRequirements(
        allRequirements,
        historicalPupil, // Use historical pupil instead of current pupil
        termId,
        academicYear,
        allAcademicYears
      );
    },
    enabled: !!pupil && !!academicYear && !!termId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
} 