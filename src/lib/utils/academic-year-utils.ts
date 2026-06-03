import type { AcademicYear, Term } from '@/types';

/**
 * 🚀 SMART TERM SELECTOR (Updated): Get the most appropriate term for data display
 * - During term time: Returns current active term
 * - During holidays/recess: Returns most recent completed term
 * This ensures data continuity during holiday periods
 * 
 * @deprecated Use getActiveOrMostRecentTerm() for explicit smart term selection
 * This function now calls getActiveOrMostRecentTerm() internally for backward compatibility
 */
export function getCurrentTerm(academicYear: AcademicYear, targetDate: Date = new Date()): Term | null {
  // Use the smart term selector to handle holidays correctly
  return getActiveOrMostRecentTerm(academicYear, targetDate);
}

/**
 * 🚀 SMART TERM SELECTOR: Get the most appropriate term for data display
 * - During term time: Returns current term
 * - During holidays/recess: Returns most recent completed term
 * This ensures data continuity during holiday periods
 */
export function getActiveOrMostRecentTerm(academicYear: AcademicYear, targetDate: Date = new Date()): Term | null {
  // First, check if we're currently in a term
  for (const term of academicYear.terms) {
    const termStart = new Date(term.startDate);
    const termEnd = new Date(term.endDate);

    if (targetDate >= termStart && targetDate <= termEnd) {
      return term;
    }
  }

  // 🚀 CRITICAL: If not in any term (holiday/recess period),
  // return the most recently completed term
  let mostRecentTerm: Term | null = null;
  let mostRecentEndDate = new Date(0); // Epoch start

  for (const term of academicYear.terms) {
    const termEnd = new Date(term.endDate);

    // Check if this term has ended and is more recent than our current candidate
    if (termEnd < targetDate && termEnd > mostRecentEndDate) {
      mostRecentTerm = term;
      mostRecentEndDate = termEnd;
    }
  }

  return mostRecentTerm;
}

/**
 * Check if we're in a holiday/recess period (not in any active term)
 */
export function isInHolidayPeriod(academicYear: AcademicYear): boolean {
  const now = new Date();

  // Check if we're currently in ANY term
  for (const term of academicYear.terms) {
    const termStart = new Date(term.startDate);
    const termEnd = new Date(term.endDate);

    if (now >= termStart && now <= termEnd) {
      return false; // We're in a term, not in holiday
    }
  }

  return true; // Not in any term = holiday period
}

export function getTermByDate(academicYear: AcademicYear, date: Date): Term | null {
  for (const term of academicYear.terms) {
    const termStart = new Date(term.startDate);
    const termEnd = new Date(term.endDate);

    if (date >= termStart && date <= termEnd) {
      return term;
    }
  }

  return null;
}

export function getTermNumber(academicYear: AcademicYear, termId: string): number {
  const termIndex = academicYear.terms.findIndex(term => term.id === termId);
  return termIndex >= 0 ? termIndex + 1 : 1;
}

export function isTermActive(term: Term): boolean {
  const now = new Date();
  const termStart = new Date(term.startDate);
  const termEnd = new Date(term.endDate);

  return now >= termStart && now <= termEnd;
}

/**
 * Check if a term has ended (past term)
 * Only ended terms should have snapshots
 */
export function isTermEnded(term: Term): boolean {
  const now = new Date();
  const termEnd = new Date(term.endDate);

  return now > termEnd;
}

/**
 * Check if a term is upcoming (future term)
 * Upcoming terms should never have snapshots
 */
export function isTermUpcoming(term: Term): boolean {
  const now = new Date();
  const termStart = new Date(term.startDate);

  return now < termStart;
}

/**
 * Classify a term's status relative to current date
 */
export function getTermStatus(term: Term): 'past' | 'current' | 'future' {
  const now = new Date();
  const termStart = new Date(term.startDate);
  const termEnd = new Date(term.endDate);

  if (now > termEnd) {
    return 'past';
  } else if (now >= termStart && now <= termEnd) {
    return 'current';
  } else {
    return 'future';
  }
}

