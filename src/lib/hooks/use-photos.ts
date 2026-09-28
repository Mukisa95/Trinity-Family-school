import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { PhotosService } from '@/lib/services/photos.service';
import { getRevisionCachePolicy } from '@/lib/cache/revision-cache-policy';
import {
  nextPhotoCacheRevision,
  readPhotoCache,
  removePhotoFromList,
  setPrimaryPhotoInList,
  updatePhotoInList,
  upsertPhotoInList,
  writePhotoCache,
} from '@/lib/cache/photo-cache';
import {
  dashboardDataRevisionKeys,
  type DashboardDataRevisions,
  useDashboardDataRevisions,
} from './use-school-settings';
import { useAuth } from '@/lib/contexts/auth-context';
import type { Photo, PhotoCategory, PhotoUsage } from '@/types';

// Query keys
const QUERY_KEYS = {
  photos: ['photos'] as const,
  photosByCategory: (category: PhotoCategory) => ['photos', 'category', category] as const,
  photosByUsage: (usage: PhotoUsage) => ['photos', 'usage', usage] as const,
  primaryPhoto: (category: PhotoCategory) => ['photos', 'primary', category] as const,
  randomPhotos: (usage: PhotoUsage, count: number) => ['photos', 'random', usage, count] as const,
  searchPhotos: (searchTerm: string) => ['photos', 'search', searchTerm] as const,
  photo: (id: string) => ['photos', id] as const,
};

type PhotoList = Awaited<ReturnType<typeof PhotosService.getAllPhotos>>;

function getCachedPhotos(queryClient: ReturnType<typeof useQueryClient>): PhotoList | undefined {
  return queryClient.getQueryData<PhotoList>(QUERY_KEYS.photos) ?? readPhotoCache()?.data;
}

function writePhotosCache(
  queryClient: ReturnType<typeof useQueryClient>,
  revision: number,
  photos: PhotoList,
) {
  queryClient.setQueryData(QUERY_KEYS.photos, photos);
  writePhotoCache(revision, photos);
}

function patchPhotosAfterMutation(
  queryClient: ReturnType<typeof useQueryClient>,
  currentRevision: number,
  patch: (photos: PhotoList) => PhotoList,
) {
  const persisted = readPhotoCache();
  const existing = queryClient.getQueryData<PhotoList>(QUERY_KEYS.photos) ?? persisted?.data;
  // A mutation result must never turn a cold cache into a partial collection.
  // Leave it cold so the newly published revision performs one complete read.
  if (existing === undefined) return;
  writePhotosCache(
    queryClient,
    nextPhotoCacheRevision(currentRevision, persisted?.revision),
    patch(existing),
  );
}

function usePhotoSelector<T>(
  selector: (photos: PhotoList) => T,
  enabled = true,
) {
  const photosQuery = usePhotos({ enabled });
  const data = useMemo(() => selector(photosQuery.data || []), [photosQuery.data, selector]);

  return {
    ...photosQuery,
    data,
    isLoading: enabled && photosQuery.isLoading,
  };
}

// Hook for getting all photos
export function usePhotos(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const revisionsQuery = useDashboardDataRevisions({ enabled: isAuthenticated });
  const persisted = readPhotoCache();
  const cachedData = queryClient.getQueryData<PhotoList>(QUERY_KEYS.photos) ?? persisted?.data;
  const currentRevision = revisionsQuery.data?.photos ?? 0;
  const revisionsReady = isAuthenticated && revisionsQuery.data !== undefined;
  const cachePolicy = getRevisionCachePolicy({
    hasCachedData: cachedData !== undefined,
    cachedRevision: persisted?.revision,
    currentRevision,
    revisionsReady,
  });
  const enabled = options?.enabled ?? true;

  return useQuery({
    queryKey: QUERY_KEYS.photos,
    queryFn: async () => {
      const currentCache = getCachedPhotos(queryClient);
      try {
        const photos = await PhotosService.getAllPhotos(revisionsReady ? 'server' : 'default');
        const latestRevisions = queryClient.getQueryData<DashboardDataRevisions>(dashboardDataRevisionKeys.all);
        const fetchedRevision = isAuthenticated && latestRevisions !== undefined
          ? latestRevisions.photos ?? 0
          : -1;
        writePhotosCache(queryClient, fetchedRevision, photos);
        return photos;
      } catch (error) {
        console.error('Photo cache reconciliation failed:', error);
        if (currentCache !== undefined) return currentCache;
        throw error;
      }
    },
    enabled: enabled && cachePolicy.shouldFetch,
    staleTime: cachePolicy.shouldFetch ? 0 : Infinity,
    gcTime: Infinity,
    refetchOnMount: cachePolicy.shouldFetch,
    refetchOnWindowFocus: false,
    refetchOnReconnect: cachePolicy.shouldFetch,
    retry: 1,
    initialData: cachedData,
    initialDataUpdatedAt: cachedData !== undefined ? Date.now() : undefined,
    placeholderData: (prev) => prev,
  });
}

