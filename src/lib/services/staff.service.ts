import {
  collection,
  doc,
  getDoc,
  getDocs,
  getDocsFromCache,
  query,
  orderBy,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Staff } from '@/types';
import { getDocsFromServerWithTimeout } from '../utils/firestore-helpers';
import { normaliseStaff } from '@/lib/cache/staff-cache';
import { bumpStaffRevisionInBatch } from './dashboard-cache-revisions.service';

const COLLECTION_NAME = 'staff';

export class StaffService {
  private static sharedStaff: Staff[] | null = null;
  private static pendingSharedRefresh: Promise<Staff[]> | null = null;
  private static sharedReadyPromise: Promise<Staff[]> | null = null;
  private static resolveSharedReady: ((staff: Staff[]) => void) | null = null;
  private static rejectSharedReady: ((error: unknown) => void) | null = null;

  private static waitForSharedStaff(): Promise<Staff[]> {
    if (!this.sharedReadyPromise) {
      this.sharedReadyPromise = new Promise<Staff[]>((resolve, reject) => {
        this.resolveSharedReady = resolve;
        this.rejectSharedReady = reject;
      });
    }
    return this.sharedReadyPromise;
  }

  /** Makes the identity-scoped cache-owner snapshot available to legacy callers. */
  static hydrateSharedStaff(staff: Staff[]): void {
    this.sharedStaff = normaliseStaff(staff);
    this.resolveSharedReady?.(this.sharedStaff);
    this.resolveSharedReady = null;
    this.rejectSharedReady = null;
    this.sharedReadyPromise = Promise.resolve(this.sharedStaff);
  }

  static clearSharedStaff(): void {
    this.resolveSharedReady?.([]);
    this.sharedStaff = null;
    this.pendingSharedRefresh = null;
    this.sharedReadyPromise = null;
    this.resolveSharedReady = null;
    this.rejectSharedReady = null;
  }

