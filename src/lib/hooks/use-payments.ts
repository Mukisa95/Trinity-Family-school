import { authorizedFetch } from '@/lib/access/authorized-fetch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PaymentsService } from '../services/payments.service';
import type { PaymentRecord } from '@/types';
import { invalidateFinanceSummaryQueries } from './use-finance-summary';

// Payment Records Hooks
export function usePaymentsByPupil(pupilId: string) {
  return useQuery({
    queryKey: ['payments', 'pupil', pupilId],
    queryFn: () => PaymentsService.getPaymentsByPupil(pupilId),
    enabled: !!pupilId,
  });
}

export function usePaymentsByFee(feeStructureId: string, pupilId: string, academicYearId: string, termId: string) {
  return useQuery({
    queryKey: ['payments', 'fee', feeStructureId, pupilId, academicYearId, termId],
    queryFn: () => PaymentsService.getPaymentsByFee(feeStructureId, pupilId, academicYearId, termId),
    enabled: !!feeStructureId && !!pupilId && !!academicYearId && !!termId,
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationKey: ["payments","create"],
    mutationFn: async (paymentData: Omit<PaymentRecord, 'id' | 'createdAt'>) => {
      // 🔔 Use API route for client-side (enables notifications)
      const response = await authorizedFetch('/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment');
      }

      const result = await response.json();
      return result.paymentId;
    },
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['payments', 'pupil', variables.pupilId] });
      queryClient.invalidateQueries({ 
        queryKey: ['payments', 'fee', variables.feeStructureId, variables.pupilId, variables.academicYearId, variables.termId] 
      });
      invalidateFinanceSummaryQueries(queryClient, variables.pupilId);
    },
  });
}

export function useRevertPayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationKey: ["payments","revert"],
    mutationFn: ({ paymentId, revertedBy }: { 
      paymentId: string; 
      revertedBy: { id: string; name: string; role: string } 
    }) => PaymentsService.revertPayment(paymentId, revertedBy),
    onSuccess: () => {
      // Invalidate all payment queries
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      invalidateFinanceSummaryQueries(queryClient);
    },
  });
}
