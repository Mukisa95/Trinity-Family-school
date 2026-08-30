import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeSmartBackHistory,
  reconcileSmartBackHistory,
  resolveSmartBackTarget,
  sanitizeInternalAppRoute,
} from '../src/lib/navigation/smart-back-history';

assert.equal(sanitizeInternalAppRoute('https://example.com/empty'), null);
assert.equal(sanitizeInternalAppRoute('//example.com/empty'), null);
assert.equal(sanitizeInternalAppRoute('/login'), null);
assert.equal(sanitizeInternalAppRoute('/pupil-detail?id=pupil-1'), '/pupil-detail?id=pupil-1');

let history = reconcileSmartBackHistory([], '/pupils?class=p1');
history = reconcileSmartBackHistory(history, '/pupil-detail?id=pupil-1');
history = reconcileSmartBackHistory(history, '/class-detail?id=class-1');

const classToPupil = resolveSmartBackTarget(history, '/class-detail?id=class-1', '/classes');
assert.equal(classToPupil.target, '/pupil-detail?id=pupil-1');
assert.deepEqual(classToPupil.history, ['/pupils?class=p1', '/pupil-detail?id=pupil-1']);

const queryChange = reconcileSmartBackHistory(
  ['/pupils', '/class-detail?id=class-1'],
  '/class-detail?id=class-2',
);
assert.deepEqual(queryChange, ['/pupils', '/class-detail?id=class-2']);

const nativeBack = reconcileSmartBackHistory(
  ['/pupils', '/pupil-detail?id=pupil-1', '/class-detail?id=class-1'],
  '/pupil-detail?id=pupil-1',
);
assert.deepEqual(nativeBack, ['/pupils', '/pupil-detail?id=pupil-1']);

const unsafeHistory = normalizeSmartBackHistory([
  'https://example.com/empty',
  '/login',
  '/pupils',
  '//example.com',
]);
assert.deepEqual(unsafeHistory, ['/pupils']);

const fallback = resolveSmartBackTarget(['/class-detail?id=class-1'], '/class-detail?id=class-1', '/classes');
assert.equal(fallback.target, '/classes');
assert.equal(fallback.usedFallback, true);

const smartButton = readFileSync('src/components/common/SmartBackButton.tsx', 'utf8');
const glassTopBar = readFileSync('src/components/common/glass-page-top-bar.tsx', 'utf8');
assert.ok(smartButton.includes('goBack(fallbackHref)'));
assert.ok(!smartButton.includes('window.history.length'));
assert.ok(glassTopBar.includes('<SmartBackButton'));

[
  'src/app/settings/account/page.tsx',
  'src/app/requirement-tracking/page.tsx',
  'src/app/boarding/dormitory/[id]/page.tsx',
  'src/app/pupils/edit/page.tsx',
  'src/app/pupil-detail/swipeable-page.tsx',
  'src/app/parent/settings/page.tsx',
  'src/app/exams/[examId]/pupil-results/[pupilId]/PupilResultsClient.tsx',
  'src/components/events/attendance/view-attendance-page.tsx',
  'src/app/exams/[examId]/edit-snapshot/EditSnapshotView.tsx',
  'src/app/exams/ple-results/pupil/[pupilId]/[pleId]/page.tsx',
  'src/components/events/attendance/attendance-recording-page.tsx',
].forEach((file) => {
  assert.ok(!readFileSync(file, 'utf8').includes('router.back()'), `${file} must use the shared smart back action.`);
});

console.log('Smart back navigation contract passed.');
