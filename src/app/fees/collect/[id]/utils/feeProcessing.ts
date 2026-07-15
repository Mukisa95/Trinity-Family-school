import type {
  AcademicYear,
  Pupil,
  FeeStructure,
  PaymentRecord,
  PupilAssignedFee,
  PupilTermSnapshot,
  FeesHoliday
} from '@/types';
import { PupilSnapshotsService } from '@/lib/services/pupil-snapshots.service';
import { FeesHolidayService } from '@/lib/services/fees-holiday.service';
import { isFeeApplicableInYear } from '@/lib/utils/fee-applicability';
import type {
  PupilFee,
  PreviousTermBalance
} from '../types';
import { PaymentType } from '../types';

/**
 * Checks if an assignment is currently valid based on its time settings
 */
export function isAssignmentCurrentlyValid(
  assignment: PupilAssignedFee,
  currentTermId: string,
  currentAcademicYear: AcademicYear,
  allAcademicYears: AcademicYear[]
): boolean {
  // Check if assignment is active
  if (assignment.status === 'disabled') {
    console.log(`❌ Assignment rejected: status is disabled`);
    return false;
  }

  // Check explicit term exclusions
  if (assignment.excludedTermIds && assignment.excludedTermIds.includes(currentTermId)) {
    console.log(`❌ Assignment rejected: explicitly excluded for term ${currentTermId}`);
    return false;
  }

  // Check validity type
  switch (assignment.validityType) {
    case 'current_term':
      const isCurrentTerm = assignment.applicableTermIds?.includes(currentTermId) ||
        assignment.termApplicability === 'all_terms';
      if (!isCurrentTerm) {
        console.log(`❌ Assignment rejected: not valid for current term`);
        return false;
      }
      break;

    case 'current_year':
      if (assignment.startAcademicYearId && assignment.startAcademicYearId !== currentAcademicYear.id) {
        console.log(`❌ Assignment rejected: not valid for current academic year`);
        return false;
      }
      break;

    case 'specific_year':
      if (assignment.startAcademicYearId !== currentAcademicYear.id) {
        console.log(`❌ Assignment rejected: not valid for this specific year`);
        return false;
      }
      break;

    case 'year_range':
      if (assignment.startAcademicYearId && assignment.endAcademicYearId) {
        const startYear = allAcademicYears.find(y => y.id === assignment.startAcademicYearId);
        const endYear = allAcademicYears.find(y => y.id === assignment.endAcademicYearId);
        const currentYear = currentAcademicYear;

        if (startYear && endYear) {
          const startDate = new Date(startYear.startDate);
          const endDate = new Date(endYear.endDate);
          const currentDate = new Date(currentYear.startDate);

          if (currentDate < startDate || currentDate > endDate) {
            console.log(`❌ Assignment rejected: current year not in valid range`);
            return false;
          }
        }
      }
      break;

    case 'specific_terms':
      if (assignment.applicableTermIds && !assignment.applicableTermIds.includes(currentTermId)) {
        console.log(`❌ Assignment rejected: current term not in applicable terms`);
        return false;
      }
      break;

    case 'indefinite':
    default:
      // Always valid for indefinite assignments
      break;
  }

  // Check term applicability
  if (assignment.termApplicability === 'specific_terms') {
    if (!assignment.applicableTermIds?.includes(currentTermId)) {
      console.log(`❌ Assignment rejected: current term not in applicable terms list`);
      return false;
    }
  }

  return true;
}

function findTermDetails(termId: string | undefined, academicYears: AcademicYear[]) {
  if (!termId) return null;

  for (const academicYear of academicYears) {
    const term = academicYear.terms?.find(t => t.id === termId);
    if (term) {
      return { term, academicYear };
    }
  }

  return null;
}

function extractTermOrder(termName?: string): number | null {
  if (!termName) return null;

  const numericMatch = termName.match(/(\d+)/);
  if (numericMatch) {
    return Number.parseInt(numericMatch[1], 10);
  }

  const normalized = termName.trim().toLowerCase();
  if (normalized.includes('first')) return 1;
  if (normalized.includes('second')) return 2;
  if (normalized.includes('third')) return 3;
  if (normalized.includes('fourth')) return 4;

  return null;
}

function normalizeTermName(termName?: string): string {
  return termName?.trim().toLowerCase().replace(/\s+/g, '') || '';
}

/**
 * Filters fee structures applicable to a specific pupil for a given term and academic year
 */
