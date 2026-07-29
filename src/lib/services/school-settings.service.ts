import { 
  doc, 
  getDoc, 
  getDocFromCache,
  setDoc, 
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import type { SchoolSettings } from '@/types';
import { getDocWithTimeout, isFirestoreOfflineError } from '@/lib/utils/firestore-helpers';

const SETTINGS_DOC_ID = 'school-settings';
const COLLECTION_NAME = 'settings';

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

export class SchoolSettingsService {
  /**
   * Get school settings with ULTRA-FAST cache-first strategy
   * Tries cache first (synchronous), then falls back to server
   * This is critical because many components depend on this data
   */
  static async getSchoolSettings(): Promise<SchoolSettings | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, SETTINGS_DOC_ID);
      
      // CRITICAL OPTIMIZATION: Try cache first for instant reads
      // This is synchronous and returns immediately if data is cached
      try {
        const cachedSnap = await getDocFromCache(docRef);
        if (cachedSnap.exists()) {
          const cachedData = {
            id: cachedSnap.id,
            ...cachedSnap.data(),
          } as unknown as SchoolSettings;
          if (process.env.NODE_ENV === 'development') {
            console.log('⚡ School settings loaded from cache (instant)');
          }
          return cachedData;
        }
      } catch (cacheError: any) {
        // Cache miss is fine, fall through to server fetch
        // This is expected on first load or if cache was cleared
      }
      
      // Fallback to server fetch (getDoc uses cache automatically if available)
      // This will be instant if Firestore has cached it, or fetch from server
      const settings = await getDocWithTimeout<SchoolSettings>(docRef, 3000);
      
      if (settings && process.env.NODE_ENV === 'development') {
        console.log('✅ School settings loaded from server');
      }
      
      return settings;
    } catch (error: any) {
      // If Firestore is offline, return null instead of throwing
      if (isFirestoreOfflineError(error)) {
        console.warn('School settings unavailable - Firestore offline');
        return null;
      }
      
      console.error('Error fetching school settings:', error);
      throw error;
    }
  }

  static async updateSchoolSettings(settings: SchoolSettings): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, SETTINGS_DOC_ID);
      const updateData = {
        ...settings,
        updatedAt: new Date().toISOString()
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = Object.fromEntries(
        Object.entries(updateData).filter(([_, value]) => value !== undefined)
      );
      
      await setDoc(docRef, cleanedData, { merge: true });
    } catch (error) {
      console.error('Error updating school settings:', error);
      throw error;
    }
  }

  static async initializeSchoolSettings(settings: SchoolSettings): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, SETTINGS_DOC_ID);
      const settingsWithTimestamp = {
        ...settings,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = Object.fromEntries(
        Object.entries(settingsWithTimestamp).filter(([_, value]) => value !== undefined)
      );
      
      await setDoc(docRef, cleanedData);
    } catch (error) {
      console.error('Error initializing school settings:', error);
      throw error;
    }
  }

  static async updateGeneralInfo(generalInfo: SchoolSettings['generalInfo']): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, SETTINGS_DOC_ID);
      const updateData = {
        generalInfo,
        updatedAt: new Date().toISOString()
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = cleanUndefinedValues(updateData);
      
      await updateDoc(docRef, cleanedData);
    } catch (error) {
      console.error('Error updating general info:', error);
      throw error;
    }
  }

  static async updateContactInfo(contact: SchoolSettings['contact']): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, SETTINGS_DOC_ID);
      const updateData = {
        contact,
        updatedAt: new Date().toISOString()
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = cleanUndefinedValues(updateData);
      
      await updateDoc(docRef, cleanedData);
    } catch (error) {
      console.error('Error updating contact info:', error);
      throw error;
    }
  }

  static async updateAddress(address: SchoolSettings['address']): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, SETTINGS_DOC_ID);
      const updateData = {
        address,
        updatedAt: new Date().toISOString()
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = cleanUndefinedValues(updateData);
      
      await updateDoc(docRef, cleanedData);
    } catch (error) {
      console.error('Error updating address:', error);
      throw error;
    }
  }
} 
