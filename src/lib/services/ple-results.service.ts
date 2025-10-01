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
      
      // Get pupils from P.7 classes
      const pupilsQuery = query(pupilsRef, where('classId', 'in', p7ClassIds));
      const pupilsSnapshot = await getDocs(pupilsQuery);
      
      console.log(`Found ${pupilsSnapshot.docs.length} pupils in P.7 classes`);
      
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
          classId: data.classId || ''
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
      
      for (let i = 0; i < pupilIds.length; i += 10) {
        const batch = pupilIds.slice(i, i + 10);
        const batchQuery = query(pupilsRef, where('__name__', 'in', batch));
        const batchSnapshot = await getDocs(batchQuery);
        
        batchSnapshot.docs.forEach(doc => {
          currentPupilsData[doc.id] = doc.data();
        });
      }

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
} 