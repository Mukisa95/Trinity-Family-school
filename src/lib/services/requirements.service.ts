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
import type { RequirementItem, CreateRequirementData, UpdateRequirementData, RequirementGender, RequirementSection } from '@/types';

const COLLECTION_NAME = 'requirements';

export class RequirementsService {
  static async getAllRequirements(): Promise<RequirementItem[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME), 
        orderBy('name', 'asc')
      );
      const querySnapshot = await getDocs(q);
      
      const requirements = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      })) as RequirementItem[];

      // Sort by group first, then by name (client-side sorting)
      return requirements.sort((a, b) => {
        if (a.group !== b.group) {
          return a.group.localeCompare(b.group);
        }
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      console.error('Error fetching requirements:', error);
      throw error;
    }
  }

  static async getActiveRequirements(): Promise<RequirementItem[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME), 
        where('isActive', '==', true)
      );
      const querySnapshot = await getDocs(q);
      
      const requirements = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      })) as RequirementItem[];

      // Sort by group first, then by name (client-side sorting)
      return requirements.sort((a, b) => {
        if (a.group !== b.group) {
          return a.group.localeCompare(b.group);
        }
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      console.error('Error fetching active requirements:', error);
      throw error;
    }
  }

  static async getRequirementsByFilter(filters: {
    gender?: RequirementGender;
    classId?: string;
    section?: RequirementSection;
  }): Promise<RequirementItem[]> {
    try {
      // Use a simple query and do all filtering client-side to avoid index issues
      const q = query(
        collection(db, COLLECTION_NAME),
        where('isActive', '==', true)
      );

      const querySnapshot = await getDocs(q);
      let requirements = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      })) as RequirementItem[];

      // Apply gender filter (client-side)
      if (filters.gender && filters.gender !== 'all') {
        requirements = requirements.filter(requirement => 
          requirement.gender === filters.gender || requirement.gender === 'all'
        );
      }

      // Apply class filter (client-side)
      if (filters.classId) {
        requirements = requirements.filter(requirement => 
          requirement.classType === 'all' || 
          (requirement.classType === 'specific' && requirement.classIds?.includes(filters.classId!))
        );
      }

      // Apply section filter (client-side)
      if (filters.section) {
        requirements = requirements.filter(requirement => 
          requirement.sectionType === 'all' || 
          (requirement.sectionType === 'specific' && requirement.section === filters.section)
        );
      }

      return requirements.sort((a, b) => {
        if (a.group !== b.group) {
          return a.group.localeCompare(b.group);
        }
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      console.error('Error fetching filtered requirements:', error);
      throw error;
    }
  }

  static async getRequirementById(id: string): Promise<RequirementItem | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate?.()?.toISOString() || docSnap.data().createdAt,
          updatedAt: docSnap.data().updatedAt?.toDate?.()?.toISOString() || docSnap.data().updatedAt
        } as RequirementItem;
      }
      return null;
    } catch (error) {
      console.error('Error fetching requirement:', error);
      throw error;
    }
  }

  static async createRequirement(requirementData: CreateRequirementData): Promise<string> {
    try {
      const newRequirement = {
        ...requirementData,
        isActive: requirementData.isActive ?? true,
        createdAt: Timestamp.now()
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(newRequirement);
      
      const docRef = await addDoc(collection(db, COLLECTION_NAME), cleanedData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating requirement:', error);
      throw error;
    }
  }

  static async updateRequirement(id: string, requirementData: UpdateRequirementData): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const updateData = {
        ...requirementData,
        updatedAt: Timestamp.now()
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(updateData);
      
      await updateDoc(docRef, cleanedData);
    } catch (error) {
      console.error('Error updating requirement:', error);
      throw error;
    }
  }

  static async deleteRequirement(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting requirement:', error);
      throw error;
    }
  }

  static async toggleRequirementStatus(id: string, isActive: boolean): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        isActive,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error toggling requirement status:', error);
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
} 