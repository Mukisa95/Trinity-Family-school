import assert from 'node:assert/strict';
import test from 'node:test';
import {
  searchPupilSnapshot,
  selectActivePupilsByClass,
  selectPupilByAdmissionNumber,
  selectPupilById,
  selectPupilPhotos,
  selectPupilsByClass,
  selectPupilsByFamily,
  selectPupilsByIds,
  selectPupilsWithFilters,
  selectPupilsWithoutPhotos,
} from '../src/lib/selectors/pupil-selectors';
import type { Pupil } from '../src/types';

const pupil = (overrides: Partial<Pupil>): Pupil => ({
  id: 'p1',
  firstName: 'Alice',
  lastName: 'Kato',
  admissionNumber: 'TFS-001',
  gender: 'Female',
  classId: 'c1',
  className: 'Primary One',
  section: 'Day',
  status: 'Active',
  guardians: [],
  createdAt: '2026-01-01',
  ...overrides,
});

const pupils = [
  pupil({ photo: 'alice.jpg', familyId: 'family-1' }),
  pupil({ id: 'p2', firstName: 'Brian', admissionNumber: 'TFS-002', gender: 'Male', section: 'Boarding', familyId: 'family-1' }),
  pupil({ id: 'p3', firstName: 'Carol', admissionNumber: 'TFS-003', classId: 'c2', className: 'Primary Two', status: 'Graduated' }),
];

test('pupil detail, class, family, admission, and id selectors use one snapshot', () => {
  assert.equal(selectPupilById(pupils, 'p2')?.firstName, 'Brian');
  assert.deepEqual(selectPupilsByClass(pupils, 'c1').map(entry => entry.id), ['p1', 'p2']);
  assert.deepEqual(selectPupilsByFamily(pupils, 'family-1').map(entry => entry.id), ['p1', 'p2']);
  assert.equal(selectPupilByAdmissionNumber(pupils, 'TFS-003')?.id, 'p3');
  assert.deepEqual(selectPupilsByIds(pupils, ['p3', 'missing', 'p1']).map(entry => entry.id), ['p3', 'p1']);
});

test('valid empty filtered results stay empty and never imply a fallback fetch', () => {
  assert.deepEqual(selectPupilsByClass(pupils, 'empty-class'), []);
  assert.deepEqual(selectPupilsByFamily(pupils, 'empty-family'), []);
  assert.deepEqual(selectActivePupilsByClass(pupils, 'c2'), []);
});

test('search and compound filters preserve the previous pupil matching behavior', () => {
  assert.deepEqual(searchPupilSnapshot(pupils, 'primary one').map(entry => entry.id), ['p1', 'p2']);
  assert.deepEqual(
    selectPupilsWithFilters(pupils, 'c1', { status: 'Active', section: 'boarding', gender: 'male' })
      .map(entry => entry.id),
    ['p2'],
  );
});

test('photo selectors reuse embedded pupil photos and photo-free projections omit payloads', () => {
  assert.deepEqual(Array.from(selectPupilPhotos(pupils, ['p2', 'p1'])), [['p1', 'alice.jpg']]);
  assert.equal('photo' in selectPupilsWithoutPhotos(pupils)[0], false);
});
