import {
  collection,
  doc,
  getDoc,
  getDocsFromCache,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { House } from '@/types';
import { normaliseHouses } from '@/lib/cache/house-cache';
import { getDocsFromServerWithTimeout } from '../utils/firestore-helpers';
import { bumpHousesRevisionInBatch } from './dashboard-cache-revisions.service';

const COLLECTION = 'houses';

export class HousesService {
  private static sharedHouses: House[] | null = null;
  private static pendingSharedRefresh: Promise<House[]> | null = null;
  private static sharedReadyPromise: Promise<House[]> | null = null;
  private static resolveSharedReady: ((houses: House[]) => void) | null = null;
  private static rejectSharedReady: ((error: unknown) => void) | null = null;

  private static waitForSharedHouses(): Promise<House[]> {
    if (!this.sharedReadyPromise) {
      this.sharedReadyPromise = new Promise<House[]>((resolve, reject) => {
        this.resolveSharedReady = resolve;
        this.rejectSharedReady = reject;
      });
    }
    return this.sharedReadyPromise;
  }

  static hydrateSharedHouses(houses: House[]): void {
    this.sharedHouses = normaliseHouses(houses);
    this.resolveSharedReady?.(this.sharedHouses);
    this.resolveSharedReady = null;
    this.rejectSharedReady = null;
    this.sharedReadyPromise = Promise.resolve(this.sharedHouses);
  }

  static clearSharedHouses(): void {
    this.resolveSharedReady?.([]);
    this.sharedHouses = null;
    this.pendingSharedRefresh = null;
    this.sharedReadyPromise = null;
    this.resolveSharedReady = null;
    this.rejectSharedReady = null;
  }

  static refreshSharedHouses(load: () => Promise<House[]>): Promise<House[]> {
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

  /** Authoritative collection read used only by the house cache owner. */
  static async getAllForCache(): Promise<House[]> {
    const houses = await getDocsFromServerWithTimeout<House>(collection(db, COLLECTION), 30000);
    return normaliseHouses(houses);
  }

  /** Free IndexedDB recovery while a cold persistent snapshot is rebuilt. */
  static async getAllFromFirestoreCache(): Promise<House[]> {
    try {
      const snapshot = await getDocsFromCache(collection(db, COLLECTION));
      return normaliseHouses(snapshot.docs.map(snapshotDoc => ({
        id: snapshotDoc.id,
        ...snapshotDoc.data(),
      })) as House[]);
    } catch {
      return [];
    }
  }

  static async getAll(): Promise<House[]> {
    if (typeof window !== 'undefined') {
      if (this.sharedHouses) return this.sharedHouses;
      if (this.pendingSharedRefresh) return this.pendingSharedRefresh;
      return this.waitForSharedHouses();
    }
    return this.getAllForCache();
  }

  static async getById(id: string): Promise<House | null> {
    if (typeof window !== 'undefined') {
      return (await this.getAll()).find(house => house.id === id) ?? null;
    }
    const snapshot = await getDoc(doc(db, COLLECTION, id));
    if (!snapshot.exists()) return null;
    return normaliseHouses([{ id: snapshot.id, ...snapshot.data() } as House])[0] ?? null;
  }

  static async create(
    payload: Omit<House, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<House> {
    const now = Timestamp.now();
    const documentRef = doc(collection(db, COLLECTION));
    const batch = writeBatch(db);
    batch.set(documentRef, { ...payload, createdAt: now, updatedAt: now });
    bumpHousesRevisionInBatch(batch);
    await batch.commit();

    return normaliseHouses([{
      id: documentRef.id,
      ...payload,
      createdAt: now.toDate().toISOString(),
      updatedAt: now.toDate().toISOString(),
    }])[0];
  }

  static async update(
    id: string,
    payload: Partial<Omit<House, 'id' | 'createdAt'>>,
  ): Promise<House> {
    const updatedAt = Timestamp.now();
    const batch = writeBatch(db);
    batch.update(doc(db, COLLECTION, id), { ...payload, updatedAt });
    bumpHousesRevisionInBatch(batch);
    await batch.commit();

    const existing = this.sharedHouses?.find(house => house.id === id);
    return normaliseHouses([{
      ...(existing ?? {}),
      ...payload,
      id,
      updatedAt: updatedAt.toDate().toISOString(),
    } as House])[0];
  }

  static async remove(id: string): Promise<void> {
    const batch = writeBatch(db);
    batch.delete(doc(db, COLLECTION, id));
    bumpHousesRevisionInBatch(batch);
    await batch.commit();
  }
}

