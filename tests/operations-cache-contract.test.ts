import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { domainRevisionToken } from '@/lib/cache/domain-revisions';

const inventoryHooks = readFileSync('src/lib/hooks/use-inventory.ts', 'utf8');
const procurementHooks = readFileSync('src/lib/hooks/use-procurement.ts', 'utf8');
const requestHooks = readFileSync('src/lib/hooks/use-item-requests.ts', 'utf8');
const restockHooks = readFileSync('src/lib/hooks/use-procurement-restock.ts', 'utf8');
const procurementPage = readFileSync('src/app/procurement/page.tsx', 'utf8');

test('domain revision tokens change only when a watched collection changes', () => {
  const before = domainRevisionToken({ inventoryItems: 4, itemRequests: 7, procurementBudgets: 100 }, ['inventoryItems', 'itemRequests']);
  const unrelated = domainRevisionToken({ inventoryItems: 4, itemRequests: 7, procurementBudgets: 101 }, ['inventoryItems', 'itemRequests']);
  const updated = domainRevisionToken({ inventoryItems: 5, itemRequests: 7, procurementBudgets: 101 }, ['inventoryItems', 'itemRequests']);
  assert.equal(before, unrelated);
  assert.notEqual(before, updated);
});

test('operational pages use revision-owned collection queries', () => {
  assert.match(inventoryHooks, /useRevisionedDomainQuery/);
  assert.match(procurementHooks, /useRevisionedDomainQuery/);
  assert.match(requestHooks, /useRevisionedDomainQuery/);
  assert.match(restockHooks, /useRevisionedDomainQuery/);
  assert.doesNotMatch(procurementPage, /ProcurementService\.get(?:Items|Purchases|Budgets)\(/);
  assert.doesNotMatch(requestHooks, /staleTime:\s*(?:15|30)_000/);
});

test('inventory derives page views from three canonical collection owners', () => {
  assert.equal((inventoryHooks.match(/queryFn:\s*\(\) => InventoryService\.getItems\(\)/g) || []).length, 1);
  assert.equal((inventoryHooks.match(/queryFn:\s*\(\) => InventoryService\.getTransactions\(\)/g) || []).length, 1);
  assert.equal((inventoryHooks.match(/queryFn:\s*\(\) => InventoryService\.getIssuedItems\(\)/g) || []).length, 1);
  assert.doesNotMatch(inventoryHooks, /queryFn:\s*\(\) => InventoryService\.getInventorySummary\(/);
});

test('source mutations publish cache revisions atomically', () => {
  for (const path of [
    'src/lib/services/inventory.service.ts',
    'src/lib/services/procurement.service.ts',
    'src/lib/services/item-catalog.service.ts',
    'src/app/api/item-requests/route.ts',
    'src/app/api/item-requests/[id]/decision/route.ts',
    'src/app/api/item-requests/[id]/restock/route.ts',
    'src/app/api/item-requests/restock-received/route.ts',
    'src/app/api/item-requests/restock-queue/[id]/purchase/route.ts',
  ]) {
    const source = readFileSync(path, 'utf8');
    assert.match(source, /bumpDomainRevisions(?:InWrite|Admin)\(/, `${path} must publish a domain revision`);
  }
});
