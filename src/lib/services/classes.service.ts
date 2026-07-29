import { 
  collection, 
  doc, 
  writeBatch,
  query, 
  orderBy,
  where,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Class } from '@/types';
import { getDocWithTimeout, getDocsWithTimeout } from '../utils/firestore-helpers';
import { bumpClassesRevisionInBatch } from './dashboard-cache-revisions.service';

const COLLECTION_NAME = 'classes';

export class ClassesService {
  private static sharedClasses: Class[] | null = null;
  private static pendingSharedRefresh: Promise<Class[]> | null = null;
  private static sharedReadyPromise: Promise<Class[]> | null = null;
  private static resolveSharedReady: ((classes: Class[]) => void) | null = null;
  private static rejectSharedReady: ((error: unknown) => void) | null = null;

  private static waitForSharedClasses(): Promise<Class[]> {
    if (!this.sharedReadyPromise) {
      this.sharedReadyPromise = new Promise<Class[]>((resolve, reject) => {
        this.resolveSharedReady = resolve;
        this.rejectSharedReady = reject;
      });
    }
    return this.sharedReadyPromise;
  }

  /**
   * Makes the identity-scoped class snapshot available to legacy service
   * consumers (notably pupil enrichment) without letting them start reads.
   */
  static hydrateSharedClasses(classes: Class[]): void {
    this.sharedClasses = classes;
    this.resolveSharedReady?.(classes);
    this.resolveSharedReady = null;
    this.rejectSharedReady = null;
    this.sharedReadyPromise = Promise.resolve(classes);
  }

  static clearSharedClasses(): void {
    // Release callers from the previous identity without leaking the next
    // identity's snapshot into work that was already in flight.
    this.resolveSharedReady?.([]);
    this.sharedClasses = null;
    this.pendingSharedRefresh = null;
    this.sharedReadyPromise = null;
    this.resolveSharedReady = null;
    this.rejectSharedReady = null;
  }

  /** The bootstrap is the only caller permitted to begin a browser refresh. */
  static refreshSharedClasses(load: () => Promise<Class[]>): Promise<Class[]> {
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

  /**
   * Strict collection read used only by the central class-cache owner. Unlike
   * the legacy convenience method, an unavailable server must not be mistaken
   * for a valid empty school and overwrite a warm persistent cache.
   */
  static async getAllForCache(): Promise<Class[]> {
    const q = query(collection(db, COLLECTION_NAME), orderBy('order', 'asc'));
    const classes = await getDocsWithTimeout<Class>(q, 30000);
    return classes.map(cls => ({
      ...cls,
      createdAt: typeof cls.createdAt === 'string'
        ? cls.createdAt
        : (cls.createdAt as any)?.toDate?.()?.toISOString() || cls.createdAt,
    }));
  }

  static async getAll(): Promise<Class[]> {
    // Browser consumers must share the bootstrap snapshot. This prevents pupil
    // and fee workflows from quietly creating a second classes collection read.
    if (typeof window !== 'undefined') {
      if (this.sharedClasses) return this.sharedClasses;
      if (this.pendingSharedRefresh) return this.pendingSharedRefresh;
      return this.waitForSharedClasses();
    }

    try {
      return await this.getAllForCache();
    } catch (error) {
      console.error('Error fetching classes:', error);
      // Return empty array instead of throwing to prevent app crash
      // The query will retry automatically via React Query
      return [];
    }
  }

  static async getById(id: string): Promise<Class | null> {
    if (typeof window !== 'undefined') {
      return (await this.getAll()).find(classItem => classItem.id === id) ?? null;
    }

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
      
      const docRef = doc(collection(db, COLLECTION_NAME));
      const batch = writeBatch(db);
      batch.set(docRef, cleanedData);
      bumpClassesRevisionInBatch(batch);
      await batch.commit();
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
      
      const batch = writeBatch(db);
      batch.update(docRef, cleanedData);
      bumpClassesRevisionInBatch(batch);
      await batch.commit();
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
      const batch = writeBatch(db);
      batch.delete(docRef);
      bumpClassesRevisionInBatch(batch);
      await batch.commit();
    } catch (error) {
      console.error('Error deleting class:', error);
      throw error;
    }
  }

  static async getByLevel(level: string): Promise<Class[]> {
    if (typeof window !== 'undefined') {
      return (await this.getAll()).filter(classItem => classItem.level === level);
    }

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
