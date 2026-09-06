import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  Transaction,
  writeBatch,
} from 'firebase/firestore';
import { buildCatalogKey, normalizeCatalogName } from '@/lib/utils/item-catalog';
import { bumpDomainRevisionsInWrite } from '@/lib/services/dashboard-cache-revisions.service';
import type { DomainRevisionKey } from '@/lib/cache/domain-revisions';
import type {
  CreateCatalogLinkedInventoryItemData,
  CreateCatalogLinkedProcurementItemData,
  CreateAndLinkLegacyItemsData,
  CreateNewCatalogInventoryItemData,
  CreateNewCatalogProcurementItemData,
  CreateSchoolItemCatalogData,
  LinkLegacyItemsToCatalogData,
  SchoolItemCatalogEntry,
  UpdateSchoolItemCatalogData,
} from '@/types';

const SCHOOL_ITEM_CATALOG_COLLECTION = 'schoolItemCatalog';
const PROCUREMENT_ITEMS_COLLECTION = 'procurementItems';
const INVENTORY_ITEMS_COLLECTION = 'inventoryItems';

const toIsoString = (value: unknown): string =>
  value instanceof Timestamp ? value.toDate().toISOString() : new Date().toISOString();

const toCatalogEntry = (id: string, data: Record<string, unknown>): SchoolItemCatalogEntry => ({
  id,
  ...(data as Omit<SchoolItemCatalogEntry, 'id' | 'createdAt' | 'updatedAt'>),
  createdAt: toIsoString(data.createdAt),
  updatedAt: data.updatedAt ? toIsoString(data.updatedAt) : undefined,
});

const resolveItemUnit = (unit: string, customUnit?: string) => customUnit?.trim() || unit;

const assertMatchesCatalog = (
  itemName: string,
  itemUnit: string,
  catalog: Pick<SchoolItemCatalogEntry, 'name' | 'standardUnit'>
) => {
  if (
    normalizeCatalogName(itemName) !== normalizeCatalogName(catalog.name) ||
    normalizeCatalogName(itemUnit) !== normalizeCatalogName(catalog.standardUnit)
  ) {
    throw new Error('The selected shared catalogue item has a different name or unit. Re-select the item before saving.');
  }
};

/**
 * The shared catalogue is intentionally independent from the legacy
 * Procurement and Inventory lists. Legacy records are linked only through the
 * explicit linkLegacyItems operation after staff have reviewed the audit.
 */
export class ItemCatalogService {
  private static writeNewCatalog(
    transaction: Transaction,
    catalogRef: ReturnType<typeof doc>,
    data: Pick<CreateSchoolItemCatalogData, 'name' | 'standardUnit' | 'customUnit' | 'isStockTracked' | 'isActive' | 'createdBy'>
  ) {
    transaction.set(catalogRef, {
      ...data,
      catalogKey: catalogRef.id,
      normalizedName: normalizeCatalogName(data.name),
      isActive: data.isActive ?? true,
      createdAt: serverTimestamp(),
    });
  }

  private static getLegacyTargets(procurementItemIds: string[] = [], inventoryItemIds: string[] = []) {
    return [
      ...[...new Set(procurementItemIds)].map((id) => doc(db, PROCUREMENT_ITEMS_COLLECTION, id)),
      ...[...new Set(inventoryItemIds)].map((id) => doc(db, INVENTORY_ITEMS_COLLECTION, id)),
    ];
  }

  private static async assertLegacyTargetsExist(
    transaction: Transaction,
    legacyTargets: ReturnType<typeof ItemCatalogService.getLegacyTargets>
  ) {
    const snapshots = await Promise.all(legacyTargets.map((target) => transaction.get(target)));
    if (snapshots.some((snapshot) => !snapshot.exists())) {
      throw new Error('One of the selected legacy items no longer exists. Refresh the audit before linking.');
    }
  }

