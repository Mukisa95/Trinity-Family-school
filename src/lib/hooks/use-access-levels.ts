import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { collection, query as firestoreQuery, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { AccessLevelsService } from '@/lib/services/access-levels.service';
import { CreateAccessLevelData, UpdateAccessLevelData } from '@/types/access-levels';
import { useAuth } from '@/lib/contexts/auth-context';

const ACCESS_LEVELS_QUERY_KEY = 'accessLevels';

// Get all access levels
export function useAccessLevels() {
  const queryClient = useQueryClient();

  // 🚀 BULLETPROOF REAL-TIME LISTENER for access levels
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🎧 REALTIME: Setting up access levels listener...');
    }

    let unsubscribe: (() => void) | null = null;
    let isActive = true;
    let listenerFired = false;
    let fallbackTimeout: NodeJS.Timeout | null = null;

    const setupListener = () => {
      if (!isActive) return;

      // 🔧 FIX: Unsubscribe old listener before creating a new one
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }

      try {
        const accessLevelsQuery = firestoreQuery(collection(db, 'accessLevels'));

        unsubscribe = onSnapshot(
          accessLevelsQuery,
          {
            includeMetadataChanges: true
          },
          (snapshot) => {
            if (!isActive) return;

            listenerFired = true;

            const accessLevels = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));

            const fromCache = snapshot.metadata.fromCache;

            if (process.env.NODE_ENV === 'development') {
              console.log(`⚡ REALTIME: Loaded ${accessLevels.length} access levels`, {
                fromCache,
                source: fromCache ? '📦 cache' : '☁️ server'
              });
            }

            queryClient.setQueryData([ACCESS_LEVELS_QUERY_KEY, 'all'], accessLevels);
          },
          (error) => {
            if (!isActive) return;
            console.error('❌ REALTIME ACCESS LEVELS ERROR:', error.message);
          }
        );

        // Fallback
        fallbackTimeout = setTimeout(async () => {
          if (!listenerFired && isActive) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ REALTIME: Access levels listener did not fire, fetching manually...');
            }

            try {
              const accessLevels = await AccessLevelsService.getAllAccessLevels();
              queryClient.setQueryData([ACCESS_LEVELS_QUERY_KEY, 'all'], accessLevels);
              if (process.env.NODE_ENV === 'development') {
                console.log(`✅ FALLBACK: Loaded ${accessLevels.length} access levels`);
              }
            } catch (error) {
              console.error('❌ FALLBACK: Access levels fetch failed:', error);
            }
          }
        }, 3000);

      } catch (error) {
        console.error('❌ REALTIME: Failed to setup access levels listener:', error);
      }
    };

    setupListener();

    return () => {
      isActive = false;
      if (fallbackTimeout) clearTimeout(fallbackTimeout);
      if (unsubscribe) unsubscribe();

      if (process.env.NODE_ENV === 'development') {
        console.log('🔌 REALTIME: Cleaned up access levels listener');
      }
    };
  }, [queryClient]);

  return useQuery({
    queryKey: [ACCESS_LEVELS_QUERY_KEY, 'all'],
    queryFn: async () => {
      const cachedData = queryClient.getQueryData([ACCESS_LEVELS_QUERY_KEY, 'all']);
      if (cachedData) {
        if (process.env.NODE_ENV === 'development') {
          console.log('⚡ useAccessLevels: Using cached data');
        }
        return cachedData as Awaited<ReturnType<typeof AccessLevelsService.getAllAccessLevels>>;
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('📥 useAccessLevels: No cache, fetching from server...');
      }
      return AccessLevelsService.getAllAccessLevels();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
    initialData: () => {
      const cached = queryClient.getQueryData([ACCESS_LEVELS_QUERY_KEY, 'all']);
      return cached as Awaited<ReturnType<typeof AccessLevelsService.getAllAccessLevels>> | undefined;
    },
  });
}

// Get active access levels only
export function useActiveAccessLevels() {
  return useQuery({
    queryKey: [ACCESS_LEVELS_QUERY_KEY, 'active'],
    queryFn: () => AccessLevelsService.getActiveAccessLevels(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get access level by ID
export function useAccessLevel(id: string) {
  return useQuery({
    queryKey: [ACCESS_LEVELS_QUERY_KEY, id],
    queryFn: () => AccessLevelsService.getAccessLevelById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get default access level
export function useDefaultAccessLevel() {
  return useQuery({
    queryKey: [ACCESS_LEVELS_QUERY_KEY, 'default'],
    queryFn: () => AccessLevelsService.getDefaultAccessLevel(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Create access level mutation
export function useCreateAccessLevel() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateAccessLevelData) => {
      if (!user) throw new Error('User not authenticated');
      return AccessLevelsService.createAccessLevel(data, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACCESS_LEVELS_QUERY_KEY] });
    },
  });
}

// Update access level mutation
export function useUpdateAccessLevel() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateAccessLevelData }) => {
      if (!user) throw new Error('User not authenticated');
      return AccessLevelsService.updateAccessLevel(id, data, user.id);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [ACCESS_LEVELS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ACCESS_LEVELS_QUERY_KEY, id] });
    },
  });
}

// Delete access level mutation
export function useDeleteAccessLevel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => AccessLevelsService.deleteAccessLevel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACCESS_LEVELS_QUERY_KEY] });
    },
  });
}

// Initialize predefined levels mutation
export function useInitializePredefinedLevels() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not authenticated');
      return AccessLevelsService.initializePredefinedLevels(user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACCESS_LEVELS_QUERY_KEY] });
    },
  });
}
