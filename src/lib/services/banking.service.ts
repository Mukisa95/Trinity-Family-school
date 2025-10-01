import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  where,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { PupilsService } from './pupils.service';
import { PupilSnapshotsService } from './pupil-snapshots.service';
import type { 
  Account, 
  Loan, 
  Transaction, 
  CreateAccountData, 
  CreateLoanData, 
  CreateTransactionData, 
  Pupil,
  EnhancedAccount,
  EnhancedLoan,
  EnhancedTransaction 
} from '@/types';

const ACCOUNTS_COLLECTION = 'bankAccounts';
const LOANS_COLLECTION = 'bankLoans';
const TRANSACTIONS_COLLECTION = 'bankTransactions';

export class BankingService {
  // Account operations
  static async getAllAccounts(): Promise<Account[]> {
    try {
      const q = query(collection(db, ACCOUNTS_COLLECTION), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      })) as Account[];
    } catch (error) {
      console.error('Error fetching accounts:', error);
      throw error;
    }
  }

  static async getAllAccountsWithPupils(): Promise<(Account & { 
    pupil: Pupil; 
    activeLoans: Loan[];
    totalOutstanding: number;
    availableBalance: number;
  })[]> {
    try {
      const accounts = await BankingService.getAllAccounts();
      
      // 🚀 OPTIMIZED: Only fetch pupils that have accounts, not all pupils
      const accountPupilIds = accounts.map(account => account.pupilId);
      const pupils = await PupilsService.getPupilsByIds(accountPupilIds);
      const pupilsMap = new Map(pupils.map(pupil => [pupil.id, pupil]));

      // Get all active loans
      const allLoansQuery = query(
        collection(db, LOANS_COLLECTION), 
        where('status', '==', 'ACTIVE')
      );
      const loansSnapshot = await getDocs(allLoansQuery);
      const allLoans = loansSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      })) as Loan[];

      // Group loans by pupilId
      const loansByPupil = new Map<string, Loan[]>();
      allLoans.forEach(loan => {
        if (!loansByPupil.has(loan.pupilId)) {
          loansByPupil.set(loan.pupilId, []);
        }
        loansByPupil.get(loan.pupilId)!.push(loan);
      });

      return accounts.map(account => {
        const pupil = pupilsMap.get(account.pupilId);
        if (!pupil) return null;

        const activeLoans = loansByPupil.get(account.pupilId) || [];
        const totalOutstanding = activeLoans.reduce((sum, loan) => sum + (loan.amount - loan.amountRepaid), 0);
        const availableBalance = Math.max(0, account.balance - totalOutstanding);

        return {
          ...account,
          pupil,
          activeLoans,
          totalOutstanding,
          availableBalance
        };
      }).filter(account => account !== null) as (Account & { 
        pupil: Pupil; 
        activeLoans: Loan[];
        totalOutstanding: number;
        availableBalance: number;
      })[];
    } catch (error) {
      console.error('Error fetching accounts with pupils:', error);
      throw error;
    }
  }

  static async getAccountByPupilId(pupilId: string): Promise<Account | null> {
    try {
      const q = query(collection(db, ACCOUNTS_COLLECTION), where('pupilId', '==', pupilId));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      } as Account;
    } catch (error) {
      console.error('Error fetching account by pupil ID:', error);
      throw error;
    }
  }

  static async createAccount(data: CreateAccountData): Promise<Account> {
    try {
      // Generate account number
      const accountNumber = await BankingService.generateAccountNumber();
      
      const accountData = {
        ...data,
        accountNumber,
        balance: 0,
        isActive: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, ACCOUNTS_COLLECTION), accountData);
      
      return {
        id: docRef.id,
        ...data,
        accountNumber,
        balance: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error creating account:', error);
      throw error;
    }
  }

  static async deleteAccount(accountId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, ACCOUNTS_COLLECTION, accountId));
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  }

  static async deactivateAccount(accountId: string): Promise<void> {
    try {
      const accountRef = doc(db, ACCOUNTS_COLLECTION, accountId);
      await updateDoc(accountRef, {
        isActive: false,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error deactivating account:', error);
      throw error;
    }
  }

  static async reactivateAccount(accountId: string): Promise<void> {
    try {
      const accountRef = doc(db, ACCOUNTS_COLLECTION, accountId);
      await updateDoc(accountRef, {
        isActive: true,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error reactivating account:', error);
      throw error;
    }
  }

  // Loan operations
  static async getLoansByPupilId(pupilId: string): Promise<Loan[]> {
    try {
      const q = query(
        collection(db, LOANS_COLLECTION), 
        where('pupilId', '==', pupilId)
      );
      const querySnapshot = await getDocs(q);
      
      const loans = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      })) as Loan[];

      // Sort by createdAt in JavaScript instead of Firestore
      return loans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('Error fetching loans:', error);
      throw error;
    }
  }

  static async getActiveLoansByPupilId(pupilId: string): Promise<Loan[]> {
    try {
      const q = query(
        collection(db, LOANS_COLLECTION), 
        where('pupilId', '==', pupilId),
        where('status', '==', 'ACTIVE')
      );
      const querySnapshot = await getDocs(q);
      
      const loans = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      })) as Loan[];

      // Sort by createdAt (oldest first for repayment priority)
      return loans.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } catch (error) {
      console.error('Error fetching active loans:', error);
      throw error;
    }
  }

  static async createLoan(data: CreateLoanData): Promise<Loan> {
    try {
      // Get the pupil's account
      const account = await BankingService.getAccountByPupilId(data.pupilId);
      if (!account) {
        throw new Error('Account not found for this pupil');
      }

      const loanData = {
        ...data,
        amountRepaid: 0,
        status: 'ACTIVE' as const,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      // Create the loan
      const docRef = await addDoc(collection(db, LOANS_COLLECTION), loanData);
      
      // Add loan amount to account balance
      const newBalance = account.balance + data.amount;
      const accountRef = doc(db, ACCOUNTS_COLLECTION, account.id);
      await updateDoc(accountRef, {
        balance: newBalance,
        updatedAt: Timestamp.now()
      });

      // Create a transaction record for loan disbursement
      const transactionData = {
        pupilId: data.pupilId,
        accountId: account.id,
        type: 'LOAN_DISBURSEMENT' as const,
        amount: data.amount,
        description: `Loan disbursement: ${data.purpose}`,
        balance: newBalance,
        transactionDate: new Date().toISOString(),
        createdAt: Timestamp.now()
      };

      await addDoc(collection(db, TRANSACTIONS_COLLECTION), transactionData);
      
      return {
        id: docRef.id,
        ...data,
        amountRepaid: 0,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error creating loan:', error);
      throw error;
    }
  }

  // Transaction operations
  static async getTransactionsByAccountId(accountId: string): Promise<Transaction[]> {
    try {
      const q = query(
        collection(db, TRANSACTIONS_COLLECTION), 
        where('accountId', '==', accountId),
        orderBy('transactionDate', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        transactionDate: doc.data().transactionDate?.toDate?.()?.toISOString() || doc.data().transactionDate,
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
      })) as Transaction[];
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

  static async getTransactionsByPupilId(pupilId: string): Promise<Transaction[]> {
    try {
      const q = query(
        collection(db, TRANSACTIONS_COLLECTION), 
        where('pupilId', '==', pupilId)
      );
      const querySnapshot = await getDocs(q);
      
      const transactions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        transactionDate: doc.data().transactionDate?.toDate?.()?.toISOString() || doc.data().transactionDate,
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
      })) as Transaction[];

      // Sort by transactionDate in JavaScript instead of Firestore
      return transactions.sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
    } catch (error) {
      console.error('Error fetching transactions by pupil ID:', error);
      throw error;
    }
  }

  static async revertTransaction(transactionId: string): Promise<void> {
    try {
      // Get the transaction to revert
      const transactionRef = doc(db, TRANSACTIONS_COLLECTION, transactionId);
      const transactionDoc = await getDoc(transactionRef);
      
      if (!transactionDoc.exists()) {
        throw new Error('Transaction not found');
      }
      
      const transaction = {
        id: transactionDoc.id,
        ...transactionDoc.data(),
        createdAt: transactionDoc.data().createdAt?.toDate?.()?.toISOString() || transactionDoc.data().createdAt,
        transactionDate: transactionDoc.data().transactionDate || transactionDoc.data().createdAt?.toDate?.()?.toISOString() || transactionDoc.data().createdAt
      } as Transaction;
      
      // Get the account
      const account = await BankingService.getAccountByPupilId(transaction.pupilId);
      if (!account) {
        throw new Error('Account not found for this transaction');
      }
      
      // Calculate the reversal amount and new balance
      let newBalance = account.balance;
      if (transaction.type === 'DEPOSIT' || transaction.type === 'LOAN_DISBURSEMENT') {
        // For deposits and loan disbursements, subtract the amount to revert
        newBalance -= transaction.amount;
      } else if (transaction.type === 'WITHDRAWAL' || transaction.type === 'LOAN_REPAYMENT') {
        // For withdrawals and loan repayments, add the amount back
        newBalance += transaction.amount;
      }
      
      // Create a reversal transaction
      const reversalData = {
        pupilId: transaction.pupilId,
        accountId: transaction.accountId,
        type: 'WITHDRAWAL' as const, // Reversal is always treated as withdrawal from current balance
        amount: transaction.amount,
        description: `Reversal of ${transaction.type}: ${transaction.description}`,
        balance: newBalance,
        transactionDate: new Date().toISOString(),
        academicYearId: transaction.academicYearId,
        termId: transaction.termId,
        processedBy: 'System - Reversal',
        createdAt: Timestamp.now(),
        originalTransactionId: transactionId // Link to original transaction
      };
      
      // Add the reversal transaction
      await addDoc(collection(db, TRANSACTIONS_COLLECTION), reversalData);
      
      // Update account balance
      const accountRef = doc(db, ACCOUNTS_COLLECTION, account.id);
      await updateDoc(accountRef, {
        balance: newBalance,
        updatedAt: Timestamp.now()
      });
      
      // Mark original transaction as reverted
      await updateDoc(transactionRef, {
        isReverted: true,
        revertedAt: Timestamp.now(),
        revertedBy: 'System',
        updatedAt: Timestamp.now()
      });
      
    } catch (error) {
      console.error('Error reverting transaction:', error);
      throw error;
    }
  }

  static async cancelLoan(loanId: string): Promise<void> {
    try {
      // Get the loan to cancel
      const loanRef = doc(db, LOANS_COLLECTION, loanId);
      const loanDoc = await getDoc(loanRef);
      
      if (!loanDoc.exists()) {
        throw new Error('Loan not found');
      }
      
      const loan = {
        id: loanDoc.id,
        ...loanDoc.data(),
        createdAt: loanDoc.data().createdAt?.toDate?.()?.toISOString() || loanDoc.data().createdAt,
        updatedAt: loanDoc.data().updatedAt?.toDate?.()?.toISOString() || loanDoc.data().updatedAt
      } as Loan;
      
      if (loan.status !== 'ACTIVE') {
        throw new Error('Only active loans can be cancelled');
      }
      
      // Get the account
      const account = await BankingService.getAccountByPupilId(loan.pupilId);
      if (!account) {
        throw new Error('Account not found for this loan');
      }
      
      // Calculate how much to deduct from account (outstanding loan amount)
      const outstandingAmount = loan.amount - loan.amountRepaid;
      
      if (account.balance < outstandingAmount) {
        throw new Error('Insufficient balance to cancel loan. Account balance must cover the outstanding loan amount.');
      }
      
      // Update account balance (subtract outstanding amount)
      const newBalance = account.balance - outstandingAmount;
      const accountRef = doc(db, ACCOUNTS_COLLECTION, account.id);
      await updateDoc(accountRef, {
        balance: newBalance,
        updatedAt: Timestamp.now()
      });
      
      // Create a transaction record for loan cancellation
      const cancellationTransactionData = {
        pupilId: loan.pupilId,
        accountId: account.id,
        type: 'LOAN_REPAYMENT' as const,
        amount: outstandingAmount,
        description: `Loan cancellation: ${loan.purpose}`,
        balance: newBalance,
        transactionDate: new Date().toISOString(),
        academicYearId: loan.academicYearId || '',
        termId: loan.termId || '',
        processedBy: 'System - Loan Cancellation',
        createdAt: Timestamp.now()
      };
      
      await addDoc(collection(db, TRANSACTIONS_COLLECTION), cancellationTransactionData);
      
      // Update loan status to cancelled
      await updateDoc(loanRef, {
        status: 'CANCELLED',
        cancelledAt: Timestamp.now(),
        cancelledBy: 'System',
        amountRepaid: loan.amount, // Mark as fully repaid for accounting purposes
        updatedAt: Timestamp.now()
      });
      
    } catch (error) {
      console.error('Error cancelling loan:', error);
      throw error;
    }
  }

  // ADMIN/CLEANUP METHODS
  static async deleteAllTransactions(): Promise<{ deletedCount: number; message: string }> {
    try {
      console.warn('🚨 DELETING ALL TRANSACTIONS - This action cannot be undone!');
      
      // Get all transactions
      const transactionsQuery = query(collection(db, TRANSACTIONS_COLLECTION));
      const querySnapshot = await getDocs(transactionsQuery);
      
      const deletedCount = querySnapshot.size;
      
      if (deletedCount === 0) {
        return {
          deletedCount: 0,
          message: 'No transactions found to delete'
        };
      }
      
      // Delete all transactions in batches (Firestore batch limit is 500)
      const batchSize = 500;
      const batches = [];
      
      for (let i = 0; i < querySnapshot.docs.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchDocs = querySnapshot.docs.slice(i, i + batchSize);
        
        batchDocs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        batches.push(batch);
      }
      
      // Execute all batches
      await Promise.all(batches.map(batch => batch.commit()));
      
      console.log(`✅ Successfully deleted ${deletedCount} transactions`);
      
      return {
        deletedCount,
        message: `Successfully deleted ${deletedCount} test transactions`
      };
      
    } catch (error) {
      console.error('Error deleting all transactions:', error);
      throw error;
    }
  }

  static async resetAllAccountBalances(): Promise<{ updatedCount: number; message: string }> {
    try {
      console.warn('🚨 RESETTING ALL ACCOUNT BALANCES TO ZERO');
      
      // Get all accounts
      const accountsQuery = query(collection(db, ACCOUNTS_COLLECTION));
      const querySnapshot = await getDocs(accountsQuery);
      
      const updatedCount = querySnapshot.size;
      
      if (updatedCount === 0) {
        return {
          updatedCount: 0,
          message: 'No accounts found to reset'
        };
      }
      
      // Reset all account balances to 0 in batches
      const batchSize = 500;
      const batches = [];
      
      for (let i = 0; i < querySnapshot.docs.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchDocs = querySnapshot.docs.slice(i, i + batchSize);
        
        batchDocs.forEach(doc => {
          batch.update(doc.ref, {
            balance: 0,
            updatedAt: Timestamp.now()
          });
        });
        
        batches.push(batch);
      }
      
      // Execute all batches
      await Promise.all(batches.map(batch => batch.commit()));
      
      console.log(`✅ Successfully reset ${updatedCount} account balances to zero`);
      
      return {
        updatedCount,
        message: `Successfully reset ${updatedCount} account balances to zero`
      };
      
    } catch (error) {
      console.error('Error resetting account balances:', error);
      throw error;
    }
  }

  static async deleteAllTestData(): Promise<{ 
    deletedTransactions: number; 
    resetAccounts: number; 
    message: string 
  }> {
    try {
      console.warn('🚨 DELETING ALL TEST BANKING DATA - This action cannot be undone!');
      
      // First delete all transactions
      const transactionResult = await BankingService.deleteAllTransactions();
      
      // Then reset all account balances to zero
      const accountResult = await BankingService.resetAllAccountBalances();
      
      const message = `Cleanup completed: ${transactionResult.deletedCount} transactions deleted, ${accountResult.updatedCount} account balances reset to zero`;
      
      console.log(`✅ ${message}`);
      
      return {
        deletedTransactions: transactionResult.deletedCount,
        resetAccounts: accountResult.updatedCount,
        message
      };
      
    } catch (error) {
      console.error('Error deleting all test data:', error);
      throw error;
    }
  }

  static async createTransaction(data: CreateTransactionData): Promise<Transaction> {
    try {
      // Get current account balance
      const account = await BankingService.getAccountByPupilId(data.pupilId);
      if (!account) {
        throw new Error('Account not found');
      }

      let newBalance = account.balance;
      let finalAmount = data.amount;
      let finalDescription = data.description;
      const transactions: any[] = [];

      // Handle different transaction types
      if (data.type === 'DEPOSIT') {
        // Check for active loans first
        const activeLoans = await BankingService.getActiveLoansByPupilId(data.pupilId);
        let remainingDepositAmount = data.amount;

        // Auto-repay loans with the deposit
        for (const loan of activeLoans) {
          if (remainingDepositAmount <= 0) break;

          const outstandingAmount = loan.amount - loan.amountRepaid;
          const repaymentAmount = Math.min(remainingDepositAmount, outstandingAmount);

          if (repaymentAmount > 0) {
            // Update loan
            const loanRef = doc(db, LOANS_COLLECTION, loan.id);
            const newAmountRepaid = loan.amountRepaid + repaymentAmount;
            const newStatus = newAmountRepaid >= loan.amount ? 'PAID' : 'ACTIVE';

            await updateDoc(loanRef, {
              amountRepaid: newAmountRepaid,
              status: newStatus,
              updatedAt: Timestamp.now()
            });

            // Create loan repayment transaction
            const loanRepaymentTransaction = {
              pupilId: data.pupilId,
              accountId: account.id,
              type: 'LOAN_REPAYMENT' as const,
              amount: repaymentAmount,
              description: `Auto loan repayment from deposit - ${loan.purpose}`,
              balance: newBalance, // Balance doesn't change for loan repayment
              transactionDate: data.transactionDate || new Date().toISOString(),
              createdAt: Timestamp.now()
            };

            const loanRepaymentRef = await addDoc(collection(db, TRANSACTIONS_COLLECTION), loanRepaymentTransaction);
            transactions.push({
              id: loanRepaymentRef.id,
              ...loanRepaymentTransaction,
              createdAt: new Date().toISOString()
            });

            remainingDepositAmount -= repaymentAmount;
          }
        }

        // Add remaining amount to balance
        if (remainingDepositAmount > 0) {
          newBalance += remainingDepositAmount;
          finalAmount = remainingDepositAmount;
          finalDescription = remainingDepositAmount < data.amount 
            ? `${data.description} (${data.amount - remainingDepositAmount} used for loan repayment)`
            : data.description;
        } else {
          // All deposit went to loan repayment
          finalAmount = 0;
          finalDescription = `${data.description} (fully used for loan repayment)`;
        }
      } else if (data.type === 'WITHDRAWAL') {
        // Check if sufficient balance for withdrawal
        if (account.balance < data.amount) {
          throw new Error('Insufficient balance for withdrawal');
        }
        newBalance -= data.amount;
      } else {
        // For other transaction types (LOAN_DISBURSEMENT, LOAN_REPAYMENT)
        const isDebit = ['LOAN_REPAYMENT'].includes(data.type);
        newBalance = isDebit ? account.balance - data.amount : account.balance + data.amount;
      }

      // Create the main transaction only if there's an amount to record
      if (finalAmount > 0 || data.type !== 'DEPOSIT') {
        const transactionData = {
          ...data,
          amount: finalAmount,
          description: finalDescription,
          balance: newBalance,
          transactionDate: data.transactionDate || new Date().toISOString(),
          createdAt: Timestamp.now()
        };

        const docRef = await addDoc(collection(db, TRANSACTIONS_COLLECTION), transactionData);
        transactions.push({
          id: docRef.id,
          ...data,
          amount: finalAmount,
          description: finalDescription,
          balance: newBalance,
          transactionDate: data.transactionDate || new Date().toISOString(),
          createdAt: new Date().toISOString()
        });
      }

      // Update account balance
      const accountRef = doc(db, ACCOUNTS_COLLECTION, account.id);
      await updateDoc(accountRef, {
        balance: newBalance,
        updatedAt: Timestamp.now()
      });

      // Return the main transaction (last one created)
      return transactions[transactions.length - 1] || {
        id: '',
        ...data,
        amount: finalAmount,
        description: finalDescription,
        balance: newBalance,
        transactionDate: data.transactionDate || new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }
  }

  static async getAllLoansWithPupils(): Promise<(Loan & { pupil: Pupil })[]> {
    try {
      const q = query(collection(db, LOANS_COLLECTION), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const loans = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      })) as Loan[];

      // 🚀 OPTIMIZED: Only fetch pupils that have loans, not all pupils
      const loanPupilIds = loans.map(loan => loan.pupilId);
      const pupils = await PupilsService.getPupilsByIds(loanPupilIds);
      const pupilsMap = new Map(pupils.map(pupil => [pupil.id, pupil]));

      return loans.map(loan => ({
        ...loan,
        pupil: pupilsMap.get(loan.pupilId)!
      })).filter(loan => loan.pupil); // Filter out loans without valid pupils
    } catch (error) {
      console.error('Error fetching loans with pupils:', error);
      throw error;
    }
  }

  // Loan management methods
  static async processOverdueLoans(pupilId: string): Promise<{ processed: boolean; message: string }> {
    try {
      const account = await BankingService.getAccountByPupilId(pupilId);
      if (!account) {
        return { processed: false, message: 'Account not found' };
      }

      const activeLoans = await BankingService.getActiveLoansByPupilId(pupilId);
      const overdueLoans = activeLoans.filter(loan => {
        const repaymentDate = new Date(loan.repaymentDate);
        const today = new Date();
        return repaymentDate < today;
      });

      if (overdueLoans.length === 0) {
        return { processed: false, message: 'No overdue loans found' };
      }

      let totalCollected = 0;
      let remainingBalance = account.balance;

      for (const loan of overdueLoans) {
        if (remainingBalance <= 0) break;

        const outstandingAmount = loan.amount - loan.amountRepaid;
        const collectionAmount = Math.min(remainingBalance, outstandingAmount);

        if (collectionAmount > 0) {
          // Update loan
          const loanRef = doc(db, LOANS_COLLECTION, loan.id);
          const newAmountRepaid = loan.amountRepaid + collectionAmount;
          const newStatus = newAmountRepaid >= loan.amount ? 'PAID' : 'ACTIVE';

          await updateDoc(loanRef, {
            amountRepaid: newAmountRepaid,
            status: newStatus,
            updatedAt: Timestamp.now()
          });

          // Create transaction for overdue collection
          const transactionData = {
            pupilId: pupilId,
            accountId: account.id,
            type: 'LOAN_REPAYMENT' as const,
            amount: collectionAmount,
            description: `Overdue loan collection - ${loan.purpose}`,
            balance: remainingBalance - collectionAmount,
            transactionDate: new Date().toISOString(),
            createdAt: Timestamp.now()
          };

          await addDoc(collection(db, TRANSACTIONS_COLLECTION), transactionData);

          totalCollected += collectionAmount;
          remainingBalance -= collectionAmount;
        }
      }

      // Update account balance
      if (totalCollected > 0) {
        const accountRef = doc(db, ACCOUNTS_COLLECTION, account.id);
        await updateDoc(accountRef, {
          balance: remainingBalance,
          updatedAt: Timestamp.now()
        });

        return { 
          processed: true, 
          message: `Collected ${totalCollected} from account balance for overdue loans` 
        };
      }

      return { processed: false, message: 'Insufficient balance to cover overdue loans' };
    } catch (error) {
      console.error('Error processing overdue loans:', error);
      throw error;
    }
  }

  static async processAllOverdueLoans(): Promise<{ 
    totalProcessed: number; 
    totalCollected: number; 
    results: Array<{ pupilId: string; pupilName: string; processed: boolean; message: string; amount?: number }> 
  }> {
    try {
      // Get all active loans that are overdue
      const today = new Date();
      const allLoansQuery = query(
        collection(db, LOANS_COLLECTION), 
        where('status', '==', 'ACTIVE')
      );
      const loansSnapshot = await getDocs(allLoansQuery);
      const allLoans = loansSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      })) as Loan[];

      const overdueLoans = allLoans.filter(loan => {
        const repaymentDate = new Date(loan.repaymentDate);
        return repaymentDate < today;
      });

      // Group by pupilId
      const loansByPupil = new Map<string, Loan[]>();
      overdueLoans.forEach(loan => {
        if (!loansByPupil.has(loan.pupilId)) {
          loansByPupil.set(loan.pupilId, []);
        }
        loansByPupil.get(loan.pupilId)!.push(loan);
      });

      // 🚀 OPTIMIZED: Only fetch pupils that have overdue loans, not all pupils
      const overduePupilIds = overdueLoans.map(loan => loan.pupilId);
      const pupils = await PupilsService.getPupilsByIds(overduePupilIds);
      const pupilsMap = new Map(pupils.map(pupil => [pupil.id, pupil]));

      let totalProcessed = 0;
      let totalCollected = 0;
      const results: Array<{ pupilId: string; pupilName: string; processed: boolean; message: string; amount?: number }> = [];

      for (const [pupilId, loans] of loansByPupil) {
        const pupil = pupilsMap.get(pupilId);
        if (!pupil) continue;

        const result = await BankingService.processOverdueLoans(pupilId);
        
        // Extract amount from message if processed
        let amount = 0;
        if (result.processed && result.message.includes('Collected')) {
          const match = result.message.match(/Collected (\d+)/);
          if (match) {
            amount = parseInt(match[1]);
            totalCollected += amount;
          }
        }

        if (result.processed) {
          totalProcessed++;
        }

        results.push({
          pupilId,
          pupilName: `${pupil.firstName} ${pupil.lastName}`,
          processed: result.processed,
          message: result.message,
          amount: amount > 0 ? amount : undefined
        });
      }

      return {
        totalProcessed,
        totalCollected,
        results
      };
    } catch (error) {
      console.error('Error processing all overdue loans:', error);
      throw error;
    }
  }

  static async getAccountSummary(pupilId: string): Promise<{
    account: Account | null;
    activeLoans: Loan[];
    totalLoanAmount: number;
    totalOutstanding: number;
    availableBalance: number;
  }> {
    try {
      const account = await BankingService.getAccountByPupilId(pupilId);
      const activeLoans = await BankingService.getActiveLoansByPupilId(pupilId);
      
      const totalLoanAmount = activeLoans.reduce((sum, loan) => sum + loan.amount, 0);
      const totalOutstanding = activeLoans.reduce((sum, loan) => sum + (loan.amount - loan.amountRepaid), 0);
      const availableBalance = account ? Math.max(0, account.balance - totalOutstanding) : 0;

      return {
        account,
        activeLoans,
        totalLoanAmount,
        totalOutstanding,
        availableBalance
      };
    } catch (error) {
      console.error('Error getting account summary:', error);
      throw error;
    }
  }

  // Helper methods
  static async generateAccountNumber(): Promise<string> {
    // Generate a unique account number
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ACC${timestamp.slice(-6)}${random}`;
  }

  /**
   * NEW: Get enhanced transactions with historical pupil data
   */
  static async getEnhancedTransactionsByPupil(
    pupilId: string,
    academicYearId?: string,
    termId?: string
  ): Promise<EnhancedTransaction[]> {
    try {
      let q = query(
        collection(db, TRANSACTIONS_COLLECTION),
        where('pupilId', '==', pupilId),
        orderBy('transactionDate', 'desc')
      );

      // Add academic context filters if provided
      if (academicYearId) {
        q = query(q, where('academicYearId', '==', academicYearId));
      }
      if (termId) {
        q = query(q, where('termId', '==', termId));
      }

      const querySnapshot = await getDocs(q);
      const transactions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        transactionDate: doc.data().transactionDate || doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
      } as Transaction));

      return this.enhanceTransactionsWithHistoricalData(transactions);
    } catch (error) {
      console.error('Error fetching enhanced transactions:', error);
      throw error;
    }
  }

  /**
   * NEW: Get enhanced loans with historical pupil data
   */
  static async getEnhancedLoansByPupil(
    pupilId: string,
    academicYearId?: string,
    termId?: string
  ): Promise<EnhancedLoan[]> {
    try {
      let q = query(
        collection(db, LOANS_COLLECTION),
        where('pupilId', '==', pupilId),
        orderBy('createdAt', 'desc')
      );

      if (academicYearId) {
        q = query(q, where('academicYearId', '==', academicYearId));
      }
      if (termId) {
        q = query(q, where('termId', '==', termId));
      }

      const querySnapshot = await getDocs(q);
      const loans = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      } as Loan));

      return this.enhanceLoansWithHistoricalData(loans);
    } catch (error) {
      console.error('Error fetching enhanced loans:', error);
      throw error;
    }
  }

  /**
   * NEW: Get enhanced account with historical context
   */
  static async getEnhancedAccountByPupil(
    pupilId: string,
    academicYearId?: string,
    termId?: string
  ): Promise<EnhancedAccount | null> {
    try {
      const account = await this.getAccountByPupilId(pupilId);
      if (!account) return null;

      // Get enhanced transactions and loans
      const [transactions, loans] = await Promise.all([
        this.getEnhancedTransactionsByPupil(pupilId, academicYearId, termId),
        this.getEnhancedLoansByPupil(pupilId, academicYearId, termId)
      ]);

      // Get snapshot data for the account context
      let pupilSnapshotData = undefined;
      if (termId) {
        const snapshot = await PupilSnapshotsService.getSnapshot(pupilId, termId);
        if (snapshot) {
          pupilSnapshotData = {
            classId: snapshot.classId,
            section: snapshot.section,
            admissionNumber: snapshot.admissionNumber,
            dateOfBirth: snapshot.dateOfBirth,
            dataSource: 'snapshot' as const,
            snapshotId: snapshot.id
          };
        }
      }

      return {
        ...account,
        pupilSnapshotData,
        transactions,
        loans
      };
    } catch (error) {
      console.error('Error fetching enhanced account:', error);
      throw error;
    }
  }

  /**
   * NEW: Create enhanced transaction with academic context
   */
  static async createEnhancedTransaction(
    data: Omit<Transaction, 'id' | 'createdAt' | 'balance'>
  ): Promise<EnhancedTransaction> {
    try {
      // Get current account balance
      const account = await this.getAccountByPupilId(data.pupilId);
      if (!account) {
        throw new Error('Account not found for pupil');
      }

      // Calculate new balance
      let newBalance = account.balance;
      switch (data.type) {
        case 'DEPOSIT':
        case 'LOAN_DISBURSEMENT':
          newBalance += data.amount;
          break;
        case 'WITHDRAWAL':
        case 'LOAN_REPAYMENT':
          newBalance -= data.amount;
          break;
      }

      const transactionData = {
        ...data,
        balance: newBalance,
        createdAt: Timestamp.now(),
        transactionDate: data.transactionDate || new Date().toISOString()
      };

      // Create transaction
      const docRef = await addDoc(collection(db, TRANSACTIONS_COLLECTION), transactionData);

      // Update account balance
      await updateDoc(doc(db, ACCOUNTS_COLLECTION, account.id), {
        balance: newBalance,
        updatedAt: Timestamp.now()
      });

      const newTransaction: Transaction = {
        id: docRef.id,
        ...data,
        balance: newBalance,
        createdAt: new Date().toISOString(),
        transactionDate: data.transactionDate || new Date().toISOString()
      };

      // Enhance with historical data
      const enhanced = await this.enhanceTransactionsWithHistoricalData([newTransaction]);
      return enhanced[0];
    } catch (error) {
      console.error('Error creating enhanced transaction:', error);
      throw error;
    }
  }

  /**
   * NEW: Create enhanced loan with academic context
   */
  static async createEnhancedLoan(
    data: CreateLoanData & { academicYearId?: string; termId?: string }
  ): Promise<EnhancedLoan> {
    try {
      const loanData = {
        ...data,
        amountRepaid: 0,
        status: 'ACTIVE' as const,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, LOANS_COLLECTION), loanData);

      const newLoan: Loan = {
        id: docRef.id,
        ...data,
        amountRepaid: 0,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Create loan disbursement transaction
      if (data.academicYearId && data.termId) {
        const account = await this.getAccountByPupilId(data.pupilId);
        if (account) {
          await this.createEnhancedTransaction({
            pupilId: data.pupilId,
            accountId: account.id,
            type: 'LOAN_DISBURSEMENT',
            amount: data.amount,
            description: `Loan disbursement: ${data.purpose}`,
            transactionDate: new Date().toISOString(),
            academicYearId: data.academicYearId,
            termId: data.termId,
            processedBy: 'System'
          });
        }
      }

      // Enhance with historical data
      const enhanced = await this.enhanceLoansWithHistoricalData([newLoan]);
      return enhanced[0];
    } catch (error) {
      console.error('Error creating enhanced loan:', error);
      throw error;
    }
  }

  /**
   * NEW: Private method to enhance transactions with historical pupil data
   */
  private static async enhanceTransactionsWithHistoricalData(
    transactions: Transaction[]
  ): Promise<EnhancedTransaction[]> {
    const enhancedTransactions: EnhancedTransaction[] = [];

    for (const transaction of transactions) {
      try {
        let pupilSnapshotData = undefined;

        // Get snapshot for the specific term if available
        if (transaction.termId) {
          const snapshot = await PupilSnapshotsService.getSnapshot(
            transaction.pupilId,
            transaction.termId
          );

          if (snapshot) {
            pupilSnapshotData = {
              classId: snapshot.classId,
              section: snapshot.section,
              admissionNumber: snapshot.admissionNumber,
              dateOfBirth: snapshot.dateOfBirth,
              dataSource: 'snapshot' as const,
              snapshotId: snapshot.id
            };
          }
        }

        const enhancedTransaction: EnhancedTransaction = {
          ...transaction,
          pupilSnapshotData
        };

        enhancedTransactions.push(enhancedTransaction);
      } catch (error) {
        console.error(`Error enhancing transaction ${transaction.id}:`, error);
        // If enhancement fails, include the transaction without enhancement
        enhancedTransactions.push(transaction as EnhancedTransaction);
      }
    }

    return enhancedTransactions;
  }

  /**
   * NEW: Private method to enhance loans with historical pupil data
   */
  private static async enhanceLoansWithHistoricalData(
    loans: Loan[]
  ): Promise<EnhancedLoan[]> {
    const enhancedLoans: EnhancedLoan[] = [];

    for (const loan of loans) {
      try {
        let pupilSnapshotData = undefined;

        // Get snapshot for the specific term if available
        if (loan.termId) {
          const snapshot = await PupilSnapshotsService.getSnapshot(
            loan.pupilId,
            loan.termId
          );

          if (snapshot) {
            pupilSnapshotData = {
              classId: snapshot.classId,
              section: snapshot.section,
              admissionNumber: snapshot.admissionNumber,
              dateOfBirth: snapshot.dateOfBirth,
              dataSource: 'snapshot' as const,
              snapshotId: snapshot.id
            };
          }
        }

        const enhancedLoan: EnhancedLoan = {
          ...loan,
          pupilSnapshotData
        };

        enhancedLoans.push(enhancedLoan);
      } catch (error) {
        console.error(`Error enhancing loan ${loan.id}:`, error);
        // If enhancement fails, include the loan without enhancement
        enhancedLoans.push(loan as EnhancedLoan);
      }
    }

    return enhancedLoans;
  }
} 