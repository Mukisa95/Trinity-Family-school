import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PhotosService } from '@/lib/services/photos.service';
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

// Hook for getting all photos
export function usePhotos(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: QUERY_KEYS.photos,
    queryFn: PhotosService.getAllPhotos,
    enabled: options?.enabled !== undefined ? options.enabled : true,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook for getting photos by category
export function usePhotosByCategory(category: PhotoCategory) {
  return useQuery({
    queryKey: QUERY_KEYS.photosByCategory(category),
    queryFn: () => PhotosService.getPhotosByCategory(category),
    staleTime: 5 * 60 * 1000,
  });
}

// Hook for getting photos by usage
export function usePhotosByUsage(usage: PhotoUsage) {
  return useQuery({
    queryKey: QUERY_KEYS.photosByUsage(usage),
    queryFn: () => PhotosService.getPhotosByUsage(usage),
    staleTime: 5 * 60 * 1000,
    enabled: !!usage, // Only run query if usage is provided
  });
}

// Hook for getting primary photo for a category
export function usePrimaryPhoto(category: PhotoCategory) {
  return useQuery({
    queryKey: QUERY_KEYS.primaryPhoto(category),
    queryFn: () => PhotosService.getPrimaryPhoto(category),
    staleTime: 10 * 60 * 1000, // 10 minutes for primary photos
    enabled: !!category, // Only run query if category is provided
  });
}

// Hook for getting random photos
export function useRandomPhotos(usage: PhotoUsage, count: number = 5) {
  return useQuery({
    queryKey: QUERY_KEYS.randomPhotos(usage, count),
    queryFn: () => PhotosService.getRandomPhotos(usage, count),
    staleTime: 2 * 60 * 1000, // 2 minutes for random photos
    enabled: !!usage, // Only run query if usage is provided
  });
}

// Hook for searching photos
export function useSearchPhotos(searchTerm: string, enabled: boolean = true) {
  return useQuery({
    queryKey: QUERY_KEYS.searchPhotos(searchTerm),
    queryFn: () => PhotosService.searchPhotos(searchTerm),
    enabled: enabled && searchTerm.length > 0,
    staleTime: 1 * 60 * 1000, // 1 minute for search results
  });
}

// Hook for getting a single photo
export function usePhoto(id: string) {
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
    onSuccess: () => {
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
    onSuccess: () => {
      // Invalidate all photo queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.photos });
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    },
  });
} 