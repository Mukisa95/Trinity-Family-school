import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SubjectsService } from '../services/subjects.service';
import { useClassDetail } from './use-class-detail';
import { useMemo } from 'react';
import type { Subject } from '@/types';

const SUBJECTS_QUERY_KEY = 'subjects';

export function useSubjects() {
  return useQuery({
    queryKey: [SUBJECTS_QUERY_KEY],
    queryFn: SubjectsService.getAllSubjects,
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
      return {
        ...subject,
        teacherId: assignment.teacherId,
        teacherName: null // Will be populated by staff data
      };
    }).filter(subject => subject.id); // Filter out undefined subjects
  }, [classDetail?.subjectAssignments, allSubjects]);

  return {
    data: subjectsWithTeachers,
    isLoading: false,
    error: null
  };
} 