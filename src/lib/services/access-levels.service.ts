import { db } from '@/lib/firebase';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  orderBy,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { AccessLevel, CreateAccessLevelData, UpdateAccessLevelData, PREDEFINED_ACCESS_LEVELS } from '@/types/access-levels';
import { MODULE_ACTIONS } from '@/types/permissions';

const COLLECTION_NAME = 'accessLevels';

export class AccessLevelsService {
  /**
   * Create a new access level
   */
  static async createAccessLevel(data: CreateAccessLevelData, createdBy: string): Promise<string> {
    try {
      // If this is set as default, unset other default levels
      if (data.isDefault) {
        await this.unsetDefaultLevels();
      }

      const accessLevelData: Omit<AccessLevel, 'id'> = {
        ...data,
        isDefault: data.isDefault || false,
        isActive: true,
        createdAt: new Date().toISOString(),
        createdBy,
        updatedAt: new Date().toISOString(),
        updatedBy: createdBy
      };

      const docRef = await addDoc(collection(db, COLLECTION_NAME), accessLevelData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating access level:', error);
      throw new Error('Failed to create access level');
    }
  }

  /**
   * Update an existing access level
   */
  static async updateAccessLevel(id: string, data: UpdateAccessLevelData, updatedBy: string): Promise<void> {
    try {
      const accessLevelRef = doc(db, COLLECTION_NAME, id);
      
      // If this is set as default, unset other default levels
      if (data.isDefault) {
        await this.unsetDefaultLevels();
      }

      const updateData = {
        ...data,
        updatedAt: new Date().toISOString(),
        updatedBy
      };

      await updateDoc(accessLevelRef, updateData);
    } catch (error) {
      console.error('Error updating access level:', error);
      throw new Error('Failed to update access level');
    }
  }

  /**
   * Delete an access level
   */
  static async deleteAccessLevel(id: string): Promise<void> {
    try {
      const accessLevelRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(accessLevelRef);
    } catch (error) {
      console.error('Error deleting access level:', error);
      throw new Error('Failed to delete access level');
    }
  }

  /**
   * Get all access levels
   */
  static async getAllAccessLevels(): Promise<AccessLevel[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AccessLevel));
    } catch (error) {
      console.error('Error fetching access levels:', error);
      throw new Error('Failed to fetch access levels');
    }
  }

  /**
   * Get active access levels only
   */
  static async getActiveAccessLevels(): Promise<AccessLevel[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('isActive', '==', true),
        orderBy('name', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AccessLevel));
    } catch (error) {
      console.error('Error fetching active access levels:', error);
      throw new Error('Failed to fetch active access levels');
    }
  }

  /**
   * Get access level by ID
   */
  static async getAccessLevelById(id: string): Promise<AccessLevel | null> {
    try {
      const accessLevelRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(accessLevelRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as AccessLevel;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching access level:', error);
      throw new Error('Failed to fetch access level');
    }
  }

  /**
   * Get the default access level
   */
  static async getDefaultAccessLevel(): Promise<AccessLevel | null> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('isDefault', '==', true),
        where('isActive', '==', true)
      );
      
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return {
          id: doc.id,
          ...doc.data()
        } as AccessLevel;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching default access level:', error);
      throw new Error('Failed to fetch default access level');
    }
  }

  /**
   * Unset all default levels (helper method)
   */
  private static async unsetDefaultLevels(): Promise<void> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('isDefault', '==', true)
      );
      
      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      querySnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { isDefault: false });
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Error unsetting default levels:', error);
      throw new Error('Failed to unset default levels');
    }
  }

  /**
   * Initialize predefined access levels
   */
  static async initializePredefinedLevels(createdBy: string): Promise<void> {
    try {
      const existingLevels = await this.getAllAccessLevels();
      const existingNames = existingLevels.map(level => level.name);
      
      const batch = writeBatch(db);
      let hasNewLevels = false;

      for (const [key, levelData] of Object.entries(PREDEFINED_ACCESS_LEVELS)) {
        if (!existingNames.includes(levelData.name)) {
          const newLevelRef = doc(collection(db, COLLECTION_NAME));
          batch.set(newLevelRef, {
            ...levelData,
            isDefault: false,
            isActive: true,
            createdAt: new Date().toISOString(),
            createdBy,
            updatedAt: new Date().toISOString(),
            updatedBy: createdBy
          });
          hasNewLevels = true;
        }
      }

      if (hasNewLevels) {
        await batch.commit();
      }
    } catch (error) {
      console.error('Error initializing predefined levels:', error);
      throw new Error('Failed to initialize predefined levels');
    }
  }

  /**
   * Get access level permissions in a format compatible with user creation
   */
  static getAccessLevelPermissions(accessLevel: AccessLevel): {
    modulePermissions: any[];
    granularPermissions: any[];
  } {
    // Convert to legacy format for backward compatibility
    const modulePermissions = accessLevel.modulePermissions.map(module => ({
      module: module.moduleId,
      permission: this.determineLegacyPermission(module)
    }));

    // Keep granular permissions as-is
    const granularPermissions = accessLevel.modulePermissions;

    return {
      modulePermissions,
      granularPermissions
    };
  }

  /**
   * Determine legacy permission level from granular permissions
   */
  private static determineLegacyPermission(modulePermissions: any): 'view_only' | 'edit' | 'full_access' {
    let hasEditActions = false;
    let hasDeleteActions = false;

    modulePermissions.pages.forEach((page: any) => {
      if (page.canAccess) {
        page.actions.forEach((action: any) => {
          if (action.allowed) {
            if (action.actionId.includes('edit') || action.actionId.includes('update') || action.actionId.includes('create')) {
              hasEditActions = true;
            }
            if (action.actionId.includes('delete') || action.actionId.includes('remove')) {
              hasDeleteActions = true;
            }
          }
        });
      }
    });

    if (hasDeleteActions) return 'full_access';
    if (hasEditActions) return 'edit';
    return 'view_only';
  }

  /**
   * Validate access level data
   */
  static validateAccessLevelData(data: CreateAccessLevelData): string[] {
    const errors: string[] = [];

    if (!data.name || data.name.trim().length === 0) {
      errors.push('Access level name is required');
    }

    if (data.name && data.name.length > 100) {
      errors.push('Access level name must be less than 100 characters');
    }

    if (!data.description || data.description.trim().length === 0) {
      errors.push('Access level description is required');
    }

    if (!data.modulePermissions || data.modulePermissions.length === 0) {
      errors.push('At least one module permission is required');
    }

    // Validate module permissions structure
    if (data.modulePermissions) {
      data.modulePermissions.forEach((module, index) => {
        if (!module.moduleId) {
          errors.push(`Module ${index + 1}: Module ID is required`);
        }

        if (!module.pages || module.pages.length === 0) {
          errors.push(`Module ${index + 1}: At least one page permission is required`);
        }

        module.pages.forEach((page, pageIndex) => {
          if (!page.pageId) {
            errors.push(`Module ${index + 1}, Page ${pageIndex + 1}: Page ID is required`);
          }

          if (!page.actions || page.actions.length === 0) {
            errors.push(`Module ${index + 1}, Page ${pageIndex + 1}: At least one action permission is required`);
          }
        });
      });
    }

    return errors;
  }
}
