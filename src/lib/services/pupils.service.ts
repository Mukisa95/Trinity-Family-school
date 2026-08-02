import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  orderBy,
  where,
  limit,
  startAfter,
  DocumentSnapshot,
  QuerySnapshot,
  Timestamp,
  documentId,
  getDocsFromCache,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ClassesService } from './classes.service';
import type { Pupil } from '@/types';
import { HousesService } from './houses.service';
import {
  getDocWithTimeout,
  getDocsFromServerWithTimeout,
  getDocsWithTimeout,
} from '../utils/firestore-helpers';
import { HistoryLogService } from './history-log.service';
import { reservePupilsRevisionInTransaction } from './dashboard-cache-revisions.service';
import { normalisePupils } from '../cache/pupil-cache';

const COLLECTION_NAME = 'pupils';
const CACHE_CHANGES_COLLECTION = 'pupilCacheChanges';

export type PupilCacheChange = {
  id: string;
  revision: number;
  pupilId: string;
  operation: 'upsert' | 'delete';
  changedAt?: unknown;
};

export class PupilsService {
  private static sharedPupils: Pupil[] | null = null;
  private static pendingSharedRefresh: Promise<Pupil[]> | null = null;
  private static pendingSharedRefreshTarget: number | null = null;
  private static sharedReadyPromise: Promise<Pupil[]> | null = null;
  private static resolveSharedReady: ((pupils: Pupil[]) => void) | null = null;
  private static rejectSharedReady: ((error: unknown) => void) | null = null;

  private static waitForSharedPupils(): Promise<Pupil[]> {
    if (!this.sharedReadyPromise) {
      this.sharedReadyPromise = new Promise<Pupil[]>((resolve, reject) => {
        this.resolveSharedReady = resolve;
        this.rejectSharedReady = reject;
      });
    }
    return this.sharedReadyPromise;
  }

  static hydrateSharedPupils(pupils: Pupil[]): void {
    this.sharedPupils = pupils;
    this.resolveSharedReady?.(pupils);
    this.resolveSharedReady = null;
    this.rejectSharedReady = null;
    this.sharedReadyPromise = Promise.resolve(pupils);
  }

  static clearSharedPupils(): void {
    this.resolveSharedReady?.([]);
    this.sharedPupils = null;
    this.pendingSharedRefresh = null;
    this.pendingSharedRefreshTarget = null;
    this.sharedReadyPromise = null;
    this.resolveSharedReady = null;
    this.rejectSharedReady = null;
  }

  static refreshSharedPupils(
    targetRevision: number,
    load: () => Promise<Pupil[]>,
  ): Promise<Pupil[]> {
    if (this.pendingSharedRefresh) {
      if (this.pendingSharedRefreshTarget === targetRevision) return this.pendingSharedRefresh;
      // Revisions can advance while a large cold fetch is in flight. Queue the
      // newer target instead of stamping the older result as the latest cache.
      return this.pendingSharedRefresh
        .catch(() => [])
        .then(() => this.refreshSharedPupils(targetRevision, load));
    }

    const pending = load()
      .catch(error => {
        this.rejectSharedReady?.(error);
        this.sharedReadyPromise = null;
        this.resolveSharedReady = null;
        this.rejectSharedReady = null;
        throw error;
      })
      .finally(() => {
        if (this.pendingSharedRefresh === pending) {
          this.pendingSharedRefresh = null;
          this.pendingSharedRefreshTarget = null;
        }
      });

    this.pendingSharedRefresh = pending;
    this.pendingSharedRefreshTarget = targetRevision;
    return pending;
  }

  static async getAllForCache(): Promise<Pupil[]> {
    const pupils = await getDocsFromServerWithTimeout<Pupil>(
      query(collection(db, COLLECTION_NAME)),
      30000,
    );
    return normalisePupils(pupils);
  }

  static async getAllFromFirestoreCache(): Promise<Pupil[]> {
    try {
      const snapshot = await getDocsFromCache(query(collection(db, COLLECTION_NAME)));
      return normalisePupils(
        snapshot.docs.map(snapshotDoc => ({ id: snapshotDoc.id, ...snapshotDoc.data() }) as Pupil),
      );
    } catch {
      return [];
    }
  }

  static async getCacheChanges(fromRevision: number, toRevision: number): Promise<PupilCacheChange[]> {
    if (toRevision <= fromRevision) return [];
    const changesQuery = query(
      collection(db, CACHE_CHANGES_COLLECTION),
      where('revision', '>', fromRevision),
      where('revision', '<=', toRevision),
      orderBy('revision', 'asc'),
    );
    return getDocsFromServerWithTimeout<PupilCacheChange>(changesQuery, 15000);
  }

