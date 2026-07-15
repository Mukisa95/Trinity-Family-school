import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';

// PLE Record interface
export interface PLERecord {
  id: string;
  examName: string;
  year: number;
  totalCandidates: number;
  maleCandidates: number;
  femaleCandidates: number;
  createdAt: string;
  createdBy: string;
  pupilsSnapshot: PLEPupilSnapshot[];
  subjectOrder?: string[]; // Optional array of subject IDs in preferred order
}

export interface PLEPupilSnapshot {
  id: string;
  firstName: string;
  lastName: string;
  otherNames?: string;
  dateOfBirth: string;
  admissionNumber: string;
  gender: 'Male' | 'Female';
  classId: string;
}

export interface PLEPupilResult {
  pupilId: string;
  firstName: string;
  lastName: string;
  otherNames?: string;
  admissionNumber: string;
  indexNumber?: string; // PLE index number from current pupil data
  learnerIdentificationNumber?: string; // LIN from current pupil data
  additionalIdentifiers?: Array<{ idType: string; idValue: string }>; // Additional ID codes from pupil data
  gender: 'Male' | 'Female';
  status: 'participated' | 'missed'; // Participation status
  subjects: Record<string, string>; // subjectId -> aggregate
  totalAggregate: number;
  division: string;
  photo?: string; // Pupil photo from current pupil data
}

export interface CreatePLERecordData {
  examName: string;
  year: number;
  pupilsSnapshot: PLEPupilSnapshot[];
  createdBy: string;
}

export interface UpdatePLERecordData {
  examName?: string;
  year?: number;
  pupilsSnapshot?: PLEPupilSnapshot[];
}

export class PLEResultsService {
  private static readonly PLE_RECORDS_COLLECTION = 'pleRecords';
  private static readonly PLE_RESULTS_COLLECTION = 'pleResults';

