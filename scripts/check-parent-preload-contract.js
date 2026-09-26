const fs = require('fs');

const file = 'src/components/providers/global-data-preloader.tsx';
const source = fs.readFileSync(file, 'utf8');
const parentLayoutSource = fs.readFileSync('src/components/parent/parent-layout.tsx', 'utf8');
const failures = [];

const parentAccountQueries = source.match(/where\('parentAccountId', '==', userId\)/g) || [];
const activeAccountQueries = source.match(/where\('parentAccountActive', '==', true\)/g) || [];
if (parentAccountQueries.length !== 1 || activeAccountQueries.length !== 1) {
  failures.push('Parent preload must have exactly one active account-scoped pupils query.');
}

if (!source.includes('setupPupilsListener(syncParentPupilRecords)')) {
  failures.push('The parent record subscriptions must be driven by the cache-first pupils listener.');
}

if (!source.includes('onParentPupilIds?.(persistedPupils.map(pupil => pupil.id))')) {
  failures.push('Persisted parent pupil cache must start record subscriptions without waiting for the network.');
}

const parentBranch = source.match(/if \(userRole === 'Parent'\) \{([\s\S]*?)\n        \} else \{/);
if (!parentBranch || parentBranch[1].includes('fetchPhotos(')) {
  failures.push('Parent dashboard preload must not fetch photos before the About School view is opened.');
}

if (!parentLayoutSource.includes('hasLiveFamilyData: familyId ? !familyQuery.isLoading : !accountPupilsLoading')) {
  failures.push('A cold offline launch must use query readiness, not the selector\'s placeholder empty array, before ignoring its saved family.');
}

if (parentLayoutSource.includes('hasLiveFamilyData: familyQuery.data !== undefined')) {
  failures.push('The family selector normalizes missing data to [], so data !== undefined cannot represent live readiness.');
}

if (failures.length) {
  console.error('Parent preload contract failed:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Parent preload contract passed: one active account-scoped pupil listener, cold-start fallback, and no unused photo preload.');
