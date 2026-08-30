import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDocs,
  getDocsFromCache,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  type AccessLevel,
  type CreateAccessLevelData,
  type UpdateAccessLevelData,
  PREDEFINED_ACCESS_LEVELS,
} from '@/types/access-levels';
import { normaliseAccessLevels } from '@/lib/cache/access-level-cache';
import { getDocsFromServerWithTimeout } from '@/lib/utils/firestore-helpers';
import { bumpAccessLevelsRevisionInBatch } from './dashboard-cache-revisions.service';

const COLLECTION_NAME = 'accessLevels';

export class AccessLevelsService {
  private static sharedAccessLevels: AccessLevel[] | null = null;
  private static pendingSharedRefresh: Promise<AccessLevel[]> | null = null;
  private static sharedReadyPromise: Promise<AccessLevel[]> | null = null;
  private static resolveSharedReady: ((levels: AccessLevel[]) => void) | null = null;
  private static rejectSharedReady: ((error: unknown) => void) | null = null;

  private static waitForSharedAccessLevels(): Promise<AccessLevel[]> {
    if (!this.sharedReadyPromise) {
      this.sharedReadyPromise = new Promise<AccessLevel[]>((resolve, reject) => {
        this.resolveSharedReady = resolve;
        this.rejectSharedReady = reject;
      });
    }
    return this.sharedReadyPromise;
  }

  static hydrateSharedAccessLevels(levels: AccessLevel[]): void {
    this.sharedAccessLevels = normaliseAccessLevels(levels);
    this.resolveSharedReady?.(this.sharedAccessLevels);
    this.resolveSharedReady = null;
    this.rejectSharedReady = null;
    this.sharedReadyPromise = Promise.resolve(this.sharedAccessLevels);
  }

  static clearSharedAccessLevels(): void {
    this.resolveSharedReady?.([]);
    this.sharedAccessLevels = null;
    this.pendingSharedRefresh = null;
    this.sharedReadyPromise = null;
    this.resolveSharedReady = null;
    this.rejectSharedReady = null;
  }

