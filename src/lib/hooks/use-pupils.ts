import { useQuery, useMutation, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  PupilsService,
  type PupilPerformancePatch,
} from '../services/pupils.service';
import type { Pupil } from '@/types';

// Query keys
export const pupilsKeys = {
  all: ['pupils'] as const,
  lists: () => [...pupilsKeys.all, 'list'] as const,
  list: (filters: string) => [...pupilsKeys.lists(), { filters }] as const,
  details: () => [...pupilsKeys.all, 'detail'] as const,
  detail: (id: string) => [...pupilsKeys.details(), id] as const,
  byClass: (classId: string) => [...pupilsKeys.all, 'byClass', classId] as const,
  byFamily: (familyId: string) => [...pupilsKeys.all, 'byFamily', familyId] as const,
  search: (term: string) => [...pupilsKeys.all, 'search', term] as const,
};

const comparePupilsByName = (a: Pupil, b: Pupil) => {
  const lastNameCompare = (a.lastName || '').localeCompare(b.lastName || '');
  if (lastNameCompare !== 0) return lastNameCompare;
  return (a.firstName || '').localeCompare(b.firstName || '');
};

const isPupilArray = (value: unknown): value is Pupil[] =>
  Array.isArray(value) && value.every(item => item && typeof item === 'object' && 'id' in item);

const queryKeyContains = (queryKey: QueryKey, value: string) =>
  queryKey.some(part => part === value);

const shouldIncludePupilInQuery = (queryKey: QueryKey, pupil: Pupil) => {
  const [root, scope, arg] = queryKey;
  if (root !== 'pupils') return false;

  if (scope === 'list') {
    if (queryKeyContains(queryKey, 'active')) return pupil.status === 'Active';
    return true;
  }

  if (scope === 'byClass') return pupil.classId === arg;
  if (scope === 'byFamily') return pupil.familyId === arg;
  if (scope === 'activeByClass') return pupil.classId === arg && pupil.status === 'Active';
  if (scope === 'byStatus') return pupil.status === arg;

  return false;
};

const shouldIncludePupilInLegacyClassQuery = (queryKey: QueryKey, pupil: Pupil) =>
  queryKey[0] === 'pupils-by-class' && (!queryKey[1] || pupil.classId === queryKey[1]);

const updatePupilArray = (items: Pupil[], pupil: Pupil, queryKey: QueryKey) => {
  const index = items.findIndex(item => item.id === pupil.id);
  const belongs = shouldIncludePupilInQuery(queryKey, pupil) || shouldIncludePupilInLegacyClassQuery(queryKey, pupil);

  if (index >= 0) {
    if (!belongs) {
      return items.filter(item => item.id !== pupil.id);
    }
    const updated = [...items];
    updated[index] = { ...updated[index], ...pupil };
    return updated.sort(comparePupilsByName);
  }

  if (!belongs) return items;
  return [...items, pupil].sort(comparePupilsByName);
};

export const patchPupilQueryCaches = (queryClient: QueryClient, pupil: Pupil) => {
  queryClient.setQueryData(pupilsKeys.detail(pupil.id), (current: Pupil | undefined | null) => ({
    ...(current || {}),
    ...pupil,
  }));

  queryClient.getQueryCache().findAll({ queryKey: pupilsKeys.all }).forEach(query => {
    const data = query.state.data;
    if (isPupilArray(data)) {
      queryClient.setQueryData(query.queryKey, updatePupilArray(data, pupil, query.queryKey));
    }

    if (data instanceof Map && pupil.photo !== undefined) {
      queryClient.setQueryData(query.queryKey, (current: Map<string, string> | undefined) => {
        if (!(current instanceof Map)) return current;
        if (!current.has(pupil.id) && !pupil.photo) return current;
        const next = new Map(current);
        if (pupil.photo) {
          next.set(pupil.id, pupil.photo);
        } else {
          next.delete(pupil.id);
        }
        return next;
      });
    }
  });

  queryClient.getQueryCache().findAll({ queryKey: ['pupils-by-class'] }).forEach(query => {
    const data = query.state.data;
    if (isPupilArray(data)) {
      queryClient.setQueryData(query.queryKey, updatePupilArray(data, pupil, query.queryKey));
    }
  });
};