/**
 * Get all terms that have ended and should have snapshots
 */
export function getEndedTerms(academicYears: AcademicYear[]): Array<{ term: Term, academicYear: AcademicYear }> {
  const endedTerms: Array<{ term: Term, academicYear: AcademicYear }> = [];

  for (const academicYear of academicYears) {
    for (const term of academicYear.terms) {
      if (isTermEnded(term)) {
        endedTerms.push({ term, academicYear });
      }
    }
  }

  return endedTerms;
}

/**
 * Get all terms that are current or upcoming and should NOT have snapshots
 */
export function getCurrentAndUpcomingTerms(academicYears: AcademicYear[]): Array<{ term: Term, academicYear: AcademicYear }> {
  const currentAndUpcomingTerms: Array<{ term: Term, academicYear: AcademicYear }> = [];

  for (const academicYear of academicYears) {
    for (const term of academicYear.terms) {
      const status = getTermStatus(term);
      if (status === 'current' || status === 'future') {
        currentAndUpcomingTerms.push({ term, academicYear });
      }
    }
  }

  return currentAndUpcomingTerms;
}

export function getTermLabel(academicYear: AcademicYear, termId: string): string {
  const term = academicYear.terms.find(t => t.id === termId);
  if (!term) return 'Unknown Term';

  const termNumber = getTermNumber(academicYear, termId);
  return `Term ${termNumber}`;
}

/**
 * Calculate next term dates based on exam's academic year and term
 * This ensures historical accuracy - if exam was done in Term 2 2025,
 * it will always show Term 3 2025 as next term, even years later
 */