  static async getPupilsByIdsForCache(pupilIds: string[]): Promise<Pupil[]> {
    const uniqueIds = Array.from(new Set(pupilIds.filter(Boolean)));
    if (uniqueIds.length === 0) return [];

    const pupils: Pupil[] = [];
    for (let index = 0; index < uniqueIds.length; index += 30) {
      const ids = uniqueIds.slice(index, index + 30);
      pupils.push(...await getDocsFromServerWithTimeout<Pupil>(
        query(collection(db, COLLECTION_NAME), where(documentId(), 'in', ids)),
        15000,
      ));
    }
    return normalisePupils(pupils);
  }

  static async getAllPupils(): Promise<Pupil[]> {
    if (typeof window !== 'undefined') {
      if (this.sharedPupils) return this.sharedPupils;
      if (this.pendingSharedRefresh) return this.pendingSharedRefresh;
      return this.waitForSharedPupils();
    }

    try {
      console.log('🚀 BATCH LOADING: Fetching ALL pupils (cache-first)');
      const startTime = performance.now();

      // 🚀 OPTIMIZED: Remove orderBy to avoid slow index scan - sort on client instead
      const q = query(collection(db, COLLECTION_NAME));
      // Use cache-first optimized helper - returns an array directly.
      const pupils = await getDocsWithTimeout<Pupil>(q, 30000);

      const pupilsLoadTime = performance.now();
      console.log(`✅ Loaded ${pupils.length} pupils in ${(pupilsLoadTime - startTime).toFixed(2)}ms`);
      
      // If we got 0 pupils, log a warning
      if (pupils.length === 0) {
        console.warn('⚠️ getAllPupils returned 0 pupils - this might indicate a problem');
      }

      // 🚀 BATCH LOADING: Load ALL classes in ONE query instead of N+1 queries
      console.log('🚀 BATCH LOADING: Fetching ALL classes for pupil population');
      const allClasses = await ClassesService.getAll();
      const classesMap = new Map(allClasses.map(c => [c.id, c]));

      const classesLoadTime = performance.now();
      console.log(`✅ Loaded ${allClasses.length} classes in ${(classesLoadTime - pupilsLoadTime).toFixed(2)}ms`);
      console.log(`📊 BATCH LOADING: Created class map for instant lookups (${classesMap.size} classes)`);

      // 💨 IN-MEMORY: Instant lookups, NO more database queries!
      let populatedCount = 0;
      pupils.forEach(pupil => {
        if (pupil.classId) {
          const classData = classesMap.get(pupil.classId);
          if (classData) {
            pupil.className = classData.name;
            pupil.classCode = classData.code;
            populatedCount++;
          } else {
            console.warn(`⚠️ Class ${pupil.classId} not found for pupil ${pupil.firstName} ${pupil.lastName}`);
          }
        }
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerPupil = totalTime / pupils.length;

      console.log(`✅ BATCH LOADING COMPLETE: Populated ${populatedCount}/${pupils.length} pupils with class data`);
      console.log(`⚡ Total time: ${totalTime.toFixed(2)}ms (${avgTimePerPupil.toFixed(2)}ms per pupil)`);
      console.log(`🎉 Optimization: ${pupils.length} pupils loaded with ONLY 2 queries (pupils + classes) instead of ${pupils.length + 1}+!`);

      // 🚀 OPTIMIZED: Sort on client-side (instant, no database index needed)
      pupils.sort((a, b) => {
        const lastNameCompare = (a.lastName || '').localeCompare(b.lastName || '');
        if (lastNameCompare !== 0) return lastNameCompare;
        return (a.firstName || '').localeCompare(b.firstName || '');
      });

      return pupils;
    } catch (error) {
      console.error('Error fetching pupils:', error);
      throw error;
    }
  }

  static async getPupilById(id: string): Promise<Pupil | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      // 🚀 OPTIMIZED: Use optimized helper with timeout protection
      const pupilData = await getDocWithTimeout<Pupil>(docRef, 10000);

      if (!pupilData) {
        return null;
      }

      // Don't fetch class data here - it's already loaded in most components via useClasses()
      // This eliminates an extra query that slows down the page
      // Class name can be populated client-side using the already-loaded classes

        return pupilData;
    } catch (error) {
      console.error('Error fetching pupil by ID:', error);
      throw error;
    }
  }

