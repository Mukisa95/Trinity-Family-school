import type { AcademicYear, PupilAssignedFee, Term, AssignmentStatusHistory } from '@/types';
import { detectCurrentAcademicYear } from '@/lib/utils/academic-year-utils';
import { getEffectiveTermForDataDisplay } from '@/lib/utils/term-status-utils';

export interface TermRef {
  yearId: string;
  termId: string;
  year: AcademicYear;
  term: Term;
}

export interface TermTarget {
  yearId: string;
  termId: string;
  label: string;
}

export type AssignmentTermMoveAction = 'push' | 'fetch' | 'custom';

export interface AssignmentPushFetchOption {
  action: AssignmentTermMoveAction;
  target: TermTarget;
  description: string;
}

export interface AssignmentPushFetchOptions {
  push: AssignmentPushFetchOption | null;
  fetch: AssignmentPushFetchOption | null;
  customTargets: TermTarget[];
  currentTermRef: TermRef | null;
  assignmentTermRef: TermRef | null;
}

function isTermActiveAt(term: Term, referenceDate: Date): boolean {
  const termStart = new Date(term.startDate);
  const termEnd = new Date(term.endDate);
  return referenceDate >= termStart && referenceDate <= termEnd;
}

function isTermEndedAt(term: Term, referenceDate: Date): boolean {
  return referenceDate > new Date(term.endDate);
}

function sortTerms(terms: Term[]): Term[] {
  return [...terms].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
}

function findTermRef(
  termId: string,
  academicYears: AcademicYear[]
): TermRef | null {
  for (const year of academicYears) {
    const term = year.terms?.find((t) => t.id === termId);
    if (term) {
      return { yearId: year.id, termId: term.id, year, term };
    }
  }
  return null;
}

export function getTermSortKey(ref: TermRef): number {
  return new Date(ref.term.startDate).getTime();
}

export function compareTermRefs(a: TermRef, b: TermRef): number {
  return getTermSortKey(a) - getTermSortKey(b);
}

export function formatTermTargetLabel(year: AcademicYear, term: Term): string {
  return `${term.name}, ${year.name}`;
}

export function isAcademicYearEnded(
  year: AcademicYear,
  referenceDate: Date = new Date()
): boolean {
  if (!year.endDate) return false;
  return referenceDate > new Date(year.endDate);
}

export function isAcademicYearClosedForTargeting(
  year: AcademicYear,
  referenceDate: Date = new Date()
): boolean {
  return year.isLocked || isAcademicYearEnded(year, referenceDate);
}

export function isTermClosedForTargeting(
  term: Term,
  referenceDate: Date = new Date()
): boolean {
  return isTermEndedAt(term, referenceDate);
}

export function validatePushTarget(
  yearId: string,
  termId: string,
  academicYears: AcademicYear[],
  referenceDate: Date = new Date()
): { valid: boolean; error?: string } {
  const year = academicYears.find((y) => y.id === yearId);
  if (!year) {
    return { valid: false, error: 'Academic year not found' };
  }
  if (isAcademicYearClosedForTargeting(year, referenceDate)) {
    return {
      valid: false,
      error: year.isLocked
        ? 'Cannot target a locked academic year'
        : 'Cannot target an ended academic year',
    };
  }

  const term = year.terms?.find((t) => t.id === termId);
  if (!term) {
    return { valid: false, error: 'Term not found in the selected year' };
  }
  if (isTermClosedForTargeting(term, referenceDate)) {
    return { valid: false, error: 'Cannot target a closed or ended term' };
  }

  return { valid: true };
}

export function getOpenTermTargets(
  academicYears: AcademicYear[],
  referenceDate: Date = new Date()
): TermTarget[] {
  const targets: TermTarget[] = [];

  const sortedYears = [...academicYears].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );

  for (const year of sortedYears) {
    if (isAcademicYearClosedForTargeting(year, referenceDate)) continue;

    for (const term of sortTerms(year.terms || [])) {
      if (isTermClosedForTargeting(term, referenceDate)) continue;
      targets.push({
        yearId: year.id,
        termId: term.id,
        label: formatTermTargetLabel(year, term),
      });
    }
  }

  return targets;
}

