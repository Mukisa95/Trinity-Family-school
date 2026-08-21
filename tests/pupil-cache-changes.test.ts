import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPupilCacheChangeIds,
  hasCompletePupilCacheChangeRange,
  type PupilCacheChange,
} from '../src/lib/cache/pupil-cache-changes';

function change(overrides: Partial<PupilCacheChange>): PupilCacheChange {
  return {
    id: 'change',
    revision: 1,
    pupilId: 'pupil-1',
    operation: 'upsert',
    ...overrides,
  };
}

test('accepts legacy one-pupil revision records', () => {
  const changes = [
    change({ revision: 11, pupilId: 'pupil-1' }),
    change({ revision: 12, pupilId: 'pupil-2' }),
  ];
  assert.equal(hasCompletePupilCacheChangeRange(changes, 10, 12), true);
});

test('accepts one compact record covering multiple pupil revisions', () => {
  const changes = [change({
    revision: 13,
    pupilId: undefined,
    pupilIds: ['pupil-1', 'pupil-2', 'pupil-3'],
    revisionSpan: 3,
  })];
  assert.equal(hasCompletePupilCacheChangeRange(changes, 10, 13), true);
  assert.deepEqual(getPupilCacheChangeIds(changes[0]), ['pupil-1', 'pupil-2', 'pupil-3']);
});

test('accepts mixed legacy and compact records in revision order', () => {
  const changes = [
    change({ revision: 11, pupilId: 'pupil-1' }),
    change({
      revision: 14,
      pupilId: undefined,
      pupilIds: ['pupil-2', 'pupil-3', 'pupil-4'],
      revisionSpan: 3,
    }),
  ];
  assert.equal(hasCompletePupilCacheChangeRange(changes, 10, 14), true);
});

test('rejects missing, duplicated, or incorrectly sized compact ranges', () => {
  assert.equal(hasCompletePupilCacheChangeRange([], 10, 12), false);
  assert.equal(hasCompletePupilCacheChangeRange([
    change({ revision: 12, pupilId: 'pupil-2' }),
  ], 10, 12), false);
  assert.equal(hasCompletePupilCacheChangeRange([
    change({
      revision: 13,
      pupilId: undefined,
      pupilIds: ['pupil-1', 'pupil-1', 'pupil-2'],
      revisionSpan: 3,
    }),
  ], 10, 13), false);
});
