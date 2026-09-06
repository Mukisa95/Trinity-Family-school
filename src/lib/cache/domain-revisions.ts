export const DOMAIN_REVISION_KEYS = [
  'schoolItemCatalog',
  'procurementItems',
  'procurementPurchases',
  'procurementBudgets',
  'procurementRestocks',
  'inventoryItems',
  'inventoryTransactions',
  'issuedItems',
  'itemRequests',
] as const;

export type DomainRevisionKey = (typeof DOMAIN_REVISION_KEYS)[number];

export type DomainRevisionMap = Partial<Record<DomainRevisionKey, number>>;

export function domainRevisionToken(
  revisions: DomainRevisionMap | undefined,
  keys: readonly DomainRevisionKey[],
): string {
  return keys.map(key => `${key}:${Number(revisions?.[key] || 0)}`).join('|');
}
