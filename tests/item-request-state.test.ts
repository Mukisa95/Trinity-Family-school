import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransitionItemRequest,
  defaultRestockPendingReason,
  isActiveItemRequestStatus,
} from '@/lib/utils/item-request-state';

test('item requests cannot leave a terminal status', () => {
  assert.equal(canTransitionItemRequest('released', 'pending_available'), false);
  assert.equal(canTransitionItemRequest('declined', 'released'), false);
  assert.equal(canTransitionItemRequest('cancelled', 'submitted'), false);
});

test('item requests permit the controlled restock and release lifecycle', () => {
  assert.equal(canTransitionItemRequest('submitted', 'pending_restock'), true);
  assert.equal(canTransitionItemRequest('pending_restock', 'restock_in_progress'), true);
  assert.equal(canTransitionItemRequest('restock_in_progress', 'ready_to_release'), true);
  assert.equal(canTransitionItemRequest('ready_to_release', 'released'), true);
});

test('active statuses exclude completed outcomes', () => {
  assert.equal(isActiveItemRequestStatus('submitted'), true);
  assert.equal(isActiveItemRequestStatus('ready_to_release'), true);
  assert.equal(isActiveItemRequestStatus('released'), false);
  assert.equal(isActiveItemRequestStatus('declined'), false);
});

test('restock pending copy tells the requester what will happen next', () => {
  assert.match(defaultRestockPendingReason('White chalk'), /White chalk is currently unavailable/);
  assert.match(defaultRestockPendingReason('White chalk'), /arranging restocking/);
});
