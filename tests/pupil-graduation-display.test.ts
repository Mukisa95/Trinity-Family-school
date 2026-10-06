import assert from 'node:assert/strict';
import test from 'node:test';
import { getPupilGraduationDisplay } from '../src/lib/utils/pupil-graduation-display';

const classes = [
  { id: 'current-class', name: 'Primary Six' },
  { id: 'graduated-class', name: 'Primary Seven' },
];
const pupil = {
  classId: 'current-class', className: 'Primary Six East',
  graduationClassId: 'graduated-class', graduationClassName: 'Primary Seven',
  graduationYear: 2025,
};

test('graduation identity overrides a different current class and its stream', () => {
  assert.deepEqual(getPupilGraduationDisplay(pupil, classes), {
    name: 'Primary Seven Class of 2025', href: '/classes/graduates/graduated-class',
    year: 2025, academicTitle: 'Academic Information of 2025',
  });
});

test('saved graduation name survives renaming or removal of its class', () => {
  for (const catalog of [[], [{ id: 'graduated-class', name: 'Renamed Class' }]]) {
    assert.equal(getPupilGraduationDisplay(pupil, catalog).name, 'Primary Seven Class of 2025');
  }
});

test('missing graduation name resolves the saved graduation class from the catalog', () => {
  assert.equal(getPupilGraduationDisplay({ ...pupil, graduationClassName: undefined }, classes).name,
    'Primary Seven Class of 2025');
});

test('unknown historical class does not borrow a different current class name', () => {
  assert.equal(getPupilGraduationDisplay({ ...pupil, graduationClassName: undefined }, []).name,
    'Graduated Class of 2025');
});

test('legacy records without graduation class metadata retain graduate routing', () => {
  const legacy = { classId: 'current-class', className: 'Primary Seven', graduationYear: 2025 };
  assert.equal(getPupilGraduationDisplay(legacy, []).href, '/classes/graduates/current-class');
  assert.equal(getPupilGraduationDisplay(legacy, []).name, 'Primary Seven Class of 2025');
});

test('missing or invalid cohort year stays unknown rather than using the current year', () => {
  for (const year of [undefined, 0, -1, NaN, 2025.5]) {
    const result = getPupilGraduationDisplay({ ...pupil, graduationYear: year }, classes);
    assert.equal(result.name, 'Primary Seven Class of Unknown');
    assert.equal(result.academicTitle, 'Academic Information');
    assert.equal(result.year, undefined);
  }
});

test('records without a class ID render without a broken link', () => {
  assert.equal(getPupilGraduationDisplay({ graduationYear: 2025 }, []).href, undefined);
});
