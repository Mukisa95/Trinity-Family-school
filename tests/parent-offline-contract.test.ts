import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PARENT_OFFLINE_FAMILY_SCHEMA,
  PARENT_OFFLINE_BANKING_SCHEMA,
  PARENT_OFFLINE_ATTENDANCE_SCHEMA,
  PARENT_OFFLINE_RESULTS_SCHEMA,
  PARENT_OFFLINE_FEES_SCHEMA,
  isParentOfflineAttendanceSnapshot,
  isParentOfflineBankingSnapshot,
  isParentOfflineFamilySnapshot,
  isParentOfflineResultsSnapshot,
  isParentOfflineFeesSnapshot,
} from '../src/lib/parent-offline/contracts';
import { PARENT_OFFLINE_APP_ROUTES } from '../src/lib/parent-offline/app-shell';
import { shouldRefreshParentAppRelease } from '../src/lib/parent-offline/app-release';

const pupil = {
  id: 'pupil-a',
  firstName: 'Amina',
  lastName: 'Namakula',
  admissionNumber: 'TFS-001',
  gender: 'Female' as const,
  classId: 'p1',
  section: 'Day' as const,
  status: 'Active' as const,
  guardians: [],
  createdAt: '2026-09-20T08:00:00.000Z',
};

test('a parent offline family snapshot is tied to the signed-in account', () => {
  const snapshot = {
    schema: PARENT_OFFLINE_FAMILY_SCHEMA,
    accountId: 'parent-a',
    preparedAt: '2026-09-20T08:00:00.000Z',
    pupils: [pupil],
  };

  assert.equal(isParentOfflineFamilySnapshot(snapshot, 'parent-a'), true);
  assert.equal(isParentOfflineFamilySnapshot(snapshot, 'parent-b'), false);
});

test('a partial or malformed record is never accepted as an offline family snapshot', () => {
  assert.equal(isParentOfflineFamilySnapshot({ accountId: 'parent-a', pupils: [pupil] }, 'parent-a'), false);
  assert.equal(isParentOfflineFamilySnapshot({
    schema: PARENT_OFFLINE_FAMILY_SCHEMA,
    accountId: 'parent-a',
    preparedAt: 'now',
    pupils: [{}],
  }, 'parent-a'), false);
});

test('only a complete banking response can state that a child has no account offline', () => {
  const savedNoAccount = {
    schema: PARENT_OFFLINE_BANKING_SCHEMA,
    key: 'parent-a:pupil-a',
    accountId: 'parent-a',
    pupilId: 'pupil-a',
    revision: 7,
    preparedAt: '2026-09-20T08:00:00.000Z',
    account: null,
    transactions: [],
    loans: [],
  };

  assert.equal(isParentOfflineBankingSnapshot(savedNoAccount, 'parent-a', 'pupil-a'), true);
  assert.equal(isParentOfflineBankingSnapshot({ ...savedNoAccount, key: 'parent-a:pupil-b' }, 'parent-a', 'pupil-a'), false);
  assert.equal(isParentOfflineBankingSnapshot({ ...savedNoAccount, revision: -1 }, 'parent-a', 'pupil-a'), false);
  assert.equal(isParentOfflineBankingSnapshot({ ...savedNoAccount, transactions: [{}] }, 'parent-a', 'pupil-a'), false);
});

test('attendance snapshots are scoped to one parent and one child', () => {
  const attendance = {
    schema: PARENT_OFFLINE_ATTENDANCE_SCHEMA,
    key: 'parent-a:pupil-a:attendance',
    accountId: 'parent-a',
    pupilId: 'pupil-a',
    revision: 4,
    preparedAt: '2026-09-20T08:00:00.000Z',
    records: [{
      id: 'attendance-a',
      pupilId: 'pupil-a',
      date: '2026-09-19',
      classId: 'p1',
      status: 'Present',
      recordedAt: '2026-09-19T08:10:00.000Z',
      academicYearId: 'year-a',
      termId: 'term-a',
    }],
  };

  assert.equal(isParentOfflineAttendanceSnapshot(attendance, 'parent-a', 'pupil-a'), true);
  assert.equal(isParentOfflineAttendanceSnapshot({ ...attendance, accountId: 'parent-b' }, 'parent-a', 'pupil-a'), false);
  assert.equal(isParentOfflineAttendanceSnapshot({ ...attendance, records: [{ id: 'attendance-b', pupilId: 'pupil-b' }] }, 'parent-a', 'pupil-a'), false);
});

