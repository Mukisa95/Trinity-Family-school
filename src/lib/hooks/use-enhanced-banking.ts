import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BankingService } from '@/lib/services/banking.service';
import type { 
  EnhancedAccount, 
  EnhancedTransaction, 
  EnhancedLoan,
  CreateLoanData,
  Transaction
} from '@/types';

export function useEnhancedAccountByPupil(
  pupilId: string,
  academicYearId?: string,
  termId?: string
) {
  return useQuery({
    queryKey: ['enhanced-account', pupilId, academicYearId, termId],
    queryFn: () => BankingService.getEnhancedAccountByPupil(pupilId, academicYearId, termId),
    enabled: !!pupilId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useEnhancedTransactionsByPupil(
  pupilId: string,
  academicYearId?: string,
  termId?: string
) {
  return useQuery({
    queryKey: ['enhanced-transactions', pupilId, academicYearId, termId],
    queryFn: () => BankingService.getEnhancedTransactionsByPupil(pupilId, academicYearId, termId),
    enabled: !!pupilId,
    staleTime: 1000 * 60 * 1, // 1 minute
  });
}

export function useEnhancedLoansByPupil(
  pupilId: string,
  academicYearId?: string,
  termId?: string
) {
  return useQuery({
    queryKey: ['enhanced-loans', pupilId, academicYearId, termId],
    queryFn: () => BankingService.getEnhancedLoansByPupil(pupilId, academicYearId, termId),
    enabled: !!pupilId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useCreateEnhancedTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Omit<Transaction, 'id' | 'createdAt' | 'balance'>) => 
      BankingService.createEnhancedTransaction(data),
    onSuccess: (data) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['enhanced-account', data.pupilId] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-transactions', data.pupilId] });
      queryClient.invalidateQueries({ queryKey: ['banking'] });
    },
  });
}

export function useCreateEnhancedLoan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateLoanData & { academicYearId?: string; termId?: string }) => 
      BankingService.createEnhancedLoan(data),
    onSuccess: (data) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['enhanced-account', data.pupilId] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-loans', data.pupilId] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-transactions', data.pupilId] });
      queryClient.invalidateQueries({ queryKey: ['banking'] });
    },
  });
}

// Historical data analysis hooks
export function useEnhancedBankingHistory(
  pupilId: string,
  academicYearIds?: string[]
) {
  return useQuery({
    queryKey: ['enhanced-banking-history', pupilId, academicYearIds],
    queryFn: async () => {
      if (!academicYearIds?.length) return [];
      
      const historyPromises = academicYearIds.map(async (academicYearId) => {
        const account = await BankingService.getEnhancedAccountByPupil(
          pupilId, 
          academicYearId
        );
        return {
          academicYearId,
          account,
          totalTransactions: account?.transactions?.length || 0,
          totalDeposits: account?.transactions?.filter(t => t.type === 'DEPOSIT')
            .reduce((sum, t) => sum + t.amount, 0) || 0,
          totalWithdrawals: account?.transactions?.filter(t => t.type === 'WITHDRAWAL')
            .reduce((sum, t) => sum + t.amount, 0) || 0,
          totalLoans: account?.loans?.reduce((sum, l) => sum + l.amount, 0) || 0,
          totalLoansRepaid: account?.loans?.reduce((sum, l) => sum + l.amountRepaid, 0) || 0
        };
      });
      
      return Promise.all(historyPromises);
    },
    enabled: !!pupilId && !!academicYearIds?.length,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
} 