import type { AcademicYear, Term, ExcludedDay } from '@/types';
import {
  parseISO,
  isSameDay,
  getDay,
  getDate,
  getMonth,
  isWithinInterval,
  format,
  startOfDay,
  endOfDay
} from 'date-fns';

/**
 * Check if a date is a school day (not excluded and within academic year bounds)
 */
export function isSchoolDay(
  date: Date,
  academicYear: AcademicYear | null,
  excludedDays: ExcludedDay[]
): boolean {
  // Check if date is excluded (holidays, weekends, etc.)
  const activeAcademicYearOptions = academicYear ? [academicYear.id] : [];

  const isExcluded = excludedDays.some(excludedDay => {
    // 1. Check if the rule is explicitly skipped for this academic year
    if (academicYear && excludedDay.skippedYearIds && excludedDay.skippedYearIds.includes(academicYear.id)) {
      return false;
    }

    // 2. Check if the rule is scoped to a specific academic year only
    if (academicYear && excludedDay.applicableYearId && excludedDay.applicableYearId !== 'all') {
      if (excludedDay.applicableYearId !== academicYear.id) {
        return false;
      }
    }

    if (excludedDay.type === 'specific_date' && excludedDay.date) {
      return isSameDay(date, parseISO(excludedDay.date));
    } else if (excludedDay.type === 'recurring_day_of_week' && excludedDay.dayOfWeek !== undefined) {
      return getDay(date) === excludedDay.dayOfWeek;
    } else if (excludedDay.type === 'recurring_monthly' && excludedDay.dayOfMonth !== undefined) {
      return getDate(date) === excludedDay.dayOfMonth;
    } else if (excludedDay.type === 'recurring_annual' && excludedDay.dayOfMonth !== undefined && excludedDay.monthOfYear !== undefined) {
      // getMonth() is 0-indexed (0 = Jan, 11 = Dec), so add 1 to match our 1-12 format
      return getDate(date) === excludedDay.dayOfMonth && (getMonth(date) + 1) === excludedDay.monthOfYear;
    }
    return false;
  });

  if (isExcluded) return false;

  // If no academic year is provided, assume it's a school day if not excluded
  if (!academicYear) return true;

  // Check if date falls within any term
  const withinTerm = academicYear.terms.some(term => {
    const termStart = parseISO(term.startDate);
    const termEnd = parseISO(term.endDate);
    return isWithinInterval(date, { start: termStart, end: termEnd });
  });

  if (withinTerm) return true;

  // Date is between terms (recess/holiday period) but within the overall academic year.
  // Schools may run sessions during recess — treat as a school day unless explicitly excluded.
  const yearStart = parseISO(academicYear.startDate);
  const yearEnd = parseISO(academicYear.endDate);
  return isWithinInterval(date, { start: yearStart, end: yearEnd });
}

/**
 * Get the current term for a given date
 */
export function getCurrentTermForDate(
  date: Date,
  academicYear: AcademicYear | null
): Term | null {
  if (!academicYear) return null;

  return academicYear.terms.find(term => {
    const termStart = parseISO(term.startDate);
    const termEnd = parseISO(term.endDate);
    return isWithinInterval(date, { start: termStart, end: termEnd });
  }) || null;
}

/**
 * Check if attendance can be recorded for a specific date
 */
