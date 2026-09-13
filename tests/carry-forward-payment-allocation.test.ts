import assert from 'node:assert/strict';
import test from 'node:test';
import { Timestamp } from 'firebase/firestore';

import {
  calculateCarryForwardPaymentDistribution,
  prepareCarryForwardPayment,
  validateCarryForwardPayment,
  type CarryForwardItem,
} from '@/app/fees/collect/[id]/utils/carryForwardPayments';
import { cleanUndefinedPaymentValues } from '@/lib/services/payments.service';

const items: CarryForwardItem[] = [
  { name: 'Tuition', amount: 100, paid: 0, balance: 100, term: 'Term 1', year: '2026' },
  { name: 'Meals', amount: 100, paid: 0, balance: 100, term: 'Term 1', year: '2026' },
  { name: 'Transport', amount: 100, paid: 0, balance: 100, term: 'Term 1', year: '2026' },
];

function distribution(amount: number, feeBreakdown = items) {
  return calculateCarryForwardPaymentDistribution(amount, 'general', feeBreakdown);
}

test('carry-forward allocations preserve a submitted whole-UGX amount', () => {
  for (const amount of [1, 2, 100, 101, 299, 300]) {
    const allocations = distribution(amount);
    assert.equal(
      allocations.reduce((total, allocation) => total + allocation.allocatedAmount, 0),
      amount,
      `expected allocations to retain UGX ${amount}`,
    );
    assert.ok(allocations.every(allocation => Number.isSafeInteger(allocation.allocatedAmount)));
    assert.ok(allocations.every(allocation => allocation.allocatedAmount <= allocation.item.balance));
  }
});

test('carry-forward remainder distribution is deterministic', () => {
  const allocations = distribution(100);
  assert.deepEqual(allocations.map(allocation => allocation.allocatedAmount), [34, 33, 33]);
});

test('carry-forward allocation ignores settled items and caps at the available balance', () => {
  const feeBreakdown = [
    { ...items[0], balance: 0 },
    { ...items[1], balance: 1 },
    { ...items[2], balance: 2 },
  ];

  const allocations = distribution(3, feeBreakdown);
  assert.deepEqual(allocations.map(allocation => [allocation.item.name, allocation.allocatedAmount]), [
    ['Meals', 1],
    ['Transport', 2],
  ]);
});

test('carry-forward validation rejects fractional UGX amounts', () => {
  const result = validateCarryForwardPayment({
    pupilId: 'pupil-1',
    currentTermId: 'term-2',
    currentAcademicYearId: 'year-2026',
    amount: 100.5,
    paymentType: 'general',
    feeBreakdown: items,
    paidBy: { id: 'cashier-1', name: 'Cashier', role: 'Staff' },
  });

  assert.equal(result.isValid, false);
  assert.match(result.error || '', /whole UGX/);
});

test('prepared carry-forward allocations preserve the current-term receipt metadata', () => {
  const prepared = prepareCarryForwardPayment({
    pupilId: 'pupil-1',
    currentTermId: 'term-2',
    currentAcademicYearId: 'year-2026',
    amount: 101,
    paymentType: 'general',
    feeBreakdown: items,
    paymentDate: '2026-09-12T10:00:00.000Z',
    paidBy: { id: 'cashier-1', name: 'Cashier', role: 'Staff' },
  });

  assert.equal(prepared.allocations.length, 3);
  assert.equal(prepared.allocations.reduce((total, allocation) => total + allocation.paymentData.amount, 0), 101);
  assert.ok(prepared.allocations.every(allocation => (
    allocation.paymentData.feeStructureId === 'previous-balance'
      && allocation.paymentData.paymentDate === '2026-09-12T10:00:00.000Z'
      && (allocation.paymentData as any).isCarryForwardPayment === true
      && allocation.historyContext.source === 'carry_forward_payment'
  )));
});

test('payment cleaner preserves Firestore values while removing undefined plain fields', () => {
  const timestamp = Timestamp.now();
  const cleaned = cleanUndefinedPaymentValues({
    createdAt: timestamp,
    paidBy: { id: 'cashier-1', name: undefined },
    unused: undefined,
  });

  assert.equal(cleaned.createdAt, timestamp);
  assert.deepEqual(cleaned.paidBy, { id: 'cashier-1' });
  assert.equal('unused' in cleaned, false);
});
