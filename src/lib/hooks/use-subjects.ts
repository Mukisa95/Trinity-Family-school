import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { SubjectsService } from '../services/subjects.service';
import { useClassDetail } from './use-class-detail';
import type { Subject } from '@/types';

const SUBJECTS_QUERY_KEY = 'subjects';

export function useSubjects() {
  const queryClient = useQueryClient();

  // 🚀 CRITICAL: Get cached data immediately to avoid loading state
  const cachedData = queryClient.getQueryData<Subject[]>([SUBJECTS_QUERY_KEY]);

  // ⚡ Use preloaded data from GlobalDataPreloader
  return useQuery({
    queryKey: [SUBJECTS_QUERY_KEY],
    queryFn: async () => {
      // Check cache first (populated by GlobalDataPreloader)
      const currentCachedData = queryClient.getQueryData<Subject[]>([SUBJECTS_QUERY_KEY]);
      if (currentCachedData && currentCachedData.length > 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log('⚡ SUBJECTS: Loaded from cache (instant)');
        }
        return currentCachedData;
      }
      
      // Fallback to service if cache empty
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 SUBJECTS: Fetching from service...');
      }
      return SubjectsService.getAllSubjects();
    },
    staleTime: Infinity, // Never stale - updated by real-time listener
    gcTime: Infinity, // Keep in cache forever
    refetchOnMount: false, // Don't refetch when component mounts - use cache
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on reconnect
    // 🚀 CRITICAL: Use cached data as initialData to prevent loading state
    initialData: cachedData && cachedData.length > 0 ? cachedData : undefined,
    // 🚀 CRITICAL: Use cached data as placeholder to show immediately
    placeholderData: (previousData) => {
      // If we have cached data, use it immediately
      if (cachedData && cachedData.length > 0) {
        return cachedData;
      }
      // Otherwise use previous data if available
      return previousData;
    },
  });
}

export function useSubject(id: string) {
  return useQuery({
    queryKey: [SUBJECTS_QUERY_KEY, id],
    queryFn: () => SubjectsService.getSubjectById(id),
    enabled: !!id,
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (subjectData: Omit<Subject, 'id' | 'createdAt'>) =>
      SubjectsService.createSubject(subjectData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUBJECTS_QUERY_KEY] });
    },
  });
}

export function useUpdateSubject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<Subject, 'id' | 'createdAt'>> }) =>
      SubjectsService.updateSubject(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUBJECTS_QUERY_KEY] });
    },
  });
}

export function useDeleteSubject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => SubjectsService.deleteSubject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUBJECTS_QUERY_KEY] });
    },
  });
}

export function useSubjectsByClass(classId: string, options?: { enabled?: boolean }) {
  const { data: allSubjects = [] } = useSubjects();
  const { data: classDetail } = useClassDetail(classId);
  
  const subjectsWithTeachers = useMemo(() => {
    if (!classDetail?.subjectAssignments || !allSubjects.length) return [];
    
    return classDetail.subjectAssignments.map(assignment => {
      const subject = allSubjects.find(s => s.id === assignment.subjectId);
      if (!subject) return null;
      
      // Support both old format (teacherId) and new format (teacherIds)
      const teacherIds = Array.isArray(assignment.teacherIds) 
        ? assignment.teacherIds 
        : [];
      
      return {
        ...subject,
        teacherIds: teacherIds,
        teacherId: teacherIds[0] || null, // Keep for backward compatibility
        teacherName: null // Will be populated by staff data
      };
    }).filter((subject): subject is NonNullable<typeof subject> => subject !== null && !!subject.id);
  }, [classDetail?.subjectAssignments, allSubjects]);

  return {
    data: subjectsWithTeachers,
    isLoading: false,
    error: null
  };
} 