import {
  collection,
  doc,
  getDocs,
  getDoc,
  getDocsFromCache,
  query,
  where,
  orderBy,
  runTransaction,
  Timestamp,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Exam, ExamResult, CreateExamData, UpdateExamData } from '@/types';
import { normaliseExams } from '@/lib/cache/exam-cache';
import { getDocsFromServerWithTimeout } from '../utils/firestore-helpers';
import {
  bumpExamDefinitionRevisionsInBatch,
  bumpExamResultRevisionInBatch,
} from './dashboard-cache-revisions.service';
import { ExamLeaseService, type ExamLeaseToken } from './exam-lease.service';

export class ExamsService {
  private static readonly COLLECTION_NAME = 'exams';
  private static readonly EXAM_RESULTS_COLLECTION = 'examResults';
  private static sharedExams: Exam[] | null = null;
  private static pendingSharedRefresh: Promise<Exam[]> | null = null;
  private static sharedReadyPromise: Promise<Exam[]> | null = null;
  private static resolveSharedReady: ((exams: Exam[]) => void) | null = null;
  private static rejectSharedReady: ((error: unknown) => void) | null = null;

  private static waitForSharedExams(): Promise<Exam[]> {
    if (!this.sharedReadyPromise) {
      this.sharedReadyPromise = new Promise<Exam[]>((resolve, reject) => {
        this.resolveSharedReady = resolve;
        this.rejectSharedReady = reject;
      });
    }
    return this.sharedReadyPromise;
  }

  /** Makes the scoped bootstrap snapshot available to legacy browser callers. */
  static hydrateSharedExams(exams: Exam[]): void {
    this.sharedExams = normaliseExams(exams);
    this.resolveSharedReady?.(this.sharedExams);
    this.resolveSharedReady = null;
    this.rejectSharedReady = null;
    this.sharedReadyPromise = Promise.resolve(this.sharedExams);
  }

  static clearSharedExams(): void {
    this.resolveSharedReady?.([]);
    this.sharedExams = null;
    this.pendingSharedRefresh = null;
    this.sharedReadyPromise = null;
    this.resolveSharedReady = null;
    this.rejectSharedReady = null;
  }

