const { spawnSync } = require('node:child_process');
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Use firebase emulators:exec to run this script.');
for (const args of [
  ['--test', 'tests/staff-clocking-server.test.mjs'],
  ['--test', '--test-name-pattern=staff clocking', 'tests/firestore.rules.test.mjs'],
]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status || 1);
}
