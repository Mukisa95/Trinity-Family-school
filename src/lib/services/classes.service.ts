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
import type { Class } from '@/types';
import { getDocWithTimeout, getDocsWithTimeout } from '../utils/firestore-helpers';

const COLLECTION_NAME = 'classes';

export class ClassesService {
  static async getAll(): Promise<Class[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('order', 'asc'));
      // Use cache-first optimized helper - increased timeout to 30s for slow networks
      // Memory cache fallback works even when IndexedDB is blocked (Edge tracking prevention)
      const classes = await getDocsWithTimeout<Class>(q, 30000);
      // Ensure createdAt is properly formatted
      return classes.map(cls => ({
        ...cls,
        createdAt: typeof cls.createdAt === 'string' 
          ? cls.createdAt 
          : (cls.createdAt as any)?.toDate?.()?.toISOString() || cls.createdAt
      }));
    } catch (error) {
      console.error('Error fetching classes:', error);
      // Return empty array instead of throwing to prevent app crash
      // The query will retry automatically via React Query
      return [];
    }
  }

  static async getById(id: string): Promise<Class | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      // Use cache-first optimized helper for instant cached reads
      const classData = await getDocWithTimeout<Class>(docRef, 5000);
      
      if (!classData) {
        return null;
      }

      // Ensure createdAt is properly formatted
      if (classData.createdAt) {
        classData.createdAt = typeof classData.createdAt === 'string' 
          ? classData.createdAt 
          : (classData.createdAt as any)?.toDate?.()?.toISOString() || classData.createdAt;
      }

      return classData;
    } catch (error) {
      console.error('Error fetching class:', error);
      throw error;
    }
  }

  static async create(classData: Omit<Class, 'id' | 'createdAt'>): Promise<string> {
    try {
      const newClass = {
        ...classData,
        createdAt: Timestamp.now()
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(newClass);
      
      const docRef = await addDoc(collection(db, COLLECTION_NAME), cleanedData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating class:', error);
      throw error;
    }
  }

  static async update(id: string, classData: Partial<Omit<Class, 'id' | 'createdAt'>>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      
      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(classData);
      
      await updateDoc(docRef, cleanedData);
    } catch (error) {
      console.error('Error updating class:', error);
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

  static async delete(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting class:', error);
      throw error;
    }
  }

  static async getByLevel(level: string): Promise<Class[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME), 
        where('level', '==', level),
        orderBy('order', 'asc')
      );
      const classes = await getDocsWithTimeout<Class>(q, 8000);
      // Ensure createdAt is properly formatted
      return classes.map(cls => ({
        ...cls,
        createdAt: typeof cls.createdAt === 'string' 
          ? cls.createdAt 
          : (cls.createdAt as any)?.toDate?.()?.toISOString() || cls.createdAt
      }));
    } catch (error) {
      console.error('Error fetching classes by level:', error);
      throw error;
    }
  }
} 