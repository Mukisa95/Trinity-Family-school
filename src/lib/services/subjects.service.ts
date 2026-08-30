import {
  collection,
  doc,
  getDoc,
  getDocsFromCache,
  orderBy,
  query,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Subject } from '@/types';
import { getDocsFromServerWithTimeout } from '../utils/firestore-helpers';
import { normaliseSubjects } from '@/lib/cache/subject-cache';
import { bumpSubjectsRevisionInBatch } from './dashboard-cache-revisions.service';

const COLLECTION_NAME = 'subjects';

export class SubjectsService {
  private static sharedSubjects: Subject[] | null = null;
  private static pendingSharedRefresh: Promise<Subject[]> | null = null;
  private static sharedReadyPromise: Promise<Subject[]> | null = null;
  private static resolveSharedReady: ((subjects: Subject[]) => void) | null = null;
  private static rejectSharedReady: ((error: unknown) => void) | null = null;

  private static waitForSharedSubjects(): Promise<Subject[]> {
    if (!this.sharedReadyPromise) {
      this.sharedReadyPromise = new Promise<Subject[]>((resolve, reject) => {
        this.resolveSharedReady = resolve;
        this.rejectSharedReady = reject;
      });
    }
    return this.sharedReadyPromise;
  }

  /** Makes the identity-scoped owner snapshot available to legacy callers. */
  static hydrateSharedSubjects(subjects: Subject[]): void {
    this.sharedSubjects = normaliseSubjects(subjects);
    this.resolveSharedReady?.(this.sharedSubjects);
    this.resolveSharedReady = null;
    this.rejectSharedReady = null;
    this.sharedReadyPromise = Promise.resolve(this.sharedSubjects);
  }

  static clearSharedSubjects(): void {
    this.resolveSharedReady?.([]);
    this.sharedSubjects = null;
    this.pendingSharedRefresh = null;
    this.sharedReadyPromise = null;
    this.resolveSharedReady = null;
    this.rejectSharedReady = null;
  }

  /** The central bootstrap is the only browser caller allowed to start a read. */
  static refreshSharedSubjects(load: () => Promise<Subject[]>): Promise<Subject[]> {
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

  /** Authoritative collection read used only by the subject cache owner. */
  static async getAllForCache(): Promise<Subject[]> {
    const subjectsQuery = query(collection(db, COLLECTION_NAME), orderBy('name', 'asc'));
    const subjects = await getDocsFromServerWithTimeout<Subject>(subjectsQuery, 30000);
    return normaliseSubjects(subjects);
  }

  /** Free IndexedDB recovery while a cold persistent snapshot is rebuilt. */
  static async getAllFromFirestoreCache(): Promise<Subject[]> {
    try {
      const subjectsQuery = query(collection(db, COLLECTION_NAME), orderBy('name', 'asc'));
      const snapshot = await getDocsFromCache(subjectsQuery);
      return normaliseSubjects(snapshot.docs.map(snapshotDoc => ({
        id: snapshotDoc.id,
        ...snapshotDoc.data(),
      })) as Subject[]);
    } catch {
      return [];
    }
  }

  static async getAllSubjects(): Promise<Subject[]> {
    if (typeof window !== 'undefined') {
      if (this.sharedSubjects) return this.sharedSubjects;
      if (this.pendingSharedRefresh) return this.pendingSharedRefresh;
      return this.waitForSharedSubjects();
    }
    return this.getAllForCache();
  }

  static async getSubjectById(id: string): Promise<Subject | null> {
    if (typeof window !== 'undefined') {
      return (await this.getAllSubjects()).find(subject => subject.id === id) ?? null;
    }

    const snapshot = await getDoc(doc(db, COLLECTION_NAME, id));
    if (!snapshot.exists()) return null;
    return normaliseSubjects([{ id: snapshot.id, ...snapshot.data() } as Subject])[0] ?? null;
  }

  static async createSubject(
    subjectData: Omit<Subject, 'id' | 'createdAt'>,
  ): Promise<Subject> {
    const createdAt = Timestamp.now();
    const documentRef = doc(collection(db, COLLECTION_NAME));
    const batch = writeBatch(db);
    batch.set(documentRef, this.cleanUndefinedValues({ ...subjectData, createdAt }));
    bumpSubjectsRevisionInBatch(batch);
    await batch.commit();

    return normaliseSubjects([{
      id: documentRef.id,
      ...subjectData,
      createdAt: createdAt.toDate().toISOString(),
    }])[0];
  }

  static async updateSubject(
    id: string,
    subjectData: Partial<Omit<Subject, 'id' | 'createdAt'>>,
  ): Promise<Subject> {
    const updateData = this.cleanUndefinedValues({
      ...subjectData,
      updatedAt: Timestamp.now(),
    });
    const batch = writeBatch(db);
    batch.update(doc(db, COLLECTION_NAME, id), updateData);
    bumpSubjectsRevisionInBatch(batch);
    await batch.commit();

    const existing = this.sharedSubjects?.find(subject => subject.id === id);
    return normaliseSubjects([{ ...(existing ?? {}), ...subjectData, id } as Subject])[0];
  }

  static async deleteSubject(id: string): Promise<void> {
    const batch = writeBatch(db);
    batch.delete(doc(db, COLLECTION_NAME, id));
    bumpSubjectsRevisionInBatch(batch);
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
