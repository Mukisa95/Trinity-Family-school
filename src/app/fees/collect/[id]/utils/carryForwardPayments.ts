import { PaymentsService } from '@/lib/services/payments.service';
import type { PaymentRecord } from '@/types';

interface CarryForwardItem {
  name: string;
  amount: number;
  paid: number;
  balance: number;
  term: string;
  year: string;
  feeStructureId?: string;
  termId?: string;
  academicYearId?: string;
}

interface CarryForwardPaymentData {
  pupilId: string;
  currentTermId: string;
  currentAcademicYearId: string;
  amount: number;
  paymentType: 'general' | 'item-specific';
  targetItem?: CarryForwardItem;
  feeBreakdown: CarryForwardItem[];
  paidBy: {
    id: string;
    name: string;
    role: string;
  };
}

interface PaymentDistribution {
  item: CarryForwardItem;
  allocatedAmount: number;
  currentTermPayment: Omit<PaymentRecord, 'id' | 'createdAt'>;
}

/**
 * Calculates how payment should be distributed across carry forward items
 */
function calculatePaymentDistribution(
  amount: number,
  paymentType: 'general' | 'item-specific',
  feeBreakdown: CarryForwardItem[],
  targetItem?: CarryForwardItem
): PaymentDistribution[] {
  const distributions: PaymentDistribution[] = [];

  if (paymentType === 'item-specific' && targetItem) {
    // For item-specific payments, allocate entire amount to the target item
    const allocatedAmount = Math.min(amount, targetItem.balance);
    
    if (allocatedAmount > 0) {
      distributions.push({
        item: targetItem,
        allocatedAmount,
        currentTermPayment: {} as any   // Will be filled later
      });
    }
  } else {
    // For general payments, distribute proportionally based on balances
    const totalBalance = feeBreakdown.reduce((sum, item) => sum + item.balance, 0);
    
    if (totalBalance > 0) {
      for (const item of feeBreakdown) {
        const proportion = item.balance / totalBalance;
        const allocatedAmount = Math.round(amount * proportion);
        
        if (allocatedAmount > 0) {
          distributions.push({
            item,
            allocatedAmount,
            currentTermPayment: {} as any   // Will be filled later
          });
        }
      }
    }
  }

  return distributions;
}

/**
 * Creates payment records for both original and current terms
 */
function createPaymentRecords(
  distribution: PaymentDistribution,
  paymentData: CarryForwardPaymentData
): void {
  const { pupilId, currentTermId, currentAcademicYearId, paidBy } = paymentData;
  const { item, allocatedAmount } = distribution;

  // Create only ONE payment record in the current term with proper metadata
  // This record will be recognized by both terms through the metadata
  distribution.currentTermPayment = {
    pupilId,
    feeStructureId: 'previous-balance', // Special ID for carry forward payments
    academicYearId: currentAcademicYearId,
    termId: currentTermId,
    amount: allocatedAmount,
    paymentDate: new Date().toISOString(),
    paidBy,
    notes: `Carry forward payment: ${item.name} (${item.term} - ${item.year})`,
    isCarryForwardPayment: true,
    originalFeeStructureId: item.feeStructureId,
    originalTerm: item.term,
    originalYear: item.year,
    originalTermId: item.termId,
    originalAcademicYearId: item.academicYearId,
    carryForwardItemName: item.name,
    paymentMadeInTerm: currentTermId,
    paymentMadeInYear: currentAcademicYearId
  } as any;
}

/**
 * Processes a carry forward payment with proper distribution and dual recording
 */
