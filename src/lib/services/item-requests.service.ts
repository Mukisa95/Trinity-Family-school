import { auth } from '@/lib/firebase';
import type { CreateItemRequestData, ItemRequest } from '@/types';

async function requestApi<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Your session is not ready. Please sign in again.');
  const response = await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Unable to complete the item request action.');
  return result as T;
}

export type ItemRequestDecision = {
  action: 'release' | 'pending' | 'decline';
  pendingMode?: 'available' | 'restock';
  reason?: string;
  operationId: string;
};

export class ItemRequestsService {
  static getMine() {
    return requestApi<{ requests: ItemRequest[] }>('/api/item-requests?scope=mine');
  }

  static getReleaseQueue() {
    return requestApi<{ requests: ItemRequest[] }>('/api/item-requests?scope=queue');
  }

  static create(data: CreateItemRequestData) {
    return requestApi<{ success: boolean; id: string; duplicate: boolean }>('/api/item-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static decide(id: string, decision: ItemRequestDecision) {
    return requestApi<{ success: boolean; status: ItemRequest['status']; duplicate: boolean }>(
      `/api/item-requests/${encodeURIComponent(id)}/decision`,
      { method: 'POST', body: JSON.stringify(decision) },
    );
  }

  static startRestock(id: string, operationId: string) {
    return requestApi<{ success: boolean; restockRequestId: string; duplicate: boolean; createdCatalogItem: boolean }>(
      `/api/item-requests/${encodeURIComponent(id)}/restock`,
      { method: 'POST', body: JSON.stringify({ operationId }) },
    );
  }
}
