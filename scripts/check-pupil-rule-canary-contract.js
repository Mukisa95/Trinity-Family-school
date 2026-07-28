const fs = require('fs');

const rules = fs.readFileSync('firestore.rules', 'utf8');
const failures = [];

if (!rules.includes('function isStaffOrAdmin()')) {
  failures.push('The pupil canary must identify active staff and administrators from Firebase claims.');
}

if (!rules.includes('function isParentForFamily(familyId)')) {
  failures.push('The pupil canary must identify a parent family from Firebase claims.');
}

if (!rules.includes('match /pupils/{pupilId}')) {
  failures.push('The pupils collection needs an explicit canary rule.');
}

if (!rules.includes('allow read: if isStaffOrAdmin() || isParentForFamily(resource.data.familyId);')) {
  failures.push('Parents must only read pupil documents with their claimed familyId.');
}

if (!rules.includes("&& collection != 'pupils'")) {
  failures.push('The transitional catch-all must not override the pupil canary rule.');
}

for (const forbiddenLookup of ['get(', 'exists(', 'getAfter(']) {
  if (rules.includes(forbiddenLookup)) {
    failures.push(`Rules must not use ${forbiddenLookup} because it introduces rule-level document lookups.`);
  }
}

if (failures.length) {
  console.error('Pupil rule canary contract failed:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Pupil rule canary contract passed: claim-only parent reads and no catch-all bypass.');