  private static writeLegacyLinks(
    transaction: Transaction,
    legacyTargets: ReturnType<typeof ItemCatalogService.getLegacyTargets>,
    catalogItemId: string,
    linkedBy?: string,
    linkedByUserId?: string
  ) {
    for (const legacyRef of legacyTargets) {
      transaction.update(legacyRef, {
        catalogItemId,
        catalogLinkedAt: serverTimestamp(),
        catalogLinkedBy: linkedBy,
        catalogLinkedByUserId: linkedByUserId,
      });
    }
  }

  static async getItems(): Promise<SchoolItemCatalogEntry[]> {
    const catalogRef = collection(db, SCHOOL_ITEM_CATALOG_COLLECTION);
    const snapshot = await getDocs(query(catalogRef, orderBy('name')));
    return snapshot.docs.map((entry) => toCatalogEntry(entry.id, entry.data()));
  }

  static async getItemById(id: string): Promise<SchoolItemCatalogEntry | null> {
    const snapshot = await getDoc(doc(db, SCHOOL_ITEM_CATALOG_COLLECTION, id));
    return snapshot.exists() ? toCatalogEntry(snapshot.id, snapshot.data()) : null;
  }

  static async createItem(data: CreateSchoolItemCatalogData): Promise<string> {
    const normalizedName = normalizeCatalogName(data.name);
    const standardUnit = data.customUnit?.trim() || data.standardUnit;
    const catalogKey = buildCatalogKey(normalizedName, standardUnit);
    const catalogRef = doc(db, SCHOOL_ITEM_CATALOG_COLLECTION, catalogKey);

    return runTransaction(db, async (transaction) => {
      const existing = await transaction.get(catalogRef);
      if (existing.exists()) {
        throw new Error('A shared catalogue item with this name and standard unit already exists. Open that item instead of creating a duplicate.');
      }

      this.writeNewCatalog(transaction, catalogRef, { ...data, standardUnit });
      bumpDomainRevisionsInWrite(transaction, ['schoolItemCatalog']);
      return catalogRef.id;
    });
  }

  /** Creates a catalogue identity and its first Procurement record together. */
  static async createNewProcurementItem(data: CreateNewCatalogProcurementItemData) {
    const standardUnit = resolveItemUnit(data.item.unit, data.item.customUnit);
    const catalogRef = doc(db, SCHOOL_ITEM_CATALOG_COLLECTION, buildCatalogKey(normalizeCatalogName(data.item.name), standardUnit));
    const procurementRef = doc(collection(db, PROCUREMENT_ITEMS_COLLECTION));

    return runTransaction(db, async (transaction) => {
      if ((await transaction.get(catalogRef)).exists()) {
        throw new Error('This shared catalogue item already exists. Select it before adding the Procurement item.');
      }

      this.writeNewCatalog(transaction, catalogRef, {
        name: data.item.name,
        standardUnit,
        customUnit: data.item.customUnit,
        isStockTracked: data.item.stockTracking ?? false,
        isActive: data.item.isActive,
        createdBy: data.createdBy,
      });
      transaction.set(procurementRef, {
        ...data.item,
        catalogItemId: catalogRef.id,
        isActive: data.item.isActive ?? true,
        totalQuantityPurchased: 0,
        totalAmountSpent: 0,
        catalogLinkedAt: serverTimestamp(),
        catalogLinkedBy: data.createdBy,
        catalogLinkedByUserId: data.createdByUserId,
        createdAt: serverTimestamp(),
      });
      bumpDomainRevisionsInWrite(transaction, ['schoolItemCatalog', 'procurementItems']);
      return { procurementItemId: procurementRef.id, catalogItemId: catalogRef.id };
    });
  }