// Hook for getting photos by category
export function usePhotosByCategory(category: PhotoCategory) {
  return usePhotoSelector(
    photos => photos.filter(photo => photo.category === category),
    Boolean(category),
  );
}

// Retained temporarily as a source-level fallback during preview verification.
// It is not exported or called, so it cannot issue an additional query.
function usePhotosByCategoryWithDedicatedQuery(category: PhotoCategory) {
  return useQuery({
    queryKey: QUERY_KEYS.photosByCategory(category),
    queryFn: () => PhotosService.getPhotosByCategory(category),
    staleTime: 5 * 60 * 1000,
  });
}

// Hook for getting photos by usage
export function usePhotosByUsage(usage: PhotoUsage) {
  return usePhotoSelector(
    photos => photos.filter(photo => photo.usage?.includes(usage)),
    Boolean(usage),
  );
}

function usePhotosByUsageWithDedicatedQuery(usage: PhotoUsage) {
  return useQuery({
    queryKey: QUERY_KEYS.photosByUsage(usage),
    queryFn: () => PhotosService.getPhotosByUsage(usage),
    staleTime: 5 * 60 * 1000,
    enabled: !!usage, // Only run query if usage is provided
  });
}

// Hook for getting primary photo for a category
export function usePrimaryPhoto(category: PhotoCategory) {
  return usePhotoSelector(
    photos => photos.find(photo => photo.category === category && photo.isPrimary) || null,
    Boolean(category),
  );
}

function usePrimaryPhotoWithDedicatedQuery(category: PhotoCategory) {
  return useQuery({
    queryKey: QUERY_KEYS.primaryPhoto(category),
    queryFn: () => PhotosService.getPrimaryPhoto(category),
    staleTime: 10 * 60 * 1000, // 10 minutes for primary photos
    enabled: !!category, // Only run query if category is provided
  });
}

// Hook for getting random photos
export function useRandomPhotos(usage: PhotoUsage, count: number = 5) {
  return usePhotoSelector(
    photos => {
      const candidates = photos.filter(photo => photo.usage?.includes(usage));
      const shuffled = [...candidates].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, Math.max(0, count));
    },
    Boolean(usage),
  );
}

function useRandomPhotosWithDedicatedQuery(usage: PhotoUsage, count: number = 5) {
  return useQuery({
    queryKey: QUERY_KEYS.randomPhotos(usage, count),
    queryFn: () => PhotosService.getRandomPhotos(usage, count),
    staleTime: 2 * 60 * 1000, // 2 minutes for random photos
    enabled: !!usage, // Only run query if usage is provided
  });
}

// Hook for searching photos
export function useSearchPhotos(searchTerm: string, enabled: boolean = true) {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  return usePhotoSelector(
    photos => photos.filter(photo =>
      [photo.title, photo.description, ...(photo.tags || [])]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(normalizedSearch)),
    ),
    enabled && normalizedSearch.length > 0,
  );
}

function useSearchPhotosWithDedicatedQuery(searchTerm: string, enabled: boolean = true) {
  return useQuery({
    queryKey: QUERY_KEYS.searchPhotos(searchTerm),
    queryFn: () => PhotosService.searchPhotos(searchTerm),
    enabled: enabled && searchTerm.length > 0,
    staleTime: 1 * 60 * 1000, // 1 minute for search results
  });
}

