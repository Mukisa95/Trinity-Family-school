import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const requestRoute = readFileSync('src/app/api/item-requests/route.ts', 'utf8');
const restockQueueRoute = readFileSync('src/app/api/item-requests/restock-queue/route.ts', 'utf8');

test('request and release lists do not require separately deployed composite indexes', () => {
  assert.doesNotMatch(requestRoute, /\.orderBy\(['"](?:createdAt|lastActionAt)['"]/);
  assert.doesNotMatch(restockQueueRoute, /\.orderBy\(['"]updatedAt['"]/);
  assert.match(requestRoute, /\.sort\(\(left, right\)/);
  assert.match(restockQueueRoute, /\.sort\(\(left, right\)/);
});

test('server-side request idempotency uses the Admin snapshot exists property', () => {
  assert.match(requestRoute, /if \(existing\.exists\)/);
  assert.doesNotMatch(requestRoute, /existing\.exists\(\)/);
});
