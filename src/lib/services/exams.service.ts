import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Exam, ExamResult, CreateExamData, UpdateExamData } from '@/types';
import { bumpEventsRevisionInBatch } from './dashboard-cache-revisions.service';

export class ExamsService {
  private static readonly COLLECTION_NAME = 'exams';
  private static readonly EXAM_RESULTS_COLLECTION = 'examResults';

  // Exam CRUD Operations
  static async getAllExams(): Promise<Exam[]> {
    try {
      const examsRef = collection(db, this.COLLECTION_NAME);
      const q = query(examsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
      })) as Exam[];
    } catch (error) {
      console.error('Error fetching exams:', error);
      throw error;
    }
  }

  static async getExamById(id: string): Promise<Exam | null> {
    try {
      const examRef = doc(db, this.COLLECTION_NAME, id);
      const snapshot = await getDoc(examRef);

      if (!snapshot.exists()) {
        return null;
      }

      return {
        id: snapshot.id,
        ...snapshot.data(),
        createdAt: snapshot.data().createdAt?.toDate?.()?.toISOString() || snapshot.data().createdAt
      } as Exam;
    } catch (error) {
      console.error('Error fetching exam:', error);
      throw error;
    }
  }

  static async getExamsByClass(classId: string): Promise<Exam[]> {
    try {
      const examsRef = collection(db, this.COLLECTION_NAME);
      const q = query(examsRef, where('classId', '==', classId));
      const snapshot = await getDocs(q);

      const exams = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
      })) as Exam[];

      // Sort by createdAt in descending order on the client side
      return exams.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA; // Descending order
      });
    } catch (error) {
      console.error('Error fetching exams by class:', error);
      throw error;
    }
  }

  static async getExamsByAcademicYear(academicYearId: string): Promise<Exam[]> {
    try {
      const examsRef = collection(db, this.COLLECTION_NAME);
      const q = query(
        examsRef,
        where('academicYearId', '==', academicYearId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
      })) as Exam[];
    } catch (error) {
      console.error('Error fetching exams by academic year:', error);
      throw error;
    }
  }

  // 🚀 OPTIMIZED: Get exams by academic year and optionally by term
  static async getExamsByAcademicYearAndTerm(academicYearId: string, termId?: string): Promise<Exam[]> {
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

      const exams = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
      })) as Exam[];

      console.log(`📊 Fetched ${exams.length} exams from database`);

      // Sort by createdAt in descending order on the client side
      return exams.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA; // Descending order
      });
    } catch (error) {
      console.error('Error fetching exams by academic year and term:', error);
      throw error;
    }
  }

  static async getExamsByBatch(batchId: string): Promise<Exam[]> {
    try {
      const examsRef = collection(db, this.COLLECTION_NAME);
      const q = query(
        examsRef,
        where('batchId', '==', batchId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
      })) as Exam[];
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
      bumpEventsRevisionInBatch(batch);
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

      bumpEventsRevisionInBatch(batch);
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
      bumpEventRevision?: boolean;
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
      if (options?.bumpEventRevision !== false) {
        bumpEventsRevisionInBatch(batch);
      }
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
      bumpEventsRevisionInBatch(batch);
      await batch.commit();
    } catch (error) {
      console.error('Error deleting exam:', error);
      throw error;
    }
  }

  // Exam Results Operations
  static async getAllExamResults(): Promise<ExamResult[]> {
    try {
      const resultsRef = collection(db, this.EXAM_RESULTS_COLLECTION);
      const q = query(resultsRef, orderBy('recordedAt', 'desc'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        recordedAt: doc.data().recordedAt?.toDate?.()?.toISOString() || doc.data().recordedAt
      })) as ExamResult[];
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

      return {
        id: snapshot.id,
        ...snapshot.data(),
        recordedAt: snapshot.data().recordedAt?.toDate?.()?.toISOString() || snapshot.data().recordedAt
      } as ExamResult;
    } catch (error) {
      console.error('Error fetching exam result:', error);
      throw error;
    }
  }

  static async getExamResultByExamId(examId: string): Promise<ExamResult | null> {
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

  static async createExamResult(resultData: Omit<ExamResult, 'id'>): Promise<string> {
    try {
      const resultsRef = collection(db, this.EXAM_RESULTS_COLLECTION);
      const newResult = {
        ...resultData,
        recordedAt: resultData.recordedAt ? resultData.recordedAt : Timestamp.now()
      };

      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(newResult);

      const docRef = await addDoc(resultsRef, cleanedData);

      return docRef.id;
    } catch (error) {
      console.error('Error creating exam result:', error);
      throw error;
    }
  }

  static async updateExamResult(id: string, resultData: Partial<ExamResult>): Promise<void> {
    try {
      const resultRef = doc(db, this.EXAM_RESULTS_COLLECTION, id);
      const updateData = {
        ...resultData,
        updatedAt: Timestamp.now()
      };

      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(updateData);

      console.log('📝 Firestore updateExamResult - cleanedData.gradingScale:', cleanedData.gradingScale);

      await updateDoc(resultRef, cleanedData);

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

  static async deleteExamResult(id: string): Promise<void> {
    try {
      const resultRef = doc(db, this.EXAM_RESULTS_COLLECTION, id);
      await deleteDoc(resultRef);
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