export function filterApplicableFees(
  feeStructures: FeeStructure[],
  pupil: Pupil,
  termId: string,
  academicYear: AcademicYear,
  allAcademicYears: AcademicYear[] = []
): FeeStructure[] {
  console.log('🔍 UPDATED filterApplicableFees - Filtering fees with criteria:', {
    totalFees: feeStructures.length,
    pupilClassId: pupil.classId,
    pupilSection: pupil.section,
    termId,
    academicYearId: academicYear.id,
    academicYearName: academicYear.name,
    academicYearStartDate: academicYear.startDate,
    pupilAssignedFees: pupil.assignedFees?.length || 0,
    allAcademicYearsCount: allAcademicYears.length,
    allAcademicYearsDebug: allAcademicYears.map(y => ({ id: y.id, name: y.name, startDate: y.startDate })),
    feeStructureDetails: feeStructures.map(f => ({
      id: f.id,
      name: f.name,
      category: f.category,
      amount: f.amount,
      academicYearId: f.academicYearId,
      termId: f.termId,
      isAssignmentFee: f.isAssignmentFee,
      status: f.status
    }))
  });

  const filteredFees = feeStructures.filter(fee => {
    // EXCLUDE ASSIGNMENT FEES - they should only be included if specifically assigned to the pupil
    if (fee.isAssignmentFee) {
      const assignedFee = pupil.assignedFees?.find(assignedFee =>
        assignedFee.feeStructureId === fee.id
      );

      if (!assignedFee) {
        console.log(`❌ Assignment fee "${fee.name}" rejected: not assigned to this pupil`);
        return false;
      }

      // Check if the assignment is currently valid
      if (!isAssignmentCurrentlyValid(assignedFee, termId, academicYear, allAcademicYears)) {
        console.log(`❌ Assignment fee "${fee.name}" rejected: assignment not currently valid`);
        return false;
      }

      console.log(`✅ Assignment fee "${fee.name}" accepted: assigned and valid for this pupil`);
    }

    // EXCLUDE DISCOUNTS - they should not appear as independent fee items
    if (fee.category === 'Discount' || fee.amount < 0) {
      console.log(`❌ Discount "${fee.name}" rejected: discounts are not independent fee items`);
      return false;
    }

    // Use the same scoped-disable and Year Applicability rules as Fees
    // Management. An inapplicable fee must be skipped, not displayed disabled.
    if (!isFeeApplicableInYear(fee, academicYear.id, allAcademicYears)) {
      console.log(`❌ Fee "${fee.name}" rejected: not applicable in academic year ${academicYear.name}`);
      return false;
    }

    // Check if fee is for the correct academic year (strict matching for carry-forward accuracy)
    // Include if no specific year set (universal fees) or exact term/year match
    if (fee.effectiveYears === undefined && fee.academicYearId) {
      const effectiveYear = allAcademicYears.find(y => y.id === fee.academicYearId);
      const currentYearStart = new Date(academicYear.startDate);

      if (effectiveYear) {
        const effectiveYearStart = new Date(effectiveYear.startDate);

        if (currentYearStart < effectiveYearStart) {
          console.log(`❌ Fee "${fee.name}" rejected: current year ${academicYear.name} is before effective year ${effectiveYear.name}`);
          return false;
        }

        console.log(`✅ Fee "${fee.name}" year check passed: effective from ${effectiveYear.name}, current year ${academicYear.name}`);
      } else if (fee.academicYearId !== academicYear.id) {
        console.log(`❌ Fee "${fee.name}" rejected: unknown effective year and no exact match (fee.academicYearId=${fee.academicYearId}, academicYear.id=${academicYear.id})`);
        return false;
      } else {
        console.log(`✅ Fee "${fee.name}" year check passed: exact academic year match (${fee.academicYearId})`);
      }
    } else {
      console.log(`✅ Fee "${fee.name}" accepted: no specific academic year set (universal fee)`);
    }

    // Check if fee is for the correct term (strict matching for carry-forward accuracy)
    // Include if no specific term set (universal fees) or exact term match
    if (fee.termId) {
      const selectedTerm =
        academicYear.terms?.find(term => term.id === termId) ||
        findTermDetails(termId, allAcademicYears)?.term;

      const feeTermDetails = findTermDetails(fee.termId, allAcademicYears);
      const isExactTermMatch = fee.termId === termId;

      let isEquivalentTermMatch = false;

      if (!isExactTermMatch && feeTermDetails?.term && selectedTerm) {
        const feeTermOrder = extractTermOrder(feeTermDetails.term.name);
        const selectedTermOrder = extractTermOrder(selectedTerm.name);

        if (feeTermOrder !== null && selectedTermOrder !== null) {
          isEquivalentTermMatch = feeTermOrder === selectedTermOrder;
        } else {
          isEquivalentTermMatch =
            normalizeTermName(feeTermDetails.term.name) === normalizeTermName(selectedTerm.name);
        }
      }

      if (isExactTermMatch || isEquivalentTermMatch) {
        console.log(
          `✅ Fee "${fee.name}" term check passed: ${isExactTermMatch ? 'exact' : 'equivalent'} match (${fee.termId} -> ${termId})`
        );
      } else {
        console.log(
          `❌ Fee "${fee.name}" rejected: wrong term (fee.termId=${fee.termId} !== termId=${termId})`
        );
        return false;
      }
    } else {
      console.log(`✅ Fee "${fee.name}" accepted: no specific term set (universal fee)`);
    }

    // Check class applicability
    if (fee.classFeeType === 'specific' && fee.classIds) {
      if (!fee.classIds.includes(pupil.classId)) {
        console.log(`❌ Fee "${fee.name}" rejected: class not applicable (${pupil.classId} not in [${fee.classIds.join(', ')}])`);
        return false;
      }
    }

    // Check section applicability
    if (fee.sectionFeeType === 'specific' && fee.section) {
      if (fee.section !== pupil.section) {
        console.log(`❌ Fee "${fee.name}" rejected: section not applicable (${pupil.section} !== ${fee.section})`);
        return false;
      }
    }

    // Check if fee is effective (always true for now since we don't have effectiveFrom)
    // const effectiveDate = new Date(fee.effectiveFrom);
    // const currentDate = new Date();
    // if (effectiveDate > currentDate) {
    //   return false;
    // }

    console.log(`✅ Fee "${fee.name}" accepted!`);
    return true;
  });

  console.log('📊 Filtering results:', {
    totalFees: feeStructures.length,
    filteredFees: filteredFees.length,
    acceptedFees: filteredFees.map(f => f.name)
  });

  return filteredFees;
}

/**
 * Calculates payment totals for a specific fee
 * @param feeId - The fee structure ID
 * @param payments - All payments for the pupil
 * @param currentAcademicYearId - The academic year ID we're viewing fees for (optional, for filtering payments)
 * @param currentTermId - The term ID we're viewing fees for (optional, for filtering payments)
 */
export function calculateFeePayments(
  feeId: string,
  payments: PaymentRecord[],
  currentAcademicYearId?: string,
  currentTermId?: string
): { totalPaid: number; balance: number; feePayments: PaymentRecord[] } {
  // Get direct payments to this fee, filtered by term if provided.
  // NOTE: We do NOT require academicYearId to match strictly — the server (API route) may resolve
  // the active year to a different Firestore ID than what the UI computed. The termId alone
  // (e.g. 't1-2026') is specific enough to avoid counting payments from a different year's Term 1.
  const directFeePayments = payments.filter(payment => {
    if (payment.feeStructureId !== feeId || payment.reverted) {
      return false;
    }

    // Match by termId only — avoids academicYearId mismatch between server and client
    if (currentTermId) {
      return payment.termId === currentTermId;
    }

    // If no term filter specified, include all payments (backward compatibility)
    return true;
  });

  // Get carry forward payments that were made for this fee
  // These are payments with feeStructureId 'previous-balance' but originalFeeStructureId matching this fee
  // 🔥 CRITICAL FIX: Also filter by originalTermId and originalAcademicYearId to ensure we only count
  // carry forward payments that were made for the current term/year combination
  const carryForwardPayments = payments.filter(payment => {
    if (payment.feeStructureId !== 'previous-balance' || payment.reverted) {
      return false;
    }

    if ((payment as any).originalFeeStructureId !== feeId) {
      return false;
    }

    // If we're viewing a specific year/term, only count carry forward payments that were made for that year/term
    // Check both when the payment was made AND what term/year it was originally for
    if (currentAcademicYearId && currentTermId) {
      const originalTermId = (payment as any).originalTermId;
      const originalAcademicYearId = (payment as any).originalAcademicYearId;

      // Only include if the original term/year matches the current viewing context
      // This ensures carry forward payments from Term 2 2025 don't show up when viewing Term 2 2026
      return originalTermId === currentTermId &&
        originalAcademicYearId === currentAcademicYearId;
    }

    // If no year/term filter specified, include all (backward compatibility)
    return true;
  });

  // Get payments that were made in current term but recorded against original term
  // BUT exclude those that already have a corresponding 'previous-balance' record to avoid duplicates
  // 🔥 CRITICAL FIX: Also filter by originalTermId and originalAcademicYearId to ensure we only count
  // payments that were made for the current term/year combination
  const originalTermPayments = payments.filter(payment => {
    if (payment.feeStructureId !== feeId || payment.reverted) {
      return false;
    }

    if (!(payment as any).isCarryForwardPayment) {
      return false;
    }

    // If we're viewing a specific year/term, only count payments that were made for that year/term
    if (currentAcademicYearId && currentTermId) {
      const originalTermId = (payment as any).originalTermId;
      const originalAcademicYearId = (payment as any).originalAcademicYearId;

      // Only include if the original term/year matches the current viewing context
      if (originalTermId !== currentTermId || originalAcademicYearId !== currentAcademicYearId) {
        return false;
      }
    }

    // Only include if there's no corresponding previous-balance payment
    return !carryForwardPayments.some(cfPayment =>
      Math.abs(cfPayment.amount - payment.amount) < 0.01 && // Same amount
      Math.abs(new Date(cfPayment.paymentDate).getTime() - new Date(payment.paymentDate).getTime()) < 60000 && // Within 1 minute
      (cfPayment as any).originalFeeStructureId === payment.feeStructureId
    );
  });

  // Combine all relevant payments, prioritizing carry forward payments over original term duplicates
  const allFeePayments = [...directFeePayments, ...carryForwardPayments, ...originalTermPayments];

  // Additional deduplication based on payment characteristics
  const uniquePayments = allFeePayments.filter((payment, index, self) => {
    // First, check for exact ID matches
    const firstOccurrenceIndex = self.findIndex(p => p.id === payment.id);
    if (firstOccurrenceIndex !== index) {
      return false; // This is a duplicate by ID
    }

    // Then check for potential duplicates by amount, date, and fee structure
    const potentialDuplicates = self.filter(p =>
      p.id !== payment.id &&
      Math.abs(p.amount - payment.amount) < 0.01 && // Same amount
      Math.abs(new Date(p.paymentDate).getTime() - new Date(payment.paymentDate).getTime()) < 60000 && // Within 1 minute
      (
        (p.feeStructureId === payment.feeStructureId) || // Same fee structure
        (p.feeStructureId === 'previous-balance' && (p as any).originalFeeStructureId === payment.feeStructureId) || // Carry forward payment
        (payment.feeStructureId === 'previous-balance' && (payment as any).originalFeeStructureId === p.feeStructureId) // Reverse case
      )
    );

    if (potentialDuplicates.length > 0) {
      // If this is a carry forward payment (previous-balance), prefer it over original term payment
      if (payment.feeStructureId === 'previous-balance') {
        return true; // Keep carry forward payment
      }

      // If there's a carry forward payment in the duplicates, exclude this one
      const hasCarryForwardDuplicate = potentialDuplicates.some(p => p.feeStructureId === 'previous-balance');
      if (hasCarryForwardDuplicate) {
        return false; // Exclude original term payment in favor of carry forward
      }
    }

    return true; // Keep this payment
  });

  const totalPaid = uniquePayments.reduce((sum, payment) => sum + payment.amount, 0);

  console.log(`💰 Payment calculation for fee ${feeId}:`, {
    currentAcademicYearId,
    currentTermId,
    directPayments: directFeePayments.length,
    carryForwardPayments: carryForwardPayments.length,
    originalTermPayments: originalTermPayments.length,
    totalBeforeDedup: allFeePayments.length,
    totalAfterDedup: uniquePayments.length,
    totalPaid,
    uniquePaymentIds: uniquePayments.map(p => ({
      id: p.id,
      amount: p.amount,
      feeStructureId: p.feeStructureId,
      academicYearId: p.academicYearId,
      termId: p.termId
    }))
  });

  return {
    totalPaid,
    balance: 0, // Will be calculated when we have the fee amount
    feePayments: uniquePayments
  };
}

