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
import type { UniformItem, CreateUniformData, UpdateUniformData, UniformGender, UniformSection } from '@/types';

const COLLECTION_NAME = 'uniforms';

export class UniformsService {
  static async getAllUniforms(): Promise<UniformItem[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME), 
        orderBy('name', 'asc')
      );
      const querySnapshot = await getDocs(q);
      
      const uniforms = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      })) as UniformItem[];

      // Sort by group first, then by name (client-side sorting)
      return uniforms.sort((a, b) => {
        if (a.group !== b.group) {
          return a.group.localeCompare(b.group);
        }
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      console.error('Error fetching uniforms:', error);
      throw error;
    }
  }

  static async getActiveUniforms(): Promise<UniformItem[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME), 
        where('isActive', '==', true)
      );
      const querySnapshot = await getDocs(q);
      
      const uniforms = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      })) as UniformItem[];

      // Sort by group first, then by name (client-side sorting)
      return uniforms.sort((a, b) => {
        if (a.group !== b.group) {
          return a.group.localeCompare(b.group);
        }
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      console.error('Error fetching active uniforms:', error);
      throw error;
    }
  }

  static async getUniformsByFilter(filters: {
    gender?: UniformGender;
    classId?: string;
    section?: UniformSection;
  }): Promise<UniformItem[]> {
    try {
      // Use a simple query and do all filtering client-side to avoid index issues
      const q = query(
        collection(db, COLLECTION_NAME),
        where('isActive', '==', true)
      );

      const querySnapshot = await getDocs(q);
      let uniforms = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      })) as UniformItem[];

      // Apply gender filter (client-side)
      if (filters.gender && filters.gender !== 'all') {
        uniforms = uniforms.filter(uniform => 
          uniform.gender === filters.gender || uniform.gender === 'all'
        );
      }

      // Apply class filter (client-side)
      if (filters.classId) {
        uniforms = uniforms.filter(uniform => 
          uniform.classType === 'all' || 
          (uniform.classType === 'specific' && uniform.classIds?.includes(filters.classId!))
        );
      }

      // Apply section filter (client-side)
      if (filters.section) {
        uniforms = uniforms.filter(uniform => 
          uniform.sectionType === 'all' || 
          (uniform.sectionType === 'specific' && uniform.section === filters.section)
        );
      }

      return uniforms.sort((a, b) => {
        if (a.group !== b.group) {
          return a.group.localeCompare(b.group);
        }
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      console.error('Error fetching filtered uniforms:', error);
      throw error;
    }
  }

  static async getUniformById(id: string): Promise<UniformItem | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate?.()?.toISOString() || docSnap.data().createdAt,
          updatedAt: docSnap.data().updatedAt?.toDate?.()?.toISOString() || docSnap.data().updatedAt
        } as UniformItem;
      }
      return null;
    } catch (error) {
      console.error('Error fetching uniform:', error);
      throw error;
    }
  }

  static async createUniform(uniformData: CreateUniformData): Promise<string> {
    try {
      const newUniform = {
        ...uniformData,
        isActive: uniformData.isActive ?? true,
        createdAt: Timestamp.now()
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(newUniform);
      
      const docRef = await addDoc(collection(db, COLLECTION_NAME), cleanedData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating uniform:', error);
      throw error;
    }
  }

  static async updateUniform(id: string, uniformData: UpdateUniformData): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const updateData = {
        ...uniformData,
        updatedAt: Timestamp.now()
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(updateData);
      
      await updateDoc(docRef, cleanedData);
    } catch (error) {
      console.error('Error updating uniform:', error);
      throw error;
    }
  }

  static async deleteUniform(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting uniform:', error);
      throw error;
    }
  }

  static async toggleUniformStatus(id: string, isActive: boolean): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        isActive,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error toggling uniform status:', error);
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