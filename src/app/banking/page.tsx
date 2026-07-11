"use client";

import React, { useState, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, User, CreditCard, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/utils/format';
import { useAccountsWithPupils } from '@/lib/hooks/use-banking';
import type { Pupil, Account } from '@/types';
import { GlassPageTopBar, GlassActionDock, GlassActionButton } from '@/components/common/glass-page-top-bar';
import { GlassPageRouteSkeleton } from '@/components/common/glass-page-loading';

interface AccountWithPupil extends Account {
  pupil: Pupil;
}

export default function BankingPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch data using React Query
  const { data: accounts = [], isLoading: loading, error } = useAccountsWithPupils();

  // Filter accounts based on search term
  const filteredAccounts = useMemo(() => {
    if (!searchTerm.trim()) {
      return accounts;
    }

    return accounts.filter(account => {
      const pupil = account.pupil;
      const fullName = `${pupil.firstName} ${pupil.lastName} ${pupil.otherNames || ''}`.toLowerCase();
      const searchLower = searchTerm.toLowerCase();
      
      return (
        fullName.includes(searchLower) ||
        pupil.admissionNumber.toLowerCase().includes(searchLower) ||
        account.accountNumber.toLowerCase().includes(searchLower) ||
        account.accountName.toLowerCase().includes(searchLower) ||
        pupil.className?.toLowerCase().includes(searchLower)
      );
    });
  }, [accounts, searchTerm]);

  const handleAccountClick = (account: AccountWithPupil) => {
    router.push(`/banking/pupil-banking-details?pupilId=${account.pupil.id}`);
  };

  const handleCreateAccount = () => {
    router.push('/banking/new');
  };

  const getTotalBalance = () => {
    return accounts.reduce((total, account) => total + account.balance, 0);
  };

  const getAccountsWithPositiveBalance = () => {
    return accounts.filter(account => account.balance > 0).length;
  };

  const getAccountsWithNegativeBalance = () => {
    return accounts.filter(account => account.balance < 0).length;
  };

  // 🚀 OPTIMIZED: Only show loading spinner if we have no cached data at all
  const showLoadingSpinner = loading && accounts.length === 0;
  
  if (showLoadingSpinner) {
    return <GlassPageRouteSkeleton variant="list" />;
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <GlassPageTopBar
          title="Banking System"
          subtitle="Manage student bank accounts and transactions"
          backHref="/dashboard"
          backLabel="Dashboard"
        />
        <div className="text-center py-12">
          <div className="text-red-600 mb-4">Failed to load bank accounts</div>
          <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <GlassPageTopBar
        title="Banking System"
        subtitle="Manage student bank accounts and transactions"
        backHref="/dashboard"
        backLabel="Dashboard"
        meta={
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50/80 border border-blue-200/60 text-[10px] font-semibold text-blue-700">
              <CreditCard className="w-3 h-3" />
              {accounts.length} accounts
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50/80 border border-emerald-200/60 text-[10px] font-semibold text-emerald-700">
              <TrendingUp className="w-3 h-3" />
              {formatCurrency(getTotalBalance())}
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-green-50/80 border border-green-200/60 text-[10px] font-semibold text-green-700">
              +{getAccountsWithPositiveBalance()}
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-50/80 border border-red-200/60 text-[10px] font-semibold text-red-700">
              -{getAccountsWithNegativeBalance()}
            </div>
          </div>
        }
        actionsLeading={
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search accounts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 h-[30px] w-36 focus:w-52 transition-all duration-200 rounded-full border border-blue-200/60 bg-white/90 text-[11px] text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 placeholder:text-gray-400"
            />
          </div>
        }
        actions={
          <GlassActionDock>
            <GlassActionButton
              label="All Accounts"
              icon={<CreditCard className="h-4 w-4" />}
              tone="blue"
              onClick={() => router.push('/banking/list')}
            />
            <GlassActionButton
              label="New Account"
              icon={<Plus className="h-4 w-4" />}
              tone="emerald"
              onClick={handleCreateAccount}
            />
          </GlassActionDock>
        }
      />
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Results Count */}
        <div className="mb-4 pt-2">
          <p className="text-sm text-gray-500">
            {filteredAccounts.length} account{filteredAccounts.length !== 1 ? 's' : ''} found
          </p>
        </div>


        {/* Accounts Grid */}
        <div className="grid gap-4">
          {filteredAccounts.length === 0 ? (
            <Card>
              <CardContent className="p-8">
                <div className="text-center">
                  <User className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No accounts found</h3>
                  <p className="text-gray-500 mb-4">
                    {searchTerm ? 'No accounts match your search criteria.' : 'No bank accounts have been created yet.'}
                  </p>
                  {!searchTerm && (
                    <Button onClick={handleCreateAccount} className="flex items-center gap-2 mx-auto">
                      <Plus className="w-4 h-4" />
                      Create First Account
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredAccounts.map((account) => (
              <Card
                key={account.id}
                className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
                onClick={() => handleAccountClick(account)}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      {account.pupil.photo ? (
                        <img
                          src={account.pupil.photo}
                          alt={`${account.pupil.firstName} ${account.pupil.lastName}`}
                          className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-lg font-semibold text-gray-600">
                          {account.pupil.firstName[0]}
                        </div>
                      )}

                      {/* Account Info */}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">
                            {account.pupil.firstName} {account.pupil.lastName} {account.pupil.otherNames || ''}
                          </h3>
                          <Badge variant={account.pupil.status === 'Active' ? 'default' : 'secondary'}>
                            {account.pupil.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>ID: {account.pupil.admissionNumber}</span>
                          {account.pupil.className && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span>Class: {account.pupil.className}</span>
                            </>
                          )}
                          <span className="text-gray-300">•</span>
                          <span>{account.pupil.section}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                          <span>Account: {account.accountNumber}</span>
                          <span className="text-gray-300">•</span>
                          <span>{account.accountName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Balance */}
                    <div className="text-right">
                      <p className="text-sm text-gray-500 mb-1">Current Balance</p>
                      <p className={`text-2xl font-bold ${
                        account.balance >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(account.balance)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
} 