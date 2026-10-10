import test from 'node:test';
import assert from 'node:assert/strict';
import { readWelcomeDraft, welcomeDraftKey, type PrivacyChoices } from '../src/lib/startup/welcome-preferences';
const initial: PrivacyChoices = { enabled: false, action: 'lock-on-close', deviceUnlock: false };

test('corrupt or absent drafts preserve current privacy settings', () => {
  for (const value of [null, 'broken', '{}', 'null', '[]']) {
    assert.deepEqual(readWelcomeDraft(value, initial), { step: 0, privacy: initial });
  }
});
test('resumes a valid step and keeps a saved device-unlock preference', () => {
  const saved = { step: 2, privacy: { enabled: true, action: 'lock-on-leave', deviceUnlock: true } };
  assert.deepEqual(readWelcomeDraft(JSON.stringify(saved), initial), saved);
  assert.equal(readWelcomeDraft(JSON.stringify({ step: 900 }), initial).step, 3);
});
test('signout cannot combine with local device-unlock and no credentials enter the draft', () => {
  const result = readWelcomeDraft(JSON.stringify({ step: 1, password: 'never-retain', privacy: { enabled: true, action: 'signout', deviceUnlock: true, credential: 'secret' } }), initial);
  assert.deepEqual(result, { step: 1, privacy: { enabled: true, action: 'signout', deviceUnlock: false } });
  assert.ok(!JSON.stringify(result).includes('secret'));
  assert.ok(!JSON.stringify(result).includes('never-retain'));
  assert.notEqual(welcomeDraftKey('account-a'), welcomeDraftKey('account-b'));
});
