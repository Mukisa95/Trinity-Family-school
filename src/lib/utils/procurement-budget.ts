import type { BudgetItem, ProcurementItem } from '@/types';

export interface BudgetLineInput {
  id: string;
  item: ProcurementItem;
  quantity: number;
  estimatedUnitPrice?: number;
  notes?: string;
  priority?: BudgetItem['priority'];
}

export function buildBudgetLine(input: BudgetLineInput): BudgetItem {
  const quantity = Number.isFinite(input.quantity) ? Math.max(0, input.quantity) : 0;
  const hasEstimatedCost = typeof input.estimatedUnitPrice === 'number'
    && Number.isFinite(input.estimatedUnitPrice)
    && input.estimatedUnitPrice > 0;
  const unitPrice = hasEstimatedCost ? input.estimatedUnitPrice! : undefined;
  return {
    id: input.id,
    itemId: input.item.id,
    ...(input.item.catalogItemId ? { catalogItemId: input.item.catalogItemId } : {}),
    itemName: input.item.name,
    itemCategory: input.item.category,
    itemUnit: input.item.customUnit || input.item.unit,
    estimatedQuantity: quantity,
    ...(unitPrice === undefined ? {} : { estimatedUnitPrice: unitPrice }),
    estimatedTotalCost: unitPrice === undefined ? 0 : quantity * unitPrice,
    costEstimated: unitPrice !== undefined,
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    ...(input.priority ? { priority: input.priority } : {}),
  };
}

export function calculateBudgetTotal(items: BudgetItem[]): number {
  return items.reduce((total, item) => total + (Number.isFinite(item.estimatedTotalCost) ? item.estimatedTotalCost : 0), 0);
}

export function normalizeBudgetLines(items: BudgetItem[] = []): BudgetItem[] {
  return items.map(item => {
    const { estimatedUnitPrice: rawUnitPrice, ...rest } = item;
    const quantity = Number.isFinite(item.estimatedQuantity) ? Math.max(0, item.estimatedQuantity) : 0;
    const hasEstimatedCost = item.costEstimated === true
      || (typeof rawUnitPrice === 'number' && Number.isFinite(rawUnitPrice) && rawUnitPrice > 0);
    const unitPrice = hasEstimatedCost ? Math.max(0, Number(rawUnitPrice || 0)) : undefined;
    return {
      ...rest,
      estimatedQuantity: quantity,
      ...(unitPrice === undefined ? {} : { estimatedUnitPrice: unitPrice }),
      estimatedTotalCost: unitPrice === undefined ? 0 : quantity * unitPrice,
      costEstimated: unitPrice !== undefined,
    };
  });
}

export function replaceBudgetLine(items: BudgetItem[], replacement: BudgetItem): BudgetItem[] {
  const index = items.findIndex(item => item.id === replacement.id);
  if (index < 0) return [...items, replacement];
  return items.map(item => item.id === replacement.id ? replacement : item);
}
