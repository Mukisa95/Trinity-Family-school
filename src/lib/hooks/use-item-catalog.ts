import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ItemCatalogService } from '@/lib/services/item-catalog.service';
import { useRevisionedDomainQuery } from '@/lib/hooks/use-revisioned-domain-query';
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
  return useRevisionedDomainQuery({
    queryKey: itemCatalogKeys.items(),
    cacheName: 'school-item-catalog',
    revisionKeys: ['schoolItemCatalog'],
    queryFn: ItemCatalogService.getItems,
    enabled: options?.enabled ?? true,
  });
}

export function useCreateSchoolItemCatalogEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSchoolItemCatalogData) => ItemCatalogService.createItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemCatalogKeys.items(), refetchType: 'none' });
    },
  });
}

export function useCreateAndLinkLegacyItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAndLinkLegacyItemsData) => ItemCatalogService.createAndLinkLegacyItems(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemCatalogKeys.all, refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['procurement', 'items'], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['inventory'], refetchType: 'none' });
    },
  });
}

export function useUpdateSchoolItemCatalogEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSchoolItemCatalogData }) => ItemCatalogService.updateItem(id, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: itemCatalogKeys.items(), refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: itemCatalogKeys.item(variables.id), refetchType: 'none' });
    },
  });
}

export function useLinkLegacyItemsToCatalog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LinkLegacyItemsToCatalogData) => ItemCatalogService.linkLegacyItems(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemCatalogKeys.all, refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['procurement', 'items'], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['inventory'], refetchType: 'none' });
    },
  });
}
