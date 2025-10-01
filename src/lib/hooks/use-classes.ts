import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClassesService } from '../services/classes.service';
import { useDigitalSignatureHelpers } from './use-digital-signature';
import { useAuth } from '../contexts/auth-context';
import type { Class } from '@/types';

// Query keys
export const classesKeys = {
  all: ['classes'] as const,
  lists: () => [...classesKeys.all, 'list'] as const,
  list: (filters: string) => [...classesKeys.lists(), { filters }] as const,
  details: () => [...classesKeys.all, 'detail'] as const,
  detail: (id: string) => [...classesKeys.details(), id] as const,
  byLevel: (level: string) => [...classesKeys.all, 'byLevel', level] as const,
};

// Hooks
export function useClasses() {
  return useQuery({
    queryKey: classesKeys.lists(),
    queryFn: async () => {
      console.log('📚 Loading classes...');
      const classes = await ClassesService.getAll();
      console.log('✅ Classes loaded:', classes.length);
      return classes;
    },
    staleTime: 15 * 60 * 1000, // 15 minutes - classes rarely change
    gcTime: 30 * 60 * 1000, // 30 minutes cache
  });
}

export function useClass(id: string) {
  return useQuery({
    queryKey: classesKeys.detail(id),
    queryFn: () => ClassesService.getById(id),
    enabled: !!id,
  });
}

export function useClassesByLevel(level: string) {
  return useQuery({
    queryKey: classesKeys.byLevel(level),
    queryFn: () => ClassesService.getByLevel(level),
    enabled: !!level,
  });
}

export function useCreateClass() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (classData: Omit<Class, 'id' | 'createdAt'>) => {
      const classId = await ClassesService.create(classData);
      
      // Create digital signature for class creation
      if (user) {
        await signAction(
          'class_creation',
          classId,
          'created',
          {
            className: classData.name,
            classCode: classData.code,
            level: classData.level,
            classTeacherId: classData.classTeacherId,
            classTeacherName: classData.classTeacherName,
            subjectCount: classData.subjectAssignments?.length || 0
          }
        );
      }
      
      return classId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: classesKeys.all });
    },
  });
}

export function useUpdateClass() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Omit<Class, 'id' | 'createdAt'>> }) => {
      await ClassesService.update(id, data);
      
      // Create digital signature for class modification
      if (user) {
        await signAction(
          'class_creation',
          id,
          'modified',
          {
            updatedFields: Object.keys(data),
            nameChanged: !!data.name,
            teacherChanged: !!data.classTeacherId,
            subjectsChanged: !!data.subjectAssignments,
            levelChanged: !!data.level
          }
        );
      }
      
      return id;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: classesKeys.all });
      queryClient.invalidateQueries({ queryKey: classesKeys.detail(id) });
    },
  });
}

export function useDeleteClass() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => ClassesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: classesKeys.all });
    },
  });
} 