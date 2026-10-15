import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileStreamDraft, reconcileStreamDraftAssignments } from '../src/lib/utils/class-stream-draft';

const pupils = [
  { id: 'a', classId: 'p4', streamId: 'west', streamClassId: 'p4', streamAcademicYearId: '2026' },
  { id: 'b', classId: 'p4', streamId: 'east', streamClassId: 'p4', streamAcademicYearId: '2026' },
];

test('opening a saved two-stream distribution preserves both streams', () => {
  assert.deepEqual(reconcileStreamDraft(pupils, ['east', 'west'], {}, 'p4', '2026'), { a: 'west', b: 'east' });
});

test('late pupil hydration keeps unsaved edits and fills new pupils from their saved stream', () => {
  const late = [...pupils, { id: 'c', classId: 'p4', streamId: 'west' }];
  assert.deepEqual(reconcileStreamDraft(late, ['east', 'west'], { a: 'east', b: 'east' }, 'p4', '2026'),
    { a: 'east', b: 'east', c: 'west' });
});

test('a three-stream setup preserves existing assignments and leaves new pupils for explicit selection', () => {
  assert.deepEqual(reconcileStreamDraft([...pupils, { id: 'c', classId: 'p4' }], ['east', 'west', 'north'], {}, 'p4', '2026'),
    { a: 'west', b: 'east', c: '' });
});

test('stale class/year assignments do not carry into the current setup', () => {
  const stale = [
    { ...pupils[0], streamClassId: 'p3' },
    { ...pupils[1], streamId: 'west', streamAcademicYearId: '2025' },
  ];
  assert.deepEqual(reconcileStreamDraft(stale, ['east', 'west'], {}, 'p4', '2026'), { a: 'east', b: 'east' });
});

test('explicitly disabling a stream moves only affected pupils and removes departed pupils from counts', () => {
  assert.deepEqual(reconcileStreamDraft(pupils, ['east'], { a: 'west', b: 'east', departed: 'east' }, 'p4', '2026'),
    { a: 'east', b: 'east' });
});

test('fresh saved records replace stale cache defaults while retaining explicitly edited pupils', () => {
  assert.deepEqual(reconcileStreamDraft(pupils, ['east', 'west'], { a: 'east', b: 'east' }, 'p4', '2026', new Set()),
    { a: 'west', b: 'east' });
  assert.deepEqual(reconcileStreamDraft(pupils, ['east', 'west'], { a: 'east', b: 'east' }, 'p4', '2026', new Set(['a'])),
    { a: 'east', b: 'east' });
});

const ids = ['angels', 'stars'];
const savedCohort = Array.from({ length: 75 }, (_, index) => ({
  id: `p${index}`, streamId: index < 21 ? 'angels' : 'stars', streamClassId: 'p7', streamAcademicYearId: '2026',
}));

test('a saved two-stream setup preserves 21 Angels and 54 Stars regardless of definition order', () => {
  for (const activeIds of [ids, [...ids].reverse()]) {
    const draft = reconcileStreamDraftAssignments({}, savedCohort, activeIds, 'p7', '2026');
    assert.equal(Object.values(draft).filter(id => id === 'angels').length, 21);
    assert.equal(Object.values(draft).filter(id => id === 'stars').length, 54);
    assert.equal(draft.p0, 'angels');
    assert.equal(draft.p74, 'stars');
  }
});

test('live additions use saved IDs, manual edits survive, and inactive pupils leave draft counts', () => {
  const draft = reconcileStreamDraftAssignments({ p0: 'stars', removed: 'angels' }, savedCohort, ids, 'p7', '2026');
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
  assert.deepEqual(reconcileStreamDraftAssignments({}, savedCohort, [], 'p7', '2026'), Object.fromEntries(savedCohort.map(pupil => [pupil.id, ''])));
});
