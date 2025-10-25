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
  limit,
  startAfter,
  DocumentSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { ClassesService } from './classes.service';
import type { Pupil } from '@/types';

const COLLECTION_NAME = 'pupils';

export class PupilsService {
  static async getAllPupils(): Promise<Pupil[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('lastName', 'asc'));
      const querySnapshot = await getDocs(q);
      
      const pupils = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Pupil[];

      // Populate class names for pupils that have classId
      const populatedPupils = await Promise.all(
        pupils.map(async (pupil) => {
          if (pupil.classId) {
            try {
              const classData = await ClassesService.getById(pupil.classId);
              if (classData) {
                pupil.className = classData.name;
                pupil.classCode = classData.code;
              }
            } catch (classError) {
              console.warn('Error fetching class data for pupil:', classError);
              // Continue without class name
            }
          }
          return pupil;
        })
      );

      return populatedPupils;
    } catch (error) {
      console.error('Error fetching pupils:', error);
      throw error;
    }
  }

  static async getPupilById(id: string): Promise<Pupil | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const pupilData = {
          id: docSnap.id,
          ...docSnap.data()
        } as Pupil;

        // If pupil has a classId, fetch the class information to populate className
        if (pupilData.classId) {
          try {
            const classData = await ClassesService.getById(pupilData.classId);
            if (classData) {
              pupilData.className = classData.name;
              pupilData.classCode = classData.code;
            }
          } catch (classError) {
            console.warn('Error fetching class data for pupil:', classError);
            // Don't throw here, just continue without class name
          }
        }

        return pupilData;
      }
      return null;
    } catch (error) {
      console.error('Error fetching pupil by ID:', error);
      throw error;
    }
  }

  static async createPupil(pupilData: Omit<Pupil, 'id' | 'createdAt'>): Promise<string> {
    try {
      const newPupil = {
        ...pupilData,
        createdAt: new Date().toISOString()
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(newPupil);
      
      const docRef = await addDoc(collection(db, COLLECTION_NAME), cleanedData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating pupil:', error);
      throw error;
    }
  }

  static async updatePupil(id: string, pupilData: Partial<Omit<Pupil, 'id' | 'createdAt'>>): Promise<void> {
    try {
      // Get original pupil data for cache invalidation
      const originalPupil = await this.getPupilById(id);
      
      const docRef = doc(db, COLLECTION_NAME, id);
      const updateData = {
        ...pupilData,
        updatedAt: new Date().toISOString()
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(updateData);
      
      await updateDoc(docRef, cleanedData);

      // 🔥 INVALIDATE CACHE: If class or section changed, clear cache for affected groups
      if (originalPupil && (pupilData.classId || pupilData.section)) {
        try {
          const { feeGroupCacheService } = await import('@/lib/services/fee-group-cache.service');
          
          const classChanged = pupilData.classId && pupilData.classId !== originalPupil.classId;
          const sectionChanged = pupilData.section && pupilData.section !== originalPupil.section;
          
          if (classChanged || sectionChanged) {
            // Clear all cache since pupil group memberships changed
            feeGroupCacheService.clearCache();
            console.log('🔄 Full cache cleared due to pupil class/section change:', {
              pupilId: id,
              oldClass: originalPupil.classId,
              newClass: pupilData.classId,
              oldSection: originalPupil.section,
              newSection: pupilData.section
            });
          }
        } catch (cacheError) {
          console.warn('Cache invalidation failed for pupil update:', cacheError);
        }
      }
    } catch (error) {
      console.error('Error updating pupil:', error);
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

  static async deletePupil(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting pupil:', error);
      throw error;
    }
  }

  static async getPupilsByClass(classId: string): Promise<Pupil[]> {
    try {
      console.log('🔍 Fetching pupils for class (index-free):', classId);
      
      // Use simple query without ORDER BY to avoid index requirements
      // while Firebase index is building
      const q = query(
        collection(db, COLLECTION_NAME), 
        where('classId', '==', classId)
        // Removed orderBy to avoid index requirement while building
      );
      const querySnapshot = await getDocs(q);
      
      let pupils = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Pupil[];

      console.log(`📊 Fetched ${pupils.length} pupils for class ${classId}`);

      // Sort on client-side instead of database to avoid index requirement
      pupils.sort((a, b) => {
        const aLastName = (a.lastName || '').toLowerCase();
        const bLastName = (b.lastName || '').toLowerCase();
        return aLastName.localeCompare(bLastName);
      });

      console.log('✅ Sorted pupils by lastName on client-side');

      // Populate class names for pupils
      const populatedPupils = await Promise.all(
        pupils.map(async (pupil) => {
          if (pupil.classId) {
            try {
              const classData = await ClassesService.getById(pupil.classId);
              if (classData) {
                pupil.className = classData.name;
                pupil.classCode = classData.code;
              }
            } catch (classError) {
              console.warn('Error fetching class data for pupil:', classError);
              // Continue without class name
            }
          }
          return pupil;
        })
      );

      console.log(`✅ Successfully loaded and populated ${populatedPupils.length} pupils`);
      return populatedPupils;
    } catch (error) {
      console.error('❌ Error fetching pupils by class:', error);
      
      // If even the simple query fails, log the error and return empty array
      // rather than crashing the entire application
      console.log('🔄 Query failed, returning empty array to prevent crash');
      return [];
    }
  }

  // 🚀 ENHANCED: Database-level filtering for class-based queries with optional filters
  // Prioritizes database-level filtering for better performance
  static async getPupilsByClassWithFilters(
    classId: string, 
    filters?: {
      status?: string;
      section?: string;
      gender?: string;
    }
  ): Promise<Pupil[]> {
    try {
      console.log('🔍 Fetching pupils for class with filters:', { classId, filters });
      
      // 🚀 OPTIMIZATION: If only status filter is provided, use database-level filtering
      if (filters?.status && filters.status !== 'all' && 
          (!filters.section || filters.section === 'all') && 
          (!filters.gender || filters.gender === 'all')) {
        console.log(`⚡ Using DATABASE-LEVEL status filter for class ${classId}`);
        return await this.getPupilsByClassAndStatus(classId, filters.status);
      }

      // 🚀 OPTIMIZATION: If status is 'Active' or only active pupils needed, use optimized query
      const effectiveStatus = filters?.status || 'Active';
      const needsDatabaseFilter = effectiveStatus !== 'all';

      let pupils: Pupil[];

      if (needsDatabaseFilter && effectiveStatus === 'Active') {
        // Use optimized database query for active pupils
        console.log(`⚡ Using DATABASE-LEVEL active pupils filter for class ${classId}`);
        try {
          pupils = await this.getActivePupilsByClass(classId);
        } catch (dbError) {
          console.warn('⚠️ Database-level query failed, falling back to client-side filter');
          const allPupils = await this.getPupilsByClass(classId);
          pupils = allPupils.filter(p => p.status === 'Active');
        }
      } else if (needsDatabaseFilter && effectiveStatus !== 'all') {
        // Use database-level status filter
        console.log(`⚡ Using DATABASE-LEVEL status filter (${effectiveStatus}) for class ${classId}`);
        try {
          pupils = await this.getPupilsByClassAndStatus(classId, effectiveStatus);
        } catch (dbError) {
          console.warn('⚠️ Database-level status query failed, falling back to client-side filter');
          const allPupils = await this.getPupilsByClass(classId);
          pupils = allPupils.filter(p => p.status === effectiveStatus);
        }
      } else {
        // Fetch all pupils for the class (no status filter or status='all')
        console.log(`📊 Fetching all pupils for class ${classId} (no status filter)`);
        pupils = await this.getPupilsByClass(classId);
      }

      console.log(`📊 After database query: ${pupils.length} pupils`);

      // Apply remaining filters on client-side (section, gender)
      if (filters?.section && filters.section !== 'all') {
        pupils = pupils.filter(pupil => 
          pupil.section?.toLowerCase() === filters.section?.toLowerCase()
        );
        console.log(`🎯 After section filter (${filters.section}): ${pupils.length} pupils`);
      }

      if (filters?.gender && filters.gender !== 'all') {
        pupils = pupils.filter(pupil => 
          pupil.gender?.toLowerCase() === filters.gender?.toLowerCase()
        );
        console.log(`🎯 After gender filter (${filters.gender}): ${pupils.length} pupils`);
      }

      console.log(`✅ Final result: ${pupils.length} pupils after all filters`);
      return pupils;
    } catch (error) {
      console.error('❌ Error fetching pupils by class with filters:', error);
      
      // Fallback to basic class query if filters fail
      console.log('🔄 Falling back to basic class query without filters...');
      try {
        return await this.getPupilsByClass(classId);
      } catch (fallbackError) {
        console.error('❌ Fallback query also failed:', fallbackError);
        throw error; // Throw original error
      }
    }
  }

  // Optimized method for getting pupils with minimal data (for performance)
  static async getPupilsMinimal(classId?: string): Promise<Pick<Pupil, 'id' | 'firstName' | 'lastName' | 'admissionNumber' | 'classId' | 'status'>[]> {
    try {
      let q;
      if (classId && classId !== 'all') {
        q = query(
          collection(db, COLLECTION_NAME), 
          where('classId', '==', classId),
          orderBy('lastName', 'asc')
        );
      } else {
        q = query(collection(db, COLLECTION_NAME), orderBy('lastName', 'asc'));
      }

      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          admissionNumber: data.admissionNumber || '',
          classId: data.classId || '',
          status: data.status || 'Active'
        };
      });
    } catch (error) {
      console.error('Error fetching minimal pupils data:', error);
      throw error;
    }
  }

  static async getPupilsByFamily(familyId: string): Promise<Pupil[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME), 
        where('familyId', '==', familyId)
      );
      const querySnapshot = await getDocs(q);
      
      const pupils = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Pupil[];

      // Populate class names for pupils that have classId
      const populatedPupils = await Promise.all(
        pupils.map(async (pupil) => {
          if (pupil.classId) {
            try {
              const classData = await ClassesService.getById(pupil.classId);
              if (classData) {
                pupil.className = classData.name;
                pupil.classCode = classData.code;
              }
            } catch (classError) {
              console.warn('Error fetching class data for pupil:', classError);
              // Continue without class name
            }
          }
          return pupil;
        })
      );

      // Sort by date of birth on client side to avoid composite index requirement
      return populatedPupils.sort((a, b) => {
        if (!a.dateOfBirth || !b.dateOfBirth) return 0;
        return new Date(a.dateOfBirth).getTime() - new Date(b.dateOfBirth).getTime();
      });
    } catch (error) {
      console.error('Error fetching pupils by family:', error);
      throw error;
    }
  }

  static async searchPupils(searchTerm: string): Promise<Pupil[]> {
    try {
      // Note: This is a simple implementation. For better search, consider using Algolia or similar
      const q = query(collection(db, COLLECTION_NAME), orderBy('lastName', 'asc'));
      const querySnapshot = await getDocs(q);
      
      const allPupils = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Pupil[];

      // Filter on client side for now
      return allPupils.filter(pupil => 
        pupil.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pupil.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pupil.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } catch (error) {
      console.error('Error searching pupils:', error);
      throw error;
    }
  }

  // 🚀 NEW: Database-level filtering methods for better performance
  static async getPupilByAdmissionNumber(admissionNumber: string): Promise<Pupil | null> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME), 
        where('admissionNumber', '==', admissionNumber),
        limit(1)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      const pupilData = {
        id: doc.id,
        ...doc.data()
      } as Pupil;

      // If pupil has a classId, fetch the class information
      if (pupilData.classId) {
        try {
          const classData = await ClassesService.getById(pupilData.classId);
          if (classData) {
            pupilData.className = classData.name;
            pupilData.classCode = classData.code;
          }
        } catch (classError) {
          console.warn('Error fetching class data for pupil:', classError);
        }
      }

      return pupilData;
    } catch (error) {
      console.error('Error fetching pupil by admission number:', error);
      throw error;
    }
  }

  static async getPupilsByIds(pupilIds: string[]): Promise<Pupil[]> {
    try {
      if (pupilIds.length === 0) return [];
      
      // Firebase 'in' operator has a limit of 10 items, so we need to batch
      const batches = [];
      const batchSize = 10;
      
      for (let i = 0; i < pupilIds.length; i += batchSize) {
        const batch = pupilIds.slice(i, i + batchSize);
        const q = query(
          collection(db, COLLECTION_NAME),
          where('__name__', 'in', batch)
        );
        batches.push(getDocs(q));
      }
      
      const querySnapshots = await Promise.all(batches);
      const pupils: Pupil[] = [];
      
      for (const querySnapshot of querySnapshots) {
        for (const doc of querySnapshot.docs) {
          const pupilData = {
            id: doc.id,
            ...doc.data()
          } as Pupil;

          // Populate class names if available
          if (pupilData.classId) {
            try {
              const classData = await ClassesService.getById(pupilData.classId);
              if (classData) {
                pupilData.className = classData.name;
                pupilData.classCode = classData.code;
              }
            } catch (classError) {
              console.warn('Error fetching class data for pupil:', classError);
            }
          }
          
          pupils.push(pupilData);
        }
      }
      
      return pupils;
    } catch (error) {
      console.error('Error fetching pupils by IDs:', error);
      throw error;
    }
  }

  // 🚀 DATABASE-LEVEL FILTERING: Fetch only active pupils from database
  static async getActivePupils(): Promise<Pupil[]> {
    try {
      console.log('🎯 Fetching ONLY active pupils from database (optimized)');
      
      const q = query(
        collection(db, COLLECTION_NAME), 
        where('status', '==', 'Active'),
        orderBy('lastName', 'asc')
      );
      const querySnapshot = await getDocs(q);
      
      const pupils = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Pupil[];

      console.log(`✅ Fetched ${pupils.length} active pupils directly from database`);

      // Populate class names for pupils that have classId
      const populatedPupils = await Promise.all(
        pupils.map(async (pupil) => {
          if (pupil.classId) {
            try {
              const classData = await ClassesService.getById(pupil.classId);
              if (classData) {
                pupil.className = classData.name;
                pupil.classCode = classData.code;
              }
            } catch (classError) {
              console.warn('Error fetching class data for pupil:', classError);
            }
          }
          return pupil;
        })
      );

      return populatedPupils;
    } catch (error) {
      console.error('Error fetching active pupils:', error);
      throw error;
    }
  }

  // 🚀 DATABASE-LEVEL FILTERING: Fetch pupils by status (Active, Inactive, etc.)
  static async getPupilsByStatus(status: string): Promise<Pupil[]> {
    try {
      console.log(`🎯 Fetching pupils with status: ${status} from database (optimized)`);
      
      const q = query(
        collection(db, COLLECTION_NAME), 
        where('status', '==', status),
        orderBy('lastName', 'asc')
      );
      const querySnapshot = await getDocs(q);
      
      const pupils = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Pupil[];

      console.log(`✅ Fetched ${pupils.length} pupils with status ${status} from database`);

      // Populate class names
      const populatedPupils = await Promise.all(
        pupils.map(async (pupil) => {
          if (pupil.classId) {
            try {
              const classData = await ClassesService.getById(pupil.classId);
              if (classData) {
                pupil.className = classData.name;
                pupil.classCode = classData.code;
              }
            } catch (classError) {
              console.warn('Error fetching class data for pupil:', classError);
            }
          }
          return pupil;
        })
      );

      return populatedPupils;
    } catch (error) {
      console.error(`Error fetching pupils by status ${status}:`, error);
      throw error;
    }
  }

  // 🚀 DATABASE-LEVEL FILTERING: Fetch active pupils for a specific class
  static async getActivePupilsByClass(classId: string): Promise<Pupil[]> {
    try {
      console.log(`🎯 Fetching ACTIVE pupils for class ${classId} from database (optimized)`);
      
      const q = query(
        collection(db, COLLECTION_NAME), 
        where('classId', '==', classId),
        where('status', '==', 'Active')
      );
      const querySnapshot = await getDocs(q);
      
      let pupils = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Pupil[];

      console.log(`✅ Fetched ${pupils.length} active pupils for class ${classId} from database`);

      // Sort on client-side to avoid requiring a composite index
      pupils.sort((a, b) => {
        const aLastName = (a.lastName || '').toLowerCase();
        const bLastName = (b.lastName || '').toLowerCase();
        return aLastName.localeCompare(bLastName);
      });

      // Populate class names
      const populatedPupils = await Promise.all(
        pupils.map(async (pupil) => {
          if (pupil.classId) {
            try {
              const classData = await ClassesService.getById(pupil.classId);
              if (classData) {
                pupil.className = classData.name;
                pupil.classCode = classData.code;
              }
            } catch (classError) {
              console.warn('Error fetching class data for pupil:', classError);
            }
          }
          return pupil;
        })
      );

      return populatedPupils;
    } catch (error) {
      console.error(`Error fetching active pupils by class ${classId}:`, error);
      // Fallback to fetching all pupils for the class if the composite query fails
      console.log('⚠️ Falling back to fetching all pupils for class and filtering...');
      const allClassPupils = await this.getPupilsByClass(classId);
      return allClassPupils.filter(p => p.status === 'Active');
    }
  }

  // 🚀 ENHANCED: Database-level filtering with multiple where clauses
  // Note: This uses simple queries to avoid complex composite index requirements
  static async getPupilsByClassAndStatus(classId: string, status: string): Promise<Pupil[]> {
    try {
      console.log(`🎯 Fetching pupils for class ${classId} with status ${status} (database-level)`);
      
      const q = query(
        collection(db, COLLECTION_NAME), 
        where('classId', '==', classId),
        where('status', '==', status)
      );
      const querySnapshot = await getDocs(q);
      
      let pupils = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Pupil[];

      console.log(`✅ Fetched ${pupils.length} pupils with status ${status} for class ${classId}`);

      // Sort on client-side
      pupils.sort((a, b) => {
        const aLastName = (a.lastName || '').toLowerCase();
        const bLastName = (b.lastName || '').toLowerCase();
        return aLastName.localeCompare(bLastName);
      });

      // Populate class names
      const populatedPupils = await Promise.all(
        pupils.map(async (pupil) => {
          if (pupil.classId) {
            try {
              const classData = await ClassesService.getById(pupil.classId);
              if (classData) {
                pupil.className = classData.name;
                pupil.classCode = classData.code;
              }
            } catch (classError) {
              console.warn('Error fetching class data for pupil:', classError);
            }
          }
          return pupil;
        })
      );

      return populatedPupils;
    } catch (error) {
      console.error(`Error fetching pupils by class and status:`, error);
      throw error;
    }
  }
} 