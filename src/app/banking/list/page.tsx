"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ModernDialog, ModernDialogContent, ModernDialogHeader, ModernDialogTitle, ModernDialogTrigger, ModernDialogDescription } from '@/components/ui/modern-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, CreditCard, DollarSign, TrendingUp, Eye, MoreVertical, Trash2, Power, PowerOff, ArrowLeft, Search } from 'lucide-react';
import { formatCurrency } from '@/utils/format';
import PupilSelector from '@/components/PupilSelector';
import { useAccountsWithPupils, useCreateAccount, useDeleteAccount, useDeactivateAccount, useReactivateAccount } from '@/lib/hooks/use-banking';
import { useToast } from '@/hooks/use-toast';
import type { Pupil, Account } from '@/types';

interface AccountWithPupil extends Account {
  pupil: Pupil;
}

export default function BankingListPage() {
  const router = useRouter();
  const [openCreateAccount, setOpenCreateAccount] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<{id: string, name: string} | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  // Fetch data using React Query hooks
  const { data: accounts = [], isLoading: accountsLoading } = useAccountsWithPupils();
  const createAccountMutation = useCreateAccount();
  const deleteAccountMutation = useDeleteAccount();
  const deactivateAccountMutation = useDeactivateAccount();
  const reactivateAccountMutation = useReactivateAccount();

  // Filter accounts based on search term
  const filteredAccounts = accounts.filter(account => {
    const pupilName = `${account.pupil.firstName} ${account.pupil.lastName} ${account.pupil.otherNames || ''}`.toLowerCase();
    const admissionNumber = account.pupil.admissionNumber?.toLowerCase() || '';
    const accountNumber = account.accountNumber?.toLowerCase() || '';
    const search = searchTerm.toLowerCase();
    
    return pupilName.includes(search) || admissionNumber.includes(search) || accountNumber.includes(search);
  });

  const handleViewAccount = (pupilId: string) => {
    router.push(`/banking/pupil-banking-details?pupilId=${pupilId}`);
  };

  const handleCreateAccount = async (pupil: Pupil) => {
    try {
      await createAccountMutation.mutateAsync({
        pupilId: pupil.id,
        accountName: `${pupil.firstName} ${pupil.lastName}`,
        accountNumber: '',
        balance: 0,
      });
      
      toast({
        title: "Success",
        description: "Bank account created successfully",
      });
      setOpenCreateAccount(false);
    } catch (error: any) {
      console.error('Error creating account:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || 'Failed to create account',
      });
    }
  };

  const handleDeleteAccount = async () => {
    if (!accountToDelete) return;
    
    try {
      await deleteAccountMutation.mutateAsync(accountToDelete.id);
      toast({
        title: "Success",
        description: `Bank account for ${accountToDelete.name} has been deleted`,
      });
      setAccountToDelete(null);
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || 'Failed to delete account',
      });
    }
  };

  const handleDeactivateAccount = async (accountId: string, pupilName: string) => {
    try {
      await deactivateAccountMutation.mutateAsync(accountId);
      toast({
        title: "Success",
        description: `Bank account for ${pupilName} has been deactivated`,
      });
    } catch (error: any) {
      console.error('Error deactivating account:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || 'Failed to deactivate account',
      });
    }
  };

  const handleReactivateAccount = async (accountId: string, pupilName: string) => {
    try {
      await reactivateAccountMutation.mutateAsync(accountId);
      toast({
        title: "Success",
        description: `Bank account for ${pupilName} has been reactivated`,
      });
    } catch (error: any) {
      console.error('Error reactivating account:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || 'Failed to reactivate account',
      });
    }
  };

  const getTotalBalance = () => accounts.reduce((total, account) => total + account.balance, 0);
  const getActiveAccounts = () => accounts.filter(account => account.isActive !== false);
  const getPositiveBalances = () => accounts.filter(account => account.balance > 0);

  if (accountsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading bank accounts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        
        {/* Modern Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/banking')}
                className="sm:hidden p-2"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Bank Accounts</h1>
                  <p className="text-sm text-gray-500 hidden sm:block">Manage student banking</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 flex-1 sm:flex-initial sm:max-w-md">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search accounts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white/70 backdrop-blur-sm"
                />
              </div>
              
              <ModernDialog open={openCreateAccount} onOpenChange={setOpenCreateAccount}>
                <ModernDialogTrigger asChild>
                  <Button className="flex items-center gap-2 text-sm" size="sm">
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Create Account</span>
                    <span className="sm:hidden">Create</span>
                  </Button>
                </ModernDialogTrigger>
                <ModernDialogContent size="md" open={openCreateAccount} onOpenChange={setOpenCreateAccount}>
                  <ModernDialogHeader>
                    <ModernDialogTitle>Create Bank Account</ModernDialogTitle>
                    <ModernDialogDescription>
                      Select a pupil to create a new bank account for them.
                    </ModernDialogDescription>
                  </ModernDialogHeader>
                  <div className="mt-4">
                    <PupilSelector
                      onSelect={(pupil) => pupil && handleCreateAccount(pupil)}
                    />
                  </div>
                </ModernDialogContent>
              </ModernDialog>
            </div>
          </div>
        </div>

        {/* Modern Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <Card className="border-0 shadow-sm bg-white/70 backdrop-blur-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">{accounts.length}</p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-white/70 backdrop-blur-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active</p>
                  <p className="text-xl sm:text-2xl font-bold text-green-600">{getActiveAccounts().length}</p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Power className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-white/70 backdrop-blur-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Positive</p>
                  <p className="text-xl sm:text-2xl font-bold text-emerald-600">{getPositiveBalances().length}</p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-white/70 backdrop-blur-sm col-span-2 lg:col-span-1">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Balance</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">
                    {formatCurrency(getTotalBalance())}
                  </p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>



        {/* Accounts List - Mobile Optimized */}
        <Card className="border-0 shadow-sm bg-white/70 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">
                Bank Accounts ({filteredAccounts.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
{filteredAccounts.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="text-gray-400 mb-4">
                  <CreditCard className="h-12 w-12 mx-auto mb-3" />
                  <p className="text-lg font-medium text-gray-600 mb-2">
                    {searchTerm ? 'No accounts found' : 'No bank accounts yet'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {searchTerm ? 'Try adjusting your search terms' : 'Create your first bank account to get started'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredAccounts.map((account) => {
                        const pupilName = `${account.pupil.firstName} ${account.pupil.lastName}`;
                        const isActive = account.isActive !== false;
                        
                        return (
                          <tr 
                            key={account.id} 
                            className="hover:bg-blue-50/50 cursor-pointer group transition-all duration-200"
                            onClick={() => handleViewAccount(account.pupilId)}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium">
                                  {account.pupil.firstName[0]}
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                    {pupilName}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    {account.accountNumber} • {account.pupil.admissionNumber}
                                  </p>
                                  {account.pupil.className && (
                                    <p className="text-xs text-gray-400">Class: {account.pupil.className}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`font-bold text-lg ${
                                account.balance >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {formatCurrency(account.balance)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Badge variant={account.balance >= 0 ? 'default' : 'destructive'} className="text-xs">
                                  {account.balance >= 0 ? 'Active' : 'Overdrawn'}
                                </Badge>
                                {!isActive && (
                                  <Badge variant="outline" className="text-xs">Deactivated</Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {isActive ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeactivateAccount(account.id, pupilName);
                                    }}
                                    className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                    title="Deactivate Account"
                                  >
                                    <PowerOff className="w-4 h-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReactivateAccount(account.id, pupilName);
                                    }}
                                    className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    title="Reactivate Account"
                                  >
                                    <Power className="w-4 h-4" />
                                  </Button>
                                )}
                                
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAccountToDelete({id: account.id, name: pupilName});
                                  }}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  title="Delete Account"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden divide-y divide-gray-100">
                  {filteredAccounts.map((account) => {
                    const pupilName = `${account.pupil.firstName} ${account.pupil.lastName}`;
                    const isActive = account.isActive !== false;
                    
                    return (
                      <div 
                        key={account.id}
                        className="p-4 hover:bg-blue-50/50 cursor-pointer transition-all duration-200 active:bg-blue-100/50"
                        onClick={() => handleViewAccount(account.pupilId)}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium">
                              {account.pupil.firstName[0]}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{pupilName}</h3>
                              <p className="text-sm text-gray-500">{account.pupil.admissionNumber}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            {isActive ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeactivateAccount(account.id, pupilName);
                                }}
                                className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              >
                                <PowerOff className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReactivateAccount(account.id, pupilName);
                                }}
                                className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                              >
                                <Power className="h-4 w-4" />
                              </Button>
                            )}
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAccountToDelete({id: account.id, name: pupilName});
                              }}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500 text-xs uppercase tracking-wide font-medium">Balance</p>
                            <p className={`font-bold text-lg ${
                              account.balance >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {formatCurrency(account.balance)}
                            </p>
                          </div>
                          
                          <div>
                            <p className="text-gray-500 text-xs uppercase tracking-wide font-medium">Status</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={account.balance >= 0 ? 'default' : 'destructive'} className="text-xs">
                                {account.balance >= 0 ? 'Active' : 'Overdrawn'}
                              </Badge>
                              {!isActive && (
                                <Badge variant="outline" className="text-xs">Deactivated</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-xs text-gray-500">
                            Account: {account.accountNumber}
                            {account.pupil.className && ` • Class: ${account.pupil.className}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!accountToDelete} onOpenChange={(open) => !open && setAccountToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the bank account for {accountToDelete?.name}. 
              This action cannot be undone and will remove all associated transaction history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAccountToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 