export const removePupilFromQueryCaches = (queryClient: QueryClient, pupilId: string) => {
  queryClient.removeQueries({ queryKey: pupilsKeys.detail(pupilId), exact: true });

  queryClient.getQueryCache().findAll({ queryKey: pupilsKeys.all }).forEach(query => {
    const data = query.state.data;
    if (isPupilArray(data)) {
      queryClient.setQueryData(query.queryKey, data.filter(pupil => pupil.id !== pupilId));
    }

    if (data instanceof Map && data.has(pupilId)) {
      queryClient.setQueryData(query.queryKey, (current: Map<string, string> | undefined) => {
        if (!(current instanceof Map)) return current;
        const next = new Map(current);
        next.delete(pupilId);
        return next;
      });
    }
  });

  queryClient.getQueryCache().findAll({ queryKey: ['pupils-by-class'] }).forEach(query => {
    const data = query.state.data;
    if (isPupilArray(data)) {
      queryClient.setQueryData(query.queryKey, data.filter(pupil => pupil.id !== pupilId));
    }
  });
};

export type PupilCacheChange =
  | { type: 'added' | 'modified'; pupil: Pupil }
  | { type: 'removed'; id: string };

/**
 * Apply one Firestore listener snapshot with at most one write per cached
 * query. This avoids copying and sorting the same arrays once per changed
 * document while preserving every list, detail, and photo cache.
 */
export const applyPupilChangesToQueryCaches = (
  queryClient: QueryClient,
  changes: PupilCacheChange[],
) => {
  if (changes.length === 0) return;

  const removedIds = new Set(
    changes
      .filter((change): change is Extract<PupilCacheChange, { type: 'removed' }> => change.type === 'removed')
      .map(change => change.id),
  );
  const upserts = new Map<string, Pupil>();

  changes.forEach(change => {
    if (change.type === 'removed') {
      upserts.delete(change.id);
      return;
    }
    removedIds.delete(change.pupil.id);
    upserts.set(change.pupil.id, change.pupil);
  });

  removedIds.forEach(id => {
    queryClient.removeQueries({ queryKey: pupilsKeys.detail(id), exact: true });
  });
  upserts.forEach(pupil => {
    queryClient.setQueryData(pupilsKeys.detail(pupil.id), (current: Pupil | undefined | null) => ({
      ...(current || {}),
      ...pupil,
    }));
  });

  const updateArray = (items: Pupil[], queryKey: QueryKey) => {
    const byId = new Map<string, Pupil>();

    items.forEach(item => {
      if (!removedIds.has(item.id)) byId.set(item.id, item);
    });

    upserts.forEach(pupil => {
      const belongs =
        shouldIncludePupilInQuery(queryKey, pupil) ||
        shouldIncludePupilInLegacyClassQuery(queryKey, pupil);

      if (!belongs) {
        byId.delete(pupil.id);
        return;
      }

      byId.set(pupil.id, {
        ...(byId.get(pupil.id) || {}),
        ...pupil,
      } as Pupil);
    });

    return Array.from(byId.values()).sort(comparePupilsByName);
  };

  const updateMatchingQueries = (queryKey: QueryKey) => {
    queryClient.getQueryCache().findAll({ queryKey }).forEach(query => {
      const data = query.state.data;

      if (isPupilArray(data)) {
        queryClient.setQueryData(query.queryKey, updateArray(data, query.queryKey));
        return;
      }

      if (data instanceof Map) {
        queryClient.setQueryData(query.queryKey, (current: Map<string, string> | undefined) => {
          if (!(current instanceof Map)) return current;
          const next = new Map(current);
          removedIds.forEach(id => next.delete(id));
          upserts.forEach(pupil => {
            if (pupil.photo) next.set(pupil.id, pupil.photo);
            else next.delete(pupil.id);
          });
          return next;
        });
      }
    });
  };

  updateMatchingQueries(pupilsKeys.all);
  updateMatchingQueries(['pupils-by-class']);
};

// Hooks
export function usePupils() {
  const queryClient = useQueryClient();

  // Get cached data immediately to use as initialData
  const cachedData = queryClient.getQueryData<Pupil[]>(pupilsKeys.lists());

  const query = useQuery({
    queryKey: pupilsKeys.lists(),
    queryFn: async () => {
      // Return cache if already populated by the GlobalDataPreloader
      const currentCachedData = queryClient.getQueryData<Pupil[]>(pupilsKeys.lists());
      if (currentCachedData && currentCachedData.length > 0) {
        return currentCachedData;
      }
      // Fallback: direct fetch (should rarely happen — preloader covers this)
      return [];
    },
    // Always enabled — the preloader populates ['pupils','list'] via setQueryData;
    // this hook subscribes to that key and re-renders components when data arrives.
    enabled: true,
    staleTime: Infinity, // GlobalDataPreloader's live patch listener handles ALL updates
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    initialData: cachedData && cachedData.length > 0 ? cachedData : undefined,
    initialDataUpdatedAt: cachedData && cachedData.length > 0 ? Date.now() : undefined,
    placeholderData: (previousData) => {
      if (cachedData && cachedData.length > 0) return cachedData;
      return previousData;
    },
  });

  return query;
}