function getMatchingCarryForwardPayments(
  payments: PaymentRecord[],
  item: {
    feeStructureId?: string;
    name: string;
    termId?: string;
    termName?: string;
    academicYearId?: string;
    academicYearName?: string;
  },
  alreadyCountedPayments: PaymentRecord[] = []
): PaymentRecord[] {
  const alreadyCountedIds = new Set(alreadyCountedPayments.map(payment => payment.id));

  return payments.filter(payment => {
    if (payment.feeStructureId !== 'previous-balance' || payment.reverted || alreadyCountedIds.has(payment.id)) {
      return false;
    }

    if (!(payment as any).isCarryForwardPayment) {
      return false;
    }

    const originalFeeStructureId = (payment as any).originalFeeStructureId;
    const carryForwardItemName = `${(payment as any).carryForwardItemName || ''}`.trim().toLowerCase();
    const itemName = `${item.name || ''}`.trim().toLowerCase();

    const feeMatches =
      (item.feeStructureId && originalFeeStructureId === item.feeStructureId) ||
      (carryForwardItemName && itemName && carryForwardItemName === itemName);

    if (!feeMatches) {
      return false;
    }

    const originalTermId = (payment as any).originalTermId;
    const originalAcademicYearId = (payment as any).originalAcademicYearId;
    const originalTerm = `${(payment as any).originalTerm || ''}`.trim().toLowerCase();
    const originalYear = `${(payment as any).originalYear || ''}`.trim().toLowerCase();
    const termName = `${item.termName || ''}`.trim().toLowerCase();
    const academicYearName = `${item.academicYearName || ''}`.trim().toLowerCase();

    const termMatches =
      (item.termId && originalTermId === item.termId) ||
      (termName && originalTerm === termName);

    const academicYearMatches =
      (item.academicYearId && originalAcademicYearId === item.academicYearId) ||
      (academicYearName && originalYear === academicYearName);

    return termMatches && academicYearMatches;
  });
}

/**
 * Processes fee structures into PupilFee objects with payment information
 */
