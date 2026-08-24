import assert from 'node:assert/strict';
import test from 'node:test';
import type { AcademicYear, PupilAssignedFee } from '@/types';
import {
  consolidatePupilFeeAssignments,
  hasValidFeeAssignment,
  upsertPupilFeeAssignment,
} from '@/lib/utils/fee-assignment-pipeline';

const academicYears: AcademicYear[] = [
  {
    id: 'year-2026',
    name: '2026',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    isLocked: false,
    terms: [
      { id: 'term-1', name: 'Term 1', startDate: '2026-01-01', endDate: '2026-04-30' },
      { id: 'term-2', name: 'Term 2', startDate: '2026-05-01', endDate: '2026-08-20' },
      { id: 'term-3', name: 'Term 3', startDate: '2026-09-01', endDate: '2026-12-01' },
    ],
  },
];

function assignment(id: string, termIds: string[]): PupilAssignedFee {
  return {
    id,
    feeStructureId: 'assignment-fee-1',
    assignedAt: '2026-01-01T00:00:00.000Z',
    assignedBy: 'tester',
    status: 'active',
    validityType: 'specific_terms',
    startAcademicYearId: 'year-2026',
    termApplicability: 'specific_terms',
    applicableTermIds: termIds,
    statusHistory: [],
  };
}

test('assignment-page upsert extends an existing assignment without overlap', () => {
  const original = assignment('original', ['term-1']);
  const incoming = assignment('incoming', ['term-1', 'term-2']);

  const result = upsertPupilFeeAssignment([original], incoming, academicYears, 'tester');

  assert.equal(result.outcome, 'merged');
  assert.equal(result.assignments.length, 1);
  assert.equal(result.assignment.id, 'original');
  assert.deepEqual(result.assignment.applicableTermIds, ['term-1', 'term-2']);
});

test('collection eligibility checks every matching assignment, not only the first', () => {
  const duplicates = [
    assignment('old-term-one', ['term-1']),
    assignment('new-term-two', ['term-2']),
  ];

  assert.equal(
    hasValidFeeAssignment(
      duplicates,
      'assignment-fee-1',
      'year-2026',
      'term-2',
      academicYears,
    ),
    true,
  );
});

test('legacy duplicate records consolidate into one union of term coverage', () => {
  const duplicates = [
    assignment('original', ['term-1']),
    assignment('duplicate', ['term-1', 'term-2']),
  ];

  const consolidated = consolidatePupilFeeAssignments(duplicates, academicYears, 'tester');

  assert.equal(consolidated.length, 1);
  assert.equal(consolidated[0].id, 'original');
  assert.deepEqual(consolidated[0].applicableTermIds, ['term-1', 'term-2']);
  assert.equal(
    consolidated[0].statusHistory?.at(-1)?.action,
    'time_adjusted',
  );
});

test('an already-covered term is a no-op and does not create another record', () => {
  const original = assignment('original', ['term-1', 'term-2']);
  const incoming = assignment('incoming', ['term-2']);

  const result = upsertPupilFeeAssignment([original], incoming, academicYears, 'tester');

  assert.equal(result.outcome, 'unchanged');
  assert.equal(result.assignments.length, 1);
  assert.deepEqual(result.assignment.applicableTermIds, ['term-1', 'term-2']);
});
