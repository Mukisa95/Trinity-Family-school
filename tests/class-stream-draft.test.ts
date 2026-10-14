import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileStreamDraftAssignments } from '../src/lib/utils/class-stream-draft';

const ids = ['angels', 'stars'];
const pupils = Array.from({ length: 75 }, (_, index) => ({
  id: `p${index}`, streamId: index < 21 ? 'angels' : 'stars', streamClassId: 'p7', streamAcademicYearId: '2026',
}));

test('a saved two-stream setup preserves 21 Angels and 54 Stars regardless of definition order', () => {
  for (const activeIds of [ids, [...ids].reverse()]) {
    const draft = reconcileStreamDraftAssignments({}, pupils, activeIds, 'p7', '2026');
    assert.equal(Object.values(draft).filter(id => id === 'angels').length, 21);
    assert.equal(Object.values(draft).filter(id => id === 'stars').length, 54);
    assert.equal(draft.p0, 'angels');
    assert.equal(draft.p74, 'stars');
  }
});

test('live additions use saved IDs, manual edits survive, and inactive pupils leave draft counts', () => {
  const draft = reconcileStreamDraftAssignments({ p0: 'stars', removed: 'angels' }, pupils, ids, 'p7', '2026');
  assert.equal(draft.p0, 'stars');
  assert.equal(draft.p1, 'angels');
  assert.equal('removed' in draft, false);
  assert.equal(Object.keys(draft).length, 75);
});

test('a saved assignment from another year/class cannot be reused as the active assignment', () => {
  const stale = [
    { id: 'year', streamId: 'stars', streamAcademicYearId: '2025', streamClassId: 'p7' },
    { id: 'class', streamId: 'stars', streamAcademicYearId: '2026', streamClassId: 'p6' },
  ];
  const draft = reconcileStreamDraftAssignments({}, stale, ids, 'p7', '2026');
  assert.deepEqual(draft, { year: 'angels', class: 'angels' });
  assert.deepEqual(reconcileStreamDraftAssignments({}, pupils, [], 'p7', '2026'), Object.fromEntries(pupils.map(pupil => [pupil.id, ''])));
});
