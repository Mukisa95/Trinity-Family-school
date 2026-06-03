import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  setDoc, 
  query, 
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import type { ResultReleaseInfo } from '@/types';

export class ResultsReleaseService {
  private static COLLECTION = 'resultReleases';
  private static ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_RELEASE_PASSWORD || 'admin123'; // Should be in env

  /**
   * Clean object of undefined and null values for Firebase
   */
  private static cleanObjectForFirebase(obj: any): any {
    const cleaned: any = {};
    Object.keys(obj).forEach(key => {
      if (obj[key] !== undefined && obj[key] !== null) {
        cleaned[key] = obj[key];
      }
    });
    return cleaned;
  }

  /**
   * Verify admin password for releasing results
   */
  static async verifyAdminPassword(password: string): Promise<boolean> {
    try {
      // In production, this should be compared against a hashed password stored securely
      return password === this.ADMIN_PASSWORD;
    } catch (error) {
      console.error('Error verifying admin password:', error);
      return false;
    }
  }

  /**
   * Release results for selected pupils
   */
  static async releaseResults(
    examId: string,
    classId: string,
    pupilIds: string[],
    adminUserId: string,
    adminPassword: string,
    releaseNotes?: string
  ): Promise<boolean> {
    try {
      // Verify admin password
      const isValidPassword = await this.verifyAdminPassword(adminPassword);
      if (!isValidPassword) {
        throw new Error('Invalid admin password');
      }

      const batch = writeBatch(db);
      const releaseId = `${examId}_${classId}`;
      
      // Get existing release record or create new one
      const releaseRef = doc(db, this.COLLECTION, releaseId);
      const existingRelease = await getDoc(releaseRef);
      
      let existingPupils: string[] = [];
      if (existingRelease.exists()) {
        existingPupils = existingRelease.data().releasedPupils || [];
      }

      // Merge with new pupils (avoid duplicates)
      const updatedPupils = [...new Set([...existingPupils, ...pupilIds])];

      // Update release record (filter out undefined values)
      const releaseInfoRaw = {
        examId,
        classId,
        releasedPupils: updatedPupils,
        releasedBy: adminUserId,
        releasedAt: new Date().toISOString(),
        releaseNotes: releaseNotes && releaseNotes.trim() ? releaseNotes.trim() : undefined
      };

      // Clean the object of any undefined/null values for Firebase
      const releaseInfo = this.cleanObjectForFirebase(releaseInfoRaw);

      batch.set(releaseRef, releaseInfo, { merge: true });

      // Update the main exam result document to mark pupils as released
      // First, get the exam result document
      const examResultsRef = collection(db, 'examResults');
      const examResultQuery = query(examResultsRef, where('examId', '==', examId));
      const examResultSnapshot = await getDocs(examResultQuery);
      
      if (!examResultSnapshot.empty) {
        const examResultDoc = examResultSnapshot.docs[0];
        const examResultData = examResultDoc.data();
        
        // Update pupil snapshots to mark them as released
        const updatedPupilSnapshots = examResultData.pupilSnapshots?.map((pupil: any) => {
          if (pupilIds.includes(pupil.pupilId)) {
            return {
              ...pupil,
              isReleasedToParents: true,
              releasedAt: new Date().toISOString(),
              releasedBy: adminUserId
            };
          }
          return pupil;
        }) || [];
        
        // Update the exam result document
        batch.update(doc(db, 'examResults', examResultDoc.id), {
          pupilSnapshots: updatedPupilSnapshots,
          lastUpdatedAt: new Date().toISOString(),
          lastUpdatedBy: adminUserId
        });
      }

      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error releasing results:', error);
      throw error;
    }
  }

