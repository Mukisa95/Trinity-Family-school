import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RequirementsService } from '../services/requirements.service';
import type { RequirementItem, CreateRequirementData, UpdateRequirementData, RequirementGender, RequirementSection, Pupil, AcademicYear } from '@/types';
import { filterApplicableRequirements } from '@/lib/utils/requirements-data-integrity';

const REQUIREMENTS_QUERY_KEY = 'requirements';

export function useRequirements() {
  return useQuery({
    queryKey: [REQUIREMENTS_QUERY_KEY],
    queryFn: RequirementsService.getAllRequirements,
    staleTime: 0, // Always consider requirements potentially stale for parent accounts
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: 120 * 1000, // Poll every 2 minutes for requirements (less frequent than tracking)
  });
}

export function useActiveRequirements() {
  return useQuery({
    queryKey: [REQUIREMENTS_QUERY_KEY, 'active'],
    queryFn: RequirementsService.getActiveRequirements,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: 120 * 1000,
  });
}

export function useRequirementsByFilter(filters: {
  gender?: RequirementGender;
  classId?: string;
  section?: RequirementSection;
}, enabled: boolean = true) {
  return useQuery({
    queryKey: [REQUIREMENTS_QUERY_KEY, 'filtered', filters],
    queryFn: () => RequirementsService.getRequirementsByFilter(filters),
    enabled: enabled,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: 120 * 1000,
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

// Enhanced requirements hook with data integrity
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
      
      // Get all requirements first
      const allRequirements = await RequirementsService.getAllRequirements();
      
      // Apply enhanced filtering with data integrity
      return filterApplicableRequirements(
        allRequirements,
        pupil,
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