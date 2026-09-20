import { auth } from '@/lib/firebase';
import { onIdTokenChanged, type User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import type { Account, Loan, Transaction } from '@/types';

export type ParentBankingData = {
  account: Account | null;
  transactions: Transaction[];
  loans: Loan[];
};

export function waitForSignedFirebaseUser(): Promise<User> {
  const current = auth.currentUser;
  if (current && !current.isAnonymous) return Promise.resolve(current);

  return new Promise((resolve, reject) => {
    let unsubscribe: () => void = () => {};
    const timeout = window.setTimeout(() => {
      unsubscribe();
      reject(new Error('Please sign in again to view banking information.'));
    }, 10_000);
    unsubscribe = onIdTokenChanged(auth, firebaseUser => {
      if (!firebaseUser || firebaseUser.isAnonymous) return;
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(firebaseUser);
    }, error => {
      window.clearTimeout(timeout);
      unsubscribe();
      reject(error);
    });
  });
}

/** Uses the parent-only server projection instead of raw Firestore collections. */
export class ParentBankingService {
  static async getForPupil(pupilId: string): Promise<ParentBankingData> {
    const firebaseUser = await waitForSignedFirebaseUser();
    await firebaseUser.getIdToken();
    const response = await httpsCallable<{ pupilId: string }, ParentBankingData>(
      functions,
      'getParentBankingProjection',
    )({ pupilId });
    const payload = response.data;

    return {
      account: payload.account || null,
      transactions: Array.isArray(payload.transactions) ? payload.transactions : [],
      loans: Array.isArray(payload.loans) ? payload.loans : [],
    };
  }
}
