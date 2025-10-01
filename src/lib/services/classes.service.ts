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

const COLLECTION_NAME = 'classes';

export class ClassesService {
  static async getAll(): Promise<Class[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('order', 'asc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
      })) as Class[];
    } catch (error) {
      console.error('Error fetching classes:', error);
      throw error;
    }
  }

  static async getById(id: string): Promise<Class | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
        } as Class;
      }
      return null;
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
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
      })) as Class[];
    } catch (error) {
      console.error('Error fetching classes by level:', error);
      throw error;
    }
  }
} 