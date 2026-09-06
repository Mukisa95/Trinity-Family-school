import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateItemRequestData } from '@/types';
import { ItemRequestsService, type ItemRequestDecision } from '@/lib/services/item-requests.service';
import { useRevisionedDomainQuery } from '@/lib/hooks/use-revisioned-domain-query';

export const itemRequestKeys = {
  all: ['item-requests'] as const,
  mine: () => [...itemRequestKeys.all, 'mine'] as const,
  queue: () => [...itemRequestKeys.all, 'queue'] as const,
};

export function useMyItemRequests(enabled = true) {
  return useRevisionedDomainQuery({
    queryKey: itemRequestKeys.mine(),
    cacheName: 'item-requests-mine',
    revisionKeys: ['itemRequests'],
    queryFn: () => ItemRequestsService.getMine().then(result => result.requests),
    enabled,
  });
}

export function useItemReleaseQueue(enabled = true) {
  return useRevisionedDomainQuery({
    queryKey: itemRequestKeys.queue(),
    cacheName: 'item-requests-release-queue',
    revisionKeys: ['itemRequests', 'inventoryItems'],
    queryFn: () => ItemRequestsService.getReleaseQueue().then(result => result.requests),
    enabled,
  });
}

export function useCreateItemRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateItemRequestData) => ItemRequestsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemRequestKeys.mine(), refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: itemRequestKeys.queue(), refetchType: 'none' });
    },
  });
}

export function useItemRequestDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: ItemRequestDecision }) => ItemRequestsService.decide(id, decision),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemRequestKeys.all, refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['inventory'], refetchType: 'none' });
    },
  });
}

export function useStartItemRequestRestock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, operationId }: { id: string; operationId: string }) => ItemRequestsService.startRestock(id, operationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemRequestKeys.all, refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['school-item-catalog'], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['procurement', 'items'], refetchType: 'none' });
    },
  });
}
