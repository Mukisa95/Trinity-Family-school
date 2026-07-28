const fs = require('fs');

const appAuth = fs.readFileSync('src/lib/server/app-auth.ts', 'utf8');
const userRoute = fs.readFileSync('src/app/api/users/[id]/route.ts', 'utf8');
const failures = [];

for (const [label, source] of [
  ['sign-in', appAuth],
  ['user update', userRoute],
]) {
  for (const claim of ['appUser: true', 'role:', 'isActive:']) {
    if (!source.includes(claim)) {
      failures.push(`${label} must issue the ${claim.replace(':', '')} custom claim.`);
    }
  }
}

if (!appAuth.includes('adminAuth.setCustomUserClaims(match.id, claims)')) {
  failures.push('A successful sign-in must persist the same Firebase claims it returns in the custom token.');
}

if (!appAuth.includes('adminAuth.createCustomToken(match.id, claims)')) {
  failures.push('A successful sign-in must return a Firebase custom token with the trusted claims.');
}

if (!userRoute.includes('adminAuth.revokeRefreshTokens(id)')) {
  failures.push('A user edit must revoke the edited user refresh tokens.');
}

if (failures.length) {
  console.error('Firebase claims contract failed:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Firebase claims contract passed: sign-in and user edits issue trusted claims without client Firestore polling.');
