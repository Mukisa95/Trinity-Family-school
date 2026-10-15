const { execFileSync } = require('node:child_process');

// Vercel's ignored-build contract: 0 skips, 1 builds. Unknown history must build.
function affectsWebDeployment(file) {
  // Markdown inside src/public may be shipped content; only root documents
  // and known non-web directories are safe to ignore.
  return !((!file.includes('/') && /\.md$/i.test(file)) || /^(docs|reports|android-app|\.codex|\.agents)\//.test(file));
}

function shouldSkipBuild(env = process.env, git = (args) => execFileSync('git', args, { encoding: 'utf8' })) {
  if (env.VERCEL_FORCE_BUILD === '1') return false;
  if (env.VERCEL_ENV === 'preview') return env.VERCEL_GIT_COMMIT_REF !== 'codex/application-performance';
  const previous = env.VERCEL_GIT_PREVIOUS_SHA;
  const current = env.VERCEL_GIT_COMMIT_SHA;
  if (!previous || !current || previous === current) return false;
  try {
    // Compare against the last successful deployment, not just the last commit:
    // an intervening documentation commit must not hide unshipped app changes.
    const files = git(['diff', '--name-only', '--no-renames', '-z', previous, current, '--']).split('\0').filter(Boolean);
    return files.length > 0 && files.every(file => !affectsWebDeployment(file));
  } catch {
    return false;
  }
}

if (require.main === module) {
  const skip = shouldSkipBuild();
  console.log(skip ? 'Skipping preview or documentation/native-only build.' : 'Building: application changes, explicit override, or unknown deployment history.');
  process.exit(skip ? 0 : 1);
}

module.exports = { affectsWebDeployment, shouldSkipBuild };
