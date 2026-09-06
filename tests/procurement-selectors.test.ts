import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProcurementSummary, selectPurchasesForPeriod } from '../src/lib/utils/procurement-selectors';
import type { AcademicYear, ProcurementPurchase } from '../src/types';

const academicYear: AcademicYear = {
  id: 'year-2026',
  name: '2026',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  isActive: true,
  isLocked: false,
  terms: [
    { id: 'term-1-2026', name: 'Term 1', startDate: '2026-02-01', endDate: '2026-04-30', isCurrent: false },
    { id: 'term-2-2026', name: 'Term 2', startDate: '2026-05-01', endDate: '2026-08-31', isCurrent: false },
  ],
};

const purchase = (id: string, termId: string, purchaseDate: string, totalCost: number): ProcurementPurchase => ({
  id,
  itemId: `item-${id}`,
  itemName: `Item ${id}`,
  itemCategory: 'Equipment',
  quantity: 1,
  unitCost: totalCost,
  totalCost,
  paymentMethod: 'Cash',
  procuredBy: 'Staff',
  purchaseDate,
  academicYearId: academicYear.id,
  academicYearName: academicYear.name,
  termId,
  termName: termId === 'term-1-2026' ? 'Term 1' : 'Term 2',
  createdAt: purchaseDate,
});

test('term selection preserves the complete source list and returns only the selected term', () => {
  const purchases = [
    purchase('one', 'term-1-2026', '2026-03-05', 20_000),
    purchase('two', 'term-2-2026', '2026-06-05', 30_000),
  ];

  const termOne = selectPurchasesForPeriod(purchases, {
    academicYear,
    termId: 'term-1-2026',
    viewPeriod: 'Term',
  });

  assert.deepEqual(termOne.map((record) => record.id), ['one']);
  assert.deepEqual(purchases.map((record) => record.id), ['one', 'two']);
});

test('term selection accepts legacy matching term names but rejects partial id matches', () => {
  const legacy = { ...purchase('legacy', 'legacy-term-id', '2026-03-07', 10_000), termName: 'Term 1' };
  const similar = { ...purchase('similar', 'term-10-2026', '2026-03-08', 15_000), termName: 'Term 10' };

  const selected = selectPurchasesForPeriod([legacy, similar], {
    academicYear,
    termId: 'term-1-2026',
    viewPeriod: 'Term',
  });

  assert.deepEqual(selected.map((record) => record.id), ['legacy']);
});

test('summary uses the supplied period records without fetching or including other periods', () => {
  const summary = buildProcurementSummary([
    purchase('one', 'term-1-2026', '2026-03-05', 20_000),
    purchase('two', 'term-1-2026', '2026-03-06', 30_000),
  ]);

  assert.equal(summary.totalPurchases, 2);
  assert.equal(summary.totalAmountSpent, 50_000);
  assert.equal(summary.categorySummary.Equipment.totalSpent, 50_000);
});