export function processPupilFees(
  feeStructures: FeeStructure[],
  payments: PaymentRecord[],
  allFeeStructures: FeeStructure[] = [], // All fee structures to find discounts
  pupil: Pupil,
  currentTermId: string,
  currentAcademicYear: AcademicYear,
  allAcademicYears: AcademicYear[] = [],
  feesHolidays: FeesHoliday[] = [] // Active fees holidays for this pupil
): PupilFee[] {
  console.log('💰 Processing pupil fees with discounts and fees holidays:', {
    feeStructuresCount: feeStructures.length,
    allFeeStructuresCount: allFeeStructures.length,
    pupilAssignedFees: pupil.assignedFees?.length || 0,
    feesHolidaysCount: feesHolidays.length
  });

  // Find discounts assigned to this pupil that are currently valid.
  // Includes both global discounts (resolved via allFeeStructures) and
  // pupil-specific pivot/inline discounts (stored on assignment.inlineDiscount).
  const assignedDiscounts = pupil.assignedFees?.filter(assignedFee => {
    // Pupil-specific inline (pivot) discount — always treat as a discount
    if (assignedFee.feeStructureId.startsWith('pivot-') && assignedFee.inlineDiscount) {
      return isAssignmentCurrentlyValid(assignedFee, currentTermId, currentAcademicYear, allAcademicYears);
    }

    const feeStructure = allFeeStructures.find(fs => fs.id === assignedFee.feeStructureId);
    const isDiscount = feeStructure && (feeStructure.category === 'Discount' || feeStructure.amount < 0);

    if (!isDiscount) return false;

    // Check if the discount assignment is currently valid
    return isAssignmentCurrentlyValid(assignedFee, currentTermId, currentAcademicYear, allAcademicYears);
  }) || [];

  console.log('🎯 Found assigned and valid discounts:', assignedDiscounts.map(ad => {
    const discountStructure = allFeeStructures.find(fs => fs.id === ad.feeStructureId);
    return {
      discountId: ad.feeStructureId,
      discountName: discountStructure?.name ?? ad.inlineDiscount?.name,
      linkedFeeIds: discountStructure?.linkedFeeIds || (discountStructure?.linkedFeeId ? [discountStructure.linkedFeeId] : undefined) || ad.inlineDiscount?.linkedFeeIds,
      discountAmount: discountStructure?.amount ?? ad.inlineDiscount?.amount,
      assignmentStatus: ad.status,
      validityType: ad.validityType
    };
  }));

  // Get active fees holidays
  const activeFeesHolidays = feesHolidays.filter(h => h.isActive);
  console.log('🎫 Found active fees holidays:', activeFeesHolidays.map(h => ({
    categories: h.categories,
    discountType: h.discountType,
    discountValue: h.discountValue,
    reason: h.reason
  })));

  return feeStructures.map(fee => {
    // Pass current academic year and term to filter payments correctly
    // This ensures payments from previous years are not counted when viewing fees for a future year
    const { totalPaid, feePayments } = calculateFeePayments(
      fee.id,
      payments,
      currentAcademicYear.id,
      currentTermId
    );

    // Apply discounts if any are linked to this fee
    let finalAmount = fee.amount;
    let discount = undefined;
    let originalAmount = undefined;
    let feesHolidayApplied = undefined;

    // Check if fees holiday applies to this fee
    // Fees holiday applies based on fee category (required/non-required)
    const feeIsRequired = fee.isRequired === true;
    const applicableFeesHoliday = activeFeesHolidays.find(h => {
      // Handle both old format (single category) and new format (array of categories)
      const holidayCategories = Array.isArray(h.categories)
        ? h.categories
        : (h as any).category
          ? [(h as any).category]
          : [];

      // Check if fee matches any of the holiday's categories
      return holidayCategories.some(cat => {
        if (cat === 'required' && feeIsRequired) return true;
        if (cat === 'non-required' && !feeIsRequired) return true;
        return false;
      });
    });

    // Apply fees holiday discount if applicable
    if (applicableFeesHoliday) {
      originalAmount = fee.amount;
      let holidayDiscountAmount = 0;

      switch (applicableFeesHoliday.discountType) {
        case 'full':
          holidayDiscountAmount = fee.amount; // 100% discount
          break;
        case 'half':
          holidayDiscountAmount = fee.amount * 0.5; // 50% discount
          break;
        case 'quarter':
          holidayDiscountAmount = fee.amount * 0.25; // 25% discount
          break;
        case 'percentage':
          if (applicableFeesHoliday.discountValue !== undefined) {
            holidayDiscountAmount = fee.amount * (applicableFeesHoliday.discountValue / 100);
          }
          break;
      }

      finalAmount = Math.max(0, fee.amount - holidayDiscountAmount);

      // Handle both old format (single category) and new format (array)
      const holidayCategories = Array.isArray(applicableFeesHoliday.categories)
        ? applicableFeesHoliday.categories
        : (applicableFeesHoliday as any).category
          ? [(applicableFeesHoliday as any).category]
          : [];

      feesHolidayApplied = {
        id: applicableFeesHoliday.id,
        categories: holidayCategories,
        discountType: applicableFeesHoliday.discountType,
        discountValue: applicableFeesHoliday.discountValue,
        reason: applicableFeesHoliday.reason,
        amount: holidayDiscountAmount
      };

      console.log(`🎫 Applied fees holiday to fee "${fee.name}":`, {
        categories: holidayCategories,
        discountType: applicableFeesHoliday.discountType,
        discountValue: applicableFeesHoliday.discountValue,
        originalAmount: fee.amount,
        discountAmount: holidayDiscountAmount,
        finalAmount
      });
    }

    const applicableDiscounts = assignedDiscounts.filter(assignedDiscount => {
      // Inline (pivot) discounts: match using inlineDiscount.linkedFeeIds
      if (assignedDiscount.feeStructureId.startsWith('pivot-') && assignedDiscount.inlineDiscount) {
        return assignedDiscount.inlineDiscount.linkedFeeIds?.includes(fee.id);
      }
      const discountStructure = allFeeStructures.find(fs => fs.id === assignedDiscount.feeStructureId);
      return discountStructure && (discountStructure.linkedFeeIds?.includes(fee.id) || discountStructure.linkedFeeId === fee.id);
    });

    // Apply existing discount system (only if no fees holiday applied, or apply both)
    if (applicableDiscounts.length > 0) {
      if (!originalAmount) originalAmount = fee.amount;
      let totalDiscountAmount = feesHolidayApplied?.amount || 0;

      // Apply all applicable discounts
      for (const assignedDiscount of applicableDiscounts) {
        // Pivot / inline discount: read amount directly from inlineDiscount
        if (assignedDiscount.feeStructureId.startsWith('pivot-') && assignedDiscount.inlineDiscount) {
          const inlineAmt = assignedDiscount.inlineDiscount.amount;
          totalDiscountAmount += Math.abs(inlineAmt); // stored negative, we want positive magnitude
          console.log(`💸 Applied inline pivot discount "${assignedDiscount.inlineDiscount.name}" to fee "${fee.name}": ${inlineAmt}`);
          continue;
        }

        const discountStructure = allFeeStructures.find(fs => fs.id === assignedDiscount.feeStructureId);
        if (discountStructure && typeof discountStructure.amount === 'number') {
          if (discountStructure.amount < 0) {
            // Fixed amount discount (negative value)
            totalDiscountAmount += Math.abs(discountStructure.amount);
          } else {
            // Percentage discount (positive value represents percentage)
            // Apply to the amount after fees holiday discount
            totalDiscountAmount += (finalAmount * discountStructure.amount / 100);
          }

          console.log(`💸 Applied discount "${discountStructure.name}" to fee "${fee.name}": ${discountStructure.amount}`);
        }
      }

      finalAmount = Math.max(0, fee.amount - totalDiscountAmount);

      // Create discount info for display (combine fees holiday and regular discounts)
      if (feesHolidayApplied && applicableFeesHoliday) {
        discount = {
          id: feesHolidayApplied.id,
          name: `Fees Holiday (${feesHolidayApplied.categories.join(', ')})`,
          amount: totalDiscountAmount,
          type: 'fees-holiday' as const,
          reason: feesHolidayApplied.reason,
          // category: feesHolidayApplied.categories[0], // Removed to avoid type error
          discountType: feesHolidayApplied.discountType
        };
      } else if (applicableDiscounts.length === 1) {
        const singleDiscount = applicableDiscounts[0];
        const discountStructure = allFeeStructures.find(fs => fs.id === singleDiscount.feeStructureId);
        // For pivot/inline discounts there is no feeStructure in the global list
        const isPivot = singleDiscount.feeStructureId.startsWith('pivot-') && singleDiscount.inlineDiscount;
        discount = {
          id: singleDiscount.feeStructureId,
          name: discountStructure?.name ?? (isPivot ? singleDiscount.inlineDiscount!.name : 'Discount'),
          amount: totalDiscountAmount,
          type: isPivot ? 'fixed' : ((discountStructure?.amount && discountStructure.amount < 0) ? 'fixed' : 'percentage')
        };
      } else if (applicableDiscounts.length > 1) {
        discount = {
          id: 'multiple-discounts',
          name: `${applicableDiscounts.length} Discounts Applied`,
          amount: totalDiscountAmount,
          type: 'fixed'
        };
      }
    } else if (feesHolidayApplied && applicableFeesHoliday) {
      // Only fees holiday, no regular discounts
      discount = {
        id: feesHolidayApplied.id,
        name: `Fees Holiday (${feesHolidayApplied.categories.join(', ')})`,
        amount: feesHolidayApplied.amount,
        type: 'fees-holiday' as const,
        reason: feesHolidayApplied.reason,
        // category: feesHolidayApplied.categories[0], // Removed to avoid type error
        discountType: feesHolidayApplied.discountType
      };
    }

    const balance = Math.max(0, finalAmount - totalPaid);

    console.log(`📊 Processed fee "${fee.name}":`, {
      originalAmount: fee.amount,
      finalAmount,
      discountApplied: !!discount,
      discountAmount: discount?.amount || 0,
      totalPaid,
      balance
    });

    return {
      ...fee,
      amount: finalAmount,
      paid: totalPaid,
      balance,
      payments: feePayments,
      discount,
      originalAmount
    } as PupilFee;
  });
}

