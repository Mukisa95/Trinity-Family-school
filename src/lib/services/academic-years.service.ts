import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  writeBatch,
  query, 
  orderBy,
  where,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { getDocsWithTimeout } from '../utils/firestore-helpers';
import type { AcademicYear } from '@/types';
import { bumpAcademicYearsRevisionInBatch } from './dashboard-cache-revisions.service';

const COLLECTION_NAME = 'academicYears';

export class AcademicYearsService {
  private static sharedAcademicYears: AcademicYear[] | null = null;
  private static pendingSharedRefresh: Promise<AcademicYear[]> | null = null;
  private static sharedReadyPromise: Promise<AcademicYear[]> | null = null;
  private static resolveSharedReady: ((years: AcademicYear[]) => void) | null = null;
  private static rejectSharedReady: ((error: unknown) => void) | null = null;

  private static waitForSharedAcademicYears(): Promise<AcademicYear[]> {
    if (!this.sharedReadyPromise) {
      this.sharedReadyPromise = new Promise<AcademicYear[]>((resolve, reject) => {
        this.resolveSharedReady = resolve;
        this.rejectSharedReady = reject;
      });
    }
    return this.sharedReadyPromise;
  }

  /** Makes the cache-owner snapshot available to legacy browser consumers. */
  static hydrateSharedAcademicYears(years: AcademicYear[]): void {
    this.sharedAcademicYears = years;
    this.resolveSharedReady?.(years);
    this.resolveSharedReady = null;
    this.rejectSharedReady = null;
    this.sharedReadyPromise = Promise.resolve(years);
  }

  static clearSharedAcademicYears(): void {
    this.resolveSharedReady?.([]);
    this.sharedAcademicYears = null;
    this.pendingSharedRefresh = null;
    this.sharedReadyPromise = null;
    this.resolveSharedReady = null;
    this.rejectSharedReady = null;
  }

  /** The cache bootstrap is the only browser caller allowed to start a refresh. */
  static refreshSharedAcademicYears(load: () => Promise<AcademicYear[]>): Promise<AcademicYear[]> {
    if (this.pendingSharedRefresh) return this.pendingSharedRefresh;

    const pending = load()
      .catch(error => {
        this.rejectSharedReady?.(error);
        this.sharedReadyPromise = null;
        this.resolveSharedReady = null;
        this.rejectSharedReady = null;
        throw error;
      })
      .finally(() => {
        if (this.pendingSharedRefresh === pending) {
          this.pendingSharedRefresh = null;
        }
      });

    this.pendingSharedRefresh = pending;
    return pending;
  }

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
  static async getAllForCache(): Promise<AcademicYear[]> {
    const q = query(collection(db, COLLECTION_NAME), orderBy('name', 'desc'));
    const docs = await getDocsWithTimeout<AcademicYear & { id: string }>(q);
    return docs.map(doc => ({
        ...doc,
        startDate: AcademicYearsService.convertTimestampToISO(doc.startDate),
        endDate: AcademicYearsService.convertTimestampToISO(doc.endDate),
        terms: doc.terms?.map((term: any) => ({
          ...term,
          startDate: AcademicYearsService.convertTimestampToISO(term.startDate),
          endDate: AcademicYearsService.convertTimestampToISO(term.endDate),
        })) || []
      })) as AcademicYear[];
  }

  static async getAllAcademicYears(): Promise<AcademicYear[]> {
    if (typeof window !== 'undefined') {
      if (this.sharedAcademicYears) return this.sharedAcademicYears;
      if (this.pendingSharedRefresh) return this.pendingSharedRefresh;
      return this.waitForSharedAcademicYears();
    }

    try {
      return await this.getAllForCache();
    } catch (error) {
      console.error('Error fetching academic years:', error);
      throw error;
    }
  }

  static async getAcademicYearById(id: string): Promise<AcademicYear | null> {
    if (typeof window !== 'undefined') {
      return (await this.getAllAcademicYears()).find(year => year.id === id) ?? null;
    }

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
    if (typeof window !== 'undefined') {
      return (await this.getAllAcademicYears()).find(year => year.isActive) ?? null;
    }

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
      
      const docRef = doc(collection(db, COLLECTION_NAME));
      const batch = writeBatch(db);
      batch.set(docRef, cleanedData);
      bumpAcademicYearsRevisionInBatch(batch);
      await batch.commit();
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
      
      const batch = writeBatch(db);
      batch.update(docRef, cleanedData);
      bumpAcademicYearsRevisionInBatch(batch);
      await batch.commit();
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
      const batch = writeBatch(db);
      batch.delete(docRef);
      bumpAcademicYearsRevisionInBatch(batch);
      await batch.commit();
    } catch (error) {
      console.error('Error deleting academic year:', error);
      throw error;
    }
  }

  static async setActiveAcademicYear(id: string): Promise<void> {
    try {
      // This read happens only when an administrator explicitly changes the
      // active year. It avoids touching every historical year on each change.
      const activeYears = await getDocs(
        query(collection(db, COLLECTION_NAME), where('isActive', '==', true)),
      );
      const isAlreadySoleActiveYear =
        activeYears.size === 1 && activeYears.docs[0]?.id === id;
      if (isAlreadySoleActiveYear) return;

      const batch = writeBatch(db);
      activeYears.docs.forEach(activeYear => {
        if (activeYear.id !== id) {
          batch.update(activeYear.ref, { isActive: false, updatedAt: Timestamp.now() });
        }
      });
      batch.update(doc(db, COLLECTION_NAME, id), { isActive: true, updatedAt: Timestamp.now() });
      bumpAcademicYearsRevisionInBatch(batch);
      await batch.commit();
    } catch (error) {
      console.error('Error setting active academic year:', error);
      throw error;
    }
  }
}
