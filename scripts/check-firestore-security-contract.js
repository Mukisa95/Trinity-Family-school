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

if (/allow\s+(?:write|read\s*,\s*write)\s*:\s*if\s+true\s*;/m.test(rules)) {
  failures.push('Firestore Rules must not contain an unconditional write statement.');
}

const permittedPublicReads = [
  /match\s+\/settings\/school-settings\s*\{[\s\S]*?allow\s+read\s*:\s*if\s+true\s*;/m,
  /match\s+\/photos\/\{photoId\}\s*\{[\s\S]*?allow\s+read\s*:\s*if\s+true\s*;/m,
];
const allPublicReadRules = rules.match(/allow\s+read\s*:\s*if\s+true\s*;/g) || [];
if (allPublicReadRules.length !== permittedPublicReads.length || permittedPublicReads.some(pattern => !pattern.test(rules))) {
  failures.push('Only the public school settings document and gallery photos may allow anonymous reads.');
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
