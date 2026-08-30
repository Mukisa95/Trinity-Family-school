import { useQuery, useMutation, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  PupilsService,
  type PupilPerformancePatch,
} from '../services/pupils.service';
import {
  searchPupilSnapshot,
  selectActivePupils,
  selectActivePupilsByClass,
  selectPupilByAdmissionNumber,
  selectPupilById,
  selectPupilPhoto,
  selectPupilPhotos,
  selectPupilsByClass,
  selectPupilsByFamily,
  selectPupilsByIds,
  selectPupilsByStatus,
  selectPupilsWithFilters,
  selectPupilsWithoutPhotos,
} from '@/lib/selectors/pupil-selectors';
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
  const cachedData = queryClient.getQueryData<Pupil[]>(pupilsKeys.lists());
  const query = useQuery({
    queryKey: pupilsKeys.lists(),
    queryFn: async () => queryClient.getQueryData<Pupil[]>(pupilsKeys.lists()) ?? [],
    // The GlobalDataPreloader's role-scoped listener is the sole browser read
    // owner. Every ordinary pupil hook observes this canonical query only.
    enabled: false,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    initialData: cachedData,
    initialDataUpdatedAt: cachedData !== undefined ? Date.now() : undefined,
    placeholderData: previousData => previousData,
  });
  return { ...query, isLoading: query.data === undefined };
}

export function useActivePupils() {
  const pupilsQuery = usePupils();
  const activePupils = useMemo(() => selectActivePupils(pupilsQuery.data), [pupilsQuery.data]);
  return { ...pupilsQuery, data: activePupils };
}

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

export function usePupil(id: string) {
  const pupilsQuery = usePupils();
  const data = useMemo(() => selectPupilById(pupilsQuery.data, id), [id, pupilsQuery.data]);
  return { ...pupilsQuery, data, isLoading: !!id && pupilsQuery.isLoading };
}

export function usePupilsByClass(classId: string) {
  const pupilsQuery = usePupils();
  const data = useMemo(
    () => selectPupilsByClass(pupilsQuery.data, classId),
    [classId, pupilsQuery.data],
  );
  return { ...pupilsQuery, data, isLoading: !!classId && pupilsQuery.isLoading };
}

export function usePupilsByFamily(familyId: string) {
  const pupilsQuery = usePupils();
  const data = useMemo(
    () => selectPupilsByFamily(pupilsQuery.data, familyId),
    [familyId, pupilsQuery.data],
  );
  return { ...pupilsQuery, data, isLoading: !!familyId && pupilsQuery.isLoading };
}

export function useSearchPupils(searchTerm: string) {
  const pupilsQuery = usePupils();
  const enabled = searchTerm.trim().length > 2;
  const data = useMemo(
    () => enabled ? searchPupilSnapshot(pupilsQuery.data, searchTerm) : [],
    [enabled, pupilsQuery.data, searchTerm],
  );
  return { ...pupilsQuery, data, isLoading: enabled && pupilsQuery.isLoading };
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

export function usePupilByAdmissionNumber(admissionNumber: string) {
  const pupilsQuery = usePupils();
  const data = useMemo(
    () => selectPupilByAdmissionNumber(pupilsQuery.data, admissionNumber),
    [admissionNumber, pupilsQuery.data],
  );
  return { ...pupilsQuery, data, isLoading: !!admissionNumber && pupilsQuery.isLoading };
}

export function usePupilsByIds(pupilIds: string[]) {
  const pupilsQuery = usePupils();
  const stableIds = useMemo(() => pupilIds.join(','), [pupilIds]);
  const data = useMemo(
    () => selectPupilsByIds(pupilsQuery.data, pupilIds),
    [pupilsQuery.data, stableIds],
  );
  return { ...pupilsQuery, data, isLoading: pupilIds.length > 0 && pupilsQuery.isLoading };
}

export function usePupilsByStatus(status: string) {
  const pupilsQuery = usePupils();
  const data = useMemo(
    () => selectPupilsByStatus(pupilsQuery.data, status),
    [pupilsQuery.data, status],
  );
  return { ...pupilsQuery, data, isLoading: !!status && pupilsQuery.isLoading };
}

export function useActivePupilsByClass(classId: string) {
  const pupilsQuery = usePupils();
  const data = useMemo(
    () => selectActivePupilsByClass(pupilsQuery.data, classId),
    [classId, pupilsQuery.data],
  );
  return { ...pupilsQuery, data, isLoading: !!classId && pupilsQuery.isLoading };
}

// 🚀 PERFORMANCE OPTIMIZATION: Hooks for fetching pupils WITHOUT photos
// These hooks significantly improve load times by excluding photo data

/**
 * Fetch all pupils WITHOUT photos for faster initial load
 * Use usePupilPhotos() to load photos separately
 */
export function usePupilsWithoutPhotos() {
  const pupilsQuery = usePupils();
  const data = useMemo(
    () => selectPupilsWithoutPhotos(pupilsQuery.data),
    [pupilsQuery.data],
  );
  return { ...pupilsQuery, data };
}

/**
 * Fetch pupils by class WITHOUT photos for faster initial load
 * Use usePupilPhotos() to load photos separately
 */
export function usePupilsByClassWithoutPhotos(classId: string) {
  const pupilsQuery = usePupils();
  const data = useMemo(
    () => selectPupilsWithoutPhotos(selectPupilsByClass(pupilsQuery.data, classId)),
    [classId, pupilsQuery.data],
  );
  return { ...pupilsQuery, data, isLoading: !!classId && pupilsQuery.isLoading };
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
  const pupilsQuery = usePupils();
  const data = useMemo(
    () => selectPupilsWithoutPhotos(selectPupilsWithFilters(pupilsQuery.data, classId, filters)),
    [classId, filters?.gender, filters?.section, filters?.status, pupilsQuery.data],
  );
  return { ...pupilsQuery, data, isLoading: !!classId && pupilsQuery.isLoading };
}

/**
 * Fetch a single pupil's photo by ID
 * Use this for lazy loading individual photos
 */
export function usePupilPhoto(pupilId: string) {
  const pupilsQuery = usePupils();
  const data = useMemo(
    () => selectPupilPhoto(pupilsQuery.data, pupilId),
    [pupilId, pupilsQuery.data],
  );
  return { ...pupilsQuery, data, isLoading: !!pupilId && pupilsQuery.isLoading };
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
  const pupilsQuery = usePupils();
  const enabled = options?.enabled !== false && pupilIds.length > 0;
  const stableIds = useMemo(() => pupilIds.join(','), [pupilIds]);
  const data = useMemo(
    () => enabled ? selectPupilPhotos(pupilsQuery.data, pupilIds) : new Map<string, string>(),
    [enabled, pupilsQuery.data, stableIds],
  );
  return {
    ...pupilsQuery,
    data,
    isLoading: enabled && pupilsQuery.isLoading,
    isFetching: false,
  };
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
  const enabled = options?.enabled !== false;
  const photos = usePupilPhotos(pupilIds, {
    priorityIds: options?.priorityIds,
    enabled,
  });

  return {
    data: photos.data,
    isLoading: photos.isLoading,
    isFetching: false,
    loadNextBatch: () => undefined,
    hasMore: false,
    loadedCount: enabled ? pupilIds.length : 0,
    totalCount: pupilIds.length,
  };
}
