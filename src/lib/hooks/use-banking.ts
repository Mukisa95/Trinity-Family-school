import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BankingService } from '../services/banking.service';
import type { Account, Loan, Transaction, CreateAccountData, CreateLoanData, CreateTransactionData, Pupil } from '@/types';

// Query keys
export const bankingKeys = {
  all: ['banking'] as const,
  accounts: () => [...bankingKeys.all, 'accounts'] as const,
  accountsWithPupils: () => [...bankingKeys.accounts(), 'withPupils'] as const,
  accountByPupil: (pupilId: string) => [...bankingKeys.accounts(), 'byPupil', pupilId] as const,
  accountSummary: (pupilId: string) => [...bankingKeys.accounts(), 'summary', pupilId] as const,
  loans: () => [...bankingKeys.all, 'loans'] as const,
  loansByPupil: (pupilId: string) => [...bankingKeys.loans(), 'byPupil', pupilId] as const,
  transactions: () => [...bankingKeys.all, 'transactions'] as const,
  transactionsByAccount: (accountId: string) => [...bankingKeys.transactions(), 'byAccount', accountId] as const,
  transactionsByPupil: (pupilId: string) => [...bankingKeys.transactions(), 'byPupil', pupilId] as const,
};

// Account hooks
export function useAccounts() {
  return useQuery({
    queryKey: bankingKeys.accounts(),
    queryFn: BankingService.getAllAccounts,
  });
}

export function useAccountsWithPupils() {
  return useQuery({
    queryKey: bankingKeys.accountsWithPupils(),
    queryFn: BankingService.getAllAccountsWithPupils,
  });
}

export function useAccountByPupilId(pupilId: string) {
  return useQuery({
    queryKey: bankingKeys.accountByPupil(pupilId),
    queryFn: () => BankingService.getAccountByPupilId(pupilId),
    enabled: !!pupilId,
  });
}

export function useAccountSummary(pupilId: string) {
  return useQuery({
    queryKey: bankingKeys.accountSummary(pupilId),
    queryFn: () => BankingService.getAccountSummary(pupilId),
    enabled: !!pupilId,
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateAccountData) => BankingService.createAccount(data),
    onSuccess: (_, variables) => {
      // Use setTimeout to batch invalidations and prevent infinite loops
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: bankingKeys.accountByPupil(variables.pupilId) });
        queryClient.invalidateQueries({ queryKey: bankingKeys.accountSummary(variables.pupilId) });
        queryClient.invalidateQueries({ queryKey: bankingKeys.accountsWithPupils() });
      }, 0);
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (accountId: string) => BankingService.deleteAccount(accountId),
    onSuccess: () => {
      // Use setTimeout to batch invalidations and prevent infinite loops
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: bankingKeys.accounts() });
        queryClient.invalidateQueries({ queryKey: bankingKeys.accountsWithPupils() });
      }, 0);
    },
  });
}

export function useDeactivateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (accountId: string) => BankingService.deactivateAccount(accountId),
    onSuccess: () => {
      // Use setTimeout to batch invalidations and prevent infinite loops
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: bankingKeys.accounts() });
        queryClient.invalidateQueries({ queryKey: bankingKeys.accountsWithPupils() });
      }, 0);
    },
  });
}

export function useReactivateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (accountId: string) => BankingService.reactivateAccount(accountId),
    onSuccess: () => {
      // Use setTimeout to batch invalidations and prevent infinite loops
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: bankingKeys.accounts() });
        queryClient.invalidateQueries({ queryKey: bankingKeys.accountsWithPupils() });
      }, 0);
    },
  });
}

// Loan hooks
export function useLoansByPupilId(pupilId: string) {
  return useQuery({
    queryKey: bankingKeys.loansByPupil(pupilId),
    queryFn: () => BankingService.getLoansByPupilId(pupilId),
    enabled: !!pupilId,
  });
}

