import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  runTransaction,
  type Transaction as FirestoreTransaction,
  orderBy,
  where,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { PupilsService } from './pupils.service';
import { PupilSnapshotsService } from './pupil-snapshots.service';
import { HistoryLogService } from './history-log.service';
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
  private static async readAccountForTransaction(transaction: FirestoreTransaction, pupilId: string): Promise<Account> {
    // The Web SDK supports transactional document reads, not query reads.
    // Discover the account, then read its current balance inside the transaction.
    const matches = await getDocs(query(collection(db, ACCOUNTS_COLLECTION), where('pupilId', '==', pupilId)));
    if (matches.empty) throw new Error('Account not found');
    if (matches.docs.length > 1) {
      throw new Error('Multiple banking accounts exist for this pupil. Reconcile the accounts before recording a transaction.');
    }
    const snapshot = await transaction.get(matches.docs[0].ref);
    if (!snapshot.exists()) throw new Error('Account not found');
    const account = { id: snapshot.id, ...snapshot.data() } as Account;
    if (account.pupilId !== pupilId) throw new Error('Account does not belong to this pupil');
    return account;
  }
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
      await HistoryLogService.log({
        action: 'create',
        entity: 'bank_account',
        recordId: docRef.id,
        label: accountNumber,
        meta: {
          pupilId: data.pupilId,
        },
      });
      
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
      const accountDoc = await getDoc(doc(db, ACCOUNTS_COLLECTION, accountId));
      const account = accountDoc.exists()
        ? ({
            id: accountDoc.id,
            ...accountDoc.data(),
          } as Account)
        : null;
      await deleteDoc(doc(db, ACCOUNTS_COLLECTION, accountId));
      await HistoryLogService.log({
        action: 'delete',
        entity: 'bank_account',
        recordId: accountId,
        label: account?.accountNumber || accountId,
        meta: {
          pupilId: account?.pupilId || '',
        },
      });
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
      await HistoryLogService.log({
        action: 'status',
        entity: 'bank_account',
        recordId: accountId,
        changedFields: ['isActive'],
        meta: {
          active: false,
        },
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
      await HistoryLogService.log({
        action: 'status',
        entity: 'bank_account',
        recordId: accountId,
        changedFields: ['isActive'],
        meta: {
          active: true,
        },
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

  static async createLoan(data: CreateLoanData, options?: { disburse?: boolean; processedBy?: string }): Promise<Loan> {
    try {
      if (!Number.isFinite(data.amount) || data.amount <= 0) {
        throw new Error('Loan amount must be a positive number');
      }
      const loanRef = doc(collection(db, LOANS_COLLECTION));
      const transactionRef = doc(collection(db, TRANSACTIONS_COLLECTION));
      const now = Timestamp.now();
      const nowIso = new Date().toISOString();

      return await runTransaction(db, async firestoreTransaction => {
        const account = options?.disburse === false
          ? null
          : await this.readAccountForTransaction(firestoreTransaction, data.pupilId);
        const newBalance = account ? account.balance + data.amount : 0;

        firestoreTransaction.set(loanRef, {
          ...data,
          amountRepaid: 0,
          status: 'ACTIVE',
          createdAt: now,
          updatedAt: now,
        });
        if (account) {
          firestoreTransaction.set(transactionRef, {
            pupilId: data.pupilId,
            accountId: account.id,
            type: 'LOAN_DISBURSEMENT',
            amount: data.amount,
            description: `Loan disbursement: ${data.purpose}`,
            balance: newBalance,
            transactionDate: nowIso,
            createdAt: now,
            ...(('academicYearId' in data && data.academicYearId) ? { academicYearId: data.academicYearId } : {}),
            ...(('termId' in data && data.termId) ? { termId: data.termId } : {}),
            ...(options?.processedBy ? { processedBy: options.processedBy } : {}),
          });
          firestoreTransaction.update(doc(db, ACCOUNTS_COLLECTION, account.id), { balance: newBalance, updatedAt: now });
        }
        HistoryLogService.addToTransaction(firestoreTransaction, {
          action: 'create', entity: 'bank_loan', recordId: loanRef.id, label: data.purpose,
          meta: { amount: data.amount, pupilId: data.pupilId },
        });
        return {
          id: loanRef.id, ...data, amountRepaid: 0, status: 'ACTIVE', createdAt: nowIso, updatedAt: nowIso,
        } as Loan;
      });
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
      const transactionRef = doc(db, TRANSACTIONS_COLLECTION, transactionId);
      const reversalRef = doc(collection(db, TRANSACTIONS_COLLECTION));
      const now = Timestamp.now();
      const nowIso = new Date().toISOString();
      await runTransaction(db, async firestoreTransaction => {
        const transactionDoc = await firestoreTransaction.get(transactionRef);
        if (!transactionDoc.exists()) throw new Error('Transaction not found');
        const transaction = { id: transactionDoc.id, ...transactionDoc.data() } as Transaction;
        if (transaction.isReverted) throw new Error('Transaction has already been reverted');
        const account = await this.readAccountForTransaction(firestoreTransaction, transaction.pupilId);
        const newBalance = transaction.type === 'DEPOSIT' || transaction.type === 'LOAN_DISBURSEMENT'
          ? account.balance - transaction.amount
          : account.balance + transaction.amount;

        firestoreTransaction.set(reversalRef, {
          pupilId: transaction.pupilId, accountId: transaction.accountId, type: 'WITHDRAWAL',
          amount: transaction.amount, description: `Reversal of ${transaction.type}: ${transaction.description}`,
          balance: newBalance, transactionDate: nowIso, academicYearId: transaction.academicYearId,
          termId: transaction.termId, processedBy: 'System - Reversal', createdAt: now,
          originalTransactionId: transactionId,
        });
        firestoreTransaction.update(doc(db, ACCOUNTS_COLLECTION, account.id), { balance: newBalance, updatedAt: now });
        firestoreTransaction.update(transactionRef, { isReverted: true, revertedAt: now, revertedBy: 'System', updatedAt: now });
        HistoryLogService.addToTransaction(firestoreTransaction, {
          action: 'revert', entity: 'bank_transaction', recordId: transactionId,
          label: transaction.description || transactionId, changedFields: ['isReverted'],
          meta: { amount: transaction.amount, pupilId: transaction.pupilId, type: transaction.type },
        });
      });
    } catch (error) {
      console.error('Error reverting transaction:', error);
      throw error;
    }
  }

  static async cancelLoan(loanId: string): Promise<void> {
    try {
      const loanRef = doc(db, LOANS_COLLECTION, loanId);
      const cancellationRef = doc(collection(db, TRANSACTIONS_COLLECTION));
      const now = Timestamp.now();
      const nowIso = new Date().toISOString();
      await runTransaction(db, async firestoreTransaction => {
        const loanDoc = await firestoreTransaction.get(loanRef);
        if (!loanDoc.exists()) throw new Error('Loan not found');
        const loan = { id: loanDoc.id, ...loanDoc.data() } as Loan;
        if (loan.status !== 'ACTIVE') throw new Error('Only active loans can be cancelled');
        const account = await this.readAccountForTransaction(firestoreTransaction, loan.pupilId);
        const outstandingAmount = loan.amount - loan.amountRepaid;
        if (account.balance < outstandingAmount) {
          throw new Error('Insufficient balance to cancel loan. Account balance must cover the outstanding loan amount.');
        }
        const newBalance = account.balance - outstandingAmount;

        firestoreTransaction.set(cancellationRef, {
          pupilId: loan.pupilId, accountId: account.id, type: 'LOAN_REPAYMENT', amount: outstandingAmount,
          description: `Loan cancellation: ${loan.purpose}`, balance: newBalance, transactionDate: nowIso,
          academicYearId: loan.academicYearId || '', termId: loan.termId || '',
          processedBy: 'System - Loan Cancellation', createdAt: now,
        });
        firestoreTransaction.update(doc(db, ACCOUNTS_COLLECTION, account.id), { balance: newBalance, updatedAt: now });
        firestoreTransaction.update(loanRef, {
          status: 'CANCELLED', cancelledAt: now, cancelledBy: 'System', amountRepaid: loan.amount, updatedAt: now,
        });
        HistoryLogService.addToTransaction(firestoreTransaction, {
          action: 'revert', entity: 'bank_loan', recordId: loanId, label: loan.purpose || loanId,
          changedFields: ['status'], meta: { status: 'CANCELLED', amount: outstandingAmount, pupilId: loan.pupilId },
        });
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
      if (!Number.isFinite(data.amount) || data.amount <= 0) {
        throw new Error('Transaction amount must be a positive number');
      }

      const activeLoansQuery = query(
        collection(db, LOANS_COLLECTION),
        where('pupilId', '==', data.pupilId),
        where('status', '==', 'ACTIVE'),
      );
      const transactionDate = data.transactionDate || new Date().toISOString();
      const createdAt = Timestamp.now();
      const createdAtIso = new Date().toISOString();

      return await runTransaction(db, async firestoreTransaction => {
        // All reads happen before writes so Firestore can retry the command if
        // another cashier changes the same account or loan meanwhile.
        const account = await this.readAccountForTransaction(firestoreTransaction, data.pupilId);
        // Read the account before discovering loans. All loan commands update
        // that account, so a concurrent loan change retries this discovery too.
        const loanMatches = data.type === 'DEPOSIT' ? await getDocs(activeLoansQuery) : null;
        const loanSnapshots = await Promise.all(
          (loanMatches?.docs || []).map(loan => firestoreTransaction.get(loan.ref)),
        );
        const accountRef = doc(db, ACCOUNTS_COLLECTION, account.id);
        let newBalance = account.balance;
        let finalAmount = data.amount;
        let finalDescription = data.description;
        const createdTransactions: Transaction[] = [];

        if (data.type === 'DEPOSIT') {
          let remainingDepositAmount = data.amount;
          const activeLoans = loanSnapshots
            .filter(snapshot => snapshot.exists() && snapshot.data().status === 'ACTIVE')
            .map(loanDoc => ({ id: loanDoc.id, ...loanDoc.data() } as Loan))
            .sort((left, right) => {
              const leftDate = (left.createdAt as any)?.toDate?.() || left.createdAt;
              const rightDate = (right.createdAt as any)?.toDate?.() || right.createdAt;
              return new Date(leftDate).getTime() - new Date(rightDate).getTime();
            });

          for (const loan of activeLoans) {
            if (remainingDepositAmount <= 0) break;
            const repaymentAmount = Math.min(remainingDepositAmount, loan.amount - loan.amountRepaid);
            if (repaymentAmount <= 0) continue;

            const newAmountRepaid = loan.amountRepaid + repaymentAmount;
            firestoreTransaction.update(doc(db, LOANS_COLLECTION, loan.id), {
              amountRepaid: newAmountRepaid,
              status: newAmountRepaid >= loan.amount ? 'PAID' : 'ACTIVE',
              updatedAt: createdAt,
            });

            const repaymentRef = doc(collection(db, TRANSACTIONS_COLLECTION));
            const repaymentRecord = {
              pupilId: data.pupilId,
              accountId: account.id,
              type: 'LOAN_REPAYMENT' as const,
              amount: repaymentAmount,
              description: `Auto loan repayment from deposit - ${loan.purpose}`,
              balance: newBalance,
              transactionDate,
              createdAt,
            };
            firestoreTransaction.set(repaymentRef, repaymentRecord);
            createdTransactions.push({ id: repaymentRef.id, ...repaymentRecord, createdAt: createdAtIso } as Transaction);
            remainingDepositAmount -= repaymentAmount;
          }

          if (remainingDepositAmount > 0) {
            newBalance += remainingDepositAmount;
            finalAmount = remainingDepositAmount;
            finalDescription = remainingDepositAmount < data.amount
              ? `${data.description} (${data.amount - remainingDepositAmount} used for loan repayment)`
              : data.description;
          } else {
            finalAmount = 0;
            finalDescription = `${data.description} (fully used for loan repayment)`;
          }
        } else if (data.type === 'WITHDRAWAL') {
          if (account.balance < data.amount) throw new Error('Insufficient balance for withdrawal');
          newBalance -= data.amount;
        } else {
          newBalance = data.type === 'LOAN_REPAYMENT'
            ? account.balance - data.amount
            : account.balance + data.amount;
        }

        if (finalAmount > 0 || data.type !== 'DEPOSIT') {
          const transactionRef = doc(collection(db, TRANSACTIONS_COLLECTION));
          const transactionRecord = {
            ...data,
            amount: finalAmount,
            description: finalDescription,
            balance: newBalance,
            transactionDate,
            createdAt,
          };
          firestoreTransaction.set(transactionRef, transactionRecord);
          createdTransactions.push({
            id: transactionRef.id,
            ...data,
            amount: finalAmount,
            description: finalDescription,
            balance: newBalance,
            transactionDate,
            createdAt: createdAtIso,
          } as Transaction);
        }

        firestoreTransaction.update(accountRef, { balance: newBalance, updatedAt: createdAt });
        return createdTransactions[createdTransactions.length - 1] || {
          id: '',
          ...data,
          amount: finalAmount,
          description: finalDescription,
          balance: newBalance,
          transactionDate,
          createdAt: createdAtIso,
        } as Transaction;
      });
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
      const activeLoansQuery = query(
        collection(db, LOANS_COLLECTION),
        where('pupilId', '==', pupilId),
        where('status', '==', 'ACTIVE'),
      );
      const processedAt = Timestamp.now();
      const processedAtIso = new Date().toISOString();
      const today = new Date();

      return await runTransaction(db, async firestoreTransaction => {
        const account = await this.readAccountForTransaction(firestoreTransaction, pupilId);
        const loanMatches = await getDocs(activeLoansQuery);
        const loanSnapshots = await Promise.all(
          loanMatches.docs.map(loan => firestoreTransaction.get(loan.ref)),
        );
        const overdueLoans = loanSnapshots
          .filter(snapshot => snapshot.exists())
          .map(snapshot => ({ id: snapshot.id, ...snapshot.data() } as Loan))
          .filter(loan => loan.status === 'ACTIVE' && new Date(loan.repaymentDate) < today)
          .sort((left, right) => {
            const leftDate = (left.createdAt as any)?.toDate?.() || left.createdAt;
            const rightDate = (right.createdAt as any)?.toDate?.() || right.createdAt;
            return new Date(leftDate).getTime() - new Date(rightDate).getTime();
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
          if (collectionAmount <= 0) continue;

          const newAmountRepaid = loan.amountRepaid + collectionAmount;
          const newStatus = newAmountRepaid >= loan.amount ? 'PAID' : 'ACTIVE';
          const balanceAfterCollection = remainingBalance - collectionAmount;
          const repaymentRef = doc(collection(db, TRANSACTIONS_COLLECTION));

          firestoreTransaction.update(doc(db, LOANS_COLLECTION, loan.id), {
            amountRepaid: newAmountRepaid,
            status: newStatus,
            updatedAt: processedAt,
          });
          firestoreTransaction.set(repaymentRef, {
            pupilId,
            accountId: account.id,
            type: 'LOAN_REPAYMENT' as const,
            amount: collectionAmount,
            description: `Overdue loan collection - ${loan.purpose}`,
            balance: balanceAfterCollection,
            transactionDate: processedAtIso,
            createdAt: processedAt,
          });

          totalCollected += collectionAmount;
          remainingBalance = balanceAfterCollection;
        }

        if (totalCollected <= 0) {
          return { processed: false, message: 'Insufficient balance to cover overdue loans' };
        }

        firestoreTransaction.update(doc(db, ACCOUNTS_COLLECTION, account.id), {
          balance: remainingBalance,
          updatedAt: processedAt,
        });
        return {
          processed: true,
          message: `Collected ${totalCollected} from account balance for overdue loans`,
        };
      });
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
      if (!Number.isFinite(data.amount) || data.amount <= 0) {
        throw new Error('Transaction amount must be a positive number');
      }

      const transactionDate = data.transactionDate || new Date().toISOString();
      const createdAt = Timestamp.now();
      const createdAtIso = new Date().toISOString();
      const newTransaction = await runTransaction(db, async firestoreTransaction => {
        const account = await this.readAccountForTransaction(firestoreTransaction, data.pupilId);
        const isCredit = data.type === 'DEPOSIT' || data.type === 'LOAN_DISBURSEMENT';
        const newBalance = isCredit ? account.balance + data.amount : account.balance - data.amount;
        if (data.type === 'WITHDRAWAL' && newBalance < 0) {
          throw new Error('Insufficient balance for withdrawal');
        }

        const transactionRef = doc(collection(db, TRANSACTIONS_COLLECTION));
        firestoreTransaction.set(transactionRef, {
          ...data,
          balance: newBalance,
          createdAt,
          transactionDate,
        });
        firestoreTransaction.update(doc(db, ACCOUNTS_COLLECTION, account.id), {
          balance: newBalance,
          updatedAt: createdAt,
        });

        return {
          id: transactionRef.id,
          ...data,
          balance: newBalance,
          createdAt: createdAtIso,
          transactionDate,
        } as Transaction;
      });

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
      // Reuse the standard loan command: it writes the loan, disbursement
      // ledger row and account balance in one transaction.
      const newLoan = await this.createLoan(data, {
        // Preserve the enhanced path's established academic-context condition.
        disburse: !!(data.academicYearId && data.termId),
        processedBy: 'System',
      });

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
