const fs = require('fs');
const path = require('path');

const rulesPath = path.join(process.cwd(), 'firestore.rules');
const rules = fs.readFileSync(rulesPath, 'utf8');
const failures = [];

for (const operation of ['get', 'exists', 'getAfter']) {
  if (new RegExp(`\\b${operation}\\s*\\(`).test(rules)) {
    failures.push(`Firestore Rules must not call ${operation}(). It can add rule-level document reads.`);
  }
}

if (/allow\s+(?:read|write|read\s*,\s*write)\s*:\s*if\s+true\s*;/m.test(rules)) {
  failures.push('Firestore Rules must not contain an unconditional allow statement.');
}

if (!/match\s+\/authCredentials\/\{credentialPath=\*\*\}[\s\S]*?allow\s+read\s*,\s*write\s*:\s*if\s+false\s*;/m.test(rules)) {
  failures.push('authCredentials must remain inaccessible to browser clients.');
}

if (failures.length) {
  console.error('Firestore security contract failed:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Firestore security contract passed: no public rule and no rule-level document lookup.');
