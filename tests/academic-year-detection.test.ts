import test from 'node:test';
import assert from 'node:assert/strict';

import {
  detectCurrentAcademicYear,
  detectCurrentTerm,
} from '../src/lib/utils/academic-year-utils';
import type { AcademicYear } from '../src/types';

const years: AcademicYear[] = [
  {
    id: '2025',
    name: '2025',
    startDate: '2025-02-03',
    endDate: '2025-12-05',
    isActive: true,
    isLocked: false,
    terms: [
      { id: '2025-term-1', name: 'Term 1', startDate: '2025-02-03', endDate: '2025-05-02', isCurrent: true },
      { id: '2025-term-2', name: 'Term 2', startDate: '2025-05-26', endDate: '2025-08-22' },
      { id: '2025-term-3', name: 'Term 3', startDate: '2025-09-15', endDate: '2025-12-05' },
    ],
  },
  {
    id: '2026',
    name: '2026',
    startDate: '2026-02-02',
    endDate: '2026-12-04',
    isActive: false,
    isLocked: false,
    terms: [
      { id: '2026-term-1', name: 'Term 1', startDate: '2026-02-02', endDate: '2026-05-01' },
      { id: '2026-term-2', name: 'Term 2', startDate: '2026-05-25', endDate: '2026-08-21' },
      { id: '2026-term-3', name: 'Term 3', startDate: '2026-09-14', endDate: '2026-12-04' },
    ],
  },
];

test('20 September 2026 selects the dated 2026 year instead of a stale active 2025 flag', () => {
  const today = new Date('2026-09-20T12:00:00+03:00');
  const currentYear = detectCurrentAcademicYear(years, today);

  assert.equal(currentYear?.id, '2026');
  assert.equal(detectCurrentTerm(currentYear, today)?.id, '2026-term-3');
});

test('a recess date keeps the enclosing year and most recently completed term', () => {
  const recessDate = new Date('2026-09-01T12:00:00+03:00');
  const currentYear = detectCurrentAcademicYear(years, recessDate);

  assert.equal(currentYear?.id, '2026');
  assert.equal(detectCurrentTerm(currentYear, recessDate)?.id, '2026-term-2');
});

test('isActive remains a fallback when no valid dates can identify a year', () => {
  const incompleteYears: AcademicYear[] = years.map(year => ({
    ...year,
    startDate: '',
    endDate: '',
    terms: [],
  }));

  assert.equal(
    detectCurrentAcademicYear(incompleteYears, new Date('2026-09-20T12:00:00+03:00'))?.id,
    '2025',
  );
});
