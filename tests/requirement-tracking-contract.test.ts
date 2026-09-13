import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const serviceSource = fs.readFileSync(
  path.join(process.cwd(), 'src/lib/services/requirement-tracking.service.ts'),
  'utf8',
);
const hookSource = fs.readFileSync(
  path.join(process.cwd(), 'src/lib/hooks/use-requirement-tracking.ts'),
  'utf8',
);

test('enhanced requirement tracking has one pupil/term/year contract', () => {
  const declarations = serviceSource.match(/static async getEnhancedTrackingRecordsByPupilAndTerm\(/g) || [];
  assert.equal(declarations.length, 1);
  assert.match(
    serviceSource,
    /getEnhancedTrackingRecordsByPupilAndTerm\(\s*pupil: Pupil,\s*termId: string,\s*academicYear: AcademicYear/,
  );
  assert.match(
    hookSource,
    /getEnhancedTrackingRecordsByPupilAndTerm\(pupil, termId, academicYear\)/,
  );
});
