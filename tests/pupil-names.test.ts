import assert from 'node:assert/strict';
import test from 'node:test';
import { formatPupilDisplayName, formatPupilFullName, formatPupilName, matchesPupilName, matchesPupilSearch } from '../src/lib/utils/name-formatter';
import { searchPupilSnapshot } from '../src/lib/selectors/pupil-selectors';
import type { Pupil } from '../src/types';

const pupil = { id: 'fictional', firstName: 'Mary', lastName: 'Kato', otherNames: 'Grace', admissionNumber: 'TFS-001', className: 'Primary Four' } as Pupil;

test('every full display entry point uses surname, first name, and all other names', () => {
  for (const format of [formatPupilName, formatPupilDisplayName, formatPupilFullName]) {
    assert.equal(format(pupil), 'Kato Mary Grace');
    assert.equal(format({ firstName: '  Mary  Jane ', otherNames: ' Grace  Anne ' }), 'Mary Jane Grace Anne');
    assert.equal(format({ lastName: ' Kato ', otherNames: 'Grace' }), 'Kato Grace');
    assert.equal(format({ otherNames: ' Grace ' }), 'Grace');
  }
  assert.equal(formatPupilDisplayName({}), 'Unknown Student');
  assert.equal(formatPupilDisplayName(undefined), 'Unknown Student');
  assert.equal(formatPupilDisplayName(null), 'Unknown Student');
  assert.equal(formatPupilName(pupil, { includeOtherNames: false, separator: ', ' }), 'Kato, Mary');
});

for (const query of ['Mary', 'Kato', 'Grace', 'Kato Mary', 'Mary Kato', 'Kato Mary Grace', 'Mary Kato Grace', 'Grace Kato Mary', 'Grace Mary', '  GRACE,   kato  ', 'mar gra']) {
  test(`all name fields match independently of order: ${query}`, () => {
    assert.equal(matchesPupilName(pupil, query), true);
    assert.deepEqual(searchPupilSnapshot([pupil], query), [pupil]);
  });
}

test('every query token is required and punctuation-only names do not match', () => {
  for (const query of ['Mary Brian', 'Kato Missing Grace', 'Nobody', ',']) {
    assert.equal(matchesPupilName(pupil, query), false);
    assert.deepEqual(searchPupilSnapshot([pupil], query), []);
  }
});

test('compound names, accents, apostrophes, and hyphens are normalized for name matching', () => {
  const name = { lastName: "O’Connor", firstName: 'Anne-Marie', otherNames: 'Élodie Jane' };
  for (const query of ['elodie anne', "O'Connor Anne-Marie", 'Jane Marie Connor']) {
    assert.equal(matchesPupilName(name, query), true);
  }
});

test('identifier matching preserves each screen scope and code punctuation', () => {
  const fields = ['TFS-001', 'Primary Four', 'LIN/123', 'parent@example.com'];
  for (const query of [' tfs-001 ', 'primary   four', 'LIN/123', 'example.com']) {
    assert.equal(matchesPupilSearch(pupil, query, fields), true);
  }
  for (const query of ['TFS/001', 'LIN-123', 'primary Mary', 'unsupported']) {
    assert.equal(matchesPupilSearch(pupil, query, fields), false);
  }
  assert.equal(matchesPupilSearch(pupil, 'Primary Four'), false);
  assert.equal(matchesPupilSearch(pupil, 'TFS-001'), false);
});

test('missing names and optional fields are safe, with existing empty-selector semantics', () => {
  assert.equal(matchesPupilSearch({ otherNames: 'Grace' }, 'Grace'), true);
  assert.equal(matchesPupilSearch({}, 'Mary', [undefined, null]), false);
  assert.equal(matchesPupilSearch(pupil, '   '), true);
  assert.deepEqual(searchPupilSnapshot([pupil], '   '), []);
  assert.deepEqual(searchPupilSnapshot(undefined, 'Mary'), []);
});
