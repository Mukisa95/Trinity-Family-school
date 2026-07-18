import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

      // Give the layout-level listener a short head start. It owns the live
      // subscription for the whole session and normally hydrates the offline
      // cache immediately, avoiding a duplicate cold-start read here.
      await new Promise(resolve => setTimeout(resolve, 120));
      const preloadedData = queryClient.getQueryData<Staff[]>(['staff']);
      if (preloadedData && preloadedData.length > 0) return preloadedData;

      if (process.env.NODE_ENV === 'development') {
        console.log('📥 useStaff: No cache, fetching from server...');
      }
      return StaffService.getAllStaff();
    },
    staleTime: Infinity, // GlobalDataPreloader owns the real-time listener
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
