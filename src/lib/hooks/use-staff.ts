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
  return useQuery({
    queryKey: ['staff'],
    queryFn: () => StaffService.getAllStaff(),
  });
}

export function useStaffById(id: string) {
  return useQuery({
    queryKey: ['staff', id],
    queryFn: () => StaffService.getStaffById(id),
    enabled: !!id,
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