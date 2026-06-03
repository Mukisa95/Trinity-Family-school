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
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import type { ExcludedDay } from '@/types';

const COLLECTION_NAME = 'excludedDays';

export class ExcludedDaysService {
  static async getAllExcludedDays(): Promise<ExcludedDay[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt
        } as ExcludedDay;
      });
    } catch (error) {
      console.error('Error fetching excluded days:', error);
      throw error;
    }
  }

  static async getExcludedDayById(id: string): Promise<ExcludedDay | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const snapshot = await getDoc(docRef);
      
      if (!snapshot.exists()) {
        return null;
      }

      const data = snapshot.data();
      return {
        id: snapshot.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt
      } as ExcludedDay;
    } catch (error) {
      console.error('Error fetching excluded day:', error);
      throw error;
    }
  }

  static async createExcludedDay(excludedDayData: Omit<ExcludedDay, 'id' | 'createdAt'>): Promise<string> {
    try {
      const newExcludedDay = {
        ...excludedDayData,
        createdAt: Timestamp.now()
      };
      
      const docRef = await addDoc(collection(db, COLLECTION_NAME), newExcludedDay);
      return docRef.id;
    } catch (error) {
      console.error('Error creating excluded day:', error);
      throw error;
    }
  }

  static async updateExcludedDay(id: string, excludedDayData: Partial<Omit<ExcludedDay, 'id' | 'createdAt'>>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const updateData = {
        ...excludedDayData,
        updatedAt: Timestamp.now()
      };
      
      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating excluded day:', error);
      throw error;
    }
  }

  static async deleteExcludedDay(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting excluded day:', error);
      throw error;
    }
  }
} 