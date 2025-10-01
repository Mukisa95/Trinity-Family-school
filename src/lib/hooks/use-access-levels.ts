import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AccessLevelsService } from '@/lib/services/access-levels.service';
import { CreateAccessLevelData, UpdateAccessLevelData } from '@/types/access-levels';
import { useAuth } from '@/lib/contexts/auth-context';

const ACCESS_LEVELS_QUERY_KEY = 'accessLevels';

// Get all access levels
export function useAccessLevels() {
  return useQuery({
    queryKey: [ACCESS_LEVELS_QUERY_KEY, 'all'],
    queryFn: () => AccessLevelsService.getAllAccessLevels(),
    staleTime: 5 * 60 * 1000, // 5 minutes
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
