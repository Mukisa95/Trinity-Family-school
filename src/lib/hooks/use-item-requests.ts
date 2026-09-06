import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateItemRequestData } from '@/types';
import { ItemRequestsService, type ItemRequestDecision } from '@/lib/services/item-requests.service';

export const itemRequestKeys = {
  all: ['item-requests'] as const,
  mine: () => [...itemRequestKeys.all, 'mine'] as const,
  queue: () => [...itemRequestKeys.all, 'queue'] as const,
};

export function useMyItemRequests(enabled = true) {
  return useQuery({
    queryKey: itemRequestKeys.mine(),
    queryFn: () => ItemRequestsService.getMine().then(result => result.requests),
    enabled,
    staleTime: 30_000,
  });
}

export function useItemReleaseQueue(enabled = true) {
  return useQuery({
    queryKey: itemRequestKeys.queue(),
    queryFn: () => ItemRequestsService.getReleaseQueue().then(result => result.requests),
    enabled,
    staleTime: 15_000,
  });
}

export function useCreateItemRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateItemRequestData) => ItemRequestsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemRequestKeys.mine() });
      queryClient.invalidateQueries({ queryKey: itemRequestKeys.queue() });
    },
  });
}

export function useItemRequestDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: ItemRequestDecision }) => ItemRequestsService.decide(id, decision),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemRequestKeys.all });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useStartItemRequestRestock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, operationId }: { id: string; operationId: string }) => ItemRequestsService.startRestock(id, operationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: itemRequestKeys.all });
      queryClient.invalidateQueries({ queryKey: ['school-item-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['procurement', 'items'] });
    },
  });
}
