"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  DollarSign,
  Eye,
  EyeOff,
  Info,
  CreditCard,
  History,
  AlertCircle,
} from 'lucide-react';
import type { ParentBankingData } from '@/lib/services/parent-banking.service';
import { formatCurrency } from '@/utils/format';

interface PupilBankingSectionProps {
  banking?: ParentBankingData;
  isLoading?: boolean;
  error?: Error | null;
}

export function PupilBankingSection({ banking, isLoading = false, error }: PupilBankingSectionProps) {
  const [showBalance, setShowBalance] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'transactions' | 'loans'>('overview');

  const account = banking?.account;
  const transactions = banking?.transactions || [];
  const loans = banking?.loans || [];
  const accountLoading = isLoading;
  const transactionsLoading = isLoading;
  const loansLoading = isLoading;

  // If no account exists, show message
  if (!accountLoading && !account) {
    return (
      <Card className="shadow-lg">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Wallet className="h-16 w-16 text-gray-400 mb-4 dark:text-slate-400" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2 dark:text-slate-100">No Banking Account</h3>
          <p className="text-gray-600 text-center dark:text-slate-300">
            This pupil does not have a banking account yet. Contact the school administration for more information.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load banking information. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  const toggleBalanceVisibility = () => {
    setShowBalance(!showBalance);
  };

  // Calculate summary statistics
  const totalDeposits = transactions
    .filter(t => t.type === 'DEPOSIT')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalWithdrawals = transactions
    .filter(t => t.type === 'WITHDRAWAL')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalLoans = loans.reduce((sum, loan) => sum + loan.amount, 0);
  const activeLoanCount = loans.filter(loan => loan.status === 'ACTIVE').length;

  // Recent transactions (last 5)
  const recentTransactions = transactions
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Parent Notice */}
      <Alert className="border-brand-200 bg-brand-surface-50 dark:border-brand-800/60 dark:bg-brand-surface-950/40">
        <Info className="h-4 w-4 text-brand-ink-600 dark:text-brand-ink-400" />
        <AlertDescription className="text-brand-ink-800 dark:text-brand-ink-200">
          <strong>Parent View:</strong> You can view your child's banking information here. 
          For any transactions or changes, please contact the school administration.
        </AlertDescription>
      </Alert>

      {/* Account Overview Card */}
      <Card className="shadow-lg border-0 bg-gradient-to-br from-brand-surface-50 to-brand-alt-surface-50 dark:from-brand-surface-950/40 dark:to-brand-alt-surface-950/40">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-brand-ink-600 dark:text-brand-ink-400" />
              Banking Account
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleBalanceVisibility}
              className="text-brand-ink-600 hover:text-brand-ink-700 dark:text-brand-ink-400 dark:hover:text-brand-ink-300"
            >
              {showBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accountLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1 dark:text-slate-300">Current Balance</p>
                <p className="text-3xl font-bold text-brand-ink-600 dark:text-brand-ink-400">
                  {showBalance ? formatCurrency(account?.balance || 0) : '****'}
                </p>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Account: {account?.accountNumber}
                </p>
              </div>
              
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                    {showBalance ? formatCurrency(totalDeposits) : '****'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">Total Deposits</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-red-600 dark:text-red-400">
                    {showBalance ? formatCurrency(totalWithdrawals) : '****'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">Total Withdrawals</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-orange-600 dark:text-orange-400">
                    {activeLoanCount}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">Active Loans</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg dark:bg-slate-900">
        <button
          onClick={() => setSelectedTab('overview')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            selectedTab === 'overview'
              ? 'bg-white text-brand-ink-600 shadow-sm dark:bg-slate-900 dark:text-brand-ink-400'
              : 'text-gray-600 hover:text-gray-900 dark:text-slate-300 dark:hover:text-slate-100'
          }`}
        >
          <DollarSign className="h-4 w-4" />
          Overview
        </button>
        <button
          onClick={() => setSelectedTab('transactions')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            selectedTab === 'transactions'
              ? 'bg-white text-brand-ink-600 shadow-sm dark:bg-slate-900 dark:text-brand-ink-400'
              : 'text-gray-600 hover:text-gray-900 dark:text-slate-300 dark:hover:text-slate-100'
          }`}
        >
          <History className="h-4 w-4" />
          Transactions
        </button>
        <button
          onClick={() => setSelectedTab('loans')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            selectedTab === 'loans'
              ? 'bg-white text-brand-ink-600 shadow-sm dark:bg-slate-900 dark:text-brand-ink-400'
              : 'text-gray-600 hover:text-gray-900 dark:text-slate-300 dark:hover:text-slate-100'
          }`}
        >
          <CreditCard className="h-4 w-4" />
          Loans
        </button>
      </div>

      {/* Tab Content */}
      {selectedTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : recentTransactions.length > 0 ? (
                <div className="space-y-3">
                  {recentTransactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg dark:bg-slate-900">
                      <div className="flex items-center gap-3">
                        {transaction.type === 'DEPOSIT' ? (
                          <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                        )}
                        <div>
                          <p className="font-medium text-sm">{transaction.description}</p>
                          <p className="text-xs text-gray-500 dark:text-slate-400">
                            {new Date(transaction.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <span className={`font-semibold ${
                        transaction.type === 'DEPOSIT' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {transaction.type === 'DEPOSIT' ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4 dark:text-slate-400">No transactions yet</p>
              )}
            </CardContent>
          </Card>

          {/* Active Loans Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Loan Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {loansLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : loans.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-center p-4 bg-orange-50 rounded-lg dark:bg-orange-950/40">
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatCurrency(totalLoans)}</p>
                    <p className="text-sm text-gray-600 dark:text-slate-300">Total Loan Amount</p>
                  </div>
                  {loans.slice(0, 3).map((loan) => (
                    <div key={loan.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg dark:bg-slate-900">
                      <div>
                        <p className="font-medium text-sm">{loan.purpose}</p>
                        <Badge variant={loan.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-xs">
                          {loan.status}
                        </Badge>
                      </div>
                      <span className="font-semibold text-orange-600 dark:text-orange-400">
                        {formatCurrency(loan.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4 dark:text-slate-400">No loans</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {selectedTab === 'transactions' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : transactions.length > 0 ? (
              <div className="space-y-3">
                {transactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      {transaction.type === 'DEPOSIT' ? (
                        <div className="p-2 bg-green-100 rounded-full dark:bg-green-950/40">
                          <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                      ) : (
                        <div className="p-2 bg-red-100 rounded-full dark:bg-red-950/40">
                          <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{transaction.description}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
                          <Calendar className="h-3 w-3" />
                          {new Date(transaction.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`font-bold text-lg ${
                        transaction.type === 'DEPOSIT' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {transaction.type === 'DEPOSIT' ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </span>
                      <p className="text-sm text-gray-500 dark:text-slate-400">
                        Balance: {formatCurrency(transaction.balance)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <History className="h-12 w-12 text-gray-400 mx-auto mb-4 dark:text-slate-400" />
                <p className="text-gray-500 dark:text-slate-400">No transactions yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedTab === 'loans' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Loan Details</CardTitle>
          </CardHeader>
          <CardContent>
            {loansLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : loans.length > 0 ? (
              <div className="space-y-4">
                {loans.map((loan) => (
                  <div key={loan.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold">{loan.purpose}</h4>
                      <Badge variant={loan.status === 'ACTIVE' ? 'default' : 'secondary'}>
                        {loan.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500 dark:text-slate-400">Amount</p>
                        <p className="font-semibold">{formatCurrency(loan.amount)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-slate-400">Date Issued</p>
                        <p className="font-semibold">
                          {new Date(loan.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-slate-400">Due Date</p>
                        <p className="font-semibold">
                          {loan.repaymentDate ? new Date(loan.repaymentDate).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4 dark:text-slate-400" />
                <p className="text-gray-500 dark:text-slate-400">No loans</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
