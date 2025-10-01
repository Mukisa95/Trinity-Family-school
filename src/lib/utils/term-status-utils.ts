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
  
  // Find the active academic year
  const activeAcademicYear = academicYears.find(year => {
    if (year.startDate && year.endDate && typeof year.startDate === 'string' && typeof year.endDate === 'string') {
      const yearStart = parseISO(year.startDate);
      const yearEnd = parseISO(year.endDate);
      if (isValid(yearStart) && isValid(yearEnd) && isWithinInterval(today, { start: yearStart, end: yearEnd })) {
        return true;
      }
    }
    return false;
  });
  
  if (!activeAcademicYear) {
    // No active academic year found
    return {
      isCurrentTerm: false,
      isRecessPeriod: false,
      isHolidayPeriod: false,
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
      shouldShowPreviousTermData: true // Default to showing previous term data when no active year
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
 * Get the effective term for data display
 * This returns the term whose data should be shown based on current status
 */
export function getEffectiveTermForDataDisplay(
  academicYears: AcademicYear[],
  targetDate: Date = new Date()
): { term: Term | null; academicYear: AcademicYear | null; reason: string } {
  const status = getTermStatusForDate(academicYears, targetDate);
  
  if (status.isCurrentTerm && status.currentTerm) {
    return {
      term: status.currentTerm,
      academicYear: academicYears.find(year => year.terms.some(t => t.id === status.currentTerm!.id)) || null,
      reason: 'Currently in term'
    };
  }
  
  if (status.shouldShowPreviousTermData && status.previousTerm) {
    return {
      term: status.previousTerm,
      academicYear: academicYears.find(year => year.terms.some(t => t.id === status.previousTerm!.id)) || null,
      reason: status.isRecessPeriod ? 'In recess - showing previous term data' : 'Holiday period - showing previous term data'
    };
  }
  
  // Fallback: find the most recent term
  let mostRecentTerm: Term | null = null;
  let mostRecentYear: AcademicYear | null = null;
  let mostRecentDate = new Date(0);
  
  for (const year of academicYears) {
    for (const term of year.terms) {
      const termEnd = parseISO(term.endDate);
      if (isValid(termEnd) && termEnd > mostRecentDate && termEnd <= targetDate) {
        mostRecentTerm = term;
        mostRecentYear = year;
        mostRecentDate = termEnd;
      }
    }
  }
  
  return {
    term: mostRecentTerm,
    academicYear: mostRecentYear,
    reason: 'Showing most recent term data'
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
