// Run after next build: optional editing/rendering tools must stay out of startup.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const zlib = require('node:zlib');
const initial = JSON.parse(fs.readFileSync('.next/app-build-manifest.json')).pages['/pupils/page'];
const deferred = JSON.parse(fs.readFileSync('.next/react-loadable-manifest.json'));
assert.ok(initial?.length, 'Build the Pupils route before checking its startup chunks');
for (const suffix of [
  'use-pdf-viewer.tsx -> @react-pdf/renderer',
  'pupil-photo-detail.tsx -> @/components/ui/photo-crop-editor',
]) {
  const entry = Object.entries(deferred).find(([key]) => key.endsWith(suffix));
  assert.ok(entry, `${suffix} must have a deferred entry`);
  const files = entry[1].files.filter(file => file.endsWith('.js'));
  assert.ok(files.length, `${suffix} must have JavaScript chunks`);
  assert.deepEqual(files.filter(file => initial.includes(file)), [], `${suffix} must not block Pupils startup`);
}
const bytes = initial.filter(file => file.endsWith('.js')).reduce((total, file) =>
  total + zlib.gzipSync(fs.readFileSync('.next/' + file)).length, 0);
console.log(`PUPILS_STARTUP_BUNDLE_OK: optional tools deferred; route manifest JavaScript ${(bytes / 1024).toFixed(1)} KiB gzip.`);
