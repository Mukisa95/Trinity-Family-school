import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { WizaSMSAccountService } from '@/lib/services/wiza-sms-account.service';

interface AccountData {
  success: boolean;
  balance?: string;
  currency?: string;
  error?: string;
  source?: string;
  message?: string;
}

const MIN_REFRESH_INTERVAL = 2 * 60 * 1000;

export const useWizaSMSAccount = () => {
  const queryClient = useQueryClient();
  const lastRefreshRef = useRef<number>(0);

  const {
    data: accountData,
    isLoading: isLoadingAccount,
    error: accountError,
    refetch: refetchAccount,
  } = useQuery<AccountData>({
    queryKey: ['wiza-sms-account'],
    queryFn: WizaSMSAccountService.getAccountData,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
    refetchInterval: 10 * 60 * 1000,
    refetchIntervalInBackground: false,
  });

  const formatCurrency = (amount: string, currency?: string) => {
    return WizaSMSAccountService.formatCurrency(amount, currency || 'UGX');
  };

  const refreshAccountData = () => {
    lastRefreshRef.current = Date.now();
    return refetchAccount();
  };

  const invalidateAccountData = () => {
    queryClient.invalidateQueries({ queryKey: ['wiza-sms-account'] });
  };

  const forceRefreshAccountData = async () => {
    lastRefreshRef.current = Date.now();
    await queryClient.invalidateQueries({ queryKey: ['wiza-sms-account'] });
    return refetchAccount();
  };

  const triggerActivityRefresh = (activity: string) => {
    const now = Date.now();
    if (now - lastRefreshRef.current > MIN_REFRESH_INTERVAL) {
      console.log(`Wiza SMS activity refresh triggered: ${activity}`);
      lastRefreshRef.current = now;
      queryClient.invalidateQueries({ queryKey: ['wiza-sms-account'] });
    }
  };

  return {
    accountData,
    isLoadingAccount,
    accountError,
    formatCurrency,
    refreshAccountData,
    invalidateAccountData,
    forceRefreshAccountData,
    triggerActivityRefresh,
    hasAccountData: accountData?.success === true,
    accountBalance: accountData?.balance,
    accountCurrency: accountData?.currency || 'UGX',
    isLoading: isLoadingAccount,
    hasError: !!accountError,
    errorMessage: accountError?.message,
  };
};
