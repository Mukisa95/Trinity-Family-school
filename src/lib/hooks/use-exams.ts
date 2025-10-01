import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ExamsService } from '../services/exams.service';
import { useDigitalSignatureHelpers } from './use-digital-signature';
import { useAuth } from '../contexts/auth-context';
import type { Exam, ExamResult, CreateExamData, UpdateExamData } from '@/types';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  deleteDoc, 
  updateDoc, 
  query, 
  where, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

// Query Keys
export const examKeys = {
  all: ['exams'] as const,
  lists: () => [...examKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...examKeys.lists(), { filters }] as const,
  details: () => [...examKeys.all, 'detail'] as const,
  detail: (id: string) => [...examKeys.details(), id] as const,
  byClass: (classId: string) => [...examKeys.all, 'byClass', classId] as const,
  byAcademicYear: (academicYearId: string) => [...examKeys.all, 'byAcademicYear', academicYearId] as const,
  byBatch: (batchId: string) => [...examKeys.all, 'byBatch', batchId] as const,
  pupilHistory: (pupilId: string) => [...examKeys.all, 'pupilHistory', pupilId] as const,
};

export const examResultKeys = {
  all: ['examResults'] as const,
  lists: () => [...examResultKeys.all, 'list'] as const,
  details: () => [...examResultKeys.all, 'detail'] as const,
  detail: (id: string) => [...examResultKeys.details(), id] as const,
  byExam: (examId: string) => [...examResultKeys.all, 'byExam', examId] as const,
};

// Exam Query Hooks
export function useExams() {
  return useQuery({
    queryKey: examKeys.lists(),
    queryFn: () => ExamsService.getAllExams(),
  });
}

// 🚀 OPTIMIZED: Fetch only current academic year and term exams by default
export function useExamsOptimized(options?: { 
  academicYearId?: string; 
  termId?: string; 
  enabled?: boolean;
  includeAll?: boolean;
}) {
  return useQuery({
    queryKey: examKeys.list({ 
      academicYearId: options?.academicYearId, 
      termId: options?.termId,
      includeAll: options?.includeAll 
    }),
    queryFn: async () => {
      // If includeAll is true or no filters provided, get all exams
      if (options?.includeAll || (!options?.academicYearId && !options?.termId)) {
        return ExamsService.getAllExams();
      }
      
      // Otherwise, get filtered exams
      return ExamsService.getExamsByAcademicYearAndTerm(
        options.academicYearId!, 
        options.termId
      );
    },
    enabled: options?.enabled !== false,
    staleTime: 2 * 60 * 1000, // 2 minutes cache
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // Don't retry if it's an offline error
      if (error?.message?.includes('offline') || 
          error?.message?.includes('Could not reach Cloud Firestore') ||
          (error as any)?.code === 'unavailable') {
        console.log('🚫 Offline detected, not retrying exam query');
        return false;
      }
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

export function useExam(id: string) {
  return useQuery({
    queryKey: examKeys.detail(id),
    queryFn: () => ExamsService.getExamById(id),
    enabled: !!id,
  });
}

export function useExamsByClass(classId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: examKeys.byClass(classId),
    queryFn: () => ExamsService.getExamsByClass(classId),
    enabled: options?.enabled !== undefined ? options.enabled && !!classId : !!classId,
  });
}

export function useExamsByAcademicYear(academicYearId: string) {
  return useQuery({
    queryKey: examKeys.byAcademicYear(academicYearId),
    queryFn: () => ExamsService.getExamsByAcademicYear(academicYearId),
    enabled: !!academicYearId,
  });
}

export function useExamsByBatch(batchId: string) {
  return useQuery({
    queryKey: examKeys.byBatch(batchId),
    queryFn: () => ExamsService.getExamsByBatch(batchId),
    enabled: !!batchId,
  });
}

// Exam Mutation Hooks
export function useCreateExam() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateExamData) => {
      const examId = await ExamsService.createExam(data);
      
      // Create digital signature for exam creation
      if (user) {
        await signAction(
          'exam_creation',
          examId,
          'created',
          {
            examName: data.name,
            classId: data.classId,
            examType: data.examTypeName || 'Unknown',
            maxMarks: data.maxMarks,
            startDate: data.startDate,
            academicYearId: data.academicYearId,
            termId: data.termId
          }
        );
      }
      
      return examId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: examKeys.all });
    },
  });
}

