import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AcademicYearsService } from '../services/academic-years.service';
import { useDigitalSignatureHelpers } from './use-digital-signature';
import { useAuth } from '../contexts/auth-context';
import type { AcademicYear } from '@/types';

const ACADEMIC_YEARS_QUERY_KEY = 'academicYears';

export function useAcademicYears() {
  return useQuery({
    queryKey: [ACADEMIC_YEARS_QUERY_KEY],
    queryFn: AcademicYearsService.getAllAcademicYears,
  });
}

export function useAcademicYear(id: string) {
  return useQuery({
    queryKey: [ACADEMIC_YEARS_QUERY_KEY, id],
    queryFn: () => AcademicYearsService.getAcademicYearById(id),
    enabled: !!id,
  });
}

export function useActiveAcademicYear() {
  return useQuery({
    queryKey: [ACADEMIC_YEARS_QUERY_KEY, 'active'],
    queryFn: AcademicYearsService.getActiveAcademicYear,
  });
}

export function useCreateAcademicYear() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (yearData: Omit<AcademicYear, 'id'>) => {
      const yearId = await AcademicYearsService.createAcademicYear(yearData);
      
      // Create digital signature for academic year creation
      if (user) {
        await signAction(
          'academic_year_creation',
          yearId,
          'created',
          {
            yearName: yearData.name,
            startDate: yearData.startDate,
            endDate: yearData.endDate,
            termCount: yearData.terms?.length || 0,
            isActive: yearData.isActive,
            isLocked: yearData.isLocked
          }
        );
      }
      
      return yearId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACADEMIC_YEARS_QUERY_KEY] });
    },
  });
}

export function useUpdateAcademicYear() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Omit<AcademicYear, 'id'>> }) => {
      await AcademicYearsService.updateAcademicYear(id, data);
      
      // Create digital signature for academic year modification
      if (user) {
        await signAction(
          'academic_year_creation',
          id,
          'modified',
          {
            updatedFields: Object.keys(data),
            nameChanged: !!data.name,
            datesChanged: !!(data.startDate || data.endDate),
            termsChanged: !!data.terms,
            statusChanged: data.isActive !== undefined || data.isLocked !== undefined
          }
        );
      }
      
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACADEMIC_YEARS_QUERY_KEY] });
    },
  });
}

export function useDeleteAcademicYear() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => AcademicYearsService.deleteAcademicYear(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACADEMIC_YEARS_QUERY_KEY] });
    },
  });
}

export function useSetActiveAcademicYear() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => AcademicYearsService.setActiveAcademicYear(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACADEMIC_YEARS_QUERY_KEY] });
    },
  });
} 