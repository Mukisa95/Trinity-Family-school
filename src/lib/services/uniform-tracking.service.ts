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
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import type { UniformTracking, CreateUniformTrackingData, UpdateUniformTrackingData } from '@/types';

const COLLECTION_NAME = 'uniformTracking';

export class UniformTrackingService {
  static async getTrackingRecordsByPupil(pupilId: string): Promise<UniformTracking[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('pupilId', '==', pupilId)
      );
      const querySnapshot = await getDocs(q);
      
      const records = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Handle backward compatibility for records without academicYearId/termId
          academicYearId: data.academicYearId || 'legacy-record',
          termId: data.termId || 'legacy-record',
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
        };
      }) as UniformTracking[];

      // Sort by createdAt on client side to avoid composite index
      return records.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA; // desc order
      });
    } catch (error) {
      console.error('Error fetching uniform tracking records:', error);
      throw error;
    }
  }

  static async getTrackingRecordById(id: string): Promise<UniformTracking | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          // Handle backward compatibility for records without academicYearId/termId
          academicYearId: data.academicYearId || 'legacy-record',
          termId: data.termId || 'legacy-record',
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
        } as UniformTracking;
      }
      return null;
    } catch (error) {
      console.error('Error fetching uniform tracking record:', error);
      throw error;
    }
  }

  static async createTrackingRecord(trackingData: CreateUniformTrackingData): Promise<string> {
    try {
      const newRecord = {
        ...trackingData,
        createdAt: Timestamp.now()
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(newRecord);
      
      const docRef = await addDoc(collection(db, COLLECTION_NAME), cleanedData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating uniform tracking record:', error);
      throw error;
    }
  }

  static async updateTrackingRecord(id: string, trackingData: UpdateUniformTrackingData): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const updateData = {
        ...trackingData,
        updatedAt: Timestamp.now()
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(updateData);
      
      await updateDoc(docRef, cleanedData);
    } catch (error) {
      console.error('Error updating uniform tracking record:', error);
      throw error;
    }
  }

  static async deleteTrackingRecord(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting uniform tracking record:', error);
      throw error;
    }
  }

  static async getAllTrackingRecords(): Promise<UniformTracking[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME));
      const querySnapshot = await getDocs(q);
      
      const records = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Handle backward compatibility for records without academicYearId/termId
          academicYearId: data.academicYearId || 'legacy-record',
          termId: data.termId || 'legacy-record',
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
        };
      }) as UniformTracking[];

      // Sort by createdAt on client side to avoid composite index
      return records.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA; // desc order
      });
    } catch (error) {
      console.error('Error fetching all uniform tracking records:', error);
      throw error;
    }
  }

  static async getTrackingRecordsByUniform(uniformId: string): Promise<UniformTracking[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('uniformId', '==', uniformId)
      );
      const querySnapshot = await getDocs(q);
      
      const records = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Handle backward compatibility for records without academicYearId/termId
          academicYearId: data.academicYearId || 'legacy-record',
          termId: data.termId || 'legacy-record',
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
        };
      }) as UniformTracking[];

      // Sort by createdAt on client side to avoid composite index
      return records.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA; // desc order
      });
    } catch (error) {
      console.error('Error fetching uniform tracking records by uniform:', error);
      throw error;
    }
  }

  // Utility function to recursively clean undefined values from objects
  private static cleanUndefinedValues(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.cleanUndefinedValues(item));
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = this.cleanUndefinedValues(value);
        }
      }
      return cleaned;
    }
    
    return obj;
  }
} 