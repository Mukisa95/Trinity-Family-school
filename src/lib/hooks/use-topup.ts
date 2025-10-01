import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TopUpService } from '@/lib/services/topup.service';

interface TopUpRequest {
  amount: number;
  currency: string;
  paymentMethod: 'mobile_money' | 'card' | 'bank_transfer';
  phoneNumber?: string;
  provider?: 'MTN' | 'Airtel' | 'Orange' | 'Safaricom';
  metadata?: {
    userId: string;
    description?: string;
  };
}

interface TopUpResponse {
  success: boolean;
  transactionId?: string;
  paymentUrl?: string;
  instructions?: string;
  status?: 'pending' | 'completed' | 'failed';
  error?: string;
}

interface AutoTopUpConfig {
  enabled: boolean;
  threshold: number;
  amount: number;
  currency: string;
  paymentMethod: 'mobile_money' | 'card' | 'bank_transfer';
  phoneNumber?: string;
  provider?: 'MTN' | 'Airtel' | 'Orange' | 'Safaricom';
  maxTopUpsPerDay?: number;
  lastTopUpDate?: string;
  topUpCount?: number;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
}

export const useTopUp = (userId?: string) => {
  const queryClient = useQueryClient();

  // Query for auto top-up configuration
  const {
    data: autoTopUpConfig,
    isLoading: isLoadingConfig,
    error: configError,
    refetch: refetchConfig
  } = useQuery({
    queryKey: ['auto-topup-config', userId],
    queryFn: () => TopUpService.getAutoTopUpConfig(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    refetchOnWindowFocus: false,
    select: (data) => data.config
  });

  // Mutation for processing top-up
  const topUpMutation = useMutation<TopUpResponse, Error, TopUpRequest>({
    mutationFn: (request) => TopUpService.processTopUp(request),
    onSuccess: (data, variables) => {
      console.log('Top-up processed successfully:', data);
      
      // Invalidate account data to refresh balance
      queryClient.invalidateQueries({ queryKey: ['africas-talking-account'] });
      
      // If this was an auto top-up, refresh the config
      if (variables.metadata?.description?.includes('Auto top-up')) {
        queryClient.invalidateQueries({ queryKey: ['auto-topup-config', userId] });
      }
    },
    onError: (error) => {
      console.error('Top-up processing failed:', error);
    }
  });

  // Mutation for updating auto top-up configuration
  const updateConfigMutation = useMutation<
    { success: boolean; config?: AutoTopUpConfig; error?: string },
    Error,
    Partial<AutoTopUpConfig>
  >({
    mutationFn: (config) => TopUpService.updateAutoTopUpConfig(config),
    onSuccess: (data) => {
      console.log('Auto top-up config updated successfully:', data);
      
      // Update the cached config
      if (data.success && data.config) {
        queryClient.setQueryData(['auto-topup-config', userId], data.config);
      }
    },
    onError: (error) => {
      console.error('Auto top-up config update failed:', error);
    }
  });

  // Mutation for checking/triggering auto top-up
  const autoTopUpCheckMutation = useMutation<
    {
      success: boolean;
      triggered?: boolean;
      transactionId?: string;
      instructions?: string;
      error?: string;
    },
    Error,
    { userId: string; currentBalance: string }
  >({
    mutationFn: ({ userId, currentBalance }) => 
      TopUpService.checkAutoTopUp(userId, currentBalance),
    onSuccess: (data) => {
      console.log('Auto top-up check completed:', data);
      
      if (data.triggered) {
        // Invalidate account data to refresh balance
        queryClient.invalidateQueries({ queryKey: ['africas-talking-account'] });
        // Refresh auto top-up config to update counters
        queryClient.invalidateQueries({ queryKey: ['auto-topup-config', userId] });
      }
    },
    onError: (error) => {
      console.error('Auto top-up check failed:', error);
    }
  });

  // Helper functions
  const processTopUp = (request: TopUpRequest) => {
    return topUpMutation.mutateAsync(request);
  };

  const updateAutoTopUpConfig = (config: Partial<AutoTopUpConfig>) => {
    return updateConfigMutation.mutateAsync(config);
  };

  const checkAutoTopUp = (currentBalance: string) => {
    if (!userId) {
      throw new Error('User ID is required for auto top-up check');
    }
    return autoTopUpCheckMutation.mutateAsync({ userId, currentBalance });
  };

  const getPaymentMethods = () => {
    return TopUpService.getPaymentMethods();
  };

  const formatCurrency = (amount: number | string, currency?: string) => {
    return TopUpService.formatCurrency(amount, currency);
  };

  const validatePhoneNumber = (phoneNumber: string, provider: string) => {
    return TopUpService.validatePhoneNumber(phoneNumber, provider);
  };

  const getRecommendedAmounts = (currentBalance: number, currency?: string) => {
    return TopUpService.getRecommendedAmounts(currentBalance, currency);
  };

  const refreshConfig = () => {
    return refetchConfig();
  };

  // Invalidate all top-up related data
  const invalidateTopUpData = () => {
    queryClient.invalidateQueries({ queryKey: ['auto-topup-config'] });
    queryClient.invalidateQueries({ queryKey: ['africas-talking-account'] });
  };

  return {
    // Auto top-up configuration
    autoTopUpConfig,
    isLoadingConfig,
    configError,
    
    // Top-up processing
    processTopUp,
    topUpResult: topUpMutation.data,
    isProcessingTopUp: topUpMutation.isPending,
    topUpError: topUpMutation.error,
    
    // Auto top-up config management
    updateAutoTopUpConfig,
    configUpdateResult: updateConfigMutation.data,
    isUpdatingConfig: updateConfigMutation.isPending,
    configUpdateError: updateConfigMutation.error,
    
    // Auto top-up checking
    checkAutoTopUp,
    autoTopUpCheckResult: autoTopUpCheckMutation.data,
    isCheckingAutoTopUp: autoTopUpCheckMutation.isPending,
    autoTopUpCheckError: autoTopUpCheckMutation.error,
    
    // Utility functions
    getPaymentMethods,
    formatCurrency,
    validatePhoneNumber,
    getRecommendedAmounts,
    refreshConfig,
    invalidateTopUpData,
    
    // Computed values
    hasAutoTopUpConfig: !!autoTopUpConfig,
    isAutoTopUpEnabled: autoTopUpConfig?.enabled ?? false,
    autoTopUpThreshold: autoTopUpConfig?.threshold,
    autoTopUpAmount: autoTopUpConfig?.amount,
    
    // Loading states
    isLoading: isLoadingConfig || topUpMutation.isPending || updateConfigMutation.isPending || autoTopUpCheckMutation.isPending,
    
    // Error states
    hasError: !!configError || !!topUpMutation.error || !!updateConfigMutation.error || !!autoTopUpCheckMutation.error,
    errorMessage: configError?.message || topUpMutation.error?.message || updateConfigMutation.error?.message || autoTopUpCheckMutation.error?.message
  };
}; 