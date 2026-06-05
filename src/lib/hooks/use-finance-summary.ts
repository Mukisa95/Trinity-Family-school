import { useQuery, type QueryClient } from '@tanstack/react-query';
import { FinanceCalculationService } from '@/lib/services/finance-calculation.service';
import type { AcademicYear, Pupil } from '@/types';

export const financeSummaryKeys = {
  all: [FinanceCalculationService.financeQueryKey] as const,
  pupil: (pupilId: string, academicYearId?: string, termId?: string) =>
    [...financeSummaryKeys.all, 'pupil', pupilId, academicYearId || 'all-years', termId || 'all-terms'] as const,
  family: (familyId: string, academicYearId?: string, termId?: string) =>
    [...financeSummaryKeys.all, 'family', familyId, academicYearId || 'all-years', termId || 'all-terms'] as const,
};

export function invalidateFinanceSummaryQueries(queryClient: QueryClient, pupilId?: string, familyId?: string) {
  queryClient.invalidateQueries({ queryKey: financeSummaryKeys.all });
  if (pupilId) {
    queryClient.invalidateQueries({ queryKey: [...financeSummaryKeys.all, 'pupil', pupilId] });
  }
  if (familyId) {
    queryClient.invalidateQueries({ queryKey: [...financeSummaryKeys.all, 'family', familyId] });
  }
}

export function usePupilFinanceSummary({
  pupilId,
  academicYear,
  termId,
  pupil,
  allAcademicYears = [],
  feesHolidays = [],
  enabled = true,
}: {
  pupilId: string;
  academicYear?: AcademicYear | null;
  termId?: string;
  pupil?: Pupil;
  allAcademicYears?: AcademicYear[];
  feesHolidays?: any[];
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: financeSummaryKeys.pupil(pupilId, academicYear?.id, termId),
    queryFn: () =>
      FinanceCalculationService.getPupilFinanceSummary(pupilId, academicYear?.id, termId, {
        pupil,
        academicYear: academicYear || undefined,
        allAcademicYears,
        feesHolidays,
      }),
    enabled: enabled && !!pupilId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useFamilyFinanceSummary({
  familyId,
  academicYear,
  termId,
  allAcademicYears = [],
  enabled = true,
}: {
  familyId: string;
  academicYear?: AcademicYear | null;
  termId?: string;
  allAcademicYears?: AcademicYear[];
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: financeSummaryKeys.family(familyId, academicYear?.id, termId),
    queryFn: () =>
      FinanceCalculationService.getFamilyFinanceSummary(familyId, academicYear?.id, termId, {
        academicYear: academicYear || undefined,
        allAcademicYears,
      }),
    enabled: enabled && !!familyId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