/**
 * Calculates previous term balances for a pupil
 */
export async function calculatePreviousTermBalances(
  pupilId: string,
  currentTermId: string,
  currentAcademicYear: AcademicYear,
  allAcademicYears: AcademicYear[],
  getAllFeeStructures: () => Promise<FeeStructure[]>,
  getAllPayments: (pupilId: string) => Promise<PaymentRecord[]>,
  pupil: Pupil
): Promise<PreviousTermBalance | null> {
  try {
    const allFeeStructures = await getAllFeeStructures();
    const allPayments = await getAllPayments(pupilId);

    // Fetch active fees holidays for this pupil (needed for carry forward calculations)
    const activeFeesHolidays = await FeesHolidayService.getActiveFeesHolidaysByPupil(pupilId);
    console.log('🎫 Active fees holidays for carry forward:', activeFeesHolidays.length);

    // Import uniform fees service for carry forward calculations
    const { UniformFeesIntegrationService } = await import('@/lib/services/uniform-fees-integration.service');

    console.log('🔄 Calculating previous term balances (including uniforms):', {
      pupilId,
      currentTermId,
      currentAcademicYear: currentAcademicYear.name,
      totalFeeStructures: allFeeStructures.length,
      totalPayments: allPayments.length,
      pupilAssignedFees: pupil.assignedFees?.length || 0,
      pupilClassId: pupil.classId,
      pupilSection: pupil.section
    });

    const balanceBreakdown: Array<{
      name: string;
      amount: number;
      paid: number;
      balance: number;
      term: string;
      year: string;
      feeStructureId: string;
      termId: string;
      academicYearId: string;
    }> = [];

    // Get all previous academic years and terms, filtered by pupil registration date
    const previousPeriods = getPreviousPeriods(currentTermId, currentAcademicYear, allAcademicYears, pupil.registrationDate, pupil);

    console.log('📅 Previous periods found:', previousPeriods.map(p => ({
      termId: p.termId,
      termName: p.termName,
      academicYear: p.academicYear.name
    })));

    // Get ALL uniform fees for this pupil (not filtered by term) for carry forward
    const allUniformFees = await UniformFeesIntegrationService.getAllUniformFeesForPupil(pupilId);
    console.log('👕 All uniform fees for carry forward:', {
      uniformFeesCount: allUniformFees.length,
      uniformFees: allUniformFees.map(f => ({
        id: f.id,
        name: f.name,
        amount: f.amount,
        balance: f.balance,
        termId: f.termId,
        academicYearId: f.academicYearId,
        isRequired: f.isRequired
      }))
    });

    for (const period of previousPeriods) {
      console.log(`🔍 Checking period: ${period.termName} (${period.academicYear.name})`);

      // Get historical snapshot of pupil's class/section for this term
      // This ensures we use the pupil's class/section as it was during that term,
      // not their current class/section
      // NO FALLBACK - this must always work for financial accuracy
      const snapshot = await PupilSnapshotsService.getOrCreateSnapshot(
        pupil,
        period.termId,
        period.academicYear
      );
      const historicalPupil = PupilSnapshotsService.createVirtualPupilFromSnapshot(pupil, snapshot);
      console.log(`📸 Using historical snapshot for ${period.termName}: class=${snapshot.classId}, section=${snapshot.section} (current: class=${pupil.classId}, section=${pupil.section})`);

      // Use the EXACT SAME filtering logic as current term fees
      // BUT with historical pupil data (class/section as it was during that term)
      const applicableFees = filterApplicableFees(
        allFeeStructures,
        historicalPupil,
        period.termId,
        period.academicYear,
        allAcademicYears
      );

      console.log(`🎯 Found ${applicableFees.length} applicable fees for pupil in ${period.termName} after full filtering`);

      // Further filter for carry forward: only required fees with positive amounts
      const periodFees = applicableFees.filter(fee => {
        // EXCLUDE DISCOUNTS - they don't carry forward as independent items
        if (fee.category === 'Discount' || fee.amount < 0) {
          console.log(`❌ Previous term discount "${fee.name}" rejected: discounts don't carry forward as independent items`);
          return false;
        }

        // Only required fees carry forward balances
        if (!fee.isRequired) {
          console.log(`❌ Previous term fee "${fee.name}" rejected: not required`);
          return false;
        }

        console.log(`✅ Previous term fee "${fee.name}" accepted for carry forward`);
        return true;
      });

      // Filter uniform fees for this specific period
      const periodUniformFees = allUniformFees.filter(uniformFee =>
        uniformFee.termId === period.termId &&
        uniformFee.academicYearId === period.academicYear.id
      );

      console.log(`👕 Found ${periodUniformFees.length} uniform fees for ${period.termName}:`,
        periodUniformFees.map(f => ({ name: f.name, amount: f.amount, balance: f.balance, isRequired: f.isRequired }))
      );

      console.log(`💰 Found ${periodFees.length} regular fees + ${periodUniformFees.length} uniform fees for ${period.termName}`);

      // Process regular fees
      for (const fee of periodFees) {
        // Calculate fee amount with discounts applied (same logic as current term)
        let finalAmount = fee.amount;

        // Check if fees holiday applies to this fee (for previous term balance calculation)
        // Fees holiday applies based on fee category (required/non-required)
        const feeIsRequired = fee.isRequired === true;
        const applicableFeesHoliday = activeFeesHolidays.find(h => {
          // Handle both old format (single category) and new format (array of categories)
          const holidayCategories = Array.isArray(h.categories)
            ? h.categories
            : (h as any).category
              ? [(h as any).category]
              : [];

          // Check if fee matches any of the holiday's categories
          return holidayCategories.some(cat => {
            if (cat === 'required' && feeIsRequired) return true;
            if (cat === 'non-required' && !feeIsRequired) return true;
            return false;
          });
        });

        // Apply fees holiday discount if applicable
        if (applicableFeesHoliday) {
          let holidayDiscountAmount = 0;

          switch (applicableFeesHoliday.discountType) {
            case 'full':
              holidayDiscountAmount = fee.amount; // 100% discount
              break;
            case 'half':
              holidayDiscountAmount = fee.amount * 0.5; // 50% discount
              break;
            case 'quarter':
              holidayDiscountAmount = fee.amount * 0.25; // 25% discount
              break;
            case 'percentage':
              if (applicableFeesHoliday.discountValue !== undefined) {
                holidayDiscountAmount = fee.amount * (applicableFeesHoliday.discountValue / 100);
              }
              break;
          }

          finalAmount = Math.max(0, fee.amount - holidayDiscountAmount);
          console.log(`🎫 Applied fees holiday to previous term fee "${fee.name}": ${fee.amount} - ${holidayDiscountAmount} = ${finalAmount}`);
        }

        // Find discounts assigned to this pupil that are linked to this fee and valid for that period
        const assignedDiscounts = historicalPupil.assignedFees?.filter(assignedFee => {
          // Inline pivot discount
          if (assignedFee.feeStructureId.startsWith('pivot-') && assignedFee.inlineDiscount) {
            const linksThisFee = assignedFee.inlineDiscount.linkedFeeIds?.includes(fee.id);
            if (!linksThisFee) return false;
            return isAssignmentCurrentlyValid(assignedFee, period.termId, period.academicYear, allAcademicYears);
          }

          const discountStructure = allFeeStructures.find(fs => fs.id === assignedFee.feeStructureId);
          const isDiscount = discountStructure &&
            (discountStructure.category === 'Discount' || discountStructure.amount < 0) &&
            (discountStructure.linkedFeeIds?.includes(fee.id) || discountStructure.linkedFeeId === fee.id);

          if (!isDiscount) return false;

          // Check if the discount assignment was valid for that specific period
          return isAssignmentCurrentlyValid(assignedFee, period.termId, period.academicYear, allAcademicYears);
        }) || [];

        if (assignedDiscounts.length > 0) {
          let totalDiscountAmount = 0;

          for (const assignedDiscount of assignedDiscounts) {
            // Inline pivot discount: read amount from inlineDiscount
            if (assignedDiscount.feeStructureId.startsWith('pivot-') && assignedDiscount.inlineDiscount) {
              totalDiscountAmount += Math.abs(assignedDiscount.inlineDiscount.amount);
              console.log(`💸 Applied previous term pivot discount "${assignedDiscount.inlineDiscount.name}" to fee "${fee.name}": ${assignedDiscount.inlineDiscount.amount}`);
              continue;
            }

            const discountStructure = allFeeStructures.find(fs => fs.id === assignedDiscount.feeStructureId);
            if (discountStructure && typeof discountStructure.amount === 'number') {
              if (discountStructure.amount < 0) {
                // Fixed amount discount (negative value)
                totalDiscountAmount += Math.abs(discountStructure.amount);
              } else {
                // Percentage discount (positive value represents percentage)
                totalDiscountAmount += (fee.amount * discountStructure.amount / 100);
              }

              console.log(`💸 Applied previous term discount "${discountStructure.name}" to fee "${fee.name}": ${discountStructure.amount}`);
            }
          }

          // Apply regular discounts on top of fees holiday (if any)
          finalAmount = Math.max(0, finalAmount - totalDiscountAmount);
          console.log(`📊 Previous term fee "${fee.name}" after all discounts: ${fee.amount} -> ${finalAmount}`);
        }

        // 🔥 CRITICAL FIX: Pass the period's academic year and term to filter payments correctly
        // This ensures we only count payments made in that specific period, not payments from other years
        const paymentCalculation = calculateFeePayments(
          fee.id,
          allPayments,
          period.academicYear.id,
          period.termId
        );
        const fallbackCarryForwardPayments = getMatchingCarryForwardPayments(
          allPayments,
          {
            feeStructureId: fee.id,
            name: fee.name,
            termId: period.termId,
            termName: period.termName,
            academicYearId: period.academicYear.id,
            academicYearName: period.academicYear.name
          },
          paymentCalculation.feePayments
        );
        const fallbackCarryForwardPaid = fallbackCarryForwardPayments.reduce(
          (sum, payment) => sum + payment.amount,
          0
        );
        const totalPaid = paymentCalculation.totalPaid + fallbackCarryForwardPaid;
        const balance = Math.max(0, finalAmount - totalPaid);

        console.log(`📊 Previous term fee "${fee.name}": Amount=${finalAmount}, Paid=${totalPaid}, Balance=${balance}`);

        if (balance > 0) {
          balanceBreakdown.push({
            name: fee.name,
            amount: finalAmount,
            paid: totalPaid,
            balance,
            term: period.termName,
            year: period.academicYear.name,
            feeStructureId: fee.id,
            termId: period.termId,
            academicYearId: period.academicYear.id
          });
          console.log(`✅ Added to carry forward: ${fee.name} - ${balance} UGX (paid: ${totalPaid} UGX)`);
        } else if (totalPaid > 0) {
          console.log(`✅ Fee "${fee.name}" fully paid: ${totalPaid} UGX`);
        }
      }

      // Process uniform fees for this period
      for (const uniformFee of periodUniformFees) {
        const matchingCarryForwardPayments = getMatchingCarryForwardPayments(
          allPayments,
          {
            feeStructureId: uniformFee.id,
            name: uniformFee.name,
            termId: period.termId,
            termName: period.termName,
            academicYearId: period.academicYear.id,
            academicYearName: period.academicYear.name
          }
        );
        const carryForwardPaid = matchingCarryForwardPayments.reduce(
          (sum, payment) => sum + payment.amount,
          0
        );
        const totalPaid = (uniformFee.paid || 0) + carryForwardPaid;
        const balance = Math.max(0, (uniformFee.balance || 0) - carryForwardPaid);

        if (balance > 0) {
          balanceBreakdown.push({
            name: uniformFee.name,
            amount: uniformFee.amount,
            paid: totalPaid,
            balance,
            term: period.termName,
            year: period.academicYear.name,
            feeStructureId: uniformFee.id, // This is the uniform tracking ID
            termId: period.termId,
            academicYearId: period.academicYear.id
          });
          console.log(`✅ Added uniform to carry forward: ${uniformFee.name} - ${uniformFee.balance} UGX (paid: ${uniformFee.paid} UGX)`);
        } else if (totalPaid > 0) {
          console.log(`✅ Uniform "${uniformFee.name}" fully paid: ${uniformFee.paid} UGX`);
        }
      }
    }

    console.log('📋 Final balance breakdown (including uniforms):', balanceBreakdown);

    if (balanceBreakdown.length === 0) {
      console.log('❌ No previous balances to carry forward');
      return null;
    }

    const totalBalance = balanceBreakdown.reduce((sum, item) => sum + item.balance, 0);

    console.log(`✅ Total previous balance to carry forward (including uniforms): ${totalBalance} UGX`);

    return {
      amount: totalBalance,
      termInfo: {
        term: 'Previous Terms',
        year: 'Multiple Years'
      },
      breakdown: balanceBreakdown
    };
  } catch (error) {
    console.error('Error calculating previous term balances:', error);
    return null;
  }
}

