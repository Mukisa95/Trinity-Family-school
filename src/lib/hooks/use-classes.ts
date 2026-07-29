import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClassesService } from '../services/classes.service';
import { useDigitalSignatureHelpers } from './use-digital-signature';
import { useAuth } from '../contexts/auth-context';
import type { Class } from '@/types';
import { getClassCacheScope, readClassCache } from '@/lib/cache/class-cache';

// All ordinary consumers subscribe to this one identity-scoped list. The
// GlobalDataPreloader is the only owner allowed to reconcile it with Firestore.
export const classesKeys = {
  all: ['classes'] as const,
  lists: () => [...classesKeys.all, 'list'] as const,
  list: (scope: string) => [...classesKeys.lists(), scope] as const,
  details: () => [...classesKeys.all, 'detail'] as const,
  detail: (scope: string, id: string) => [...classesKeys.details(), scope, id] as const,
};

export function useClasses() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const scope = isAuthenticated ? getClassCacheScope(user?.id, user?.role) : '';
  const queryKey = classesKeys.list(scope);
  const inMemory = queryClient.getQueryData<Class[]>(queryKey);
  const persisted = inMemory === undefined ? readClassCache(scope) : null;
  const initialData = inMemory ?? persisted?.data;

  const query = useQuery({
    queryKey,
    // Deliberately cache-only. The global class-cache bootstrap owns the
    // single cold/revision fetch so individual pages cannot create private reads.
    queryFn: async () => queryClient.getQueryData<Class[]>(queryKey) ?? [],
    enabled: false,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    initialData,
    initialDataUpdatedAt: initialData !== undefined ? Date.now() : undefined,
    placeholderData: previousData => previousData,
  });

  return {
    ...query,
    isLoading: !!scope && query.data === undefined,
  };
}

export function useClass(id: string) {
  const classesQuery = useClasses();
  const data = useMemo(
    () => classesQuery.data?.find(classItem => classItem.id === id),
    [classesQuery.data, id],
  );

  return {
    ...classesQuery,
    data,
  };
}

export function useClassesByLevel(level: string) {
  const classesQuery = useClasses();
  const data = useMemo(
    () => (classesQuery.data ?? []).filter(classItem => classItem.level === level),
    [classesQuery.data, level],
  );

  return {
    ...classesQuery,
    data,
  };
}

export function useCreateClass() {
  const queryClient = useQueryClient();
  const { signAction } = useDigitalSignatureHelpers();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (classData: Omit<Class, 'id' | 'createdAt'>) => {
      const classId = await ClassesService.create(classData);

      if (user) {
        await signAction('class_creation', classId, 'created', {
          className: classData.name,
          classCode: classData.code,
          level: classData.level,
          classTeacherId: classData.classTeacherId,
          classTeacherName: classData.classTeacherName,
          subjectCount: classData.subjectAssignments?.length || 0,
        });
      }

      return classId;
    },
    onSuccess: () => {
      // The atomic revision bump requests the one necessary refresh. Do not
      // issue a second fetch from this mutation observer.
      queryClient.invalidateQueries({ queryKey: classesKeys.all, refetchType: 'none' });
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

      if (user) {
        await signAction('class_creation', id, 'modified', {
          updatedFields: Object.keys(data),
          nameChanged: !!data.name,
          teacherChanged: !!data.classTeacherId,
          subjectsChanged: !!data.subjectAssignments,
          levelChanged: !!data.level,
        });
      }

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: classesKeys.all, refetchType: 'none' });
    },
  });
}

export function useDeleteClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => ClassesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: classesKeys.all, refetchType: 'none' });
    },
  });
}
