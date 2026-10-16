import type { AcademicYear, Pupil, PupilTermSnapshot, FeeStructure } from '@/types';
import { isPupilValidForTerm } from './pupil-fee-eligibility';
import { hasValidFeeAssignment } from './fee-assignment-pipeline';
import { isFeeApplicableInYear } from './fee-applicability';

/** Payment-date term is the origin; debts are always visited oldest first. */
export function schoolPayTermSlots(years: AcademicYear[], pupil?: Pupil) {
  return years.flatMap(year => (year.terms || []).map(term => ({ year, term })))
    .filter(({ year, term }) => !pupil || isPupilValidForTerm(pupil, term, year))
    .sort((a, b) => new Date(a.term.startDate).getTime() - new Date(b.term.startDate).getTime());
}

/** Read historical class/section without creating or updating a snapshot. */
export function schoolPayHistoricalPupil(
  pupil: Pupil,
  year: AcademicYear,
  term: AcademicYear['terms'][number],
  snapshots: PupilTermSnapshot[],
): Pupil {
  const snapshot = snapshots.find(item => item.pupilId === pupil.id && item.academicYearId === year.id && item.termId === term.id);
  if (snapshot) return { ...pupil, classId: snapshot.classId, section: snapshot.section as Pupil['section'] };

  const promotions = [...(pupil.promotionHistory || [])].sort((a, b) => a.date.localeCompare(b.date));
  let classId = pupil.classId;
  for (const promotion of promotions) {
    if (new Date(promotion.date) >= new Date(term.startDate)) {
      classId = promotion.fromClassId || promotion.toClassId || classId;
      break;
    }
    classId = promotion.toClassId || classId;
  }
  return { ...pupil, classId };
}


export function schoolPayTermOrder(name?: string): number | null {
  if (!name) return null;
  const numericMatch = name.match(/(\d+)/);
  if (numericMatch) return parseInt(numericMatch[1], 10);

  const normalized = name.trim().toLowerCase();
  if (normalized.includes('first')) return 1;
  if (normalized.includes('second')) return 2;
  if (normalized.includes('third')) return 3;
  if (normalized.includes('fourth')) return 4;
  return null;
}

function schoolPayLookupTerm(allAcademicYears: any[], termId: string): any | null {
  for (const year of allAcademicYears) {
    const term = (year.terms || []).find((item: any) => item.id === termId);
    if (term) return term;
  }
  return null;
}


export function schoolPayApplicableFees(pupil: Pupil, slot: {year: AcademicYear; term: AcademicYear['terms'][number]; allAcademicYears: AcademicYear[]}, allFees: FeeStructure[]): FeeStructure[] {
  const currentTermOrder = schoolPayTermOrder(slot.term.name);

  return allFees.filter((fee: any) => {
    if (fee.status === 'inactive') return false;
    if (!isFeeApplicableInYear(fee, slot.year.id, slot.allAcademicYears)) return false;
    if (fee.category === 'Discount' || (typeof fee.amount === 'number' && fee.amount < 0)) return false;

    if (fee.isAssignmentFee) {
      const assigned = hasValidFeeAssignment(
        pupil.assignedFees,
        fee.id,
        slot.year.id,
        slot.term.id,
        slot.allAcademicYears,
      );
      if (!assigned) return false;
    }

    if (fee.effectiveYears === undefined && fee.academicYearId) {
      const feeYear = slot.allAcademicYears.find((year: any) => year.id === fee.academicYearId);
      if (feeYear) {
        const feeStart = new Date(feeYear.startDate);
        const activeStart = new Date(slot.year.startDate);
        if (activeStart < feeStart) return false;
      } else if (fee.academicYearId !== slot.year.id) {
        return false;
      }
    }

    if (fee.termId) {
      const exactMatch = fee.termId === slot.term.id;
      if (!exactMatch) {
        const feeTerm = schoolPayLookupTerm(slot.allAcademicYears, fee.termId);
        const feeTermOrder = feeTerm ? schoolPayTermOrder(feeTerm.name) : null;
        const equivalentMatch =
          feeTermOrder !== null &&
          currentTermOrder !== null &&
          feeTermOrder === currentTermOrder;
        if (!equivalentMatch) return false;
      }
    }

    const classFeeType = fee.classFeeType || 'all';
    if (classFeeType === 'specific') {
      const classIds: string[] = Array.isArray(fee.classIds)
        ? fee.classIds
        : fee.classId
          ? [fee.classId]
          : [];
      if (!classIds.includes(pupil.classId)) return false;
    }

    const sectionFeeType = fee.sectionFeeType || 'all';
    if (sectionFeeType === 'specific' && fee.section && fee.section !== pupil.section) return false;

    return true;
  });
}