// 🚀 DATABASE-LEVEL FILTERING: Only fetch active pupils from database
export const selectActivePupils = (pupils: Pupil[] | undefined) =>
  (pupils || []).filter(pupil => pupil.status === 'Active');

// The global preloader already owns a live, role-scoped pupil list. Filtering
// that canonical cache is instant and avoids a second `status == Active`
// Firestore query whenever a report, exam, or boarding view is opened.
export function useActivePupils() {
  const pupilsQuery = usePupils();
  const activePupils = useMemo(() => selectActivePupils(pupilsQuery.data), [pupilsQuery.data]);

  return {
    ...pupilsQuery,
    data: activePupils,
  };
}

// Retained temporarily as a source-level fallback while the cache selector is
// verified in preview. It is intentionally not exported or called.
function useActivePupilsWithDedicatedQuery() {
  return useQuery({
    queryKey: [...pupilsKeys.lists(), 'active'],
    queryFn: () => PupilsService.getActivePupils(), // Database-level filter
  });
}

// 🚀 OPTIMIZED: Only load active pupils when explicitly needed (database-level filter)
export function useActivePupilsOptimized(options?: { enabled?: boolean }) {
  const pupilsQuery = usePupils();
  const enabled = options?.enabled !== false;
  const activePupils = useMemo(
    () => (enabled ? selectActivePupils(pupilsQuery.data) : undefined),
    [enabled, pupilsQuery.data],
  );

  return {
    ...pupilsQuery,
    data: activePupils,
    isLoading: enabled && pupilsQuery.isLoading,
  };
}

// Retained temporarily as a source-level fallback while the cache selector is
// verified in preview. It is intentionally not exported or called.
function useActivePupilsOptimizedWithDedicatedQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...pupilsKeys.lists(), 'active', 'optimized'],
    queryFn: () => PupilsService.getActivePupils(), // Database-level filter
    enabled: options?.enabled !== false,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: (failureCount, error) => {
      // Don't retry if it's an offline error
      if (error?.message?.includes('offline') ||
        error?.message?.includes('Could not reach Cloud Firestore') ||
        (error as any)?.code === 'unavailable') {
        console.log('🚫 Offline detected, not retrying pupils query');
        return false;
      }
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

export function usePupil(id: string) {
  const queryClient = useQueryClient();

  // 🚀 CRITICAL: Get cached pupils data immediately to find pupil by id
  const cachedPupils = queryClient.getQueryData<Pupil[]>(pupilsKeys.lists());

  // Initial query with cache-first strategy
  const query = useQuery({
    queryKey: pupilsKeys.detail(id),
    queryFn: async () => {
      // 🚀 CRITICAL: First check detail cache
      const cachedDetail = queryClient.getQueryData<Pupil>(pupilsKeys.detail(id));
      if (cachedDetail) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`⚡ usePupil: Using pupil from detail cache`);
        }
        return cachedDetail;
      }

      // 🚀 CRITICAL: If no detail cache, find from cached pupils list (instant!)
      if (cachedPupils && cachedPupils.length > 0 && id) {
        const foundPupil = cachedPupils.find((pupil) => pupil.id === id);
        if (foundPupil) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`⚡ usePupil: Using pupil from cached pupils list (instant!)`);
          }
          // Also update detail cache for future use
          queryClient.setQueryData(pupilsKeys.detail(id), foundPupil);
          return foundPupil;
        }
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('📥 usePupil: No cache, fetching from server...');
      }
      return PupilsService.getPupilById(id);
    },
    enabled: !!id,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour cache
    refetchOnMount: false, // Don't refetch when component mounts - use cache
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on reconnect
    refetchInterval: false,
    // 🚀 CRITICAL: Use cached data as initialData to prevent loading state
    initialData: () => {
      // First check detail cache
      const cachedDetail = queryClient.getQueryData<Pupil>(pupilsKeys.detail(id));
      if (cachedDetail) {
        return cachedDetail;
      }
      // Then check cached pupils list
      if (cachedPupils && cachedPupils.length > 0 && id) {
        const foundPupil = cachedPupils.find((pupil) => pupil.id === id);
        return foundPupil || undefined;
      }
      return undefined;
    },
    // 🚀 CRITICAL: Use cached data as placeholder to show immediately
    placeholderData: (previousData) => {
      // First check detail cache
      const cachedDetail = queryClient.getQueryData<Pupil>(pupilsKeys.detail(id));
      if (cachedDetail) {
        return cachedDetail;
      }
      // Then check cached pupils list
      if (cachedPupils && cachedPupils.length > 0 && id) {
        const foundPupil = cachedPupils.find((pupil) => pupil.id === id);
        if (foundPupil) {
          return foundPupil;
        }
      }
      // Otherwise use previous data if available
      return previousData;
    },
  });

  // ✅ No real-time listener needed — usePupil reads from the GlobalDataPreloader's
  // pupils list cache (pupilsKeys.lists()). That single global listener keeps all
  // pupil data fresh across every page navigation without opening extra connections.

  return query;
}

