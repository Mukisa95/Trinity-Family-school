/**
 * Run with: npx tsx src/lib/utils/__tests__/assignment-term-push.test.ts
 */
import type { AcademicYear, PupilAssignedFee } from '@/types';
import {
  getAssignmentPushFetchOptions,
  applyAssignmentToTerm,
  validatePushTarget,
  getNextTermInSameYear,
  getAssignmentPrimaryTermRef,
} from '../assignment-term-push';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const refDate = new Date('2026-03-15'); // mid Term 1 2026

const academicYears: AcademicYear[] = [
  {
    id: 'year-2025',
    name: '2025',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    isLocked: true,
    terms: [
      { id: 't25-1', name: 'Term 1', startDate: '2025-01-01', endDate: '2025-04-30' },
      { id: 't25-2', name: 'Term 2', startDate: '2025-05-01', endDate: '2025-08-31' },
      { id: 't25-3', name: 'Term 3', startDate: '2025-09-01', endDate: '2025-12-31' },
    ],
  },
  {
    id: 'year-2026',
    name: '2026',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    isActive: true,
    isLocked: false,
    terms: [
      { id: 't26-1', name: 'Term 1', startDate: '2026-01-01', endDate: '2026-04-30' },
      { id: 't26-2', name: 'Term 2', startDate: '2026-05-01', endDate: '2026-08-31' },
      { id: 't26-3', name: 'Term 3', startDate: '2026-09-01', endDate: '2026-12-31' },
    ],
  },
];

const baseAssignment: PupilAssignedFee = {
  id: 'a1',
  feeStructureId: 'fee-1',
  assignedAt: '2026-01-01',
  status: 'active',
  validityType: 'specific_terms',
  startAcademicYearId: 'year-2026',
  termApplicability: 'specific_terms',
  applicableTermIds: ['t26-1'],
  statusHistory: [],
};

// Push: assignment on current term → next term in same year
{
  const opts = getAssignmentPushFetchOptions(baseAssignment, academicYears, refDate);
  assert(opts.push !== null, 'push should be available');
  assert(opts.push!.target.termId === 't26-2', 'push target should be Term 2 2026');
  assert(opts.fetch === null, 'fetch should not show when aligned with current term');
}

// Fetch: assignment on Term 1 while effective period is Term 2
{
  const term2Date = new Date('2026-06-01');
  const behind: PupilAssignedFee = { ...baseAssignment, applicableTermIds: ['t26-1'] };
  const opts = getAssignmentPushFetchOptions(behind, academicYears, term2Date);
  assert(opts.fetch !== null, 'fetch should be available when assignment is behind');
  assert(opts.fetch!.target.termId === 't26-2', 'fetch should target current term');
  assert(opts.push === null, 'push should not show when behind current term');
}

// validatePushTarget rejects locked year and ended term
{
  const locked = validatePushTarget('year-2025', 't25-2', academicYears, refDate);
  assert(!locked.valid, 'locked year should be rejected');

  const endedTerm = validatePushTarget('year-2026', 't26-1', academicYears, new Date('2026-06-01'));
  assert(!endedTerm.valid, 'ended term should be rejected as target');
}

// applyAssignmentToTerm updates fields and history
{
  const updated = applyAssignmentToTerm(
    baseAssignment,
    'year-2026',
    't26-2',
    academicYears,
    'push',
    refDate
  );
  assert(updated.validityType === 'specific_terms', 'validity becomes specific_terms');
  assert(updated.applicableTermIds?.[0] === 't26-2', 'term id updated');
  assert(
    updated.statusHistory?.some((h) => h.action === 'term_pushed') === true,
    'history records push'
  );
}

// No push from last term in year
{
  const lastTerm: PupilAssignedFee = {
    ...baseAssignment,
    applicableTermIds: ['t26-3'],
  };
  const ref = getAssignmentPrimaryTermRef(lastTerm, academicYears, new Date('2026-10-01'));
  assert(ref !== null, 'primary term resolves');
  if (ref) {
    assert(getNextTermInSameYear(ref) === null, 'Term 3 has no next term in same year');
  }
}

console.log('assignment-term-push tests passed');
