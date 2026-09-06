import { auth } from '@/lib/firebase';
import type { ProcurementRestockRequest } from '@/types';

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
  if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Unable to complete the Procurement restock action.');
  return result as T;
}

export class ProcurementRestockService {
  static getQueue() {
    return requestApi<{ requests: ProcurementRestockRequest[] }>('/api/item-requests/restock-queue');
  }

  static linkPurchase(restockRequestId: string, purchaseId: string) {
    return requestApi<{ success: boolean; duplicate: boolean }>(
      `/api/item-requests/restock-queue/${encodeURIComponent(restockRequestId)}/purchase`,
      { method: 'POST', body: JSON.stringify({ purchaseId }) },
    );
  }
}
