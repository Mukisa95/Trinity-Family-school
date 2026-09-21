import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const route = readFileSync('src/app/api/auth/passkey/route.ts', 'utf8');
const login = readFileSync('src/app/login/page.tsx', 'utf8');
const parentSettings = readFileSync('src/app/parent/settings/page.tsx', 'utf8');
const accountSettings = readFileSync('src/app/settings/account/page.tsx', 'utf8');
const authGuard = readFileSync('src/components/common/AuthGuard.tsx', 'utf8');
const sessionResumeModal = readFileSync('src/components/common/SessionResumeModal.tsx', 'utf8');
const autoLockSettings = readFileSync('src/components/settings/auto-lock-settings.tsx', 'utf8');
const passkeySettings = readFileSync('src/components/settings/passkey-settings.tsx', 'utf8');
const passkeyService = readFileSync('src/lib/services/passkey.service.ts', 'utf8');

test('passkeys remain in the existing recursive server-only credential namespace', () => {
  assert.match(route, /collection\('authCredentials'\)\.doc\('passkeys'\)/);
  assert.doesNotMatch(route, /collection\('authPasskeys'/);
  assert.match(route, /transaction\.delete\(ref\)/, 'a challenge must be consumed before verification');
});

test('device verification is required and enrollment requires the signed user password', () => {
  assert.ok((route.match(/requireUserVerification:\s*true/g) || []).length >= 2);
  assert.match(route, /requireAppUser\(request\)/);
  assert.match(route, /verifyLegacyCredentials\(actor\.user\.username, parsed\.password\)/);
});

test('all account roles receive enrollment settings and one shared login action', () => {
  assert.match(login, /loginWithPasskey/);
  assert.match(parentSettings, /<PasskeySettings \/>/);
  assert.match(accountSettings, /<PasskeySettings \/>/);
});

test('the privacy lock can require local device verification without a network request', () => {
  assert.match(parentSettings, /<AutoLockSettings \/>/);
  assert.match(accountSettings, /deviceUnlockForAutoLock/);
  assert.match(autoLockSettings, /Require device unlock/);
  assert.match(authGuard, /unlockLocalSession\(user\.id\)/);
  assert.match(passkeyService, /userVerification:\s*'required'/);
  const localUnlock = passkeyService.slice(passkeyService.indexOf('async unlockLocalSession'));
  assert.doesNotMatch(localUnlock.split('async signIn')[0], /requestPasskey\(/);
});

test('passkey settings wait for restored Firebase auth and recover an existing authenticator', () => {
  assert.match(passkeyService, /if \(authenticated\) await auth\.authStateReady\(\)/);
  assert.match(passkeyService, /ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED/);
  assert.match(passkeySettings, /PasskeyService\.isPreviouslyRegisteredError\(error\)/);
  assert.match(passkeySettings, /This device unlock was already registered and is ready to use\./);
  assert.match(passkeySettings, /Check status/);
  assert.doesNotMatch(passkeySettings, /Try again online/);
});

test('the biometric privacy-lock preference survives settings remounts', () => {
  assert.match(autoLockSettings, /useState<boolean \| null>\(null\)/);
  assert.doesNotMatch(autoLockSettings, /deviceUnlockForAutoLock && \(!deviceUnlockAvailable/);
  assert.match(autoLockSettings, /deviceUnlockForAutoLock && autoLockAction === 'signout'/);
  assert.match(autoLockSettings, /disabled=\{deviceUnlockAvailable !== true\}/);
});

test('a locked parent must unlock before account actions become available', () => {
  assert.match(authGuard, /const isParent = user\?\.role === 'Parent'/);
  assert.match(authGuard, /onSwitchUser=\{isParent \? undefined : handleSwitchUser\}/);
  assert.match(authGuard, /onSignOut=\{isParent \? undefined : handleSignOut\}/);
  assert.match(sessionResumeModal, /\{\(onSwitchUser \|\| onSignOut\) && \(/);
});
