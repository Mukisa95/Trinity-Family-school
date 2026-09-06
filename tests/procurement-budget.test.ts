import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBudgetLine, calculateBudgetTotal, normalizeBudgetLines, replaceBudgetLine } from '@/lib/utils/procurement-budget';
import type { ProcurementItem } from '@/types';

const chalk: ProcurementItem = {
  id: 'chalk',
  name: 'White chalk',
  category: 'Class Utility',
  unit: 'Boxes',
  useCase: 'Teaching',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

test('a school budget line may contain an item and quantity without an amount', () => {
  const line = buildBudgetLine({ id: 'line-1', item: chalk, quantity: 12 });
  assert.equal(line.estimatedQuantity, 12);
  assert.equal(line.estimatedUnitPrice, undefined);
  assert.equal(line.estimatedTotalCost, 0);
  assert.equal(line.costEstimated, false);
});

test('an entered quotation calculates the line and whole-budget totals', () => {
  const chalkLine = buildBudgetLine({ id: 'line-1', item: chalk, quantity: 10, estimatedUnitPrice: 25_000 });
  const paperLine = buildBudgetLine({ id: 'line-2', item: { ...chalk, id: 'paper', name: 'Paper' }, quantity: 5, estimatedUnitPrice: 18_000 });
  assert.equal(chalkLine.estimatedTotalCost, 250_000);
  assert.equal(calculateBudgetTotal([chalkLine, paperLine]), 340_000);
});

test('editing one line preserves the rest of the complete school budget', () => {
  const first = buildBudgetLine({ id: 'line-1', item: chalk, quantity: 10 });
  const second = buildBudgetLine({ id: 'line-2', item: { ...chalk, id: 'paper', name: 'Paper' }, quantity: 5 });
  const edited = buildBudgetLine({ id: 'line-1', item: chalk, quantity: 20, estimatedUnitPrice: 2_000 });
  const result = replaceBudgetLine([first, second], edited);
  assert.equal(result.length, 2);
  assert.equal(result[0].estimatedQuantity, 20);
  assert.equal(result[1].itemName, 'Paper');
});

test('saved lines are normalized without writing undefined prices to Firestore', () => {
  const line = buildBudgetLine({ id: 'line-1', item: chalk, quantity: 7 });
  const [normalized] = normalizeBudgetLines([{ ...line, estimatedUnitPrice: undefined }]);
  assert.equal(Object.hasOwn(normalized, 'estimatedUnitPrice'), false);
  assert.equal(normalized.estimatedTotalCost, 0);
});
