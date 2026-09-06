import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateInventoryQuantity, calculateReturnState } from '../src/lib/utils/inventory-movement';
import type { IssuedItem } from '../src/types';

const issuedItem: IssuedItem = {
  id: 'issue-1',
  itemId: 'chair',
  itemName: 'Chair',
  transactionId: 'transaction-1',
  quantity: 10,
  issuedTo: 'Classroom A',
  issueDate: '2026-09-01',
  status: 'issued',
  academicYearId: 'year-2026',
  termId: 'term-3',
  createdAt: '2026-09-01',
};

test('an issue cannot reduce stock below zero', () => {
  assert.throws(() => calculateInventoryQuantity(10, 'issue', 11), /Insufficient stock/);
  assert.equal(calculateInventoryQuantity(10, 'issue', 7), 3);
});

test('a partial return remains outstanding and a full return closes the issue', () => {
  const partial = calculateReturnState(issuedItem, 4);
  assert.deepEqual(partial, {
    outstandingQuantity: 10,
    totalReturned: 4,
    isFullyReturned: false,
    status: 'partial',
  });

  const full = calculateReturnState({ ...issuedItem, returnedQuantity: 4, status: 'partial' }, 6);
  assert.equal(full.status, 'returned');
  assert.equal(full.isFullyReturned, true);
});

test('a return cannot exceed the outstanding quantity or be posted twice', () => {
  assert.throws(() => calculateReturnState({ ...issuedItem, returnedQuantity: 7, status: 'partial' }, 4), /Only 3/);
  assert.throws(() => calculateReturnState({ ...issuedItem, returnedQuantity: 10, status: 'returned' }, 1), /already been fully returned/);
});