export function usePupilsByClass(classId: string) {
  const queryClient = useQueryClient();

  // 🚀 CRITICAL: Get cached pupils data immediately to filter from cache
  const cachedPupils = queryClient.getQueryData<Pupil[]>(pupilsKeys.lists());

  return useQuery({
    queryKey: pupilsKeys.byClass(classId),
    queryFn: async () => {
      // 🚀 CRITICAL: If we have cached pupils, filter from cache (instant!)
      if (cachedPupils && cachedPupils.length > 0 && classId) {
        const filtered = cachedPupils.filter(
          (pupil) => pupil.classId === classId
        );
        if (filtered.length > 0) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`⚡ usePupilsByClass: Using ${filtered.length} pupils from cache (instant!)`);
          }
          return filtered;
        }
      }

      // Fallback to service if cache doesn't have data for this class
      if (process.env.NODE_ENV === 'development') {
        console.log('📥 usePupilsByClass: No cache, fetching from server...');
      }
      return PupilsService.getPupilsByClass(classId);
    },
    enabled: !!classId,
    staleTime: 10 * 60 * 1000, // 10 minutes cache
    gcTime: 30 * 60 * 1000, // 30 minutes cache
    refetchOnMount: false, // Don't refetch when component mounts - use cache
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on reconnect
    // 🚀 CRITICAL: Use cached data as initialData to prevent loading state
    initialData: () => {
      if (cachedPupils && cachedPupils.length > 0 && classId) {
        const filtered = cachedPupils.filter(
          (pupil) => pupil.classId === classId
        );
        return filtered.length > 0 ? filtered : undefined;
      }
      return undefined;
    },
    // 🚀 CRITICAL: Use cached data as placeholder to show immediately
    placeholderData: (previousData) => {
      // If we have cached pupils, filter and use them immediately
      if (cachedPupils && cachedPupils.length > 0 && classId) {
        const filtered = cachedPupils.filter(
          (pupil) => pupil.classId === classId
        );
        if (filtered.length > 0) {
          return filtered;
        }
      }
      // Otherwise use previous data if available
      return previousData;
    },
  });
}

