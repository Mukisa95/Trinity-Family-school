const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const navigation = read('src/config/nav.ts');
const permissions = read('src/types/permissions.ts');
const photosPage = read('src/app/photos/page.tsx');
const dashboard = read('src/app/page.tsx');
const parentDashboard = read('src/components/parent/parent-about-school.tsx');
const viewer = read('src/components/common/photo-viewer-dialog.tsx');

assert.match(navigation, /title:\s*'Photos'[\s\S]*?href:\s*'\/photos'/, 'Photos must be present in navigation');
assert.match(permissions, /moduleId:\s*'settings'[\s\S]*?pattern:\s*\/\^\\\/photos\$\//, 'Photos must reuse the existing settings page permission');
assert.match(photosPage, /<SlidesManager\s*\/>/, 'Photos page must render the existing manager');

for (const [name, source] of [
  ['main dashboard', dashboard],
  ['parent dashboard', parentDashboard],
]) {
  assert.match(source, /<PhotoViewerDialog/, `${name} must render the responsive photo viewer`);
  assert.match(source, /aria-label=\{`Open \$\{activePhotos\[currentSlide\]/, `${name} photo must be an accessible viewer trigger`);
}

assert.match(viewer, /<DialogTitle>/, 'Photo viewer must have an accessible title');
assert.match(viewer, /<DialogDescription>/, 'Photo viewer must have an accessible description');
assert.match(viewer, /aria-label="Show previous photo"/, 'Photo viewer must expose previous navigation');
assert.match(viewer, /aria-label="Show next photo"/, 'Photo viewer must expose next navigation');
assert.match(viewer, /max-h-\[calc\(100dvh-5rem\)\]/, 'Photo viewer image must fit the active device viewport');
assert.match(parentDashboard, /aria-label="Show previous dashboard photo"/, 'Parent slideshow must preserve previous-photo navigation');
assert.match(parentDashboard, /aria-label="Show next dashboard photo"/, 'Parent slideshow must preserve next-photo navigation');

console.log('Photo navigation and viewer contract checks passed.');
