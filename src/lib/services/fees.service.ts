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
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import type { FeeStructure, FeeAdjustmentEntry } from '@/types';

const FEE_STRUCTURES_COLLECTION = 'feeStructures';
const FEE_ADJUSTMENTS_COLLECTION = 'feeAdjustments';

// Utility function to remove undefined values from objects
function cleanUndefinedValues(obj: any): any {
  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        cleaned[key] = cleanUndefinedValues(value);
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned;
}

export class FeesService {
  // Fee Structures
  static async getAllFeeStructures(): Promise<FeeStructure[]> {
    try {
      const q = query(collection(db, FEE_STRUCTURES_COLLECTION), orderBy('name', 'asc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FeeStructure[];
    } catch (error) {
      console.error('Error fetching fee structures:', error);
      throw error;
    }
  }

  static async getFeeStructureById(id: string): Promise<FeeStructure | null> {
    try {
      const docRef = doc(db, FEE_STRUCTURES_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as FeeStructure;
      }
      return null;
    } catch (error) {
      console.error('Error fetching fee structure by ID:', error);
      throw error;
    }
  }

  static async createFeeStructure(feeData: Omit<FeeStructure, 'id' | 'createdAt' | 'status' | 'disableHistory'>): Promise<string> {
    try {
      const newFeeStructure = {
        ...feeData,
        status: 'active' as const,
        disableHistory: [],
        createdAt: new Date().toISOString()
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = cleanUndefinedValues(newFeeStructure);
      
      const docRef = await addDoc(collection(db, FEE_STRUCTURES_COLLECTION), cleanedData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating fee structure:', error);
      throw error;
    }
  }

  static async updateFeeStructure(id: string, feeData: Partial<Omit<FeeStructure, 'id' | 'createdAt'>>): Promise<void> {
    try {
      const docRef = doc(db, FEE_STRUCTURES_COLLECTION, id);
      const updateData = {
        ...feeData,
        updatedAt: new Date().toISOString()
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = cleanUndefinedValues(updateData);
      
      await updateDoc(docRef, cleanedData);
    } catch (error) {
      console.error('Error updating fee structure:', error);
      throw error;
    }
  }

  static async deleteFeeStructure(id: string): Promise<void> {
    try {
      const docRef = doc(db, FEE_STRUCTURES_COLLECTION, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting fee structure:', error);
      throw error;
    }
  }

  static async getFeeStructuresByAcademicYear(academicYearId: string): Promise<FeeStructure[]> {
    try {
      const q = query(
        collection(db, FEE_STRUCTURES_COLLECTION), 
        where('academicYearId', '==', academicYearId),
        orderBy('name', 'asc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FeeStructure[];
    } catch (error) {
      console.error('Error fetching fee structures by academic year:', error);
      throw error;
    }
  }

  // Fee Adjustments
  static async getAllFeeAdjustments(): Promise<FeeAdjustmentEntry[]> {
    try {
      const q = query(collection(db, FEE_ADJUSTMENTS_COLLECTION), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FeeAdjustmentEntry[];
    } catch (error) {
      console.error('Error fetching fee adjustments:', error);
      throw error;
    }
  }

  static async createFeeAdjustment(adjustmentData: Omit<FeeAdjustmentEntry, 'id' | 'createdAt'>): Promise<string> {
    try {
      const newAdjustment = {
        ...adjustmentData,
        createdAt: new Date().toISOString()
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = cleanUndefinedValues(newAdjustment);
      
      const docRef = await addDoc(collection(db, FEE_ADJUSTMENTS_COLLECTION), cleanedData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating fee adjustment:', error);
      throw error;
    }
  }

  static async getFeeAdjustmentsByStructure(feeStructureId: string): Promise<FeeAdjustmentEntry[]> {
    try {
      const q = query(
        collection(db, FEE_ADJUSTMENTS_COLLECTION), 
        where('feeStructureId', '==', feeStructureId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FeeAdjustmentEntry[];
    } catch (error) {
      console.error('Error fetching fee adjustments by structure:', error);
      throw error;
    }
  }
} 