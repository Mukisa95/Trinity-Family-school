import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClassesService } from '../services/classes.service';
import { useDigitalSignatureHelpers } from './use-digital-signature';
import { useAuth } from '../contexts/auth-context';
import type { Class } from '@/types';
import { sortClassesByOrder } from '../utils/class-order';

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
  const queryClient = useQueryClient();

  // 🚀 CRITICAL: Get cached data immediately to avoid loading state
  const cachedData = queryClient.getQueryData<Class[]>(classesKeys.lists());

  // Initial query with cache-first strategy
  const query = useQuery({
    queryKey: classesKeys.lists(),
    queryFn: async () => {
      // Check if we already have cached data from real-time listener
      const currentCachedData = queryClient.getQueryData<Class[]>(classesKeys.lists());
      if (currentCachedData && currentCachedData.length > 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`⚡ useClasses: Using ${currentCachedData.length} classes from cache`);
        }
        return currentCachedData;
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('📚 Loading classes from server...');
      }
      const classes = await ClassesService.getAll();
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Classes loaded:', classes.length);
      }
      // 🛡️ GUARD: Never overwrite good cached data with empty server results
      // This prevents network timeouts from wiping out data already loaded by the real-time listener
      if (classes.length === 0) {
        const existingCache = queryClient.getQueryData<Class[]>(classesKeys.lists());
        if (existingCache && existingCache.length > 0) {
          if (process.env.NODE_ENV === 'development') {
            console.log('🛡️ Classes: Server returned 0 but cache has', existingCache.length, 'classes - keeping cache');
          }
          return existingCache;
        }
      }
      return classes;
    },
    select: (data) => sortClassesByOrder(data || []),
    staleTime: Infinity, // Real-time listener handles ALL updates - queryFn only runs once for initial load
    gcTime: 60 * 60 * 1000, // 1 hour cache
    refetchOnMount: false, // Don't refetch when component mounts - use cache
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on reconnect
    refetchInterval: false,
    // 🚀 CRITICAL: Use cached data as initialData to prevent loading state
    initialData: cachedData && cachedData.length > 0 ? cachedData : undefined,
    // 🚀 CRITICAL: Use cached data as placeholder to show immediately
    placeholderData: (previousData) => {
      // If we have cached data, use it immediately
      if (cachedData && cachedData.length > 0) {
        return cachedData;
      }
      // Otherwise use previous data if available
      return previousData;
    },
  });

  // 🚀 NOTE: Real-time Firestore listener is managed by GlobalDataPreloader (in layout.tsx)
  // which persists across page navigations and writes to the same classesKeys.lists() cache key.
  // Having a listener here caused teardown/re-setup on every navigation, triggering data reloads.

  return query;
}

export function useClass(id: string) {
  const queryClient = useQueryClient();

  // 🚀 CRITICAL: Get cached classes data immediately to find class by id
  const cachedClasses = queryClient.getQueryData<Class[]>(classesKeys.lists());

  return useQuery({
    queryKey: classesKeys.detail(id),
    queryFn: async () => {
      // 🚀 CRITICAL: If we have cached classes, find the class by id (instant!)
      if (cachedClasses && cachedClasses.length > 0 && id) {
        const foundClass = cachedClasses.find((cls) => cls.id === id);
        if (foundClass) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`⚡ useClass: Using class from cache (instant!)`);
          }
          return foundClass;
        }
      }

      // Fallback to service if cache doesn't have this class
      if (process.env.NODE_ENV === 'development') {
        console.log('📥 useClass: No cache, fetching from server...');
      }
      return ClassesService.getById(id);
    },
    enabled: !!id,
    staleTime: 30 * 60 * 1000, // 30 minutes - classes rarely change
    gcTime: 60 * 60 * 1000, // 1 hour cache
    refetchOnMount: false, // Don't refetch when component mounts - use cache
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on reconnect
    // 🚀 CRITICAL: Use cached data as initialData to prevent loading state
    initialData: () => {
      if (cachedClasses && cachedClasses.length > 0 && id) {
        const foundClass = cachedClasses.find((cls) => cls.id === id);
        return foundClass || undefined;
      }
      return undefined;
    },
    // 🚀 CRITICAL: Use cached data as placeholder to show immediately
    placeholderData: (previousData) => {
      // If we have cached classes, find and use the class immediately
      if (cachedClasses && cachedClasses.length > 0 && id) {
        const foundClass = cachedClasses.find((cls) => cls.id === id);
        if (foundClass) {
          return foundClass;
        }
      }
      // Otherwise use previous data if available
      return previousData;
    },
  });
}

export function useClassesByLevel(level: string) {
  return useQuery({
    queryKey: classesKeys.byLevel(level),
    queryFn: () => ClassesService.getByLevel(level),
    select: (data) => sortClassesByOrder(data || []),
    enabled: !!level,
    staleTime: 30 * 60 * 1000, // 30 minutes - cache-first means instant loads
    gcTime: 60 * 60 * 1000, // 1 hour cache
    refetchOnMount: false, // Cache is fast
    refetchOnWindowFocus: false, // Classes by level don't change frequently
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