export function getNextTermDates(
  examAcademicYearId: string,
  examTermId: string,
  allAcademicYears: AcademicYear[]
): { nextTermBegins: string; nextTermEnds: string } | null {
  // Find the academic year when the exam was conducted
  const examAcademicYear = allAcademicYears.find(year => year.id === examAcademicYearId);
  if (!examAcademicYear) {
    return null;
  }

  // Find current term index in that academic year
  const currentTermIndex = examAcademicYear.terms.findIndex(term => term.id === examTermId);
  if (currentTermIndex === -1) {
    return null;
  }

  // Check if there's a next term in the same academic year
  if (currentTermIndex < examAcademicYear.terms.length - 1) {
    const nextTerm = examAcademicYear.terms[currentTermIndex + 1];
    return {
      nextTermBegins: new Date(nextTerm.startDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      nextTermEnds: new Date(nextTerm.endDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    };
  }

  // If it's the last term, look for the first term of next academic year
  const nextAcademicYearNumber = parseInt(examAcademicYear.name) + 1;
  const nextAcademicYear = allAcademicYears.find(
    year => year.name === nextAcademicYearNumber.toString()
  );

  if (nextAcademicYear && nextAcademicYear.terms.length > 0) {
    const firstTermOfNextYear = nextAcademicYear.terms[0];
    return {
      nextTermBegins: new Date(firstTermOfNextYear.startDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      nextTermEnds: new Date(firstTermOfNextYear.endDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    };
  }

  // Fallback: return null if no next term can be determined
  return null;
}

export function groupRecordsByTerm<T extends { createdAt: string; termId?: string }>(
  records: T[],
  academicYear: AcademicYear
): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};

  // Initialize groups for each term
  academicYear.terms.forEach(term => {
    grouped[term.id] = [];
  });

  records.forEach(record => {
    let termId = record.termId;

    // If no termId is stored, determine it from the creation date
    if (!termId) {
      const recordDate = new Date(record.createdAt);
      const term = getTermByDate(academicYear, recordDate);
      termId = term?.id;
    }

    if (termId && grouped[termId]) {
      grouped[termId].push(record);
    } else {
      // If we can't determine the term, put it in the first term as fallback
      const firstTermId = academicYear.terms[0]?.id;
      if (firstTermId && grouped[firstTermId]) {
        grouped[firstTermId].push(record);
      }
    }
  });

  return grouped;
}

/**
 * Detect the current academic year.
 *
 * Priority order (IMPORTANT — do not change without careful consideration):
 * 1. isActive flag  — the admin explicitly marked this year as active. Trust it.
 * 2. Most recent date-range match — if today falls in multiple years' ranges
 *    (e.g. overlapping test records), pick the one that started most recently.
 * 3. Most recent year that has already started — for the gap between isActive
 *    being unset and the next year starting.
 * 4. First year in list — absolute last resort.
 *
 * Why NOT date-first? Because the DB has 128 academic years including old test
 * records. Array.find() on an unsorted array returns the first date-range match
 * which could be a 2023 record, not the real current year.
 */
export function detectCurrentAcademicYear(academicYears: AcademicYear[]): AcademicYear | undefined {
  if (!academicYears || academicYears.length === 0) return undefined;

  const now = new Date();

  // ── Priority 1: explicit isActive flag ───────────────────────────────────
  const activeByFlag = academicYears.find(y => y.isActive);
  if (activeByFlag) return activeByFlag;

  // ── Priority 2: most-recent year whose full date range contains today ─────
  // Collect ALL matches then pick the one with the latest startDate so we
  // don't accidentally pick an old test record.
  const dateMatches = academicYears.filter(year => {
    if (!year.startDate || !year.endDate) return false;
    const start = new Date(year.startDate);
    const end = new Date(year.endDate);
    return now >= start && now <= end;
  });

  if (dateMatches.length > 0) {
    // Sort descending by startDate — most recently started match wins
    dateMatches.sort((a, b) =>
      new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
    return dateMatches[0];
  }

  // ── Priority 3: most recently started year that has already begun ─────────
  // Covers the case where we're past ALL year end dates (e.g. new year not
  // yet entered in the DB, or holiday between years).
  const startedYears = academicYears.filter(year => {
    if (!year.startDate) return false;
    return new Date(year.startDate) <= now;
  });

  if (startedYears.length > 0) {
    startedYears.sort((a, b) =>
      new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
    return startedYears[0];
  }

  // ── Priority 4: absolute fallback — first in list ─────────────────────────
  return academicYears[0];
}


/**
 * Detect the current term within a given academic year using date-based comparison.
 * Checks if today's date falls between the startDate and endDate of each term.
 * During holidays/recess: falls back to the most recently completed term.
 * Final fallback: isCurrent flag, then to the first term in the list.
 */
export function detectCurrentTerm(year: AcademicYear | undefined | null): Term | undefined {
  if (!year || !year.terms || year.terms.length === 0) return undefined;

  const now = new Date();

  // Primary: find term where current date falls within its date range
  const byDate = year.terms.find(term => {
    if (!term.startDate || !term.endDate) return false;
    const start = new Date(term.startDate);
    const end = new Date(term.endDate);
    return now >= start && now <= end;
  });
  if (byDate) return byDate;

  // Fallback 1: during holidays/recess, return the most recently COMPLETED term
  // This matches the behavior of getActiveOrMostRecentTerm for data continuity
  let mostRecentTerm: Term | undefined;
  let mostRecentEndDate = new Date(0);

  for (const term of year.terms) {
    if (!term.endDate) continue;
    const termEnd = new Date(term.endDate);
    if (termEnd < now && termEnd > mostRecentEndDate) {
      mostRecentTerm = term;
      mostRecentEndDate = termEnd;
    }
  }
  if (mostRecentTerm) return mostRecentTerm;

  // Fallback 2: use the isCurrent flag
  const byFlag = year.terms.find(t => t.isCurrent);
  if (byFlag) return byFlag;

  // Fallback 3: return the first term
  return year.terms[0];
}