import type { PaymentRecord } from '@/types';
import { PaymentsService } from '@/lib/services/payments.service';

interface PaymentReversalOptions {
  paymentId: string;
  reason: string;
  reversedBy: {
    id: string;
    name: string;
    role: string;
  };
  requiresApproval?: boolean;
}

interface PaymentReversalResult {
  success: boolean;
  reversalId?: string;
  message: string;
  requiresApproval?: boolean;
}

/**
 * Validates if a payment can be reversed
 */
export function validatePaymentReversal(payment: PaymentRecord): {
  canReverse: boolean;
  reason?: string;
} {
  // Check if payment is already reversed
  if (payment.reverted) {
    return {
      canReverse: false,
      reason: 'Payment has already been reversed'
    };
  }

  // Check if payment is too old (e.g., more than 30 days)
  const paymentDate = new Date(payment.paymentDate);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  if (paymentDate < thirtyDaysAgo) {
    return {
      canReverse: false,
      reason: 'Payment is older than 30 days and cannot be reversed without special approval'
    };
  }

  // Check if payment amount is significant (requires approval)
  const significantAmount = 500000; // 500,000 UGX
  if (payment.amount > significantAmount) {
    return {
      canReverse: true,
      reason: 'Large payment amount requires supervisor approval'
    };
  }

  return { canReverse: true };
}

/**
 * Reverses a payment with proper validation and audit trail
 */
export async function reversePayment(
  payment: PaymentRecord,
  options: PaymentReversalOptions
): Promise<PaymentReversalResult> {
  try {
    // Validate the reversal
    const validation = validatePaymentReversal(payment);
    if (!validation.canReverse) {
      return {
        success: false,
        message: validation.reason || 'Payment cannot be reversed'
      };
    }

    // Check if requires approval for large amounts
    const requiresApproval = payment.amount > 500000 || options.requiresApproval;

    // Create reversal record
    const reversalData = {
      originalPaymentId: payment.id,
      pupilId: payment.pupilId,
      feeStructureId: payment.feeStructureId,
      academicYearId: payment.academicYearId,
      termId: payment.termId,
      amount: -payment.amount, // Negative amount for reversal
      paymentDate: new Date().toISOString(),
      paidBy: options.reversedBy,
      isReversal: true,
      reversalReason: options.reason,
      originalPaymentDate: payment.paymentDate,
      status: requiresApproval ? 'pending_approval' : 'completed'
    };

    // Submit reversal to service
    const reversalId = await PaymentsService.createPayment(reversalData);

    // If successful, mark original payment as reversed
    if (reversalId && !requiresApproval) {
      await PaymentsService.revertPayment(payment.id, options.reversedBy);
    }

    return {
      success: true,
      reversalId: reversalId,
      message: requiresApproval 
        ? 'Payment reversal submitted for approval'
        : 'Payment reversed successfully',
      requiresApproval
    };

  } catch (error) {
    console.error('Error reversing payment:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to reverse payment'
    };
  }
}

/**
 * Gets reversal history for a payment
 */
export async function getPaymentReversalHistory(paymentId: string): Promise<PaymentRecord[]> {
  try {
    // For now, we'll return an empty array since the specific method doesn't exist
    // This would need to be implemented in the PaymentsService
    console.log('Reversal history feature needs to be implemented in PaymentsService');
    return [];
  } catch (error) {
    console.error('Error fetching reversal history:', error);
    return [];
  }
}

/**
 * Formats reversal reason for display
 */
export function formatReversalReason(reason: string): string {
  const commonReasons: Record<string, string> = {
    'duplicate_payment': 'Duplicate Payment',
    'incorrect_amount': 'Incorrect Amount',
    'wrong_student': 'Wrong Student Account',
    'wrong_fee': 'Wrong Fee Category',
    'parent_request': 'Parent/Guardian Request',
    'system_error': 'System Error',
    'bank_reversal': 'Bank Reversal',
    'other': 'Other Reason'
  };

  return commonReasons[reason] || reason;
}

/**
 * Calculates the impact of a payment reversal
 */
export function calculateReversalImpact(payment: PaymentRecord): {
  affectedFee: string;
  newBalance: number;
  impactDescription: string;
} {
  return {
    affectedFee: payment.feeStructureId,
    newBalance: payment.amount, // This would be added back to the balance
    impactDescription: `Reversing this payment will increase the fee balance by ${new Intl.NumberFormat('en-UG', { 
      style: 'currency', 
      currency: 'UGX' 
    }).format(payment.amount)}`
  };
}

/**
 * Common reversal reasons for dropdown selection
 */
export const REVERSAL_REASONS = [
  { value: 'duplicate_payment', label: 'Duplicate Payment' },
  { value: 'incorrect_amount', label: 'Incorrect Amount' },
  { value: 'wrong_student', label: 'Wrong Student Account' },
  { value: 'wrong_fee', label: 'Wrong Fee Category' },
  { value: 'parent_request', label: 'Parent/Guardian Request' },
  { value: 'system_error', label: 'System Error' },
  { value: 'bank_reversal', label: 'Bank Reversal' },
  { value: 'other', label: 'Other Reason' }
];

/**
 * Generates a reversal confirmation message
 */
export function generateReversalConfirmation(
  payment: PaymentRecord,
  reason: string
): string {
  const formattedAmount = new Intl.NumberFormat('en-UG', { 
    style: 'currency', 
    currency: 'UGX' 
  }).format(payment.amount);

  const formattedReason = formatReversalReason(reason);

  return `Are you sure you want to reverse this payment of ${formattedAmount}?

Reason: ${formattedReason}
Payment Date: ${new Date(payment.paymentDate).toLocaleDateString('en-UG')}

This action will:
• Increase the student's fee balance by ${formattedAmount}
• Create an audit trail of the reversal
• Require supervisor approval for amounts over 500,000 UGX

This action cannot be undone without creating a new payment.`;
} 