// ─── Fees-active status helpers ────────────────────────────────────────────
// These are intentionally separate from attendance wasPupilActiveOnDate so that
// 'Suspended' (fees owed but barred from class) counts as fees-active without
// affecting attendance calculations.

/** Statuses that make a pupil liable for fees */
const FEES_ACTIVE_STATUSES = new Set(['Active', 'Suspended', 'Pending', '']);

/**
 * Reconstructs a pupil's status on a specific date by replaying statusChangeHistory.
 * Returns the raw status string (not boolean) so the caller can validate against
 * a fees-specific active-set that may differ from the attendance active-set.
 */
function getPupilStatusOnDate(pupil: Pupil, dateStr: string): string {
  const targetDate = dateStr.split('T')[0];

  if (!pupil.statusChangeHistory || pupil.statusChangeHistory.length === 0) {
    return pupil.status;
  }

  const sortedHistory = [...pupil.statusChangeHistory].sort(
    (a, b) => a.date.localeCompare(b.date)
  );

  let current: string =
    sortedHistory[0].fromStatus === 'N/A' ? 'Active' : sortedHistory[0].fromStatus;

  for (const entry of sortedHistory) {
    const entryDate = entry.date.split('T')[0];
    if (entryDate <= targetDate) {
      current = entry.toStatus;
    } else {
      break;
    }
  }

  return current;
}

