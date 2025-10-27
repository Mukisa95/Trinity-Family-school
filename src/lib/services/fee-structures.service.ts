import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import type { FeeStructure, CreateFeeStructureData, UpdateFeeStructureData } from '@/types';

const COLLECTION_NAME = 'feeStructures';

export class FeeStructuresService {
  static async getAllFeeStructures(): Promise<FeeStructure[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('name', 'asc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      })) as FeeStructure[];
    } catch (error) {
      console.error('Error fetching fee structures:', error);
      throw new Error('Failed to fetch fee structures');
    }
  }

  // 🚀 OPTIMIZED: Database-level filtering methods
  
  // Alias for analytics service compatibility
  static async getByTermAndYear(termId: string, academicYearId: string): Promise<FeeStructure[]> {
    return this.getFeeStructuresByTerm(termId, academicYearId);
  }
  
  static async getFeeStructuresByTerm(termId: string, academicYearId: string): Promise<FeeStructure[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('termId', '==', termId),
        where('academicYearId', '==', academicYearId),
        where('status', '==', 'active'),
        orderBy('name', 'asc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      })) as FeeStructure[];
    } catch (error) {
      console.error('Error fetching fee structures by term:', error);
      throw new Error('Failed to fetch fee structures by term');
    }
  }

  // 🔄 FUTURE YEARS FIX: Get fees applicable to any academic year (including future years)
  static async getFeeStructuresApplicableToYear(selectedAcademicYear: any, allAcademicYears: any[]): Promise<FeeStructure[]> {
    try {
      // Get all active fees and let client-side filtering handle year logic
      // This is necessary because Firestore doesn't support complex year comparison queries
      const q = query(
        collection(db, COLLECTION_NAME),
        where('status', '==', 'active'),
        orderBy('name', 'asc')
      );
      const querySnapshot = await getDocs(q);
      
      const allFees = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      })) as FeeStructure[];

      // Filter fees that are applicable to the selected year
      // Use the same logic as filterApplicableFees for year validation
      const applicableFees = allFees.filter(fee => {
        // Include fees with no specific year (universal fees)
        if (!fee.academicYearId) {
          return true;
        }

        // Find the effective year for this fee
        const effectiveYear = allAcademicYears.find(y => y.id === fee.academicYearId);
        if (!effectiveYear) {
          return false; // Skip fees with invalid year references
        }

        // Fee is applicable if selected year starts on/after the effective year
        const effectiveStartDate = new Date(effectiveYear.startDate);
        const selectedStartDate = new Date(selectedAcademicYear.startDate);
        
        return selectedStartDate >= effectiveStartDate;
      });

      console.log('🔄 Fee structures applicable to year:', {
        selectedYear: selectedAcademicYear.name,
        totalActiveFees: allFees.length,
        applicableToThisYear: applicableFees.length,
        feesWithNoYear: allFees.filter(f => !f.academicYearId).length,
        feesEffectiveThisYear: applicableFees.filter(f => f.academicYearId).length
      });

      return applicableFees;
    } catch (error) {
      console.error('Error fetching fee structures applicable to year:', error);
      throw new Error('Failed to fetch fee structures applicable to year');
    }
  }

  static async getActiveFeeStructures(): Promise<FeeStructure[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('status', '==', 'active'),
        orderBy('name', 'asc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      })) as FeeStructure[];
    } catch (error) {
      console.error('Error fetching active fee structures:', error);
      throw new Error('Failed to fetch active fee structures');
    }
  }

  static async getFeeStructureById(id: string): Promise<FeeStructure | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: docSnap.data().updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        } as FeeStructure;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching fee structure:', error);
      throw new Error('Failed to fetch fee structure');
    }
  }

  static async getFeeStructuresByAcademicYear(academicYearId: string): Promise<FeeStructure[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('academicYearId', '==', academicYearId),
        orderBy('name', 'asc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      })) as FeeStructure[];
    } catch (error) {
      console.error('Error fetching fee structures by academic year:', error);
      throw new Error('Failed to fetch fee structures by academic year');
    }
  }

  static async getFeeStructuresByClass(classId: string): Promise<FeeStructure[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('applicableClasses', 'array-contains', classId),
        orderBy('name', 'asc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      })) as FeeStructure[];
    } catch (error) {
      console.error('Error fetching fee structures by class:', error);
      throw new Error('Failed to fetch fee structures by class');
    }
  }

  static async createFeeStructure(data: CreateFeeStructureData): Promise<FeeStructure> {
    try {
      const now = Timestamp.now();
      const newFeeStructure = {
        ...data,
        createdAt: now,
        updatedAt: now,
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(newFeeStructure);
      
      const docRef = await addDoc(collection(db, COLLECTION_NAME), cleanedData);

      const createdFeeStructure = await this.getFeeStructureById(docRef.id);
      if (!createdFeeStructure) {
        throw new Error('Failed to retrieve created fee structure');
      }

      // 🔥 INVALIDATE CACHE: New fee structure affects calculations
      try {
        const { feeGroupCacheService } = await import('@/lib/services/fee-group-cache.service');
        if (data.academicYearId && data.termId) {
          feeGroupCacheService.invalidateCacheForTerm(data.academicYearId, data.termId);
          console.log('🔄 Cache invalidated for new fee structure:', data.name);
        } else {
          feeGroupCacheService.clearCache();
          console.log('🔄 Full cache cleared for new fee structure:', data.name);
        }
      } catch (cacheError) {
        console.warn('Cache invalidation failed:', cacheError);
      }

      return createdFeeStructure;
    } catch (error) {
      console.error('Error creating fee structure:', error);
      throw new Error('Failed to create fee structure');
    }
  }

  static async updateFeeStructure(id: string, data: UpdateFeeStructureData): Promise<FeeStructure> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const updateData = {
        ...data,
        updatedAt: Timestamp.now(),
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(updateData);
      
      // Get original fee structure for cache invalidation
      const originalFeeStructure = await this.getFeeStructureById(id);

      await updateDoc(docRef, cleanedData);

      const updatedFeeStructure = await this.getFeeStructureById(id);
      if (!updatedFeeStructure) {
        throw new Error('Failed to retrieve updated fee structure');
      }

      // 🔥 INVALIDATE CACHE: Fee structure changes affect calculations
      try {
        const { feeGroupCacheService } = await import('@/lib/services/fee-group-cache.service');
        
        // Invalidate cache for both old and new academic year/term if they changed
        const yearsToInvalidate = new Set();
        const termsToInvalidate = new Set();
        
        if (originalFeeStructure) {
          if (originalFeeStructure.academicYearId && originalFeeStructure.termId) {
            yearsToInvalidate.add(originalFeeStructure.academicYearId);
            termsToInvalidate.add(originalFeeStructure.termId);
          }
        }
        
        if (updatedFeeStructure.academicYearId && updatedFeeStructure.termId) {
          yearsToInvalidate.add(updatedFeeStructure.academicYearId);
          termsToInvalidate.add(updatedFeeStructure.termId);
        }
        
        if (yearsToInvalidate.size > 0 && termsToInvalidate.size > 0) {
          for (const year of yearsToInvalidate) {
            for (const term of termsToInvalidate) {
              feeGroupCacheService.invalidateCacheForTerm(year as string, term as string);
            }
          }
          console.log('🔄 Cache invalidated for updated fee structure:', updatedFeeStructure.name);
        } else {
          feeGroupCacheService.clearCache();
          console.log('🔄 Full cache cleared for updated fee structure:', updatedFeeStructure.name);
        }
      } catch (cacheError) {
        console.warn('Cache invalidation failed:', cacheError);
      }

      return updatedFeeStructure;
    } catch (error) {
      console.error('Error updating fee structure:', error);
      throw new Error('Failed to update fee structure');
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

  static async deleteFeeStructure(id: string): Promise<void> {
    try {
      // Get fee structure before deletion for cache invalidation
      const feeStructure = await this.getFeeStructureById(id);
      
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);

      // 🔥 INVALIDATE CACHE: Deleted fee structure affects calculations
      try {
        const { feeGroupCacheService } = await import('@/lib/services/fee-group-cache.service');
        
        if (feeStructure && feeStructure.academicYearId && feeStructure.termId) {
          feeGroupCacheService.invalidateCacheForTerm(feeStructure.academicYearId, feeStructure.termId);
          console.log('🔄 Cache invalidated for deleted fee structure:', feeStructure.name);
        } else {
          feeGroupCacheService.clearCache();
          console.log('🔄 Full cache cleared for deleted fee structure');
        }
      } catch (cacheError) {
        console.warn('Cache invalidation failed:', cacheError);
      }
    } catch (error) {
      console.error('Error deleting fee structure:', error);
      throw new Error('Failed to delete fee structure');
    }
  }

  static async createMultipleFeeStructures(feeStructures: CreateFeeStructureData[]): Promise<FeeStructure[]> {
    try {
      const results: FeeStructure[] = [];
      
      for (const feeStructureData of feeStructures) {
        const created = await this.createFeeStructure(feeStructureData);
        results.push(created);
      }
      
      return results;
    } catch (error) {
      console.error('Error creating multiple fee structures:', error);
      throw new Error('Failed to create multiple fee structures');
    }
  }
} 