export function usePupilsByFamily(familyId: string) {
  const queryClient = useQueryClient();

  // 🚀 CRITICAL: Get cached pupils data immediately to filter from cache
  const cachedPupils = queryClient.getQueryData<Pupil[]>(pupilsKeys.lists());

  return useQuery({
    queryKey: pupilsKeys.byFamily(familyId),
    queryFn: async () => {
      // 🚀 CRITICAL: If we have cached pupils, filter from cache (instant!)
      if (cachedPupils && cachedPupils.length > 0 && familyId) {
        const filtered = cachedPupils.filter(
          (pupil) => pupil.familyId === familyId
        );
        if (filtered.length > 0) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`⚡ usePupilsByFamily: Using ${filtered.length} pupils from cache (instant!)`);
          }
          return filtered;
        }
      }

      // Fallback to service if cache doesn't have data for this family
      if (process.env.NODE_ENV === 'development') {
        console.log('📥 usePupilsByFamily: No cache, fetching from server...');
      }
      return PupilsService.getPupilsByFamily(familyId);
    },
    enabled: !!familyId,
    staleTime: 10 * 60 * 1000, // 10 minutes cache
    gcTime: 30 * 60 * 1000, // 30 minutes cache
    refetchOnMount: false, // Don't refetch when component mounts - use cache
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on reconnect
    refetchInterval: false, // No aggressive polling
    // 🚀 CRITICAL: Use cached data as initialData to prevent loading state
    initialData: () => {
      if (cachedPupils && cachedPupils.length > 0 && familyId) {
        const filtered = cachedPupils.filter(
          (pupil) => pupil.familyId === familyId
        );
        return filtered.length > 0 ? filtered : undefined;
      }
      return undefined;
    },
    // 🚀 CRITICAL: Use cached data as placeholder to show immediately
    placeholderData: (previousData) => {
      // If we have cached pupils, filter and use them immediately
      if (cachedPupils && cachedPupils.length > 0 && familyId) {
        const filtered = cachedPupils.filter(
          (pupil) => pupil.familyId === familyId
        );
        if (filtered.length > 0) {
          return filtered;
        }
      }
      // Otherwise use previous data if available
      return previousData;
    },
  });
}

export function useSearchPupils(searchTerm: string) {
  return useQuery({
    queryKey: pupilsKeys.search(searchTerm),
    queryFn: () => PupilsService.searchPupils(searchTerm),
    enabled: !!searchTerm && searchTerm.length > 2,
  });
}

export function useCreatePupil() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pupilData: Omit<Pupil, 'id' | 'createdAt'>) =>
      PupilsService.createPupil(pupilData),
    onSuccess: (id, pupilData) => {
      const now = new Date().toISOString();
      patchPupilQueryCaches(queryClient, {
        ...pupilData,
        id,
        createdAt: now,
        updatedAt: now,
      } as Pupil);
    },
  });
}

export function useUpdatePupil() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<Pupil, 'id' | 'createdAt'>> }) =>
      PupilsService.updatePupil(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: pupilsKeys.all });
      await queryClient.cancelQueries({ queryKey: pupilsKeys.detail(id) });

      const snapshots = queryClient.getQueryCache().findAll({ queryKey: pupilsKeys.all }).map(query => ({
        queryKey: query.queryKey,
        data: query.state.data,
      }));
      const detailSnapshot = queryClient.getQueryData<Pupil>(pupilsKeys.detail(id));
      const listSnapshot = queryClient.getQueryData<Pupil[]>(pupilsKeys.lists());
      const existingPupil = detailSnapshot || listSnapshot?.find(pupil => pupil.id === id);

      if (existingPupil) {
        const optimisticPupil = {
          ...existingPupil,
          ...data,
          id,
          updatedAt: new Date().toISOString(),
        } as Pupil;
        const classChanged = typeof data.classId === 'string' && data.classId !== existingPupil.classId;
        const targetStreamWasExplicitlyProvided = Boolean(data.streamId && data.streamClassId === data.classId);
        if (classChanged && !targetStreamWasExplicitlyProvided) {
          delete optimisticPupil.streamId;
          delete optimisticPupil.streamName;
          delete optimisticPupil.streamCode;
          delete optimisticPupil.streamClassId;
          delete optimisticPupil.streamAcademicYearId;
          delete optimisticPupil.streamAssignedAt;
          delete optimisticPupil.streamAssignedBy;
        }
        patchPupilQueryCaches(queryClient, optimisticPupil);
      }

      return { snapshots, detailSnapshot };
    },
    onError: (_error, { id }, context) => {
      context?.snapshots.forEach(snapshot => {
        queryClient.setQueryData(snapshot.queryKey, snapshot.data);
      });

      if (context?.detailSnapshot) {
        queryClient.setQueryData(pupilsKeys.detail(id), context.detailSnapshot);
      } else {
        queryClient.removeQueries({ queryKey: pupilsKeys.detail(id), exact: true });
      }
    },
    onSuccess: (result, { id, data }) => {
      const existingPupil =
        queryClient.getQueryData<Pupil>(pupilsKeys.detail(id)) ||
        queryClient.getQueryData<Pupil[]>(pupilsKeys.lists())?.find(pupil => pupil.id === id);

      if (existingPupil) {
        const updatedPupil = {
          ...existingPupil,
          ...data,
          ...(result.photoDeleted && { photo: '' }),
          id,
          updatedAt: new Date().toISOString(),
        } as Pupil;
        if (result.streamCleared) {
          delete updatedPupil.streamId;
          delete updatedPupil.streamName;
          delete updatedPupil.streamCode;
          delete updatedPupil.streamClassId;
          delete updatedPupil.streamAcademicYearId;
          delete updatedPupil.streamAssignedAt;
          delete updatedPupil.streamAssignedBy;
        }
        patchPupilQueryCaches(queryClient, updatedPupil);
      }
    },
  });
}

export function useUpdatePupilPerformanceBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patches: PupilPerformancePatch[]) =>
      PupilsService.updatePupilPerformanceBatch(patches),
    onSuccess: result => {
      applyPupilChangesToQueryCaches(
        queryClient,
        result.pupils.map(pupil => ({ type: 'modified' as const, pupil })),
      );
    },
  });
}

export function useDeletePupil() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => PupilsService.deletePupil(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: pupilsKeys.all });
      await queryClient.cancelQueries({ queryKey: pupilsKeys.detail(id) });

      const snapshots = queryClient.getQueryCache().findAll({ queryKey: pupilsKeys.all }).map(query => ({
        queryKey: query.queryKey,
        data: query.state.data,
      }));
      const detailSnapshot = queryClient.getQueryData<Pupil>(pupilsKeys.detail(id));

      removePupilFromQueryCaches(queryClient, id);
      return { snapshots, detailSnapshot };
    },
    onError: (_error, id, context) => {
      context?.snapshots.forEach(snapshot => {
        queryClient.setQueryData(snapshot.queryKey, snapshot.data);
      });

      if (context?.detailSnapshot) {
        queryClient.setQueryData(pupilsKeys.detail(id), context.detailSnapshot);
      }
    },
  });
}

// 🚀 NEW: Optimized hooks for database-level filtering
export function usePupilByAdmissionNumber(admissionNumber: string) {
  return useQuery({
    queryKey: [...pupilsKeys.all, 'byAdmissionNumber', admissionNumber],
    queryFn: () => PupilsService.getPupilByAdmissionNumber(admissionNumber),
    enabled: !!admissionNumber,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false, // Admission numbers don't change frequently
  });
}

export function usePupilsByIds(pupilIds: string[]) {
  return useQuery({
    queryKey: [...pupilsKeys.all, 'byIds', pupilIds.sort().join(',')],
    queryFn: () => PupilsService.getPupilsByIds(pupilIds),
    enabled: pupilIds.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes cache
    refetchOnWindowFocus: false,
  });
}

// 🚀 DATABASE-LEVEL FILTERING: Fetch pupils by status (e.g., 'Active', 'Inactive', 'Graduated')
export function usePupilsByStatus(status: string) {
  return useQuery({
    queryKey: [...pupilsKeys.all, 'byStatus', status],
    queryFn: () => PupilsService.getPupilsByStatus(status),
    enabled: !!status,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
  });
}

// 🚀 DATABASE-LEVEL FILTERING: Fetch active pupils for a specific class
export function useActivePupilsByClass(classId: string) {
  const queryClient = useQueryClient();

  // 🚀 CRITICAL: Get cached pupils data immediately to filter from cache
  const cachedPupils = queryClient.getQueryData<Pupil[]>(pupilsKeys.lists());

  return useQuery({
    queryKey: [...pupilsKeys.all, 'activeByClass', classId],
    queryFn: async () => {
      // 🚀 CRITICAL: If we have cached pupils, filter from cache (instant!)
      if (cachedPupils && cachedPupils.length > 0) {
        const filtered = cachedPupils.filter(
          (pupil) => pupil.classId === classId && pupil.status === 'Active'
        );
        if (filtered.length > 0) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`⚡ useActivePupilsByClass: Using ${filtered.length} pupils from cache (instant!)`);
          }
          return filtered;
        }
      }

      // Fallback to service if cache doesn't have data for this class
      if (process.env.NODE_ENV === 'development') {
        console.log('📥 useActivePupilsByClass: No cache, fetching from server...');
      }
      return PupilsService.getActivePupilsByClass(classId);
    },
    enabled: !!classId,
    staleTime: 10 * 60 * 1000, // 10 minutes cache
    gcTime: 30 * 60 * 1000, // 30 minutes cache
    refetchOnMount: false, // Don't refetch when component mounts - use cache
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on reconnect
    // 🚀 CRITICAL: Use cached data as initialData to prevent loading state
    initialData: () => {
      if (cachedPupils && cachedPupils.length > 0 && classId) {
        const filtered = cachedPupils.filter(
          (pupil) => pupil.classId === classId && pupil.status === 'Active'
        );
        return filtered.length > 0 ? filtered : undefined;
      }
      return undefined;
    },
    // 🚀 CRITICAL: Use cached data as placeholder to show immediately
    placeholderData: (previousData) => {
      // If we have cached pupils, filter and use them immediately
      if (cachedPupils && cachedPupils.length > 0 && classId) {
        const filtered = cachedPupils.filter(
          (pupil) => pupil.classId === classId && pupil.status === 'Active'
        );
        if (filtered.length > 0) {
          return filtered;
        }
      }
      // Otherwise use previous data if available
      return previousData;
    },
  });
}

