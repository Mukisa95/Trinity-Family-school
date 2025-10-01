import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import type { SystemUser, UserRole, ModulePermission, ModulePermissions } from '@/types';
import { getDocsWithTimeout, isFirestoreOfflineError } from '@/lib/utils/firestore-helpers';

const USERS_COLLECTION = 'system_users';

// Simple password hashing for development (use proper auth in production)
const hashPassword = (password: string): string => {
  // In production, use bcrypt or Firebase Auth
  // For now, using a salted hash approach
  const salt = 'trinity_school_2024'; // Fixed salt for development
  return btoa(salt + password); // Simple salted base64 encoding for demo
};

const verifyPassword = (password: string, hash: string): boolean => {
  const salt = 'trinity_school_2024';
  return btoa(salt + password) === hash;
};

// Utility function to remove undefined values
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

export class UsersService {
  // Create a new user
  static async createUser(userData: Omit<SystemUser, 'id' | 'createdAt'> & { password?: string }): Promise<string> {
    try {
      const { password, ...userDataWithoutPassword } = userData;
      
      const newUser = {
        ...userDataWithoutPassword,
        passwordHash: password ? hashPassword(password) : undefined,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      
      const cleanedData = cleanUndefinedValues(newUser);
      const docRef = await addDoc(collection(db, USERS_COLLECTION), cleanedData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  // Get all users
  static async getAllUsers(): Promise<SystemUser[]> {
    try {
      const q = query(collection(db, USERS_COLLECTION), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt,
        lastLogin: doc.data().lastLogin?.toDate?.() || doc.data().lastLogin
      })) as SystemUser[];
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  // Get users by role
  static async getUsersByRole(role: UserRole): Promise<SystemUser[]> {
    try {
      const q = query(
        collection(db, USERS_COLLECTION), 
        where('role', '==', role),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt,
        lastLogin: doc.data().lastLogin?.toDate?.() || doc.data().lastLogin
      })) as SystemUser[];
    } catch (error) {
      console.error('Error fetching users by role:', error);
      throw error;
    }
  }

  // Get user by ID
  static async getUserById(userId: string): Promise<SystemUser | null> {
    try {
      const userDoc = doc(db, USERS_COLLECTION, userId);
      const snapshot = await getDocsWithTimeout<SystemUser>(
        query(collection(db, USERS_COLLECTION), where('__name__', '==', userId)),
        15000
      );
      
      if (snapshot.length === 0) return null;
      
      const userData = snapshot[0];
      return {
        ...userData,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt,
        lastLogin: userData.lastLogin
      };
    } catch (error: any) {
      if (isFirestoreOfflineError(error)) {
        console.warn(`[UsersService] Firestore offline, cannot fetch user ${userId}`);
        return null;
      }
      console.error('Error fetching user by ID:', error);
      throw error;
    }
  }

  // Get user by username
  static async getUserByUsername(username: string): Promise<SystemUser | null> {
    try {
      const q = query(collection(db, USERS_COLLECTION), where('username', '==', username));
      
      // Use robust helper
      const users = await getDocsWithTimeout<SystemUser>(q, 15000);
      
      if (users.length === 0) return null;
      
      const user = users[0];
      return {
        ...user,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLogin: user.lastLogin
      };

    } catch (error: any) {
      if (isFirestoreOfflineError(error)) {
        console.warn(`[UsersService] Firestore offline, cannot fetch user ${username}`);
        return null; // Return null on offline error to allow login page to function
      }
      console.error('Error fetching user by username:', error);
      throw error; // Re-throw other errors
    }
  }

  // Authenticate user
  static async authenticateUser(username: string, password: string): Promise<SystemUser | null> {
    try {
      // Try direct username lookup first
      let user = await this.getUserByUsername(username);
      
      // If not found and this might be a parent login attempt, try alternative lookup methods
      if (!user) {
        
        // Method 1: Try new simple format generation (MUK12 style)
        const PupilsService = (await import('./pupils.service')).PupilsService;
        try {
          // 🚀 OPTIMIZED: Use database-level filtering instead of fetching all pupils
          const pupil = await PupilsService.getPupilByAdmissionNumber(password);
          
          if (pupil) {
            console.log('Found pupil by admission number:', pupil.admissionNumber);
            
            // Generate the simple username format for this pupil
            const surnamePrefix = pupil.lastName.substring(0, 3).toUpperCase();
            let birthYearSuffix = '';
            if (pupil.dateOfBirth) {
              const birthYear = new Date(pupil.dateOfBirth).getFullYear();
              birthYearSuffix = birthYear.toString().slice(-2);
            } else {
              birthYearSuffix = new Date().getFullYear().toString().slice(-2);
            }
            const simpleUsername = `${surnamePrefix}${birthYearSuffix}`;
            
            // Try the simple format and its variations
            const simpleVariations = [
              simpleUsername,
              `${simpleUsername}1`,
              `${simpleUsername}2`,
              `${simpleUsername}3`,
            ];
            
            console.log('Trying simple format variations:', simpleVariations);
            
            for (const variation of simpleVariations) {
              user = await this.getUserByUsername(variation);
              if (user && user.pupilId === pupil.id) {
                console.log('Found user with simple format:', variation);
                break;
              }
            }
          }
        } catch (error) {
          console.error('Error in simple format lookup:', error);
        }
        
        // Method 2: Try admission number-based lookup (old format)
        if (!user) {
          const admissionBasedUsername = `parent_${password.toLowerCase()}`;
          user = await this.getUserByUsername(admissionBasedUsername);
          console.log('Admission-based lookup result:', user ? 'Found' : 'Not found');
        }
        
        // Method 3: Try pupil name variations (legacy compatibility)
        if (!user) {
          console.log('Trying pupil name-based lookup...');
          
          try {
            // 🚀 OPTIMIZED: Use database-level filtering instead of fetching all pupils
            const pupil = await PupilsService.getPupilByAdmissionNumber(password);
            
            if (pupil) {
              console.log('Found pupil for name-based lookup:', pupil.admissionNumber);
              
              // Try multiple username variations for backward compatibility
              const nameVariations = [
                // Original format: firstnamelastname (no spaces, lowercase)
                `${pupil.firstName}${pupil.lastName}${pupil.otherNames || ''}`.replace(/\s+/g, '').toLowerCase(),
                // Alternative format: firstname.lastname
                `${pupil.firstName}.${pupil.lastName}`.replace(/\s+/g, '').toLowerCase(),
                // Alternative format: just firstname and lastname
                `${pupil.firstName}${pupil.lastName}`.replace(/\s+/g, '').toLowerCase(),
              ];
              
              console.log('Trying name variations:', nameVariations);
              
              for (const nameVariation of nameVariations) {
                user = await this.getUserByUsername(nameVariation);
                if (user) {
                  console.log('Found user with name variation:', nameVariation);
                  break;
                }
              }
            }
          } catch (error) {
            console.error('Error in pupil-based lookup:', error);
            // Continue with authentication process
          }
        }
      }
      
      if (!user) {
        return null;
      }
      
      if (!user.isActive) {
        return null;
      }
      
      if (user.passwordHash) {
        // Try new salted hash first
        if (verifyPassword(password, user.passwordHash)) {
          await this.updateLastLogin(user.id);
          return user;
        }
        
        // If new method fails, and user is 'admin', try old unsalted method as a fallback
        if (user.username.toLowerCase() === 'admin') {
          const oldUnsaltedHash = btoa(password); // Simple base64
          if (oldUnsaltedHash === user.passwordHash) {
            // IMPORTANT: Re-hash and save password with the new method
            const newSaltedHash = hashPassword(password);
            await this.updateUser(user.id, { passwordHash: newSaltedHash });
            await this.updateLastLogin(user.id);
            return user;
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error authenticating user:', error);
      throw error;
    }
  }

  // Update user
  static async updateUser(userId: string, updates: Partial<SystemUser> & { password?: string }): Promise<void> {
    try {
      const { password, ...updatesWithoutPassword } = updates;
      
      const updateData = {
        ...updatesWithoutPassword,
        ...(password && { passwordHash: hashPassword(password) }),
        updatedAt: Timestamp.now()
      };
      
      const cleanedData = cleanUndefinedValues(updateData);
      const docRef = doc(db, USERS_COLLECTION, userId);
      await updateDoc(docRef, cleanedData);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  // Update last login
  static async updateLastLogin(userId: string): Promise<void> {
    try {
      const docRef = doc(db, USERS_COLLECTION, userId);
      await updateDoc(docRef, {
        lastLogin: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating last login:', error);
      throw error;
    }
  }

  // Delete user
  static async deleteUser(userId: string): Promise<void> {
    try {
      const docRef = doc(db, USERS_COLLECTION, userId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  // Create parent account for pupil
  static async createParentAccount(pupilId: string, pupilName: string, admissionNumber: string, guardianId?: string): Promise<string> {
    try {
      // Get the pupil to extract family information
      const PupilsService = (await import('./pupils.service')).PupilsService;
      const pupil = await PupilsService.getPupilById(pupilId);
      
      if (!pupil) {
        throw new Error(`Pupil with ID ${pupilId} not found`);
      }
      
      // IMPROVED: Generate simple, user-friendly username
      // Format: First 3 letters of surname + last 2 digits of birth year (e.g., MUK12)
      const generateSimpleUsername = (pupil: any): string => {
        // Get first 3 letters of surname, uppercase
        const surnamePrefix = pupil.lastName.substring(0, 3).toUpperCase();
        
        // Get last 2 digits of birth year
        let birthYearSuffix = '';
        if (pupil.dateOfBirth) {
          const birthYear = new Date(pupil.dateOfBirth).getFullYear();
          birthYearSuffix = birthYear.toString().slice(-2);
        } else {
          // Fallback to current year if no birth date
          birthYearSuffix = new Date().getFullYear().toString().slice(-2);
        }
        
        return `${surnamePrefix}${birthYearSuffix}`;
      };
      
      // Generate base username
      let username = generateSimpleUsername(pupil);
      
      // Handle potential collisions by adding a suffix
      let finalUsername = username;
      let collision = await this.getUserByUsername(finalUsername);
      let suffix = 1;
      
      while (collision && collision.pupilId !== pupilId) {
        finalUsername = `${username}${suffix}`;
        collision = await this.getUserByUsername(finalUsername);
        suffix++;
        
        // Safety check to prevent infinite loop
        if (suffix > 99) {
          // Fallback to admission number-based username
          finalUsername = `P${admissionNumber.slice(-4)}`;
          break;
        }
      }
      
      // If user already exists for this pupil, return error
      if (collision && collision.pupilId === pupilId) {
        throw new Error(`Parent account already exists for pupil: ${pupil.firstName} ${pupil.lastName}`);
      }
      
      console.log(`Generated parent username: ${finalUsername} for pupil: ${pupil.firstName} ${pupil.lastName}`);
      
      // Generate familyId if pupil doesn't have one
      let familyIdToUse = pupil.familyId;
      if (!familyIdToUse) {
        // Generate a new familyId based on pupil's last name and admission number
        familyIdToUse = `fam-${pupil.lastName.toLowerCase()}-${pupil.admissionNumber.toLowerCase()}`;
        
        // Update the pupil with the new familyId
        await PupilsService.updatePupil(pupilId, { familyId: familyIdToUse });
      }
      
      const parentUser: Omit<SystemUser, 'id' | 'createdAt'> & { password: string } = {
        username: finalUsername, // Now uses simple format like "MUK12"
        role: 'Parent',
        isActive: true,
        pupilId, // Keep for backward compatibility
        familyId: familyIdToUse, // Primary family link
        guardianId,
        password: admissionNumber, // Default password is admission number
        
        // Store additional metadata for easier identification
        firstName: 'Parent',
        lastName: `of ${pupil.firstName} ${pupil.lastName}`,
        email: undefined, // Parents typically don't have email in this system
      };
      
      return await this.createUser(parentUser);
    } catch (error) {
      console.error('Error creating parent account:', error);
      throw error;
    }
  }

  // Create bulk parent accounts for multiple pupils
  static async createBulkParentAccounts(pupilIds: string[], guardianId?: string): Promise<{
    success: Array<{
      userId: string;
      pupilId: string;
      pupilName: string;
      admissionNumber: string;
      username: string;
    }>;
    failed: Array<{
      pupilId: string;
      error: string;
    }>;
    total: number;
    successCount: number;
    failedCount: number;
  }> {
    try {
      const PupilsService = (await import('./pupils.service')).PupilsService;
      const results = {
        success: [] as Array<{
          userId: string;
          pupilId: string;
          pupilName: string;
          admissionNumber: string;
          username: string;
        }>,
        failed: [] as Array<{
          pupilId: string;
          error: string;
        }>,
        total: pupilIds.length,
        successCount: 0,
        failedCount: 0
      };

      // Process each pupil sequentially to avoid conflicts
      for (const pupilId of pupilIds) {
        try {
          const pupil = await PupilsService.getPupilById(pupilId);
          
          if (!pupil) {
            results.failed.push({
              pupilId,
              error: 'Pupil not found'
            });
            results.failedCount++;
            continue;
          }

          // Check if parent account already exists
          const existingUsers = await this.getAllUsers();
          const existingParent = existingUsers.find(user => 
            user.role === 'Parent' && user.pupilId === pupilId
          );

          if (existingParent) {
            results.failed.push({
              pupilId,
              error: `Parent account already exists for ${pupil.firstName} ${pupil.lastName}`
            });
            results.failedCount++;
            continue;
          }

          // Generate simple username
          const generateSimpleUsername = (pupil: any): string => {
            const surnamePrefix = pupil.lastName.substring(0, 3).toUpperCase();
            let birthYearSuffix = '';
            if (pupil.dateOfBirth) {
              const birthYear = new Date(pupil.dateOfBirth).getFullYear();
              birthYearSuffix = birthYear.toString().slice(-2);
            } else {
              birthYearSuffix = new Date().getFullYear().toString().slice(-2);
            }
            return `${surnamePrefix}${birthYearSuffix}`;
          };

          let username = generateSimpleUsername(pupil);
          let finalUsername = username;
          let collision = await this.getUserByUsername(finalUsername);
          let suffix = 1;

          while (collision && collision.pupilId !== pupilId) {
            finalUsername = `${username}${suffix}`;
            collision = await this.getUserByUsername(finalUsername);
            suffix++;
            
            if (suffix > 99) {
              finalUsername = `P${pupil.admissionNumber.slice(-4)}`;
              break;
            }
          }

          // Generate familyId if pupil doesn't have one
          let familyIdToUse = pupil.familyId;
          if (!familyIdToUse) {
            familyIdToUse = `fam-${pupil.lastName.toLowerCase()}-${pupil.admissionNumber.toLowerCase()}`;
            await PupilsService.updatePupil(pupilId, { familyId: familyIdToUse });
          }

          const parentUser: Omit<SystemUser, 'id' | 'createdAt'> & { password: string } = {
            username: finalUsername,
            role: 'Parent',
            isActive: true,
            pupilId,
            familyId: familyIdToUse,
            guardianId,
            password: pupil.admissionNumber,
            firstName: 'Parent',
            lastName: `of ${pupil.firstName} ${pupil.lastName}`,
            email: undefined,
          };

          const userId = await this.createUser(parentUser);
          
          results.success.push({
            userId,
            pupilId,
            pupilName: `${pupil.firstName} ${pupil.lastName}`,
            admissionNumber: pupil.admissionNumber,
            username: finalUsername
          });
          results.successCount++;

        } catch (error: any) {
          results.failed.push({
            pupilId,
            error: error.message || 'Unknown error occurred'
          });
          results.failedCount++;
        }
      }

      return results;
    } catch (error) {
      console.error('Error creating bulk parent accounts:', error);
      throw error;
    }
  }

  // Create staff account
  static async createStaffAccount(
    staffId: string, 
    username: string, 
    firstName: string, 
    lastName: string,
    email: string,
    modulePermissions: ModulePermission[],
    password: string,
    granularPermissions?: ModulePermissions[]
  ): Promise<string> {
    try {
      // Check if username already exists
      const existingUser = await this.getUserByUsername(username);
      if (existingUser) {
        throw new Error(`Username ${username} already exists`);
      }
      
      const staffUser: Omit<SystemUser, 'id' | 'createdAt'> & { password: string } = {
        username,
        email,
        role: 'Staff',
        isActive: true,
        staffId,
        firstName,
        lastName,
        modulePermissions,
        granularPermissions,
        password
      };
      
      return await this.createUser(staffUser);
    } catch (error) {
      console.error('Error creating staff account:', error);
      throw error;
    }
  }

  // Get user permissions for a module
  static getUserModulePermission(user: SystemUser, module: string): 'view_only' | 'edit' | 'full_access' | null {
    if (user.role === 'Admin') return 'full_access';
    if (user.role === 'Parent') return null; // Parents have no module access
    
    // Check granular permissions first
    if (user.granularPermissions) {
      const modulePerms = user.granularPermissions.find(m => m.moduleId === module);
      if (modulePerms && modulePerms.pages.some(p => p.canAccess)) {
        // For granular permissions, we need to determine the permission level
        // by checking what actions are allowed across all pages
        let hasEditActions = false;
        let hasDeleteActions = false;
        
        modulePerms.pages.forEach(page => {
          if (page.canAccess) {
            page.actions.forEach(action => {
              if (action.allowed) {
                // Check if this is an edit action
                if (action.actionId.includes('edit') || action.actionId.includes('update') || action.actionId.includes('create')) {
                  hasEditActions = true;
                }
                // Check if this is a delete action
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
    }
    
    // Fallback to legacy permissions
    if (user.role === 'Staff' && user.modulePermissions) {
      const modulePermission = user.modulePermissions.find(mp => mp.module === module);
      return modulePermission?.permission || null;
    }
    
    return null;
  }

  // Check if user can access a module
  static canUserAccessModule(user: SystemUser, module: string): boolean {
    if (user.role === 'Admin') return true;
    if (user.role === 'Parent') return false;
    
    // Check granular permissions first
    if (user.granularPermissions) {
      const modulePerms = user.granularPermissions.find(m => m.moduleId === module);
      if (modulePerms) {
        // User has access if they can access at least one page in the module
        return modulePerms.pages.some(p => p.canAccess);
      }
    }
    
    // Fallback to legacy permissions
    return this.getUserModulePermission(user, module) !== null;
  }

  // Check if user can edit in a module
  static canUserEdit(user: SystemUser, module: string): boolean {
    const permission = this.getUserModulePermission(user, module);
    return permission === 'edit' || permission === 'full_access';
  }

  // Check if user can delete in a module
  static canUserDelete(user: SystemUser, module: string): boolean {
    const permission = this.getUserModulePermission(user, module);
    return permission === 'full_access';
  }

  // UTILITY: Migrate existing parent accounts to new username format
  static async migrateParentAccountUsername(userId: string, pupil: any): Promise<void> {
    try {
      // Generate the new simple username format
      const surnamePrefix = pupil.lastName.substring(0, 3).toUpperCase();
      let birthYearSuffix = '';
      if (pupil.dateOfBirth) {
        const birthYear = new Date(pupil.dateOfBirth).getFullYear();
        birthYearSuffix = birthYear.toString().slice(-2);
      } else {
        birthYearSuffix = new Date().getFullYear().toString().slice(-2);
      }
      
      let newUsername = `${surnamePrefix}${birthYearSuffix}`;
      
      // Handle potential collisions
      let finalUsername = newUsername;
      let collision = await this.getUserByUsername(finalUsername);
      let suffix = 1;
      
      while (collision && collision.id !== userId) {
        finalUsername = `${newUsername}${suffix}`;
        collision = await this.getUserByUsername(finalUsername);
        suffix++;
        
        // Safety check
        if (suffix > 99) {
          finalUsername = `P${pupil.admissionNumber.slice(-4)}`;
          break;
        }
      }
      
      // Update the username
      await this.updateUser(userId, { username: finalUsername });
      console.log(`Successfully migrated parent account ${userId} to username: ${finalUsername}`);
    } catch (error) {
      console.error('Error migrating parent account username:', error);
      throw error;
    }
  }

  // UTILITY: Fix all existing parent accounts to use admission-based usernames
  static async fixExistingParentAccounts(): Promise<{ success: number, failed: number, details: string[] }> {
    try {
      const allUsers = await this.getAllUsers();
      const parentUsers = allUsers.filter(user => user.role === 'Parent');
      
      const results = {
        success: 0,
        failed: 0,
        details: [] as string[]
      };

      for (const parentUser of parentUsers) {
        try {
          // Skip if already using new simple format (5 characters like MUK12)
          if (parentUser.username.length === 5 && /^[A-Z]{3}\d{2}$/.test(parentUser.username)) {
            results.details.push(`Skipped ${parentUser.username} - already using new simple format`);
            continue;
          }

          // Get the linked pupil to find surname and birth year
          if (parentUser.pupilId) {
            const PupilsService = (await import('./pupils.service')).PupilsService;
            const pupil = await PupilsService.getPupilById(parentUser.pupilId);
            
            if (pupil && pupil.lastName && pupil.dateOfBirth) {
              // Generate new simple username format
              const surnamePrefix = pupil.lastName.substring(0, 3).toUpperCase();
              const birthYear = new Date(pupil.dateOfBirth).getFullYear();
              const birthYearSuffix = birthYear.toString().slice(-2);
              const newSimpleFormat = `${surnamePrefix}${birthYearSuffix}`;
              
              await this.migrateParentAccountUsername(parentUser.id, pupil);
              results.success++;
              results.details.push(`✅ Migrated ${parentUser.username} → ${newSimpleFormat}`);
            } else {
              results.failed++;
              results.details.push(`❌ Failed to migrate ${parentUser.username} - pupil not found or missing data`);
            }
          } else {
            results.failed++;
            results.details.push(`❌ Failed to migrate ${parentUser.username} - no linked pupil`);
          }
        } catch (error) {
          results.failed++;
          results.details.push(`❌ Failed to migrate ${parentUser.username} - ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return results;
    } catch (error) {
      console.error('Error fixing existing parent accounts:', error);
      throw error;
    }
  }
} 