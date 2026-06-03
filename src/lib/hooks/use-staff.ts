import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';
import { StaffService } from '../services/staff.service';
import type { Staff } from '@/types';

export const STAFF_QUERY_KEYS = {
  all: ['staff'] as const,
  lists: () => [...STAFF_QUERY_KEYS.all, 'list'] as const,
  list: (filters: string) => [...STAFF_QUERY_KEYS.lists(), { filters }] as const,
  details: () => [...STAFF_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...STAFF_QUERY_KEYS.details(), id] as const,
  byDepartment: (department: string) => [...STAFF_QUERY_KEYS.all, 'department', department] as const,
};

export function useStaff() {
  const queryClient = useQueryClient();

  // 🚀 CRITICAL: Get cached data immediately to avoid loading state
  const cachedData = queryClient.getQueryData<Staff[]>(['staff']);

  // 🚀 BULLETPROOF REAL-TIME LISTENER with automatic reconnection
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🎧 REALTIME: Setting up bulletproof staff listener...');
    }

    let unsubscribe: (() => void) | null = null;
    let isActive = true;
    let retryCount = 0;
    let retryTimeout: NodeJS.Timeout | null = null;
    let fallbackFetchTimeout: NodeJS.Timeout | null = null;
    let listenerFired = false;

    const setupListener = () => {
      if (!isActive) return;

      // 🔧 CRITICAL FIX: Unsubscribe old listener before creating a new one
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }

      try {
        const staffQuery = query(collection(db, 'staff'));

        unsubscribe = onSnapshot(
          staffQuery,
          // Removed includeMetadataChanges for faster real-time sync
          (snapshot) => {
            if (!isActive) return;

            listenerFired = true;
            retryCount = 0;

            const staffList = snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate?.() || new Date(),
                updatedAt: data.updatedAt?.toDate?.() || new Date(),
                dateOfBirth: data.dateOfBirth?.toDate?.() || null,
                dateOfJoining: data.dateOfJoining?.toDate?.() || null,
              } as Staff;
            });

            const fromCache = snapshot.metadata.fromCache;

            if (process.env.NODE_ENV === 'development') {
              console.log(`⚡ REALTIME: Loaded ${staffList.length} staff members`, {
                fromCache,
                source: fromCache ? '📦 cache' : '☁️ server'
              });
            }

            // 🚀 INSTANT SYNC: Always update cache with real-time data
            queryClient.setQueryData(['staff'], staffList);

            if (process.env.NODE_ENV === 'development') {
              console.log(`✅ REALTIME: Updated cache with ${staffList.length} staff (instant sync)`);
            }
          },
          (error) => {
            if (!isActive) return;

            // 🔧 FIX: Suppress 'already-exists' errors - non-fatal
            if (error?.code === 'already-exists' || error?.message?.includes('Target ID already exists')) {
              console.warn('⚠️ REALTIME: Suppressed duplicate target error (non-fatal)');
              return;
            }

            listenerFired = true;
            console.error('❌ REALTIME STAFF ERROR:', error.message);

            // Automatic reconnection with exponential backoff
            if (retryCount < 3) {
              retryCount++;
              const backoffDelay = Math.min(1000 * Math.pow(2, retryCount - 1), 10000);

              if (process.env.NODE_ENV === 'development') {
                console.log(`🔄 REALTIME: Reconnecting staff in ${backoffDelay}ms...`);
              }

              retryTimeout = setTimeout(() => {
                if (isActive) setupListener();
              }, backoffDelay);
            }
          }
        );

        // Fallback: trigger manual fetch if listener doesn't fire
        fallbackFetchTimeout = setTimeout(async () => {
          if (!listenerFired && isActive) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ REALTIME: Staff listener did not fire, fetching manually...');
            }

            const cachedData = queryClient.getQueryData<Staff[]>(['staff']);
            if (!cachedData || cachedData.length === 0) {
              try {
                const staff = await StaffService.getAllStaff();
                if (staff && staff.length > 0) {
                  queryClient.setQueryData(['staff'], staff);
                  if (process.env.NODE_ENV === 'development') {
                    console.log(`✅ FALLBACK: Loaded ${staff.length} staff members`);
                  }
                }
              } catch (fetchError) {
                console.error('❌ FALLBACK: Staff fetch failed:', fetchError);
              }
            }
          }
        }, 5000);

      } catch (setupError) {
        console.error('❌ REALTIME: Failed to setup staff listener:', setupError);
      }
    };

    setupListener();

    // 🔧 FIX: Removed handleOnline - Firestore SDK handles reconnection internally

    // Cleanup
    return () => {
      isActive = false;
      if (retryTimeout) clearTimeout(retryTimeout);
      if (fallbackFetchTimeout) clearTimeout(fallbackFetchTimeout);
      if (unsubscribe) unsubscribe();

      if (process.env.NODE_ENV === 'development') {
        console.log('🔌 REALTIME: Cleaned up staff listener');
      }
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      // Check if we already have cached data from real-time listener
      const currentCachedData = queryClient.getQueryData<Staff[]>(['staff']);
      if (currentCachedData && currentCachedData.length > 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`⚡ useStaff: Using ${currentCachedData.length} staff from cache`);
        }
        return currentCachedData;
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('📥 useStaff: No cache, fetching from server...');
      }
      return StaffService.getAllStaff();
    },
    staleTime: 0, // Real-time listener handles updates - no stale time needed
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnMount: false, // Don't refetch when component mounts - use cache
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on reconnect
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
}

