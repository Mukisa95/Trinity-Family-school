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
import type { Staff } from '@/types';

const COLLECTION_NAME = 'staff';

export class StaffService {
  static async getAllStaff(): Promise<Staff[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('lastName', 'asc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Staff[];
    } catch (error) {
      console.error('Error fetching staff:', error);
      throw error;
    }
  }

  static async getStaffById(id: string): Promise<Staff | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as Staff;
      }
      return null;
    } catch (error) {
      console.error('Error fetching staff by ID:', error);
      throw error;
    }
  }

  static async getStaffByDepartment(department: string): Promise<Staff[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME), 
        where('department', 'array-contains', department),
        orderBy('lastName', 'asc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Staff[];
    } catch (error) {
      console.error('Error fetching staff by department:', error);
      throw error;
    }
  }

  static async checkEmployeeIDExists(employeeId: string, excludeId?: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('employeeId', '==', employeeId)
      );
      const querySnapshot = await getDocs(q);
      
      // If we're updating, exclude the current staff member from the check
      if (excludeId) {
        return querySnapshot.docs.some(doc => doc.id !== excludeId);
      }
      
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking employee ID existence:', error);
      throw error;
    }
  }

  static async generateUniqueEmployeeID(
    idData: { firstName: string; lastName: string; dateOfBirth: string; departments: string[] },
    excludeId?: string,
    maxAttempts: number = 10
  ): Promise<string> {
    const { generateEmployeeID } = await import('@/lib/utils/employee-id-generator');
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const generatedID = generateEmployeeID(idData);
        const exists = await this.checkEmployeeIDExists(generatedID.id, excludeId);
        
        if (!exists) {
          return generatedID.id;
        }
        
        // If ID exists, try again with a new random number
        console.log(`Employee ID ${generatedID.id} already exists, retrying... (attempt ${attempt})`);
      } catch (error) {
        console.error(`Error generating employee ID (attempt ${attempt}):`, error);
        if (attempt === maxAttempts) {
          throw error;
        }
      }
    }
    
    throw new Error(`Failed to generate unique employee ID after ${maxAttempts} attempts`);
  }

  static async createStaff(staffData: Omit<Staff, 'id' | 'createdAt'>): Promise<Staff> {
    try {
      // Generate unique employee ID if not provided
      let employeeId = staffData.employeeId;
      if (!employeeId) {
        employeeId = await this.generateUniqueEmployeeID({
          firstName: staffData.firstName,
          lastName: staffData.lastName,
          dateOfBirth: staffData.dateOfBirth,
          departments: staffData.department,
        });
      } else {
        // Check if provided ID is unique
        const exists = await this.checkEmployeeIDExists(employeeId);
        if (exists) {
          throw new Error(`Employee ID ${employeeId} already exists`);
        }
      }

      const newStaff = {
        ...staffData,
        employeeId,
        createdAt: new Date().toISOString()
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(newStaff);
      
      const docRef = await addDoc(collection(db, COLLECTION_NAME), cleanedData);
      return {
        id: docRef.id,
        ...newStaff
      };
    } catch (error) {
      console.error('Error creating staff:', error);
      throw error;
    }
  }

  static async updateStaff(id: string, data: Partial<Omit<Staff, 'id' | 'createdAt'>>): Promise<Staff> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const updateData = {
        ...data,
        updatedAt: new Date().toISOString()
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(updateData);
      
      await updateDoc(docRef, cleanedData);
      
      // Get the updated document
      const updatedDoc = await getDoc(docRef);
      if (!updatedDoc.exists()) {
        throw new Error('Staff not found after update');
      }
      
      return {
        id: updatedDoc.id,
        ...updatedDoc.data()
      } as Staff;
    } catch (error) {
      console.error('Error updating staff:', error);
      throw error;
    }
  }

  static async deleteStaff(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting staff:', error);
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