  /** The central bootstrap is the only browser path allowed to refresh exams. */
  static refreshSharedExams(load: () => Promise<Exam[]>): Promise<Exam[]> {
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

  /** Strict collection read used only by the exam-cache bootstrap. */
  static async getAllForCache(): Promise<Exam[]> {
    const examsQuery = query(collection(db, this.COLLECTION_NAME), orderBy('createdAt', 'desc'));
    return normaliseExams(await getDocsFromServerWithTimeout<Exam>(examsQuery, 30000));
  }

  /** Free Firestore IndexedDB recovery while a cold local snapshot is rebuilt. */
  static async getAllFromFirestoreCache(): Promise<Exam[]> {
    try {
      const examsQuery = query(collection(db, this.COLLECTION_NAME), orderBy('createdAt', 'desc'));
      const snapshot = await getDocsFromCache(examsQuery);
      return normaliseExams(snapshot.docs.map(snapshotDoc => ({
        id: snapshotDoc.id,
        ...snapshotDoc.data(),
      })) as Exam[]);
    } catch {
      return [];
    }
  }

  // Exam CRUD Operations
  static async getAllExams(): Promise<Exam[]> {
    if (typeof window !== 'undefined') {
      if (this.sharedExams) return this.sharedExams;
      if (this.pendingSharedRefresh) return this.pendingSharedRefresh;
      return this.waitForSharedExams();
    }

    return this.getAllForCache();
  }

  static async getExamById(id: string): Promise<Exam | null> {
    if (typeof window !== 'undefined') {
      return (await this.getAllExams()).find(exam => exam.id === id) ?? null;
    }

    try {
      const examRef = doc(db, this.COLLECTION_NAME, id);
      const snapshot = await getDoc(examRef);

      if (!snapshot.exists()) {
        return null;
      }

      return normaliseExams([{
        id: snapshot.id,
        ...snapshot.data(),
      } as Exam])[0] ?? null;
    } catch (error) {
      console.error('Error fetching exam:', error);
      throw error;
    }
  }

  /**
   * A guarded point-read used only to repair a missing individual definition.
   * Normal page loads use the scoped exam snapshot owned by the cache bootstrap.
   */
  static async getExamByIdForCacheRecovery(id: string): Promise<Exam | null> {
    try {
      const snapshot = await getDoc(doc(db, this.COLLECTION_NAME, id));
      if (!snapshot.exists()) return null;
      return normaliseExams([{ id: snapshot.id, ...snapshot.data() } as Exam])[0] ?? null;
    } catch (error) {
      console.error('Error recovering exam definition:', error);
      throw error;
    }
  }

  static async getExamsByClass(classId: string): Promise<Exam[]> {
    if (typeof window !== 'undefined') {
      return (await this.getAllExams()).filter(exam => exam.classId === classId);
    }

    try {
      const examsRef = collection(db, this.COLLECTION_NAME);
      const q = query(examsRef, where('classId', '==', classId));
      const snapshot = await getDocs(q);

      return normaliseExams(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Exam[]);
    } catch (error) {
      console.error('Error fetching exams by class:', error);
      throw error;
    }
  }

  static async getExamsByAcademicYear(academicYearId: string): Promise<Exam[]> {
    if (typeof window !== 'undefined') {
      return (await this.getAllExams()).filter(exam => exam.academicYearId === academicYearId);
    }

    try {
      const examsRef = collection(db, this.COLLECTION_NAME);
      const q = query(
        examsRef,
        where('academicYearId', '==', academicYearId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);

      return normaliseExams(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Exam[]);
    } catch (error) {
      console.error('Error fetching exams by academic year:', error);
      throw error;
    }
  }

  // 🚀 OPTIMIZED: Get exams by academic year and optionally by term
  static async getExamsByAcademicYearAndTerm(academicYearId: string, termId?: string): Promise<Exam[]> {
    if (typeof window !== 'undefined') {
      return (await this.getAllExams()).filter(exam =>
        exam.academicYearId === academicYearId && (!termId || exam.termId === termId),
      );
    }

    try {
      console.log('🎯 Fetching exams with filters:', { academicYearId, termId });

      const examsRef = collection(db, this.COLLECTION_NAME);
      let q;

      if (termId) {
        // Filter by both academic year and term
        q = query(
          examsRef,
          where('academicYearId', '==', academicYearId),
          where('termId', '==', termId)
        );
      } else {
        // Filter by academic year only
        q = query(examsRef, where('academicYearId', '==', academicYearId));
      }

      const snapshot = await getDocs(q);

      const exams = normaliseExams(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Exam[]);

      console.log(`📊 Fetched ${exams.length} exams from database`);

      return exams;
    } catch (error) {
      console.error('Error fetching exams by academic year and term:', error);
      throw error;
    }
  }

  static async getExamsByBatch(batchId: string): Promise<Exam[]> {
    if (typeof window !== 'undefined') {
      return (await this.getAllExams()).filter(exam => exam.batchId === batchId);
    }

    try {
      const examsRef = collection(db, this.COLLECTION_NAME);
      const q = query(
        examsRef,
        where('batchId', '==', batchId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);

      return normaliseExams(snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Exam[]);
    } catch (error) {
      console.error('Error fetching exams by batch:', error);
      throw error;
    }
  }

  static async createExam(examData: CreateExamData): Promise<string> {
    try {
      const examsRef = collection(db, this.COLLECTION_NAME);
      const newExam = {
        ...examData,
        createdAt: Timestamp.now()
      };

      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(newExam);

      const docRef = doc(examsRef);
      const batch = writeBatch(db);
      batch.set(docRef, cleanedData);
      bumpExamDefinitionRevisionsInBatch(batch);
      await batch.commit();

      return docRef.id;
    } catch (error) {
      console.error('Error creating exam:', error);
      throw error;
    }
  }

  static async createMultipleExams(examsData: CreateExamData[]): Promise<string[]> {
    try {
      if (examsData.length > 499) {
        throw new Error('A maximum of 499 exams can be created atomically.');
      }
      const batch = writeBatch(db);
      const examIds: string[] = [];

      for (const examData of examsData) {
        const examRef = doc(collection(db, this.COLLECTION_NAME));
        const newExam = {
          ...examData,
          createdAt: Timestamp.now()
        };

        // Clean undefined values before sending to Firebase
        const cleanedData = this.cleanUndefinedValues(newExam);

        batch.set(examRef, cleanedData);
        examIds.push(examRef.id);
      }

      bumpExamDefinitionRevisionsInBatch(batch);
      await batch.commit();
      return examIds;
    } catch (error) {
      console.error('Error creating multiple exams:', error);
      throw error;
    }
  }

  static async updateExam(
    id: string,
    examData: UpdateExamData,
    options?: {
      linkedEvent?: { ref: DocumentReference; data: Record<string, any> };
    },
  ): Promise<void> {
    try {
      const examRef = doc(db, this.COLLECTION_NAME, id);
      const updateData = {
        ...examData,
        updatedAt: Timestamp.now()
      };

      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(updateData);

      const batch = writeBatch(db);
      batch.update(examRef, cleanedData);
      if (options?.linkedEvent) {
        batch.update(options.linkedEvent.ref, options.linkedEvent.data);
      }
      bumpExamDefinitionRevisionsInBatch(batch);
      await batch.commit();
    } catch (error) {
      console.error('Error updating exam:', error);
      throw error;
    }
  }

  static async deleteExam(id: string): Promise<void> {
    try {
      const examRef = doc(db, this.COLLECTION_NAME, id);
      const batch = writeBatch(db);
      batch.delete(examRef);
      bumpExamDefinitionRevisionsInBatch(batch);
      await batch.commit();
    } catch (error) {
      console.error('Error deleting exam:', error);
      throw error;
    }
  }

  // Exam Results Operations
  private static normaliseExamResult(id: string, data: Record<string, any>): ExamResult {
    const toIso = (value: unknown) => {
      if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
        return value.toDate().toISOString();
      }
      return value instanceof Date ? value.toISOString() : value;
    };

    return {
      id,
      ...data,
      recordedAt: (toIso(data.recordedAt) || '') as string,
      lastUpdatedAt: toIso(data.lastUpdatedAt ?? data.updatedAt) as string | undefined,
      releasedAt: toIso(data.releasedAt) as string | undefined,
    } as ExamResult;
  }

  private static async resolveResultPeriod(
    examId: string,
    supplied?: Pick<Partial<ExamResult>, 'academicYearId' | 'termId'>,
  ): Promise<{ academicYearId: string; termId: string }> {
    if (supplied?.academicYearId && supplied?.termId) {
      return { academicYearId: supplied.academicYearId, termId: supplied.termId };
    }

    const exam = await this.getExamById(examId);
    if (!exam?.academicYearId || !exam.termId) {
      throw new Error(`Cannot publish an exam-result revision because exam ${examId} has no academic year and term.`);
    }
    return { academicYearId: exam.academicYearId, termId: exam.termId };
  }

  /** Canonical documents use the exam ID; legacy auto-ID documents are a temporary fallback. */
  static async getExamResultByExamId(examId: string): Promise<ExamResult | null> {
    try {
      const canonical = await getDoc(doc(db, this.EXAM_RESULTS_COLLECTION, examId));
      if (canonical.exists()) return this.normaliseExamResult(canonical.id, canonical.data());

      const legacy = await getDocs(query(
        collection(db, this.EXAM_RESULTS_COLLECTION),
        where('examId', '==', examId),
      ));
      if (legacy.empty) return null;

      console.info(`[exam-result] Legacy result fallback used for ${examId}.`);
      const legacyDoc = legacy.docs[0];
      return this.normaliseExamResult(legacyDoc.id, legacyDoc.data());
    } catch (error) {
      console.error('Error fetching exam result by exam ID:', error);
      throw error;
    }
  }

  static async getAllExamResults(): Promise<ExamResult[]> {
    try {
      const resultsRef = collection(db, this.EXAM_RESULTS_COLLECTION);
      const q = query(resultsRef, orderBy('recordedAt', 'desc'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(snapshotDoc => this.normaliseExamResult(snapshotDoc.id, snapshotDoc.data()));
    } catch (error) {
      console.error('Error fetching exam results:', error);
      throw error;
    }
  }

  static async getExamResultById(id: string): Promise<ExamResult | null> {
    try {
      const resultRef = doc(db, this.EXAM_RESULTS_COLLECTION, id);
      const snapshot = await getDoc(resultRef);

      if (!snapshot.exists()) {
        return null;
      }

      return this.normaliseExamResult(snapshot.id, snapshot.data());
    } catch (error) {
      console.error('Error fetching exam result:', error);
      throw error;
    }
  }

  private static async getLegacyExamResultByExamId(examId: string): Promise<ExamResult | null> {
    try {
      const resultsRef = collection(db, this.EXAM_RESULTS_COLLECTION);
      const q = query(resultsRef, where('examId', '==', examId));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();
      console.log('🔍 Firestore returned exam result with gradingScale:', data.gradingScale);
      return {
        id: doc.id,
        ...data,
        recordedAt: data.recordedAt?.toDate?.()?.toISOString() || data.recordedAt
      } as ExamResult;
    } catch (error) {
      console.error('Error fetching exam result by exam ID:', error);
      throw error;
    }
  }

  static async createExamResult(resultData: Omit<ExamResult, 'id'>): Promise<ExamResult> {
    try {
      const period = await this.resolveResultPeriod(resultData.examId, resultData);
      const newResult = {
        ...resultData,
        ...period,
        recordedAt: resultData.recordedAt ? resultData.recordedAt : Timestamp.now(),
      };
      const cleanedData = this.cleanUndefinedValues(newResult);
      const resultRef = doc(db, this.EXAM_RESULTS_COLLECTION, resultData.examId);
      const batch = writeBatch(db);
      batch.set(resultRef, cleanedData, { merge: true });
      bumpExamResultRevisionInBatch(batch, period.academicYearId, period.termId);
      await batch.commit();
      return this.normaliseExamResult(resultRef.id, cleanedData);
    } catch (error) {
      console.error('Error creating exam result:', error);
      throw error;
    }
  }

  static async updateExamResult(
    id: string,
    resultData: Partial<ExamResult>,
    options?: { lease?: ExamLeaseToken },
  ): Promise<{
    id: string;
    examId: string;
    academicYearId: string;
    termId: string;
    patch: Partial<ExamResult>;
  }> {
    try {
      if (!resultData.examId) throw new Error('Exam result updates require the exam ID.');
      const period = await this.resolveResultPeriod(resultData.examId, resultData);
      const resultRef = doc(db, this.EXAM_RESULTS_COLLECTION, id);
      const updateData = {
        ...resultData,
        ...period,
        lastUpdatedAt: Timestamp.now(),
      };

      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(updateData);

      console.log('📝 Firestore updateExamResult - cleanedData.gradingScale:', cleanedData.gradingScale);

      if (options?.lease) {
        await runTransaction(db, async transaction => {
          await ExamLeaseService.verifyForSave(resultData.examId!, options.lease!, transaction);
          transaction.update(resultRef, cleanedData);
          bumpExamResultRevisionInBatch(transaction, period.academicYearId, period.termId);
          transaction.delete(ExamLeaseService.ref(resultData.examId!));
        });
        // Saving releases the active editor lease atomically. Dispatching is
        // best-effort; the server checks that no editor has acquired it again
        // before it sends any waiting-user notification.
        void ExamLeaseService.notifyUnlockWaiters(resultData.examId!);
      } else {
        const batch = writeBatch(db);
        batch.update(resultRef, cleanedData);
        bumpExamResultRevisionInBatch(batch, period.academicYearId, period.termId);
        await batch.commit();
      }
      return {
        id,
        examId: resultData.examId,
        ...period,
        patch: this.normaliseExamResult(id, cleanedData),
      };

      console.log('✅ Firestore update complete for document:', id);
    } catch (error) {
      console.error('Error updating exam result:', error);
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

  static async deleteExamResult(
    id: string,
    context?: Pick<ExamResult, 'examId' | 'academicYearId' | 'termId'>,
  ): Promise<{ id: string; examId: string; academicYearId: string; termId: string }> {
    try {
      const resultRef = doc(db, this.EXAM_RESULTS_COLLECTION, id);
      let resolved = context;
      if (!resolved?.examId || !resolved.academicYearId || !resolved.termId) {
        const existing = await getDoc(resultRef);
        if (!existing.exists()) throw new Error('Exam result was already deleted.');
        resolved = this.normaliseExamResult(existing.id, existing.data());
      }
      const period = await this.resolveResultPeriod(resolved.examId, resolved);
      const batch = writeBatch(db);
      batch.delete(resultRef);
      bumpExamResultRevisionInBatch(batch, period.academicYearId, period.termId);
      await batch.commit();
      return { id, examId: resolved.examId, ...period };
    } catch (error) {
      console.error('Error deleting exam result:', error);
      throw error;
    }
  }

  // 🚀 OPTIMIZED: Fetch pupil's exam history efficiently
  // Searches across ALL classes the pupil has been in (handles promotions/transfers)
  static async getPupilExamHistory(pupilId: string, currentExamId?: string): Promise<{ examResults: ExamResult[], exams: Exam[] }> {
    try {
      const startTime = performance.now();

      // Step 1: Get pupil's data including promotion history
      const { PupilsService } = await import('./pupils.service');
      const pupil = await PupilsService.getPupilById(pupilId);

      if (!pupil || !pupil.classId) {
        console.log('⚠️ Pupil not found or has no class, returning empty history');
        return { examResults: [], exams: [] };
      }

      // Collect ALL class IDs the pupil has been in (current + historical)
      const allClassIds = new Set<string>();
      allClassIds.add(pupil.classId); // Current class

      if (pupil.promotionHistory && Array.isArray(pupil.promotionHistory)) {
        pupil.promotionHistory.forEach((entry: any) => {
          if (entry.fromClassId) allClassIds.add(entry.fromClassId);
          if (entry.toClassId) allClassIds.add(entry.toClassId);
        });
      }

      console.log(`⚡ OPTIMIZED: Fetching exam history for pupil ${pupilId} across ${allClassIds.size} classes`);

      // Step 2: Get all exams for ALL classes the pupil has ever been in
      const classExamPromises = Array.from(allClassIds).map(classId => this.getExamsByClass(classId));
      const classExamArrays = await Promise.all(classExamPromises);
      const allClassExams = classExamArrays.flat();

      // Deduplicate exams by ID
      const uniqueExamsMap = new Map(allClassExams.map(e => [e.id, e]));
      const classExams = Array.from(uniqueExamsMap.values());
      console.log(`✅ Found ${classExams.length} exams across ${allClassIds.size} classes`);

      // Step 3: Get exam results for these exams in parallel (much faster than fetching all)
      const resultsRef = collection(db, this.EXAM_RESULTS_COLLECTION);
      const examIds = classExams.map(exam => exam.id).filter(id => !currentExamId || id !== currentExamId);

      // Fetch exam results for all exams in this class in parallel
      const examResultPromises = examIds.map(async (examId) => {
        try {
          const q = query(resultsRef, where('examId', '==', examId));
          const snapshot = await getDocs(q);

          if (snapshot.empty) {
            console.log(`🔍 No exam result document found for exam ${examId}`);
            return null;
          }

          const resultDoc = snapshot.docs[0];
          const result = resultDoc.data() as ExamResult;

          // Debug: Log what fields are available
          const hasSnapshots = result.pupilSnapshots && Array.isArray(result.pupilSnapshots);
          const hasResults = result.results && typeof result.results === 'object';
          const snapshotPupilIds = hasSnapshots ? result.pupilSnapshots!.map((p: any) => p.pupilId).slice(0, 5) : [];
          const resultPupilIds = hasResults ? Object.keys(result.results!).slice(0, 5) : [];
          console.log(`🔍 Exam ${examId} result doc ${resultDoc.id}:`, {
            hasSnapshots,
            snapshotCount: hasSnapshots ? result.pupilSnapshots!.length : 0,
            sampleSnapshotIds: snapshotPupilIds,
            hasResults,
            resultKeysCount: hasResults ? Object.keys(result.results!).length : 0,
            sampleResultIds: resultPupilIds,
            lookingForPupilId: pupilId
          });

          // Check if pupil exists in pupilSnapshots OR in results
          let hasPupil = false;

          // First check pupilSnapshots array
          if (result.pupilSnapshots && Array.isArray(result.pupilSnapshots)) {
            hasPupil = result.pupilSnapshots.some(
              (pupil: any) => pupil.pupilId === pupilId
            );
          }

          // If not found in snapshots, check if pupil has results recorded
          if (!hasPupil && result.results && typeof result.results === 'object') {
            hasPupil = pupilId in result.results;
          }

          if (hasPupil) {
            console.log(`✅ Pupil ${pupilId} FOUND in exam ${examId}`);
            return {
              ...result,
              id: resultDoc.id,
              recordedAt: typeof result.recordedAt === 'string'
                ? result.recordedAt
                : (result.recordedAt as any)?.toDate?.()?.toISOString() || result.recordedAt
            } as ExamResult;
          }

          console.log(`❌ Pupil ${pupilId} NOT found in exam ${examId}`);
          return null;
        } catch (error) {
          console.warn(`Failed to fetch result for exam ${examId}:`, error);
          return null;
        }
      });

      const examResults = (await Promise.all(examResultPromises)).filter(Boolean) as ExamResult[];
      console.log(`✅ Found ${examResults.length} exam results for pupil ${pupilId}`);

      // Step 4: Get exam details - we already have them from classExams, just filter
      const relevantExamIds = new Set(examResults.map(r => r.examId));
      const exams = classExams.filter(exam => relevantExamIds.has(exam.id));

      const endTime = performance.now();
      console.log(`⚡ OPTIMIZED getPupilExamHistory completed in ${(endTime - startTime).toFixed(2)}ms (${examResults.length} results, ${exams.length} exams)`);

      return {
        examResults,
        exams
      };
    } catch (error) {
      console.error('Error fetching pupil exam history:', error);
      throw error;
    }
  }
}
