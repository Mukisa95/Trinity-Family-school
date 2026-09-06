import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ItemCatalogService } from '@/lib/services/item-catalog.service';
import type {
  CreateAndLinkLegacyItemsData,
  CreateSchoolItemCatalogData,
  LinkLegacyItemsToCatalogData,
  UpdateSchoolItemCatalogData,
} from '@/types';

export const itemCatalogKeys = {
  all: ['school-item-catalog'] as const,
  items: () => [...itemCatalogKeys.all, 'items'] as const,
  item: (id: string) => [...itemCatalogKeys.items(), id] as const,
};

export function useSchoolItemCatalog(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: itemCatalogKeys.items(),
    queryFn: ItemCatalogService.getItems,
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateSchoolItemCatalogEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSchoolItemCatalogData) => ItemCatalogService.createItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemCatalogKeys.items() });
    },
  });
}

export function useCreateAndLinkLegacyItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAndLinkLegacyItemsData) => ItemCatalogService.createAndLinkLegacyItems(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemCatalogKeys.all });
      queryClient.invalidateQueries({ queryKey: ['procurement', 'items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useUpdateSchoolItemCatalogEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSchoolItemCatalogData }) => ItemCatalogService.updateItem(id, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: itemCatalogKeys.items() });
      queryClient.invalidateQueries({ queryKey: itemCatalogKeys.item(variables.id) });
    },
  });
}

export function useLinkLegacyItemsToCatalog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LinkLegacyItemsToCatalogData) => ItemCatalogService.linkLegacyItems(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemCatalogKeys.all });
      queryClient.invalidateQueries({ queryKey: ['procurement', 'items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
