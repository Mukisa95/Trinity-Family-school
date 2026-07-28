const fs = require('fs');

const source = fs.readFileSync('src/scripts/backfill-parent-ownership.ts', 'utf8');
const failures = [];

for (const collection of [
  'attendanceRecords',
  'payments',
  'pupilSnapshots',
  'requirement-tracking',
  'uniformTracking',
]) {
  if (!source.includes(`'${collection}'`)) {
    failures.push(`${collection} must remain in the single-pupil ownership backfill target list.`);
  }
}

if (source.includes("'examResults',")) {
  failures.push('Shared exam results must not be added to the single-pupil ownership backfill.');
}

if (!source.includes("--confirm-parent-ownership-backfill") || !source.includes('if (apply && !confirmed)')) {
  failures.push('Apply mode must require an explicit ownership-backfill confirmation.');
}

if (!source.includes("select('familyId')") || !source.includes('familyIdByPupilId')) {
  failures.push('The backfill must derive ownership from the trusted pupils collection in one scan.');
}

if (!source.includes('if (nonEmptyString(existingFamilyId))')) {
  failures.push('Existing familyId values must be preserved rather than overwritten.');
}

if (failures.length) {
  console.error('Parent ownership backfill contract failed:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Parent ownership backfill contract passed: dry-run by default, confirmation-gated, and single-pupil only.');