// 🚀 PERFORMANCE OPTIMIZATION: Hooks for fetching pupils WITHOUT photos
// These hooks significantly improve load times by excluding photo data

/**
 * Fetch all pupils WITHOUT photos for faster initial load
 * Use usePupilPhotos() to load photos separately
 */
export function usePupilsWithoutPhotos() {
  const queryClient = useQueryClient();
  const cachedPupils = queryClient.getQueryData<Pupil[]>(pupilsKeys.lists());

  return useQuery({
    queryKey: [...pupilsKeys.lists(), 'withoutPhotos'],
    queryFn: async () => {
      // If we have cached full pupils, use them!
      if (cachedPupils && cachedPupils.length > 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`⚡ usePupilsWithoutPhotos: Using ${cachedPupils.length} pupils from main cache (instant!)`);
        }
        return cachedPupils;
      }
      return PupilsService.getAllPupilsWithoutPhotos();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
    // Use cached data from main list if available
    initialData: () => {
      if (cachedPupils && cachedPupils.length > 0) {
        return cachedPupils;
      }
      return undefined;
    },
    placeholderData: (previousData) => {
      if (cachedPupils && cachedPupils.length > 0) {
        return cachedPupils;
      }
      return previousData;
    }
  });
}

/**
 * Fetch pupils by class WITHOUT photos for faster initial load
 * Use usePupilPhotos() to load photos separately
 */
