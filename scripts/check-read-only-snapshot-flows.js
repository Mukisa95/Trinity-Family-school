const { execFileSync } = require('child_process');

const output = execFileSync(
  'rg',
  ['-l', 'getOrCreateSnapshot\\(', 'src', '--glob', '*.ts', '--glob', '*.tsx'],
  { encoding: 'utf8' },
).trim();

const allowed = new Set(['src/lib/services/pupil-snapshots.service.ts']);
const offenders = output
  .split(/\r?\n/)
  .filter(Boolean)
  .map(file => file.replace(/\\/g, '/'))
  .filter(file => !allowed.has(file));

if (offenders.length) {
  console.error('Read-only data flows must not create snapshots:');
  offenders.forEach(file => console.error(`- ${file}`));
  process.exit(1);
}

console.log('Read-only snapshot contract passed: snapshot creation is confined to the lifecycle service.');
