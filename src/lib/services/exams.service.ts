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
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Exam, ExamResult, CreateExamData, UpdateExamData } from '@/types';

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
      
      const docRef = await addDoc(examsRef, cleanedData);
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating exam:', error);
      throw error;
    }
  }

  static async createMultipleExams(examsData: CreateExamData[]): Promise<string[]> {
    try {
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
      
      await batch.commit();
      return examIds;
    } catch (error) {
      console.error('Error creating multiple exams:', error);
      throw error;
    }
  }

  static async updateExam(id: string, examData: UpdateExamData): Promise<void> {
    try {
      const examRef = doc(db, this.COLLECTION_NAME, id);
      const updateData = {
        ...examData,
        updatedAt: Timestamp.now()
      };
      
      // Clean undefined values before sending to Firebase
      const cleanedData = this.cleanUndefinedValues(updateData);
      
      await updateDoc(examRef, cleanedData);
    } catch (error) {
      console.error('Error updating exam:', error);
      throw error;
    }
  }

  static async deleteExam(id: string): Promise<void> {
    try {
      const examRef = doc(db, this.COLLECTION_NAME, id);
      await deleteDoc(examRef);
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
      return {
        id: doc.id,
        ...doc.data(),
        recordedAt: doc.data().recordedAt?.toDate?.()?.toISOString() || doc.data().recordedAt
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
      
      await updateDoc(resultRef, cleanedData);
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

  // Add new method to fetch pupil's exam history
  static async getPupilExamHistory(pupilId: string, currentExamId?: string): Promise<{examResults: ExamResult[], exams: Exam[]}> {
    try {
      const resultsRef = collection(db, this.EXAM_RESULTS_COLLECTION);
      
      // Get all exam results that include this pupil
      const resultsSnapshot = await getDocs(query(resultsRef));
      
      const relevantResults: ExamResult[] = [];
      const examIds = new Set<string>();
      
      // Filter results that contain the pupil
      for (const docSnapshot of resultsSnapshot.docs) {
        const result = docSnapshot.data() as ExamResult;
        
        // Skip the current exam if specified
        if (currentExamId && result.examId === currentExamId) {
          continue;
        }
        
        // Check if pupil exists in pupilSnapshots
        if (result.pupilSnapshots && Array.isArray(result.pupilSnapshots)) {
          const hasPupil = result.pupilSnapshots.some(
            (pupil: any) => pupil.pupilId === pupilId
          );
          
          if (hasPupil) {
            examIds.add(result.examId);
            relevantResults.push({
              ...result,
              id: docSnapshot.id,
              recordedAt: typeof result.recordedAt === 'string' 
                ? result.recordedAt 
                : (result.recordedAt as any)?.toDate?.()?.toISOString() || result.recordedAt
            });
          }
        }
      }
      
      // Fetch the exam details for each exam
      const exams: Exam[] = [];
      for (const examId of examIds) {
        const exam = await this.getExamById(examId);
        if (exam) {
          exams.push(exam);
        }
      }
      
      return {
        examResults: relevantResults,
        exams
      };
    } catch (error) {
      console.error('Error fetching pupil exam history:', error);
      throw error;
    }
  }
} 