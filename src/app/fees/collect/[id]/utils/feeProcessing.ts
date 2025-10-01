import type { 
  AcademicYear, 
  Pupil, 
  FeeStructure, 
  PaymentRecord,
  PupilAssignedFee,
  PupilTermSnapshot
} from '@/types';
import { PupilSnapshotsService } from '@/lib/services/pupil-snapshots.service';
import type { 
  PupilFee, 
  PreviousTermBalance 
} from '../types';
import { PaymentType } from '../types';

/**
 * Checks if an assignment is currently valid based on its time settings
 */
function isAssignmentCurrentlyValid(
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

    // Check if fee is for the correct academic year (strict matching for carry-forward accuracy)
    // Include if no specific year set (universal fees) or exact academic year match
    if (fee.academicYearId) {
      if (fee.academicYearId !== academicYear.id) {
        console.log(`❌ Fee "${fee.name}" rejected: wrong academic year (fee.academicYearId=${fee.academicYearId} !== academicYear.id=${academicYear.id})`);
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
      if (fee.termId !== termId) {
        console.log(`❌ Fee "${fee.name}" rejected: wrong term (fee.termId=${fee.termId} !== termId=${termId})`);
        return false;
      } else {
        console.log(`✅ Fee "${fee.name}" term check passed: exact term match (${fee.termId})`);
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
 */
export function calculateFeePayments(
  feeId: string,
  payments: PaymentRecord[]
): { totalPaid: number; balance: number; feePayments: PaymentRecord[] } {
  // Get direct payments to this fee
  const directFeePayments = payments.filter(payment => 
    payment.feeStructureId === feeId && !payment.reverted
  );
  
  // Get carry forward payments that were made for this fee
  // These are payments with feeStructureId 'previous-balance' but originalFeeStructureId matching this fee
  const carryForwardPayments = payments.filter(payment => 
    payment.feeStructureId === 'previous-balance' && 
    !payment.reverted &&
    (payment as any).originalFeeStructureId === feeId
  );
  
  // Get payments that were made in current term but recorded against original term
  // BUT exclude those that already have a corresponding 'previous-balance' record to avoid duplicates
  const originalTermPayments = payments.filter(payment =>
    payment.feeStructureId === feeId &&
    !payment.reverted &&
    (payment as any).isCarryForwardPayment &&
    // Only include if there's no corresponding previous-balance payment
    !carryForwardPayments.some(cfPayment => 
      Math.abs(cfPayment.amount - payment.amount) < 0.01 && // Same amount
      Math.abs(new Date(cfPayment.paymentDate).getTime() - new Date(payment.paymentDate).getTime()) < 60000 && // Within 1 minute
      (cfPayment as any).originalFeeStructureId === payment.feeStructureId
    )
  );
  
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
    directPayments: directFeePayments.length,
    carryForwardPayments: carryForwardPayments.length,
    originalTermPayments: originalTermPayments.length,
    totalBeforeDedup: allFeePayments.length,
    totalAfterDedup: uniquePayments.length,
    totalPaid,
    uniquePaymentIds: uniquePayments.map(p => ({ id: p.id, amount: p.amount, feeStructureId: p.feeStructureId }))
  });
  
  return {
    totalPaid,
    balance: 0, // Will be calculated when we have the fee amount
    feePayments: uniquePayments
  };
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
  allAcademicYears: AcademicYear[] = []
): PupilFee[] {
  console.log('💰 Processing pupil fees with discounts:', {
    feeStructuresCount: feeStructures.length,
    allFeeStructuresCount: allFeeStructures.length,
    pupilAssignedFees: pupil.assignedFees?.length || 0
  });

  // Find discounts assigned to this pupil that are currently valid
  const assignedDiscounts = pupil.assignedFees?.filter(assignedFee => {
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
      discountName: discountStructure?.name,
      linkedFeeId: discountStructure?.linkedFeeId,
      discountAmount: discountStructure?.amount,
      assignmentStatus: ad.status,
      validityType: ad.validityType
    };
  }));

  return feeStructures.map(fee => {
    const { totalPaid, feePayments } = calculateFeePayments(fee.id, payments);
    
    // Apply discounts if any are linked to this fee
    let finalAmount = fee.amount;
    let discount = undefined;
    let originalAmount = undefined;
    
    // Find discounts that are linked to this specific fee
    const applicableDiscounts = assignedDiscounts.filter(assignedDiscount => {
      const discountStructure = allFeeStructures.find(fs => fs.id === assignedDiscount.feeStructureId);
      return discountStructure && discountStructure.linkedFeeId === fee.id;
    });

    if (applicableDiscounts.length > 0) {
      originalAmount = fee.amount;
      let totalDiscountAmount = 0;
      
      // Apply all applicable discounts
      for (const assignedDiscount of applicableDiscounts) {
        const discountStructure = allFeeStructures.find(fs => fs.id === assignedDiscount.feeStructureId);
        if (discountStructure && typeof discountStructure.amount === 'number') {
          if (discountStructure.amount < 0) {
            // Fixed amount discount (negative value)
            totalDiscountAmount += Math.abs(discountStructure.amount);
          } else {
            // Percentage discount (positive value represents percentage)
            totalDiscountAmount += (fee.amount * discountStructure.amount / 100);
          }
          
          console.log(`💸 Applied discount "${discountStructure.name}" to fee "${fee.name}": ${discountStructure.amount}`);
        }
      }
      
      finalAmount = Math.max(0, fee.amount - totalDiscountAmount);
      
      // Create discount info for display
      if (applicableDiscounts.length === 1) {
        const discountStructure = allFeeStructures.find(fs => fs.id === applicableDiscounts[0].feeStructureId);
        discount = {
          id: applicableDiscounts[0].feeStructureId,
          name: discountStructure?.name || 'Discount',
          amount: totalDiscountAmount,
          type: (discountStructure?.amount && discountStructure.amount < 0) ? 'fixed' : 'percentage'
        };
      } else {
        // Multiple discounts
        discount = {
          id: 'multiple-discounts',
          name: `${applicableDiscounts.length} Discounts Applied`,
          amount: totalDiscountAmount,
          type: 'fixed'
        };
      }
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
    const previousPeriods = getPreviousPeriods(currentTermId, currentAcademicYear, allAcademicYears, pupil.registrationDate);
    
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
        
        // Find discounts assigned to this pupil that are linked to this fee and valid for that period
        const assignedDiscounts = historicalPupil.assignedFees?.filter(assignedFee => {
          const discountStructure = allFeeStructures.find(fs => fs.id === assignedFee.feeStructureId);
          const isDiscount = discountStructure && 
                 (discountStructure.category === 'Discount' || discountStructure.amount < 0) &&
                 discountStructure.linkedFeeId === fee.id;
          
          if (!isDiscount) return false;
          
          // Check if the discount assignment was valid for that specific period
          return isAssignmentCurrentlyValid(assignedFee, period.termId, period.academicYear, allAcademicYears);
        }) || [];

        if (assignedDiscounts.length > 0) {
          let totalDiscountAmount = 0;
          
          for (const assignedDiscount of assignedDiscounts) {
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
          
          finalAmount = Math.max(0, fee.amount - totalDiscountAmount);
          console.log(`📊 Previous term fee "${fee.name}" after discounts: ${fee.amount} - ${totalDiscountAmount} = ${finalAmount}`);
        }
        
        const { totalPaid } = calculateFeePayments(fee.id, allPayments);
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
        if (uniformFee.balance > 0) {
          balanceBreakdown.push({
            name: uniformFee.name,
            amount: uniformFee.amount,
            paid: uniformFee.paid,
            balance: uniformFee.balance,
            term: period.termName,
            year: period.academicYear.name,
            feeStructureId: uniformFee.id, // This is the uniform tracking ID
            termId: period.termId,
            academicYearId: period.academicYear.id
          });
          console.log(`✅ Added uniform to carry forward: ${uniformFee.name} - ${uniformFee.balance} UGX (paid: ${uniformFee.paid} UGX)`);
        } else if (uniformFee.paid > 0) {
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

/**
 * Gets all previous academic periods before the current term/year, 
 * filtered by pupil registration date
 */
function getPreviousPeriods(
  currentTermId: string,
  currentAcademicYear: AcademicYear,
  allAcademicYears: AcademicYear[],
  pupilRegistrationDate?: string
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
 */
export function createPreviousBalanceFee(
  previousBalance: PreviousTermBalance,
  allPayments: PaymentRecord[] = []
): PupilFee {
  // Calculate how much has been paid towards the previous balance
  const carryForwardPayments = allPayments.filter(payment => 
    payment.feeStructureId === 'previous-balance' && 
    !payment.reverted &&
    (payment as any).isCarryForwardPayment
  );
  
  const totalPaid = carryForwardPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const currentBalance = Math.max(0, previousBalance.amount - totalPaid);
  
  console.log(`📊 Previous balance calculation:`, {
    originalAmount: previousBalance.amount,
    carryForwardPayments: carryForwardPayments.length,
    totalPaid,
    currentBalance
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
    balance: currentBalance,
    payments: carryForwardPayments,
    feeBreakdown: previousBalance.breakdown
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
  pupilRegistrationDate?: string
): AcademicYear[] {
  if (!pupilRegistrationDate) return academicYears;
  
  return academicYears.filter(year => 
    isAcademicYearValidForPupil(year, pupilRegistrationDate)
  );
}

/**
 * Filters terms within an academic year to only include those valid for a pupil
 */
export function getValidTermsForPupil(
  academicYear: AcademicYear,
  pupilRegistrationDate?: string
): AcademicYear['terms'] {
  if (!pupilRegistrationDate) return academicYear.terms;
  
  return academicYear.terms.filter(term => 
    isTermValidForPupil(term, pupilRegistrationDate)
  );
}

/**
 * Determines if a pupil should appear in the fees collection list for a given term
 */
export function isPupilValidForTerm(
  pupil: Pupil,
  term: { id: string; name: string; startDate: string; endDate: string },
  academicYear: AcademicYear
): boolean {
  if (!pupil.registrationDate) return true; // If no registration date, show in all terms
  
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