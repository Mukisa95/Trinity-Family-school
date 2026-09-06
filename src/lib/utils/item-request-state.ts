import type { ItemRequestStatus } from '@/types';

export const ITEM_REQUEST_ACTIVE_STATUSES: ItemRequestStatus[] = [
  'submitted',
  'pending_available',
  'pending_restock',
  'restock_in_progress',
  'ready_to_release',
];

const transitions: Record<ItemRequestStatus, ItemRequestStatus[]> = {
  submitted: ['pending_available', 'pending_restock', 'restock_in_progress', 'ready_to_release', 'released', 'declined', 'cancelled'],
  pending_available: ['ready_to_release', 'released', 'declined', 'cancelled'],
  pending_restock: ['restock_in_progress', 'ready_to_release', 'declined', 'cancelled'],
  restock_in_progress: ['ready_to_release', 'pending_restock', 'declined', 'cancelled'],
  ready_to_release: ['released', 'pending_available', 'declined', 'cancelled'],
  released: [],
  declined: [],
  cancelled: [],
};

export function canTransitionItemRequest(from: ItemRequestStatus, to: ItemRequestStatus): boolean {
  return transitions[from].includes(to);
}

export function isActiveItemRequestStatus(status: ItemRequestStatus): boolean {
  return ITEM_REQUEST_ACTIVE_STATUSES.includes(status);
}

export function defaultRestockPendingReason(itemName: string): string {
  return `${itemName} is currently unavailable. We are arranging restocking and will update you when it becomes available.`;
}
