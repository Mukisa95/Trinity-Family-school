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
import type { DynamicDiscount } from '@/types';

const COLLECTION_NAME = 'dynamicDiscounts';

export class DynamicDiscountsService {
  static async getAllDiscounts(): Promise<DynamicDiscount[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME)
        // Removed orderBy to avoid requiring single-field index
      );
      const querySnapshot = await getDocs(q);
      
      const discounts = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
        expiresAt: doc.data().expiresAt?.toDate?.()?.toISOString() || doc.data().expiresAt
      })) as DynamicDiscount[];

      // Sort by createdAt on client side (descending order)
      return discounts.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA; // desc order
      });
    } catch (error) {
      console.error('Error fetching dynamic discounts:', error);
      throw error;
    }
  }

  static async getActiveDiscounts(): Promise<DynamicDiscount[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('isActive', '==', true)
      );
      const querySnapshot = await getDocs(q);
      
      const discounts = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
        expiresAt: doc.data().expiresAt?.toDate?.()?.toISOString() || doc.data().expiresAt
      })) as DynamicDiscount[];

      // Sort by createdAt on client side (descending order)
      const sortedDiscounts = discounts.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA; // desc order
      });

      // Filter out expired discounts
      const now = new Date();
      return sortedDiscounts.filter(discount => {
        if (!discount.expiresAt) return true;
        return new Date(discount.expiresAt) > now;
      });
    } catch (error) {
      console.error('Error fetching active dynamic discounts:', error);
      throw error;
    }
  }

  static async getDiscountById(id: string): Promise<DynamicDiscount | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate?.()?.toISOString() || docSnap.data().createdAt,
          updatedAt: docSnap.data().updatedAt?.toDate?.()?.toISOString() || docSnap.data().updatedAt,
          expiresAt: docSnap.data().expiresAt?.toDate?.()?.toISOString() || docSnap.data().expiresAt
        } as DynamicDiscount;
      }
      return null;
    } catch (error) {
      console.error('Error fetching dynamic discount:', error);
      throw error;
    }
  }

  static async createDiscount(discountData: Omit<DynamicDiscount, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const newDiscount = {
        ...discountData,
        createdAt: Timestamp.now(),
        expiresAt: discountData.expiresAt ? Timestamp.fromDate(new Date(discountData.expiresAt)) : null
      };
      
      // Clean undefined values
      const cleanedData = this.cleanUndefinedValues(newDiscount);
      
      const docRef = await addDoc(collection(db, COLLECTION_NAME), cleanedData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating dynamic discount:', error);
      throw error;
    }
  }

  static async updateDiscount(id: string, discountData: Partial<Omit<DynamicDiscount, 'id' | 'createdAt'>>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const updateData = {
        ...discountData,
        updatedAt: Timestamp.now(),
        expiresAt: discountData.expiresAt ? Timestamp.fromDate(new Date(discountData.expiresAt)) : undefined
      };
      
      // Clean undefined values
      const cleanedData = this.cleanUndefinedValues(updateData);
      
      await updateDoc(docRef, cleanedData);
    } catch (error) {
      console.error('Error updating dynamic discount:', error);
      throw error;
    }
  }

  static async deleteDiscount(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting dynamic discount:', error);
      throw error;
    }
  }

  static async deactivateDiscount(id: string): Promise<void> {
    await this.updateDiscount(id, { isActive: false });
  }

  static async activateDiscount(id: string): Promise<void> {
    await this.updateDiscount(id, { isActive: true });
  }

  /**
   * Find applicable dynamic discounts for a uniform assignment
   */
  static async getApplicableDiscounts(criteria: {
    uniformId: string | string[];
    selectionMode: string;
    classId?: string;
    section?: string;
    gender?: string;
    createdAfter?: string; // ISO string date
  }): Promise<DynamicDiscount[]> {
    const activeDiscounts = await this.getActiveDiscounts();
    const { uniformId, selectionMode, classId, section, gender, createdAfter } = criteria;

    return activeDiscounts.filter(discount => {
      // Check if discount was created before the assignment
      if (createdAfter && new Date(discount.createdAt) > new Date(createdAfter)) {
        return false;
      }

      // Check uniform match
      if (discount.uniformId) {
        const discountUniforms = Array.isArray(discount.uniformId) ? discount.uniformId : [discount.uniformId];
        const assignmentUniforms = Array.isArray(uniformId) ? uniformId : [uniformId];
        
        const hasMatch = discountUniforms.some(du => assignmentUniforms.includes(du));
        if (!hasMatch) return false;
      }

      // Check selection mode match
      if (discount.selectionMode && discount.selectionMode !== selectionMode) {
        return false;
      }

      // Check class match
      if (discount.classId && discount.classId !== classId) {
        return false;
      }

      // Check section match
      if (discount.section && discount.section !== section) {
        return false;
      }

      // Check gender match
      if (discount.gender && discount.gender !== gender) {
        return false;
      }

      return true;
    });
  }

  private static cleanUndefinedValues(obj: any): any {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }
} 