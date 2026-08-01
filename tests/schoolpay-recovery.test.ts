import assert from 'node:assert/strict';
import test from 'node:test';
import { assessExistingSchoolPayPayments } from '../src/lib/utils/schoolpay-recovery';

test('recognises a distributed receipt as one existing payment', () => {
  const result = assessExistingSchoolPayPayments('61513884', 70_000, [
    { id: 'payment-a', pupilId: 'pupil-1', amount: 40_000 },
    { id: 'payment-b', pupilId: 'pupil-1', amount: 30_000 },
  ]);
  assert.deepEqual(result, {
    pupilId: 'pupil-1',
    localPaymentIds: ['payment-a', 'payment-b'],
    totalAmount: 70_000,
  });
});

test('stops recovery when an existing receipt total differs', () => {
  const result = assessExistingSchoolPayPayments('61513884', 70_000, [
    { id: 'payment-a', pupilId: 'pupil-1', amount: 60_000 },
  ]);
  assert.equal(result?.pupilId, 'pupil-1');
  assert.match(result?.conflict || '', /reports 70000/);
});

test('stops recovery when one receipt points at multiple pupils', () => {
  const result = assessExistingSchoolPayPayments('61513884', 70_000, [
    { id: 'payment-a', pupilId: 'pupil-1', amount: 35_000 },
    { id: 'payment-b', pupilId: 'pupil-2', amount: 35_000 },
  ]);
  assert.match(result?.conflict || '', /assigned to 2 pupils/);
});

test('returns null when no local receipt or transaction matches', () => {
  assert.equal(assessExistingSchoolPayPayments('61513884', 70_000, []), null);
});