export async function processCarryForwardPayment(
  paymentData: CarryForwardPaymentData
): Promise<{
  success: boolean;
  paymentIds: string[];
  distributions: PaymentDistribution[];
  message: string;
}> {
  try {
    const { amount, paymentType, feeBreakdown, targetItem } = paymentData;

    // Calculate payment distribution
    const distributions = calculatePaymentDistribution(
      amount,
      paymentType,
      feeBreakdown,
      targetItem
    );

    if (distributions.length === 0) {
      return {
        success: false,
        paymentIds: [],
        distributions: [],
        message: 'No valid items found for payment distribution'
      };
    }

    // Create payment records for each distribution
    for (const distribution of distributions) {
      createPaymentRecords(distribution, paymentData);
    }

    // Submit all payment records to the service
    const paymentIds: string[] = [];
    
    for (const distribution of distributions) {
      try {
        // Create only the current term payment record (which contains all necessary metadata)
        const currentPaymentId = await PaymentsService.createPayment(
          distribution.currentTermPayment
        );
        paymentIds.push(currentPaymentId);

        console.log(`✅ Created carry forward payment record:`, {
          originalTerm: distribution.item.term,
          currentPaymentId,
          amount: distribution.allocatedAmount,
          originalFeeStructureId: distribution.item.feeStructureId
        });

      } catch (error) {
        console.error(`❌ Failed to create payment for ${distribution.item.name}:`, error);
        throw error;
      }
    }

    // Generate success message
    const totalItems = distributions.length;
    const totalAmount = distributions.reduce((sum, d) => sum + d.allocatedAmount, 0);
    
    let message = '';
    if (paymentType === 'general') {
      message = `Payment of ${new Intl.NumberFormat('en-UG', { 
        style: 'currency', 
        currency: 'UGX' 
      }).format(totalAmount)} distributed across ${totalItems} item(s)`;
    } else {
      const targetItemName = distributions[0]?.item.name || 'selected item';
      message = `Payment of ${new Intl.NumberFormat('en-UG', { 
        style: 'currency', 
        currency: 'UGX' 
      }).format(totalAmount)} applied to ${targetItemName}`;
    }

    return {
      success: true,
      paymentIds,
      distributions,
      message
    };

  } catch (error) {
    console.error('Error processing carry forward payment:', error);
    return {
      success: false,
      paymentIds: [],
      distributions: [],
      message: error instanceof Error ? error.message : 'Failed to process payment'
    };
  }
}

/**
 * Validates carry forward payment data
 */
export function validateCarryForwardPayment(
  paymentData: CarryForwardPaymentData
): { isValid: boolean; error?: string } {
  const { amount, paymentType, feeBreakdown, targetItem } = paymentData;

  if (amount <= 0) {
    return { isValid: false, error: 'Payment amount must be greater than zero' };
  }

  if (!feeBreakdown || feeBreakdown.length === 0) {
    return { isValid: false, error: 'No carry forward items found' };
  }

  if (paymentType === 'item-specific') {
    if (!targetItem) {
      return { isValid: false, error: 'Target item is required for item-specific payments' };
    }
    
    if (amount > targetItem.balance) {
      return { 
        isValid: false, 
        error: `Payment amount cannot exceed item balance of ${new Intl.NumberFormat('en-UG', { 
          style: 'currency', 
          currency: 'UGX' 
        }).format(targetItem.balance)}` 
      };
    }
  } else {
    const totalBalance = feeBreakdown.reduce((sum, item) => sum + item.balance, 0);
    if (amount > totalBalance) {
      return { 
        isValid: false, 
        error: `Payment amount cannot exceed total balance of ${new Intl.NumberFormat('en-UG', { 
          style: 'currency', 
          currency: 'UGX' 
        }).format(totalBalance)}` 
      };
    }
  }

  return { isValid: true };
}

/**
 * Gets payment history for carry forward items
 */
export async function getCarryForwardPaymentHistory(
  pupilId: string,
  feeBreakdown: CarryForwardItem[]
): Promise<PaymentRecord[]> {
  try {
    const allPayments = await PaymentsService.getPaymentsByPupil(pupilId);
    
    // Filter payments that are related to carry forward items
    const carryForwardPayments = allPayments.filter(payment => {
      // Check if it's a carry forward payment
      if ((payment as any).isCarryForwardPayment) {
        return true;
      }
      
      // Check if it's a payment for any of the carry forward fee structures
      return feeBreakdown.some(item => 
        item.feeStructureId && payment.feeStructureId === item.feeStructureId
      );
    });

    return carryForwardPayments.sort((a, b) => 
      new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
    );

  } catch (error) {
    console.error('Error fetching carry forward payment history:', error);
    return [];
  }
} 