export function useStaffById(id: string) {
  const queryClient = useQueryClient();

  // 🚀 CRITICAL: Get cached staff data immediately to find staff by id
  const cachedStaff = queryClient.getQueryData<Staff[]>(['staff']);

  return useQuery({
    queryKey: ['staff', id],
    queryFn: async () => {
      // 🚀 CRITICAL: If we have cached staff, find by id (instant!)
      if (cachedStaff && cachedStaff.length > 0 && id) {
        const foundStaff = cachedStaff.find((staff) => staff.id === id);
        if (foundStaff) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`⚡ useStaffById: Using staff from cache (instant!)`);
          }
          return foundStaff;
        }
      }

      // Fallback to service if cache doesn't have this staff
      if (process.env.NODE_ENV === 'development') {
        console.log('📥 useStaffById: No cache, fetching from server...');
      }
      return StaffService.getStaffById(id);
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes cache
    gcTime: 30 * 60 * 1000, // 30 minutes cache
    refetchOnMount: false, // Don't refetch when component mounts - use cache
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: false, // Don't refetch on reconnect
    // 🚀 CRITICAL: Use cached data as initialData to prevent loading state
    initialData: () => {
      if (cachedStaff && cachedStaff.length > 0 && id) {
        const foundStaff = cachedStaff.find((staff) => staff.id === id);
        return foundStaff || undefined;
      }
      return undefined;
    },
    // 🚀 CRITICAL: Use cached data as placeholder to show immediately
    placeholderData: (previousData) => {
      // If we have cached staff, find and use it immediately
      if (cachedStaff && cachedStaff.length > 0 && id) {
        const foundStaff = cachedStaff.find((staff) => staff.id === id);
        if (foundStaff) {
          return foundStaff;
        }
      }
      // Otherwise use previous data if available
      return previousData;
    },
  });
}

export function useStaffByDepartment(department: string) {
  return useQuery({
    queryKey: STAFF_QUERY_KEYS.byDepartment(department),
    queryFn: () => StaffService.getStaffByDepartment(department),
    enabled: !!department,
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (staffData: Omit<Staff, 'id' | 'createdAt'>) =>
      StaffService.createStaff(staffData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STAFF_QUERY_KEYS.all });
    },
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<Staff, 'id' | 'createdAt'>> }) =>
      StaffService.updateStaff(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: STAFF_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: STAFF_QUERY_KEYS.detail(id) });
    },
  });
}

export function useDeleteStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => StaffService.deleteStaff(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STAFF_QUERY_KEYS.all });
    },
  });
} 