  /** The cache bootstrap is the only browser caller allowed to begin a refresh. */
  static refreshSharedStaff(load: () => Promise<Staff[]>): Promise<Staff[]> {
    if (this.pendingSharedRefresh) return this.pendingSharedRefresh;

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
        }
      });

    this.pendingSharedRefresh = pending;
    return pending;
  }

  /** Strict collection read used only by the central staff-cache owner. */
  static async getAllForCache(): Promise<Staff[]> {
    const staffQuery = query(collection(db, COLLECTION_NAME), orderBy('lastName', 'asc'));
    const staff = await getDocsFromServerWithTimeout<Staff>(staffQuery, 30000);
    return normaliseStaff(staff);
  }

  /** Free IndexedDB recovery while a cold localStorage snapshot is rebuilt. */
  static async getAllFromFirestoreCache(): Promise<Staff[]> {
    try {
      const staffQuery = query(collection(db, COLLECTION_NAME), orderBy('lastName', 'asc'));
      const snapshot = await getDocsFromCache(staffQuery);
      return normaliseStaff(snapshot.docs.map(snapshotDoc => ({
        id: snapshotDoc.id,
        ...snapshotDoc.data(),
      })) as Staff[]);
    } catch {
      return [];
    }
  }

  static async getAllStaff(): Promise<Staff[]> {
    // Browser consumers must share the cache-owner snapshot. No component or
    // convenience service may quietly create another staff collection read.
    if (typeof window !== 'undefined') {
      if (this.sharedStaff) return this.sharedStaff;
      if (this.pendingSharedRefresh) return this.pendingSharedRefresh;
      return this.waitForSharedStaff();
    }

    return this.getAllForCache();
  }

  static async getStaffById(id: string): Promise<Staff | null> {
    if (typeof window !== 'undefined') {
      return (await this.getAllStaff()).find(staff => staff.id === id) ?? null;
    }

    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return normaliseStaff([{ id: docSnap.id, ...docSnap.data() } as Staff])[0] ?? null;
  }

  static async getStaffByDepartment(department: string): Promise<Staff[]> {
    if (typeof window !== 'undefined') {
      return (await this.getAllStaff()).filter(staff => staff.department?.includes(department));
    }

    const staffQuery = query(
      collection(db, COLLECTION_NAME),
      where('department', 'array-contains', department),
      orderBy('lastName', 'asc'),
    );
    const snapshot = await getDocs(staffQuery);
    return normaliseStaff(snapshot.docs.map(snapshotDoc => ({
      id: snapshotDoc.id,
      ...snapshotDoc.data(),
    })) as Staff[]);
  }

  static async checkEmployeeIDExists(employeeId: string, excludeId?: string): Promise<boolean> {
    const staffQuery = query(
      collection(db, COLLECTION_NAME),
      where('employeeId', '==', employeeId),
    );
    const querySnapshot = await getDocs(staffQuery);

    if (excludeId) {
      return querySnapshot.docs.some(snapshotDoc => snapshotDoc.id !== excludeId);
    }
    return !querySnapshot.empty;
  }

  static async generateUniqueEmployeeID(
    idData: { firstName: string; lastName: string; dateOfBirth: string; departments: string[] },
    excludeId?: string,
    maxAttempts: number = 10,
  ): Promise<string> {
    const { generateEmployeeID } = await import('@/lib/utils/employee-id-generator');

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const generatedID = generateEmployeeID(idData);
      if (!(await this.checkEmployeeIDExists(generatedID.id, excludeId))) {
        return generatedID.id;
      }
      console.log(`Employee ID ${generatedID.id} already exists, retrying... (attempt ${attempt})`);
    }

    throw new Error(`Failed to generate unique employee ID after ${maxAttempts} attempts`);
  }

  static async createStaff(staffData: Omit<Staff, 'id' | 'createdAt'>): Promise<Staff> {
    // Employee-ID checks are intentionally mutation-only. Ordinary rendering
    // never calls this query path.
    let employeeId = staffData.employeeId;
    if (!employeeId) {
      employeeId = await this.generateUniqueEmployeeID({
        firstName: staffData.firstName,
        lastName: staffData.lastName,
        dateOfBirth: staffData.dateOfBirth,
        departments: staffData.department,
      });
    } else if (await this.checkEmployeeIDExists(employeeId)) {
      throw new Error(`Employee ID ${employeeId} already exists`);
    }

    const newStaff = {
      ...staffData,
      employeeId,
      createdAt: new Date().toISOString(),
    };
    const docRef = doc(collection(db, COLLECTION_NAME));
    const batch = writeBatch(db);
    batch.set(docRef, this.cleanUndefinedValues(newStaff));
    bumpStaffRevisionInBatch(batch);
    await batch.commit();

    return normaliseStaff([{ id: docRef.id, ...newStaff }])[0];
  }

  static async updateStaff(
    id: string,
    data: Partial<Omit<Staff, 'id' | 'createdAt'>>,
  ): Promise<Staff> {
    const updateData = this.cleanUndefinedValues({
      ...data,
      updatedAt: new Date().toISOString(),
    });
    const docRef = doc(db, COLLECTION_NAME, id);
    const batch = writeBatch(db);
    batch.update(docRef, updateData);
    bumpStaffRevisionInBatch(batch);
    await batch.commit();

    // The mutating browser already owns the prior record, so return the merged
    // value instead of spending a second read to fetch the same document.
    const existing = this.sharedStaff?.find(staff => staff.id === id);
    return normaliseStaff([{ ...(existing ?? {}), ...updateData, id } as Staff])[0];
  }

  static async deleteStaff(id: string): Promise<void> {
    const batch = writeBatch(db);
    batch.delete(doc(db, COLLECTION_NAME, id));
    bumpStaffRevisionInBatch(batch);
    await batch.commit();
  }

  private static cleanUndefinedValues(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(item => this.cleanUndefinedValues(item));
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) cleaned[key] = this.cleanUndefinedValues(value);
      }
      return cleaned;
    }
    return obj;
  }
}
