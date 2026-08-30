import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/auth-context';
import { SubjectsService } from '../services/subjects.service';
import { useClassDetail } from './use-class-detail';
import {
  getSubjectCacheScope,
  normaliseSubjects,
  readSubjectCache,
  writeSubjectCache,
} from '@/lib/cache/subject-cache';
import {
  selectSubjectById,
  selectSubjectsByAssignments,
} from '@/lib/selectors/subject-selectors';
import type { Subject } from '@/types';

export const subjectsKeys = {
  all: ['subjects'] as const,
  lists: () => [...subjectsKeys.all, 'list'] as const,
  list: (scope: string) => [...subjectsKeys.lists(), scope] as const,
};

function patchSubjectSnapshot(
  queryClient: ReturnType<typeof useQueryClient>,
  scope: string,
  patch: (current: Subject[]) => Subject[],
) {
  if (!scope) return;
  const queryKey = subjectsKeys.list(scope);
  const current = queryClient.getQueryData<Subject[]>(queryKey) ?? readSubjectCache(scope)?.data ?? [];
  const next = normaliseSubjects(patch(current));
  queryClient.setQueryData(queryKey, next);
  SubjectsService.hydrateSharedSubjects(next);
  // The revision owner will replace this optimistic snapshot with the one
  // authoritative collection result published by the atomic source mutation.
  writeSubjectCache(scope, -1, next);
}

export function useSubjects() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const scope = isAuthenticated ? getSubjectCacheScope(user?.id, user?.role) : '';
  const queryKey = subjectsKeys.list(scope);
  const inMemory = queryClient.getQueryData<Subject[]>(queryKey);
  const persisted = inMemory === undefined ? readSubjectCache(scope) : null;
  const initialData = inMemory ?? persisted?.data;

  const query = useQuery({
    queryKey,
    queryFn: async () => queryClient.getQueryData<Subject[]>(queryKey) ?? [],
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

export function useSubject(id: string) {
  const subjectsQuery = useSubjects();
  const data = useMemo(
    () => selectSubjectById(subjectsQuery.data, id),
    [id, subjectsQuery.data],
  );
  return { ...subjectsQuery, data };
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const scope = isAuthenticated ? getSubjectCacheScope(user?.id, user?.role) : '';

  return useMutation({
    mutationFn: (subjectData: Omit<Subject, 'id' | 'createdAt'>) =>
      SubjectsService.createSubject(subjectData),
    onSuccess: created => {
      patchSubjectSnapshot(queryClient, scope, current => [...current, created]);
    },
  });
}

export function useUpdateSubject() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const scope = isAuthenticated ? getSubjectCacheScope(user?.id, user?.role) : '';

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<Subject, 'id' | 'createdAt'>> }) =>
      SubjectsService.updateSubject(id, data),
    onSuccess: (updated, { id }) => {
      patchSubjectSnapshot(queryClient, scope, current => current.map(subject =>
        subject.id === id ? updated : subject,
      ));
    },
  });
}

export function useDeleteSubject() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const scope = isAuthenticated ? getSubjectCacheScope(user?.id, user?.role) : '';

  return useMutation({
    mutationFn: (id: string) => SubjectsService.deleteSubject(id),
    onSuccess: (_, id) => {
      patchSubjectSnapshot(queryClient, scope, current =>
        current.filter(subject => subject.id !== id),
      );
    },
  });
}

export function useSubjectsByClass(classId: string, options?: { enabled?: boolean }) {
  const subjectsQuery = useSubjects();
  const classQuery = useClassDetail(classId);
  const data = useMemo(
    () => selectSubjectsByAssignments(
      subjectsQuery.data ?? [],
      classQuery.data?.subjectAssignments,
    ),
    [classQuery.data?.subjectAssignments, subjectsQuery.data],
  );

  return {
    data,
    isLoading: options?.enabled !== false && !!classId && (subjectsQuery.isLoading || classQuery.isLoading),
    error: subjectsQuery.error ?? classQuery.error,
  };
}