/**
 * Returns true if the pupil is fees-eligible during a given term.
 *
 * Two-point check (START date OR END date):
 *
 *   • Check START DATE first: handles normal active terms AND the graduation
 *     term itself. A pupil who graduates at the very end of T3 2025 was still
 *     fully enrolled at T3's start — so T3 must be included in their fees.
 *
 *   • Also check END DATE: handles mid-term enrolment / re-activation.
 *     If a pupil was inactive at T1 2026 start but reactivated before T1
 *     ends, T1 is included (user-confirmed requirement).
 *
 *   • A pupil with no history: current status is assumed for all terms.
 *
 * Result matrix:
 *   Start=Active,  End=Active     → ✅ included (normal term)
 *   Start=Active,  End=Graduated  → ✅ included (graduation term — T3 2025)
 *   Start=Graduated, End=Graduated → ❌ excluded (post-graduation terms)
 *   Start=Inactive, End=Active    → ✅ included (mid-term activation)
 */
function hasStatusTransitionDuringTerm(
  pupil: Pupil,
  term: { startDate: string; endDate: string },
  toStatus: string
): boolean {
  const termStart = term.startDate.split('T')[0];
  const termEnd = term.endDate.split('T')[0];

  return (pupil.statusChangeHistory || []).some(entry => {
    const entryDate = entry.date.split('T')[0];
    return entry.toStatus === toStatus && entryDate >= termStart && entryDate <= termEnd;
  });
}

export function isPupilFeesActiveForTerm(
  pupil: Pupil,
  term: { startDate: string; endDate: string }
): boolean {
  if (!pupil.statusChangeHistory || pupil.statusChangeHistory.length === 0) {
    return FEES_ACTIVE_STATUSES.has(pupil.status);
  }

  // Active at term start → include (catches normal terms + graduation term)
  const statusAtTermStart = getPupilStatusOnDate(pupil, term.startDate);
  const statusAtTermEnd = getPupilStatusOnDate(pupil, term.endDate);

  // Active by term end covers normal, newly activated, and reactivated terms.
  // Graduation keeps its term as the only start-date exception.
  if (FEES_ACTIVE_STATUSES.has(statusAtTermEnd)) return true;

  // Active at term end → include (catches mid-term re-activation)
  return (
    FEES_ACTIVE_STATUSES.has(statusAtTermStart) &&
    hasStatusTransitionDuringTerm(pupil, term, 'Graduated')
  );
}
// ────────────────────────────────────────────────────────────────────────────

/**
 * Gets all previous academic periods before the current term/year,
 * filtered by pupil registration date and fees-active status.
 */
function getPreviousPeriods(
  currentTermId: string,
  currentAcademicYear: AcademicYear,
  allAcademicYears: AcademicYear[],
  pupilRegistrationDate?: string,
  pupil?: Pupil
): Array<{ termId: string; termName: string; academicYear: AcademicYear }> {
  const periods: Array<{ termId: string; termName: string; academicYear: AcademicYear }> = [];

  console.log('🔍 Getting previous periods:', {
    currentTermId,
    currentAcademicYear: currentAcademicYear.name,
    currentAcademicYearTerms: currentAcademicYear.terms.map(t => ({ id: t.id, name: t.name })),
    allAcademicYears: allAcademicYears.map(y => ({ id: y.id, name: y.name })),
    pupilRegistrationDate
  });

  // Find the current term index in the current academic year
  const currentTermIndex = currentAcademicYear.terms.findIndex(term => term.id === currentTermId);

  console.log(`📍 Current term "${currentTermId}" found at index: ${currentTermIndex}`);

  // Sort academic years by start date for proper chronological order
  const sortedYears = allAcademicYears.sort((a, b) => {
    const dateA = new Date(a.startDate).getTime();
    const dateB = new Date(b.startDate).getTime();
    return dateA - dateB;
  });

  // Current academic year date for comparison
  const currentYearStartDate = new Date(currentAcademicYear.startDate);

  for (const year of sortedYears) {
    const yearStartDate = new Date(year.startDate);

    console.log(`🗓️ Processing year: ${year.name} (start: ${year.startDate}, current: ${currentAcademicYear.name})`);

    // Skip future years (years that start after current academic year)
    if (yearStartDate > currentYearStartDate) {
      console.log(`⏭️ Skipping future year: ${year.name}`);
      continue;
    }

    // Skip entire academic year if it ended before pupil registration
    if (pupilRegistrationDate && !isAcademicYearValidForPupil(year, pupilRegistrationDate)) {
      console.log(`⏭️ Skipping year ${year.name}: ended before pupil registration (${pupilRegistrationDate})`);
      continue;
    }

    // For current year, only include previous terms
    if (year.id === currentAcademicYear.id) {
      console.log(`📅 Processing current year terms (before index ${currentTermIndex})`);
      for (let i = 0; i < currentTermIndex; i++) {
        const term = year.terms[i];
        if (term) {
          // Check if term is valid for pupil (started on or after registration)
          if (pupilRegistrationDate && !isTermValidForPupil(term, pupilRegistrationDate)) {
            console.log(`⏭️ Skipping term ${term.name}: started before pupil registration`);
            continue;
          }

          // Skip terms where the pupil was not fees-active (status-aware check)
          if (pupil && !isPupilFeesActiveForTerm(pupil, term)) {
            console.log(`⏭️ Skipping term ${term.name}: pupil was not fees-active (Graduated/Transferred/Inactive)`);
            continue;
          }

          periods.push({
            termId: term.id,
            termName: term.name,
            academicYear: year
          });
          console.log(`✅ Added previous term: ${term.name} (${term.id})`);
        }
      }
    } else {
      // For previous years, include all terms (that are valid for the pupil)
      console.log(`📅 Processing previous year: ${year.name}`);
      for (const term of year.terms) {
        // Check if term is valid for pupil (started on or after registration)
        if (pupilRegistrationDate && !isTermValidForPupil(term, pupilRegistrationDate)) {
          console.log(`⏭️ Skipping term ${term.name}: started before pupil registration`);
          continue;
        }

        // Skip terms where the pupil was not fees-active (status-aware check)
        if (pupil && !isPupilFeesActiveForTerm(pupil, term)) {
          console.log(`⏭️ Skipping term ${term.name}: pupil was not fees-active (Graduated/Transferred/Inactive)`);
          continue;
        }

        periods.push({
          termId: term.id,
          termName: term.name,
          academicYear: year
        });
        console.log(`✅ Added term from previous year: ${term.name} (${term.id})`);
      }
    }
  }

  console.log(`📊 Total previous periods found: ${periods.length}`);

  return periods;
}

/**
 * Determines the type of payment based on amount and balance
 */
export function determinePaymentType(amount: number, balance: number): PaymentType {
  if (amount === balance) {
    return PaymentType.FULL_PAYMENT;
  } else if (amount < balance) {
    return PaymentType.PARTIAL_PAYMENT;
  } else if (amount > balance) {
    return PaymentType.OVERPAYMENT;
  } else {
    return PaymentType.BALANCE_PAYMENT;
  }
}

/**
 * Validates payment amount against fee balance
 */
export function validatePaymentAmount(
  amount: number,
  balance: number
): { isValid: boolean; error?: string } {
  if (amount <= 0) {
    return { isValid: false, error: 'Payment amount must be greater than zero' };
  }

  if (amount > balance * 1.1) { // Allow 10% overpayment
    return {
      isValid: false,
      error: `Payment amount cannot exceed ${(balance * 1.1).toLocaleString()} UGX (110% of balance)`
    };
  }

  return { isValid: true };
}

