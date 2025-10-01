"use client";

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, User, CreditCard, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/utils/format';
import { useAccountsWithPupils } from '@/lib/hooks/use-banking';
import type { Pupil, Account } from '@/types';

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading bank accounts...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="text-red-600 mb-4">Failed to load bank accounts</div>
            <Button onClick={() => window.location.reload()} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Banking System</h1>
            <p className="text-gray-500 mt-1">Manage student bank accounts and transactions</p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={() => router.push('/banking/list')}
              className="flex items-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              View All Accounts
            </Button>
            <Button onClick={handleCreateAccount} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create Account
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Accounts</p>
                  <p className="text-xl font-bold text-gray-900">{accounts.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Balance</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(getTotalBalance())}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Positive Balance</p>
                  <p className="text-xl font-bold text-green-600">{getAccountsWithPositiveBalance()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Negative Balance</p>
                  <p className="text-xl font-bold text-red-600">{getAccountsWithNegativeBalance()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Search by student name, admission number, account number, or class..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Results Count */}
        <div className="mb-4">
          <p className="text-sm text-gray-600">
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