"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Wallet, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  AlertCircle,
  Plus,
  Zap,
  Settings,
  Monitor
} from 'lucide-react';
import { useUnifiedAccountBalance } from '@/lib/hooks/use-unified-account-balance';
import { useTopUp } from '@/lib/hooks/use-topup';
import { useAuth } from '@/lib/contexts/auth-context';
import TopUpDialog from './TopUpDialog';
import { TopUpService } from '@/lib/services/topup.service';
import { WizaSMSDashboard } from './WizaSMSDashboard';

export const AccountBalance: React.FC = () => {
  const { user } = useAuth();
  const {
    accountData,
    isLoadingAccount,
    accountError,
    refreshAccountData,
    formatCurrency,
    getEstimatedSMSCount,
    getBalanceStatus,
    hasAccountData,
    provider
  } = useUnifiedAccountBalance();

  const {
    autoTopUpConfig,
    isAutoTopUpEnabled,
    checkAutoTopUp,
    isCheckingAutoTopUp
  } = useTopUp(user?.id || '');

  const [showTopUpDialog, setShowTopUpDialog] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto top-up check when balance changes
  useEffect(() => {
    if (hasAccountData && accountData && accountData.balance && user?.id && isAutoTopUpEnabled) {
      const currentBalance = parseFloat(accountData.balance);
      const threshold = autoTopUpConfig?.threshold || 0;
      
      if (currentBalance < threshold) {
        console.log('Balance below threshold, checking auto top-up...');
        checkAutoTopUp(accountData.balance).catch(error => {
          console.error('Auto top-up check failed:', error);
        });
      }
    }
  }, [accountData?.balance, isAutoTopUpEnabled, autoTopUpConfig?.threshold, user?.id, checkAutoTopUp, hasAccountData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshAccountData();
    } finally {
      setIsRefreshing(false);
    }
  };

  const getBalanceStatusWithIcon = (balance: number) => {
    const status = getBalanceStatus(balance);
    
    let icon: React.ReactNode;
    switch (status.status) {
      case 'good':
        icon = <CheckCircle className="h-4 w-4 text-green-600" />;
        break;
      case 'moderate':
        icon = <AlertCircle className="h-4 w-4 text-yellow-600" />;
        break;
      case 'low':
      case 'insufficient':
        icon = <AlertTriangle className="h-4 w-4 text-orange-600" />;
        break;
      default:
        icon = <AlertTriangle className="h-4 w-4 text-red-600" />;
    }

    return {
      ...status,
      icon
    };
  };

  // Hide balance display for Wiza SMS since we have the embedded dashboard
  if (provider === 'Wiza SMS') {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Account Balance
            <Badge variant="outline" className="text-xs">
              {provider}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <Zap className="h-3 w-3 mr-1" />
              Live Dashboard
            </Badge>
            <WizaSMSDashboard />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="flex flex-col items-center gap-3">
              <Monitor className="h-12 w-12 text-muted-foreground" />
              <div className="space-y-2">
                <h3 className="font-medium text-lg">Wiza SMS Dashboard</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Click the dashboard button above to view your real-time balance, 
                  transaction history, and recharge your account directly.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>🔐 Secure connection</span>
                <span>💳 Direct recharge</span>
                <span>📊 Real-time updates</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoadingAccount) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Account Balance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (accountError || !hasAccountData || !accountData) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Account Balance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {accountError?.message || 'Failed to load account information'}
            </AlertDescription>
          </Alert>
          <Button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
            className="w-full"
          >
            {isRefreshing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const balance = parseFloat(accountData.balance || '0');
  const currency = accountData.currency;
  const balanceStatus = getBalanceStatusWithIcon(balance);
  const estimatedSMSCount = getEstimatedSMSCount(balance);

  return (
    <>
      <Card className={`${balanceStatus.bgColor} border-2`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Account Balance
              {provider && (
                <Badge variant="outline" className="text-xs ml-2">
                  {provider}
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                <Zap className="h-3 w-3 mr-1" />
                {provider || 'Auto-refresh'}
              </Badge>
              <Button
                onClick={handleRefresh}
                disabled={isRefreshing}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                title={`Refresh ${provider || 'account'} balance`}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <CardDescription className="flex items-center gap-2">
            {balanceStatus.icon}
            <span className={balanceStatus.color}>
              {balanceStatus.status === 'good' && 'Good balance'}
              {balanceStatus.status === 'moderate' && 'Moderate balance'}
              {balanceStatus.status === 'low' && 'Low balance'}
              {balanceStatus.status === 'insufficient' && 'Insufficient balance'}
            </span>
            <span className="text-xs text-gray-500 ml-auto">
              Updates automatically
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="text-2xl font-bold">
              {formatCurrency(accountData.balance || '0', currency)}
            </div>
            <div className="text-sm text-gray-600">
              ≈ {estimatedSMSCount.toLocaleString()} SMS messages
            </div>
            <div className="text-xs text-gray-500">
              @ {formatCurrency('25', currency)}
            </div>
          </div>

          {/* Auto Top-up Status */}
          {isAutoTopUpEnabled && autoTopUpConfig && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Auto Top-up Active</span>
                <Badge variant="default" className="text-xs">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  ON
                </Badge>
              </div>
              <div className="text-xs text-gray-600 space-y-1">
                <div>Threshold: {formatCurrency(autoTopUpConfig.threshold.toString(), currency)}</div>
                <div>Amount: {formatCurrency(autoTopUpConfig.amount.toString(), currency)}</div>
                <div>Today: {autoTopUpConfig.topUpCount || 0}/{autoTopUpConfig.maxTopUpsPerDay || 3}</div>
              </div>
            </div>
          )}

          {/* Low Balance Warning */}
          {balanceStatus.status === 'low' && (
            <Alert variant="destructive" className="bg-orange-50 border-orange-200">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-orange-700">
                Your balance is running low. Consider topping up to avoid service interruption.
              </AlertDescription>
            </Alert>
          )}

          {/* Insufficient Balance Warning */}
          {balanceStatus.status === 'insufficient' && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Insufficient balance. Please top up your account to send SMS messages.
              </AlertDescription>
            </Alert>
          )}

          {/* Auto Top-up Processing */}
          {isCheckingAutoTopUp && (
            <Alert>
              <Zap className="h-4 w-4" />
              <AlertDescription>
                Checking auto top-up eligibility...
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button
              onClick={() => TopUpService.openBillingPage()}
              className="flex-1"
              size="sm"
            >
              <Plus className="mr-2 h-4 w-4" />
              Top Up
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Top-up Dialog */}
      {user?.id && (
        <TopUpDialog
          open={showTopUpDialog}
          onClose={() => setShowTopUpDialog(false)}
          userId={user.id}
          currentBalance={accountData.balance}
          currency={currency}
        />
      )}
    </>
  );
}; 