function resolveAssignmentTermRefs(
  assignment: PupilAssignedFee,
  academicYears: AcademicYear[],
  referenceDate: Date
): TermRef[] {
  const effective = getEffectiveTermForDataDisplay(academicYears, referenceDate);
  const currentYear =
    detectCurrentAcademicYear(academicYears) ?? effective.academicYear ?? undefined;

  const refs: TermRef[] = [];

  const addTermIds = (termIds: string[]) => {
    for (const termId of termIds) {
      const ref = findTermRef(termId, academicYears);
      if (ref) refs.push(ref);
    }
  };

  switch (assignment.validityType) {
    case 'current_term': {
      if (assignment.applicableTermIds?.length) {
        addTermIds(assignment.applicableTermIds);
      } else if (effective.term && effective.academicYear) {
        refs.push({
          yearId: effective.academicYear.id,
          termId: effective.term.id,
          year: effective.academicYear,
          term: effective.term,
        });
      }
      break;
    }
    case 'current_year': {
      const yearId = assignment.startAcademicYearId ?? currentYear?.id;
      const year = academicYears.find((y) => y.id === yearId);
      if (year) {
        if (assignment.termApplicability === 'specific_terms' && assignment.applicableTermIds?.length) {
          addTermIds(assignment.applicableTermIds);
        } else {
          for (const term of sortTerms(year.terms || [])) {
            refs.push({ yearId: year.id, termId: term.id, year, term });
          }
        }
      }
      break;
    }
    case 'specific_year': {
      const year = academicYears.find((y) => y.id === assignment.startAcademicYearId);
      if (year) {
        if (assignment.termApplicability === 'specific_terms' && assignment.applicableTermIds?.length) {
          addTermIds(assignment.applicableTermIds);
        } else {
          for (const term of sortTerms(year.terms || [])) {
            refs.push({ yearId: year.id, termId: term.id, year, term });
          }
        }
      }
      break;
    }
    case 'specific_terms':
      addTermIds(assignment.applicableTermIds || []);
      break;
    case 'year_range':
    case 'indefinite':
    default:
      if (assignment.termApplicability === 'specific_terms' && assignment.applicableTermIds?.length) {
        addTermIds(assignment.applicableTermIds);
      } else if (effective.term && effective.academicYear) {
        refs.push({
          yearId: effective.academicYear.id,
          termId: effective.term.id,
          year: effective.academicYear,
          term: effective.term,
        });
      }
      break;
  }

  const unique = new Map<string, TermRef>();
  for (const ref of refs) {
    unique.set(`${ref.yearId}:${ref.termId}`, ref);
  }
  return [...unique.values()].sort(compareTermRefs);
}

export function getAssignmentPrimaryTermRef(
  assignment: PupilAssignedFee,
  academicYears: AcademicYear[],
  referenceDate: Date = new Date()
): TermRef | null {
  const refs = resolveAssignmentTermRefs(assignment, academicYears, referenceDate);
  if (refs.length === 0) return null;
  return refs[refs.length - 1];
}

export function getNextTermInSameYear(
  termRef: TermRef
): TermRef | null {
  const sorted = sortTerms(termRef.year.terms || []);
  const index = sorted.findIndex((t) => t.id === termRef.termId);
  if (index < 0 || index >= sorted.length - 1) return null;

  const nextTerm = sorted[index + 1];
  return {
    yearId: termRef.yearId,
    termId: nextTerm.id,
    year: termRef.year,
    term: nextTerm,
  };
}

