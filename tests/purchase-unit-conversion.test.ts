import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculatePurchasePacksNeeded,
  calculateStockQuantityFromPurchase,
  normalizePurchaseUnitConfiguration,
} from '../src/lib/utils/purchase-unit-conversion';
import { readFileSync } from 'node:fs';

test('a box purchase converts into individual pens for inventory receipt', () => {
  const configuration = normalizePurchaseUnitConfiguration({
    stockUnit: 'Pieces',
    purchaseUnit: 'Boxes',
    unitsPerPurchaseUnit: 50,
  });

  assert.deepEqual(configuration, { stockUnit: 'Pieces', purchaseUnit: 'Boxes', unitsPerPurchaseUnit: 50 });
  assert.equal(calculateStockQuantityFromPurchase(2, configuration.unitsPerPurchaseUnit), 100);
});

test('a sack purchase converts into kilograms for inventory receipt', () => {
  assert.equal(calculateStockQuantityFromPurchase(1, 50), 50);
  assert.equal(calculateStockQuantityFromPurchase(0.5, 50), 25);
});

test('restock chooses enough packs for the requested everyday quantity', () => {
  assert.equal(calculatePurchasePacksNeeded(51, 50), 2);
  assert.equal(calculatePurchasePacksNeeded(50, 50), 1);
});

test('legacy items without pack details remain one-for-one', () => {
  assert.deepEqual(normalizePurchaseUnitConfiguration({ stockUnit: 'Pieces' }), {
    stockUnit: 'Pieces',
    purchaseUnit: 'Pieces',
    unitsPerPurchaseUnit: 1,
  });
  assert.equal(calculateStockQuantityFromPurchase(7), 7);
});

test('the operational forms preserve the conversion and default staff work to everyday units', () => {
  const procurementItemForm = readFileSync('src/components/procurement/ItemManagement.tsx', 'utf8');
  const purchaseForm = readFileSync('src/components/procurement/PurchaseManagement.tsx', 'utf8');
  const inventoryItemForm = readFileSync('src/components/inventory/ItemManagement.tsx', 'utf8');

  assert.match(procurementItemForm, /Everyday stock and release unit/);
  assert.match(procurementItemForm, /Everyday units in one purchase pack/);
  assert.match(purchaseForm, /stockQuantity: equivalentStockQuantity/);
  assert.match(purchaseForm, /Receive \$\{equivalentStockQuantity\}/);
  assert.match(inventoryItemForm, /Stock quantity in everyday units/);
});
