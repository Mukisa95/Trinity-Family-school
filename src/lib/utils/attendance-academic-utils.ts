import type { AcademicYear, Term, ExcludedDay } from '@/types';
import { 
  parseISO, 
  isSameDay, 
  getDay, 
  isWithinInterval,
  format,
  startOfDay,
  endOfDay
} from 'date-fns';

/**
 * Check if a date is a school day (not excluded and within term dates)
 */
export function isSchoolDay(
  date: Date, 
  academicYear: AcademicYear | null, 
  excludedDays: ExcludedDay[]
): boolean {
  // Check if date is excluded (holidays, weekends, etc.)
  const isExcluded = excludedDays.some(excludedDay => {
    if (excludedDay.type === 'specific_date' && excludedDay.date) {
      return isSameDay(date, parseISO(excludedDay.date));
    } else if (excludedDay.type === 'recurring_day_of_week' && excludedDay.dayOfWeek !== undefined) {
      return getDay(date) === excludedDay.dayOfWeek;
    }
    return false;
  });

  if (isExcluded) return false;

  // If no academic year is provided, assume it's a school day if not excluded
  if (!academicYear) return true;

  // Check if date falls within any term
  return academicYear.terms.some(term => {
    const termStart = parseISO(term.startDate);
    const termEnd = parseISO(term.endDate);
    return isWithinInterval(date, { start: termStart, end: termEnd });
  });
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

  // Check if it's a school day
  if (!isSchoolDay(date, academicYear, excludedDays)) {
    const currentTerm = getCurrentTermForDate(date, academicYear);
    if (!currentTerm) {
      return { 
        canRecord: false, 
        reason: "This date is outside of any academic term" 
      };
    } else {
      return { 
        canRecord: false, 
        reason: "This date is marked as a non-school day (holiday/weekend)" 
      };
    }
  }

  return { canRecord: true };
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