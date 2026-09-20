import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import type { ParentReleasedResult } from '@/lib/parent-offline/contracts';
import { waitForSignedFirebaseUser } from './parent-banking.service';

/** Reads the compact, verified result projection instead of shared exam documents. */
export class ParentResultsService {
  static async getForPupil(pupilId: string): Promise<ParentReleasedResult[]> {
    const firebaseUser = await waitForSignedFirebaseUser();
    await firebaseUser.getIdToken();
    const response = await httpsCallable<{ pupilId: string }, ParentReleasedResult[]>(
      functions,
      'getParentResultsProjection',
    )({ pupilId });
    return Array.isArray(response.data) ? response.data : [];
  }
}
