import test from 'node:test';
import assert from 'node:assert/strict';

import {
  nextPhotoCacheRevision,
  removePhotoFromList,
  setPrimaryPhotoInList,
  updatePhotoInList,
  upsertPhotoInList,
} from '@/lib/cache/photo-cache';
import type { Photo } from '@/types';

function photo(id: string, category: Photo['category'] = 'events'): Photo {
  return {
    id,
    title: id,
    category,
    usage: ['dashboard'],
    url: `https://res.cloudinary.com/demo/${id}.jpg`,
    fileName: `${id}.jpg`,
    fileSize: 10,
    isActive: true,
    uploadedBy: 'tester',
    uploadedAt: '2026-09-28T00:00:00.000Z',
  };
}

test('photo cache revisions advance from the newest local or published value', () => {
  assert.equal(nextPhotoCacheRevision(4, 4), 5);
  assert.equal(nextPhotoCacheRevision(4, 6), 7);
  assert.equal(nextPhotoCacheRevision(4), 5);
});

test('upload cache patches preserve the complete collection and replace duplicates', () => {
  const existing = [photo('old'), photo('same')];
  const replacement = { ...photo('same'), title: 'replacement' };
  assert.deepEqual(
    upsertPhotoInList(existing, replacement).map(item => [item.id, item.title]),
    [['same', 'replacement'], ['old', 'old']],
  );
});

test('metadata and primary-photo patches keep unrelated photos unchanged', () => {
  const existing = [
    { ...photo('one'), isPrimary: true },
    photo('two'),
    { ...photo('other', 'staff'), isPrimary: true },
  ];
  const updated = updatePhotoInList(existing, 'two', { title: 'updated' });
  const primary = setPrimaryPhotoInList(updated, 'two', 'events');

  assert.equal(primary.find(item => item.id === 'two')?.title, 'updated');
  assert.equal(primary.find(item => item.id === 'one')?.isPrimary, false);
  assert.equal(primary.find(item => item.id === 'two')?.isPrimary, true);
  assert.equal(primary.find(item => item.id === 'other')?.isPrimary, true);
});

test('soft and permanent deletion patches remove only the selected photo', () => {
  assert.deepEqual(
    removePhotoFromList([photo('one'), photo('two')], 'one').map(item => item.id),
    ['two'],
  );
});
