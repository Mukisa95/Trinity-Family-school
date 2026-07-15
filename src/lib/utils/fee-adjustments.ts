import type { AcademicYear, FeeAdjustmentEntry } from "@/types";

export function doesFeeAdjustmentApply(
  adjustment: FeeAdjustmentEntry,
  academicYearId: string,
  academicYears: AcademicYear[]
): boolean {
  const targetYear = academicYears.find(year => year.id === academicYearId);
  const startYear = academicYears.find(year => year.id === adjustment.startYearId);
  if (!targetYear || !startYear) return false;

  if (adjustment.effectivePeriodType === 'specific_year') {
    return adjustment.startYearId === academicYearId;
  }

  const targetStart = new Date(targetYear.startDate).getTime();
  const startDate = new Date(startYear.startDate).getTime();
  if (adjustment.effectivePeriodType === 'from_year_onwards') {
    return targetStart >= startDate;
  }

  if (adjustment.effectivePeriodType === 'year_range' && adjustment.endYearId) {
    const endYear = academicYears.find(year => year.id === adjustment.endYearId);
    if (!endYear) return false;
    return targetStart >= startDate && targetStart <= new Date(endYear.endDate).getTime();
  }

  return false;
}

/**
 * Calculates a fee for one academic year without mutating its stored base
 * amount. This preserves the historical fee amount for every earlier year.
 */
export function calculateFeeAmountForAcademicYear(
  baseAmount: number,
  feeStructureId: string,
  academicYearId: string | undefined,
  academicYears: AcademicYear[],
  adjustments: FeeAdjustmentEntry[]
): number {
  if (!academicYearId) return baseAmount;

  return adjustments
    .filter(adjustment =>
      adjustment.feeStructureId === feeStructureId &&
      doesFeeAdjustmentApply(adjustment, academicYearId, academicYears)
    )
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .reduce(
      (amount, adjustment) => adjustment.adjustmentType === 'increase'
        ? amount + adjustment.amount
        : amount - adjustment.amount,
      baseAmount
    );
}