  static refreshSharedAccessLevels(load: () => Promise<AccessLevel[]>): Promise<AccessLevel[]> {
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
        if (this.pendingSharedRefresh === pending) this.pendingSharedRefresh = null;
      });
    this.pendingSharedRefresh = pending;
    return pending;
  }

  /** Authoritative collection read used only by the access-level cache owner. */
  static async getAllForCache(): Promise<AccessLevel[]> {
    const levels = await getDocsFromServerWithTimeout<AccessLevel>(
      collection(db, COLLECTION_NAME),
      30000,
    );
    return normaliseAccessLevels(levels);
  }

  /** Free IndexedDB recovery while a cold persistent snapshot is rebuilt. */
  static async getAllFromFirestoreCache(): Promise<AccessLevel[]> {
    try {
      const snapshot = await getDocsFromCache(collection(db, COLLECTION_NAME));
      return normaliseAccessLevels(snapshot.docs.map(snapshotDoc => ({
        id: snapshotDoc.id,
        ...snapshotDoc.data(),
      })) as AccessLevel[]);
    } catch {
      return [];
    }
  }

  static async getAllAccessLevels(): Promise<AccessLevel[]> {
    if (typeof window !== 'undefined') {
      if (this.sharedAccessLevels) return this.sharedAccessLevels;
      if (this.pendingSharedRefresh) return this.pendingSharedRefresh;
      return this.waitForSharedAccessLevels();
    }
    return this.getAllForCache();
  }

  static async getActiveAccessLevels(): Promise<AccessLevel[]> {
    return (await this.getAllAccessLevels()).filter(level => level.isActive);
  }

  static async getAccessLevelById(id: string): Promise<AccessLevel | null> {
    return (await this.getAllAccessLevels()).find(level => level.id === id) ?? null;
  }

  static async getDefaultAccessLevel(): Promise<AccessLevel | null> {
    return (await this.getAllAccessLevels()).find(level => level.isDefault && level.isActive) ?? null;
  }

  /** Mutation-only read used to atomically transfer the single default marker. */
  private static async getDefaultDocuments() {
    const defaultsQuery = query(
      collection(db, COLLECTION_NAME),
      where('isDefault', '==', true),
    );
    return getDocs(defaultsQuery);
  }

  static async createAccessLevel(
    data: CreateAccessLevelData,
    createdBy: string,
  ): Promise<AccessLevel> {
    try {
      const defaultDocuments = data.isDefault ? await this.getDefaultDocuments() : null;
      const now = new Date().toISOString();
      const documentRef = doc(collection(db, COLLECTION_NAME));
      const created: AccessLevel = {
        id: documentRef.id,
        ...data,
        isDefault: data.isDefault || false,
        isActive: true,
        createdAt: now,
        createdBy,
        updatedAt: now,
        updatedBy: createdBy,
      };
      const { id: _id, ...stored } = created;
      const batch = writeBatch(db);
      defaultDocuments?.docs.forEach(defaultDocument => {
        batch.update(defaultDocument.ref, { isDefault: false, updatedAt: now, updatedBy: createdBy });
      });
      batch.set(documentRef, stored);
      bumpAccessLevelsRevisionInBatch(batch);
      await batch.commit();
      return created;
    } catch (error) {
      console.error('Error creating access level:', error);
      throw new Error('Failed to create access level');
    }
  }

  static async updateAccessLevel(
    id: string,
    data: UpdateAccessLevelData,
    updatedBy: string,
  ): Promise<AccessLevel> {
    try {
      const defaultDocuments = data.isDefault ? await this.getDefaultDocuments() : null;
      const now = new Date().toISOString();
      const batch = writeBatch(db);
      defaultDocuments?.docs.forEach(defaultDocument => {
        if (defaultDocument.id !== id) {
          batch.update(defaultDocument.ref, { isDefault: false, updatedAt: now, updatedBy });
        }
      });
      batch.update(doc(db, COLLECTION_NAME, id), { ...data, updatedAt: now, updatedBy });
      bumpAccessLevelsRevisionInBatch(batch);
      await batch.commit();

      const existing = this.sharedAccessLevels?.find(level => level.id === id);
      return normaliseAccessLevels([{
        ...(existing ?? {}),
        ...data,
        id,
        updatedAt: now,
        updatedBy,
      } as AccessLevel])[0];
    } catch (error) {
      console.error('Error updating access level:', error);
      throw new Error('Failed to update access level');
    }
  }

  static async deleteAccessLevel(id: string): Promise<void> {
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, COLLECTION_NAME, id));
      bumpAccessLevelsRevisionInBatch(batch);
      await batch.commit();
    } catch (error) {
      console.error('Error deleting access level:', error);
      throw new Error('Failed to delete access level');
    }
  }

  static async initializePredefinedLevels(createdBy: string): Promise<AccessLevel[]> {
    try {
      // This read belongs to an explicit initialization mutation, not an ordinary consumer.
      const existingSnapshot = await getDocs(collection(db, COLLECTION_NAME));
      const existingNames = new Set(existingSnapshot.docs.map(item => String(item.data().name)));
      const created: AccessLevel[] = [];
      const batch = writeBatch(db);
      const now = new Date().toISOString();

      for (const levelData of Object.values(PREDEFINED_ACCESS_LEVELS)) {
        if (existingNames.has(levelData.name)) continue;
        const documentRef = doc(collection(db, COLLECTION_NAME));
        const modulePermissions = levelData.modulePermissions.map(module => ({
          moduleId: module.moduleId,
          pages: module.pages.map(page => ({
            pageId: page.pageId,
            canAccess: page.canAccess,
            actions: page.actions.map(action => ({
              actionId: action.actionId,
              allowed: action.allowed,
            })),
          })),
        }));
        const level: AccessLevel = {
          id: documentRef.id,
          name: levelData.name,
          description: levelData.description,
          modulePermissions,
          isDefault: false,
          isActive: true,
          createdAt: now,
          createdBy,
          updatedAt: now,
          updatedBy: createdBy,
        };
        const { id: _id, ...stored } = level;
        batch.set(documentRef, stored);
        created.push(level);
      }

      if (created.length > 0) {
        bumpAccessLevelsRevisionInBatch(batch);
        await batch.commit();
      }
      return normaliseAccessLevels(created);
    } catch (error) {
      console.error('Error initializing predefined levels:', error);
      throw new Error('Failed to initialize predefined levels');
    }
  }

  /** Convert permissions to the legacy user-record format. */
  static getAccessLevelPermissions(accessLevel: AccessLevel): {
    modulePermissions: any[];
    granularPermissions: any[];
  } {
    const modulePermissions = accessLevel.modulePermissions.map(module => ({
      module: module.moduleId,
      permission: this.determineLegacyPermission(module),
    }));
    return { modulePermissions, granularPermissions: accessLevel.modulePermissions };
  }

  private static determineLegacyPermission(modulePermissions: any): 'view_only' | 'edit' | 'full_access' {
    let hasEditActions = false;
    let hasDeleteActions = false;
    modulePermissions.pages.forEach((page: any) => {
      if (!page.canAccess) return;
      page.actions.forEach((action: any) => {
        if (!action.allowed) return;
        if (action.actionId.includes('edit') || action.actionId.includes('update') || action.actionId.includes('create')) {
          hasEditActions = true;
        }
        if (action.actionId.includes('delete') || action.actionId.includes('remove')) {
          hasDeleteActions = true;
        }
      });
    });
    if (hasDeleteActions) return 'full_access';
    if (hasEditActions) return 'edit';
    return 'view_only';
  }

  static validateAccessLevelData(data: CreateAccessLevelData): string[] {
    const errors: string[] = [];
    if (!data.name || data.name.trim().length === 0) errors.push('Access level name is required');
    if (data.name && data.name.length > 100) errors.push('Access level name must be less than 100 characters');
    if (!data.description || data.description.trim().length === 0) errors.push('Access level description is required');
    if (!data.modulePermissions || data.modulePermissions.length === 0) errors.push('At least one module permission is required');

    data.modulePermissions?.forEach((module, index) => {
      if (!module.moduleId) errors.push(`Module ${index + 1}: Module ID is required`);
      if (!module.pages || module.pages.length === 0) errors.push(`Module ${index + 1}: At least one page permission is required`);
      module.pages.forEach((page, pageIndex) => {
        if (!page.pageId) errors.push(`Module ${index + 1}, Page ${pageIndex + 1}: Page ID is required`);
        if (!page.actions || page.actions.length === 0) {
          errors.push(`Module ${index + 1}, Page ${pageIndex + 1}: At least one action permission is required`);
        }
      });
    });
    return errors;
  }
}
