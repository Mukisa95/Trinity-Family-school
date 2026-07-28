const assert = require('assert');
const fs = require('fs');

const authContext = fs.readFileSync('src/lib/contexts/auth-context.tsx', 'utf8');
const userRoute = fs.readFileSync('src/app/api/users/[id]/route.ts', 'utf8');
const resumeModal = fs.readFileSync('src/components/common/SessionResumeModal.tsx', 'utf8');

assert(
  !authContext.includes('SecureAuthService.verifyCredentials'),
  'Auto-lock resume must not verify username/password.',
);
assert(
  !authContext.includes('firebase/firestore'),
  'AuthContext session restoration must not read Firestore.',
);
assert(
  authContext.includes('void revalidateSignedSession(false)'),
  'Resume must validate the existing signed token without forcing a network refresh.',
);

const resumeFunctionStart = authContext.indexOf('const resumeSession');
const resumeFunctionEnd = authContext.indexOf(
  'const handleSetAutoLockEnabled',
  resumeFunctionStart,
);
const resumeFunction = authContext.slice(resumeFunctionStart, resumeFunctionEnd);
const localUnlock = resumeFunction.indexOf('setIsLocked(false)');
assert(
  localUnlock !== -1 && !resumeFunction.includes('revalidateSignedSession(true)'),
  'Resume must clear the local privacy screen without forcing authentication.',
);
assert(
  authContext.includes('window.setInterval(') &&
    authContext.includes('void revalidateSignedSession(true)'),
  'Revocation must be checked on the bounded background Firebase Auth schedule.',
);

assert(
  userRoute.includes('await adminAuth.revokeRefreshTokens(id)'),
  'Every user edit must revoke the affected refresh session.',
);
assert(
  userRoute.includes('await adminAuth.updateUser(id, { disabled: shouldDisable })'),
  'User active status must be synchronized with Firebase Authentication.',
);
assert(
  resumeModal.includes('Resume without entering your password again.'),
  'The lock UI must explain the password-free resume behavior.',
);

console.log(
  'Auth flow assertions passed: zero-read resume, background revocation check, and edit-triggered invalidation.',
);
