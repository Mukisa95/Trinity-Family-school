import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/auth-context';
import { StaffService } from '../services/staff.service';
import type { Staff } from '@/types';
import {
  getStaffCacheScope,
  normaliseStaff,
  readStaffCache,
  writeStaffCache,
} from '@/lib/cache/staff-cache';

// All normal staff consumers observe one identity-scoped list. The global
// staff-cache bootstrap is the only browser path allowed to read Firestore.
export const STAFF_QUERY_KEYS = {
  all: ['staff'] as const,
  lists: () => [...STAFF_QUERY_KEYS.all, 'list'] as const,
  list: (scope: string) => [...STAFF_QUERY_KEYS.lists(), scope] as const,
};

function patchStaffSnapshot(
  queryClient: ReturnType<typeof useQueryClient>,
  scope: string,
  patch: (current: Staff[]) => Staff[],
) {
  if (!scope) return;
  const queryKey = STAFF_QUERY_KEYS.list(scope);
  const current = queryClient.getQueryData<Staff[]>(queryKey) ?? readStaffCache(scope)?.data ?? [];
  const next = normaliseStaff(patch(current));
  queryClient.setQueryData(queryKey, next);
  StaffService.hydrateSharedStaff(next);
  // The settings revision will perform the one authoritative reconciliation.
  // -1 must never be presented as a confirmed server revision.
  writeStaffCache(scope, -1, next);
}

export function useStaff() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const scope = isAuthenticated ? getStaffCacheScope(user?.id, user?.role) : '';
  const queryKey = STAFF_QUERY_KEYS.list(scope);
  const inMemory = queryClient.getQueryData<Staff[]>(queryKey);
  const persisted = inMemory === undefined ? readStaffCache(scope) : null;
  const initialData = inMemory ?? persisted?.data;

  const query = useQuery({
    queryKey,
    // Cache-only by design. This makes a page unable to create a private
    // staff read while the central cache owner is hydrating or reconciling.
    queryFn: async () => queryClient.getQueryData<Staff[]>(queryKey) ?? [],
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

  return {
    ...query,
    isLoading: !!scope && query.data === undefined,
  };
}

export function useStaffById(id: string, options?: { enabled?: boolean }) {
  const staffQuery = useStaff();
  const data = useMemo(
    () => staffQuery.data?.find(staff => staff.id === id),
    [id, staffQuery.data],
  );

  return {
    ...staffQuery,
    data,
    isLoading: options?.enabled !== false && !!id && staffQuery.isLoading,
  };
}

export function useStaffByDepartment(department: string) {
  const staffQuery = useStaff();
  const data = useMemo(
    () => (staffQuery.data ?? []).filter(staff => staff.department?.includes(department)),
    [department, staffQuery.data],
  );

  return {
    ...staffQuery,
    data,
    isLoading: !!department && staffQuery.isLoading,
  };
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const scope = isAuthenticated ? getStaffCacheScope(user?.id, user?.role) : '';

  return useMutation({
    mutationFn: (staffData: Omit<Staff, 'id' | 'createdAt'>) => StaffService.createStaff(staffData),
    onSuccess: created => {
      patchStaffSnapshot(queryClient, scope, current => [...current, created]);
    },
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const scope = isAuthenticated ? getStaffCacheScope(user?.id, user?.role) : '';

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<Staff, 'id' | 'createdAt'>> }) =>
      StaffService.updateStaff(id, data),
    onSuccess: (updated, { id }) => {
      patchStaffSnapshot(queryClient, scope, current => current.map(staff =>
        staff.id === id ? { ...staff, ...updated, id } : staff,
      ));
    },
  });
}

export function useDeleteStaff() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const scope = isAuthenticated ? getStaffCacheScope(user?.id, user?.role) : '';

  return useMutation({
    mutationFn: (id: string) => StaffService.deleteStaff(id),
    onSuccess: (_, id) => {
      patchStaffSnapshot(queryClient, scope, current => current.filter(staff => staff.id !== id));
    },
  });
}
