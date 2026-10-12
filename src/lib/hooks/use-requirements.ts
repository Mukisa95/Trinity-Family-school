import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RequirementsService } from '../services/requirements.service';
import { PupilSnapshotsService } from '@/lib/services/pupil-snapshots.service';
import type { RequirementItem, CreateRequirementData, UpdateRequirementData, RequirementGender, RequirementSection, Pupil, AcademicYear } from '@/types';
import { useSchoolCatalogue } from './use-school-catalogue';
import { readRequirementsCatalogue } from '@/lib/cache/school-catalogue-queries';
import { filterSchoolCatalogue } from '@/lib/selectors/school-catalogue-selectors';
import { filterApplicableRequirements } from '@/lib/utils/requirements-data-integrity';

const REQUIREMENTS_QUERY_KEY = 'requirements';

export function useRequirements() {
  return useSchoolCatalogue<RequirementItem>('requirements', readRequirementsCatalogue);
}

export function useActiveRequirements() {
  const query = useRequirements();
  return { ...query, data: query.data?.filter(item => item.isActive) };
}

export function useRequirementsByFilter(filters: {
  gender?: RequirementGender; classId?: string; section?: RequirementSection;
}, enabled = true) {
  const query = useSchoolCatalogue<RequirementItem>('requirements', readRequirementsCatalogue, enabled);
  return { ...query, data: query.data === undefined ? undefined : filterSchoolCatalogue(query.data, filters) };
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
    mutationKey: ["requirements","create"],
    mutationFn: (requirementData: CreateRequirementData) =>
      RequirementsService.createRequirement(requirementData),
    onSuccess: () => {
      // Invalidate all requirements caches to ensure fresh data across sessions
      queryClient.invalidateQueries({ queryKey: [REQUIREMENTS_QUERY_KEY] });
    },
  });
}

export function useUpdateRequirement() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationKey: ["requirements","update"],
    mutationFn: ({ id, data }: { id: string; data: UpdateRequirementData }) =>
      RequirementsService.updateRequirement(id, data),
    onSuccess: () => {
      // Invalidate all requirements caches to ensure fresh data across sessions
      queryClient.invalidateQueries({ queryKey: [REQUIREMENTS_QUERY_KEY] });
    },
  });
}

export function useDeleteRequirement() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationKey: ["requirements","delete"],
    mutationFn: (id: string) => RequirementsService.deleteRequirement(id),
    onSuccess: () => {
      // Invalidate all requirements caches to ensure fresh data across sessions
      queryClient.invalidateQueries({ queryKey: [REQUIREMENTS_QUERY_KEY] });
    },
  });
}

export function useToggleRequirementStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationKey: ["requirements","toggle-status"],
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      RequirementsService.toggleRequirementStatus(id, isActive),
    onSuccess: () => {
      // Invalidate all requirements caches to ensure fresh data across sessions
      queryClient.invalidateQueries({ queryKey: [REQUIREMENTS_QUERY_KEY] });
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
        
        // Resolve a snapshot without creating data during a read-only screen.
        const snapshot = await PupilSnapshotsService.getSnapshotForRead(
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