  // Helper method to clean undefined values
  private static cleanUndefinedValues(obj: any): any {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
          cleaned[key] = this.cleanUndefinedValues(value);
        } else {
          cleaned[key] = value;
        }
      }
    }
    return cleaned;
  }

  // PLE Records CRUD Operations
  static async getAllPLERecords(): Promise<PLERecord[]> {
    try {
      const recordsRef = collection(db, this.PLE_RECORDS_COLLECTION);
      const q = query(recordsRef, orderBy('year', 'desc'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => {
        const data = doc.data();

        // Handle Firestore Timestamp conversion
        let createdAt = data.createdAt;
        if (data.createdAt && typeof data.createdAt === 'object') {
          if (data.createdAt.toDate) {
            createdAt = data.createdAt.toDate().toISOString();
          } else if (data.createdAt.seconds) {
            // Handle Firestore timestamp with seconds/nanoseconds
            const date = new Date(data.createdAt.seconds * 1000 + data.createdAt.nanoseconds / 1000000);
            createdAt = date.toISOString();
          }
        }

        return {
          id: doc.id,
          ...data,
          createdAt
        } as PLERecord;
      });
    } catch (error) {
      console.error('Error fetching PLE records:', error);
      throw error;
    }
  }

  static async getPLERecordById(id: string): Promise<PLERecord | null> {
    try {
      const recordRef = doc(db, this.PLE_RECORDS_COLLECTION, id);
      const snapshot = await getDoc(recordRef);

      if (!snapshot.exists()) {
        return null;
      }

      const data = snapshot.data();

      // Handle Firestore Timestamp conversion
      let createdAt = data.createdAt;
      if (data.createdAt && typeof data.createdAt === 'object') {
        if (data.createdAt.toDate) {
          createdAt = data.createdAt.toDate().toISOString();
        } else if (data.createdAt.seconds) {
          // Handle Firestore timestamp with seconds/nanoseconds
          const date = new Date(data.createdAt.seconds * 1000 + data.createdAt.nanoseconds / 1000000);
          createdAt = date.toISOString();
        }
      }

      return {
        id: snapshot.id,
        ...data,
        createdAt
      } as PLERecord;
    } catch (error) {
      console.error('Error fetching PLE record:', error);
      throw error;
    }
  }

  static async createPLERecord(recordData: CreatePLERecordData): Promise<string> {
    try {
      const newRecord = {
        ...recordData,
        totalCandidates: recordData.pupilsSnapshot.length,
        maleCandidates: recordData.pupilsSnapshot.filter(p => p.gender === 'Male').length,
        femaleCandidates: recordData.pupilsSnapshot.filter(p => p.gender === 'Female').length,
        createdAt: Timestamp.now()
      };

      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(newRecord);

      const docRef = await addDoc(collection(db, this.PLE_RECORDS_COLLECTION), cleanedData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating PLE record:', error);
      throw error;
    }
  }

  static async updatePLERecord(id: string, recordData: UpdatePLERecordData): Promise<void> {
    try {
      const recordRef = doc(db, this.PLE_RECORDS_COLLECTION, id);
      const updateData: any = {
        ...recordData,
        updatedAt: Timestamp.now()
      };

      // If pupilsSnapshot is being updated, recalculate totals
      if (recordData.pupilsSnapshot) {
        updateData.totalCandidates = recordData.pupilsSnapshot.length;
        updateData.maleCandidates = recordData.pupilsSnapshot.filter(p => p.gender === 'Male').length;
        updateData.femaleCandidates = recordData.pupilsSnapshot.filter(p => p.gender === 'Female').length;
      }

      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(updateData);

      await updateDoc(recordRef, cleanedData);
    } catch (error) {
      console.error('Error updating PLE record:', error);
      throw error;
    }
  }

  static async deletePLERecord(id: string): Promise<void> {
    try {
      const recordRef = doc(db, this.PLE_RECORDS_COLLECTION, id);
      await deleteDoc(recordRef);

      // Also delete associated results
      await this.deletePLEResultsByRecordId(id);
    } catch (error) {
      console.error('Error deleting PLE record:', error);
      throw error;
    }
  }

  // PLE Results CRUD Operations
  static async getPLEResultsByRecordId(recordId: string): Promise<PLEPupilResult[]> {
    try {
      const resultsRef = collection(db, this.PLE_RESULTS_COLLECTION);
      const q = query(resultsRef, where('pleRecordId', '==', recordId));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        ...doc.data()
      })) as PLEPupilResult[];
    } catch (error) {
      console.error('Error fetching PLE results:', error);
      throw error;
    }
  }

  static async savePLEResults(recordId: string, results: PLEPupilResult[]): Promise<void> {
    try {
      const batch = writeBatch(db);

      // Delete existing results for this record
      const existingResultsRef = collection(db, this.PLE_RESULTS_COLLECTION);
      const existingQuery = query(existingResultsRef, where('pleRecordId', '==', recordId));
      const existingSnapshot = await getDocs(existingQuery);

      existingSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Add new results
      results.forEach(result => {
        const resultRef = doc(collection(db, this.PLE_RESULTS_COLLECTION));
        const resultData = {
          ...result,
          pleRecordId: recordId,
          recordedAt: Timestamp.now()
        };

        const cleanedData = this.cleanUndefinedValues(resultData);
        batch.set(resultRef, cleanedData);
      });

      await batch.commit();
    } catch (error) {
      console.error('Error saving PLE results:', error);
      throw error;
    }
  }

  static async deletePLEResultsByRecordId(recordId: string): Promise<void> {
    try {
      const resultsRef = collection(db, this.PLE_RESULTS_COLLECTION);
      const q = query(resultsRef, where('pleRecordId', '==', recordId));
      const snapshot = await getDocs(q);

      const batch = writeBatch(db);
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
    } catch (error) {
      console.error('Error deleting PLE results:', error);
      throw error;
    }
  }

  // Helper method to get P.7 pupils for PLE record creation
  static async getP7PupilsSnapshot(): Promise<PLEPupilSnapshot[]> {
    try {
      // Get all pupils from P.7 classes
      const pupilsRef = collection(db, 'pupils');
      const classesRef = collection(db, 'classes');

      // Get all classes first to find P.7 classes with different naming conventions
      const allClassesSnapshot = await getDocs(classesRef);

      // Find P.7 classes by checking multiple naming patterns
      const p7ClassIds: string[] = [];
      allClassesSnapshot.docs.forEach(doc => {
        const classData = doc.data();
        const className = (classData.name || '').toUpperCase();
        const classCode = (classData.code || '').toUpperCase();

        // Check various P.7 naming patterns
        const isP7Class =
          className === 'P.7' ||
          className === 'PRIMARY SEVEN' ||
          className === 'PRIMARY 7' ||
          className === 'P7' ||
          className === 'GRADE 7' ||
          className === 'YEAR 7' ||
          classCode === 'P.7' ||
          classCode === 'P7' ||
          // Also check if class name contains "SEVEN" and is primary level
          (className.includes('SEVEN') && (classData.level === 'Upper Primary' || classData.level === 'Primary'));

        if (isP7Class) {
          p7ClassIds.push(doc.id);
          console.log(`Found P.7 class: ${className} (${classCode}) - ID: ${doc.id}`);
        }
      });

      if (p7ClassIds.length === 0) {
        console.warn('No P.7 classes found. Searched for: P.7, PRIMARY SEVEN, PRIMARY 7, P7, GRADE 7, YEAR 7');
        console.log('Available classes:', allClassesSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          code: doc.data().code,
          level: doc.data().level
        })));
        return [];
      }

      console.log(`Found ${p7ClassIds.length} P.7 class(es):`, p7ClassIds);

      // Get only ACTIVE pupils from P.7 classes (exclude graduated pupils)
      const pupilsQuery = query(
        pupilsRef,
        where('classId', 'in', p7ClassIds),
        where('status', '==', 'Active')
      );
      const pupilsSnapshot = await getDocs(pupilsQuery);

      console.log(`Found ${pupilsSnapshot.docs.length} active pupils in P.7 classes (excluding graduated)`);

      return pupilsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          otherNames: data.otherNames || '',
          dateOfBirth: data.dateOfBirth || '',
          admissionNumber: data.admissionNumber || '',
          gender: data.gender || 'Male',
          classId: data.classId || '',
          className: data.className || '',
          classCode: data.classCode || '',
          section: data.section || ''
        };
      });
    } catch (error) {
      console.error('Error fetching P.7 pupils:', error);
      throw error;
    }
  }

  // Helper method to get current pupil data and merge with PLE results
  static async getPLEResultsWithCurrentPupilData(recordId: string): Promise<PLEPupilResult[]> {
    try {
      // Get the PLE results
      const pleResults = await this.getPLEResultsByRecordId(recordId);

      if (pleResults.length === 0) {
        return pleResults;
      }

      // Get current pupil data for all pupils in the results
      const pupilIds = pleResults.map(result => result.pupilId);
      const pupilsRef = collection(db, 'pupils');

      // Fetch current pupil data in batches (Firestore 'in' query limit is 10)
      const currentPupilsData: Record<string, any> = {};

      const batchPromises = [];
      for (let i = 0; i < pupilIds.length; i += 10) {
        const batch = pupilIds.slice(i, i + 10);
        const batchQuery = query(pupilsRef, where('__name__', 'in', batch));
        batchPromises.push(getDocs(batchQuery));
      }

      const batchSnapshots = await Promise.all(batchPromises);
      batchSnapshots.forEach(batchSnapshot => {
        batchSnapshot.docs.forEach(doc => {
          currentPupilsData[doc.id] = doc.data();
        });
      });

      // Merge current pupil data with PLE results
      const enhancedResults = pleResults.map(result => {
        const currentPupil = currentPupilsData[result.pupilId];

        if (currentPupil) {
          // Extract index number from various possible fields
          let indexNumber = '';
          let learnerIdentificationNumber = '';

          // Check for LIN in additionalIdentifiers first (new system)
          if (currentPupil.additionalIdentifiers && Array.isArray(currentPupil.additionalIdentifiers)) {
            const linIdentifier = currentPupil.additionalIdentifiers.find((id: any) =>
              id.idType && id.idType.toLowerCase() === 'lin'
            );
            if (linIdentifier && linIdentifier.idValue) {
              learnerIdentificationNumber = linIdentifier.idValue;
            }

            // Check for index number
            const indexIdentifier = currentPupil.additionalIdentifiers.find((id: any) =>
              id.idType && (
                id.idType.toLowerCase().includes('index') ||
                id.idType.toLowerCase().includes('ple') ||
                id.idType.toLowerCase().includes('exam') ||
                id.idType.toLowerCase().includes('candidate')
              )
            );
            if (indexIdentifier && indexIdentifier.idValue) {
              indexNumber = indexIdentifier.idValue;
            }
          }

          // Fallback to legacy LIN field if not found in additionalIdentifiers
          if (!learnerIdentificationNumber && currentPupil.learnerIdentificationNumber) {
            learnerIdentificationNumber = currentPupil.learnerIdentificationNumber;
          }

          // Debug logging for certificate data
          console.log(`Certificate data for ${currentPupil.firstName} ${currentPupil.lastName}:`, {
            admissionNumber: currentPupil.admissionNumber,
            indexNumber: indexNumber || 'Not found',
            learnerIdentificationNumber: learnerIdentificationNumber || 'Not found',
            additionalIdentifiers: currentPupil.additionalIdentifiers || 'None'
          });

          return {
            ...result,
            // Use current admission number if available, fallback to snapshot data
            admissionNumber: currentPupil.admissionNumber || result.admissionNumber,
            // Add index number if found
            indexNumber: indexNumber || undefined,
            // Add LIN from current pupil data (check both new and legacy systems)
            learnerIdentificationNumber: learnerIdentificationNumber || undefined,
            // Add additional identifiers from current pupil data
            additionalIdentifiers: currentPupil.additionalIdentifiers || undefined,
            // Update other fields with current data if available
            firstName: currentPupil.firstName || result.firstName,
            lastName: currentPupil.lastName || result.lastName,
            otherNames: currentPupil.otherNames || result.otherNames,
            gender: currentPupil.gender || result.gender,
            // Add photo from current pupil data
            photo: currentPupil.photo || undefined,
          };
        }

        return result;
      });

      return enhancedResults;
    } catch (error) {
      console.error('Error fetching PLE results with current pupil data:', error);
      throw error;
    }
  }

  /**
   * Recapture a single pupil's snapshot in a PLE record
   * Updates the pupil's snapshot data with their current information
   */
  static async recapturePLEPupilSnapshot(pleRecordId: string, pupilId: string): Promise<PLEPupilSnapshot> {
    try {
      // Get the PLE record
      const pleRecord = await this.getPLERecordById(pleRecordId);
      if (!pleRecord) {
        throw new Error(`PLE record ${pleRecordId} not found`);
      }

      // Get current pupil data
      const pupilRef = doc(db, 'pupils', pupilId);
      const pupilSnapshot = await getDoc(pupilRef);

      if (!pupilSnapshot.exists()) {
        throw new Error(`Pupil ${pupilId} not found in the system`);
      }

      const currentPupilData = pupilSnapshot.data();

      // Create updated snapshot
      const updatedSnapshot: PLEPupilSnapshot = {
        id: pupilId,
        firstName: currentPupilData.firstName || '',
        lastName: currentPupilData.lastName || '',
        otherNames: currentPupilData.otherNames || '',
        dateOfBirth: currentPupilData.dateOfBirth || '',
        admissionNumber: currentPupilData.admissionNumber || '',
        gender: currentPupilData.gender || 'Male',
        classId: currentPupilData.classId || '',
      };

      // Update the pupilsSnapshot array
      const updatedPupilsSnapshot = pleRecord.pupilsSnapshot.map(p =>
        p.id === pupilId ? updatedSnapshot : p
      );

      // If pupil not found in snapshot, add it
      if (!pleRecord.pupilsSnapshot.find(p => p.id === pupilId)) {
        updatedPupilsSnapshot.push(updatedSnapshot);
      }

      // Update the PLE record
      await this.updatePLERecord(pleRecordId, {
        pupilsSnapshot: updatedPupilsSnapshot
      });

      console.log(`✅ Successfully recaptured snapshot for pupil ${pupilId} in PLE record ${pleRecordId}`);
      return updatedSnapshot;
    } catch (error) {
      console.error(`Error recapturing snapshot for pupil ${pupilId}:`, error);
      throw error;
    }
  }

  /**
   * Batch recapture snapshots for multiple pupils in a PLE record
   * Processes each pupil sequentially and returns detailed results
   */
  static async recapturePLEPupilSnapshotsBatch(
    pleRecordId: string,
    pupilIds: string[],
    onProgress?: (current: number, total: number, pupilName: string) => void
  ): Promise<{
    totalProcessed: number;
    successCount: number;
    failureCount: number;
    results: Array<{
      pupilId: string;
      pupilName: string;
      success: boolean;
      error?: string;
    }>;
  }> {
    console.log(`🔄 Starting batch snapshot recapture for ${pupilIds.length} pupils in PLE record ${pleRecordId}`);

    const results: Array<{
      pupilId: string;
      pupilName: string;
      success: boolean;
      error?: string;
    }> = [];

    let successCount = 0;
    let failureCount = 0;

    // Get the PLE record once
    const pleRecord = await this.getPLERecordById(pleRecordId);
    if (!pleRecord) {
      throw new Error(`PLE record ${pleRecordId} not found`);
    }

    // Fetch all pupils data in batches (Firestore 'in' query limit is 10)
    const currentPupilsData: Record<string, any> = {};
    const pupilsRef = collection(db, 'pupils');

    for (let i = 0; i < pupilIds.length; i += 10) {
      const batch = pupilIds.slice(i, i + 10);
      const batchQuery = query(pupilsRef, where('__name__', 'in', batch));
      const batchSnapshot = await getDocs(batchQuery);

      batchSnapshot.docs.forEach(doc => {
        currentPupilsData[doc.id] = doc.data();
      });
    }

    // Process each pupil
    const updatedPupilsSnapshot = [...pleRecord.pupilsSnapshot];

    for (let i = 0; i < pupilIds.length; i++) {
      const pupilId = pupilIds[i];
      const currentPupilData = currentPupilsData[pupilId];

      if (!currentPupilData) {
        const pupilName = `Unknown (${pupilId})`;
        results.push({
          pupilId,
          pupilName,
          success: false,
          error: 'Pupil not found in the system'
        });
        failureCount++;
        continue;
      }

      const pupilName = `${currentPupilData.firstName} ${currentPupilData.lastName}`;

      // Call progress callback if provided
      if (onProgress) {
        onProgress(i + 1, pupilIds.length, pupilName);
      }

      try {
        // Create updated snapshot
        const updatedSnapshot: PLEPupilSnapshot = {
          id: pupilId,
          firstName: currentPupilData.firstName || '',
          lastName: currentPupilData.lastName || '',
          otherNames: currentPupilData.otherNames || '',
          dateOfBirth: currentPupilData.dateOfBirth || '',
          admissionNumber: currentPupilData.admissionNumber || '',
          gender: currentPupilData.gender || 'Male',
          classId: currentPupilData.classId || '',
        };

        // Update the snapshot in the array
        const snapshotIndex = updatedPupilsSnapshot.findIndex(p => p.id === pupilId);
        if (snapshotIndex >= 0) {
          updatedPupilsSnapshot[snapshotIndex] = updatedSnapshot;
        } else {
          // If pupil not found in snapshot, add it
          updatedPupilsSnapshot.push(updatedSnapshot);
        }

        results.push({
          pupilId,
          pupilName,
          success: true
        });

        successCount++;
        console.log(`✅ [${i + 1}/${pupilIds.length}] Successfully recaptured snapshot for ${pupilName}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        results.push({
          pupilId,
          pupilName,
          success: false,
          error: errorMessage
        });

        failureCount++;
        console.error(`❌ [${i + 1}/${pupilIds.length}] Failed to recapture snapshot for ${pupilName}:`, errorMessage);
      }
    }

    // Update the PLE record with all changes at once
    try {
      await this.updatePLERecord(pleRecordId, {
        pupilsSnapshot: updatedPupilsSnapshot
      });
    } catch (error) {
      console.error('Error updating PLE record with recaptured snapshots:', error);
      throw new Error('Failed to save recaptured snapshots to PLE record');
    }

    console.log(`📊 Batch recapture complete:`, {
      totalProcessed: pupilIds.length,
      successCount,
      failureCount
    });

    return {
      totalProcessed: pupilIds.length,
      successCount,
      failureCount,
      results
    };
  }
} 