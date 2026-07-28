import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { PhotosService } from '@/lib/services/photos.service';
import { liteRead, liteWrite, liteInvalidate, LITE_KEYS, LITE_TTL } from '@/lib/cache/lite-cache';
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

function writePhotosCache(queryClient: ReturnType<typeof useQueryClient>, photos: PhotoList) {
  queryClient.setQueryData(QUERY_KEYS.photos, photos);
  liteWrite(LITE_KEYS.photos, photos, LITE_TTL.photos);
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

  // Read synchronously from lite sessionStorage cache — this is the initial render
  // value so there is zero loading flash on warm page loads (photos visible instantly).
  const litePhotos = liteRead<Awaited<ReturnType<typeof PhotosService.getAllPhotos>>>(LITE_KEYS.photos);

  return useQuery({
    queryKey: QUERY_KEYS.photos,
    queryFn: async () => {
      // Check React Query in-memory cache first (populated by preloader)
      const cachedData = queryClient.getQueryData(QUERY_KEYS.photos);
      if (cachedData) return cachedData as Awaited<ReturnType<typeof PhotosService.getAllPhotos>>;
      // Fallback to service
      return PhotosService.getAllPhotos();
    },
    enabled: options?.enabled !== undefined ? options.enabled : true,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // Lite cache provides instant data so the component renders without a loading state
    initialData: () => {
      const mem = queryClient.getQueryData(QUERY_KEYS.photos);
      if (mem) return mem as Awaited<ReturnType<typeof PhotosService.getAllPhotos>>;
      return litePhotos || undefined;
    },
    initialDataUpdatedAt: litePhotos ? Date.now() : undefined,
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
      const existing = queryClient.getQueryData<PhotoList>(QUERY_KEYS.photos) || liteRead<PhotoList>(LITE_KEYS.photos) || [];
      writePhotosCache(queryClient, [newPhoto, ...existing.filter(photo => photo.id !== newPhoto.id)]);
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.photos });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.photosByCategory(newPhoto.category) });
      
      // Invalidate usage queries
      newPhoto.usage.forEach(usage => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.photosByUsage(usage) });
        queryClient.invalidateQueries({ queryKey: ['photos', 'random', usage] });
      });

      // If it's a primary photo, invalidate primary photo query
      if (newPhoto.isPrimary) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.primaryPhoto(newPhoto.category) });
      }
    },
  });
}

// Hook for uploading photos (hybrid proxy, bypasses CORS)
export function useUploadPhotoHybrid() {
  const queryClient = useQueryClient();

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
      const existing = queryClient.getQueryData<PhotoList>(QUERY_KEYS.photos) || liteRead<PhotoList>(LITE_KEYS.photos) || [];
      writePhotosCache(queryClient, [newPhoto, ...existing.filter(photo => photo.id !== newPhoto.id)]);
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.photos });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.photosByCategory(newPhoto.category) });
      
      // Invalidate usage queries
      newPhoto.usage.forEach(usage => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.photosByUsage(usage) });
        queryClient.invalidateQueries({ queryKey: ['photos', 'random', usage] });
      });

      // If it's a primary photo, invalidate primary photo query
      if (newPhoto.isPrimary) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.primaryPhoto(newPhoto.category) });
      }
    },
  });
}

// Hook for updating photos
export function useUpdatePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { id: string; updates: Partial<Omit<Photo, 'id' | 'uploadedAt' | 'url' | 'fileName'>> }) =>
      PhotosService.updatePhoto(data.id, data.updates),
    onSuccess: (_, variables) => {
      const existing = queryClient.getQueryData<PhotoList>(QUERY_KEYS.photos) || liteRead<PhotoList>(LITE_KEYS.photos) || [];
      writePhotosCache(
        queryClient,
        existing.map(photo => photo.id === variables.id ? { ...photo, ...variables.updates } : photo),
      );
      // Invalidate all photo queries to ensure consistency
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.photos });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.photo(variables.id) });
      
      // Invalidate category and usage queries if they might have changed
      if (variables.updates.category) {
        queryClient.invalidateQueries({ queryKey: ['photos', 'category'] });
      }
      if (variables.updates.usage) {
        queryClient.invalidateQueries({ queryKey: ['photos', 'usage'] });
        queryClient.invalidateQueries({ queryKey: ['photos', 'random'] });
      }
      if (variables.updates.isPrimary !== undefined) {
        queryClient.invalidateQueries({ queryKey: ['photos', 'primary'] });
      }
    },
  });
}

// Hook for setting primary photo
export function useSetPrimaryPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { id: string; category: PhotoCategory }) =>
      PhotosService.setPrimaryPhoto(data.id, data.category),
    onSuccess: (_, variables) => {
      const existing = queryClient.getQueryData<PhotoList>(QUERY_KEYS.photos) || liteRead<PhotoList>(LITE_KEYS.photos) || [];
      writePhotosCache(
        queryClient,
        existing.map(photo => photo.category === variables.category
          ? { ...photo, isPrimary: photo.id === variables.id }
          : photo),
      );
      // Invalidate primary photo queries for this category
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.primaryPhoto(variables.category) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.photosByCategory(variables.category) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.photos });
    },
  });
}

// Hook for deleting photos (soft delete)
export function useDeletePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => PhotosService.deletePhoto(id),
    onSuccess: (_, id) => {
      const existing = queryClient.getQueryData<PhotoList>(QUERY_KEYS.photos) || liteRead<PhotoList>(LITE_KEYS.photos) || [];
      writePhotosCache(queryClient, existing.filter(photo => photo.id !== id));
      // Invalidate all photo queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.photos });
      queryClient.invalidateQueries({ queryKey: ['photos', 'category'] });
      queryClient.invalidateQueries({ queryKey: ['photos', 'usage'] });
      queryClient.invalidateQueries({ queryKey: ['photos', 'primary'] });
      queryClient.invalidateQueries({ queryKey: ['photos', 'random'] });
    },
  });
}

// Hook for permanently deleting photos
export function usePermanentlyDeletePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => PhotosService.permanentlyDeletePhoto(id),
    onSuccess: (_, id) => {
      const existing = queryClient.getQueryData<PhotoList>(QUERY_KEYS.photos) || liteRead<PhotoList>(LITE_KEYS.photos) || [];
      writePhotosCache(queryClient, existing.filter(photo => photo.id !== id));
      // Invalidate all photo queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.photos });
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    },
  });
}
