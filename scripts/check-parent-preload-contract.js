const fs = require('fs');

const file = 'src/components/providers/global-data-preloader.tsx';
const source = fs.readFileSync(file, 'utf8');
const failures = [];

const familyPupilQueries = source.match(/where\('familyId', '==', userFamilyId\)/g) || [];
if (familyPupilQueries.length !== 1) {
  failures.push('Parent preload must have exactly one family-scoped pupils query.');
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

if (failures.length) {
  console.error('Parent preload contract failed:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Parent preload contract passed: one family pupil listener and no unused photo preload.');
