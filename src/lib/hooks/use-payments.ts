import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PaymentsService } from '../services/payments.service';
import type { PaymentRecord } from '@/types';
import { samplePaymentRecords } from '../sample-data';

// Payment Records Hooks
export function usePaymentsByPupil(pupilId: string) {
  return useQuery({
    queryKey: ['payments', 'pupil', pupilId],
    queryFn: async () => {
      try {
        const livePayments = await PaymentsService.getPaymentsByPupil(pupilId);
        console.log('✅ Live payments by pupil:', livePayments);
        if (livePayments && livePayments.length > 0) {
          return livePayments;
        } else {
          console.warn(`Live Firebase query returned no payments for pupil ${pupilId}. Using sample data for testing.`);
          const sampleData = samplePaymentRecords.filter(payment => payment.pupilId === pupilId);
          console.log('📋 Sample payments by pupil (fallback):', sampleData);
          return sampleData;
        }
      } catch (error) {
        console.warn('Error fetching live payments by pupil. Using sample payment data due to Firebase error:', error);
        const sampleData = samplePaymentRecords.filter(payment => payment.pupilId === pupilId);
        console.log('📋 Sample payments by pupil (error fallback):', sampleData);
        return sampleData;
      }
    },
    enabled: !!pupilId,
  });
}

export function usePaymentsByFee(feeStructureId: string, pupilId: string, academicYearId: string, termId: string) {
  return useQuery({
    queryKey: ['payments', 'fee', feeStructureId, pupilId, academicYearId, termId],
    queryFn: async () => {
      try {
        const livePayments = await PaymentsService.getPaymentsByFee(feeStructureId, pupilId, academicYearId, termId);
        console.log('✅ Live payments by fee:', livePayments);
        if (livePayments && livePayments.length > 0) {
          return livePayments;
        } else {
          console.warn(`Live Firebase query returned no payments for fee ${feeStructureId}, pupil ${pupilId}. Using sample data for testing.`);
          const sampleData = samplePaymentRecords.filter(payment =>
            payment.feeStructureId === feeStructureId &&
            payment.pupilId === pupilId &&
            payment.academicYearId === academicYearId &&
            payment.termId === termId
          );
          console.log('📋 Sample payments by fee (fallback):', sampleData);
          return sampleData;
        }
      } catch (error) {
        console.warn('Error fetching live payments by fee. Using sample payment data due to Firebase error:', error);
        const sampleData = samplePaymentRecords.filter(payment =>
          payment.feeStructureId === feeStructureId &&
          payment.pupilId === pupilId &&
          payment.academicYearId === academicYearId &&
          payment.termId === termId
        );
        console.log('📋 Sample payments by fee (error fallback):', sampleData);
        return sampleData;
      }
    },
    enabled: !!feeStructureId && !!pupilId && !!academicYearId && !!termId,
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (paymentData: Omit<PaymentRecord, 'id' | 'createdAt'>) => 
      PaymentsService.createPayment(paymentData),
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['payments', 'pupil', variables.pupilId] });
      queryClient.invalidateQueries({ 
        queryKey: ['payments', 'fee', variables.feeStructureId, variables.pupilId, variables.academicYearId, variables.termId] 
      });
    },
  });
}

export function useRevertPayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ paymentId, revertedBy }: { 
      paymentId: string; 
      revertedBy: { id: string; name: string; role: string } 
    }) => PaymentsService.revertPayment(paymentId, revertedBy),
    onSuccess: () => {
      // Invalidate all payment queries
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });
} 