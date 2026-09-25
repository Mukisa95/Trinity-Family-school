import test from 'node:test';
import assert from 'node:assert/strict';

import { getRevisionCachePolicy } from '@/lib/cache/revision-cache-policy';

test('a warm cache stays read-free while revision data is still loading', () => {
  assert.deepEqual(
    getRevisionCachePolicy({
      hasCachedData: true,
      cachedRevision: 7,
      currentRevision: 0,
      revisionsReady: false,
    }),
    {
      hasCachedData: true,
      revisionChanged: false,
      shouldFetch: false,
    },
  );
});

test('a matching revision never triggers a Firestore refresh', () => {
  assert.equal(
    getRevisionCachePolicy({
      hasCachedData: true,
      cachedRevision: 7,
      currentRevision: 7,
      revisionsReady: true,
    }).shouldFetch,
    false,
  );
});

test('a confirmed revision change refreshes while retaining cached data', () => {
  assert.deepEqual(
    getRevisionCachePolicy({
      hasCachedData: true,
      cachedRevision: 7,
      currentRevision: 8,
      revisionsReady: true,
    }),
    {
      hasCachedData: true,
      revisionChanged: true,
      shouldFetch: true,
    },
  );
});

test('a locally patched cache waits for its committed revision signal without re-reading', () => {
  assert.equal(
    getRevisionCachePolicy({
      hasCachedData: true,
      cachedRevision: 8,
      currentRevision: 7,
      revisionsReady: true,
    }).shouldFetch,
    false,
  );
});

test('a cold cache fetches even before the revision channel is ready', () => {
  assert.equal(
    getRevisionCachePolicy({
      hasCachedData: false,
      currentRevision: 0,
      revisionsReady: false,
    }).shouldFetch,
    true,
  );
});