/**
 * Formats currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX'
  }).format(amount);
}

/**
 * Creates a previous balance fee item
 * @param previousBalance - The calculated previous term balance
 * @param allPayments - All payments for the pupil
 * @param currentAcademicYearId - The academic year ID we're viewing fees for (optional, for filtering payments)
 * @param currentTermId - The term ID we're viewing fees for (optional, for filtering payments)
 */
export function createPreviousBalanceFee(
  previousBalance: PreviousTermBalance,
  allPayments: PaymentRecord[] = [],
  currentAcademicYearId?: string,
  currentTermId?: string
): PupilFee {
  // Get ALL carry forward payments for display and total paid calculation
  const allCarryForwardPayments = allPayments.filter(payment => {
    if (payment.feeStructureId !== 'previous-balance' || payment.reverted) {
      return false;
    }

    if (!(payment as any).isCarryForwardPayment) {
      return false;
    }

    return true;
  });

  // 🔥 CRITICAL FIX: Do NOT re-adjust breakdown balances here!
  // calculatePreviousTermBalances already accounts for carry forward payments
  // via calculateFeePayments. Adding them again would double-count payments,
  // causing balances to incorrectly show 0.
  // The breakdown from previousBalance already has correct paid/balance values.
  const breakdown = previousBalance.breakdown;

  // Filter out items that are fully paid
  const itemsWithBalance = breakdown.filter(item => item.balance > 0);

  // Calculate total paid from carry forward payments (for display purposes)
  const totalPaid = allCarryForwardPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalBalance = itemsWithBalance.reduce((sum, item) => sum + item.balance, 0);

  // Get payments made in the CURRENT term for display in the payments list
  const currentTermPayments = currentAcademicYearId && currentTermId
    ? allCarryForwardPayments.filter(payment =>
      payment.academicYearId === currentAcademicYearId &&
      payment.termId === currentTermId
    )
    : allCarryForwardPayments;

  console.log(`📊 Previous balance fee created:`, {
    currentAcademicYearId,
    currentTermId,
    originalAmount: previousBalance.amount,
    carryForwardPayments: allCarryForwardPayments.length,
    totalPaid,
    totalBalance,
    itemsWithBalance: itemsWithBalance.length,
    totalItems: breakdown.length
  });

  return {
    id: 'previous-balance',
    name: 'Previous Term Balances',
    description: 'Outstanding balances from previous terms',
    amount: previousBalance.amount,
    category: 'Other Fee',
    academicYearId: 'multiple',
    termId: 'previous-terms',
    classFeeType: 'all',
    sectionFeeType: 'all',
    isRequired: true,
    isRecurring: false,
    status: 'active',
    createdAt: new Date().toISOString(),
    paid: totalPaid,
    balance: totalBalance,
    payments: currentTermPayments,
    feeBreakdown: breakdown // Use breakdown as-is (already has correct balances)
  } as PupilFee;
}


/**
 * Determines if an academic year is valid for a pupil based on registration date
 */
export function isAcademicYearValidForPupil(
  academicYear: AcademicYear,
  pupilRegistrationDate?: string
): boolean {
  if (!pupilRegistrationDate) return true; // If no registration date, allow all terms

  const registrationDate = new Date(pupilRegistrationDate);
  const yearEndDate = new Date(academicYear.endDate);

  // Academic year is valid if it ended on or after the pupil's registration date
  return yearEndDate >= registrationDate;
}

/**
 * Determines if a term is valid for a pupil based on registration date
 */
export function isTermValidForPupil(
  term: { id: string; name: string; startDate: string; endDate: string },
  pupilRegistrationDate?: string
): boolean {
  if (!pupilRegistrationDate) return true; // If no registration date, allow all terms

  const registrationDate = new Date(pupilRegistrationDate);
  const termEndDate = new Date(term.endDate);

  // Term is valid if the pupil was registered before or during the term
  // (i.e., registration date is on or before the term's end date)
  return registrationDate <= termEndDate;
}

/**
 * Filters academic years to only include those valid for a pupil
 */
export function getValidAcademicYearsForPupil(
  academicYears: AcademicYear[],
  pupilRegistrationDate?: string,
  pupil?: Pupil
): AcademicYear[] {
  // Step 1: filter by registration date (existing logic)
  let filtered = pupilRegistrationDate
    ? academicYears.filter(year => isAcademicYearValidForPupil(year, pupilRegistrationDate))
    : [...academicYears];

  // Step 2: if pupil provided, exclude years where pupil was not fees-active in ANY term
  // A year is kept only if at least one of its terms passes the fees-active status check.
  if (pupil) {
    filtered = filtered.filter(year =>
      year.terms.some(term => isPupilFeesActiveForTerm(pupil, term))
    );
  }

  return filtered;
}

/**
 * Filters terms within an academic year to only include those valid for a pupil
 */
export function getValidTermsForPupil(
  academicYear: AcademicYear,
  pupilRegistrationDate?: string,
  pupil?: Pupil
): AcademicYear['terms'] {
  // Step 1: filter by registration date (existing logic)
  let terms = pupilRegistrationDate
    ? academicYear.terms.filter(term => isTermValidForPupil(term, pupilRegistrationDate))
    : [...academicYear.terms];

  // Step 2: if pupil provided, exclude terms where pupil was not fees-active
  if (pupil) {
    terms = terms.filter(term => isPupilFeesActiveForTerm(pupil, term));
  }

  return terms;
}

/**
 * Finds the most recent term where the pupil had fees-active status.
 * Used to default the year/term selector when the pupil is currently inactive
 * (Graduated, Transferred, Inactive) — defaults to their last active term
 * rather than the globally current term.
 *
 * @param validAcademicYears  Already-filtered list (from getValidAcademicYearsForPupil)
 * @param pupil               The pupil object with statusChangeHistory
 * @returns { academicYear, term } for the last fees-active term, or null
 */
export function getLastActiveTermForPupil(
  validAcademicYears: AcademicYear[],
  pupil: Pupil
): { academicYear: AcademicYear; term: AcademicYear['terms'][number] } | null {
  // Sort years newest-first
  const sortedYears = [...validAcademicYears].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );

  for (const year of sortedYears) {
    // Sort terms newest-first within the year
    const sortedTerms = [...(year.terms || [])].sort(
      (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );

    for (const term of sortedTerms) {
      if (isPupilFeesActiveForTerm(pupil, term)) {
        return { academicYear: year, term };
      }
    }
  }

  return null;
}

/**
 * Determines if a pupil should appear in the fees collection list for a given term
 */
export function isPupilValidForTerm(
  pupil: Pupil,
  term: { id: string; name: string; startDate: string; endDate: string },
  academicYear: AcademicYear
): boolean {
  if (!isPupilFeesActiveForTerm(pupil, term)) return false;

  if (!pupil.registrationDate) return true; // If no registration date, show in all fees-active terms

  const registrationDate = new Date(pupil.registrationDate);
  const termEndDate = new Date(term.endDate);

  // Pupil should appear if the term ended on or after their registration date
  return termEndDate >= registrationDate;
}

/**
 * Validates if a term ID exists in the given academic year
 */
export function isValidTermForAcademicYear(
  termId: string,
  academicYear: AcademicYear
): boolean {
  return academicYear.terms.some(term => term.id === termId);
}
