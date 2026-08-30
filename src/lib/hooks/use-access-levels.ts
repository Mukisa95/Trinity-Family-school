import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AccessLevelsService } from '@/lib/services/access-levels.service';
import type { AccessLevel, CreateAccessLevelData, UpdateAccessLevelData } from '@/types/access-levels';
import { useAuth } from '@/lib/contexts/auth-context';
import {
  getAccessLevelCacheScope,
  normaliseAccessLevels,
  readAccessLevelCache,
  writeAccessLevelCache,
} from '@/lib/cache/access-level-cache';
import {
  selectAccessLevelById,
  selectActiveAccessLevels,
  selectDefaultAccessLevel,
} from '@/lib/selectors/reference-data-selectors';

export const accessLevelKeys = {
  all: ['accessLevels'] as const,
  lists: () => [...accessLevelKeys.all, 'list'] as const,
  list: (scope: string) => [...accessLevelKeys.lists(), scope] as const,
};

function patchAccessLevelSnapshot(
  queryClient: ReturnType<typeof useQueryClient>,
  scope: string,
  patch: (current: AccessLevel[]) => AccessLevel[],
) {
  if (!scope) return;
  const queryKey = accessLevelKeys.list(scope);
  const current = queryClient.getQueryData<AccessLevel[]>(queryKey) ??
    readAccessLevelCache(scope)?.data ?? [];
  const next = normaliseAccessLevels(patch(current));
  queryClient.setQueryData(queryKey, next);
  AccessLevelsService.hydrateSharedAccessLevels(next);
  writeAccessLevelCache(scope, -1, next);
}

export function useAccessLevels() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const scope = isAuthenticated ? getAccessLevelCacheScope(user?.id, user?.role) : '';
  const queryKey = accessLevelKeys.list(scope);
  const inMemory = queryClient.getQueryData<AccessLevel[]>(queryKey);
  const persisted = inMemory === undefined ? readAccessLevelCache(scope) : null;
  const initialData = inMemory ?? persisted?.data;

  const query = useQuery({
    queryKey,
    queryFn: async () => queryClient.getQueryData<AccessLevel[]>(queryKey) ?? [],
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

  return { ...query, isLoading: !!scope && query.data === undefined };
}

export function useActiveAccessLevels() {
  const levelsQuery = useAccessLevels();
  const data = useMemo(() => selectActiveAccessLevels(levelsQuery.data), [levelsQuery.data]);
  return { ...levelsQuery, data };
}

export function useAccessLevel(id: string) {
  const levelsQuery = useAccessLevels();
  const data = useMemo(() => selectAccessLevelById(levelsQuery.data, id), [id, levelsQuery.data]);
  return { ...levelsQuery, data };
}

export function useDefaultAccessLevel() {
  const levelsQuery = useAccessLevels();
  const data = useMemo(() => selectDefaultAccessLevel(levelsQuery.data), [levelsQuery.data]);
  return { ...levelsQuery, data };
}

export function useCreateAccessLevel() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const scope = isAuthenticated ? getAccessLevelCacheScope(user?.id, user?.role) : '';
  return useMutation({
    mutationFn: async (data: CreateAccessLevelData) => {
      if (!user) throw new Error('User not authenticated');
      return AccessLevelsService.createAccessLevel(data, user.id);
    },
    onSuccess: created => patchAccessLevelSnapshot(queryClient, scope, current => [
      ...current.map(level => created.isDefault ? { ...level, isDefault: false } : level),
      created,
    ]),
  });
}

export function useUpdateAccessLevel() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const scope = isAuthenticated ? getAccessLevelCacheScope(user?.id, user?.role) : '';
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateAccessLevelData }) => {
      if (!user) throw new Error('User not authenticated');
      return AccessLevelsService.updateAccessLevel(id, data, user.id);
    },
    onSuccess: updated => patchAccessLevelSnapshot(queryClient, scope, current =>
      current.map(level => {
        if (level.id === updated.id) return updated;
        return updated.isDefault ? { ...level, isDefault: false } : level;
      }),
    ),
  });
}

export function useDeleteAccessLevel() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const scope = isAuthenticated ? getAccessLevelCacheScope(user?.id, user?.role) : '';
  return useMutation({
    mutationFn: (id: string) => AccessLevelsService.deleteAccessLevel(id),
    onSuccess: (_, id) => patchAccessLevelSnapshot(queryClient, scope, current =>
      current.filter(level => level.id !== id),
    ),
  });
}

export function useInitializePredefinedLevels() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const scope = isAuthenticated ? getAccessLevelCacheScope(user?.id, user?.role) : '';
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not authenticated');
      return AccessLevelsService.initializePredefinedLevels(user.id);
    },
    onSuccess: created => {
      if (created.length > 0) {
        patchAccessLevelSnapshot(queryClient, scope, current => [...current, ...created]);
      }
    },
  });
}