  static async createPupil(
    pupilData: Omit<Pupil, 'id' | 'createdAt'>,
    options: { autoAssignHouse?: boolean } = {}
  ): Promise<string> {
    try {
      // Auto-assign house in round-robin order based on About School ordering (alphabetical by name)
      if (options.autoAssignHouse !== false && (!('houseId' in pupilData) || !pupilData.houseId)) {
        try {
          const houses = await HousesService.getAll();
          if (houses.length > 0) {
            // Sort to match About School list ordering (same as UI)
            houses.sort((a, b) => a.name.localeCompare(b.name));
            // Find last registered pupil and their house
            const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'), limit(1));
            const lastPupils = await getDocsWithTimeout<Pupil>(q, 10000);
            let nextHouseId = houses[0].id;
            if (lastPupils.length > 0) {
              const lastPupil = lastPupils[0];
              const lastIndex = houses.findIndex(h => h.id === (lastPupil.houseId || ''));
              const nextIndex = lastIndex >= 0 ? (lastIndex + 1) % houses.length : 0;
              nextHouseId = houses[nextIndex].id;
            }
            (pupilData as any).houseId = nextHouseId;
          }
        } catch (houseErr) {
          console.warn('Auto house assignment skipped:', houseErr);
        }
      }

      const now = new Date().toISOString();
      const newPupil = {
        ...pupilData,
        createdAt: now,
        updatedAt: now,
        syncUpdatedAt: Timestamp.now()
      };

      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(newPupil);

      const docRef = doc(collection(db, COLLECTION_NAME));
      await runTransaction(db, async transaction => {
        const revision = await reservePupilsRevisionInTransaction(transaction);
        transaction.set(docRef, cleanedData);
        transaction.set(doc(db, CACHE_CHANGES_COLLECTION, String(revision).padStart(16, '0')), {
          revision,
          pupilId: docRef.id,
          operation: 'upsert',
          changedAt: Timestamp.now(),
        });
      });
      await HistoryLogService.log({
        action: 'create',
        entity: 'pupil',
        recordId: docRef.id,
        label: `${pupilData.firstName || ''} ${pupilData.lastName || ''}`.trim() || pupilData.admissionNumber,
        meta: {
          admissionNo: pupilData.admissionNumber || '',
          classId: pupilData.classId || '',
        },
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating pupil:', error);
      throw error;
    }
  }

  static async updatePupil(id: string, pupilData: Partial<Omit<Pupil, 'id' | 'createdAt'>>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const updateData = {
        ...pupilData,
        updatedAt: new Date().toISOString(),
        syncUpdatedAt: Timestamp.now()
      };

      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(updateData);

      const originalPupil = await runTransaction(db, async transaction => {
        const original = await transaction.get(docRef);
        if (!original.exists()) throw new Error(`Pupil ${id} was not found.`);
        const previousPupil = { id: original.id, ...original.data() } as Pupil;
        const revision = await reservePupilsRevisionInTransaction(transaction);
        transaction.update(docRef, cleanedData);
        transaction.set(doc(db, CACHE_CHANGES_COLLECTION, String(revision).padStart(16, '0')), {
          revision,
          pupilId: id,
          operation: 'upsert',
          changedAt: Timestamp.now(),
        });
        return previousPupil;
      });
      await HistoryLogService.log({
        action: 'update',
        entity: 'pupil',
        recordId: id,
        label: `${originalPupil?.firstName || pupilData.firstName || ''} ${originalPupil?.lastName || pupilData.lastName || ''}`.trim() || originalPupil?.admissionNumber || id,
        changedFields: Object.keys(cleanedData).filter(key => key !== 'syncUpdatedAt' && key !== 'updatedAt'),
        meta: {
          admissionNo: originalPupil?.admissionNumber || '',
          classId: (pupilData.classId || originalPupil?.classId || '') as string,
        },
      });

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
      const pupil = await runTransaction(db, async transaction => {
        const original = await transaction.get(docRef);
        if (!original.exists()) throw new Error(`Pupil ${id} was not found.`);
        const previousPupil = { id: original.id, ...original.data() } as Pupil;
        const revision = await reservePupilsRevisionInTransaction(transaction);
        transaction.delete(docRef);
        transaction.set(doc(db, CACHE_CHANGES_COLLECTION, String(revision).padStart(16, '0')), {
          revision,
          pupilId: id,
          operation: 'delete',
          changedAt: Timestamp.now(),
        });
        return previousPupil;
      });
      await HistoryLogService.log({
        action: 'delete',
        entity: 'pupil',
        recordId: id,
        label: `${pupil?.firstName || ''} ${pupil?.lastName || ''}`.trim() || pupil?.admissionNumber || id,
        meta: {
          admissionNo: pupil?.admissionNumber || '',
          classId: pupil?.classId || '',
        },
      });
    } catch (error) {
      console.error('Error deleting pupil:', error);
      throw error;
    }
  }

  static async getPupilsByClass(classId: string): Promise<Pupil[]> {
    try {
      const startTime = performance.now();
      console.log('🔍 Fetching pupils for class (index-free):', classId);

      // Use simple query without ORDER BY to avoid index requirements
      // while Firebase index is building
      const q = query(
        collection(db, COLLECTION_NAME),
        where('classId', '==', classId)
        // Removed orderBy to avoid index requirement while building
      );
      // Use cache-first optimized helper - returns array directly
      let pupils = await getDocsWithTimeout<Pupil>(q, 30000);

      const pupilsLoadTime = performance.now();
      console.log(`📊 Fetched ${pupils.length} pupils for class ${classId} in ${(pupilsLoadTime - startTime).toFixed(2)}ms`);

      // Sort on client-side instead of database to avoid index requirement
      pupils.sort((a, b) => {
        const aLastName = (a.lastName || '').toLowerCase();
        const bLastName = (b.lastName || '').toLowerCase();
        return aLastName.localeCompare(bLastName);
      });

      // 🚀 CRITICAL OPTIMIZATION: Batch load ALL classes in ONE query instead of N+1 queries
      // This is the same optimization used in getAllPupils()
      console.log('🚀 BATCH LOADING: Fetching ALL classes for pupil population (single query)');
      const allClasses = await ClassesService.getAll();
      const classesMap = new Map(allClasses.map(c => [c.id, c]));

      const classesLoadTime = performance.now();
      console.log(`✅ Loaded ${allClasses.length} classes in ${(classesLoadTime - pupilsLoadTime).toFixed(2)}ms`);
      console.log(`📊 BATCH LOADING: Created class map for instant lookups (${classesMap.size} classes)`);

      // 💨 IN-MEMORY: Instant lookups, NO more database queries!
      let populatedCount = 0;
      pupils.forEach(pupil => {
        if (pupil.classId) {
          const classData = classesMap.get(pupil.classId);
          if (classData) {
            pupil.className = classData.name;
            pupil.classCode = classData.code;
            populatedCount++;
          } else {
            console.warn(`⚠️ Class ${pupil.classId} not found for pupil ${pupil.firstName} ${pupil.lastName}`);
          }
        }
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      console.log(`✅ BATCH LOADING COMPLETE: Populated ${populatedCount}/${pupils.length} pupils with class data`);
      console.log(`⚡ Total time: ${totalTime.toFixed(2)}ms (${pupils.length > 0 ? (totalTime / pupils.length).toFixed(2) : 0}ms per pupil)`);
      console.log(`🎉 Optimization: ${pupils.length} pupils loaded with ONLY 2 queries (pupils + classes) instead of ${pupils.length + 1}+!`);

      return pupils;
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

      const pupils = await getDocsWithTimeout<Pupil>(q, 30000);

      return pupils.map(pupil => ({
        id: pupil.id,
        firstName: pupil.firstName || '',
        lastName: pupil.lastName || '',
        admissionNumber: pupil.admissionNumber || '',
        classId: pupil.classId || '',
        status: pupil.status || 'Active'
      }));
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
      const pupils = await getDocsWithTimeout<Pupil>(q, 30000);

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
      const allPupils = await getDocsWithTimeout<Pupil>(q, 30000);

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
      const pupils = await getDocsWithTimeout<Pupil>(q, 30000);

      if (pupils.length === 0) {
        return null;
      }

      const pupilData = pupils[0];

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
        batches.push(getDocsWithTimeout<Pupil>(q, 30000));
      }

      const queryResults = await Promise.all(batches);
      const pupils: Pupil[] = [];

      // 🚀 OPTIMIZED: Collect all unique class IDs first, then batch fetch all classes
      const classIds = new Set<string>();
      for (const pupilArray of queryResults) {
        for (const pupilData of pupilArray) {
          if (pupilData.classId) {
            classIds.add(pupilData.classId);
          }
          pupils.push(pupilData);
        }
      }

      // 🚀 OPTIMIZED: Batch fetch all classes in one go instead of individual queries
      const classesMap = new Map<string, { name: string; code: string }>();
      if (classIds.size > 0) {
        try {
          const allClasses = await ClassesService.getAll();
          allClasses.forEach(cls => {
            if (classIds.has(cls.id)) {
              classesMap.set(cls.id, { name: cls.name, code: cls.code || '' });
            }
          });
        } catch (classError) {
          console.warn('Error batch fetching classes:', classError);
        }
      }

      // 🚀 OPTIMIZED: Populate class names from the map (instant lookup, no more queries!)
      pupils.forEach(pupil => {
        if (pupil.classId && classesMap.has(pupil.classId)) {
          const classData = classesMap.get(pupil.classId)!;
          pupil.className = classData.name;
          pupil.classCode = classData.code;
        }
      });

      return pupils;
    } catch (error) {
      console.error('Error fetching pupils by IDs:', error);
      throw error;
    }
  }

  // 🚀 DATABASE-LEVEL FILTERING: Fetch only active pupils from database
  static async getActivePupils(): Promise<Pupil[]> {
    try {
      console.log('🎯 BATCH LOADING: Fetching ONLY active pupils from database');
      const startTime = performance.now();

      const q = query(
        collection(db, COLLECTION_NAME),
        where('status', '==', 'Active'),
        orderBy('lastName', 'asc')
      );
      const pupils = await getDocsWithTimeout<Pupil>(q, 30000);

      const pupilsLoadTime = performance.now();
      console.log(`✅ Loaded ${pupils.length} active pupils in ${(pupilsLoadTime - startTime).toFixed(2)}ms`);

      // 🚀 BATCH LOADING: Load ALL classes in ONE query instead of N+1 queries
      console.log('🚀 BATCH LOADING: Fetching ALL classes for pupil population');
      const allClasses = await ClassesService.getAll();
      const classesMap = new Map(allClasses.map(c => [c.id, c]));

      const classesLoadTime = performance.now();
      console.log(`✅ Loaded ${allClasses.length} classes in ${(classesLoadTime - pupilsLoadTime).toFixed(2)}ms`);

      // 💨 IN-MEMORY: Instant lookups, NO more database queries!
      let populatedCount = 0;
      pupils.forEach(pupil => {
        if (pupil.classId) {
          const classData = classesMap.get(pupil.classId);
          if (classData) {
            pupil.className = classData.name;
            pupil.classCode = classData.code;
            populatedCount++;
          }
        }
      });

      const endTime = performance.now();
      console.log(`✅ BATCH LOADING COMPLETE: Populated ${populatedCount}/${pupils.length} active pupils with class data`);
      console.log(`⚡ Total time: ${(endTime - startTime).toFixed(2)}ms`);

      return pupils;
    } catch (error) {
      console.error('Error fetching active pupils:', error);
      throw error;
    }
  }

  /**
   * 🚀 OPTIMIZED: Fetch only active pupils without photos for dashboard/statistics
   * Much faster than fetching all pupils and filtering
   */
  static async getActivePupilsWithoutPhotos(): Promise<Pupil[]> {
    try {
      console.log('🎯 OPTIMIZED: Fetching ONLY active pupils WITHOUT photos from database');
      const startTime = performance.now();

      const q = query(
        collection(db, COLLECTION_NAME),
        where('status', '==', 'Active'),
        orderBy('lastName', 'asc')
      );
      const pupilsArray = await getDocsWithTimeout<Pupil>(q, 30000);

      // Map documents and explicitly exclude photo field for faster loading
      const pupils = pupilsArray.map(pupil => {
        const { photo, ...pupilDataWithoutPhoto } = pupil;
        return pupilDataWithoutPhoto as Pupil;
      });

      const pupilsLoadTime = performance.now();
      console.log(`✅ Loaded ${pupils.length} active pupils (without photos) in ${(pupilsLoadTime - startTime).toFixed(2)}ms`);

      // 🚀 BATCH LOADING: Load ALL classes in ONE query
      const allClasses = await ClassesService.getAll();
      const classesMap = new Map(allClasses.map(c => [c.id, c]));

      const classesLoadTime = performance.now();
      console.log(`✅ Loaded ${allClasses.length} classes in ${(classesLoadTime - pupilsLoadTime).toFixed(2)}ms`);

      // 💨 IN-MEMORY: Instant lookups
      let populatedCount = 0;
      pupils.forEach(pupil => {
        if (pupil.classId) {
          const classData = classesMap.get(pupil.classId);
          if (classData) {
            pupil.className = classData.name;
            pupil.classCode = classData.code;
            populatedCount++;
          }
        }
      });

      const endTime = performance.now();
      console.log(`✅ OPTIMIZED LOADING COMPLETE: ${populatedCount}/${pupils.length} active pupils populated`);
      console.log(`⚡ Total time: ${(endTime - startTime).toFixed(2)}ms`);

      return pupils;
    } catch (error) {
      console.error('Error fetching active pupils without photos:', error);
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
      const pupils = await getDocsWithTimeout<Pupil>(q, 30000);

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
      console.log(`🎯 BATCH LOADING: Fetching ACTIVE pupils for class ${classId}`);
      const startTime = performance.now();

      const q = query(
        collection(db, COLLECTION_NAME),
        where('classId', '==', classId),
        where('status', '==', 'Active')
      );
      let pupils = await getDocsWithTimeout<Pupil>(q, 30000);

      const pupilsLoadTime = performance.now();
      console.log(`✅ Fetched ${pupils.length} active pupils for class ${classId} in ${(pupilsLoadTime - startTime).toFixed(2)}ms`);

      // Sort on client-side to avoid requiring a composite index
      pupils.sort((a, b) => {
        const aLastName = (a.lastName || '').toLowerCase();
        const bLastName = (b.lastName || '').toLowerCase();
        return aLastName.localeCompare(bLastName);
      });

      // 🚀 OPTIMIZATION: For a single class, we can just fetch that class directly
      // No need to load all classes like we do for getAllPupils
      if (pupils.length > 0 && classId) {
        console.log('🚀 Fetching class data for population');
        try {
          const classData = await ClassesService.getById(classId);
          if (classData) {
            // All pupils are from the same class, so populate all at once
            pupils.forEach(pupil => {
              pupil.className = classData.name;
              pupil.classCode = classData.code;
            });
            const endTime = performance.now();
            console.log(`✅ BATCH POPULATION: Populated ${pupils.length} pupils with class data in ${(endTime - startTime).toFixed(2)}ms`);
          }
        } catch (classError) {
          console.warn('Error fetching class data:', classError);
        }
      }

      return pupils;
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
      let pupils = await getDocsWithTimeout<Pupil>(q, 30000);

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

  // 🚀 PERFORMANCE OPTIMIZATION: Methods for fetching pupils WITHOUT photos
  // These methods significantly improve load times by excluding photo data

  /**
   * Fetch all pupils WITHOUT photos for faster initial load
   * Photos can be loaded separately using getPupilPhoto() or getPupilPhotos()
   */
  static async getAllPupilsWithoutPhotos(): Promise<Pupil[]> {
    try {
      console.log('🚀 OPTIMIZED LOADING: Fetching ALL pupils WITHOUT photos');
      const startTime = performance.now();

      const q = query(collection(db, COLLECTION_NAME), orderBy('lastName', 'asc'));
      const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.();
      const timeout = isNative ? 60000 : 30000; // 60s for native, 30s for web
      const pupilsArray = await getDocsWithTimeout<Pupil>(q, timeout);

      // Map documents and explicitly exclude photo field
      const pupils = pupilsArray.map(pupil => {
        const { photo, ...pupilDataWithoutPhoto } = pupil;
        return pupilDataWithoutPhoto as Pupil;
      });

      const pupilsLoadTime = performance.now();
      console.log(`✅ Loaded ${pupils.length} pupils (without photos) in ${(pupilsLoadTime - startTime).toFixed(2)}ms`);

      // Batch load classes
      const allClasses = await ClassesService.getAll();
      const classesMap = new Map(allClasses.map(c => [c.id, c]));

      const classesLoadTime = performance.now();
      console.log(`✅ Loaded ${allClasses.length} classes in ${(classesLoadTime - pupilsLoadTime).toFixed(2)}ms`);

      // Populate class names
      let populatedCount = 0;
      pupils.forEach(pupil => {
        if (pupil.classId) {
          const classData = classesMap.get(pupil.classId);
          if (classData) {
            pupil.className = classData.name;
            pupil.classCode = classData.code;
            populatedCount++;
          }
        }
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      console.log(`✅ OPTIMIZED LOADING COMPLETE: ${populatedCount}/${pupils.length} pupils populated`);
      console.log(`⚡ Total time: ${totalTime.toFixed(2)}ms (${(totalTime / pupils.length).toFixed(2)}ms per pupil)`);
      console.log(`🎉 Photos excluded - use getPupilPhotos() to load them separately`);

      return pupils;
    } catch (error) {
      console.error('Error fetching pupils without photos:', error);
      throw error;
    }
  }

  /**
   * Fetch pupils by class WITHOUT photos for faster initial load
   */
  static async getPupilsByClassWithoutPhotos(classId: string): Promise<Pupil[]> {
    try {
      const startTime = performance.now();
      console.log('🔍 OPTIMIZED: Fetching pupils for class WITHOUT photos:', classId);

      const q = query(
        collection(db, COLLECTION_NAME),
        where('classId', '==', classId)
      );
      const pupilsArray = await getDocsWithTimeout<Pupil>(q, 30000);

      // Map documents and explicitly exclude photo field
      let pupils = pupilsArray.map(pupil => {
        const { photo, ...pupilDataWithoutPhoto } = pupil;
        return pupilDataWithoutPhoto as Pupil;
      });

      const pupilsLoadTime = performance.now();
      console.log(`📊 Fetched ${pupils.length} pupils (without photos) in ${(pupilsLoadTime - startTime).toFixed(2)}ms`);

      // Sort on client-side
      pupils.sort((a, b) => {
        const aLastName = (a.lastName || '').toLowerCase();
        const bLastName = (b.lastName || '').toLowerCase();
        return aLastName.localeCompare(bLastName);
      });

      // Batch load classes
      const allClasses = await ClassesService.getAll();
      const classesMap = new Map(allClasses.map(c => [c.id, c]));

      const classesLoadTime = performance.now();
      console.log(`✅ Loaded ${allClasses.length} classes in ${(classesLoadTime - pupilsLoadTime).toFixed(2)}ms`);

      // Populate class names
      let populatedCount = 0;
      pupils.forEach(pupil => {
        if (pupil.classId) {
          const classData = classesMap.get(pupil.classId);
          if (classData) {
            pupil.className = classData.name;
            pupil.classCode = classData.code;
            populatedCount++;
          }
        }
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      console.log(`✅ OPTIMIZED LOADING: ${populatedCount}/${pupils.length} pupils populated in ${totalTime.toFixed(2)}ms`);

      return pupils;
    } catch (error) {
      console.error('❌ Error fetching pupils by class without photos:', error);
      return [];
    }
  }

  /**
   * Fetch pupils by class with filters WITHOUT photos for faster initial load
   */
  static async getPupilsByClassWithFiltersWithoutPhotos(
    classId: string,
    filters?: {
      status?: string;
      section?: string;
      gender?: string;
    }
  ): Promise<Pupil[]> {
    try {
      console.log('🔍 OPTIMIZED: Fetching pupils with filters WITHOUT photos:', { classId, filters });

      // Use optimized database-level filtering when possible
      if (filters?.status && filters.status !== 'all' &&
        (!filters.section || filters.section === 'all') &&
        (!filters.gender || filters.gender === 'all')) {
        console.log(`⚡ Using DATABASE-LEVEL status filter (optimized, no photos)`);

        const q = query(
          collection(db, COLLECTION_NAME),
          where('classId', '==', classId),
          where('status', '==', filters.status)
        );
        const pupilsArray = await getDocsWithTimeout<Pupil>(q, 30000);

        let pupils = pupilsArray.map(pupil => {
          const { photo, ...pupilDataWithoutPhoto } = pupil;
          return pupilDataWithoutPhoto as Pupil;
        });

        // Sort on client-side
        pupils.sort((a, b) => {
          const aLastName = (a.lastName || '').toLowerCase();
          const bLastName = (b.lastName || '').toLowerCase();
          return aLastName.localeCompare(bLastName);
        });

        // Populate class names
        const allClasses = await ClassesService.getAll();
        const classesMap = new Map(allClasses.map(c => [c.id, c]));

        pupils.forEach(pupil => {
          if (pupil.classId) {
            const classData = classesMap.get(pupil.classId);
            if (classData) {
              pupil.className = classData.name;
              pupil.classCode = classData.code;
            }
          }
        });

        console.log(`✅ Fetched ${pupils.length} pupils with database-level filtering (no photos)`);
        return pupils;
      }

      // Fallback: fetch all pupils for class without photos, then filter client-side
      let pupils = await this.getPupilsByClassWithoutPhotos(classId);

      // Apply client-side filters
      if (filters?.status && filters.status !== 'all') {
        pupils = pupils.filter(pupil => pupil.status === filters.status);
      }

      if (filters?.section && filters.section !== 'all') {
        pupils = pupils.filter(pupil =>
          pupil.section?.toLowerCase() === filters.section?.toLowerCase()
        );
      }

      if (filters?.gender && filters.gender !== 'all') {
        pupils = pupils.filter(pupil =>
          pupil.gender?.toLowerCase() === filters.gender?.toLowerCase()
        );
      }

      console.log(`✅ Final result: ${pupils.length} pupils after filters (no photos)`);
      return pupils;
    } catch (error) {
      console.error('❌ Error fetching pupils with filters (no photos):', error);
      return [];
    }
  }

  /**
   * Fetch a single pupil's photo by ID
   * Use this for lazy loading individual photos
   */
  static async getPupilPhoto(pupilId: string): Promise<string | undefined> {
    try {
      const docRef = doc(db, COLLECTION_NAME, pupilId);
      const pupilData = await getDocWithTimeout<Pupil>(docRef, 5000);

      if (pupilData) {
        return pupilData.photo;
      }
      return undefined;
    } catch (error) {
      console.error(`Error fetching photo for pupil ${pupilId}:`, error);
      return undefined;
    }
  }

  /**
   * Batch fetch multiple pupil photos by IDs
   * Use this for lazy loading photos for a list of pupils
   * Returns a Map of pupilId -> photoUrl
   * 
   * OPTIMIZED: 
   * - Uses optimal batch sizes for better throughput
   * - Parallel execution with concurrency control
   * - Request deduplication
   * - Progressive loading support
   */
  static async getPupilPhotos(
    pupilIds: string[], 
    options?: {
      priorityIds?: string[]; // Load these first (e.g., visible pupils)
      maxConcurrent?: number; // Max concurrent requests (default: 5)
      batchSize?: number; // Batch size for queries (default: 30, max: 30)
    }
  ): Promise<Map<string, string>> {
    try {
      if (pupilIds.length === 0) return new Map();

      // Remove duplicates
      const uniqueIds = Array.from(new Set(pupilIds));
      const priorityIds = options?.priorityIds || [];
      const maxConcurrent = options?.maxConcurrent || 5;
      const batchSize = Math.min(options?.batchSize || 30, 30); // Firestore 'in' limit is 30

      console.log(`🖼️ OPTIMIZED: Batch loading ${uniqueIds.length} pupil photos (priority: ${priorityIds.length})...`);
      const startTime = performance.now();

      const photoMap = new Map<string, string>();

      // Sort IDs: priority first, then rest
      const sortedIds = [
        ...priorityIds.filter(id => uniqueIds.includes(id)),
        ...uniqueIds.filter(id => !priorityIds.includes(id))
      ];

      // Strategy: Use getDoc() for very small batches (≤5) for speed
      // Use batch queries for larger batches for efficiency
      if (sortedIds.length <= 5) {
        // Small batch: use getDoc() for each (fastest for tiny batches)
        const docPromises = sortedIds.map(id => {
          const docRef = doc(db, COLLECTION_NAME, id);
          return getDoc(docRef).then(docSnap => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              if (data.photo && data.photo.trim() !== '') {
                photoMap.set(id, data.photo);
              }
            }
          }).catch(err => {
            console.warn(`Failed to fetch photo for pupil ${id}:`, err);
          });
        });
        
        await Promise.all(docPromises);
      } else {
        // Larger batch: use optimized parallel batch queries with concurrency control
        const batches: string[][] = [];
        
        // Create batches
        for (let i = 0; i < sortedIds.length; i += batchSize) {
          batches.push(sortedIds.slice(i, i + batchSize));
        }

        // Process batches with concurrency control
        const processBatch = async (batch: string[]): Promise<void> => {
          try {
            // Use 'in' query for batches (faster than individual getDoc calls)
            const q = query(
              collection(db, COLLECTION_NAME),
              where('__name__', 'in', batch)
            );
            const pupilsArray = await getDocsWithTimeout<Pupil>(q, 30000);
            
            for (const pupil of pupilsArray) {
              if (pupil.photo && pupil.photo.trim() !== '') {
                photoMap.set(pupil.id, pupil.photo);
              }
            }
          } catch (error) {
            console.warn(`Batch query failed, falling back to individual fetches:`, error);
            // Fallback: fetch individually for this batch
            const fallbackPromises = batch.map(id => {
              const docRef = doc(db, COLLECTION_NAME, id);
              return getDoc(docRef).then(docSnap => {
                if (docSnap.exists()) {
                  const data = docSnap.data();
                  if (data.photo && data.photo.trim() !== '') {
                    photoMap.set(id, data.photo);
                  }
                }
              }).catch(err => {
                console.warn(`Failed to fetch photo for pupil ${id}:`, err);
              });
            });
            await Promise.all(fallbackPromises);
          }
        };

        // Process batches with concurrency limit
        const processBatchesWithConcurrency = async () => {
          const executing: Promise<void>[] = [];
          
          for (const batch of batches) {
            const promise = processBatch(batch).then(() => {
              executing.splice(executing.indexOf(promise), 1);
            });
            executing.push(promise);
            
            // Wait if we've hit the concurrency limit
            if (executing.length >= maxConcurrent) {
              await Promise.race(executing);
            }
          }
          
          // Wait for all remaining batches
          await Promise.all(executing);
        };

        await processBatchesWithConcurrency();
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / uniqueIds.length;
      const successRate = ((photoMap.size / uniqueIds.length) * 100).toFixed(1);
      
      console.log(`✅ OPTIMIZED: Loaded ${photoMap.size}/${uniqueIds.length} photos in ${totalTime.toFixed(2)}ms (${avgTime.toFixed(2)}ms per photo, ${successRate}% success)`);

      return photoMap;
    } catch (error) {
      console.error('Error batch fetching pupil photos:', error);
      return new Map();
    }
  }
}
