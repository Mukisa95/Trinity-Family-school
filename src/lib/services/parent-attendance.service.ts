import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import type { AttendanceRecord } from '@/types';
import { waitForSignedFirebaseUser } from './parent-banking.service';

/** Uses the same signed Firebase handoff as the parent banking projection. */
export class ParentAttendanceService {
  static async getForPupil(pupilId: string): Promise<AttendanceRecord[]> {
    // Wait for Firebase Auth to restore the normal cached parent session
    // before making the protected projection request.
    const firebaseUser = await waitForSignedFirebaseUser();
    await firebaseUser.getIdToken();
    const response = await httpsCallable<{ pupilId: string }, AttendanceRecord[]>(
      functions,
      'getParentAttendanceProjection',
    )({ pupilId });
    return Array.isArray(response.data) ? response.data : [];
  }

  static async updateRemark({
    attendanceRecordId,
    pupilId,
    remarks,
  }: {
    attendanceRecordId: string;
    pupilId: string;
    remarks: string;
  }): Promise<void> {
    const firebaseUser = await waitForSignedFirebaseUser();
    await firebaseUser.getIdToken();
    await httpsCallable<
      { attendanceRecordId: string; pupilId: string; remarks: string },
      { success: true }
    >(functions, 'updateParentAttendanceRemark')({ attendanceRecordId, pupilId, remarks });
  }
}
