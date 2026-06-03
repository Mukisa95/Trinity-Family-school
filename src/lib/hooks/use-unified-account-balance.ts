import { useState, useEffect, useCallback, useRef } from 'react';
import { UnifiedAccountBalanceService } from '@/lib/services/unified-account-balance.service';

interface AccountData {
  success: boolean;
  balance?: string;
  currency?: string;
  error?: string;
  provider?: string;
  source?: string;
  message?: string;
}

export const useUnifiedAccountBalance = () => {
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [isLoadingAccount, setIsLoadingAccount] = useState(true);
  const [accountError, setAccountError] = useState<Error | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const isLoadingRef = useRef(false);

  const fetchAccountData = useCallback(async () => {
    // Prevent concurrent fetches
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

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
      setAccountError(error instanceof Error ? error : new Error('Unknown error'));
    } finally {
      setIsLoadingAccount(false);
      isLoadingRef.current = false;
    }
  }, []);

  const refreshAccountData = useCallback(async () => {
    await fetchAccountData();
  }, [fetchAccountData]);

  // Initial load
  useEffect(() => {
    fetchAccountData();
  }, [fetchAccountData]);

  // Auto-refresh every 10 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAccountData();
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAccountData]);

  // Refresh on page visibility (tab focus) — debounced with ref
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchAccountData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchAccountData]);

  const formatCurrency = useCallback(
    (amount: string, currency?: string) => {
      return UnifiedAccountBalanceService.formatCurrency(amount, currency, accountData?.provider);
    },
    [accountData?.provider]
  );

  const getEstimatedSMSCount = useCallback(
    (balance: number) => {
      return UnifiedAccountBalanceService.getEstimatedSMSCount(balance, accountData?.provider);
    },
    [accountData?.provider]
  );

  const getBalanceStatus = useCallback(
    (balance: number) => {
      return UnifiedAccountBalanceService.getBalanceStatus(balance, accountData?.provider);
    },
    [accountData?.provider]
  );

  return {
    accountData,
    isLoadingAccount,
    accountError,
    refreshAccountData,
    formatCurrency,
    getEstimatedSMSCount,
    getBalanceStatus,
    hasAccountData: accountData !== null && accountData.success,
    lastRefresh,
    provider: accountData?.provider || 'Wiza SMS',
  };
};
