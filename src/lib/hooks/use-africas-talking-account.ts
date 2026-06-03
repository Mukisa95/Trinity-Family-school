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

// Minimum time (ms) between activity-triggered refreshes to prevent hammering
const MIN_REFRESH_INTERVAL = 2 * 60 * 1000; // 2 minutes

export const useAfricasTalkingAccount = () => {
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
    staleTime: 5 * 60 * 1000,       // 5 minutes
    gcTime: 15 * 60 * 1000,         // 15 minutes
    retry: 1,
    refetchOnWindowFocus: false,     // Disable automatic window-focus refetch (we control this)
    refetchOnMount: true,
    refetchOnReconnect: false,
    refetchInterval: 10 * 60 * 1000, // Passive auto-refresh every 10 minutes
    refetchIntervalInBackground: false,
  });

  // Helper functions
  const formatCurrency = (amount: string, currency?: string) => {
    return WizaSMSAccountService.formatCurrency(amount, currency || 'UGX');
  };

  const refreshAccountData = () => {
    console.log('Manual account balance refresh...');
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

  /**
   * Throttled activity refresh — only triggers a real refetch if the last refresh
   * was more than MIN_REFRESH_INTERVAL ago. Prevents request storms on user activity.
   */
  const triggerActivityRefresh = (activity: string) => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshRef.current;

    if (timeSinceLastRefresh > MIN_REFRESH_INTERVAL) {
      console.log(`Activity-based refresh triggered: ${activity}`);
      lastRefreshRef.current = now;
      queryClient.invalidateQueries({ queryKey: ['wiza-sms-account'] });
    }
    // else: silently skip — don't hammer the API
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