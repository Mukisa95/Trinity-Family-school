const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldSkipBuild } = require('../scripts/vercel-ignore-build.cjs');
const env = { VERCEL_ENV: 'production', VERCEL_GIT_PREVIOUS_SHA: 'previous-release', VERCEL_GIT_COMMIT_SHA: 'current-release' };

test('documentation and native-only changes skip the web build', () => {
  assert.equal(shouldSkipBuild(env, () => 'README.md\0docs/setup.txt\0android-app/app/build.gradle\0'), true);
});
test('web changes accumulated since the last deployment still build', () => {
  assert.equal(shouldSkipBuild(env, args => {
    assert.deepEqual(args, ['diff', '--name-only', '--no-renames', '-z', 'previous-release', 'current-release', '--']);
    return 'README.md\0src/app/page.tsx\0';
  }), false);
});
test('APK download assets, public files and build configuration still build', () => {
  for (const file of ['android-releases/school.apk', 'public/logo.png', 'public/help.md', 'src/content/help.md', 'vercel.json', 'scripts/vercel-ignore-build.cjs']) {
    assert.equal(shouldSkipBuild(env, () => file + '\0'), false);
  }
});
test('missing, equal or unavailable history builds safely', () => {
  assert.equal(shouldSkipBuild({}, () => ''), false);
  assert.equal(shouldSkipBuild({ ...env, VERCEL_GIT_PREVIOUS_SHA: 'current-release' }, () => ''), false);
  assert.equal(shouldSkipBuild(env, () => { throw new Error('shallow clone'); }), false);
  assert.equal(shouldSkipBuild(env, () => ''), false);
});
test('automatic previews skip but explicit force override builds', () => {
  assert.equal(shouldSkipBuild({ ...env, VERCEL_ENV: 'preview' }), true);
  assert.equal(shouldSkipBuild({ ...env, VERCEL_ENV: 'preview', VERCEL_FORCE_BUILD: '1' }), false);
});
