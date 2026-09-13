import { PaymentsService } from '@/lib/services/payments.service';
import type { PaymentRecord } from '@/types';

export interface CarryForwardItem {
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

export interface CarryForwardPaymentData {
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
  operationId?: string;
  paymentDate?: string;
}

function createCarryForwardOperationId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `carry-${crypto.randomUUID()}`;
  }
  return `carry-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

export interface PaymentDistribution {
  item: CarryForwardItem;
  allocatedAmount: number;
  currentTermPayment: Omit<PaymentRecord, 'id' | 'createdAt'>;
}

export interface PreparedCarryForwardPayment {
  distributions: PaymentDistribution[];
  allocations: Array<{
    paymentData: Omit<PaymentRecord, 'id' | 'createdAt'>;
    historyContext: {
      feeName: string;
      paymentMethod: string;
      source: string;
      paidByName: string;
    };
  }>;
}

/**
 * Distribute a whole-UGX payment without creating or losing money through
 * independent rounding. Ties are resolved by the original fee order so the
 * same request always produces the same allocation.
 */
export function calculateCarryForwardPaymentDistribution(
  amount: number,
  paymentType: 'general' | 'item-specific',
  feeBreakdown: CarryForwardItem[],
  targetItem?: CarryForwardItem
): PaymentDistribution[] {
  if (paymentType === 'item-specific' && targetItem) {
    // For item-specific payments, allocate entire amount to the target item
    const allocatedAmount = Math.min(amount, targetItem.balance);
    
    if (allocatedAmount > 0) {
      return [{
        item: targetItem,
        allocatedAmount,
        currentTermPayment: {} as any   // Will be filled later
      }];
    }
    return [];
  }

  const eligibleItems = feeBreakdown
    .map((item, index) => ({ item, index, balance: Math.max(0, item.balance) }))
    .filter(({ balance }) => balance > 0);
  const totalBalance = eligibleItems.reduce((sum, { balance }) => sum + balance, 0);
  if (totalBalance <= 0) return [];

  const distributableAmount = Math.min(amount, totalBalance);
  if (distributableAmount === totalBalance) {
    return eligibleItems.map(({ item, balance }) => ({
      item,
      allocatedAmount: balance,
      currentTermPayment: {} as Omit<PaymentRecord, 'id' | 'createdAt'>,
    }));
  }

  const proportionalAllocations = eligibleItems.map(({ item, index, balance }) => {
    const exactShare = (distributableAmount * balance) / totalBalance;
    const allocatedAmount = Math.floor(exactShare);
    return { item, index, balance, allocatedAmount, remainder: exactShare - allocatedAmount };
  });
  let unitsRemaining = distributableAmount - proportionalAllocations.reduce(
    (sum, allocation) => sum + allocation.allocatedAmount,
    0,
  );

  for (const allocation of [...proportionalAllocations].sort(
    (left, right) => right.remainder - left.remainder || left.index - right.index,
  )) {
    if (unitsRemaining === 0) break;
    if (allocation.allocatedAmount < allocation.balance) {
      allocation.allocatedAmount += 1;
      unitsRemaining -= 1;
    }
  }

  return proportionalAllocations
    .filter(({ allocatedAmount }) => allocatedAmount > 0)
    .map(({ item, allocatedAmount }) => ({
      item,
      allocatedAmount,
      currentTermPayment: {} as Omit<PaymentRecord, 'id' | 'createdAt'>,
    }));
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
    paymentDate: paymentData.paymentDate || new Date().toISOString(),
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
 * Prepares the exact carry-forward allocations without writing them. A mixed
 * fee submission can include these records in its one payment operation,
 * rather than committing carry-forward entries in a separate request.
 */
export function prepareCarryForwardPayment(
  paymentData: CarryForwardPaymentData,
): PreparedCarryForwardPayment {
  const validation = validateCarryForwardPayment(paymentData);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid carry forward payment');
  }

  const distributions = calculateCarryForwardPaymentDistribution(
    paymentData.amount,
    paymentData.paymentType,
    paymentData.feeBreakdown,
    paymentData.targetItem,
  );
  if (distributions.length === 0) {
    throw new Error('No valid items found for payment distribution');
  }

  distributions.forEach(distribution => createPaymentRecords(distribution, paymentData));
  return {
    distributions,
    allocations: distributions.map(distribution => ({
      paymentData: distribution.currentTermPayment,
      historyContext: {
        feeName: distribution.item.name,
        paymentMethod: 'Carry Forward',
        source: 'carry_forward_payment',
        paidByName: paymentData.paidBy.name,
      },
    })),
  };
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
  const { amount, paymentType } = paymentData;
  const paymentIds: string[] = [];
  let distributions: PaymentDistribution[] = [];

  try {
    const prepared = prepareCarryForwardPayment(paymentData);
    distributions = prepared.distributions;

    const operationId = paymentData.operationId || createCarryForwardOperationId();
    const { allocations } = prepared;

    // The whole carry-forward distribution is one durable command: either all
    // allocations and history records commit, or none do. Retrying the same ID
    // returns the original payment IDs instead of adding another allocation.
    if (typeof window !== 'undefined') {
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationId, allocations }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create carry forward payment');
      }
      const result = await response.json();
      paymentIds.push(...(result.paymentIds || []));
    } else {
      const result = await PaymentsService.createPaymentOperation(operationId, allocations);
      paymentIds.push(...result.paymentIds);
    }

    if (paymentIds.length !== distributions.length) {
      throw new Error('The payment operation did not return every saved allocation');
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
      paymentIds,
      distributions,
      message: paymentIds.length > 0
        ? `Some payment records were already saved. Do not submit again; ${
          error instanceof Error ? error.message : 'the remaining allocation could not be saved'
        }`
        : error instanceof Error ? error.message : 'Failed to process payment'
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

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return { isValid: false, error: 'Payment amount must be a positive whole UGX amount' };
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
    const totalBalance = feeBreakdown.reduce((sum, item) => sum + Math.max(0, item.balance), 0);
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
