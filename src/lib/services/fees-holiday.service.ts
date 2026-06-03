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
import type { FeesHoliday } from '@/types';

const FEES_HOLIDAY_COLLECTION = 'feesHolidays';

export class FeesHolidayService {
  /**
   * Get all fees holidays
   */
  static async getAllFeesHolidays(): Promise<FeesHoliday[]> {
    try {
      const q = query(
        collection(db, FEES_HOLIDAY_COLLECTION),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
        disabledAt: doc.data().disabledAt?.toDate?.()?.toISOString() || doc.data().disabledAt,
      })) as FeesHoliday[];
    } catch (error) {
      console.error('Error fetching fees holidays:', error);
      throw error;
    }
  }

  /**
   * Get fees holidays for a specific pupil
   */
  static async getFeesHolidaysByPupil(pupilId: string): Promise<FeesHoliday[]> {
    try {
      const q = query(
        collection(db, FEES_HOLIDAY_COLLECTION),
        where('pupilId', '==', pupilId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
        disabledAt: doc.data().disabledAt?.toDate?.()?.toISOString() || doc.data().disabledAt,
      })) as FeesHoliday[];
    } catch (error) {
      console.error('Error fetching fees holidays for pupil:', error);
      throw error;
    }
  }

  /**
   * Get active fees holidays for a specific pupil
   */
  static async getActiveFeesHolidaysByPupil(pupilId: string): Promise<FeesHoliday[]> {
    try {
      // Query without orderBy to avoid requiring a composite index
      // We'll sort in memory instead
      const q = query(
        collection(db, FEES_HOLIDAY_COLLECTION),
        where('pupilId', '==', pupilId),
        where('isActive', '==', true)
      );
      const querySnapshot = await getDocs(q);
      
      const holidays = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
        disabledAt: doc.data().disabledAt?.toDate?.()?.toISOString() || doc.data().disabledAt,
      })) as FeesHoliday[];
      
      // Sort by createdAt descending in memory
      return holidays.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
    } catch (error) {
      console.error('Error fetching active fees holidays for pupil:', error);
      throw error;
    }
  }

  /**
   * Get a single fees holiday by ID
   */
  static async getFeesHolidayById(id: string): Promise<FeesHoliday | null> {
    try {
      const docRef = doc(db, FEES_HOLIDAY_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        disabledAt: data.disabledAt?.toDate?.()?.toISOString() || data.disabledAt,
      } as FeesHoliday;
    } catch (error) {
      console.error('Error fetching fees holiday:', error);
      throw error;
    }
  }

  /**
   * Create a new fees holiday
   */
  static async createFeesHoliday(data: Omit<FeesHoliday, 'id' | 'createdAt' | 'updatedAt'>): Promise<FeesHoliday> {
    try {
      const now = new Date().toISOString();
      
      // Validate percentage discount
      if (data.discountType === 'percentage' && (!data.discountValue || data.discountValue < 0 || data.discountValue > 100)) {
        throw new Error('Percentage discount value must be between 0 and 100');
      }

      // Build holiday data, excluding undefined values
      // Handle both old format (single category) and new format (array of categories)
      const categories = Array.isArray((data as any).categories)
        ? (data as any).categories
        : (data as any).category
        ? [(data as any).category]
        : ['required'];

      const holidayData: any = {
        pupilId: data.pupilId,
        categories, // Always use array format
        discountType: data.discountType,
        isActive: data.isActive,
        createdAt: Timestamp.fromDate(new Date(now)),
        updatedAt: Timestamp.fromDate(new Date(now)),
      };

      // Only include discountValue if it exists and is a number
      if (data.discountType === 'percentage' && data.discountValue !== undefined) {
        holidayData.discountValue = data.discountValue;
      }

      // Only include reason if it exists
      if (data.reason) {
        holidayData.reason = data.reason;
      }

      // Only include createdBy if it exists
      if (data.createdBy) {
        holidayData.createdBy = data.createdBy;
      }

      const docRef = await addDoc(collection(db, FEES_HOLIDAY_COLLECTION), holidayData);
      
      return {
        id: docRef.id,
        ...data,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      console.error('Error creating fees holiday:', error);
      throw error;
    }
  }

  /**
   * Update a fees holiday
   */
  static async updateFeesHoliday(
    id: string,
    data: Partial<Omit<FeesHoliday, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<void> {
    try {
      const docRef = doc(db, FEES_HOLIDAY_COLLECTION, id);
      
      // Validate percentage discount if being updated
      if (data.discountType === 'percentage' && data.discountValue !== undefined) {
        if (data.discountValue < 0 || data.discountValue > 100) {
          throw new Error('Percentage discount value must be between 0 and 100');
        }
      }

      // Build update data, only including defined values
      const updateData: any = {
        updatedAt: Timestamp.fromDate(new Date()),
      };

      // Only include fields that are defined
      if (data.pupilId !== undefined) updateData.pupilId = data.pupilId;
      
      // Handle categories - support both old format (single category) and new format (array)
      if ((data as any).categories !== undefined) {
        updateData.categories = (data as any).categories;
      } else if ((data as any).category !== undefined) {
        // Convert old single category to array format
        updateData.categories = [(data as any).category];
      }
      
      if (data.discountType !== undefined) updateData.discountType = data.discountType;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.reason !== undefined) updateData.reason = data.reason;
      if (data.updatedBy !== undefined) updateData.updatedBy = data.updatedBy;

      // Only include discountValue if it's a percentage discount and has a value
      if (data.discountType === 'percentage' && data.discountValue !== undefined) {
        updateData.discountValue = data.discountValue;
      } else if (data.discountType !== undefined && data.discountType !== 'percentage') {
        // If changing from percentage to another type, remove discountValue
        updateData.discountValue = null; // Use null to delete the field in Firestore
      }

      // If disabling, set disabledAt
      if (data.isActive === false && !data.disabledAt) {
        updateData.disabledAt = Timestamp.fromDate(new Date());
      } else if (data.isActive === true) {
        // If enabling, clear disabledAt
        updateData.disabledAt = null;
        updateData.disabledBy = null;
      }

      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating fees holiday:', error);
      throw error;
    }
  }

  /**
   * Delete a fees holiday
   */
  static async deleteFeesHoliday(id: string): Promise<void> {
    try {
      const docRef = doc(db, FEES_HOLIDAY_COLLECTION, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting fees holiday:', error);
      throw error;
    }
  }

  /**
   * Disable a fees holiday (soft delete - doesn't affect payment history)
   */
  static async disableFeesHoliday(id: string, disabledBy?: string): Promise<void> {
    try {
      const docRef = doc(db, FEES_HOLIDAY_COLLECTION, id);
      await updateDoc(docRef, {
        isActive: false,
        disabledAt: Timestamp.fromDate(new Date()),
        disabledBy,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (error) {
      console.error('Error disabling fees holiday:', error);
      throw error;
    }
  }

  /**
   * Enable a fees holiday
   */
  static async enableFeesHoliday(id: string, updatedBy?: string): Promise<void> {
    try {
      const docRef = doc(db, FEES_HOLIDAY_COLLECTION, id);
      await updateDoc(docRef, {
        isActive: true,
        disabledAt: undefined,
        disabledBy: undefined,
        updatedAt: Timestamp.fromDate(new Date()),
        updatedBy,
      });
    } catch (error) {
      console.error('Error enabling fees holiday:', error);
      throw error;
    }
  }
}

