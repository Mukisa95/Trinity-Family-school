import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UniformFeesIntegrationService } from '@/lib/services/uniform-fees-integration.service';
import type { UniformFeeData } from '@/lib/services/uniform-fees-integration.service';

export function useUniformFeesForPupil(pupilId: string) {
  return useQuery({
    queryKey: ['uniform-fees', pupilId],
    queryFn: () => UniformFeesIntegrationService.getUniformFeesForPupil(pupilId),
    enabled: !!pupilId,
    staleTime: 0, // Always fresh
  });
}

export function useUniformPayments(pupilId: string) {
  return useQuery({
    queryKey: ['uniform-payments', pupilId],
    queryFn: () => UniformFeesIntegrationService.getUniformPayments(pupilId),
    enabled: !!pupilId,
    staleTime: 0, // Always fresh
  });
}

export function useCreateUniformPayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      uniformFee,
      paymentAmount,
      pupilId,
      academicYearId,
      termId,
      paidBy
    }: {
      uniformFee: UniformFeeData;
      paymentAmount: number;
      pupilId: string;
      academicYearId: string;
      termId: string;
      paidBy: { id: string; name: string; role: string };
    }) => {
      return UniformFeesIntegrationService.createUniformPaymentRecord(
        uniformFee,
        paymentAmount,
        pupilId,
        academicYearId,
        termId,
        paidBy
      );
    },
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['uniform-fees', variables.pupilId] });
      queryClient.invalidateQueries({ queryKey: ['uniform-payments', variables.pupilId] });
      queryClient.invalidateQueries({ queryKey: ['pupil-payments', variables.pupilId] });
      queryClient.invalidateQueries({ queryKey: ['uniform-tracking'] });
    },
  });
}

// Utility functions for easy access
export const uniformFeesUtils = {
  isUniformFee: UniformFeesIntegrationService.isUniformFee,
  getUniformTrackingId: UniformFeesIntegrationService.getUniformTrackingId,
}; 