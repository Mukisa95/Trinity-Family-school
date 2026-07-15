import type { AcademicYear, DisableTypeOption, FeeStructure } from "@/types";

const sortAcademicYears = (academicYears: AcademicYear[]) => [...academicYears].sort(
  (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
);

const getLegacyApplicableYearIds = (fee: FeeStructure, academicYears: AcademicYear[]) => {
  if (fee.effectiveYears !== undefined) return [...fee.effectiveYears];
  if (!fee.academicYearId) return academicYears.map(year => year.id);

  const contextYear = academicYears.find(year => year.id === fee.academicYearId);
  if (!contextYear) return [];

  const contextStart = new Date(contextYear.startDate).getTime();
  return academicYears
    .filter(year => new Date(year.startDate).getTime() >= contextStart)
    .map(year => year.id);
};

const applyDisableRule = (
  applicableYearIds: string[],
  academicYears: AcademicYear[],
  disableType: DisableTypeOption,
  startYearId?: string,
  endYearId?: string
) => {
  if (disableType === 'immediate_indefinite') return [];

  const startYear = academicYears.find(year => year.id === startYearId);
  if (!startYear) return applicableYearIds;

  const startDate = new Date(startYear.startDate).getTime();
  const endYear = academicYears.find(year => year.id === endYearId);
  const endDate = endYear ? new Date(endYear.endDate).getTime() : undefined;

  return applicableYearIds.filter(yearId => {
    const year = academicYears.find(item => item.id === yearId);
    if (!year) return false;

    const yearStart = new Date(year.startDate).getTime();
    if (disableType === 'from_year_onwards') return yearStart < startDate;
    if (disableType === 'year_range' && endDate !== undefined) {
      return yearStart < startDate || yearStart > endDate;
    }
    return true;
  });
};

/**
 * Resolves the years in which a fee can be fetched. Legacy disable history is
 * respected until a user explicitly saves the Year Applicability editor.
 */
export function getApplicableYearIds(fee: FeeStructure, academicYears: AcademicYear[]): string[] {
  const sortedYears = sortAcademicYears(academicYears);
  let applicableYearIds = getLegacyApplicableYearIds(fee, sortedYears);

  if (fee.hasCustomYearApplicability) return applicableYearIds;

  const baselineApplicableYearIds = [...applicableYearIds];
  for (const entry of fee.disableHistory || []) {
    // Re-enabling resets the legacy rules that preceded it.
    if (entry.reason === 'Fee re-enabled by user.') {
      applicableYearIds = [...baselineApplicableYearIds];
      continue;
    }
    applicableYearIds = applyDisableRule(
      applicableYearIds,
      sortedYears,
      entry.disableType,
      entry.startYearId,
      entry.endYearId
    );
  }

  return applicableYearIds;
}

export function isFeeApplicableInYear(
  fee: FeeStructure,
  academicYearId: string,
  academicYears: AcademicYear[]
): boolean {
  return getApplicableYearIds(fee, academicYears).includes(academicYearId);
}

export function getApplicableYearIdsAfterDisable(
  fee: FeeStructure,
  academicYears: AcademicYear[],
  disableType: DisableTypeOption,
  startYearId?: string,
  endYearId?: string
): string[] {
  const sortedYears = sortAcademicYears(academicYears);
  return applyDisableRule(
    getApplicableYearIds(fee, sortedYears),
    sortedYears,
    disableType,
    startYearId,
    endYearId
  );
}