export function getAssignmentPushFetchOptions(
  assignment: PupilAssignedFee,
  academicYears: AcademicYear[],
  referenceDate: Date = new Date()
): AssignmentPushFetchOptions {
  const customTargets = getOpenTermTargets(academicYears, referenceDate);

  const effective = getEffectiveTermForDataDisplay(academicYears, referenceDate);
  const currentTermRef: TermRef | null =
    effective.term && effective.academicYear
      ? {
          yearId: effective.academicYear.id,
          termId: effective.term.id,
          year: effective.academicYear,
          term: effective.term,
        }
      : null;

  const assignmentTermRef = getAssignmentPrimaryTermRef(
    assignment,
    academicYears,
    referenceDate
  );

  let push: AssignmentPushFetchOption | null = null;
  let fetch: AssignmentPushFetchOption | null = null;

  if (currentTermRef && assignmentTermRef) {
    const sameTerm =
      currentTermRef.yearId === assignmentTermRef.yearId &&
      currentTermRef.termId === assignmentTermRef.termId;

    const stillInCurrentTerm =
      isTermActiveAt(currentTermRef.term, referenceDate) ||
      (isTermActiveAt(assignmentTermRef.term, referenceDate) && sameTerm);

    if (sameTerm && stillInCurrentTerm) {
      const nextRef = getNextTermInSameYear(currentTermRef);
      if (nextRef) {
        const validation = validatePushTarget(
          nextRef.yearId,
          nextRef.termId,
          academicYears,
          referenceDate
        );
        if (validation.valid) {
          push = {
            action: 'push',
            target: {
              yearId: nextRef.yearId,
              termId: nextRef.termId,
              label: formatTermTargetLabel(nextRef.year, nextRef.term),
            },
            description: `Move this assignment to ${formatTermTargetLabel(nextRef.year, nextRef.term)}`,
          };
        }
      }
    }

    if (compareTermRefs(assignmentTermRef, currentTermRef) < 0) {
      const validation = validatePushTarget(
        currentTermRef.yearId,
        currentTermRef.termId,
        academicYears,
        referenceDate
      );
      if (validation.valid) {
        fetch = {
          action: 'fetch',
          target: {
            yearId: currentTermRef.yearId,
            termId: currentTermRef.termId,
            label: formatTermTargetLabel(currentTermRef.year, currentTermRef.term),
          },
          description: `Bring this assignment forward to ${formatTermTargetLabel(currentTermRef.year, currentTermRef.term)}`,
        };
      }
    }
  }

  return {
    push,
    fetch,
    customTargets,
    currentTermRef,
    assignmentTermRef,
  };
}

export function applyAssignmentToTerm(
  assignment: PupilAssignedFee,
  targetYearId: string,
  targetTermId: string,
  academicYears: AcademicYear[],
  action: AssignmentTermMoveAction,
  referenceDate: Date = new Date(),
  processedBy: string = 'System Admin'
): PupilAssignedFee {
  const validation = validatePushTarget(
    targetYearId,
    targetTermId,
    academicYears,
    referenceDate
  );
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid push/fetch target');
  }

  const targetYear = academicYears.find((y) => y.id === targetYearId)!;
  const targetTerm = targetYear.terms.find((t) => t.id === targetTermId)!;

  const statusHistoryEntry: AssignmentStatusHistory = {
    date: referenceDate.toISOString(),
    action: action === 'push' ? 'term_pushed' : action === 'fetch' ? 'term_fetched' : 'time_adjusted',
    previousStatus: assignment.status,
    newStatus: assignment.status,
    processedBy,
    reason:
      action === 'custom'
        ? `Moved to ${formatTermTargetLabel(targetYear, targetTerm)}`
        : `${action === 'push' ? 'Pushed' : 'Fetched'} to ${formatTermTargetLabel(targetYear, targetTerm)}`,
    previousTimeSettings: {
      validityType: assignment.validityType,
      startAcademicYearId: assignment.startAcademicYearId,
      endAcademicYearId: assignment.endAcademicYearId,
      termApplicability: assignment.termApplicability,
      applicableTermIds: assignment.applicableTermIds,
    },
  };

  return {
    ...assignment,
    validityType: 'specific_terms',
    startAcademicYearId: targetYearId,
    endAcademicYearId: undefined,
    termApplicability: 'specific_terms',
    applicableTermIds: [targetTermId],
    statusHistory: [...(assignment.statusHistory || []), statusHistoryEntry],
  };
}