export function useCreateMultipleExams() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateExamData[]) => {
      const examIds = await ExamsService.createMultipleExams(data);
      
      // Create digital signatures for each exam creation
      if (user) {
        for (let i = 0; i < examIds.length; i++) {
          const examData = data[i];
          const examId = examIds[i];
          
          await signAction(
            'exam_creation',
            examId,
            'created',
            {
              examName: examData.name,
              classId: examData.classId,
              examType: examData.examTypeName || 'Unknown',
              maxMarks: examData.maxMarks,
              startDate: examData.startDate,
              academicYearId: examData.academicYearId,
              termId: examData.termId,
              batchId: examData.batchId
            }
          );
        }
      }
      
      return examIds;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: examKeys.all });
    },
  });
}

export function useUpdateExam() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateExamData }) => {
      try {
        // Update the exam
        const examId = await ExamsService.updateExam(id, data);
        
        // Check if this exam is part of a batch and update associated event
        const examDocRef = doc(db, 'exams', id);
        const examDoc = await getDoc(examDocRef);
        
        if (examDoc.exists()) {
          const examData = examDoc.data();
          const batchId = examData?.batchId;
          
          if (batchId) {
            // Find the associated event
            const eventsQuery = query(
              collection(db, 'events'),
              where('isExamEvent', '==', true),
              where('examIntegration.examIds', 'array-contains', id)
            );
            const eventsSnapshot = await getDocs(eventsQuery);
            
            if (!eventsSnapshot.empty) {
              const eventDoc = eventsSnapshot.docs[0];
              const eventUpdateData: any = {};
              
              // Update event fields that correspond to exam fields
              if (data.name) eventUpdateData.title = data.name;
              if (data.startDate) eventUpdateData.startDate = data.startDate;
              if (data.endDate) eventUpdateData.endDate = data.endDate;
              if (data.startTime) eventUpdateData.startTime = data.startTime;
              if (data.endTime) eventUpdateData.endTime = data.endTime;
              if (data.instructions) eventUpdateData.description = data.instructions;
              
              eventUpdateData.updatedAt = serverTimestamp();
              
              await updateDoc(eventDoc.ref, eventUpdateData);
              console.log(`Updated associated event ${eventDoc.id} with exam changes`);
            }
          }
        }
        
        return examId;
      } catch (error) {
        console.error('Error updating exam:', error);
        throw error;
      }
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: examKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: examKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['events'] }); // Also invalidate events
      toast({
        title: "Success",
        description: "Exam and associated event updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating exam:', error);
      toast({
        title: "Error",
        description: "Failed to update exam",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteExam() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (examId: string) => {
      try {
        // First, get the exam to check if it's part of a batch
        const examDocRef = doc(db, 'exams', examId);
        const examDoc = await getDoc(examDocRef);
        
        if (!examDoc.exists()) {
          throw new Error('Exam not found');
        }
        
        const examData = examDoc.data();
        const batchId = examData?.batchId;
        
        // Delete the exam
        await deleteDoc(examDocRef);
        console.log(`Deleted exam: ${examId}`);
        
        // If this exam was part of a batch, check if there are other exams in the same batch
        if (batchId) {
          // Query for other exams in the same batch
          const batchQuery = query(
            collection(db, 'exams'),
            where('batchId', '==', batchId)
          );
          const batchSnapshot = await getDocs(batchQuery);
          
          if (batchSnapshot.empty) {
            // No more exams in this batch, find and update/delete the associated event
            console.log(`No more exams in batch ${batchId}, updating associated event`);
            
            // Find the event that contains this batch
            const eventsQuery = query(
              collection(db, 'events'),
              where('isExamEvent', '==', true),
              where('examIntegration.examIds', 'array-contains', examId)
            );
            const eventsSnapshot = await getDocs(eventsQuery);
            
            if (!eventsSnapshot.empty) {
              const eventDoc = eventsSnapshot.docs[0];
              const eventData = eventDoc.data();
              
              // Remove the exam ID from the event's examIntegration.examIds
              const updatedExamIds = eventData.examIntegration?.examIds?.filter((id: string) => id !== examId) || [];
              
              if (updatedExamIds.length === 0) {
                // No more exams, delete the event
                await deleteDoc(eventDoc.ref);
                console.log(`Deleted event ${eventDoc.id} - no more exams in batch`);
              } else {
                // Update the event with remaining exam IDs
                await updateDoc(eventDoc.ref, {
                  'examIntegration.examIds': updatedExamIds,
                  updatedAt: serverTimestamp()
                });
                console.log(`Updated event ${eventDoc.id} with remaining exam IDs: ${updatedExamIds}`);
              }
            }
          } else {
            // There are still exams in the batch, update the associated event
            console.log(`Batch ${batchId} still has ${batchSnapshot.size} exams, updating associated event`);
            
            // Find the event that contains this batch
            const eventsQuery = query(
              collection(db, 'events'),
              where('isExamEvent', '==', true),
              where('examIntegration.examIds', 'array-contains', examId)
            );
            const eventsSnapshot = await getDocs(eventsQuery);
            
            if (!eventsSnapshot.empty) {
              const eventDoc = eventsSnapshot.docs[0];
              const eventData = eventDoc.data();
              
              // Remove the exam ID from the event's examIntegration.examIds
              const updatedExamIds = eventData.examIntegration?.examIds?.filter((id: string) => id !== examId) || [];
              
              await updateDoc(eventDoc.ref, {
                'examIntegration.examIds': updatedExamIds,
                updatedAt: serverTimestamp()
              });
              console.log(`Updated event ${eventDoc.id} with remaining exam IDs: ${updatedExamIds}`);
            }
          }
        }
        
        return examId;
      } catch (error) {
        console.error('Error deleting exam:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: examKeys.all });
      queryClient.invalidateQueries({ queryKey: ['events'] }); // Also invalidate events
      toast({
        title: "Success",
        description: "Exam and associated event updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error deleting exam:', error);
      toast({
        title: "Error",
        description: "Failed to delete exam",
        variant: "destructive",
      });
    },
  });
}

// Exam Results Query Hooks
export function useExamResults() {
  return useQuery({
    queryKey: examResultKeys.lists(),
    queryFn: () => ExamsService.getAllExamResults(),
  });
}

export function useExamResult(id: string) {
  return useQuery({
    queryKey: examResultKeys.detail(id),
    queryFn: () => ExamsService.getExamResultById(id),
    enabled: !!id,
  });
}

export function useExamResultByExamId(examId: string) {
  return useQuery({
    queryKey: examResultKeys.byExam(examId),
    queryFn: () => ExamsService.getExamResultByExamId(examId),
    enabled: !!examId,
  });
}

// Exam Results Mutation Hooks
export function useCreateExamResult() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: Omit<ExamResult, 'id'>) => {
      const resultId = await ExamsService.createExamResult(data);
      
      // Create digital signature for exam result recording
      if (user) {
        await signAction(
          'exam_result',
          resultId,
          'recorded',
          {
            examId: data.examId,
            classId: data.classId,
            pupilCount: data.pupilSnapshots?.length || 0,
            subjectCount: data.subjectSnapshots?.length || 0,
            isPublished: data.isPublished || false
          }
        );
      }
      
      return resultId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: examResultKeys.all });
    },
  });
}

export function useUpdateExamResult() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ExamResult> }) =>
      ExamsService.updateExamResult(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: examResultKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: examResultKeys.lists() });
    },
  });
}

export function useDeleteExamResult() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => ExamsService.deleteExamResult(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: examResultKeys.all });
    },
  });
}

// Add new hook for pupil exam history
export function usePupilExamHistory(pupilId: string, options?: { enabled?: boolean; currentExamId?: string }) {
  return useQuery({
    queryKey: examKeys.pupilHistory(pupilId),
    queryFn: () => ExamsService.getPupilExamHistory(pupilId, options?.currentExamId),
    enabled: !!pupilId && (options?.enabled !== false),
  });
} 