export function usePupilsByClassWithoutPhotos(classId: string) {
  return useQuery({
    queryKey: [...pupilsKeys.byClass(classId), 'withoutPhotos'],
    queryFn: () => PupilsService.getPupilsByClassWithoutPhotos(classId),
    enabled: !!classId,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetch pupils by class with filters WITHOUT photos for faster initial load
 * Use usePupilPhotos() to load photos separately
 */
export function usePupilsByClassWithFiltersWithoutPhotos(
  classId: string,
  filters?: {
    status?: string;
    section?: string;
    gender?: string;
  }
) {
  return useQuery({
    queryKey: [...pupilsKeys.byClass(classId), 'withoutPhotos', 'filtered', filters],
    queryFn: () => PupilsService.getPupilsByClassWithFiltersWithoutPhotos(classId, filters),
    enabled: !!classId,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetch a single pupil's photo by ID
 * Use this for lazy loading individual photos
 */
export function usePupilPhoto(pupilId: string) {
  return useQuery({
    queryKey: [...pupilsKeys.detail(pupilId), 'photo'],
    queryFn: () => PupilsService.getPupilPhoto(pupilId),
    enabled: !!pupilId,
    staleTime: 10 * 60 * 1000, // 10 minutes cache - photos don't change often
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/**
 * Batch fetch multiple pupil photos by IDs
 * Use this for lazy loading photos for a list of pupils
 * Returns a Map of pupilId -> photoUrl
 * 
 * OPTIMIZED: 
 * - Starts loading immediately when pupilIds are available
 * - Supports progressive loading with priority IDs
 * - Better caching and request deduplication
 */
export function usePupilPhotos(
  pupilIds: string[],
  options?: {
    priorityIds?: string[]; // Load these photos first (e.g., visible pupils)
    enabled?: boolean;
  }
) {
  // Create stable sorted key for caching (include priority in key for proper caching)
  const sortedIds = useMemo(() => {
    const unique = Array.from(new Set(pupilIds));
    return unique.slice().sort().join(',');
  }, [pupilIds]);

  const priorityIds = options?.priorityIds || [];
  const priorityKey = useMemo(() => {
    if (priorityIds.length === 0) return '';
    return priorityIds.slice().sort().join(',');
  }, [priorityIds]);

  // Create cache key that includes priority for proper cache invalidation
  const cacheKey = useMemo(() => {
    return priorityKey
      ? [...pupilsKeys.all, 'photos', sortedIds, 'priority', priorityKey]
      : [...pupilsKeys.all, 'photos', sortedIds];
  }, [sortedIds, priorityKey]);

  return useQuery({
    queryKey: cacheKey,
    queryFn: () => PupilsService.getPupilPhotos(pupilIds, {
      priorityIds: priorityIds.length > 0 ? priorityIds : undefined,
      maxConcurrent: 5, // Optimal for most cases
      batchSize: 30, // Use max Firestore 'in' limit for efficiency
    }),
    enabled: (options?.enabled !== false) && pupilIds.length > 0,
    staleTime: 30 * 60 * 1000, // 30 minutes cache - photos rarely change
    gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    // Start loading immediately, don't wait
    placeholderData: (previousData) => {
      // Merge with previous data if available (for progressive loading)
      if (previousData && previousData instanceof Map) {
        return previousData;
      }
      return previousData;
    },
    // Retry logic for network issues
    retry: (failureCount, error) => {
      // Don't retry if it's an offline error
      if (error?.message?.includes('offline') ||
        error?.message?.includes('Could not reach Cloud Firestore') ||
        (error as any)?.code === 'unavailable') {
        return false;
      }
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });
}

/**
 * Progressive photo loading hook
 * Loads photos in chunks, prioritizing visible/important photos first
 * Useful for large lists where not all photos need to load immediately
 */
export function usePupilPhotosProgressive(
  pupilIds: string[],
  options?: {
    initialBatchSize?: number; // How many to load initially (default: 20)
    batchSize?: number; // How many to load per batch (default: 10)
    priorityIds?: string[]; // Load these first
    enabled?: boolean;
  }
) {
  const initialBatchSize = options?.initialBatchSize || 20;
  const batchSize = options?.batchSize || 10;
  const priorityIds = options?.priorityIds || [];
  const enabled = options?.enabled !== false;

  // Determine initial load: priority IDs first, then first N regular IDs
  const initialIds = useMemo(() => {
    const unique = Array.from(new Set(pupilIds));
    const priority = priorityIds.filter(id => unique.includes(id));
    const regular = unique.filter(id => !priorityIds.includes(id));

    // Load priority + initial batch
    const initial = [
      ...priority,
      ...regular.slice(0, Math.max(0, initialBatchSize - priority.length))
    ];

    return initial;
  }, [pupilIds, priorityIds, initialBatchSize]);

  // Load remaining IDs
  const remainingIds = useMemo(() => {
    const unique = Array.from(new Set(pupilIds));
    return unique.filter(id => !initialIds.includes(id));
  }, [pupilIds, initialIds]);

  // Load initial batch
  const initialPhotos = usePupilPhotos(initialIds, {
    priorityIds: priorityIds.filter(id => initialIds.includes(id)),
    enabled: enabled && initialIds.length > 0,
  });

  // State for progressive loading
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set(initialIds));
  const [allPhotos, setAllPhotos] = useState<Map<string, string>>(new Map());

  // Update photos when initial batch loads
  useEffect(() => {
    if (initialPhotos.data) {
      setAllPhotos(new Map(initialPhotos.data));
    }
  }, [initialPhotos.data]);

  // Function to load next batch
  const loadNextBatch = useCallback(() => {
    const notLoaded = remainingIds.filter(id => !loadedIds.has(id));
    if (notLoaded.length === 0) return;

    const nextBatch = notLoaded.slice(0, batchSize);
    setLoadedIds(prev => new Set([...prev, ...nextBatch]));

    // Load the batch
    PupilsService.getPupilPhotos(nextBatch).then(photos => {
      setAllPhotos(prev => {
        const updated = new Map(prev);
        photos.forEach((photo, id) => updated.set(id, photo));
        return updated;
      });
    }).catch(err => {
      console.warn('Failed to load photo batch:', err);
    });
  }, [remainingIds, loadedIds, batchSize]);

  return {
    data: allPhotos,
    isLoading: initialPhotos.isLoading,
    isFetching: initialPhotos.isFetching,
    loadNextBatch,
    hasMore: remainingIds.filter(id => !loadedIds.has(id)).length > 0,
    loadedCount: loadedIds.size,
    totalCount: pupilIds.length,
  };
}