export function useCreateLoan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateLoanData) => BankingService.createLoan(data),
    onSuccess: (_, variables) => {
      // Use setTimeout to batch invalidations and prevent infinite loops
      setTimeout(() => {
        // Invalidate specific queries for this pupil only
        queryClient.invalidateQueries({ queryKey: bankingKeys.loansByPupil(variables.pupilId) });
        queryClient.invalidateQueries({ queryKey: bankingKeys.accountByPupil(variables.pupilId) });
        queryClient.invalidateQueries({ queryKey: bankingKeys.accountSummary(variables.pupilId) });
        queryClient.invalidateQueries({ queryKey: bankingKeys.transactionsByPupil(variables.pupilId) });
        
        // Invalidate broader queries less frequently
        queryClient.invalidateQueries({ queryKey: bankingKeys.accountsWithPupils() });
      }, 0);
    },
  });
}

// Transaction hooks
export function useTransactionsByAccountId(accountId: string) {
  return useQuery({
    queryKey: bankingKeys.transactionsByAccount(accountId),
    queryFn: () => BankingService.getTransactionsByAccountId(accountId),
    enabled: !!accountId,
  });
}

export function useTransactionsByPupilId(pupilId: string) {
  return useQuery({
    queryKey: bankingKeys.transactionsByPupil(pupilId),
    queryFn: () => BankingService.getTransactionsByPupilId(pupilId),
    enabled: !!pupilId,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTransactionData) => BankingService.createTransaction(data),
    onSuccess: (_, variables) => {
      // Use setTimeout to batch invalidations and prevent infinite loops
      setTimeout(() => {
        // Invalidate specific queries for this pupil only
        queryClient.invalidateQueries({ queryKey: bankingKeys.accountByPupil(variables.pupilId) });
        queryClient.invalidateQueries({ queryKey: bankingKeys.accountSummary(variables.pupilId) });
        queryClient.invalidateQueries({ queryKey: bankingKeys.transactionsByPupil(variables.pupilId) });
        queryClient.invalidateQueries({ queryKey: bankingKeys.loansByPupil(variables.pupilId) });
        
        // Invalidate account-specific transaction queries
        if (variables.accountId) {
          queryClient.invalidateQueries({ queryKey: bankingKeys.transactionsByAccount(variables.accountId) });
        }
        
        // Invalidate broader queries less frequently
        queryClient.invalidateQueries({ queryKey: bankingKeys.accountsWithPupils() });
      }, 0);
    },
  });
}

export function useRevertTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId: string) => BankingService.revertTransaction(transactionId),
    onSuccess: () => {
      // Invalidate all banking-related queries since reversal affects multiple areas
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: bankingKeys.all });
      }, 0);
    },
  });
}

export function useCancelLoan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (loanId: string) => BankingService.cancelLoan(loanId),
    onSuccess: () => {
      // Invalidate all banking-related queries since loan cancellation affects multiple areas
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: bankingKeys.all });
      }, 0);
    },
  });
}

// Overdue loan processing hooks
export function useProcessOverdueLoans() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pupilId: string) => BankingService.processOverdueLoans(pupilId),
    onSuccess: (_, pupilId) => {
      // Use setTimeout to batch invalidations and prevent infinite loops
      setTimeout(() => {
        // Invalidate specific queries for this pupil only
        queryClient.invalidateQueries({ queryKey: bankingKeys.accountByPupil(pupilId) });
        queryClient.invalidateQueries({ queryKey: bankingKeys.accountSummary(pupilId) });
        queryClient.invalidateQueries({ queryKey: bankingKeys.loansByPupil(pupilId) });
        queryClient.invalidateQueries({ queryKey: bankingKeys.transactionsByPupil(pupilId) });
        
        // Invalidate broader queries
        queryClient.invalidateQueries({ queryKey: bankingKeys.accountsWithPupils() });
      }, 0);
    },
  });
}

export function useProcessAllOverdueLoans() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => BankingService.processAllOverdueLoans(),
    onSuccess: () => {
      // Invalidate all banking queries since multiple accounts may be affected
      queryClient.invalidateQueries({ queryKey: bankingKeys.all });
    },
  });
} 