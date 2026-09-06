import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalogKey, buildItemCatalogAudit, normalizeCatalogName } from '../src/lib/utils/item-catalog';
import type { InventoryItem, ProcurementItem } from '../src/types';

const procurementItem = (overrides: Partial<ProcurementItem> = {}): ProcurementItem => ({
  id: 'proc-paper',
  name: 'Printer Paper',
  category: 'Office Utility',
  unit: 'Boxes',
  useCase: 'Office printing',
  isActive: true,
  createdAt: '2026-09-06T00:00:00.000Z',
  ...overrides,
});

const inventoryItem = (overrides: Partial<InventoryItem> = {}): InventoryItem => ({
  id: 'inv-paper',
  name: 'Printer Paper',
  category: 'Office',
  quantity: 10,
  unit: 'Boxes',
  condition: 'New',
  isActive: true,
  location: 'Main Store',
  createdAt: '2026-09-06T00:00:00.000Z',
  ...overrides,
});

test('normalization removes casing and accidental spacing but does not make semantic guesses', () => {
  assert.equal(normalizeCatalogName('  Printer   Paper '), 'printer paper');
  assert.notEqual(normalizeCatalogName('paper reams'), normalizeCatalogName('printer paper'));
  assert.equal(buildCatalogKey(' Printer  Paper ', 'Boxes'), buildCatalogKey('printer paper', ' boxes '));
  assert.notEqual(buildCatalogKey('Printer Paper', 'Boxes'), buildCatalogKey('Printer Paper', 'Reams'));
});

test('an exact legacy name and unit match is a reviewable shared-catalogue candidate', () => {
  const audit = buildItemCatalogAudit([procurementItem()], [inventoryItem()]);

  assert.equal(audit.counts['exact-match'], 1);
  assert.equal(audit.candidates[0].status, 'exact-match');
  assert.equal(audit.candidates[0].procurementItems[0].legacyItemId, 'proc-paper');
  assert.equal(audit.candidates[0].inventoryItems[0].legacyItemId, 'inv-paper');
});

test('same names with different units stay separate until a staff member confirms a conversion', () => {
  const audit = buildItemCatalogAudit(
    [procurementItem({ unit: 'Boxes' })],
    [inventoryItem({ unit: 'Pieces' })]
  );

  assert.equal(audit.counts['unit-conflict'], 1);
  assert.equal(audit.candidates[0].status, 'unit-conflict');
});

test('existing shared catalogue links take precedence over display-name differences', () => {
  const audit = buildItemCatalogAudit(
    [procurementItem({ name: 'A4 Printer Paper', catalogItemId: 'catalog-paper' })],
    [inventoryItem({ name: 'Printer Paper', catalogItemId: 'catalog-paper' })]
  );

  assert.equal(audit.counts.linked, 1);
  assert.equal(audit.candidates.length, 1);
  assert.equal(audit.candidates[0].status, 'linked');
});

test('conflicting catalogue links are never presented as a safe name match', () => {
  const audit = buildItemCatalogAudit(
    [procurementItem({ catalogItemId: 'catalog-paper-a' })],
    [inventoryItem({ catalogItemId: 'catalog-paper-b' })]
  );

  assert.equal(audit.counts['catalog-link-conflict'], 1);
  assert.equal(audit.candidates[0].status, 'catalog-link-conflict');
});

test('unmatched records and duplicates are reported without changing their legacy ids', () => {
  const audit = buildItemCatalogAudit(
    [
      procurementItem({ id: 'proc-chalk', name: 'Chalk' }),
      procurementItem({ id: 'proc-chalk-copy', name: '  chalk  ' }),
    ],
    [inventoryItem({ id: 'inv-chair', name: 'Chair', unit: 'Pieces' })]
  );

  assert.equal(audit.counts['unmatched-procurement'], 1);
  assert.equal(audit.counts['unmatched-inventory'], 1);
  assert.deepEqual(audit.duplicateProcurementItems[0].itemIds, ['proc-chalk', 'proc-chalk-copy']);
});
