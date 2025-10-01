import { useState, useEffect, useCallback } from 'react';
import { UnifiedAccountBalanceService } from '@/lib/services/unified-account-balance.service';

interface AccountData {
  success: boolean;
  balance?: string;
  currency?: string;
  error?: string;
  provider?: string;
  source?: string;
}

export const useUnifiedAccountBalance = () => {
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [isLoadingAccount, setIsLoadingAccount] = useState(true);
  const [accountError, setAccountError] = useState<Error | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchAccountData = useCallback(async () => {
    try {
      setIsLoadingAccount(true);
      setAccountError(null);
      
      const data = await UnifiedAccountBalanceService.getAccountData();
      setAccountData(data);
      setLastRefresh(new Date());
      
      if (!data.success) {
        setAccountError(new Error(data.error || 'Failed to fetch account data'));
      }
    } catch (error) {
      console.error('Error in fetchAccountData:', error);
      setAccountError(error instanceof Error ? error : new Error('Unknown error'));
    } finally {
      setIsLoadingAccount(false);
    }
  }, []);

  const refreshAccountData = useCallback(async () => {
    await fetchAccountData();
  }, [fetchAccountData]);

  // Initial load
  useEffect(() => {
    fetchAccountData();
  }, [fetchAccountData]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isLoadingAccount) {
        fetchAccountData();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [fetchAccountData, isLoadingAccount]);

  // Activity-based refresh
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isLoadingAccount) {
        console.log('Page became visible, refreshing account balance...');
        fetchAccountData();
      }
    };

    const handleFocus = () => {
      if (!isLoadingAccount) {
        console.log('Activity-based refresh triggered: page-focus');
        fetchAccountData();
      }
    };

    const handleOnline = () => {
      if (!isLoadingAccount) {
        console.log('Activity-based refresh triggered: online');
        fetchAccountData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [fetchAccountData, isLoadingAccount]);

  const formatCurrency = useCallback((amount: string, currency?: string) => {
    return UnifiedAccountBalanceService.formatCurrency(amount, currency, accountData?.provider);
  }, [accountData?.provider]);

  const getEstimatedSMSCount = useCallback((balance: number) => {
    return UnifiedAccountBalanceService.getEstimatedSMSCount(balance, accountData?.provider);
  }, [accountData?.provider]);

  const getBalanceStatus = useCallback((balance: number) => {
    return UnifiedAccountBalanceService.getBalanceStatus(balance, accountData?.provider);
  }, [accountData?.provider]);

  const hasAccountData = accountData !== null && accountData.success;

  return {
    accountData,
    isLoadingAccount,
    accountError,
    refreshAccountData,
    formatCurrency,
    getEstimatedSMSCount,
    getBalanceStatus,
    hasAccountData,
    lastRefresh,
    provider: accountData?.provider
  };
};