  /** Creates a Procurement record that reuses an existing, matching catalogue identity. */
  static async createCatalogLinkedProcurementItem(data: CreateCatalogLinkedProcurementItemData) {
    const catalogRef = doc(db, SCHOOL_ITEM_CATALOG_COLLECTION, data.catalogItemId);
    const procurementRef = doc(collection(db, PROCUREMENT_ITEMS_COLLECTION));

    return runTransaction(db, async (transaction) => {
      const catalogSnapshot = await transaction.get(catalogRef);
      if (!catalogSnapshot.exists()) throw new Error('The selected shared catalogue item no longer exists. Refresh and try again.');
      const catalog = toCatalogEntry(catalogSnapshot.id, catalogSnapshot.data());
      assertMatchesCatalog(data.item.name, resolveItemUnit(data.item.unit, data.item.customUnit), catalog);

      transaction.set(procurementRef, {
        ...data.item,
        catalogItemId: catalogRef.id,
        isActive: data.item.isActive ?? true,
        totalQuantityPurchased: 0,
        totalAmountSpent: 0,
        catalogLinkedAt: serverTimestamp(),
        catalogLinkedBy: data.linkedBy,
        catalogLinkedByUserId: data.linkedByUserId,
        createdAt: serverTimestamp(),
      });
      bumpDomainRevisionsInWrite(transaction, ['procurementItems']);
      return { procurementItemId: procurementRef.id, catalogItemId: catalogRef.id };
    });
  }

  /** Creates a catalogue identity and its first Inventory record together. */
  static async createNewInventoryItem(data: CreateNewCatalogInventoryItemData) {
    const standardUnit = resolveItemUnit(data.item.unit, data.item.customUnit);
    const catalogRef = doc(db, SCHOOL_ITEM_CATALOG_COLLECTION, buildCatalogKey(normalizeCatalogName(data.item.name), standardUnit));
    const inventoryRef = doc(collection(db, INVENTORY_ITEMS_COLLECTION));

    return runTransaction(db, async (transaction) => {
      if ((await transaction.get(catalogRef)).exists()) {
        throw new Error('This shared catalogue item already exists. Select it before adding the Inventory item.');
      }

      this.writeNewCatalog(transaction, catalogRef, {
        name: data.item.name,
        standardUnit,
        customUnit: data.item.customUnit,
        isStockTracked: true,
        isActive: data.item.isActive,
        createdBy: data.createdBy,
      });
      transaction.set(inventoryRef, {
        ...data.item,
        catalogItemId: catalogRef.id,
        totalValue: data.item.unitValue ? data.item.quantity * data.item.unitValue : 0,
        totalIssued: 0,
        totalReturned: 0,
        currentlyIssued: 0,
        isActive: data.item.isActive ?? true,
        catalogLinkedAt: serverTimestamp(),
        catalogLinkedBy: data.createdBy,
        catalogLinkedByUserId: data.createdByUserId,
        createdAt: serverTimestamp(),
      });
      bumpDomainRevisionsInWrite(transaction, ['schoolItemCatalog', 'inventoryItems']);
      return { inventoryItemId: inventoryRef.id, catalogItemId: catalogRef.id };
    });
  }

  /** Creates an Inventory record that reuses an existing, matching catalogue identity. */
  static async createCatalogLinkedInventoryItem(data: CreateCatalogLinkedInventoryItemData) {
    const catalogRef = doc(db, SCHOOL_ITEM_CATALOG_COLLECTION, data.catalogItemId);
    const inventoryRef = doc(collection(db, INVENTORY_ITEMS_COLLECTION));

    return runTransaction(db, async (transaction) => {
      const catalogSnapshot = await transaction.get(catalogRef);
      if (!catalogSnapshot.exists()) throw new Error('The selected shared catalogue item no longer exists. Refresh and try again.');
      const catalog = toCatalogEntry(catalogSnapshot.id, catalogSnapshot.data());
      assertMatchesCatalog(data.item.name, resolveItemUnit(data.item.unit, data.item.customUnit), catalog);

      transaction.set(inventoryRef, {
        ...data.item,
        catalogItemId: catalogRef.id,
        totalValue: data.item.unitValue ? data.item.quantity * data.item.unitValue : 0,
        totalIssued: 0,
        totalReturned: 0,
        currentlyIssued: 0,
        isActive: data.item.isActive ?? true,
        catalogLinkedAt: serverTimestamp(),
        catalogLinkedBy: data.linkedBy,
        catalogLinkedByUserId: data.linkedByUserId,
        createdAt: serverTimestamp(),
      });
      bumpDomainRevisionsInWrite(transaction, ['inventoryItems']);
      return { inventoryItemId: inventoryRef.id, catalogItemId: catalogRef.id };
    });
  }

