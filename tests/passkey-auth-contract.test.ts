import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const route = readFileSync('src/app/api/auth/passkey/route.ts', 'utf8');
const login = readFileSync('src/app/login/page.tsx', 'utf8');
const parentSettings = readFileSync('src/app/parent/settings/page.tsx', 'utf8');
const accountSettings = readFileSync('src/app/settings/account/page.tsx', 'utf8');

test('passkeys remain in the existing recursive server-only credential namespace', () => {
  assert.match(route, /collection\('authCredentials'\)\.doc\('__passkeys__'\)/);
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
