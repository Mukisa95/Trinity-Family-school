const assert = require('assert');
const fs = require('fs');

const authContext = fs.readFileSync('src/lib/contexts/auth-context.tsx', 'utf8');
const userRoute = fs.readFileSync('src/app/api/users/[id]/route.ts', 'utf8');
const resumeModal = fs.readFileSync('src/components/common/SessionResumeModal.tsx', 'utf8');
const appAuth = fs.readFileSync('src/lib/server/app-auth.ts', 'utf8');

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
assert(
  authContext.includes('const finishInitialAuthCheck')
    && authContext.includes('finishInitialAuthCheck();\n                return;'),
  'Transient Firebase token recovery must finish the initial app boot state.',
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

assert(
  appAuth.includes("process.env.EMERGENCY_ADMIN_PASSWORD") &&
    appAuth.includes("process.env.EMERGENCY_ADMIN_ENABLED") &&
    appAuth.includes('createCustomToken(EMERGENCY_ADMIN_UID, claims)'),
  'Emergency administrator access must use an enabled server secret and a signed Firebase token.',
);
assert(
  !appAuth.includes("EMERGENCY_ADMIN_PASSWORD || 'admin123'") &&
    !appAuth.includes("EMERGENCY_ADMIN_PASSWORD ?? 'admin123'"),
  'Emergency administrator access must never hard-code a default password.',
);

console.log(
  'Auth flow assertions passed: zero-read resume, background revocation check, and edit-triggered invalidation.',
);