  /**
   * Revoke released results for selected pupils
   */
  static async revokeResults(
    examId: string,
    classId: string,
    pupilIds: string[],
    adminUserId: string,
    adminPassword: string
  ): Promise<boolean> {
    try {
      // Verify admin password
      const isValidPassword = await this.verifyAdminPassword(adminPassword);
      if (!isValidPassword) {
        throw new Error('Invalid admin password');
      }

      const batch = writeBatch(db);
      const releaseId = `${examId}_${classId}`;
      
      // Update release record
      const releaseRef = doc(db, this.COLLECTION, releaseId);
      const existingRelease = await getDoc(releaseRef);
      
      if (existingRelease.exists()) {
        const currentPupils = existingRelease.data().releasedPupils || [];
        const updatedPupils = currentPupils.filter((id: string) => !pupilIds.includes(id));
        
        batch.update(releaseRef, {
          releasedPupils: updatedPupils,
          lastUpdatedBy: adminUserId,
          lastUpdatedAt: new Date().toISOString()
        });
      }

      // Update the main exam result document to mark pupils as not released
      // First, get the exam result document
      const examResultsRef = collection(db, 'examResults');
      const examResultQuery = query(examResultsRef, where('examId', '==', examId));
      const examResultSnapshot = await getDocs(examResultQuery);
      
      if (!examResultSnapshot.empty) {
        const examResultDoc = examResultSnapshot.docs[0];
        const examResultData = examResultDoc.data();
        
        // Update pupil snapshots to mark them as not released
        const updatedPupilSnapshots = examResultData.pupilSnapshots?.map((pupil: any) => {
          if (pupilIds.includes(pupil.pupilId)) {
            return {
              ...pupil,
              isReleasedToParents: false,
              releasedAt: null,
              releasedBy: null
            };
          }
          return pupil;
        }) || [];
        
        // Update the exam result document
        batch.update(doc(db, 'examResults', examResultDoc.id), {
          pupilSnapshots: updatedPupilSnapshots,
          lastUpdatedAt: new Date().toISOString(),
          lastUpdatedBy: adminUserId
        });
      }

      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error revoking results:', error);
      throw error;
    }
  }

  /**
   * Get release information for an exam
   */
  static async getReleaseInfo(examId: string, classId: string): Promise<ResultReleaseInfo | null> {
    try {
      const releaseId = `${examId}_${classId}`;
      const releaseRef = doc(db, this.COLLECTION, releaseId);
      const releaseDoc = await getDoc(releaseRef);
      
      if (releaseDoc.exists()) {
        return releaseDoc.data() as ResultReleaseInfo;
      }
      return null;
    } catch (error) {
      console.error('Error getting release info:', error);
      return null;
    }
  }

  /**
   * Get all released results for a pupil (for parent dashboard)
   */
  static async getReleasedResultsForPupil(pupilId: string): Promise<string[]> {
    try {
      const releasesRef = collection(db, this.COLLECTION);
      const releasesQuery = query(releasesRef, where('releasedPupils', 'array-contains', pupilId));
      const releasesSnap = await getDocs(releasesQuery);
      
      return releasesSnap.docs.map(doc => doc.data().examId);
    } catch (error) {
      console.error('Error getting released results for pupil:', error);
      return [];
    }
  }

  /**
   * Check if a specific result is released for a pupil
   */
  static async isResultReleased(examId: string, classId: string, pupilId: string): Promise<boolean> {
    try {
      const releaseInfo = await this.getReleaseInfo(examId, classId);
      return releaseInfo?.releasedPupils.includes(pupilId) || false;
    } catch (error) {
      console.error('Error checking result release status:', error);
      return false;
    }
  }

  /**
   * Bulk release all results for an exam
   */
  static async releaseAllResults(
    examId: string,
    classId: string,
    adminUserId: string,
    adminPassword: string,
    releaseNotes?: string
  ): Promise<boolean> {
    try {
      // Get the exam result document to find all pupils
      const examResultsRef = collection(db, 'examResults');
      const examResultQuery = query(examResultsRef, where('examId', '==', examId));
      const examResultSnapshot = await getDocs(examResultQuery);
      
      if (examResultSnapshot.empty) {
        throw new Error('No exam results found for this exam');
      }
      
      const examResultData = examResultSnapshot.docs[0].data();
      const pupilIds = examResultData.pupilSnapshots?.map((pupil: any) => pupil.pupilId) || [];
      
      if (pupilIds.length === 0) {
        throw new Error('No pupils found in this exam');
      }
      
      return await this.releaseResults(examId, classId, pupilIds, adminUserId, adminPassword, releaseNotes);
    } catch (error) {
      console.error('Error releasing all results:', error);
      throw error;
    }
  }
} 