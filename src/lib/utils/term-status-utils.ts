import type { AcademicYear, Term } from '@/types';
import { parseISO, isValid, isWithinInterval, differenceInCalendarDays, compareAsc } from 'date-fns';

export interface TermStatus {
  isCurrentTerm: boolean;
  isRecessPeriod: boolean;
  isHolidayPeriod: boolean;
  currentTerm: Term | null;
  previousTerm: Term | null;
  nextTerm: Term | null;
  recessInfo: {
    isInRecess: boolean;
    recessType: 'mid-term' | 'end-of-year' | null;
    recessStartDate: string | null;
    recessEndDate: string | null;
    daysInRecess: number;
    daysUntilNextTerm: number;
  };
  shouldShowPreviousTermData: boolean;
}

export interface RecessPeriod {
  name: string;
  startDate: string;
  endDate: string;
  days: number;
  type: 'mid-term' | 'end-of-year';
}

/**
 * Check if a date is within a term
 */
function isDateWithinTerm(date: Date, termStartDateStr: string, termEndDateStr: string): boolean {
  if (!termStartDateStr || !termEndDateStr || typeof termStartDateStr !== 'string' || typeof termEndDateStr !== 'string') return false;
  const termStart = parseISO(termStartDateStr);
  const termEnd = parseISO(termEndDateStr);
  if (!isValid(termStart) || !isValid(termEnd)) return false;
  return isWithinInterval(date, { start: termStart, end: termEnd });
}

/**
 * Get all recess periods for an academic year
 */
