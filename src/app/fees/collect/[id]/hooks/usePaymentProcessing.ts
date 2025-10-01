import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import type { AcademicYear } from '@/types';
import type { PaymentData } from '../types';
import { PaymentType } from '../types';

// Services
import { PaymentsService } from '@/lib/services/payments.service';

// Utilities
import { 
  validatePaymentAmount, 
  determinePaymentType,
  formatCurrency 
} from '../utils/feeProcessing';

interface UsePaymentProcessingOptions {
  pupilId: string;
  selectedTerm: string;
  selectedAcademicYear: AcademicYear | null;
  onPaymentSuccess?: () => void;
  onPaymentError?: (error: Error) => void;
}

interface PaymentSubmissionData {
  feeId: string;
  amount: number;
  balance: number;
}

interface UsePaymentProcessingReturn {
  processPayment: (data: PaymentSubmissionData) => Promise<void>;
  isProcessing: boolean;
  error: Error | null;
}

export function usePaymentProcessing({
  pupilId,
  selectedTerm,
  selectedAcademicYear,
  onPaymentSuccess,
  onPaymentError
}: UsePaymentProcessingOptions): UsePaymentProcessingReturn {
  const queryClient = useQueryClient();

  const paymentMutation = useMutation({
    mutationFn: async (data: PaymentSubmissionData) => {
      // Validate payment amount
      const validation = validatePaymentAmount(data.amount, data.balance);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      if (!selectedAcademicYear) {
        throw new Error('Academic year is required');
      }

      // Find the term ID from the academic year
      const term = selectedAcademicYear.terms.find(t => t.name === selectedTerm);
      if (!term) {
        throw new Error(`Term "${selectedTerm}" not found in academic year`);
      }

      // Determine payment type
      const paymentType = determinePaymentType(data.amount, data.balance);

      // Create payment record
      const paymentData: PaymentData = {
        feeId: data.feeId,
        amount: data.amount,
        pupilId,
        term: term.id,
        academicYear: selectedAcademicYear.id
      };

      // Submit payment to service
      const result = await PaymentsService.createPayment({
        pupilId: paymentData.pupilId,
        feeStructureId: paymentData.feeId,
        academicYearId: paymentData.academicYear,
        termId: paymentData.term,
        amount: paymentData.amount,
        paymentDate: new Date().toISOString(),
        paidBy: {
          id: 'current-user', // TODO: Get from auth context
          name: 'Current User', // TODO: Get from auth context
          role: 'Staff' // TODO: Get from auth context
        }
      });

      return { result, paymentType, paymentData };
    },
    onSuccess: async (data) => {
      const { paymentType, paymentData } = data;
      
      // Invalidate relevant queries to refresh data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['pupil-payments', pupilId] }),
        queryClient.invalidateQueries({ queryKey: ['previous-balance', pupilId] }),
        queryClient.invalidateQueries({ queryKey: ['pupil-fees'] }),
      ]);

      // Show success message based on payment type
      const amountFormatted = formatCurrency(paymentData.amount);
      let successMessage = '';
      
      switch (paymentType) {
        case PaymentType.FULL_PAYMENT:
          successMessage = `✅ Full payment of ${amountFormatted} recorded successfully!`;
          break;
        case PaymentType.PARTIAL_PAYMENT:
          successMessage = `✅ Partial payment of ${amountFormatted} recorded successfully!`;
          break;
        case PaymentType.OVERPAYMENT:
          successMessage = `✅ Payment of ${amountFormatted} recorded successfully! (Overpayment will be credited)`;
          break;
        default:
          successMessage = `✅ Payment of ${amountFormatted} recorded successfully!`;
      }

      toast({
        title: "Payment Successful",
        description: successMessage,
      });

      // Call success callback
      onPaymentSuccess?.();
    },
    onError: (error: Error) => {
      console.error('Payment processing error:', error);
      
      // Show error message
      toast({
        variant: "destructive",
        title: "Payment Failed",
        description: `❌ ${error.message}`,
      });

      // Call error callback
      onPaymentError?.(error);
    }
  });

  const processPayment = async (data: PaymentSubmissionData) => {
    await paymentMutation.mutateAsync(data);
  };

  return {
    processPayment,
    isProcessing: paymentMutation.isPending,
    error: paymentMutation.error
  };
} 