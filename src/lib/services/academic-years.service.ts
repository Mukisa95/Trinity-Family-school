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
import type { AcademicYear } from '@/types';

const COLLECTION_NAME = 'academicYears';

export class AcademicYearsService {
  // Helper method to convert various timestamp formats to ISO string
  private static convertTimestampToISO(timestamp: any): string {
    if (!timestamp) return '';
    
    // If it's a Firebase Timestamp with toDate method
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toISOString();
    }
    
    // If it's a plain object with seconds and nanoseconds (like { seconds: 1738540800, nanoseconds: 0 })
    if (timestamp.seconds && typeof timestamp.seconds === 'number') {
      const date = new Date(timestamp.seconds * 1000);
      if (timestamp.nanoseconds) {
        date.setMilliseconds(timestamp.nanoseconds / 1000000);
      }
      return date.toISOString();
    }
    
    // If it's already a string, return as-is
    if (typeof timestamp === 'string') {
      return timestamp;
    }
    
    // If it's a Date object
    if (timestamp instanceof Date) {
      return timestamp.toISOString();
    }
    
    // Fallback: try to create a Date from the value
    try {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    } catch (error) {
      console.warn('Failed to convert timestamp to ISO:', timestamp, error);
    }
    
    return '';
  }
  static async getAllAcademicYears(): Promise<AcademicYear[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('name', 'desc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: AcademicYearsService.convertTimestampToISO(doc.data().startDate),
        endDate: AcademicYearsService.convertTimestampToISO(doc.data().endDate),
        terms: doc.data().terms?.map((term: any) => ({
          ...term,
          startDate: AcademicYearsService.convertTimestampToISO(term.startDate),
          endDate: AcademicYearsService.convertTimestampToISO(term.endDate),
        })) || []
      })) as AcademicYear[];
    } catch (error) {
      console.error('Error fetching academic years:', error);
      throw error;
    }
  }

  static async getAcademicYearById(id: string): Promise<AcademicYear | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          startDate: AcademicYearsService.convertTimestampToISO(data.startDate),
          endDate: AcademicYearsService.convertTimestampToISO(data.endDate),
          terms: data.terms?.map((term: any) => ({
            ...term,
            startDate: AcademicYearsService.convertTimestampToISO(term.startDate),
            endDate: AcademicYearsService.convertTimestampToISO(term.endDate),
          })) || []
        } as AcademicYear;
      }
      return null;
    } catch (error) {
      console.error('Error fetching academic year:', error);
      throw error;
    }
  }

  static async getActiveAcademicYear(): Promise<AcademicYear | null> {
    try {
      const q = query(collection(db, COLLECTION_NAME), where('isActive', '==', true));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startDate: AcademicYearsService.convertTimestampToISO(data.startDate),
          endDate: AcademicYearsService.convertTimestampToISO(data.endDate),
          terms: data.terms?.map((term: any) => ({
            ...term,
            startDate: AcademicYearsService.convertTimestampToISO(term.startDate),
            endDate: AcademicYearsService.convertTimestampToISO(term.endDate),
          })) || []
        } as AcademicYear;
      }
      return null;
    } catch (error) {
      console.error('Error fetching active academic year:', error);
      throw error;
    }
  }

  static async createAcademicYear(yearData: Omit<AcademicYear, 'id'>): Promise<string> {
    try {
      const newYear = {
        ...yearData,
        startDate: yearData.startDate ? Timestamp.fromDate(new Date(yearData.startDate)) : null,
        endDate: yearData.endDate ? Timestamp.fromDate(new Date(yearData.endDate)) : null,
        terms: yearData.terms?.map(term => ({
          ...term,
          startDate: term.startDate ? Timestamp.fromDate(new Date(term.startDate)) : null,
          endDate: term.endDate ? Timestamp.fromDate(new Date(term.endDate)) : null,
        })) || [],
        createdAt: Timestamp.now()
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(newYear);
      
      const docRef = await addDoc(collection(db, COLLECTION_NAME), cleanedData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating academic year:', error);
      throw error;
    }
  }

  static async updateAcademicYear(id: string, yearData: Partial<Omit<AcademicYear, 'id'>>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const updateData: any = {
        ...yearData,
        updatedAt: Timestamp.now()
      };

      if (yearData.startDate) {
        updateData.startDate = Timestamp.fromDate(new Date(yearData.startDate));
      }
      if (yearData.endDate) {
        updateData.endDate = Timestamp.fromDate(new Date(yearData.endDate));
      }
      if (yearData.terms) {
        updateData.terms = yearData.terms.map(term => ({
          ...term,
          startDate: term.startDate ? Timestamp.fromDate(new Date(term.startDate)) : null,
          endDate: term.endDate ? Timestamp.fromDate(new Date(term.endDate)) : null,
        }));
      }
      
      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(updateData);
      
      await updateDoc(docRef, cleanedData);
    } catch (error) {
      console.error('Error updating academic year:', error);
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

  static async deleteAcademicYear(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting academic year:', error);
      throw error;
    }
  }

  static async setActiveAcademicYear(id: string): Promise<void> {
    try {
      // First, set all academic years to inactive
      const allYears = await this.getAllAcademicYears();
      const updatePromises = allYears.map(year => 
        this.updateAcademicYear(year.id, { isActive: false })
      );
      await Promise.all(updatePromises);

      // Then set the specified year as active
      await this.updateAcademicYear(id, { isActive: true });
    } catch (error) {
      console.error('Error setting active academic year:', error);
      throw error;
    }
  }
} 