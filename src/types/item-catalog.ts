/**
 * A shared catalogue entry is the future common identity for an item that can
 * appear in Procurement, Inventory, budgets, orders, and goods receipts.
 *
 * Existing records keep their legacy identifiers during migration. New work
 * will progressively store catalogItemId alongside those identifiers until the
 * catalogue is the single source for new item selection.
 */
export interface SchoolItemCatalogEntry {
  id: string;
  /** Stable, deterministic name-and-unit key used to prevent duplicate catalogue entries. */
  catalogKey: string;
  name: string;
  normalizedName: string;
  standardUnit: string;
  customUnit?: string;
  /** Bulk purchasing information. Stock, requests, and releases still use standardUnit. */
  purchaseUnit?: string;
  purchaseCustomUnit?: string;
  unitsPerPurchaseUnit?: number;
  isStockTracked: boolean;
  isActive: boolean;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export type CreateSchoolItemCatalogData = Omit<
  SchoolItemCatalogEntry,
  'id' | 'catalogKey' | 'normalizedName' | 'createdAt' | 'updatedAt'
>;

export type UpdateSchoolItemCatalogData = Partial<Omit<
  SchoolItemCatalogEntry,
  'id' | 'catalogKey' | 'normalizedName' | 'createdAt' | 'createdBy'
>>;

export interface LinkLegacyItemsToCatalogData {
  catalogItemId: string;
  procurementItemIds?: string[];
  inventoryItemIds?: string[];
  linkedBy?: string;
  linkedByUserId?: string;
}

export interface CreateAndLinkLegacyItemsData extends CreateSchoolItemCatalogData {
  procurementItemIds?: string[];
  inventoryItemIds?: string[];
  linkedBy?: string;
  linkedByUserId?: string;
}

/** Input used when a new Procurement record also needs its first catalogue identity. */
export interface CreateNewCatalogProcurementItemData {
  item: import('./index').CreateProcurementItemData;
  createdBy?: string;
  createdByUserId?: string;
}

/** Input used when Procurement adds a record for an item that is already catalogued. */
export interface CreateCatalogLinkedProcurementItemData {
  catalogItemId: string;
  item: import('./index').CreateProcurementItemData;
  linkedBy?: string;
  linkedByUserId?: string;
}

/** Input used when a new Inventory record also needs its first catalogue identity. */
export interface CreateNewCatalogInventoryItemData {
  item: import('./inventory').CreateInventoryItemData;
  createdBy?: string;
  createdByUserId?: string;
}

/** Input used when Inventory adds a record for an item that is already catalogued. */
export interface CreateCatalogLinkedInventoryItemData {
  catalogItemId: string;
  item: import('./inventory').CreateInventoryItemData;
  linkedBy?: string;
  linkedByUserId?: string;
}

export type LegacyItemSource = 'procurement' | 'inventory';

export interface LegacyItemReference {
  source: LegacyItemSource;
  legacyItemId: string;
  name: string;
  unit: string;
  isActive: boolean;
  catalogItemId?: string;
}

export type ItemCatalogMatchStatus =
  | 'linked'
  | 'catalog-link-conflict'
  | 'exact-match'
  | 'unit-conflict'
  | 'unmatched-procurement'
  | 'unmatched-inventory';

export interface ItemCatalogMatchCandidate {
  key: string;
  normalizedName: string;
  procurementItems: LegacyItemReference[];
  inventoryItems: LegacyItemReference[];
  status: ItemCatalogMatchStatus;
  recommendedAction: string;
}

export interface ItemCatalogDuplicate {
  source: LegacyItemSource;
  normalizedName: string;
  itemIds: string[];
  units: string[];
}

export interface ItemCatalogAudit {
  candidates: ItemCatalogMatchCandidate[];
  duplicateProcurementItems: ItemCatalogDuplicate[];
  duplicateInventoryItems: ItemCatalogDuplicate[];
  counts: Record<ItemCatalogMatchStatus, number>;
}
