import type { InventoryTransactionType, IssuedItem } from '@/types';

export const calculateInventoryQuantity = (
  previousQuantity: number,
  type: InventoryTransactionType,
  quantity: number
): number => {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Quantity must be greater than zero.');
  }

  switch (type) {
    case 'purchase':
    case 'return':
    case 'adjustment':
      return previousQuantity + quantity;
    case 'issue':
    case 'dispose':
    case 'damage':
    case 'loss': {
      const nextQuantity = previousQuantity - quantity;
      if (nextQuantity < 0) {
        throw new Error(`Insufficient stock. Available: ${previousQuantity}`);
      }
      return nextQuantity;
    }
    case 'stocktake':
      return quantity;
    case 'transfer':
    case 'repair':
      return previousQuantity;
  }
};

export const calculateReturnState = (issuedItem: IssuedItem, returnedQuantity: number) => {
  if (!Number.isFinite(returnedQuantity) || returnedQuantity <= 0) {
    throw new Error('Returned quantity must be greater than zero.');
  }

  const alreadyReturned = issuedItem.returnedQuantity || 0;
  const outstandingQuantity = issuedItem.quantity - alreadyReturned;
  if (outstandingQuantity <= 0 || issuedItem.status === 'returned') {
    throw new Error('This issue record has already been fully returned.');
  }
  if (returnedQuantity > outstandingQuantity) {
    throw new Error(`Only ${outstandingQuantity} item(s) remain outstanding.`);
  }

  const totalReturned = alreadyReturned + returnedQuantity;
  return {
    outstandingQuantity,
    totalReturned,
    isFullyReturned: totalReturned === issuedItem.quantity,
    status: totalReturned === issuedItem.quantity ? 'returned' as const : 'partial' as const,
  };
};
