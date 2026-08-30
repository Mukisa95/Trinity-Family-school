import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/auth-context';
import { HousesService } from '../services/houses.service';
import {
  getHouseCacheScope,
  normaliseHouses,
  readHouseCache,
  writeHouseCache,
} from '@/lib/cache/house-cache';
import { selectHouseById } from '@/lib/selectors/reference-data-selectors';
import type { House } from '@/types';

export const houseKeys = {
  all: ['houses'] as const,
  lists: () => [...houseKeys.all, 'list'] as const,
  list: (scope: string) => [...houseKeys.lists(), scope] as const,
};

function patchHouseSnapshot(
  queryClient: ReturnType<typeof useQueryClient>,
  scope: string,
  patch: (current: House[]) => House[],
) {
  if (!scope) return;
  const queryKey = houseKeys.list(scope);
  const current = queryClient.getQueryData<House[]>(queryKey) ?? readHouseCache(scope)?.data ?? [];
  const next = normaliseHouses(patch(current));
  queryClient.setQueryData(queryKey, next);
  HousesService.hydrateSharedHouses(next);
  writeHouseCache(scope, -1, next);
}

export function useHouses() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const scope = isAuthenticated ? getHouseCacheScope(user?.id, user?.role) : '';
  const queryKey = houseKeys.list(scope);
  const inMemory = queryClient.getQueryData<House[]>(queryKey);
  const persisted = inMemory === undefined ? readHouseCache(scope) : null;
  const initialData = inMemory ?? persisted?.data;

  const query = useQuery({
    queryKey,
    queryFn: async () => queryClient.getQueryData<House[]>(queryKey) ?? [],
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

  return { ...query, isLoading: !!scope && query.data === undefined };
}

export function useHouse(id: string) {
  const housesQuery = useHouses();
  const data = useMemo(() => selectHouseById(housesQuery.data, id), [housesQuery.data, id]);
  return { ...housesQuery, data };
}

export function useCreateHouse() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const scope = isAuthenticated ? getHouseCacheScope(user?.id, user?.role) : '';
  return useMutation({
    mutationFn: (data: Omit<House, 'id' | 'createdAt' | 'updatedAt'>) => HousesService.create(data),
    onSuccess: created => patchHouseSnapshot(queryClient, scope, current => [...current, created]),
  });
}

export function useUpdateHouse() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const scope = isAuthenticated ? getHouseCacheScope(user?.id, user?.role) : '';
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<House, 'id' | 'createdAt'>> }) =>
      HousesService.update(id, data),
    onSuccess: updated => patchHouseSnapshot(queryClient, scope, current =>
      current.map(house => house.id === updated.id ? updated : house),
    ),
  });
}

export function useDeleteHouse() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const scope = isAuthenticated ? getHouseCacheScope(user?.id, user?.role) : '';
  return useMutation({
    mutationFn: (id: string) => HousesService.remove(id),
    onSuccess: (_, id) => patchHouseSnapshot(queryClient, scope, current =>
      current.filter(house => house.id !== id),
    ),
  });
}
