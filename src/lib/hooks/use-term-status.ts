import { useMemo } from 'react';
import { useAcademicNow, useAcademicYears } from './use-academic-years';
import {
  getTermStatusForDate,
  getEffectiveTermForDataDisplay,
  shouldDisplayRecessMode,
  getCurrentPeriodMessage,
  getDetailedPeriodMessage,
  type TermStatus
} from '../utils/term-status-utils';

/**
 * Hook to get the current term status and determine what data should be displayed
 */
export function useTermStatus(targetDate?: Date) {
  const { data: academicYears = [], isLoading } = useAcademicYears();
  const academicNow = useAcademicNow(targetDate);

  const termStatus = useMemo(() => {
    return getTermStatusForDate(academicYears, academicNow);
  }, [academicNow, academicYears]);

  const effectiveTerm = useMemo(() => {
    return getEffectiveTermForDataDisplay(academicYears, academicNow);
  }, [academicNow, academicYears]);

  const isRecessMode = useMemo(() => {
    return shouldDisplayRecessMode(academicYears, academicNow);
  }, [academicNow, academicYears]);

  const periodMessage = useMemo(() => {
    return getCurrentPeriodMessage(academicYears, academicNow);
  }, [academicNow, academicYears]);

  return {
    termStatus,
    effectiveTerm,
    isRecessMode,
    periodMessage,
    academicYears,
    isLoading
  };
}

/**
 * Hook to get the effective term ID for data filtering
 * This is useful for components that need to filter data by term
 */
export function useEffectiveTermId(targetDate?: Date) {
  const { effectiveTerm } = useTermStatus(targetDate);
  return effectiveTerm.term?.id || null;
}

/**
 * Hook to check if the system is currently in recess mode
 */
export function useRecessMode(targetDate?: Date) {
  const { isRecessMode, termStatus } = useTermStatus(targetDate);
  return {
    isRecessMode,
    recessInfo: termStatus.recessInfo
  };
}

/**
 * Hook to get the current academic period information
 */
export function useCurrentAcademicPeriod(targetDate?: Date) {
  const { data: academicYears = [], isLoading } = useAcademicYears();
  const { termStatus, periodMessage } = useTermStatus(targetDate);
  const academicNow = useAcademicNow(targetDate);

  const detailedMessage = useMemo(() => {
    return getDetailedPeriodMessage(academicYears, academicNow);
  }, [academicNow, academicYears]);

  return {
    currentTerm: termStatus.currentTerm,
    previousTerm: termStatus.previousTerm,
    nextTerm: termStatus.nextTerm,
    isInRecess: termStatus.isRecessPeriod,
    isHoliday: termStatus.isHolidayPeriod,
    shouldShowPreviousTermData: termStatus.shouldShowPreviousTermData,
    periodMessage,
    detailedMessage,
    recessInfo: termStatus.recessInfo,
    academicYears,
    isLoading
  };
}

/**
 * 🚀 Hook to get the term that should be used for data display
 * Returns the current term if in session, or most recent term if in holiday
 */
export function useDefaultTerm(targetDate?: Date) {
  const { effectiveTerm, termStatus } = useTermStatus(targetDate);

  return {
    term: effectiveTerm.term,
    academicYear: effectiveTerm.academicYear,
    reason: effectiveTerm.reason,
    isHoliday: termStatus.isHolidayPeriod || termStatus.isRecessPeriod,
  };
}