export function getRecessPeriods(academicYear: AcademicYear): RecessPeriod[] {
  if (!academicYear.terms || academicYear.terms.length < 2) return [];

  const recessPeriods: RecessPeriod[] = [];
  const sortedTerms = [...academicYear.terms]
    .filter(term => term.startDate && term.endDate &&
      typeof term.startDate === 'string' && typeof term.endDate === 'string')
    .sort((a, b) => compareAsc(parseISO(a.startDate), parseISO(b.startDate)));

  // Mid-term recesses (between terms)
  for (let i = 0; i < sortedTerms.length - 1; i++) {
    const currentTerm = sortedTerms[i];
    const nextTerm = sortedTerms[i + 1];

    const currentTermEnd = parseISO(currentTerm.endDate);
    const nextTermStart = parseISO(nextTerm.startDate);

    if (isValid(currentTermEnd) && isValid(nextTermStart)) {
      const recessDays = differenceInCalendarDays(nextTermStart, currentTermEnd) - 1;

      if (recessDays > 0) {
        recessPeriods.push({
          name: `Recess between ${currentTerm.name} and ${nextTerm.name}`,
          startDate: new Date(currentTermEnd.getTime() + 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(nextTermStart.getTime() - 24 * 60 * 60 * 1000).toISOString(),
          days: recessDays,
          type: 'mid-term'
        });
      }
    }
  }

  // End-of-year recess (after last term)
  if (sortedTerms.length > 0) {
    const lastTerm = sortedTerms[sortedTerms.length - 1];
    const lastTermEnd = parseISO(lastTerm.endDate);

    if (isValid(lastTermEnd)) {
      // Check if there's a next academic year
      const nextYearStart = academicYear.endDate ? parseISO(academicYear.endDate) : null;

      if (nextYearStart && isValid(nextYearStart)) {
        const recessDays = differenceInCalendarDays(nextYearStart, lastTermEnd) - 1;

        if (recessDays > 0) {
          recessPeriods.push({
            name: 'End of Year Recess',
            startDate: new Date(lastTermEnd.getTime() + 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date(nextYearStart.getTime() - 24 * 60 * 60 * 1000).toISOString(),
            days: recessDays,
            type: 'end-of-year'
          });
        }
      }
    }
  }

  return recessPeriods;
}

/**
 * Get comprehensive term status for a specific date
 */
export function getTermStatusForDate(
  academicYears: AcademicYear[],
  targetDate: Date = new Date()
): TermStatus {
  const today = targetDate;

  // 🚀 SMART YEAR SELECTION:
  // 1. First, check if we are explicitly inside a TERM of any year
  // 2. If not, check if we are inside the DATE RANGE of any year
  // 3. Fallback to the explicitly marked ACTIVE year in DB
  let activeAcademicYear = academicYears.find(year => {
    return year.terms.some(term => isDateWithinTerm(today, term.startDate, term.endDate));
  });

  if (!activeAcademicYear) {
    activeAcademicYear = academicYears.find(year => {
      if (year.startDate && year.endDate && typeof year.startDate === 'string' && typeof year.endDate === 'string') {
        const yearStart = parseISO(year.startDate);
        const yearEnd = parseISO(year.endDate);
        if (isValid(yearStart) && isValid(yearEnd) && isWithinInterval(today, { start: yearStart, end: yearEnd })) {
          return true;
        }
      }
      return false;
    });
  }

  if (!activeAcademicYear) {
    activeAcademicYear = academicYears.find(year => year.isActive);
  }

  if (!activeAcademicYear) {
    // No active academic year found
    return {
      isCurrentTerm: false,
      isRecessPeriod: false,
      isHolidayPeriod: true, // Default to holiday if no year active
      currentTerm: null,
      previousTerm: null,
      nextTerm: null,
      recessInfo: {
        isInRecess: false,
        recessType: null,
        recessStartDate: null,
        recessEndDate: null,
        daysInRecess: 0,
        daysUntilNextTerm: 0
      },
      shouldShowPreviousTermData: true
    };
  }

  // Find current term
  let currentTerm: Term | null = null;
  for (const term of activeAcademicYear.terms) {
    if (isDateWithinTerm(today, term.startDate, term.endDate)) {
      currentTerm = term;
      break;
    }
  }

  // Get recess periods
  const recessPeriods = getRecessPeriods(activeAcademicYear);

  // Check if we're in a recess period
  let isInRecess = false;
  let currentRecess: RecessPeriod | null = null;

  for (const recess of recessPeriods) {
    const recessStart = parseISO(recess.startDate);
    const recessEnd = parseISO(recess.endDate);

    if (isValid(recessStart) && isValid(recessEnd) && isWithinInterval(today, { start: recessStart, end: recessEnd })) {
      isInRecess = true;
      currentRecess = recess;
      break;
    }
  }

  // Find previous and next terms
  const sortedTerms = [...activeAcademicYear.terms]
    .filter(term => term.startDate && term.endDate)
    .sort((a, b) => compareAsc(parseISO(a.startDate), parseISO(b.startDate)));

  let previousTerm: Term | null = null;
  let nextTerm: Term | null = null;

  if (currentTerm) {
    const currentTermIndex = sortedTerms.findIndex(term => term.id === currentTerm!.id);
    if (currentTermIndex > 0) {
      previousTerm = sortedTerms[currentTermIndex - 1];
    }
    if (currentTermIndex < sortedTerms.length - 1) {
      nextTerm = sortedTerms[currentTermIndex + 1];
    }
  } else if (isInRecess && currentRecess) {
    // If we're in recess, find the term that just ended and the term that's coming next
    const recessStart = parseISO(currentRecess.startDate);
    const recessEnd = parseISO(currentRecess.endDate);

    // Find the term that just ended (before recess)
    for (const term of sortedTerms) {
      const termEnd = parseISO(term.endDate);
      if (isValid(termEnd) && Math.abs(differenceInCalendarDays(termEnd, recessStart)) <= 1) {
        previousTerm = term;
        break;
      }
    }

    // Find the term that's coming next (after recess)
    for (const term of sortedTerms) {
      const termStart = parseISO(term.startDate);
      if (isValid(termStart) && Math.abs(differenceInCalendarDays(termStart, recessEnd)) <= 1) {
        nextTerm = term;
        break;
      }
    }
  } else if (!currentTerm && !isInRecess) {
    // 🚀 CRITICAL: If we're in a holiday period (not in term, not in recess),
    // find the most recently ended term as previousTerm
    let mostRecentTerm: Term | null = null;
    let mostRecentDate = new Date(0);

    for (const term of sortedTerms) {
      const termEnd = parseISO(term.endDate);
      if (isValid(termEnd) && termEnd <= today && termEnd > mostRecentDate) {
        mostRecentTerm = term;
        mostRecentDate = termEnd;
      }
    }

    if (mostRecentTerm) {
      previousTerm = mostRecentTerm;

      // Find the next term after the previous term
      const previousTermIndex = sortedTerms.findIndex(term => term.id === mostRecentTerm!.id);
      if (previousTermIndex >= 0 && previousTermIndex < sortedTerms.length - 1) {
        nextTerm = sortedTerms[previousTermIndex + 1];
      }
    }
  }

  // 🚀 CROSS-YEAR FALLBACK for PREVIOUS TERM
  // If we still don't have a previous term (e.g., new year started),
  // look at the most recently ended term from ANY academic year.
  if (!previousTerm) {
    const allTerms = academicYears
      .flatMap(y => y.terms || [])
      .filter(t => t.startDate && t.endDate)
      .sort((a, b) => compareAsc(parseISO(a.endDate!), parseISO(b.endDate!))); // Sort by end date ascending

    let lastEndedTerm: Term | null = null;
    for (const term of allTerms) {
      const termEnd = parseISO(term.endDate!);
      if (isValid(termEnd) && termEnd <= today) {
        lastEndedTerm = term;
      }
    }

    if (lastEndedTerm) {
      previousTerm = lastEndedTerm;
    }
  }

  // 🚀 CROSS-YEAR FALLBACK for NEXT TERM (Fixing "TBD")
  // If nextTerm is null, find the earliest starting term that is in the future
  if (!nextTerm) {
    const allTerms = academicYears
      .flatMap(y => y.terms || [])
      .filter(t => t.startDate && t.endDate)
      .sort((a, b) => compareAsc(parseISO(a.startDate!), parseISO(b.startDate!))); // Sort by start date ascending

    for (const term of allTerms) {
      const termStart = parseISO(term.startDate!);
      // If term starts in the future (after today)
      if (isValid(termStart) && termStart > today) {
        nextTerm = term;
        break; // Found the very next term
      }
    }
  }

  // Calculate days until next term
  let daysUntilNextTerm = 0;
  if (nextTerm) {
    const nextTermStart = parseISO(nextTerm.startDate);
    if (isValid(nextTermStart)) {
      daysUntilNextTerm = Math.max(0, differenceInCalendarDays(nextTermStart, today));
    }
  }

  // Determine if we should show previous term data
  // Show previous term data if:
  // 1. We're in a recess period, OR
  // 2. We're not in any term (holiday period), OR
  // 3. The current term just started (first few days)
  const shouldShowPreviousTermData = isInRecess || (!currentTerm && !isInRecess);

  return {
    isCurrentTerm: !!currentTerm,
    isRecessPeriod: isInRecess,
    isHolidayPeriod: !currentTerm && !isInRecess,
    currentTerm,
    previousTerm,
    nextTerm,
    recessInfo: {
      isInRecess,
      recessType: currentRecess?.type || null,
      recessStartDate: currentRecess?.startDate || null,
      recessEndDate: currentRecess?.endDate || null,
      daysInRecess: currentRecess?.days || 0,
      daysUntilNextTerm
    },
    shouldShowPreviousTermData
  };
}

/**
 * Get the effective term for data display.
 *
 * ⚠️  IMPORTANT — Two-pass GLOBAL search (do NOT route through getTermStatusForDate):
 *
 * getTermStatusForDate limits its search to a single "active" academic year
 * (chosen via isActive flag as last resort). During a holiday after Term 1 2026
 * ended, it would return previousTerm = T3-2025 from the isActive year 2025,
 * completely ignoring the more-recent T1-2026 that ended this year.
 *
 * This function therefore does its own two-pass scan across ALL years:
 *   Pass 1 — Is today inside any term?  → return it immediately.
 *   Pass 2 — Find the globally most-recently-ended term.
 */
export function getEffectiveTermForDataDisplay(
  academicYears: AcademicYear[],
  targetDate: Date = new Date()
): { term: Term | null; academicYear: AcademicYear | null; reason: string } {

  // ─── Pass 1: currently-active term (any year) ─────────────────────────────
  for (const year of academicYears) {
    for (const term of year.terms) {
      if (isDateWithinTerm(targetDate, term.startDate, term.endDate)) {
        return { term, academicYear: year, reason: 'Currently in term' };
      }
    }
  }

  // ─── Pass 2: most recently ended term across ALL years ────────────────────
  let mostRecentTerm: Term | null = null;
  let mostRecentYear: AcademicYear | null = null;
  let mostRecentDate = new Date(0);

  for (const year of academicYears) {
    for (const term of year.terms) {
      if (!term.endDate || typeof term.endDate !== 'string' || term.endDate.trim() === '') {
        if (process.env.NODE_ENV === 'development') {
          console.debug('⚠️ Invalid term.endDate:', term.endDate, 'in term:', term.name);
        }
        continue;
      }
      const termEnd = parseISO(term.endDate);
      if (isValid(termEnd) && termEnd <= targetDate && termEnd > mostRecentDate) {
        mostRecentTerm = term;
        mostRecentYear = year;
        mostRecentDate = termEnd;
      }
    }
  }

  return {
    term: mostRecentTerm,
    academicYear: mostRecentYear,
    reason: mostRecentTerm
      ? 'Holiday/recess – showing most recently completed term'
      : 'No term data available',
  };
}

/**
 * Check if the system should display recess/holiday mode
 */
export function shouldDisplayRecessMode(academicYears: AcademicYear[]): boolean {
  const status = getTermStatusForDate(academicYears);
  return status.isRecessPeriod || status.isHolidayPeriod;
}

/**
 * Get a user-friendly message about the current academic period
 */
export function getCurrentPeriodMessage(academicYears: AcademicYear[]): string {
  const status = getTermStatusForDate(academicYears);

  if (status.isCurrentTerm && status.currentTerm) {
    return `Currently in ${status.currentTerm.name}`;
  }

  if (status.isRecessPeriod) {
    const recessType = status.recessInfo.recessType === 'mid-term' ? 'Mid-term recess' : 'End of year recess';
    const daysLeft = status.recessInfo.daysUntilNextTerm;

    if (daysLeft > 0) {
      return `${recessType} - ${daysLeft} days until next term`;
    } else {
      return `${recessType} - Next term starts soon`;
    }
  }

  if (status.isHolidayPeriod) {
    return 'Holiday period - displaying previous term data';
  }

  return 'Academic period not determined';
}

/**
 * 🚀 Get detailed holiday/recess message with term information
 * Shows which term ended and when the next term starts
 */
export function getDetailedPeriodMessage(academicYears: AcademicYear[]): {
  message: string;
  isHoliday: boolean;
  previousTermName: string | null;
  previousTermEndDate: string | null;
  nextTermName: string | null;
  nextTermStartDate: string | null;
} {
  const status = getTermStatusForDate(academicYears);

  if (status.isCurrentTerm && status.currentTerm) {
    return {
      message: `Currently in ${status.currentTerm.name}`,
      isHoliday: false,
      previousTermName: null,
      previousTermEndDate: null,
      nextTermName: status.nextTerm?.name || null,
      nextTermStartDate: status.nextTerm?.startDate || null,
    };
  }

  // We're in holiday/recess period
  const previousTermName = status.previousTerm?.name || 'Unknown Term';
  const previousTermEndDate = status.previousTerm?.endDate || null;
  const nextTermName = status.nextTerm?.name || 'Unknown Term';
  const nextTermStartDate = status.nextTerm?.startDate || null;

  let message = '';

  if (status.isRecessPeriod) {
    const daysLeft = status.recessInfo.daysUntilNextTerm;
    message = `${previousTermName} ended. Mid-term recess in progress.`;

    if (daysLeft > 0 && nextTermName && nextTermStartDate) {
      const nextStartDate = new Date(nextTermStartDate).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
      message += ` ${nextTermName} starts on ${nextStartDate} (${daysLeft} days).`;
    }
  } else if (status.isHolidayPeriod) {
    if (previousTermEndDate) {
      const endDate = new Date(previousTermEndDate);
      const today = new Date();
      const daysSinceEnd = Math.floor((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceEnd === 0) {
        message = `${previousTermName} ended today. Holidays have begun.`;
      } else if (daysSinceEnd === 1) {
        message = `${previousTermName} ended yesterday. Holidays have begun.`;
      } else {
        const endDateStr = endDate.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        });
        message = `${previousTermName} ended on ${endDateStr}. Holidays in progress.`;
      }
    } else {
      message = `${previousTermName} has ended. Holiday period in progress.`;
    }

    if (nextTermName && nextTermStartDate) {
      const nextStartDate = new Date(nextTermStartDate).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
      const daysUntil = status.recessInfo.daysUntilNextTerm;
      message += ` ${nextTermName} starts on ${nextStartDate}`;
      if (daysUntil > 0) {
        message += ` (${daysUntil} days).`;
      } else {
        message += '.';
      }
    }
  }

  return {
    message,
    isHoliday: true,
    previousTermName,
    previousTermEndDate,
    nextTermName,
    nextTermStartDate,
  };
}