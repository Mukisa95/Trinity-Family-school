import type {
  AcademicYear,
  AssignmentStatusHistory,
  PupilAssignedFee,
} from '@/types';
import { getEffectiveTermForDataDisplay } from '@/lib/utils/term-status-utils';

export type AssignmentUpsertOutcome = 'created' | 'merged' | 'unchanged';

export interface AssignmentUpsertResult {
  assignments: PupilAssignedFee[];
  assignment: PupilAssignedFee;
  outcome: AssignmentUpsertOutcome;
  consolidatedCount: number;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function sortTermIds(termIds: string[], academicYears: AcademicYear[]): string[] {
  const order = new Map<string, number>();
  for (const year of academicYears) {
    for (const term of year.terms || []) {
      order.set(term.id, new Date(term.startDate).getTime());
    }
  }

  return unique(termIds).sort((a, b) => {
    const aOrder = order.get(a) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = order.get(b) ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder || a.localeCompare(b);
  });
}

function yearFallsWithinRange(
  year: AcademicYear,
  startYear: AcademicYear,
  endYear: AcademicYear,
): boolean {
  const yearStart = new Date(year.startDate).getTime();
  return (
    yearStart >= new Date(startYear.startDate).getTime() &&
    yearStart <= new Date(endYear.startDate).getTime()
  );
}

/**
 * Returns the known term IDs covered by an assignment. `null` means the
 * assignment is intentionally unbounded (indefinite + all terms).
 */
export function getAssignmentCoveredTermIds(
  assignment: PupilAssignedFee,
  academicYears: AcademicYear[],
): string[] | null {
  const exclusions = new Set(assignment.excludedTermIds || []);
  const withoutExclusions = (termIds: string[]) =>
    sortTermIds(termIds.filter((termId) => !exclusions.has(termId)), academicYears);

  if (
    assignment.termApplicability === 'specific_terms' ||
    assignment.validityType === 'specific_terms'
  ) {
    return withoutExclusions(assignment.applicableTermIds || []);
  }

  if (assignment.validityType === 'current_term') {
    if (assignment.applicableTermIds?.length) {
      return withoutExclusions(assignment.applicableTermIds);
    }
    const effective = getEffectiveTermForDataDisplay(academicYears);
    return effective.term ? withoutExclusions([effective.term.id]) : [];
  }

  if (
    assignment.validityType === 'current_year' ||
    assignment.validityType === 'specific_year'
  ) {
    const effective = getEffectiveTermForDataDisplay(academicYears);
    const yearId = assignment.startAcademicYearId || effective.academicYear?.id;
    const year = academicYears.find((candidate) => candidate.id === yearId);
    return withoutExclusions(year?.terms.map((term) => term.id) || []);
  }

  if (assignment.validityType === 'year_range') {
    const startYear = academicYears.find(
      (year) => year.id === assignment.startAcademicYearId,
    );
    const endYear = academicYears.find(
      (year) => year.id === assignment.endAcademicYearId,
    );
    if (!startYear || !endYear) return [];

    return withoutExclusions(
      academicYears
        .filter((year) => yearFallsWithinRange(year, startYear, endYear))
        .flatMap((year) => year.terms.map((term) => term.id)),
    );
  }

  if (assignment.validityType === 'indefinite') {
    return null;
  }

  return withoutExclusions(assignment.applicableTermIds || []);
}

/** Shared source of truth for assignment eligibility in a year/term context. */
export function isAssignmentValidForContext(
  assignment: PupilAssignedFee,
  academicYearId: string,
  termId: string,
  academicYears: AcademicYear[],
): boolean {
  if (!assignment || assignment.status === 'disabled') return false;
  if (assignment.excludedTermIds?.includes(termId)) return false;

  const academicYear = academicYears.find((year) => year.id === academicYearId);
  if (!academicYear) return false;

  const termIsIncluded =
    assignment.termApplicability === 'all_terms' ||
    assignment.applicableTermIds?.includes(termId) === true;

  if (!termIsIncluded) return false;

  switch (assignment.validityType) {
    case 'current_term':
    case 'specific_terms':
      return assignment.termApplicability === 'all_terms' ||
        assignment.applicableTermIds?.includes(termId) === true;

    case 'current_year':
    case 'specific_year':
      return !assignment.startAcademicYearId ||
        assignment.startAcademicYearId === academicYearId;

    case 'year_range': {
      const startYear = academicYears.find(
        (year) => year.id === assignment.startAcademicYearId,
      );
      const endYear = academicYears.find(
        (year) => year.id === assignment.endAcademicYearId,
      );
      if (!startYear || !endYear) return false;
      return yearFallsWithinRange(academicYear, startYear, endYear);
    }

    case 'indefinite':
    default:
      return true;
  }
}

export function hasValidFeeAssignment(
  assignments: PupilAssignedFee[] | undefined,
  feeStructureId: string,
  academicYearId: string,
  termId: string,
  academicYears: AcademicYear[],
): boolean {
  return (assignments || []).some(
    (assignment) =>
      assignment.feeStructureId === feeStructureId &&
      isAssignmentValidForContext(
        assignment,
        academicYearId,
        termId,
        academicYears,
      ),
  );
}

function mergeHistories(assignments: PupilAssignedFee[]): AssignmentStatusHistory[] {
  return assignments
    .flatMap((assignment) => assignment.statusHistory || [])
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * Adds an assignment without creating a second record for the same fee.
 * Existing finite scopes are consolidated into one union of term IDs.
 */
export function upsertPupilFeeAssignment(
  assignments: PupilAssignedFee[] | undefined,
  incoming: PupilAssignedFee,
  academicYears: AcademicYear[],
  processedBy: string = 'System Admin',
): AssignmentUpsertResult {
  const current = assignments || [];
  const matching = current.filter(
    (assignment) => assignment.feeStructureId === incoming.feeStructureId,
  );

  if (matching.length === 0) {
    return {
      assignments: [...current, incoming],
      assignment: incoming,
      outcome: 'created',
      consolidatedCount: 0,
    };
  }

  const canonical = matching[0];
  const incomingTerms = getAssignmentCoveredTermIds(incoming, academicYears);
  const existingUnbounded = matching.find(
    (assignment) => getAssignmentCoveredTermIds(assignment, academicYears) === null,
  );
  const incomingIsUnbounded = incomingTerms === null;

  let merged: PupilAssignedFee;

  if (incomingIsUnbounded) {
    merged = {
      ...canonical,
      ...incoming,
      id: canonical.id,
      assignedAt: canonical.assignedAt,
      assignedBy: canonical.assignedBy || incoming.assignedBy,
      excludedTermIds: incoming.excludedTermIds,
    };
  } else if (existingUnbounded) {
    const targetIds = new Set(incomingTerms);
    merged = {
      ...existingUnbounded,
      id: canonical.id,
      assignedAt: canonical.assignedAt,
      assignedBy: canonical.assignedBy || incoming.assignedBy,
      status: 'active',
      excludedTermIds: (existingUnbounded.excludedTermIds || []).filter(
        (termId) => !targetIds.has(termId),
      ),
    };
  } else {
    const mergedTermIds = sortTermIds(
      [
        ...matching.flatMap(
          (assignment) => getAssignmentCoveredTermIds(assignment, academicYears) || [],
        ),
        ...incomingTerms,
      ],
      academicYears,
    );

    merged = {
      ...canonical,
      status: 'active',
      validityType: 'specific_terms',
      startAcademicYearId: canonical.startAcademicYearId || incoming.startAcademicYearId,
      endAcademicYearId: undefined,
      termApplicability: 'specific_terms',
      applicableTermIds: mergedTermIds,
      excludedTermIds: (canonical.excludedTermIds || []).filter(
        (termId) => !mergedTermIds.includes(termId),
      ),
      notes: canonical.notes || incoming.notes,
      inlineDiscount: canonical.inlineDiscount || incoming.inlineDiscount,
    };
  }

  const previousTermIds = getAssignmentCoveredTermIds(canonical, academicYears);
  const mergedTermIds = getAssignmentCoveredTermIds(merged, academicYears);
  const scopeChanged =
    previousTermIds === null || mergedTermIds === null
      ? previousTermIds !== mergedTermIds
      : previousTermIds.join('|') !== mergedTermIds.join('|');
  const consolidatedCount = Math.max(0, matching.length - 1);
  const changed =
    scopeChanged ||
    consolidatedCount > 0 ||
    canonical.status !== merged.status ||
    JSON.stringify(canonical.excludedTermIds || []) !==
      JSON.stringify(merged.excludedTermIds || []);

  if (changed) {
    merged.statusHistory = [
      ...mergeHistories([...matching, incoming]),
      {
        date: new Date().toISOString(),
        action: 'time_adjusted',
        previousStatus: canonical.status,
        newStatus: merged.status,
        processedBy,
        reason:
          consolidatedCount > 0
            ? `Consolidated ${matching.length} assignment records and extended term coverage`
            : 'Extended assignment term coverage',
        previousTimeSettings: {
          validityType: canonical.validityType,
          startAcademicYearId: canonical.startAcademicYearId,
          endAcademicYearId: canonical.endAcademicYearId,
          termApplicability: canonical.termApplicability,
          applicableTermIds: canonical.applicableTermIds,
          excludedTermIds: canonical.excludedTermIds,
        },
      },
    ];
  }

  const matchingIds = new Set(matching.map((assignment) => assignment.id));
  const next = current.reduce<PupilAssignedFee[]>((result, assignment) => {
    if (!matchingIds.has(assignment.id)) {
      result.push(assignment);
    } else if (assignment.id === canonical.id) {
      result.push(merged);
    }
    return result;
  }, []);

  return {
    assignments: next,
    assignment: merged,
    outcome: changed ? 'merged' : 'unchanged',
    consolidatedCount,
  };
}

/** Consolidates every duplicate fee assignment while preserving first-seen order. */
export function consolidatePupilFeeAssignments(
  assignments: PupilAssignedFee[] | undefined,
  academicYears: AcademicYear[],
  processedBy: string = 'System Admin',
): PupilAssignedFee[] {
  let consolidated: PupilAssignedFee[] = [];
  for (const assignment of assignments || []) {
    consolidated = upsertPupilFeeAssignment(
      consolidated,
      assignment,
      academicYears,
      processedBy,
    ).assignments;
  }
  return consolidated;
}