test('only compact released results are accepted for offline use', () => {
  const results = {
    schema: PARENT_OFFLINE_RESULTS_SCHEMA,
    key: 'parent-a:pupil-a:results',
    accountId: 'parent-a',
    pupilId: 'pupil-a',
    revision: 3,
    preparedAt: '2026-09-20T08:00:00.000Z',
    results: [{
      id: 'result-a',
      examId: 'exam-a',
      examName: 'Term One',
      subjectResults: [],
    }],
  };

  assert.equal(isParentOfflineResultsSnapshot(results, 'parent-a', 'pupil-a'), true);
  assert.equal(isParentOfflineResultsSnapshot({ ...results, key: 'parent-a:pupil-b:results' }, 'parent-a', 'pupil-a'), false);
  assert.equal(isParentOfflineResultsSnapshot({ ...results, results: [{ id: 'result-a' }] }, 'parent-a', 'pupil-a'), false);
});

test('a fee display is cached only for the selected parent, child, and term', () => {
  const fees = {
    schema: PARENT_OFFLINE_FEES_SCHEMA,
    key: 'parent-a:pupil-a:year-a:term-a:fees',
    accountId: 'parent-a',
    pupilId: 'pupil-a',
    academicYearId: 'year-a',
    termId: 'term-a',
    preparedAt: '2026-09-20T08:00:00.000Z',
    fees: [{ id: 'fee-a', name: 'Tuition', amount: 500000, paid: 200000, balance: 300000, payments: [] }],
    totals: { totalFees: 500000, totalPaid: 200000, totalBalance: 300000 },
  };

  assert.equal(isParentOfflineFeesSnapshot(fees, 'parent-a', 'pupil-a', 'year-a', 'term-a'), true);
  assert.equal(isParentOfflineFeesSnapshot({ ...fees, termId: 'term-b' }, 'parent-a', 'pupil-a', 'year-a', 'term-a'), false);
  assert.equal(isParentOfflineFeesSnapshot({ ...fees, fees: [{ id: 'fee-a', name: 'Tuition', amount: 500000, paid: 200000, balance: 300000, payments: 'not-an-array' }] }, 'parent-a', 'pupil-a', 'year-a', 'term-a'), false);
});

test('only normal parent routes are requested for automatic app-shell preparation', () => {
  assert.deepEqual(PARENT_OFFLINE_APP_ROUTES, ['/parent', '/parent/settings']);
});

test('a parent shell refresh requires a confirmed newer Firebase release', () => {
  assert.equal(shouldRefreshParentAppRelease({
    previousVersion: 'release-a',
    releasedVersion: 'release-b',
    isServerSnapshot: true,
  }), true);
  assert.equal(shouldRefreshParentAppRelease({
    previousVersion: 'release-a',
    releasedVersion: 'release-a',
    isServerSnapshot: true,
  }), false);
  assert.equal(shouldRefreshParentAppRelease({
    previousVersion: 'release-a',
    releasedVersion: 'release-b',
    isServerSnapshot: false,
  }), false);
});

test('the parent settings layout does not expose a separate offline viewer card', () => {
  const settingsSource = readFileSync('src/app/parent/settings/page.tsx', 'utf8');
  assert.doesNotMatch(settingsSource, /Offline access/);
  assert.doesNotMatch(settingsSource, /useParentOfflineStatus/);
});

test('attendance keeps its original reason dialog behind a family-verified write', () => {
  const componentSource = readFileSync('src/components/parent/pupil-attendance-section.tsx', 'utf8');
  const functionSource = readFileSync('functions/index.js', 'utf8');
  assert.match(componentSource, /<ModernDialogTitle>Please, tell us why<\/ModernDialogTitle>/);
  assert.match(componentSource, /ParentAttendanceService\.updateRemark/);
  assert.match(functionSource, /exports\.updateParentAttendanceRemark = onCall/);
  assert.match(functionSource, /userData\.role !== "Parent"/);
  assert.match(functionSource, /pupil\.data\(\)\?\.familyId !== familyId/);
  assert.match(functionSource, /attendanceRecord\.data\(\)\?\.pupilId !== pupilId/);
});
