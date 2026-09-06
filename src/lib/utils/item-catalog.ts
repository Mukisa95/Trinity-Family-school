import type {
  InventoryItem,
  ItemCatalogAudit,
  ItemCatalogDuplicate,
  ItemCatalogMatchCandidate,
  ItemCatalogMatchStatus,
  LegacyItemReference,
  ProcurementItem,
} from '@/types';

/**
 * Deliberately conservative normalization for migration review. It removes
 * casing and accidental spacing differences, but does not guess that plural,
 * abbreviated, or similar-looking names are the same school item.
 */
export const normalizeCatalogName = (value: string): string =>
  value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

/**
 * A deterministic document key lets the service reject a duplicate name and
 * standard unit even when two staff members try to create it at the same time.
 */
export const buildCatalogKey = (name: string, standardUnit: string): string =>
  `catalog-${encodeURIComponent(normalizeCatalogName(name))}--${encodeURIComponent(normalizeCatalogName(standardUnit))}`;

const normalizeUnit = (value: string, customUnit?: string): string =>
  normalizeCatalogName(customUnit?.trim() || value);

const toProcurementReference = (item: ProcurementItem): LegacyItemReference => ({
  source: 'procurement',
  legacyItemId: item.id,
  name: item.name,
  unit: normalizeUnit(item.unit, item.customUnit),
  isActive: item.isActive,
  catalogItemId: item.catalogItemId,
});

const toInventoryReference = (item: InventoryItem): LegacyItemReference => ({
  source: 'inventory',
  legacyItemId: item.id,
  name: item.name,
  unit: normalizeUnit(item.unit, item.customUnit),
  isActive: item.isActive,
  catalogItemId: item.catalogItemId,
});

const getDuplicateGroups = (
  source: LegacyItemReference['source'],
  records: LegacyItemReference[]
): ItemCatalogDuplicate[] => {
  const byName = new Map<string, LegacyItemReference[]>();
  for (const record of records) {
    const normalizedName = normalizeCatalogName(record.name);
    byName.set(normalizedName, [...(byName.get(normalizedName) || []), record]);
  }

  return [...byName.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([normalizedName, group]) => ({
      source,
      normalizedName,
      itemIds: group.map((item) => item.legacyItemId),
      units: [...new Set(group.map((item) => item.unit))].sort(),
    }))
    .sort((left, right) => left.normalizedName.localeCompare(right.normalizedName));
};

const determineStatus = (
  procurementItems: LegacyItemReference[],
  inventoryItems: LegacyItemReference[]
): { status: ItemCatalogMatchStatus; recommendedAction: string } => {
  if (procurementItems.length === 0) {
    return {
      status: 'unmatched-inventory',
      recommendedAction: 'Review this Inventory item and either link it to an existing catalogue item or create one shared catalogue entry.',
    };
  }

  if (inventoryItems.length === 0) {
    return {
      status: 'unmatched-procurement',
      recommendedAction: 'Review this Procurement item and either link it to an existing catalogue item or create one shared catalogue entry.',
    };
  }

  const records = [...procurementItems, ...inventoryItems];
  const linkedIds = new Set(
    records.map((item) => item.catalogItemId).filter((itemId): itemId is string => Boolean(itemId))
  );
  if (linkedIds.size > 1) {
    return {
      status: 'catalog-link-conflict',
      recommendedAction: 'Do not merge automatically. These legacy records point to different catalogue identities and require a staff review.',
    };
  }
  if (linkedIds.size === 1 && records.every((item) => item.catalogItemId)) {
    return {
      status: 'linked',
      recommendedAction: 'The records already share a catalogue link. Review the displayed name and unit before retiring the legacy item lists.',
    };
  }

  const units = new Set([...procurementItems, ...inventoryItems].map((item) => item.unit));
  if (units.size === 1) {
    return {
      status: 'exact-match',
      recommendedAction: 'Safe candidate for one shared catalogue item after staff confirmation.',
    };
  }

  return {
    status: 'unit-conflict',
    recommendedAction: 'Do not merge automatically. Confirm the physical unit or define an approved conversion before linking these records.',
  };
};

/**
 * Audits legacy Procurement and Inventory lists without writing, deleting, or
 * changing records. The output can safely be shown to staff before any
 * catalogue migration is approved.
 */
export const buildItemCatalogAudit = (
  procurementItems: ProcurementItem[],
  inventoryItems: InventoryItem[]
): ItemCatalogAudit => {
  const procurementReferences = procurementItems.map(toProcurementReference);
  const inventoryReferences = inventoryItems.map(toInventoryReference);
  const byNormalizedName = new Map<string, ItemCatalogMatchCandidate>();

  for (const item of [...procurementReferences, ...inventoryReferences]) {
    const normalizedName = normalizeCatalogName(item.name);
    const candidate = byNormalizedName.get(normalizedName) || {
      key: normalizedName,
      normalizedName,
      procurementItems: [],
      inventoryItems: [],
      status: 'exact-match' as ItemCatalogMatchStatus,
      recommendedAction: '',
    };

    if (item.source === 'procurement') candidate.procurementItems.push(item);
    else candidate.inventoryItems.push(item);
    byNormalizedName.set(normalizedName, candidate);
  }

  // A catalogue link is stronger than a legacy display name. Merge name groups
  // only where every linked record points to the same catalogue item; records
  // with conflicting links remain separately visible for manual review.
  const mergedCandidates: ItemCatalogMatchCandidate[] = [];
  const candidatesByCatalogId = new Map<string, ItemCatalogMatchCandidate>();
  for (const candidate of byNormalizedName.values()) {
    const linkedIds = new Set(
      [...candidate.procurementItems, ...candidate.inventoryItems]
        .map((item) => item.catalogItemId)
        .filter((itemId): itemId is string => Boolean(itemId))
    );
    const catalogItemId = linkedIds.size === 1 ? [...linkedIds][0] : undefined;
    const existing = catalogItemId ? candidatesByCatalogId.get(catalogItemId) : undefined;

    if (existing) {
      existing.procurementItems.push(...candidate.procurementItems);
      existing.inventoryItems.push(...candidate.inventoryItems);
      continue;
    }

    if (catalogItemId) candidatesByCatalogId.set(catalogItemId, candidate);
    mergedCandidates.push(candidate);
  }

  const candidates = mergedCandidates
    .map((candidate) => ({
      ...candidate,
      ...determineStatus(candidate.procurementItems, candidate.inventoryItems),
    }))
    .sort((left, right) => left.normalizedName.localeCompare(right.normalizedName));

  const counts: Record<ItemCatalogMatchStatus, number> = {
    linked: 0,
    'catalog-link-conflict': 0,
    'exact-match': 0,
    'unit-conflict': 0,
    'unmatched-procurement': 0,
    'unmatched-inventory': 0,
  };
  for (const candidate of candidates) counts[candidate.status] += 1;

  return {
    candidates,
    duplicateProcurementItems: getDuplicateGroups('procurement', procurementReferences),
    duplicateInventoryItems: getDuplicateGroups('inventory', inventoryReferences),
    counts,
  };
};
