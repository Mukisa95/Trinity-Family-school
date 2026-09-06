/**
 * A staff request is intentionally separate from an Inventory movement.
 * A request only changes stock after an authorised releaser completes the
 * release action through the protected server workflow.
 */
export type ItemRequestStatus =
  | 'submitted'
  | 'pending_available'
  | 'pending_restock'
  | 'restock_in_progress'
  | 'ready_to_release'
  | 'released'
  | 'declined'
  | 'cancelled';

export type ItemRequestSource = 'catalog' | 'other';

export interface ItemRequest {
  id: string;
  requesterUserId: string;
  requesterStaffId?: string;
  requesterName: string;
  requesterDepartment?: string;
  source: ItemRequestSource;
  catalogItemId?: string;
  itemName: string;
  unit: string;
  quantity: number;
  reason: string;
  neededBy?: string;
  useLocation?: string;
  expectedReturnDate?: string;
  status: ItemRequestStatus;
  statusReason?: string;
  inventoryItemId?: string;
  restockRequestId?: string;
  /** The completed Procurement record that is funding this restock. */
  procurementPurchaseId?: string;
  inventoryTransactionId?: string;
  issuedItemId?: string;
  /** Queue-only availability projection. Requesters never receive this value. */
  availableQuantity?: number;
  /** Queue-only: a single Inventory record can satisfy the full request now. */
  canRelease?: boolean;
  createdAt: string;
  updatedAt?: string;
  lastActionAt?: string;
}

export type ItemRequestEventAction =
  | 'submitted'
  | 'pending'
  | 'restock_started'
  | 'purchase_recorded'
  | 'ready_to_release'
  | 'released'
  | 'declined'
  | 'cancelled';

export interface ItemRequestEvent {
  id: string;
  requestId: string;
  action: ItemRequestEventAction;
  fromStatus?: ItemRequestStatus;
  toStatus: ItemRequestStatus;
  actorUserId: string;
  actorName: string;
  reason?: string;
  operationId?: string;
  createdAt: string;
}

/** A restock instruction is not a completed purchase. It becomes linked to an
 * actual Procurement purchase only when price, supplier and receipt details
 * are available. */
export interface ProcurementRestockRequest {
  id: string;
  itemRequestId: string;
  catalogItemId: string;
  procurementItemId: string;
  itemName: string;
  unit: string;
  requestedQuantity: number;
  /**
   * `submitted` means Procurement still needs to buy the goods. `purchased`
   * means a real purchase record exists, but Inventory has not received it.
   */
  status: 'submitted' | 'purchased' | 'received' | 'cancelled';
  requestedByUserId: string;
  requestedByName: string;
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
  updatedAt?: string;
  procurementPurchaseId?: string;
  /** A browser-created purchase awaiting protected server-side confirmation. */
  unlinkedPurchaseId?: string;
  receivedInventoryTransactionId?: string;
}

export interface CreateItemRequestData {
  source: ItemRequestSource;
  catalogItemId?: string;
  otherItemName?: string;
  otherItemUnit?: string;
  quantity: number;
  reason: string;
  neededBy?: string;
  useLocation?: string;
  expectedReturnDate?: string;
  operationId: string;
}
