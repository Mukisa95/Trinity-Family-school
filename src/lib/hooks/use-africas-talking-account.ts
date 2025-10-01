import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AfricasTalkingAccountService } from '@/lib/services/africas-talking-account.service';

interface AccountData {
  success: boolean;
  balance?: string;
  currency?: string;
  error?: string;
}

interface CostCalculation {
  success: boolean;
  totalCost: string;
  costPerSMS: string;
  currency: string;
  segments: number;
  totalSMS: number;
  recipientCount: number;
  breakdown: {
    segmentsPerMessage: number;
    costPerSegment: string;
    totalSegments: number;
  };
  error?: string;
}

interface BalanceCheckResult {
  sufficient: boolean;
  accountBalance: string;
  requiredAmount: string;
  currency: string;
  shortfall?: string;
}

export const useAfricasTalkingAccount = () => {
  const queryClient = useQueryClient();
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Query for account data with enhanced automatic refreshing
  const {
    data: accountData,
    isLoading: isLoadingAccount,
    error: accountError,
    refetch: refetchAccount
  } = useQuery<AccountData>({
    queryKey: ['africas-talking-account'],
    queryFn: AfricasTalkingAccountService.getAccountData,
    staleTime: 2 * 60 * 1000, // 2 minutes (reduced from 5 minutes)
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    refetchOnWindowFocus: true, // Enable refetch on window focus
    refetchOnMount: true, // Always refetch on mount
    refetchOnReconnect: true, // Refetch when network reconnects
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
    refetchIntervalInBackground: false, // Don't refresh when tab is not active
  });

  // Set up automatic refresh on user activity
  useEffect(() => {
    const handleUserActivity = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;
      
      // If it's been more than 2 minutes since last activity, refresh balance
      if (timeSinceLastActivity > 2 * 60 * 1000) {
        console.log('User activity detected after inactivity, refreshing account balance...');
        queryClient.invalidateQueries({ queryKey: ['africas-talking-account'] });
      }
      
      lastActivityRef.current = now;
    };

    // Listen for various user activities
    const events = ['click', 'keydown', 'scroll', 'mousemove', 'touchstart'];
    
    events.forEach(event => {
      document.addEventListener(event, handleUserActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleUserActivity);
      });
    };
  }, [queryClient]);

  // Set up periodic refresh when page is visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Page became visible, refreshing account balance...');
        queryClient.invalidateQueries({ queryKey: ['africas-talking-account'] });
        
        // Start periodic refresh
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
        
        refreshIntervalRef.current = setInterval(() => {
          if (document.visibilityState === 'visible') {
            console.log('Periodic account balance refresh...');
            queryClient.invalidateQueries({ queryKey: ['africas-talking-account'] });
          }
        }, 3 * 60 * 1000); // Every 3 minutes when page is visible
      } else {
        // Clear interval when page is hidden
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Initial setup if page is already visible
    if (document.visibilityState === 'visible') {
      handleVisibilityChange();
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [queryClient]);

  // Helper functions
  const formatCurrency = (amount: string, currency?: string) => {
    return AfricasTalkingAccountService.formatCurrency(amount, currency);
  };

  const refreshAccountData = () => {
    console.log('Manual account balance refresh triggered...');
    return refetchAccount();
  };

  // Invalidate account data (useful after sending SMS)
  const invalidateAccountData = () => {
    console.log('Invalidating account data after SMS send...');
    queryClient.invalidateQueries({ queryKey: ['africas-talking-account'] });
  };

  // Force immediate refresh (for critical operations like SMS sending)
  const forceRefreshAccountData = async () => {
    console.log('Force refreshing account balance...');
    await queryClient.invalidateQueries({ queryKey: ['africas-talking-account'] });
    return refetchAccount();
  };

  // Trigger refresh on specific activities
  const triggerActivityRefresh = (activity: string) => {
    console.log(`Activity-based refresh triggered: ${activity}`);
    lastActivityRef.current = Date.now();
    queryClient.invalidateQueries({ queryKey: ['africas-talking-account'] });
  };

  return {
    // Account data
    accountData,
    isLoadingAccount,
    accountError,
    
    // Utility functions
    formatCurrency,
    refreshAccountData,
    invalidateAccountData,
    forceRefreshAccountData,
    triggerActivityRefresh,
    
    // Computed values
    hasAccountData: accountData?.success === true,
    accountBalance: accountData?.balance,
    accountCurrency: accountData?.currency || 'KES',
    
    // Loading states
    isLoading: isLoadingAccount,
    
    // Error states
    hasError: !!accountError,
    errorMessage: accountError?.message
  };
}; 