  static async updateItem(id: string, data: UpdateSchoolItemCatalogData): Promise<void> {
    if (data.name !== undefined || data.standardUnit !== undefined || data.customUnit !== undefined) {
      throw new Error('A catalogue item name or standard unit cannot be changed in place. Create a reviewed replacement or use a controlled mapping correction.');
    }

    const batch = writeBatch(db);
    batch.update(doc(db, SCHOOL_ITEM_CATALOG_COLLECTION, id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    bumpDomainRevisionsInWrite(batch, ['schoolItemCatalog']);
    await batch.commit();
  }

  /** Creates one catalogue entry and links reviewed legacy records in one transaction. */
  static async createAndLinkLegacyItems(data: CreateAndLinkLegacyItemsData): Promise<string> {
    const procurementItemIds = [...new Set(data.procurementItemIds || [])];
    const inventoryItemIds = [...new Set(data.inventoryItemIds || [])];
    if (procurementItemIds.length + inventoryItemIds.length === 0) {
      throw new Error('Choose at least one Procurement or Inventory item to link.');
    }

    const normalizedName = normalizeCatalogName(data.name);
    const standardUnit = data.customUnit?.trim() || data.standardUnit;
    const catalogKey = buildCatalogKey(normalizedName, standardUnit);
    const catalogRef = doc(db, SCHOOL_ITEM_CATALOG_COLLECTION, catalogKey);
    const legacyTargets = this.getLegacyTargets(procurementItemIds, inventoryItemIds);

    return runTransaction(db, async (transaction) => {
      const catalogSnapshot = await transaction.get(catalogRef);
      if (catalogSnapshot.exists()) {
        throw new Error('A shared catalogue item with this name and standard unit already exists. Select it from the list instead of creating a duplicate.');
      }
      await this.assertLegacyTargetsExist(transaction, legacyTargets);

      transaction.set(catalogRef, {
        name: data.name,
        standardUnit,
        customUnit: data.customUnit,
        isStockTracked: data.isStockTracked,
        isActive: data.isActive ?? true,
        createdBy: data.createdBy,
        catalogKey,
        normalizedName,
        createdAt: serverTimestamp(),
      });
      this.writeLegacyLinks(transaction, legacyTargets, catalogRef.id, data.linkedBy, data.linkedByUserId);
      const revisionKeys: DomainRevisionKey[] = ['schoolItemCatalog'];
      if (procurementItemIds.length) revisionKeys.push('procurementItems');
      if (inventoryItemIds.length) revisionKeys.push('inventoryItems');
      bumpDomainRevisionsInWrite(transaction, revisionKeys);
      return catalogRef.id;
    });
  }

  /**
   * Links reviewed legacy item records to one catalogue entry atomically. No
   * new catalogue entry is inferred here, and no legacy item is deleted.
   */
  static async linkLegacyItems(data: LinkLegacyItemsToCatalogData): Promise<void> {
    const procurementItemIds = [...new Set(data.procurementItemIds || [])];
    const inventoryItemIds = [...new Set(data.inventoryItemIds || [])];
    if (procurementItemIds.length + inventoryItemIds.length === 0) {
      throw new Error('Choose at least one Procurement or Inventory item to link.');
    }

    const catalogRef = doc(db, SCHOOL_ITEM_CATALOG_COLLECTION, data.catalogItemId);
    const legacyTargets = this.getLegacyTargets(procurementItemIds, inventoryItemIds);

    await runTransaction(db, async (transaction) => {
      const catalogSnapshot = await transaction.get(catalogRef);

      if (!catalogSnapshot.exists()) throw new Error('The shared catalogue item no longer exists. Refresh the audit and try again.');
      await this.assertLegacyTargetsExist(transaction, legacyTargets);
      this.writeLegacyLinks(transaction, legacyTargets, data.catalogItemId, data.linkedBy, data.linkedByUserId);
      const revisionKeys: DomainRevisionKey[] = [];
      if (procurementItemIds.length) revisionKeys.push('procurementItems');
      if (inventoryItemIds.length) revisionKeys.push('inventoryItems');
      bumpDomainRevisionsInWrite(transaction, revisionKeys);
    });
  }
}
