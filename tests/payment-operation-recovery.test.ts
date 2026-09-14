import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearPendingPaymentOperation,
  getOrCreatePendingPaymentOperation,
} from '@/lib/utils/payment-operation-recovery';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    values,
  };
}

const scope = { kind: 'individual' as const, userId: 'cashier-1', ownerId: 'pupil-1' };
const intent = 'multi:fee-1:400';

test('a reload-safe payment operation reuses the same ID without storing its financial intent', () => {
  const storage = memoryStorage();
  const first = getOrCreatePendingPaymentOperation(scope, intent, () => ({
    operationId: 'fee-operation-001', paymentDate: '2026-09-12T09:00:00.000Z',
  }), storage);
  const replay = getOrCreatePendingPaymentOperation(scope, intent, () => ({
    operationId: 'fee-operation-002', paymentDate: '2026-09-12T09:01:00.000Z',
  }), storage);

  assert.equal(replay.operationId, first.operationId);
  const persisted = [...storage.values.values()].join('\n');
  assert.doesNotMatch(persisted, /multi:fee-1:400/);
  assert.doesNotMatch(persisted, /amount|paidBy|paymentMethod/);
});

test('pending payment operations are isolated by signed-in user and owner', () => {
  const storage = memoryStorage();
  const first = getOrCreatePendingPaymentOperation(scope, intent, () => ({
    operationId: 'fee-operation-001', paymentDate: '2026-09-12T09:00:00.000Z',
  }), storage);
  const otherUser = getOrCreatePendingPaymentOperation(
    { ...scope, userId: 'cashier-2' }, intent,
    () => ({ operationId: 'fee-operation-002', paymentDate: '2026-09-12T09:01:00.000Z' }), storage,
  );
  const otherPupil = getOrCreatePendingPaymentOperation(
    { ...scope, ownerId: 'pupil-2' }, intent,
    () => ({ operationId: 'fee-operation-003', paymentDate: '2026-09-12T09:02:00.000Z' }), storage,
  );

  assert.notEqual(otherUser.operationId, first.operationId);
  assert.notEqual(otherPupil.operationId, first.operationId);
});

test('a confirmed payment clears only its own reload recovery reference', () => {
  const storage = memoryStorage();
  const secondIntent = 'single:fee-2:700';
  getOrCreatePendingPaymentOperation(scope, intent, () => ({
    operationId: 'fee-operation-001', paymentDate: '2026-09-12T09:00:00.000Z',
  }), storage);
  getOrCreatePendingPaymentOperation(scope, secondIntent, () => ({
    operationId: 'fee-operation-002', paymentDate: '2026-09-12T09:01:00.000Z',
  }), storage);

  clearPendingPaymentOperation(scope, intent, storage);
  const next = getOrCreatePendingPaymentOperation(scope, intent, () => ({
    operationId: 'fee-operation-003', paymentDate: '2026-09-12T09:02:00.000Z',
  }), storage);
  const retained = getOrCreatePendingPaymentOperation(scope, secondIntent, () => ({
    operationId: 'fee-operation-004', paymentDate: '2026-09-12T09:03:00.000Z',
  }), storage);

  assert.equal(next.operationId, 'fee-operation-003');
  assert.equal(retained.operationId, 'fee-operation-002');
});