// Hook for getting a single photo
export function usePhoto(id: string) {
  return usePhotoSelector(
    photos => photos.find(photo => photo.id === id) || null,
    Boolean(id),
  );
}

function usePhotoWithDedicatedQuery(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.photo(id),
    queryFn: () => PhotosService.getPhotoById(id),
    staleTime: 10 * 60 * 1000,
  });
}

// Hook for uploading photos
export function useUploadPhoto() {
  const queryClient = useQueryClient();
  const currentRevision = useDashboardDataRevisions().data?.photos ?? 0;

  return useMutation({
    mutationFn: (data: {
      file: File;
      metadata: {
        title: string;
        description?: string;
        category: PhotoCategory;
        usage: PhotoUsage[];
        uploadedBy: string;
        tags?: string[];
        isPrimary?: boolean;
      };
    }) => PhotosService.uploadPhoto(data.file, data.metadata),
    onSuccess: (newPhoto) => {
      patchPhotosAfterMutation(
        queryClient,
        currentRevision,
        photos => upsertPhotoInList(photos, newPhoto),
      );
    },
  });
}

// Hook for uploading photos (hybrid proxy, bypasses CORS)
export function useUploadPhotoHybrid() {
  const queryClient = useQueryClient();
  const currentRevision = useDashboardDataRevisions().data?.photos ?? 0;

  return useMutation({
    mutationFn: (data: {
      file: File;
      metadata: {
        title: string;
        description?: string;
        category: PhotoCategory;
        usage: PhotoUsage[];
        uploadedBy: string;
        tags?: string[];
        isPrimary?: boolean;
      };
    }) => PhotosService.uploadPhotoHybrid(data.file, data.metadata),
    onSuccess: (newPhoto) => {
      patchPhotosAfterMutation(
        queryClient,
        currentRevision,
        photos => upsertPhotoInList(photos, newPhoto),
      );
    },
  });
}

// Hook for updating photos
export function useUpdatePhoto() {
  const queryClient = useQueryClient();
  const currentRevision = useDashboardDataRevisions().data?.photos ?? 0;

  return useMutation({
    mutationFn: (data: { id: string; updates: Partial<Omit<Photo, 'id' | 'uploadedAt' | 'url' | 'fileName'>> }) =>
      PhotosService.updatePhoto(data.id, data.updates),
    onSuccess: (_, variables) => {
      patchPhotosAfterMutation(
        queryClient,
        currentRevision,
        photos => updatePhotoInList(photos, variables.id, variables.updates),
      );
    },
  });
}

// Hook for setting primary photo
export function useSetPrimaryPhoto() {
  const queryClient = useQueryClient();
  const currentRevision = useDashboardDataRevisions().data?.photos ?? 0;

  return useMutation({
    mutationFn: (data: { id: string; category: PhotoCategory }) =>
      PhotosService.setPrimaryPhoto(data.id, data.category),
    onSuccess: (_, variables) => {
      patchPhotosAfterMutation(
        queryClient,
        currentRevision,
        photos => setPrimaryPhotoInList(photos, variables.id, variables.category),
      );
    },
  });
}

// Hook for deleting photos (soft delete)
export function useDeletePhoto() {
  const queryClient = useQueryClient();
  const currentRevision = useDashboardDataRevisions().data?.photos ?? 0;

  return useMutation({
    mutationFn: (id: string) => PhotosService.deletePhoto(id),
    onSuccess: (_, id) => {
      patchPhotosAfterMutation(
        queryClient,
        currentRevision,
        photos => removePhotoFromList(photos, id),
      );
    },
  });
}

// Hook for permanently deleting photos
export function usePermanentlyDeletePhoto() {
  const queryClient = useQueryClient();
  const currentRevision = useDashboardDataRevisions().data?.photos ?? 0;

  return useMutation({
    mutationFn: (id: string) => PhotosService.permanentlyDeletePhoto(id),
    onSuccess: (_, id) => {
      patchPhotosAfterMutation(
        queryClient,
        currentRevision,
        photos => removePhotoFromList(photos, id),
      );
    },
  });
}
