export interface PurchaseUnitConfiguration {
  stockUnit: string;
  purchaseUnit?: string;
  purchaseCustomUnit?: string;
  unitsPerPurchaseUnit?: number;
}

/** Normalises legacy items so an absent pack configuration means one-for-one. */
export function normalizePurchaseUnitConfiguration(configuration: PurchaseUnitConfiguration) {
  const stockUnit = configuration.stockUnit.trim();
  const purchaseUnit = configuration.purchaseCustomUnit?.trim()
    || configuration.purchaseUnit?.trim()
    || stockUnit;
  const parsedUnits = Number(configuration.unitsPerPurchaseUnit);
  const unitsPerPurchaseUnit = Number.isFinite(parsedUnits) && parsedUnits > 0
    ? parsedUnits
    : 1;

  return { stockUnit, purchaseUnit, unitsPerPurchaseUnit };
}

export function calculateStockQuantityFromPurchase(
  purchaseQuantity: number,
  unitsPerPurchaseUnit?: number,
) {
  const packs = Number(purchaseQuantity);
  const unitCount = normalizePurchaseUnitConfiguration({ stockUnit: 'unit', unitsPerPurchaseUnit }).unitsPerPurchaseUnit;
  return Number.isFinite(packs) && packs > 0 ? packs * unitCount : 0;
}

export function calculatePurchasePacksNeeded(requiredStockQuantity: number, unitsPerPurchaseUnit?: number) {
  const required = Number(requiredStockQuantity);
  const unitCount = normalizePurchaseUnitConfiguration({ stockUnit: 'unit', unitsPerPurchaseUnit }).unitsPerPurchaseUnit;
  return Number.isFinite(required) && required > 0 ? Math.ceil(required / unitCount) : 0;
}