export function canRecordAttendance(
  date: Date,
  academicYear: AcademicYear | null,
  excludedDays: ExcludedDay[]
): { canRecord: boolean; reason?: string } {
  const today = new Date();
  const targetDate = startOfDay(date);
  const todayStart = startOfDay(today);

  // Don't allow recording for future dates (except today)
  if (targetDate > todayStart) {
    return {
      canRecord: false,
      reason: "Cannot record attendance for future dates"
    };
  }

  // ── Step 1: Check explicit exclusion rules (weekends, public holidays etc.) ──
  const isExcluded = excludedDays.some(excludedDay => {
    if (academicYear && excludedDay.skippedYearIds?.includes(academicYear.id)) return false;
    if (academicYear && excludedDay.applicableYearId && excludedDay.applicableYearId !== 'all') {
      if (excludedDay.applicableYearId !== academicYear.id) return false;
    }
    if (excludedDay.type === 'specific_date' && excludedDay.date) {
      return isSameDay(date, parseISO(excludedDay.date));
    } else if (excludedDay.type === 'recurring_day_of_week' && excludedDay.dayOfWeek !== undefined) {
      return getDay(date) === excludedDay.dayOfWeek;
    } else if (excludedDay.type === 'recurring_monthly' && excludedDay.dayOfMonth !== undefined) {
      return getDate(date) === excludedDay.dayOfMonth;
    } else if (excludedDay.type === 'recurring_annual' && excludedDay.dayOfMonth !== undefined && excludedDay.monthOfYear !== undefined) {
      return getDate(date) === excludedDay.dayOfMonth && (getMonth(date) + 1) === excludedDay.monthOfYear;
    }
    return false;
  });

  if (isExcluded) {
    return {
      canRecord: false,
      reason: "This date is marked as a non-school day (holiday/weekend)"
    };
  }

  // ── Step 2: If no academic year context, allow (exclusions already checked) ──
  if (!academicYear) {
    return { canRecord: true };
  }

  // ── Step 3: Check if the date is within an active term ──
  const withinActiveTerm = academicYear.terms.some(term => {
    const termStart = parseISO(term.startDate);
    const termEnd = parseISO(term.endDate);
    return isWithinInterval(date, { start: termStart, end: termEnd });
  });

  if (withinActiveTerm) {
    return { canRecord: true };
  }

  // ── Step 4: Date is between terms (recess/holiday) but within the academic year ──
  // Schools may run make-up sessions, remedial classes, or general attendance
  // tracking during inter-term breaks. Allow recording with the effective term
  // as context rather than hard-blocking.
  const yearStart = parseISO(academicYear.startDate);
  const yearEnd = parseISO(academicYear.endDate);
  if (isWithinInterval(date, { start: yearStart, end: yearEnd })) {
    return { canRecord: true };
  }

  // ── Step 5: Completely outside all academic year boundaries ──
  return {
    canRecord: false,
    reason: "This date is outside of any academic term"
  };
}


/**
 * Get term boundaries for attendance reporting
 */
export function getTermBoundaries(
  academicYear: AcademicYear | null,
  termId?: string
): { startDate: string; endDate: string } | null {
  if (!academicYear) return null;

  if (termId) {
    const term = academicYear.terms.find(t => t.id === termId);
    if (term) {
      return {
        startDate: term.startDate,
        endDate: term.endDate
      };
    }
  }

  // Return full academic year boundaries
  return {
    startDate: academicYear.startDate,
    endDate: academicYear.endDate
  };
}

/**
 * Get all terms for a date range
 */
export function getTermsInDateRange(
  startDate: Date,
  endDate: Date,
  academicYear: AcademicYear | null
): Term[] {
  if (!academicYear) return [];

  return academicYear.terms.filter(term => {
    const termStart = parseISO(term.startDate);
    const termEnd = parseISO(term.endDate);

    // Check if term overlaps with the date range
    return (termStart <= endDate && termEnd >= startDate);
  });
}

/**
 * Validate if a date range is appropriate for attendance reporting
 */
export function validateAttendanceDateRange(
  startDate: Date,
  endDate: Date,
  academicYear: AcademicYear | null
): { isValid: boolean; warning?: string } {
  if (!academicYear) {
    return {
      isValid: true,
      warning: "No academic year selected. Reports may include non-school days."
    };
  }

  const academicStart = parseISO(academicYear.startDate);
  const academicEnd = parseISO(academicYear.endDate);

  // Check if date range extends beyond academic year
  if (startDate < academicStart || endDate > academicEnd) {
    return {
      isValid: true,
      warning: `Date range extends beyond the academic year (${format(academicStart, 'MMM dd, yyyy')} - ${format(academicEnd, 'MMM dd, yyyy')})`
    };
  }

  return { isValid: true };
}

/**
 * Get attendance recording status message
 */
export function getAttendanceRecordingStatus(
  date: Date,
  academicYear: AcademicYear | null,
  excludedDays: ExcludedDay[]
): string {
  const { canRecord, reason } = canRecordAttendance(date, academicYear, excludedDays);

  if (canRecord) {
    const currentTerm = getCurrentTermForDate(date, academicYear);
    if (currentTerm) {
      return `Recording attendance for ${currentTerm.name}`;
    }
    return "Recording attendance";
  }

  return reason || "Cannot record attendance";
} 