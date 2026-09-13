import assert from 'node:assert/strict';
import test from 'node:test';

import { mergePupilPayments } from '@/app/fees/collect/[id]/hooks/usePupilFees';
import type { PaymentRecord } from '@/types';

function payment(id: string, paymentDate: string, amount: number): PaymentRecord {
  return {
    id,
    pupilId: 'pupil-1',
    feeStructureId: 'fee-1',
    academicYearId: 'year-1',
    termId: 'term-1',
    amount,
    paymentDate,
    createdAt: paymentDate,
    paidBy: { id: 'cashier-1', name: 'Cashier', role: 'Staff' },
  };
}

test('locally committed payments update the listener-owned fee-card list without duplicates', () => {
  const current = [payment('existing', '2026-01-01T08:00:00.000Z', 500)];
  const committed = payment('new-payment', '2026-01-02T08:00:00.000Z', 300);

  const merged = mergePupilPayments(current, [committed]);
  assert.deepEqual(merged.map(item => item.id), ['new-payment', 'existing']);

  const listenerConfirmed = mergePupilPayments(merged, [{ ...committed, amount: 300 }]);
  assert.equal(listenerConfirmed.length, 2);
  assert.equal(listenerConfirmed.find(item => item.id === 'new-payment')?.amount, 300);
});
